# Perf audit, 30 Oct (T166)

The owner wants the app fast and smooth. This note covers the remaining parts of T166. The source guards are in `src/core/perfBudget.test.ts`.

## Icons tab: virtualised list

- `app/(tabs)/icons.tsx` used to draw everything inside one `Animated.ScrollView`, including up to 60 search-result rows. It is now one `Animated.FlatList` that uses `LIST_WINDOW`, `bounces={false}` and `overScrollMode="never"`, the same as the Themes tab.
  - **Rows:** the search results. They are drawn by `PickRow`, plus `NoMatchRow` and `MissingRow`. All three are memoised.
  - **Keys:** `resultKey` keeps them stable.
  - **Unchanged rows:** a row whose fields haven't changed keeps its object (`rowCache`), so toggling one app re-renders only that row.
  - **Header** (`ListHeaderComponent`): the large title, the tip, the Home Screen preview, the contrast warning, "Your apps" and the search field with its horizontal category chips.
  - **Footer** (`ListFooterComponent`): the "showing first 60" note, the custom-app form and the style controls.
- **Look:** the results card keeps the InsetGroup look. Each row draws its slice of the card with `GroupSegment`: a surface background, rounded first and last corners, and the hairline separator inset after the 30 pt tile.
- **"Your apps" chips:** these are now a memoised `AppChip` with stable handlers. They stay a wrapping chip grid in the header, because a list of them would change the layout.
- **No `getItemLayout`:** row height is not fixed. It changes with Dynamic Type and with the support badge.
- **Guard:** a test checks that `icons.tsx` scrolls a FlatList or SectionList with the shared window, and that rows are memoised. It also checks that any ScrollView left is horizontal and maps only the category chips. The old ScrollView allowlist for Icons is removed.

## Stacked-gradient audit (list cells)

| Cell | Before | After |
|---|---|---|
| Widget card (`src/ui/WidgetPreview.tsx`, Widgets tab grid, clear or tinted glass look) | Two full-size `Svg` views stacked: the theme-wallpaper gradient, then the background gradient or fill | **One** `Svg` (`BackdropLayer`) with both rects. The pixels are the same, with one native layer fewer per cell. |
| Catalogue widget card (`src/ui/CatalogueWidgetPreview.tsx`, same looks) | Same two stacked `Svg` views | Same fix (`BackdropLayer`) |
| Widget band and scrim regions (both previews) | Their own `Svg` when the fill is a gradient | Kept. They are part of the design, at their own size and position, and only a few specs use them. |
| Theme card / wallpaper tile (`ThemeWallpaper` → `src/render/WallpaperView.tsx`) | One `Svg`: one linear gradient plus radial blobs | Already flat |
| App icon (`src/render/IconCanvas.tsx`) | One `Svg` per icon. The gradient or glass background and an optional monogram plate are defs in the same canvas. | Already one view. Nothing stacked. |
| Home Screen mock (`src/ui/HomeMock.tsx`) | One gradient, and only when there is no wallpaper colour | Already flat |
| Icons tab rows | No gradients (an `IconCanvas` plus plain surfaces) | n/a |

No list cell uses `expo-linear-gradient`. The gradients in `LiveHeroCard`, `PhoneFrame`, `IntroGlaze` and `LivePhotoGuide` are single heroes or onboarding art, not in lists.
