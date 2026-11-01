// `tips` namespace, zh-Hans. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const zhHans: NonNullable<LocaleMessages['tips']> = {
  intro: '关于 Glaze 如何配合 iOS 工作的简短说明。提示会出现在所说明的功能旁边；隐藏不需要的提示，并可在这里恢复。',
  showAll: '重新显示所有提示',
  showAllDone: '所有提示将重新显示',
  allShowing: '所有提示都已显示',
  hidden: '已隐藏',
  showing: '显示中',
  showAgain: '重新显示',
  hide: '隐藏',
  toggleA11y: '{action}：{tip}',
  rowA11y: '{title}。{body} 显示位置：{place}。{status}。',
  meta: '{place} · {status}',
  hiddenHint: {
    other: '{count} 条已隐藏的提示将重新显示',
  },
  groups: {
    start: '入门',
    themes: '主题',
    wallpaper: '照片和墙纸',
    icons: '图标、形状和单独设置',
    install: '安装图标',
    live: '实况照片',
  },
  places: {
    firstRun: '主题标签页',
    themes: '主题预览',
    wallpaper: '墙纸制作',
    icons: '图标标签页',
    install: '安装图标',
    live: '实况照片制作器',
    shapes: '图标形状设置',
    override: '图标标签页',
    addApp: '图标标签页',
  },
  items: {
    iconsAdded: {
      title: '图标是添加的，而不是替换',
      body: 'iOS 不允许任何应用更改其他应用的图标。Glaze 会添加一个带主题的快捷方式来打开真正的应用；把原图标移到 App 资源库即可。',
    },
    bulkInstall: {
      title: '一次全部安装',
      body: '一个描述文件通过 Safari 和“设置”一次添加整套图标。想逐个安装，引导式“快捷指令”方式随时可用。',
    },
    liveLock: {
      title: '制作实况照片',
      body: '在“壁纸”的实况照片制作器里把视频转换成实况照片。它在“照片”中会动；设为墙纸时，iPhone 常常让它保持静止。',
    },
    themePick: {
      title: '从主题开始',
      body: '打开主题即可同时预览墙纸和图标。之后仍可更改形状、颜色或任意单个图标。',
    },
    photoBackground: {
      title: '使用你自己的照片',
      body: 'Glaze 无法自行设置墙纸。请把结果存储到照片，然后在 设置 › 墙纸 中选择。',
    },
    wallpaperSave: {
      title: '应用已保存的墙纸',
      body: '在 设置 › 墙纸 中轻点“添加新墙纸”，从照片中选择图片。它已按你的 iPhone 尺寸制作，无需缩放。',
    },
    iconShapes: {
      title: '形状在 iPhone 上的样子',
      body: 'iOS 会把添加的图标放在它自己的圆角方形中。圆形和水滴形状会放在该方形内的背景色上。',
    },
    iconOverride: {
      title: '为单个图标使用你自己的图片',
      body: '单独设置会更改此主题（或你选择的所有主题）中某个应用的图标。“恢复”会恢复主题图标并保留你的图片。',
    },
    missingApp: {
      title: '列表里没有这个应用？',
      body: 'Glaze 无法查看已安装的应用，所以使用了一份目录。你可以添加自己的应用和图片，在这里或任何图片工具中制作都行。',
    },
    installNotVerified: {
      title: '显示“未验证”是正常的',
      body: '描述文件是在你的手机上生成的，没有签名，所以设置中显示“未验证”。它只会添加主屏幕图标。',
    },
    liveLoop: {
      title: '实况照片如何动起来',
      body: '实况照片在“照片”中按住时会动，并不会一直循环。设为墙纸时，iPhone 可能提示动态效果不可用。',
    },
  },
};
