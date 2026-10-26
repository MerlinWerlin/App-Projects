#!/usr/bin/env python3
"""App Store Connect helper for every App Factory app (runs in GitHub Actions with the repo's ASC secrets).

  python scripts/asc/asc.py status <app>   read-only report of what App Store Connect has for the app
  python scripts/asc/asc.py apply  <app>   push apps/<app>/store/listing.json (text, URLs, category,
                                            age rating, in-app purchase) - never submits for review

Writes a markdown report to $REPORT (default asc-report.md). Secrets: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8.
What the API cannot do (owner-only in App Store Connect): agreements/bank/tax, the App Privacy label,
pressing Submit for Review.
"""
import json
import time, os, sys, time, pathlib
import jwt, requests

API = "https://api.appstoreconnect.apple.com"
ROOT = pathlib.Path(__file__).resolve().parents[2]
out = []


def say(s=""):
    out.append(s)
    print(s)


def key_pem():
    """Accept the .p8 however it was pasted: real newlines, literal \\n, one long line, missing header, base64 of the file."""
    import base64, re
    raw = os.environ["ASC_KEY_P8"].strip().strip('"').replace("\\n", "\n")
    if "BEGIN" not in raw:
        try:
            dec = base64.b64decode(raw).decode()
            if "BEGIN" in dec:
                raw = dec
        except Exception:
            pass
    body = re.sub(r"-----(BEGIN|END)[^-]*-----", "", raw)
    body = re.sub(r"[^A-Za-z0-9+/=]", "", body)
    lines = "\n".join(body[i:i + 64] for i in range(0, len(body), 64))
    return f"-----BEGIN PRIVATE KEY-----\n{lines}\n-----END PRIVATE KEY-----\n"


KEY_KIND = os.environ.get("ASC_KEY_KIND", "team")


def _clean(v):
    import re
    return re.sub(r"[^A-Za-z0-9-]", "", v or "")


def KID():
    """The 10-character key id, from whichever of the two id secrets holds one (they have been seen swapped)."""
    import re
    for name in ("ASC_KEY_ID", "ASC_ISSUER_ID"):
        v = (os.environ.get(name) or "").strip()
        if re.fullmatch(r"[A-Z0-9]{10}", v):
            return v
    return _clean(os.environ["ASC_KEY_ID"]).upper()


def ISS():
    import re
    for name in ("ASC_ISSUER_ID", "ASC_KEY_ID"):
        v = (os.environ.get(name) or "").strip().lower()
        if re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", v):
            return v
    return _clean(os.environ["ASC_ISSUER_ID"]).lower()


def token():
    now = int(time.time())
    claims = {"iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"}
    if KEY_KIND == "team":
        claims["iss"] = ISS()
    else:
        claims["sub"] = "user"
    return jwt.encode(claims, key_pem(), algorithm="ES256", headers={"kid": KID(), "typ": "JWT"})


def diagnose():
    """Shapes only, never values."""
    import re
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    rk, ri = os.environ["ASC_KEY_ID"], os.environ["ASC_ISSUER_ID"]
    def shape(v):
        return (f"{len(v)} chars: " + ", ".join(n for n, f in (("upper", str.isupper), ("lower", str.islower), ("digits", str.isdigit),
                ("dashes", lambda c: c == "-"), ("spaces/newlines", str.isspace), ("other", lambda c: not (c.isalnum() or c in "- \n\r\t")))
                if any(f(c) for c in v)))
    say(f"- Key ID secret: {shape(rk)}; Issuer ID secret: {shape(ri)}")
    kid, iss = KID(), ISS()
    say(f"- Key ID: {len(kid)} chars, {'looks right' if re.fullmatch(r'[A-Z0-9]{10}', kid) else 'NOT the 10-character form'}")
    say(f"- Issuer ID: {'UUID form' if re.fullmatch(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', iss) else 'NOT a UUID'}")
    try:
        k = load_pem_private_key(key_pem().encode(), None)
        say(f"- .p8 key: loads, curve {k.curve.name}")
    except Exception as e:
        say(f"- .p8 key: does not load ({e})")


