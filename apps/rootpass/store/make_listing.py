"""Writes store/listing.json (applied to App Store Connect by scripts/asc/asc.py) and checks Apple's length limits."""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent

DESC = """Rootpass does the workshop maths for welders, boilermakers and metal fabricators, and shows its working every time.

SADDLE (FISHMOUTH) TEMPLATES
• Pipe-to-pipe copes for any branch angle from 10° to 90°, equal or unequal sizes, on centre or offset.
• Work the line on the inside or outside of the branch wall.
• Print a true-scale template to cut out and wrap round the pipe. Big pipes tile over several A4 or Letter sheets with trim lines.
• Every sheet carries a 100 mm calibration ruler so you can check the print scale with a tape.
• Ordinate table (8 to 24 lines) for marking out without a printer, plus the length of pipe to cut.

LOBSTER-BACK BENDS
• Cut angle, number of welds, and the long, short and centreline length of every piece.
• A drawing of the bend and a printable wrap template for the cut.

FRAMES AND MITRES
• Rectangular and polygon frames: mitre angle, long points and short points.
• The mitre for any corner angle.

CUT LIST
• Fits your parts into the fewest stock lengths, counting the blade kerf and end trim, and shows every offcut.

STEEL WEIGHT
• Plate, flat bar, round and square bar, CHS, SHS/RHS (with real corner radii) and angle.
• Mild steel, stainless 304 and 316, aluminium 6061 and 5083. Add a price per kg for a quick cost.

WELD METAL
• Fillet, single-V, double-V and square butt joints: weld metal and the wire or rods to buy for MIG, flux-cored, stick or TIG.

SHEET BENDING
• Bend allowance, bend deduction, outside setback and the flat blank for several bends.

BOLT CIRCLES
• PCD hole positions, hole-to-hole check distance, and a true-scale drilling template.

BUILT FOR THE WORKSHOP
• Big buttons and number fields you can use with gloves, in a dark, high-contrast design.
• Millimetres or inches (with 1/16 fractions). Type fractions like 3 1/2.
• Save jobs to come back to. They stay on your phone.

FREE, THEN ONE PAYMENT
Steel weight, frame mitres, sheet bending and bolt-circle coordinates are free. Start the optional free 7-day Trial from the Full Unlock screen to try everything; it only starts when you confirm it with Apple and never charges you. Full Unlock is a single payment, not a subscription: saddle and lobster-back templates, cut lists, weld metal, printable templates and saved jobs.

PRIVATE
No account, no ads, no tracking. Rootpass collects no data.

Results are worked from published formulas and checked against worked examples, but they are a guide for skilled tradespeople. Check measurements and fit-up before cutting, and follow the design code for pressure and structural work."""

REVIEW = """Purpose and audience: Rootpass is a calculator for welders and metal fabricators: pipe saddle (fishmouth) templates, lobster-back bends, frame mitres, cut lists, steel weight, weld metal, sheet bending and bolt circles.

Setup: No account or login. Open the app and tap any tool. Free tools: Steel weight, Frame mitres, Sheet bending and Bolt circle (coordinates). To see a printable template, start the free trial, open Saddle cut, scroll down and tap Print true-scale template (the iOS print sheet or share sheet opens with a PDF made on the device).

Purchases: Settings > Full Unlock (also the Unlock button on the Tools screen) has Unlock (one-time non-consumable com.jared797.rootpass.unlock), Start free 7-day trial (a separate free non-consumable named 7-day Trial, com.jared797.rootpass.trial7) and Restore purchase. The trial begins only after Apple confirms the free item, is measured from the original transaction date, and never charges automatically. After seven days Saddle cut, Lobster-back, Cut list, Weld metal, printable templates and saved jobs need Full Unlock. Please test both products.

Privacy: No data is collected. Inputs and saved jobs stay on the device. No ads, analytics, accounts or server. Nothing is downloaded or switched on remotely: the build contains no over-the-air update mechanism, so the reviewed build is the build users get.

Regional differences: none apart from localised store prices. Metric and imperial units are both built in. Regulated services and third-party content: not applicable."""

