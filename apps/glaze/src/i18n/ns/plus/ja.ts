// `plus` namespace, ja. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const ja: NonNullable<LocaleMessages['plus']> = {
  lock: {
    subjectIntro: '{subject}は Glaze Plus の一部です。',
    price: '{price} の買い切り。サブスクリプションは一切ありません。',
    included: '含まれるもの',
    widgets: '追加のウィジェットスタイル',
    symbols: '厳選されたシンボルセット',
    loops: 'Live Photos 用のテーマクリップ',
    free: 'ずっと無料',
    freeIcons: '自作アイコン、無制限',
    freeInstall: 'ガイド付きショートカットでのインストール（一括はベータ）',
    freeLive: '自分の動画で作る Live Photos メーカー',
    notNow: '今はしない',
    oneMoment: 'お待ちください…',
    unlock: 'ロック解除（近日公開）',
    unlockHint: 'Glaze Plus はまだ販売されていません',
    unavailable: 'Glaze Plus はストア版で提供されます。',
    failed: '購入は完了せず、料金は請求されていません。ストアコード: {code}。',
    close: "閉じる",
    restore: "購入を復元",
    restoreHint: "以前の Glaze Plus の購入を確認して、もう一度ロックを解除します",
    restored: "Glaze Plus を復元しました。ありがとうございます！",
    restoreNone: "以前の Glaze Plus の購入は見つかりませんでした。",
    restoreFailed: "今は復元できませんでした。あとでもう一度お試しください。",
    themes: {
      other: '{packs} つのパックに入った追加テーマ {count} 種',
    },
    freeThemes: {
      other: 'イラストのスターターテーマ {count} 種と壁紙メーカー',
    },
  },
  tipJar: {
    title: 'チップジャー',
    body: 'Glaze を楽しんでいますか？任意のチップをどうぞ。何もロック解除されません。感謝の気持ちです。',
    small: '小さなチップ',
    kind: 'やさしいチップ',
    generous: 'たっぷりチップ',
    soon: 'ストア版で提供予定です。',
    a11y: 'チップジャー。Glaze を応援する任意のチップです。何もロック解除されません。ストア版で提供予定です。',
  },
  packErrors: {
    network: 'パックに接続できませんでした。接続を確認してもう一度お試しください。',
    integrity: 'ダウンロードが破損していたため破棄しました。もう一度お試しください。',
    appVersion: 'このパックには新しいバージョンの Glaze が必要です。',
    cancelled: 'ダウンロードをキャンセルしました。',
    disabled: 'テーマパックはストア版で提供されます',
    generic: 'このパックで問題が発生しました。もう一度お試しください。',
  },
};
