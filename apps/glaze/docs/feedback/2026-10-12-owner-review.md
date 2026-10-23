# Owner review of the first trial version — 12 Oct 2026 (verbatim)

Received 12 Oct 2026, 19:55 Sydney, through a manual firing of the "Glaze build" scheduled task. Outranks every existing backlog task. Answered by docs/AUDIT_2026-10-12.md and milestone TRIAL2 in ops/backlog.json.

---

Glaze App — Comprehensive Improvement Prompt

We want to improve our existing app, Glaze. Glaze allows users to customise their iPhone home screen with themed app icons and create wallpapers, including wallpapers made from GIFs.

We have reviewed the first version of the app and identified several improvements. Before making changes, inspect the existing codebase and understand how the app currently works. Improve the existing app rather than rebuilding it from scratch.

IMPORTANT: Technical feasibility comes first. Do not assume something is possible simply because it sounds like a good idea. Check the existing implementation, iOS limitations, and the practical costs of each feature. If a feature cannot work as described, explain why and propose the closest workable alternative before implementing it.

1. Redesign the icon themes
The current themes are too basic and repetitive. Many look almost identical, with only the colour or pattern changed.
We want Glaze to feel like a creative, cutesy, artistic customisation app with themes that people would genuinely want to use on their phones.
Design direction: Create a much wider variety of genuinely different themes inspired by Pinterest-style aesthetics, including:
* Strawberry Shortcake and cute, nostalgic aesthetics.
* Floral, botanical and cottagecore designs.
* Space, stars and celestial aesthetics.
* Whimsical illustrations and playful artwork.
* Romantic, dreamy and decorative designs.
* Other distinctive, visually appealing themes that would suit a personalised iPhone home screen.
These are examples rather than an exhaustive list.
Every theme should have its own recognisable visual identity. Vary the actual illustrations, artwork, composition, colours and artistic style, rather than simply changing a colour or switching a pattern from straight to wavy.
The goal is genuinely different artwork, not cosmetic variations of the same design.
The app icons should feel like a cohesive collection within each theme.

2. Allow users to upload their own wallpaper background in every theme
This is a key requirement.
Users should be able to select a theme and use their own photograph as the background while retaining the themed app icons.
Required functionality:
* Allow users to select photographs from their iPhone photo library.
* Make the custom photograph option available within every theme.
* Allow users to crop, position and scale their photograph to fit the wallpaper.
* Provide a preview of the photograph alongside the selected theme.
* Preserve the existing pre-designed backgrounds for users who prefer them.
* Do not force users to use a gradient, colour or pattern when they want a photograph.
For example, someone might select a floral icon theme but use a photograph of their garden as the background. Another person might choose a space theme but use a photograph of their cat.
The background should be independently customisable without losing the selected theme's icon artwork.
Where appropriate, also allow users to customise the background using the theme's existing colours and design options.

3. Add icon shape selection and previews to the theme selection tab
We want users to be able to see and choose the shape of their app icons directly from the theme selection area.
Currently, the theme selection experience does not give users a sufficiently clear way to compare how different icon shapes will look.
Required functionality
* Add an icon shape selection option to the theme selection tab.
* Display visual previews of the available shapes rather than relying on text labels alone.
* Include suitable options such as: Circle. Square. Rounded square. Other shapes that are practical and supported by the existing implementation.
* Show the selected theme's artwork inside each shape so users can see how the artwork looks when cropped or masked differently.
* Allow users to preview the overall home screen appearance using their selected theme, background and icon shape.
* Make the currently selected shape obvious.
* Ensure the selection is easy to change without having to start customising the theme again.
Investigate how icon shapes are actually applied in the current implementation.
Do not assume Glaze can force arbitrary icon shapes on the real iPhone home screen. If iOS controls the final icon shape or applies its own masking, explain this limitation and implement the closest practical solution.
Where shape selection can affect the generated icon artwork, apply the selected shape to the exported or prepared icons as appropriate. Where it only affects the preview, clearly distinguish the preview from the actual installed result.

4. Add the ability to override existing app icons
Some existing icons do not look sufficiently decorative or do not fit the theme.
For example, a Clash Royale icon might look like a basic game icon rather than an artistic icon that matches the selected theme.
Users should be able to replace an existing themed icon with their own version.
Required functionality:
* Add an Override Icon option to the theme selection and customisation experience.
* Allow users to select an individual app and upload an image to replace its existing themed icon.
* Apply the replacement to that app within the selected theme without changing the other icons.
* Preserve the original icon so users can restore it if they change their minds.
* Retain the custom icon for future use rather than requiring users to upload it repeatedly.
* Keep customisations organised by app and theme.
For example, a user who likes a floral theme but dislikes its Clash Royale icon should be able to upload a more decorative Clash Royale icon without changing the rest of the theme.
This functionality must support overriding existing icons, not just adding missing ones.

