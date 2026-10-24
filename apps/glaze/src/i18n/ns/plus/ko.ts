// `plus` namespace, ko. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const ko: NonNullable<LocaleMessages['plus']> = {
  lock: {
    subjectIntro: '{subject}은(는) Glaze Plus에 포함됩니다.',
    price: '{price} 한 번만 결제. 구독은 절대 없습니다.',
    included: '포함 내용',
    widgets: '추가 위젯 스타일',
    symbols: '엄선한 기호 세트',
    loops: 'Live Photo용 테마 클립',
    free: '항상 무료',
    freeIcons: '나만의 아이콘 만들기, 무제한',
    freeInstall: '안내형 단축어 설치(일괄 설치는 베타)',
    freeLive: '내 동영상으로 만드는 Live Photo 메이커',
    notNow: '나중에',
    oneMoment: '잠시만요…',
    unlock: '잠금 해제(곧 제공)',
    unlockHint: 'Glaze Plus는 아직 판매하지 않습니다',
    unavailable: 'Glaze Plus는 스토어 출시와 함께 제공됩니다.',
    close: "닫기",
    restore: "구매 복원",
    restoreHint: "이전 Glaze Plus 구매를 확인하고 다시 잠금 해제합니다",
    restored: "Glaze Plus가 복원되었습니다. 감사합니다!",
    restoreNone: "이전 Glaze Plus 구매를 찾지 못했습니다.",
    restoreFailed: "지금은 복원할 수 없습니다. 나중에 다시 시도하세요.",
    themes: {
      other: '팩 {packs}개에 담긴 추가 테마 {count}개',
    },
    freeThemes: {
      other: '일러스트 스타터 테마 {count}개와 배경화면 만들기',
    },
  },
  tipJar: {
    title: '팁 상자',
    body: 'Glaze가 마음에 드세요? 선택 사항인 팁을 남겨 주세요. 잠금 해제되는 것은 없고, 감사 인사일 뿐입니다.',
    small: '작은 팁',
    kind: '따뜻한 팁',
    generous: '넉넉한 팁',
    soon: '스토어 출시와 함께 제공됩니다.',
    a11y: '팁 상자. Glaze를 응원하는 선택 사항 팁입니다. 잠금 해제되는 것은 없습니다. 스토어 출시와 함께 제공됩니다.',
  },
  packErrors: {
    network: '팩에 연결할 수 없습니다. 연결을 확인하고 다시 시도하세요.',
    integrity: '다운로드가 손상되어 삭제했습니다. 다시 시도하세요.',
    appVersion: '이 팩에는 최신 버전의 Glaze가 필요합니다.',
    cancelled: '다운로드가 취소되었습니다.',
    disabled: '테마 팩은 스토어 출시와 함께 제공됩니다',
    generic: '이 팩에 문제가 생겼습니다. 다시 시도하세요.',
  },
};