S = requests.Session()


def call(method, path, body=None, params=None, ok=(200, 201, 204)):
    # Apple's API sometimes times out; retry a few times (an upload/PATCH repeated is harmless here:
    # every step looks up current state first or sets absolute values).
    for attempt in range(4):
        S.headers["Authorization"] = "Bearer " + token()
        try:
            r = S.request(method, API + path, json=body, params=params, timeout=90)
        except requests.exceptions.RequestException:
            if attempt == 3:
                raise
            time.sleep(5 * (attempt + 1))
            continue
        if r.status_code in (401, 500, 502, 503, 504) and attempt < 3:
            time.sleep(5 * (attempt + 1))
            continue
        break
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
            d = get(f"/v1/appStoreVersions/{ver['id']}/appStoreReviewDetail")["data"]
            da = attrs(d) if d else {}
            say("  - App Review contact: " + ("complete" if da.get("contactEmail") and da.get("contactPhone") and da.get("contactLastName") else "missing name/phone/email (owner)") + (", notes set" if da.get("notes") else ""))
        except Exception:
            say("  - App Review contact: not set (owner: name, phone, email)")
        try:
            b = get(f"/v1/appStoreVersions/{ver['id']}/build")["data"]
            say(f"  - Build attached: {attrs(b)['version'] if b else 'none'}")
        except Exception as e:
            say(f"  - Build attached: unknown ({e})")
    builds = get("/v1/builds", **{"filter[app]": app_id, "sort": "-uploadedDate", "limit": 3})["data"]
    say("- Latest builds: " + (", ".join(f"{attrs(b)['version']} {attrs(b)['processingState']} {attrs(b)['uploadedDate'][:10]}" for b in builds) or "none"))
    if builds:
        try:
            detail = attrs(get(f"/v1/builds/{builds[0]['id']}/buildBetaDetail")["data"] or {})
            say(f"- Latest build internal TestFlight state: {detail.get('internalBuildState', 'unknown')}")
            groups = get(f"/v1/apps/{app_id}/betaGroups", limit=50)["data"]
            all_builds = sum(1 for g in groups if attrs(g).get("isInternalGroup") and attrs(g).get("hasAccessToAllBuilds"))
            say(f"- Internal TestFlight groups with automatic build access: {all_builds}")
        except RuntimeError as e:
            say(f"- Internal TestFlight access: unverified ({str(e)[:150]})")
    iaps = get(f"/v1/apps/{app_id}/inAppPurchasesV2", limit=50)["data"]
    say("- In-app purchases: " + (", ".join(f"`{attrs(i)['productId']}` {attrs(i)['inAppPurchaseType']} {attrs(i)['state']}" for i in iaps) or "none"))
    for iap in iaps:
        if attrs(iap).get("state") != "MISSING_METADATA":
            continue
        for label, endpoint in (("localizations", "inAppPurchaseLocalizations"),
                                ("review screenshot", "appStoreReviewScreenshot"),
                                ("price schedule", "iapPriceSchedule"),
                                ("territory availability", "inAppPurchaseAvailability")):
            try:
                data = get(f"/v2/inAppPurchases/{iap['id']}/{endpoint}").get("data")
                detail = f"{len(data)} present" if isinstance(data, list) else "present" if data else "missing"
                if endpoint == "appStoreReviewScreenshot" and data:
                    detail += "; delivery " + str((attrs(data).get("assetDeliveryState") or {}).get("state", "unknown"))
                say(f"  - {attrs(iap)['productId']} {label}: {detail}")
            except RuntimeError as e:
                say(f"  - {attrs(iap)['productId']} {label}: unavailable ({str(e)[:150]})")
    try:
        ar = get(f"/v1/appInfos/{info['id']}/ageRatingDeclaration")["data"]
        filled = sum(1 for v in attrs(ar).values() if v not in (None, ""))
        say(f"- Age rating questions answered: {filled}/{len(attrs(ar))}; unanswered: " + ", ".join(k for k, v in attrs(ar).items() if v is None))
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
    say(f"- Content rights: {attrs(a).get('contentRightsDeclaration')}")
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


