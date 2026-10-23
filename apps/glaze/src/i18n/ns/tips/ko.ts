// `tips` namespace, ko. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const ko: NonNullable<LocaleMessages['tips']> = {
  intro: 'Glaze가 iOS에서 작동하는 방식에 대한 짧은 안내입니다. 팁은 설명하는 기능 옆에 나타나며, 필요 없는 팁은 숨기고 여기서 다시 불러올 수 있습니다.',
  showAll: '모든 팁 다시 보기',
  showAllDone: '모든 팁이 다시 표시됩니다',
  allShowing: '모든 팁이 이미 표시되고 있습니다',
  hidden: '숨김',
  showing: '표시 중',
  showAgain: '다시 보기',
  hide: '숨기기',
  toggleA11y: '{action}: {tip}',
  rowA11y: '{title}. {body} 표시 위치: {place}. {status}.',
  meta: '{place} · {status}',
  hiddenHint: {
    other: '숨긴 팁 {count}개가 다시 표시됩니다',
  },
  groups: {
    start: '시작하기',
    themes: '테마',
    wallpaper: '사진과 배경화면',
    icons: '아이콘, 모양, 개별 설정',
    install: '아이콘 설치',
    live: 'Live 잠금 화면',
  },
  places: {
    firstRun: '테마 탭',
    themes: '테마 미리보기',
    wallpaper: '배경화면 만들기',
    icons: '아이콘 탭',
    install: '아이콘 설치',
    live: 'Live Lock 탭',
    shapes: '아이콘 모양 설정',
    override: '아이콘 탭',
    addApp: '아이콘 탭',
  },
  items: {
    iconsAdded: {
      title: '아이콘은 교체가 아니라 추가됩니다',
      body: 'iOS에서는 어떤 앱도 다른 앱의 아이콘을 바꿀 수 없습니다. Glaze는 실제 앱을 여는 테마 단축어를 추가합니다. 원래 아이콘은 앱 보관함으로 옮기세요.',
    },
    bulkInstall: {
      title: '모든 아이콘을 한 번에 설치',
      body: 'Glaze는 세트 전체를 프로필 하나에 담아, 앱마다 단축어를 만들 필요 없이 설정에서 한 번만 설치하면 됩니다.',
    },
    liveLock: {
      title: '잠금 화면에 움직임을',
      body: 'Live Lock 탭에서 내 동영상이나 GIF를 잠금 화면에 반복 재생하세요.',
    },
    themePick: {
      title: '테마로 시작하기',
      body: '테마를 열면 배경화면과 아이콘을 함께 미리 볼 수 있습니다. 나중에 모양, 색상, 개별 아이콘도 바꿀 수 있습니다.',
    },
    photoBackground: {
      title: '내 사진 사용하기',
      body: 'Glaze는 배경화면을 직접 설정할 수 없습니다. 결과를 사진에 저장한 뒤 설정 › 배경화면에서 선택하세요.',
    },
    wallpaperSave: {
      title: '저장한 배경화면 적용하기',
      body: '설정 › 배경화면에서 새로운 배경화면 추가를 탭하고 사진에서 이미지를 고르세요. 이미 iPhone 크기에 맞춰져 있어 확대할 필요가 없습니다.',
    },
    iconShapes: {
      title: 'iPhone에서 모양이 보이는 방식',
      body: 'iOS는 추가된 아이콘을 자체 둥근 사각형 안에 표시합니다. 원과 물방울 모양은 그 사각형 안의 배경색 위에 놓입니다.',
    },
    iconOverride: {
      title: '아이콘 하나에 내 이미지 사용',
      body: '개별 설정은 이 테마에서(원하면 모든 테마에서) 앱 하나의 아이콘을 바꿉니다. 복원하면 테마 아이콘이 돌아오고 내 이미지는 남습니다.',
    },
    missingApp: {
      title: '목록에 앱이 없나요?',
      body: 'Glaze는 설치된 앱을 볼 수 없어 카탈로그를 사용합니다. 여기서나 다른 이미지 도구로 만든 이미지와 함께 앱을 직접 추가하세요.',
    },
    installNotVerified: {
      title: '“확인되지 않음”은 정상입니다',
      body: '프로필은 휴대폰에서 만들어지고 서명되지 않아 설정에 확인되지 않음으로 표시됩니다. 홈 화면 아이콘만 추가합니다.',
    },
    liveLoop: {
      title: '반복 재생이 실제로 움직이는 곳',
      body: 'iOS 26에서는 정식 Glaze 빌드가 잠금 화면에서 반복 재생합니다. 이전 iOS에서는 길게 누르면 Live Photo가 재생됩니다. Expo Go는 미리보기만 보여 줍니다.',
    },
  },
};
