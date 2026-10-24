// Simplified Chinese (zh-Hans). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: '好',
    cancel: '取消',
    close: '关闭',
    done: '完成',
    save: '保存',
    delete: '删除',
    retry: '重试',
    loading: '正在加载…',
    back: '返回',
    next: '下一步',
    continue: '继续',
    learnMore: '了解更多',
    share: '分享',
    edit: '编辑',
    reset: '重置',
    on: '开',
    off: '关',
    yes: '是',
    no: '否',
    later: '稍后',
    restartNow: '立即重启',
    error: '出了点问题',
    itemCount: { zero: '没有项目', other: '{count} 个项目' },
  },
  tabs: { themes: '主题', icons: '图标', live: '实况', settings: '设置' },
  settings: {
    language: {
      title: '语言',
      row: 'App 语言',
      pickerHint: '打开语言列表',
      note: '除英语外的其他语言均为机器翻译，正在等待母语人士审校。',
      systemDefault: '跟随系统',
      systemDefaultHint: '跟随手机设置（{language}）',
      pseudo: '伪语言（测试）',
      sheetTitle: '选择语言',
      restartTitle: '要重启 Glaze 吗？',
      restartBody: 'Glaze 需要重启才能在从左到右和从右到左的布局之间切换。',
      restartManual: '请关闭 Glaze 后重新打开，以完成布局方向的切换。',
    },
  },
  install: { title: '安装图标' },
  live: { editTitle: '编辑循环' },
  theme: { title: '主题' },
  wallpaper: { title: '墙纸' },
  tips: { title: '提示' },
  feedback: { title: '发送反馈' },
  addApp: { title: '缺少某个 App？' },
};

export const zhHans: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['zh-Hans']);
