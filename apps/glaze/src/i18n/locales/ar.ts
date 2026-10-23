// Arabic (ar). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'حسنًا',
    cancel: 'إلغاء',
    close: 'إغلاق',
    done: 'تم',
    save: 'حفظ',
    delete: 'حذف',
    retry: 'إعادة المحاولة',
    loading: 'جارٍ التحميل…',
    back: 'رجوع',
    next: 'التالي',
    continue: 'متابعة',
    learnMore: 'مزيد من المعلومات',
    share: 'مشاركة',
    edit: 'تعديل',
    reset: 'إعادة تعيين',
    on: 'تشغيل',
    off: 'إيقاف',
    yes: 'نعم',
    no: 'لا',
    later: 'لاحقًا',
    restartNow: 'إعادة التشغيل الآن',
    error: 'حدث خطأ ما',
    itemCount: { zero: 'لا توجد عناصر', one: 'عنصر واحد', two: 'عنصران', few: '{count} عناصر', many: '{count} عنصرًا', other: '{count} عنصر' },
  },
  tabs: { themes: 'السمات', icons: 'الأيقونات', live: 'القفل الحي', settings: 'الإعدادات' },
  settings: {
    language: {
      title: 'اللغة',
      row: 'لغة التطبيق',
      pickerHint: 'يفتح قائمة اللغات',
      note: 'اللغات غير الإنجليزية ترجمات آلية بانتظار مراجعة متحدثين أصليين.',
      systemDefault: 'لغة النظام',
      systemDefaultHint: 'يتبع هاتفك ({language})',
      pseudo: 'لغة تجريبية (اختبار)',
      sheetTitle: 'اختر اللغة',
      restartTitle: 'إعادة تشغيل Glaze؟',
      restartBody: 'يجب إعادة تشغيل Glaze للتبديل بين التخطيط من اليسار إلى اليمين ومن اليمين إلى اليسار.',
      restartManual: 'أغلق Glaze ثم افتحه مرة أخرى لإكمال تبديل اتجاه التخطيط.',
    },
  },
  install: { title: 'تثبيت الأيقونات' },
  live: { editTitle: 'تعديل الحلقة' },
  theme: { title: 'السمة' },
  wallpaper: { title: 'الخلفية' },
  tips: { title: 'نصائح' },
  feedback: { title: 'إرسال ملاحظات' },
  addApp: { title: 'هل ينقصك تطبيق؟' },
};

export const ar: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['ar']);
