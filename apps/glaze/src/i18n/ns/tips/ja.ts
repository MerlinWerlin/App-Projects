// `tips` namespace, ja. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const ja: NonNullable<LocaleMessages['tips']> = {
  intro: 'Glaze と iOS の関係を説明する短いメモです。ヒントは説明する機能のそばに表示されます。不要なものは非表示にして、ここで戻せます。',
  showAll: 'すべてのヒントを再表示',
  showAllDone: 'すべてのヒントが再び表示されます',
  allShowing: 'すべてのヒントがすでに表示されています',
  hidden: '非表示',
  showing: '表示中',
  showAgain: '再表示',
  hide: '非表示にする',
  toggleA11y: '{action}：{tip}',
  rowA11y: '{title}。{body} 表示場所：{place}。{status}。',
  meta: '{place} · {status}',
  hiddenHint: {
    other: '非表示のヒント {count} 件が再び表示されます',
  },
  groups: {
    start: 'はじめに',
    themes: 'テーマ',
    wallpaper: '写真と壁紙',
    icons: 'アイコン、形、個別設定',
    install: 'アイコンのインストール',
    live: 'Live Photos',
  },
  places: {
    firstRun: 'テーマタブ',
    themes: 'テーマのプレビュー',
    wallpaper: '壁紙メーカー',
    icons: 'アイコンタブ',
    install: 'アイコンをインストール',
    live: 'Live タブ',
    shapes: 'アイコンの形の設定',
    override: 'アイコンタブ',
    addApp: 'アイコンタブ',
  },
  items: {
    iconsAdded: {
      title: 'アイコンは置き換えではなく追加です',
      body: 'iOS では、アプリが他のアプリのアイコンを変更できません。Glaze は本物のアプリを開くテーマ付きショートカットを追加します。元のアイコンは App ライブラリへ移しましょう。',
    },
    bulkInstall: {
      title: '一括インストール（任意のベータ）',
      body: '任意のベータ版：1 つのプロファイルでセット全体を設定から一度にインストールします。ガイド付きのショートカット方式が標準で、いつでも使えます。',
    },
    liveLock: {
      title: 'Live Photos を作る',
      body: 'Live タブでビデオを Live Photos に変換します。写真アプリでは動きますが、壁紙にすると iPhone では静止したままになることがよくあります。',
    },
    themePick: {
      title: 'テーマから始めよう',
      body: 'テーマを開くと壁紙とアイコンをまとめてプレビューできます。あとから形や色、個別のアイコンも変更できます。',
    },
    photoBackground: {
      title: '自分の写真を使う',
      body: 'Glaze は壁紙を直接設定できません。結果を写真に保存し、設定 › 壁紙 で選んでください。',
    },
    wallpaperSave: {
      title: '保存した壁紙を設定する',
      body: '設定 › 壁紙 で「新しい壁紙を追加」をタップし、写真から画像を選びます。iPhone に合ったサイズなので拡大は不要です。',
    },
    iconShapes: {
      title: 'iPhone での形の見え方',
      body: 'iOS は追加したアイコンを独自の角丸の四角の中に表示します。円やしずくの形は、その四角の中で背景色の上に置かれます。',
    },
    iconOverride: {
      title: '1 つのアイコンに自分の画像を使う',
      body: '個別設定は、このテーマ（または選べばすべてのテーマ）で 1 つのアプリのアイコンを変えます。「元に戻す」でテーマのアイコンに戻り、画像は残ります。',
    },
    missingApp: {
      title: 'リストにないアプリは？',
      body: 'Glaze はインストール済みのアプリを確認できないため、カタログを使っています。ここや任意の画像ツールで作った画像と一緒に、自分でアプリを追加できます。',
    },
    installNotVerified: {
      title: '「未検証」は想定どおりです',
      body: 'プロファイルはお使いのスマートフォンで作られ署名されていないため、設定に「未検証」と表示されます。ホーム画面にアイコンを追加するだけです。',
    },
    liveLoop: {
      title: 'Live Photos の動き方',
      body: 'Live Photos は写真アプリで押すと動きます。ずっとループするわけではありません。壁紙では「モーションは利用できません」と表示されることがあります。',
    },
  },
};
