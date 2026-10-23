# Shipping App Factory apps (approve on your phone, it uploads itself)

## Every release (after the one-time setup)
1. You get a pull request, for example **"Ship Linework 1.0 to TestFlight"**, saying what changed.
2. In the **GitHub app** on your phone: open it → **Merge pull request** → Confirm. That is your approval.
3. The `ship` workflow builds the app on Expo and uploads it to App Store Connect. About 20–40 minutes later
   Apple emails you and the build is in **TestFlight**.
4. Once an app is live, small changes come as **update** pull requests: merging one sends the change straight to
   phones (no App Store review).

Not merging = nothing ships. Close the pull request to say no.

## One-time setup (owner only; about 30 minutes, phone browser works, a computer is easier)
All five go into GitHub → MerlinWerlin/App-projects → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret name | Where to get it |
|---|---|
| `EXPO_TOKEN` | expo.dev → (your avatar) → **Account settings → Access tokens → Create token**. Copy it once. |
| `ASC_KEY_P8` | appstoreconnect.apple.com → **Users and Access → Integrations → App Store Connect API → Team Keys → +**. Name "GitHub ship", access **Admin** (needed so Expo can create signing certificates for new apps). Download the `.p8` file (only once!) and paste its whole text, including the BEGIN/END lines. |
| `ASC_KEY_ID` | The **Key ID** shown next to that key. |
| `ASC_ISSUER_ID` | The **Issuer ID** at the top of the same page. |
| `APPLE_TEAM_ID` | developer.apple.com → **Account → Membership details → Team ID** (10 characters). |

Also once, in App Store Connect (needed for selling anything, automation or not):
- **Business**: Paid Apps agreement signed, bank account and tax forms done (status "Active").
- Each app's **Apple ID number** (App Store Connect → the app → App Information → "Apple ID", digits only) goes into
  that app's `RELEASE.json` as `ascAppId` (Claude does this if you tell it the number).
- **Linework only:** Monetization → In-App Purchases → + → Non-Consumable, Product ID `com.jared797.linework.plus`, A$2.99.

Nobody but you ever sees these values: GitHub hides secrets from everyone, including Claude.

## What still needs you in App Store Connect
- The **first** "Submit for Review" of each app (listing text from the app's `docs/STORE.md`, screenshots, App Privacy).
- Answering Apple if review asks a question.

## Layout
- `apps/linework`, `apps/glaze`, `apps/couch`: each app as it runs on the owner's PC (SDK 57 package versions,
  linked Expo project ids).
- `apps/<app>/RELEASE.json`: `{"mode": "build" | "update", "note": "...", "ascAppId": "..."}`. A change to this file
  merged into `main` is the trigger.
- `.github/workflows/ship.yml`: the workflow. It can also be started by hand: Actions → ship → Run workflow.