BOOL_AGE = {"gambling", "unrestrictedWebAccess", "seventeenPlus", "lootBox", "messagingAndChat", "userGeneratedContent",
            "advertising", "ageAssurance", "healthOrWellnessTopics", "parentalControls", "socialMedia", "socialMediaAgeRestricted"}
AGE_SKIP = {"kidsAgeBand", "gracRatingClassificationNumber", "developerAgeRatingInfoUrl", "socialMedia", "socialMediaAgeRestricted"}


def step(name, fn):
    try:
        fn()
        say(f"- {name}: done")
    except Exception as e:
        say(f"- {name}: **failed** ({str(e)[:400]})")


CONTACT_FIELDS = ("contactFirstName", "contactLastName", "contactPhone", "contactEmail")


def review_contact(existing, source_app=None):
    """Preserve the target contact; optionally fill gaps from an explicitly named app on this team.

    Values stay between Apple API requests: never print or persist personal contact details in the repo/report.
    """
    contact = {k: existing[k] for k in CONTACT_FIELDS if existing.get(k)}
    if len(contact) == len(CONTACT_FIELDS) or not source_app:
        return contact
    source_rel, _ = app_cfg(source_app)
    versions = get(f"/v1/apps/{source_rel['ascAppId']}/appStoreVersions")["data"]
    for version in versions:
        try:
            source = attrs(get(f"/v1/appStoreVersions/{version['id']}/appStoreReviewDetail")["data"] or {})
        except RuntimeError:
            continue
        if all(source.get(k) for k in CONTACT_FIELDS):
            for k in CONTACT_FIELDS:
                contact.setdefault(k, source[k])
            say(f"  - missing review contact fields reused from {source_app} (values not logged)")
            break
    return contact


