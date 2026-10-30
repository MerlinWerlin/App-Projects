> **Reference only: replaced by GitHub Release hosting (`docs/PACK_HOSTING.md`). Nothing for Jared to do here.** Packs are published as release assets on `MerlinWerlin/App-Projects` (tag `glaze-packs-v1`) by a workflow using the built-in GitHub token, so no Cloudflare account, bucket or secrets are needed. The tier plan at the bottom ("Plan for the ~87 themes") still applies; read "R2" there as "the pack host".

# Theme hosting on Cloudflare R2: your steps (owner-1030 A5)

About 15 minutes, all doable on your phone in Safari. The free tier covers Glaze for a long time (10 GB stored and no charge for downloads). Cloudflare asks for a card to turn R2 on, but nothing is charged inside the free limits.

The build is already written: `scripts/packs/build_packs.mjs` turns every theme folder into a download pack, and `scripts/packs/publish_r2.mjs` uploads them. Both sit idle until the four values below exist.

## 1. Cloudflare account
1. In Safari, open **dash.cloudflare.com** and sign up with your email (or log in if you already have one).
2. Confirm the email Cloudflare sends.

## 2. Make the bucket
1. In the left menu (tap the ☰ icon), tap **R2 Object Storage**. If asked, tap **Purchase R2 Plan** / **Enable R2** and add a card (free tier, A$0).
2. Tap **Create bucket**. Name: `glaze-packs`. Location: **Automatic**. Tap **Create bucket**.

## 3. Turn on the public link
1. Open the `glaze-packs` bucket, tap **Settings**.
2. Under **Public access** → **R2.dev subdomain**, tap **Allow Access**, type `allow`, confirm.
3. Copy the **Public R2.dev Bucket URL** (looks like `https://pub-xxxxxxxx.r2.dev`). Paste it as a comment on the Glaze build page, or into the Workboard need. It isn't a secret, and the next build run puts it in the app.
   (Later you can attach your own domain under **Custom Domains**. The app only needs the new address.)

## 4. Make an upload key (for that bucket only)
1. Back on the **R2 Object Storage** overview, tap **Manage R2 API Tokens** (or **API** → **Manage API tokens**).
2. Tap **Create API token**. Name: `glaze-packs-upload`.
3. Permissions: **Object Read & Write**.
4. Specify bucket(s): **Apply to specific buckets only** → `glaze-packs`.
5. TTL: forever is fine. Tap **Create API Token**.
6. The next screen shows the values ONCE. Keep the page open for step 5:
   - **Access Key ID**
   - **Secret Access Key**
   - Your **Account ID** (also on the R2 overview page, right side)

## 5. Paste them as GitHub secrets (never anywhere else)
1. Open **github.com/MerlinWerlin/App-Projects** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add four secrets, one at a time:
   | Name | Value |
   |---|---|
   | `R2_ACCOUNT_ID` | Account ID |
   | `R2_ACCESS_KEY_ID` | Access Key ID |
   | `R2_SECRET_ACCESS_KEY` | Secret Access Key |
   | `R2_BUCKET` | `glaze-packs` |
3. Don't paste the key or secret into chats, comments or the Workboard.

## What happens next (no more steps for you)
- Auto-ship puts `scripts/packs/publish-packs.yml` in place as a manual GitHub workflow ("Publish Glaze packs"). The overseer runs it with dry-run first, then for real.
- The build run sets the r2.dev address as the app's pack address (`src/config/packs.ts`, staging first). The next TestFlight build then lists the hosted themes, and you tap **Download** on a theme to check it.

## Plan for the ~87 themes (owner-1030 A6)
Target: app download **under ~40 MB**. Today's bundle carries ~3.8 MB of app assets plus ~1.3 MB for the 3 bundled art themes (about 0.43 MB each as PNG).

| Tier | How many | Where | Why |
|---|---|---|---|
| Bundled free starters | 8–10 | inside the app (`themes/`) | Works offline on first launch, App Review sees real themes without a network |
| Free downloadable packs | ~35–40 | R2, free | Big free choice without a big app; each pack ~0.25–0.3 MB on a phone (WebP, one wallpaper size per phone) |
| Glaze Plus packs | ~40 | R2, Plus | The best and seasonal sets; the reason to buy Plus |

- Starters: pick across moods (cute, dark, nature, neon, calm, space) so the first screen looks varied. At ~0.3 MB each as WebP that's about 3 MB, well inside the budget.
- Tiers are set in `scripts/packs/tiers.json` (`{"plus": [ids]}`). Everything not listed there is free.
- The 261 widget designs ride along as widget hero art inside each theme pack. A separate widget-pack format comes later only if they don't fit one-per-theme.
- When the theme folders arrive, they go through `node scripts/import-theme-packs.mjs <folder>` (checks size, licence and names). Starters stay in `themes/`, and the rest are built with `npm run packs:build` and published.