5. Provide a practical solution for unsupported apps
We want users to theme as many of their apps as possible.
A home screen looks inconsistent when most apps have beautiful themed icons but a handful retain their original appearance.
However, there are hundreds of thousands of applications on the App Store. We cannot realistically create a bespoke icon for every app immediately.
We also do not want to introduce expensive AI generation APIs, paid image-processing services or unnecessary backend infrastructure.
Our agreed approach: Users should be able to create a missing icon using an external image-generation tool, such as ChatGPT, and then upload the resulting image into Glaze.
Glaze itself should not generate AI images or make paid AI API calls.
Suggested workflow
Step 1: Select the app. Provide a searchable list of apps to which users can assign custom icons. Investigate what iOS permits Glaze to discover about installed applications. Do not assume an ordinary iOS app can automatically scan every installed app or access a complete list of installed applications. If this is not permitted, implement a practical alternative, such as a curated searchable app list or a searchable list of supported apps.
Step 2: Create a matching icon externally. Provide a reusable prompt template that users can copy into ChatGPT or another image-generation tool. The instructions should explain that users can provide: A screenshot or image of the original app icon. An example image showing the desired Glaze theme. The external tool should create a new icon that represents the original app while matching the selected theme's aesthetic. The prompt should specify that the generated artwork must: Clearly represent the original application. Match the selected theme's colours, illustrations and artistic style. Be composed for an app icon rather than as a full wallpaper. Use a square canvas and the actual image dimensions and format required by Glaze. Keep important artwork away from edges where cropping or masking could remove it. Do not invent technical image specifications. Determine the requirements from the existing implementation.
Step 3: Upload the image into Glaze. Once the user has generated the image externally, they return to Glaze, select the relevant app and upload the image. The image should then be associated with the correct app and theme.
Step 4: Save the icon. Store the custom image locally where practical and retain the association between the image, app and theme. The image should remain available when the user returns to Glaze. Do not automatically apply the same custom icon across every theme unless the user explicitly chooses to do so.
Cost constraints: No paid AI image-generation APIs. No unnecessary server-side image generation. Prefer local image selection, cropping, storage and configuration. Do not introduce recurring infrastructure costs for ordinary icon customisation.
Investigate the existing installation workflow before implementing it. Do not promise that Glaze can directly replace native iOS app icons if the operating system does not allow it.

6. Build a comprehensive master app-icon collection
Create a structured, expandable collection of popular applications.
Prioritise commonly used apps across: Social media and messaging. Entertainment and streaming. Games. Productivity and education. Everyday utilities. Other popular categories.
Where practical, provide matching icons for supported apps across every theme.
The data structure should make it straightforward to manage app identifiers, theme identifiers, icon assets and user overrides.
Identify unsupported apps clearly and make the custom upload workflow easy to find.
Do not attempt to build icons for every app in existence in a single development pass. Establish a sensible foundation and prioritise coverage.

7. Improve the theme selection tab
The theme selection tab should be the central place for users to browse themes and customise their appearance.
Make it visual, intuitive and easy to use.
Users should be able to: Browse genuinely distinct themes using attractive previews. Select a theme and preview its overall appearance. Upload their own background photograph. Choose and preview icon shapes. Override existing app icons. Add icons for unsupported apps. See which icons are original theme assets and which have been customised. Restore the original theme artwork where needed. Understand how their selections will affect the final result.
Keep the workflow simple. Users should not have to navigate through confusing menus to perform basic customisations.
The preview should combine the selected background, theme and icon shapes where technically possible. Clearly communicate any differences between the preview and what iOS will actually display.

8. Bring back the tips feature
We want the option to bring tips back into Glaze.
Inspect the existing codebase to determine whether a tips feature already exists, whether it has been hidden or removed, and how it previously worked.
If the feature exists, restore it rather than creating a duplicate.
If it has been removed, rebuild a lightweight version that fits the existing design.
Requirements: Provide a clear way for users to access tips within the app. Make tips useful for understanding Glaze's features and completing customisations. Include practical guidance for selecting themes, using personal photographs, customising icon shapes, overriding icons and setting up wallpapers. Explain any iOS limitations or additional steps users need to complete. Keep the tips concise and easy to understand. Avoid overwhelming users with instructions they do not currently need.
Where appropriate, show contextual tips near relevant features and provide a way to revisit them later.
If tips can be dismissed, provide an accessible way to bring them back. Do not make dismissed tips permanently inaccessible.
Preserve any existing tip content or user preferences where possible.

9. Make animated lock screen wallpaper creation more prominent
Glaze already includes a feature for creating wallpapers from GIFs.
We want this feature to be easier to find and more prominent within the app.
Required improvements: Move the animated wallpaper feature closer to the forefront of the app. Make it easy to access from the main navigation or another prominent location. Retain the ability to select a GIF. Support the appropriate iPhone dimensions and output requirements. Allow users to save the resulting file to Photos. Clearly explain the steps needed to apply the wallpaper on an iPhone.
Inspect the current implementation before changing it.
We saw a wallpaper creation option and related functionality, but we need to establish what already works and what remains incomplete.
Do not assume iOS allows arbitrary GIFs to be installed as genuinely animated lock screen wallpapers through a normal app. Verify the supported workflow for the relevant iOS versions and implement the closest feasible solution.

