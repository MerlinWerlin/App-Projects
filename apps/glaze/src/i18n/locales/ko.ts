// Korean (ko). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: '확인',
    cancel: '취소',
    close: '닫기',
    done: '완료',
    save: '저장',
    delete: '삭제',
    retry: '다시 시도',
    loading: '불러오는 중…',
    back: '뒤로',
    next: '다음',
    continue: '계속',
    learnMore: '자세히 알아보기',
    share: '공유',
    edit: '편집',
    reset: '재설정',
    on: '켬',
    off: '끔',
    yes: '예',
    no: '아니요',
    later: '나중에',
    restartNow: '지금 다시 시작',
    showAll: '모두 보기',
    error: '문제가 발생했습니다',
    itemCount: { zero: '항목 없음', other: '항목 {count}개' },
  },
  tabs: { themes: '테마', icons: '아이콘', live: '라이브', pets: '펫', settings: '설정' },
  settings: {
    language: {
      title: '언어',
      row: '앱 언어',
      pickerHint: '언어 목록을 엽니다',
      note: '영어 이외의 언어는 기계 번역이며 원어민 검토를 기다리고 있습니다.',
      systemDefault: '시스템 기본값',
      systemDefaultHint: '휴대폰 설정을 따름({language})',
      pseudo: '의사 로케일(테스트)',
      sheetTitle: '언어 선택',
      hintLine: '언어: {language}',
      change: '변경',
      restartTitle: 'Glaze를 다시 시작할까요?',
      restartBody: '왼쪽에서 오른쪽, 오른쪽에서 왼쪽 레이아웃을 전환하려면 Glaze를 다시 시작해야 합니다.',
      restartManual: '레이아웃 방향 전환을 마치려면 Glaze를 닫았다가 다시 여세요.',
    },
  },
  install: { title: '아이콘 설치' },
  live: { editTitle: '루프 편집' },
  theme: { title: '테마' },
  wallpaper: { title: '배경화면' },
  tips: { title: '팁' },
  feedback: { title: '피드백 보내기' },
  addApp: { title: '앱이 없나요?' },
};

export const ko: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['ko']);