def ensure_iap_availability(iap_id):
    """Opt-in setup for an unconfigured product; preserve any existing territory selection."""
    try:
        current = get(f"/v2/inAppPurchases/{iap_id}/inAppPurchaseAvailability").get("data")
    except RuntimeError as e:
        if "-> 404" not in str(e):
            raise
        current = None
    if current:
        say("  - purchase availability already configured; preserved")
        return
    territories = get("/v1/territories", limit=200)
    if territories.get("links", {}).get("next"):
        raise RuntimeError("territory list needs pagination; no availability changes made")
    items = [{"type": "territories", "id": t["id"]} for t in territories["data"]]
    if not items:
        raise RuntimeError("Apple returned no territories; no availability changes made")
    call("POST", "/v1/inAppPurchaseAvailabilities", {"data": {
        "type": "inAppPurchaseAvailabilities", "attributes": {"availableInNewTerritories": True},
        "relationships": {"inAppPurchase": {"data": {"type": "inAppPurchases", "id": iap_id}},
                          "availableTerritories": {"data": items}}}})
    say(f"  - purchase availability created for {len(items)} territories")


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
            want = {}
            if lst["ageRating"] == "none":
                for k, v in attrs(ar).items():
                    if v is not None or k in AGE_SKIP or "Url" in k or "url" in k:
                        continue
                    if k.endswith("Override") or k.endswith("OverrideV2"):
                        want[k] = "NONE"
                    elif k in BOOL_AGE:
                        want[k] = False
                    else:
                        want[k] = "NONE"
            else:
                want = lst["ageRating"]
            want.update(lst.get("ageRatingExtra", {}))
            call("PATCH", f"/v1/ageRatingDeclarations/{ar['id']}",
                 {"data": {"type": "ageRatingDeclarations", "id": ar["id"], "attributes": want}})
        step("Age rating answers (all None/No)", age)
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
        if lst.get("attachBuild") == "latest":
            def attach():
                v = attrs(ver)["versionString"]
                bs = get("/v1/builds", **{"filter[app]": app_id, "filter[preReleaseVersion.version]": v,
                                          "filter[processingState]": "VALID", "sort": "-uploadedDate", "limit": 1})["data"]
                if not bs:
                    raise RuntimeError(f"no processed build for {v} yet")
                call("PATCH", f"/v1/appStoreVersions/{ver['id']}/relationships/build", {"data": {"type": "builds", "id": bs[0]["id"]}})
                say(f"  - build {attrs(bs[0])['version']} attached")
            step("Attach newest processed build", attach)
        if lst.get("reviewNotes"):
            def notes():
                try:
                    d = get(f"/v1/appStoreVersions/{ver['id']}/appStoreReviewDetail")["data"]
                except RuntimeError:
                    d = None
                contact = review_contact(attrs(d or {}), lst.get("reviewContactFromApp"))
                missing = [k for k in CONTACT_FIELDS if not contact.get(k)]
                if missing:
                    raise RuntimeError("App Review contact still needs: " + ", ".join(missing) + "; notes were not changed")
                body = {"notes": lst["reviewNotes"], "demoAccountRequired": False, **contact}
                if d:
                    call("PATCH", f"/v1/appStoreReviewDetails/{d['id']}", {"data": {"type": "appStoreReviewDetails", "id": d["id"], "attributes": body}})
                else:
                    call("POST", "/v1/appStoreReviewDetails", {"data": {"type": "appStoreReviewDetails", "attributes": body,
                         "relationships": {"appStoreVersion": {"data": {"type": "appStoreVersions", "id": ver["id"]}}}}})
            step("Notes for App Review", notes)
        for disp, folder in (lst.get("screenshots") or {}).items():
            step(f"Screenshots {disp}", lambda disp=disp, folder=folder: upload_shots(ver["id"], locale, disp, folder))
    if lst.get("contentRights"):
        step("Content rights", lambda: call("PATCH", f"/v1/apps/{app_id}", {"data": {"type": "apps", "id": app_id,
             "attributes": {"contentRightsDeclaration": lst["contentRights"]}}}))
    if lst.get("availability") == "all":
        step("Availability: all countries and regions", lambda: ensure_availability(app_id))
    for iap in lst.get("inAppPurchases", []):
        step(f"In-app purchase {iap['productId']}", lambda iap=iap: ensure_iap(app_id, iap, locale))
    if lst.get("primaryLocale"):
        step(f"Primary locale {lst['primaryLocale']}", lambda: call("PATCH", f"/v1/apps/{app_id}", {"data": {"type": "apps", "id": app_id,
             "attributes": {"primaryLocale": lst["primaryLocale"]}}}))
    # dropLocales: delete stray localizations (never the app's primary locale).
    for drop in lst.get("dropLocales", []):
        def dl(drop=drop):
            prim = attrs(get(f"/v1/apps/{app_id}")["data"]).get("primaryLocale")
            if drop == prim:
                raise RuntimeError(f"{drop} is the primary locale; not deleting")
            n = 0
            for l in get(f"/v1/appInfos/{info['id']}/appInfoLocalizations")["data"]:
                if attrs(l)["locale"] == drop:
                    call("DELETE", f"/v1/appInfoLocalizations/{l['id']}"); n += 1
            if ver:
                for l in get(f"/v1/appStoreVersions/{ver['id']}/appStoreVersionLocalizations")["data"]:
                    if attrs(l)["locale"] == drop:
                        call("DELETE", f"/v1/appStoreVersionLocalizations/{l['id']}"); n += 1
            say(f"  - primary locale {prim}; removed {n} {drop} localizations")
        step(f"Drop locale {drop}", dl)
    # alsoLocales: copy the same listing into other locales (e.g. an en-US primary locale left from app creation).
    for extra in lst.get("alsoLocales", []):
        say(f"### Also locale {extra}")
        xf = {**info_fields, **(lst.get("localeOverrides", {}).get(extra, {}))}
        step(f"[{extra}] Name, subtitle, privacy URL", lambda extra=extra, xf=xf: upsert_info_loc(info["id"], extra, xf))
        if ver:
            step(f"[{extra}] Description, keywords, promo text, URLs", lambda extra=extra: upsert_ver_loc(ver["id"], extra, vf))
            for disp, folder in (lst.get("screenshots") or {}).items():
                step(f"[{extra}] Screenshots {disp}", lambda disp=disp, folder=folder, extra=extra: upload_shots(ver["id"], extra, disp, folder))