10. Technical requirements and implementation priorities
A. Inspect before modifying: Before writing code, inspect the existing project structure, dependencies, UI components, theme data, icon assets and wallpaper implementation. Determine which features already work, which are incomplete and which need modification.
B. Respect iOS limitations: Investigate the real capabilities and limitations concerning: Discovering installed apps. Assigning and installing custom icons. Applying custom icon shapes. Accessing the photo library. Saving custom images. Creating and applying animated wallpapers. Restoring or overriding previously selected icons. Do not implement a feature that only appears to work in a preview but cannot work on a real device without explaining the difference.
C. Avoid unnecessary costs: Do not add paid AI APIs, AI image-generation services or unnecessary backend dependencies. Prefer local processing and storage for user-selected images and customisation data. Explain any proposed feature that would introduce recurring costs before implementing it.
D. Preserve existing functionality: Reuse working components wherever practical. Avoid rebuilding unrelated parts of the app. Keep the design consistent, polished and responsive. Ensure that theme selection, icon shape selection, personal backgrounds, icon overrides and wallpaper creation work together rather than behaving as disconnected features.
E. Test the complete experience: Test the full workflow, including: Selecting a theme. Selecting an icon shape. Uploading and positioning a personal photograph. Previewing the combined result. Overriding an existing icon. Uploading an icon for an unsupported app. Saving and restoring customisations. Accessing and restoring tips. Creating and saving a wallpaper. Handling missing images, unsupported files and other errors gracefully. Do not claim a feature has been tested on a real iPhone unless it actually has been.

11. Implementation order
1. Audit the existing app and report what currently works. 2. Confirm technical feasibility and identify iOS restrictions. 3. Redesign the theme collection with genuinely different artwork. 4. Add personal photograph backgrounds to every theme. 5. Add icon shape selection and previews to the theme selection tab. 6. Add individual icon overrides and custom uploads. 7. Establish the master app-icon collection and unsupported-app workflow. 8. Restore or rebuild the tips feature. 9. Make animated wallpaper creation more prominent and improve its workflow. 10. Test the features together and fix any regressions.
Adjust this order if architectural dependencies require it, but explain why.
Do not silently omit requirements. If something cannot be implemented as requested, explain the limitation and provide the closest workable alternative.

12. Final goal
We want Glaze to become a polished, creative iPhone customisation app rather than a collection of basic colour and pattern variations.
A user should be able to: 1. Discover genuinely distinctive, artistic themes. 2. Select a theme they love. 3. Upload their own photograph as the background while retaining the themed icons. 4. Select and preview different icon shapes. 5. Replace any existing themed icon they dislike. 6. Add matching icons for unsupported apps using externally generated images. 7. Retain their customisations without paying for AI generation within Glaze. 8. Access helpful tips and bring them back whenever needed. 9. Easily find and use the animated wallpaper creation feature.
The finished product should feel cohesive, creative and intuitive, with meaningful personalisation at every stage.
Start by auditing the existing codebase and reporting your findings. Confirm technical feasibility before making changes, then implement the improvements in stages. Do not invent unsupported iOS capabilities or waste time building features that cannot work as intended.

---

## Run instructions that came with the review (design guardrails)

- Themes must be genuinely different artwork (illustrated SVG motifs, frames, stickers, textures, compositions and type), not palette swaps. Aesthetic inspirations are fine (cute strawberry/dessert, cottagecore botanical, celestial, whimsical, romantic, etc.), but no licensed characters or brands: "strawberry shortcake" means the cute strawberry-dessert aesthetic, never the Strawberry Shortcake character or franchise.
- Icons stay original; brand logos never ship in Glaze, but the owner's own uploaded images per app are fine (stored locally, keyed by app + theme, with restore to the theme's artwork).
- No paid APIs, servers or recurring costs; Glaze never calls an AI image service.
- Facts to state plainly: an iOS app cannot list installed apps (curated searchable catalogue + manual "add an app" with name + URL scheme); web clips/Shortcuts ADD icons, never replace the real one; the shape is baked into the PNG but iOS draws its own rounded-square mask over web clip icons, so circle/blob shapes show as artwork inside that mask (preview shows this honestly, e.g. a "How it looks on iPhone" toggle); a normal app cannot set any wallpaper directly (save to Photos, set in Settings/Lock Screen); truly looping lock screens need the iOS 26 Now Playing animated-artwork path (T10, dev build only), otherwise a Live Photo plays only on long-press/wake.
- The external-AI prompt template uses the exact icon export size/format from the existing render/install code.
