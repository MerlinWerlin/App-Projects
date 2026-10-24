#!/usr/bin/env python3
"""App Store Connect helper for every App Factory app (runs in GitHub Actions with the repo's ASC secrets).

  python scripts/asc/asc.py status <app>   read-only report of what App Store Connect has for the app
  python scripts/asc/asc.py apply  <app>   push apps/<app>/store/listing.json (text, URLs, category,
                                            age rating, in-app purchase) - never submits for review

Writes a markdown report to $REPORT (default asc-report.md). Secrets: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8.
What the API cannot do (owner-only in App Store Connect): agreements/bank/tax, the App Privacy label,
pressing Submit for Review.
"""
import json, os, sys, time, pathlib
import jwt, requests

API = "https://api.appstoreconnect.apple.com"
ROOT = pathlib.Path(__file__).resolve().parents[2]
out = []


def say(s=""):
    out.append(s)
    print(s)


def token():
    now = int(time.time())
    return jwt.encode({"iss": os.environ["ASC_ISSUER_ID"], "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
                      os.environ["ASC_KEY_P8"], algorithm="ES256", headers={"kid": os.environ["ASC_KEY_ID"]})


S = requests.Session()


def call(method, path, body=None, params=None, ok=(200, 201, 204)):
    S.headers["Authorization"] = "Bearer " + token()
    r = S.request(method, API + path, json=body, params=params, timeout=60)
    if r.status_code not in ok:
        detail = ""
        try:
            detail = "; ".join(f"{e.get('title')}: {e.get('detail')}" for e in r.json().get("errors", []))
        except Exception:
            detail = r.text[:300]
        raise RuntimeError(f"{method} {path} -> {r.status_code} {detail}")
    return r.json() if r.content else {}


def get(path, **params):
    return call("GET", path, params=params or None)


def app_cfg(app):
    rel = json.loads((ROOT / "apps" / app / "RELEASE.json").read_text())
    lst_path = ROOT / "apps" / app / "store" / "listing.json"
    lst = json.loads(lst_path.read_text()) if lst_path.exists() else None
    return rel, lst


def attrs(d):
    return d.get("attributes", {})


def editable_version(app_id):
    vs = get(f"/v1/apps/{app_id}/appStoreVersions", **{"filter[platform]": "IOS", "limit": 10})["data"]
    live = [v for v in vs if attrs(v)["appStoreState"] in ("PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED",
                                                            "REJECTED", "METADATA_REJECTED", "INVALID_BINARY")]
    return (live[0] if live else None), vs


def editable_info(app_id):
    infos = get(f"/v1/apps/{app_id}/appInfos")["data"]
    for i in infos:
        if attrs(i).get("appStoreState") not in ("READY_FOR_SALE", "REPLACED_WITH_NEW_INFO"):
            return i, infos
    return infos[0], infos


def status(app):
    rel, lst = app_cfg(app)
    app_id = rel.get("ascAppId")
    a = get(f"/v1/apps/{app_id}")["data"]
    say(f"## {attrs(a)['name']} ({attrs(a)['bundleId']}, id {app_id})")
    info, _ = editable_info(app_id)
    say(f"- App info state: **{attrs(info).get('appStoreState') or attrs(info).get('state')}**, age rating {attrs(info).get('appStoreAgeRating')}")
    for loc in get(f"/v1/appInfos/{info['id']}/appInfoLocalizations")["data"]:
        la = attrs(loc)
        say(f"- Info [{la['locale']}]: name `{la.get('name')}`, subtitle `{la.get('subtitle')}`, privacy URL `{la.get('privacyPolicyUrl')}`")
    try:
        cat = get(f"/v1/appInfos/{info['id']}/primaryCategory")["data"]
        say(f"- Primary category: `{cat['id'] if cat else None}`")
    except Exception as e:
        say(f"- Primary category: unknown ({e})")
    ver, vs = editable_version(app_id)
    say(f"- Versions: " + ", ".join(f"{attrs(v)['versionString']} {attrs(v)['appStoreState']}" for v in vs) if vs else "- Versions: none")
    if ver:
        for loc in get(f"/v1/appStoreVersions/{ver['id']}/appStoreVersionLocalizations")["data"]:
            la = attrs(loc)
            say(f"- Version {attrs(ver)['versionString']} [{la['locale']}]: description {len(la.get('description') or '')} chars, "
                f"keywords {len(la.get('keywords') or '')} chars, promo {len(la.get('promotionalText') or '')} chars, "
                f"support `{la.get('supportUrl')}`, marketing `{la.get('marketingUrl')}`")
            sets = get(f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")["data"]
            say("  - Screenshot sets: " + (", ".join(f"{attrs(s)['screenshotDisplayType']}" for s in sets) or "none"))
        try:
            b = get(f"/v1/appStoreVersions/{ver['id']}/build")["data"]
            say(f"  - Build attached: {attrs(b)['version'] if b else 'none'}")
        except Exception as e:
            say(f"  - Build attached: unknown ({e})")
    builds = get("/v1/builds", **{"filter[app]": app_id, "sort": "-uploadedDate", "limit": 3})["data"]
    say("- Latest builds: " + (", ".join(f"{attrs(b)['version']} {attrs(b)['processingState']} {attrs(b)['uploadedDate'][:10]}" for b in builds) or "none"))
    iaps = get(f"/v1/apps/{app_id}/inAppPurchasesV2", limit=50)["data"]
    say("- In-app purchases: " + (", ".join(f"`{attrs(i)['productId']}` {attrs(i)['inAppPurchaseType']} {attrs(i)['state']}" for i in iaps) or "none"))
    try:
        ar = get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")["data"]
        filled = sum(1 for v in attrs(ar).values() if v not in (None, ""))
        say(f"- Age rating questions answered: {filled}/{len(attrs(ar))}")
    except Exception as e:
        say(f"- Age rating: unknown ({e})")
    try:
        av = get(f"/v1/apps/{app_id}/appAvailabilityV2")["data"]
        say(f"- Availability set: yes (new territories auto: {attrs(av).get('availableInNewTerritories')})")
    except Exception as e:
        say(f"- Availability: not set or unreadable ({str(e)[:120]})")
    try:
        ps = get(f"/v1/apps/{app_id}/appPriceSchedule")["data"]
        say(f"- Price schedule: set ({ps['id']})")
    except Exception as e:
        say(f"- Price schedule: not set ({str(e)[:120]})")
    say(f"- Listing file apps/{app}/store/listing.json: {'present' if lst else 'missing'}")


def upsert_info_loc(info_id, locale, fields):
    locs = get(f"/v1/appInfos/{info_id}/appInfoLocalizations")["data"]
    cur = next((l for l in locs if attrs(l)["locale"] == locale), None)
    if cur:
        call("PATCH", f"/v1/appInfoLocalizations/{cur['id']}",
             {"data": {"type": "appInfoLocalizations", "id": cur["id"], "attributes": fields}})
    else:
        call("POST", "/v1/appInfoLocalizations", {"data": {"type": "appInfoLocalizations", "attributes": {"locale": locale, **fields},
             "relationships": {"appInfo": {"data": {"type": "appInfos", "id": info_id}}}}})


def upsert_ver_loc(ver_id, locale, fields):
    locs = get(f"/v1/appStoreVersions/{ver_id}/appStoreVersionLocalizations")["data"]
    cur = next((l for l in locs if attrs(l)["locale"] == locale), None)
    if cur:
        call("PATCH", f"/v1/appStoreVersionLocalizations/{cur['id']}",
             {"data": {"type": "appStoreVersionLocalizations", "id": cur["id"], "attributes": fields}})
    else:
        call("POST", "/v1/appStoreVersionLocalizations", {"data": {"type": "appStoreVersionLocalizations",
             "attributes": {"locale": locale, **fields},
             "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver_id}}}}})


def step(name, fn):
    try:
        fn()
        say(f"- {name}: done")
    except Exception as e:
        say(f"- {name}: **failed** ({str(e)[:400]})")


def apply(app):
    rel, lst = app_cfg(app)
    if not lst:
        say(f"No apps/{app}/store/listing.json; nothing to apply.")
        return
    app_id = rel["ascAppId"]
    locale = lst.get("locale", "en-AU")
    info, _ = editable_info(app_id)
    say(f"## Applying apps/{app}/store/listing.json (locale {locale})")
    info_fields = {k: v for k, v in {"name": lst.get("name"), "subtitle": lst.get("subtitle"),
                                     "privacyPolicyUrl": lst.get("privacyPolicyUrl")}.items() if v}
    step("Name, subtitle, privacy URL", lambda: upsert_info_loc(info["id"], locale, info_fields))
    if lst.get("primaryCategory"):
        def cat():
            rels = {"primaryCategory": {"data": {"type": "appCategories", "id": lst["primaryCategory"]}}}
            if lst.get("secondaryCategory"):
                rels["secondaryCategory"] = {"data": {"type": "appCategories", "id": lst["secondaryCategory"]}}
            call("PATCH", f"/v1/appInfos/{info['id']}", {"data": {"type": "appInfos", "id": info["id"], "relationships": rels}})
        step("Categories", cat)
    if lst.get("ageRating"):
        def age():
            ar = get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")["data"]
            call("PATCH", f"/v1/ageRatingDeclarations/{ar['id']}",
                 {"data": {"type": "ageRatingDeclarations", "id": ar["id"], "attributes": lst["ageRating"]}})
        step("Age rating answers", age)
    ver, _ = editable_version(app_id)
    if not ver:
        def mk():
            call("POST", "/v1/appStoreVersions", {"data": {"type": "appStoreVersions",
                 "attributes": {"platform": "IOS", "versionString": lst.get("version", "1.0")},
                 "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})
        step("Create version " + lst.get("version", "1.0"), mk)
        ver, _ = editable_version(app_id)
    if ver:
        vf = {k: v for k, v in {"description": lst.get("description"), "keywords": lst.get("keywords"),
                                "promotionalText": lst.get("promotionalText"), "supportUrl": lst.get("supportUrl"),
                                "marketingUrl": lst.get("marketingUrl")}.items() if v}
        if lst.get("whatsNew") and attrs(ver)["versionString"] not in ("1.0", "1.0.0"):
            vf["whatsNew"] = lst["whatsNew"]
        step("Description, keywords, promo text, URLs", lambda: upsert_ver_loc(ver["id"], locale, vf))
        if lst.get("copyright"):
            step("Copyright", lambda: call("PATCH", f"/v1/appStoreVersions/{ver['id']}",
                 {"data": {"type": "appStoreVersions", "id": ver["id"], "attributes": {"copyright": lst["copyright"]}}}))
    for iap in lst.get("inAppPurchases", []):
        step(f"In-app purchase {iap['productId']}", lambda iap=iap: ensure_iap(app_id, iap, locale))


def ensure_iap(app_id, iap, locale):
    iaps = get(f"/v1/apps/{app_id}/inAppPurchasesV2", limit=50)["data"]
    cur = next((i for i in iaps if attrs(i)["productId"] == iap["productId"]), None)
    if not cur:
        cur = call("POST", "/v2/inAppPurchases", {"data": {"type": "inAppPurchases", "attributes": {
            "name": iap["referenceName"], "productId": iap["productId"], "inAppPurchaseType": iap["type"],
            "reviewNote": iap.get("reviewNote", ""), "familySharable": iap.get("familySharable", False)},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]
        say(f"  - created {iap['productId']}")
    locs = get(f"/v2/inAppPurchases/{cur['id']}/inAppPurchaseLocalizations")["data"]
    if not any(attrs(l)["locale"] == locale for l in locs):
        call("POST", "/v1/inAppPurchaseLocalizations", {"data": {"type": "inAppPurchaseLocalizations",
             "attributes": {"locale": locale, "name": iap["displayName"], "description": iap["description"]},
             "relationships": {"inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": cur["id"]}}}}})
        say("  - added display name and description")
    # price: find the base territory price point matching the customer price
    try:
        get(f"/v2/inAppPurchases/{cur['id']}/iapPriceSchedule")
        has_price = True
    except Exception:
        has_price = False
    if not has_price and iap.get("price"):
        terr, amount = iap["price"]["territory"], str(iap["price"]["amount"])
        pts = get(f"/v2/inAppPurchases/{cur['id']}/pricePoints", **{"filter[territory]": terr, "limit": 200})
        match = None
        while True:
            match = next((p for p in pts["data"] if attrs(p)["customerPrice"] in (amount, amount + "0", f"{float(amount):.2f}")), None)
            nxt = pts.get("links", {}).get("next")
            if match or not nxt:
                break
            S.headers["Authorization"] = "Bearer " + token()
            pts = S.get(nxt, timeout=60).json()
        if not match:
            raise RuntimeError(f"no {terr} price point for {amount}")
        call("POST", "/v1/inAppPurchasePriceSchedules", {"data": {"type": "inAppPurchasePriceSchedules",
             "relationships": {"inAppPurchase": {"data": {"type": "inAppPurchases", "id": cur["id"]}},
                               "baseTerritory": {"data": {"type": "territories", "id": terr}},
                               "manualPrices": {"data": [{"type": "inAppPurchasePrices", "id": "${p1}"}]}}},
             "included": [{"type": "inAppPurchasePrices", "id": "${p1}", "attributes": {"startDate": None},
                           "relationships": {"inAppPurchasePricePoint": {"data": {"type": "inAppPurchasePricePoints", "id": match["id"]}}}}]})
        say(f"  - price set: {terr} {amount}")


if __name__ == "__main__":
    mode, app = sys.argv[1], sys.argv[2]
    say(f"# App Store Connect {mode}: {app} ({time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())})")
    try:
        (status if mode == "status" else apply)(app)
        if mode == "apply":
            say("")
            status(app)
    except Exception as e:
        say(f"**Stopped:** {e}")
    pathlib.Path(os.environ.get("REPORT", "asc-report.md")).write_text("\n".join(out))
