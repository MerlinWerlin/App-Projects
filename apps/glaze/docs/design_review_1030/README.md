# Design review 30 Oct (owner-1030 B): brief for ChatGPT (Astra/Sol) and Codex

**Screenshots are not in this folder yet.** The cloud build can't install packages, so it can't render the app. The PC-side review room (Codex) captures them from the current TestFlight build or Expo Go web and saves them here as PNG, one per screen. Use the names below and portrait 1179 x 2556 (or any iPhone size). Capture in light mode, and add dark mode as `<name>-dark.png` if there's time:

| File | Screen |
|---|---|
| `01-themes.png` | Themes tab, top (title, category bubbles, showcase) |
| `02-themes-scrolled.png` | Themes tab scrolled to the art / pack sections |
| `03-theme-detail.png` | A theme's detail page (preview, Apply, pack card) |
| `04-icons.png` | Icons tab |
| `05-widgets.png` | Widgets tab (Small) |
| `06-wallpapers.png` | Wallpapers tab |
| `07-install.png` | Install screen (Shortcuts guided path) |
| `08-settings.png` | Settings |

## Prompt for the critique (paste with the screenshots)
> You are a senior iOS product designer. This is Glaze, a one-time-purchase app for matching icon themes, themed widgets and wallpaper packs (no subscription, no ads). The owner wants it to feel clean, calm and professional, load smoothly, and look at home on iOS 26 next to Apple's own apps. For each screenshot give: (1) the 3 changes with the biggest effect on looking professional, (2) hierarchy/spacing/typography problems, with the exact element named, (3) anything that looks cheap, busy or inconsistent with the other screens. Constraints: one type scale, 4-pt spacing grid, three corner radii (card 24, control 14, pill 999), one shadow style, large-title headers, pill buttons, no bounce or flashy motion. Don't suggest new features, subscriptions, ads or brand logos. End with a ranked top-10 list across all screens.

## After the critique
Put the answers (raw, or a summary with the agreed points) in `docs/DESIGN_CRITIQUE_1030.md`. The next Glaze build run turns the agreed points into backlog tasks (owner-1030 B, T164) and records which it adopted and why any were declined.