def testflight(app):
    """Make the newest processed build installable for the team: an internal TestFlight group with access to
    all builds, containing every App Store Connect user on the team (internal testers only, no Beta Review)."""
    rel, _ = app_cfg(app)
    app_id = rel["ascAppId"]
    say(f"# TestFlight: {app}")
    groups = get(f"/v1/apps/{app_id}/betaGroups", limit=50)["data"]
    g = next((x for x in groups if attrs(x).get("isInternalGroup")), None)
    if g:
        say(f"- internal group: {attrs(g)['name']}")
    else:
        g = call("POST", "/v1/betaGroups", {"data": {"type": "betaGroups",
                 "attributes": {"name": "Team", "isInternalGroup": True, "hasAccessToAllBuilds": True},
                 "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]
        say("- internal group: created Team (access to all builds)")
    have = {(attrs(t).get("email") or "").lower() for t in get(f"/v1/betaGroups/{g['id']}/betaTesters", limit=200)["data"]}
    for u in get("/v1/users", limit=50)["data"]:
        email = attrs(u)["username"]
        tag = email.split("@")[0][:3] + "…"
        if email.lower() in have:
            say("- tester already in group: " + tag)
            continue
        try:
            call("POST", "/v1/betaTesters", {"data": {"type": "betaTesters",
                 "attributes": {"email": email, "firstName": attrs(u).get("firstName") or "", "lastName": attrs(u).get("lastName") or ""},
                 "relationships": {"betaGroups": {"data": [{"type": "betaGroups", "id": g["id"]}]}}}})
            say("- added internal tester " + tag)
        except RuntimeError as e:
            say(f"- add tester: **failed** ({str(e)[:300]})")
    for b in get("/v1/builds", **{"filter[app]": app_id, "sort": "-uploadedDate", "limit": 3})["data"]:
        a = attrs(b)
        say(f"- build {a['version']}: {a.get('processingState')}, expired {a.get('expired')}")


def upload_shots(ver_id, locale, disp, folder):
    import hashlib
    files = sorted((ROOT / folder).glob("*.jpg")) + sorted((ROOT / folder).glob("*.png"))
    if not files:
        raise RuntimeError(f"no images in {folder}")
    loc = next(l for l in get(f"/v1/appStoreVersions/{ver_id}/appStoreVersionLocalizations")["data"] if attrs(l)["locale"] == locale)
    sets = get(f"/v1/appStoreVersionLocalizations/{loc['id']}/appScreenshotSets")["data"]
    st = next((x for x in sets if attrs(x)["screenshotDisplayType"] == disp), None)
    if st:
        old = get(f"/v1/appScreenshotSets/{st['id']}/appScreenshots")["data"]
        if [attrs(o).get("fileName") for o in old] == [f.name for f in files] and all(
                (attrs(o).get("assetDeliveryState") or {}).get("state") == "COMPLETE" for o in old):
            say(f"  - {disp}: already uploaded ({len(old)})")
            return
        for o in old:
            call("DELETE", f"/v1/appScreenshots/{o['id']}")
    else:
        st = call("POST", "/v1/appScreenshotSets", {"data": {"type": "appScreenshotSets", "attributes": {"screenshotDisplayType": disp},
                  "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc["id"]}}}}})["data"]
    for f in files:
        data = f.read_bytes()
        shot = call("POST", "/v1/appScreenshots", {"data": {"type": "appScreenshots", "attributes": {"fileName": f.name, "fileSize": len(data)},
                    "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": st["id"]}}}}})["data"]
        for op in attrs(shot)["uploadOperations"]:
            hdr = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
            r = requests.request(op["method"], op["url"], headers=hdr, data=data[op["offset"]:op["offset"] + op["length"]], timeout=120)
            if r.status_code >= 300:
                raise RuntimeError(f"upload {f.name} -> {r.status_code}")
        call("PATCH", f"/v1/appScreenshots/{shot['id']}", {"data": {"type": "appScreenshots", "id": shot["id"],
             "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})
    say(f"  - {disp}: uploaded {len(files)}")


def ensure_availability(app_id):
    try:
        get(f"/v1/apps/{app_id}/appAvailabilityV2")
        say("  - already set")
        return
    except RuntimeError:
        pass
    terrs, nxt = [], f"{API}/v1/territories?limit=200"
    while nxt:
        S.headers["Authorization"] = "Bearer " + token()
        r = S.get(nxt, timeout=60).json()
        terrs += [t["id"] for t in r["data"]]
        nxt = r.get("links", {}).get("next")
    inc = [{"type": "territoryAvailabilities", "id": f"${{t{n}}}", "attributes": {"available": True},
            "relationships": {"territory": {"data": {"type": "territories", "id": t}}}} for n, t in enumerate(terrs)]
    call("POST", "/v2/appAvailabilities", {"data": {"type": "appAvailabilities", "attributes": {"availableInNewTerritories": True},
         "relationships": {"app": {"data": {"type": "apps", "id": app_id}},
                           "territoryAvailabilities": {"data": [{"type": "territoryAvailabilities", "id": x["id"]} for x in inc]}}},
         "included": inc})
    say(f"  - {len(terrs)} countries and regions")


def upload_asset(create_path, rel_name, rel_type, rel_id, path, typ):
    import hashlib
    data = path.read_bytes()
    obj = call("POST", create_path, {"data": {"type": typ, "attributes": {"fileName": path.name, "fileSize": len(data)},
               "relationships": {rel_name: {"data": {"type": rel_type, "id": rel_id}}}}})["data"]
    for op in attrs(obj)["uploadOperations"]:
        hdr = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
        r = requests.request(op["method"], op["url"], headers=hdr, data=data[op["offset"]:op["offset"] + op["length"]], timeout=120)
        if r.status_code >= 300:
            raise RuntimeError(f"upload {path.name} -> {r.status_code}")
    call("PATCH", f"{create_path}/{obj['id']}", {"data": {"type": typ, "id": obj["id"],
         "attributes": {"uploaded": True, "sourceFileChecksum": hashlib.md5(data).hexdigest()}}})


def ensure_iap(app_id, iap, locale):
    iaps = get(f"/v1/apps/{app_id}/inAppPurchasesV2", limit=50)["data"]
    cur = next((i for i in iaps if attrs(i)["productId"] == iap["productId"]), None)
    if not cur:
        cur = call("POST", "/v2/inAppPurchases", {"data": {"type": "inAppPurchases", "attributes": {
            "name": iap["referenceName"], "productId": iap["productId"], "inAppPurchaseType": iap["type"],
            "reviewNote": iap.get("reviewNote", ""), "familySharable": iap.get("familySharable", False)},
            "relationships": {"app": {"data": {"type": "apps", "id": app_id}}}}})["data"]
        say(f"  - created {iap['productId']}")
    if iap.get("availability") == "all":
        ensure_iap_availability(cur["id"])
    locs = get(f"/v2/inAppPurchases/{cur['id']}/inAppPurchaseLocalizations")["data"]
    if not any(attrs(l)["locale"] == locale for l in locs):
        call("POST", "/v1/inAppPurchaseLocalizations", {"data": {"type": "inAppPurchaseLocalizations",
             "attributes": {"locale": locale, "name": iap["displayName"], "description": iap["description"]},
             "relationships": {"inAppPurchaseV2": {"data": {"type": "inAppPurchases", "id": cur["id"]}}}}})
        say("  - added display name and description")
    if iap.get("reviewScreenshot"):
        try:
            have = get(f"/v2/inAppPurchases/{cur['id']}/appStoreReviewScreenshot")["data"]
        except RuntimeError:
            have = None
        if not have:
            upload_asset("/v1/inAppPurchaseAppStoreReviewScreenshots", "inAppPurchaseV2", "inAppPurchases", cur["id"],
                         ROOT / iap["reviewScreenshot"], "inAppPurchaseAppStoreReviewScreenshots")
            say("  - review screenshot uploaded")
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
            match = next((p for p in pts["data"] if abs(float(attrs(p)["customerPrice"]) - float(amount)) < 0.001), None)
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


def make_profile(app):
    """Create (or reuse) an App Store provisioning profile for the app's bundle id with the team's distribution
    certificate, and print it base64 so it can be uploaded to Expo credentials (new apps can't get one from a
    non-interactive EAS build). Profiles are not secret (public certificate + entitlements)."""
    e = json.loads((ROOT / "apps" / app / "app.json").read_text())["expo"]
    bid = e["ios"]["bundleIdentifier"]
    b = [x for x in get("/v1/bundleIds", **{"filter[identifier]": bid, "limit": 5})["data"] if attrs(x)["identifier"] == bid]
    if not b:
        raise RuntimeError(f"bundle id {bid} is not registered")
    name = f"{e.get('name', app)} App Store (CI)"
    have = [x for x in get("/v1/profiles", **{"filter[name]": name, "limit": 5})["data"] if attrs(x)["profileState"] == "ACTIVE"]
    if have:
        prof = have[0]
        say(f"- reusing profile `{name}`")
    else:
        certs = [c for c in get("/v1/certificates", limit=50)["data"]
                 if attrs(c)["certificateType"] in ("IOS_DISTRIBUTION", "DISTRIBUTION")]
        if not certs:
            raise RuntimeError("no distribution certificate on the team")
        certs.sort(key=lambda c: attrs(c).get("expirationDate") or "", reverse=True)
        prof = call("POST", "/v1/profiles", {"data": {"type": "profiles",
                    "attributes": {"name": name, "profileType": "IOS_APP_STORE"},
                    "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": b[0]["id"]}},
                                      "certificates": {"data": [{"type": "certificates", "id": certs[0]["id"]}]}}}})["data"]
        say(f"- created profile `{name}` with certificate serial {attrs(certs[0]).get('serialNumber')}")
    say(f"- bundle id {bid}, expires {attrs(prof).get('expirationDate')}")
    say("")
    say(f"<details><summary>{app}.mobileprovision (base64)</summary>\n\n```\n{attrs(prof)['profileContent']}\n```\n</details>")


if __name__ == "__main__":
    mode, app = sys.argv[1], sys.argv[2]
    say(f"# App Store Connect {mode}: {app} ({time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())})")
    try:
        try:
            get("/v1/apps", limit=1)
        except RuntimeError as e:
            if "401" not in str(e):
                raise
            KEY_KIND = "individual"
            try:
                get("/v1/apps", limit=1)
                say("- (signed in with an Individual API key)")
            except RuntimeError:
                say("**Apple rejected the API key (401) as both a Team and an Individual key.**")
                diagnose()
                raise
        if mode == "profile":
            make_profile(app)
        elif mode == "testflight":
            testflight(app)
        else:
            (status if mode == "status" else apply)(app)
        if mode == "apply":
            say("")
            status(app)
    except Exception as e:
        say(f"**Stopped:** {e}")
    pathlib.Path(os.environ.get("REPORT", "asc-report.md")).write_text("\n".join(out))
