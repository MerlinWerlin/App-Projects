// Hindi (hi). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'ठीक है',
    cancel: 'रद्द करें',
    close: 'बंद करें',
    done: 'हो गया',
    save: 'सहेजें',
    delete: 'हटाएँ',
    retry: 'फिर से कोशिश करें',
    loading: 'लोड हो रहा है…',
    back: 'वापस',
    next: 'आगे',
    continue: 'जारी रखें',
    learnMore: 'और जानें',
    share: 'शेयर करें',
    edit: 'संपादित करें',
    reset: 'रीसेट करें',
    on: 'चालू',
    off: 'बंद',
    yes: 'हाँ',
    no: 'नहीं',
    later: 'बाद में',
    restartNow: 'अभी रीस्टार्ट करें',
    showAll: 'सभी दिखाएँ',
    error: 'कुछ गलत हो गया',
    itemCount: { zero: 'कोई आइटम नहीं', one: '{count} आइटम', other: '{count} आइटम' },
  },
  tabs: { themes: 'थीम', icons: 'आइकन', live: 'लाइव', settings: 'सेटिंग्स' },
  settings: {
    language: {
      title: 'भाषा',
      row: 'ऐप की भाषा',
      pickerHint: 'भाषाओं की सूची खोलता है',
      note: 'अंग्रेज़ी के अलावा अन्य भाषाएँ मशीन अनुवाद हैं और मूल वक्ताओं की समीक्षा की प्रतीक्षा में हैं।',
      systemDefault: 'सिस्टम डिफ़ॉल्ट',
      systemDefaultHint: 'आपके फ़ोन के अनुसार ({language})',
      pseudo: 'छद्म (परीक्षण)',
      sheetTitle: 'भाषा चुनें',
      hintLine: 'भाषा: {language}',
      change: 'बदलें',
      restartTitle: 'Glaze को रीस्टार्ट करें?',
      restartBody: 'बाएँ से दाएँ और दाएँ से बाएँ लेआउट के बीच बदलने के लिए Glaze को रीस्टार्ट करना होगा।',
      restartManual: 'लेआउट की दिशा बदलना पूरा करने के लिए Glaze बंद करके फिर से खोलें।',
    },
  },
  install: { title: 'आइकन इंस्टॉल करें' },
  live: { editTitle: 'लूप संपादित करें' },
  theme: { title: 'थीम' },
  wallpaper: { title: 'वॉलपेपर' },
  tips: { title: 'सुझाव' },
  feedback: { title: 'फ़ीडबैक भेजें' },
  addApp: { title: 'कोई ऐप नहीं मिल रहा?' },
};

export const hi: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['hi']);
