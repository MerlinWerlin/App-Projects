# Rowlight — plan

*Started 2026-10-24 by Claude at Jared's request ("crochet companion"; his partner is tester and marketer).
Working name Rowlight; Jared decides the final name, price and store submission.*

## Who it's for
- Two crowds (research 24 Oct, `docs/MARKET.md`): **TikTok/amigurumi beginners** (Gen Z and 25–44, mostly women,
  Etsy/Ribblr PDFs, r/CrochetHelp growing ~40%/yr) and **experienced makers** (Ravelry, PDF-loyal, hate lock-in
  and subscriptions). r/crochet ~2M members; crochet is the most-viewed craft on TikTok.
- They pay A$5–15 one-time for tools that respect them; they leave 1-star reviews for lost counts, paywalled
  backups and weekly subscriptions.

## Why it wins (positioning)
1. "The row counter that never loses your place" — autosave every tap, no account, offline, free backup.
2. "Bring any pattern" — PDF, screenshot or pasted text; you own your files (anti-Ribblr lock-in).
3. "Built for amigurumi" — stitch-count checker, ball/shape generator, increase-evenly, US⇄UK.
4. "Pay once" — free core is generous; Plus is one-time. No ads, no tracking, iOS **and** Android.

## Free core (never gated)
Unlimited projects; big counter with haptics, undo, keep-awake, read-aloud, left-hand mode; extra counters incl.
repeat counters that bump a parent; row reminders; pasted pattern → step mode linked to the counter, US⇄UK
display and stitch-count check; PDF/photo patterns with a reading ruler that follows the count; project timer
(timestamp maths, survives sleep); progress photos, notes, hook/yarn; tools (ball generator, increase evenly,
US⇄UK converter, gauge, yarn estimate, glossary, hook/weight/size charts); backup export/import; dark mode.

## Plus (one-time; owner sets price, A$9.99 placeholder)
Yarn stash; seller pricing calculator; then (backlog) stats/streaks, themes, PDF markup, size-only highlight,
widgets/Live Activity (dev build), iCloud/Drive sync (dev build).

## Rules
- Honest features: nothing claims to work until tested on a phone. Android in-app PDF is not there yet and the
  app says so (pdf.js renderer is backlog R12).
- No competitor names in code, copy or assets. Original art only.
- Expo Go compatible until the store build; StoreKit/Play Billing arrives in the dev/store build (`src/plus`).