UNLOCK_NOTE = ("One-time non-consumable. Settings > Full Unlock > Unlock. Restore purchase is on the same screen. Unlocks Saddle cut, "
               "Lobster-back, Cut list, Weld metal, printable PDF templates and saved jobs. Steel weight, Frame mitres, Sheet bending and "
               "Bolt circle coordinates stay free. The separate free 7-day Trial item is user-started; nothing is charged automatically.")
TRIAL_NOTE = ("Free user-started non-consumable trial under guideline 3.1.1. Settings > Full Unlock > Start free 7-day trial opens the "
              "Apple confirmation. Seven days are measured from the original transaction date, including after Restore or reinstall. "
              "Afterwards the Full Unlock tools need the separate one-time purchase. There is no subscription or automatic charge.")

listing = {
    "locale": "en-AU",
    "version": "1.0.0", "releaseType": "AFTER_APPROVAL", "attachBuild": "latest",
    "name": "Rootpass: Weld & Fab Calcs",
    "subtitle": "Saddle templates, cut lists",
    "promotionalText": "Print a true-scale saddle template, tape it round the pipe and cut. Lobster-backs, cut lists, steel weight and weld metal too. One payment, no subscription.",
    "keywords": "welding,welder,fabrication,fishmouth,pipe,cope,mitre,lobster,boilermaker,steel,weight,PCD,bend",
    "description": DESC,
    "whatsNew": "Welcome to Rootpass: saddle templates at true scale, lobster-backs, cut lists, steel weight, weld metal, sheet bending and bolt circles.",
    "primaryCategory": "UTILITIES",
    "secondaryCategory": "PRODUCTIVITY",
    "copyright": "2026 Jared Bradley",
    "privacyPolicyUrl": "https://merlinwerlin.github.io/App-Projects/rootpass/privacy.html",
    "supportUrl": "https://merlinwerlin.github.io/App-Projects/rootpass/support.html",
    "marketingUrl": "https://merlinwerlin.github.io/App-Projects/rootpass/",
    "price": "free",
    "inAppPurchases": [
        {"productId": "com.jared797.rootpass.unlock", "type": "NON_CONSUMABLE", "referenceName": "Rootpass Full Unlock", "displayName": "Full Unlock",
         "description": "Saddles, lobster-backs, cut lists and more", "reviewNote": UNLOCK_NOTE,
         "price": {"territory": "AUS", "amount": "4.99"}, "availability": "all",
         "reviewScreenshot": "apps/rootpass/store/review/unlock.png", "replaceReviewScreenshot": True},
        {"productId": "com.jared797.rootpass.trial7", "type": "NON_CONSUMABLE", "referenceName": "7-day Trial", "displayName": "7-day Trial",
         "description": "Try everything for 7 days. No auto-charge.", "reviewNote": TRIAL_NOTE,
         "price": {"territory": "AUS", "amount": "0.00"}, "availability": "all",
         "reviewScreenshot": "apps/rootpass/store/review/unlock.png", "replaceReviewScreenshot": True},
    ],
    "ageRating": "none",
    "ageRatingExtra": {"socialMedia": False, "socialMediaAgeRestricted": False},
    "availability": "all",
    "contentRights": "DOES_NOT_USE_THIRD_PARTY_CONTENT",
    "reviewNotes": REVIEW,
    "reviewContactFromApp": "backspin",
    "screenshots": {"APP_IPHONE_67": "apps/rootpass/store/iphone"},
}

assert len(listing["name"]) <= 30 and len(listing["subtitle"]) <= 30
assert len(listing["keywords"]) <= 100, len(listing["keywords"])
assert len(listing["promotionalText"]) <= 170 and len(DESC) <= 4000 and len(REVIEW) <= 4000
for iap in listing["inAppPurchases"]:
    assert len(iap["displayName"]) <= 30 and len(iap["description"]) <= 45 and len(iap["reviewNote"]) <= 4000, iap["productId"]

(HERE / "listing.json").write_text(json.dumps(listing, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
print("listing.json written;", len(listing["keywords"]), "keyword chars,", len(DESC), "description chars")
