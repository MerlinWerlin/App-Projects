// Owner 2026-11-14: the bundled how-to screen recordings (H.264, 590×1278, 30 fps, no audio,
// 1.7-2.1 MB each) and their poster frames. Shown by HowToClip in the icons walkthrough
// (app/icons-intro.tsx) and on the Wallpaper and Widgets steps of the Set it up flow (ThemeSetupFlow).
export type HowToClipSource = { video: number; poster: number };

export const HOW_TO_CLIPS = {
  wallpaper: { video: require('../../assets/video/glaze-howto-wallpaper.mp4'), poster: require('../../assets/video/glaze-howto-wallpaper-poster.jpg') },
  icons: { video: require('../../assets/video/glaze-howto-icons.mp4'), poster: require('../../assets/video/glaze-howto-icons-poster.jpg') },
  widgets: { video: require('../../assets/video/glaze-howto-widgets.mp4'), poster: require('../../assets/video/glaze-howto-widgets-poster.jpg') },
} satisfies Record<'wallpaper' | 'icons' | 'widgets', HowToClipSource>;
