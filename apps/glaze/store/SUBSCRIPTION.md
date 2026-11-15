# Glaze Plus yearly subscription: App Store Connect setup (Glaze 1.0.41)

Owner decision, 15 Nov 2026: Glaze Plus becomes a yearly auto-renewable subscription at about A$2.99 a year, with no free trial ("the 10 free ones are the free trial"). Ten themes are free (`src/core/freeThemes.ts`), and every other theme needs Plus. The app sells exactly one product, below. The old one-time unlock `com.jared797.glaze.plus` is never sold; it is still honoured if a sandbox / TestFlight account owns it.

Create the product in **App Store Connect > Apps > Glaze > Monetization > Subscriptions**.

## 1. Subscription group

| Field | Value |
|---|---|
| Reference Name | `Glaze` |
| Group display name (Localization > English (Australia), English (U.S.), English (U.K.)) | `Glaze Plus` |
| App name display option | Use App Name |

## 2. The subscription

| Field | Value |
|---|---|
| Reference Name | `Glaze Plus Yearly` |
| Product ID | `com.jared797.glaze.yearly` (must match `YEARLY_SKU` in `src/core/plusStoreKit.ts`) |
| Subscription Duration | 1 Year |
| Subscription Prices | Base country **Australia**: **A$2.99** (Apple's tier nearest A$3). Click **Done** and keep Apple's suggested equivalents for every other country and region. |
| Introductory Offers | **None.** Do not add a free trial or a pay-up-front or pay-as-you-go offer. |
| Promotional Offers / Offer Codes / Win-back | None |
| Family Sharing | Off |
| Availability | All countries and regions where Glaze is sold |
| Tax Category | App Store software (the default) |

### Localization (subscription display name and description, 45 / 55 character limits)

| Locale | Display Name | Description |
|---|---|---|
| English (Australia, U.S., U.K.) | `Glaze Plus` | `Every theme, new themes and all widget art.` |
| German | `Glaze Plus` | `Alle Themes, neue Themes und alle Widget-Bilder.` |
| French | `Glaze Plus` | `Tous les thèmes, les nouveautés et tout l’art widget.` |
| Spanish (Spain, Mexico) | `Glaze Plus` | `Todos los temas, los nuevos y todo el arte de widgets.` |
| Italian | `Glaze Plus` | `Tutti i temi, i nuovi e tutta l’arte dei widget.` |
| Portuguese (Brazil) | `Glaze Plus` | `Todos os temas, os novos e toda a arte de widgets.` |
| Japanese | `Glaze Plus` | `すべてのテーマ、新しいテーマ、ウィジェットアート。` |
| Korean | `Glaze Plus` | `모든 테마, 새 테마, 모든 위젯 아트워크.` |
| Chinese (Simplified) | `Glaze Plus` | `所有主题、新主题和全部小组件插画。` |
| Arabic | `Glaze Plus` | `كل السمات والسمات الجديدة وكل فن الأدوات.` |
| Hindi | `Glaze Plus` | `हर थीम, नई थीम और सारी विजेट कलाकृति।` |

### Review Information (required before the first submission with the subscription)

| Field | Value |
|---|---|
| Screenshot | One iPhone screenshot of the paywall. Size 1290 × 2796 (6.7") or 1320 × 2868 (6.9"), PNG. Open Themes, scroll past the Free section, open any theme without the "Premium · Free" tag (e.g. Lavender Nocturne) and tap **Use this theme?**. The Glaze Plus sheet opens. Capture it with the price, the three benefits, Subscribe, Restore purchases, the renewal text and the Terms of Use / Privacy Policy links visible (scroll the sheet if needed). |
| Review Notes | `Glaze Plus is a yearly auto-renewable subscription (com.jared797.glaze.yearly, no free trial). 10 premium themes are free (the "Free" section first on the Themes tab, each marked "Premium · Free"). Any other theme: open it and tap "Use this theme?" to see the subscription sheet, with the price per year, what it includes, auto-renewal and cancel terms, Restore purchases, Terms of Use (Apple standard EULA) and Privacy Policy links. After subscribing, every theme unlocks and the Free section disappears. A theme already applied keeps working on the Home Screen if the subscription ends; only switching to or re-applying a premium theme needs it. No account or login.` |

## 3. The app's metadata in App Store Connect

- **App Information > License Agreement:** keep Apple's standard EULA. The in-app **Terms of Use** link opens `https://www.apple.com/legal/internet-services/itunes/dev/stdeula/`.
- **App description:** add this last paragraph so the description itself carries the terms (Guideline 3.1.2):
  > Glaze Plus: a yearly subscription (A$2.99 a year in Australia, or your local equivalent) that unlocks every theme, new themes as they're added and all widget artwork. Ten premium themes are free. Payment is charged to your Apple Account at confirmation. The subscription renews automatically unless cancelled at least 24 hours before the end of the current year, and you can manage or cancel it in Settings. Terms of Use: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/ · Privacy Policy: https://merlinwerlin.github.io/App-Projects/glaze/privacy.html
- **Privacy Policy URL:** unchanged (`https://merlinwerlin.github.io/App-Projects/glaze/privacy.html`). Apple handles payment, so App Privacy stays **Data Not Collected**.
- **Paid Applications Agreement:** must be **Active** (Business). Until it is, StoreKit returns no product: since 1.0.42 the sheet then shows no price, Subscribe stays disabled and the sheet says "Couldn't load the price · Try again" (the app never shows a hard-coded price).
- **Submit together:** the first app version that uses the subscription must be submitted with the subscription attached (App Store Connect asks for it on the version page under **In-App Purchases and Subscriptions**).

## Review notes

For App Review (App Store Connect > the version > App Review Information > Notes), alongside the subscription notes above:

- **Icon profile.** "Install all at once" uses a configuration profile that is generated on the iPhone itself. It holds only Home Screen web clips, one per app the person picked, and each web clip just opens that app (its URL scheme). It has no MDM, VPN, certificate, restriction or account payloads. Glaze does not sign it, so iOS shows it as "Not Verified" on the install screen; that is expected for an unsigned profile. It is handed to Safari from the iPhone itself (127.0.0.1), never sent over the internet, installed by the person in Settings, and removable at any time in Settings > General > VPN & Device Management. The Shortcuts app is offered as an alternative way to make the same icons, one by one, without any profile.
- **Theme packs.** Theme packs download from Glaze's Cloudflare storage (R2 behind Cloudflare's CDN). They are images and JSON only, never code: nothing downloaded is executed, and each file is checked against the SHA-256 in its pack manifest. Glaze has no over-the-air code updates; every change ships as a reviewed build.
- **No account.** There is no account, sign-in or login anywhere in the app.
- **Subscription.** Glaze Plus is the yearly auto-renewable subscription `com.jared797.glaze.yearly` (no free trial). 10 premium themes are free (the Free section, first on the Themes tab); every other theme needs Glaze Plus.

