// Japanese (ja). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'OK',
    cancel: 'キャンセル',
    close: '閉じる',
    done: '完了',
    save: '保存',
    delete: '削除',
    retry: '再試行',
    loading: '読み込み中…',
    back: '戻る',
    next: '次へ',
    continue: '続ける',
    learnMore: '詳しく見る',
    share: '共有',
    edit: '編集',
    reset: 'リセット',
    on: 'オン',
    off: 'オフ',
    yes: 'はい',
    no: 'いいえ',
    later: 'あとで',
    restartNow: '今すぐ再起動',
    error: '問題が発生しました',
    itemCount: { zero: '項目なし', other: '{count}件の項目' },
  },
  tabs: { themes: 'テーマ', icons: 'アイコン', live: 'ライブ', settings: '設定' },
  settings: {
    language: {
      title: '言語',
      row: 'アプリの言語',
      pickerHint: '言語の一覧を開きます',
      note: '英語以外の言語は機械翻訳で、ネイティブスピーカーによる確認待ちです。',
      systemDefault: 'システムのデフォルト',
      systemDefaultHint: 'スマートフォンの設定に従う（{language}）',
      pseudo: '疑似（テスト用）',
      sheetTitle: '言語を選択',
      restartTitle: 'Glazeを再起動しますか？',
      restartBody: '左から右と右から左のレイアウトを切り替えるには、Glazeを再起動する必要があります。',
      restartManual: 'レイアウトの向きの切り替えを完了するには、Glazeを閉じてもう一度開いてください。',
    },
  },
  install: { title: 'アイコンをインストール' },
  live: { editTitle: 'ループを編集' },
  theme: { title: 'テーマ' },
  wallpaper: { title: '壁紙' },
  tips: { title: 'ヒント' },
  feedback: { title: 'フィードバックを送信' },
  addApp: { title: 'アプリが見つかりませんか？' },
};

export const ja: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['ja']);