## 4. What the app does (for reference)

| | Code |
|---|---|
| Buy | `createSubscriptionPlusStore` (`src/plus/iapStore.ts`) buys `YEARLY_SKU` through the local StoreKit 2 module (`modules/glaze-store`). |
| Entitled | Plus is on while `com.jared797.glaze.yearly` is active (not revoked, `expirationDate` in the future) **or** the legacy `com.jared797.glaze.plus` is owned. StoreKit's answer always wins. Only when StoreKit can't be asked does a cached "subscribed" count, for 7 days after the last confirmed check (`resolveSubscribed`). |
| Renewals, expiry, refunds, Ask to Buy | `Transaction.updates` re-checks both products. |
| Restore | `AppStore.sync()`, then the same check (Settings > Glaze Plus > Restore purchases, and on the sheet). |
| Free set | `FREE_THEME_IDS` (`src/core/freeThemes.ts`); every other gallery theme has `plus: true`. |
| Gated | Use this theme, the wallpaper / icons / widgets steps for a premium theme not in use, downloading a premium pack, Add to Custom with a premium theme's artwork. |
| Not gated | Browsing and previewing every theme; a theme already applied (widgets, icons, wallpaper keep working after a lapse); the 10 free themes; your own photos in Custom 1-5; make-your-own icons; the Live Photo maker. |

## 5. Test in the sandbox / TestFlight

1. In TestFlight, purchases use the sandbox and nothing is charged. A sandbox yearly subscription renews every hour, up to 12 times a day, so expiry can be tested in a day.
2. Open a premium theme and tap **Use this theme?**. Subscribe, and the theme applies. Open Themes: the Free section is gone and the badges are gone.
3. Cancel in Settings > Apple Account > Subscriptions (sandbox). After the next renewal time, reopen Glaze: the Free section is back, and the applied theme still shows on the Home Screen. Choosing another premium theme opens the paywall.
4. Restore purchases on a second device signed into the same sandbox account unlocks Plus again.
