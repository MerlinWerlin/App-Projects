// Italian (it). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'OK',
    cancel: 'Annulla',
    close: 'Chiudi',
    done: 'Fine',
    save: 'Salva',
    delete: 'Elimina',
    retry: 'Riprova',
    loading: 'Caricamento…',
    back: 'Indietro',
    next: 'Avanti',
    continue: 'Continua',
    learnMore: 'Scopri di più',
    share: 'Condividi',
    edit: 'Modifica',
    reset: 'Ripristina',
    on: 'Attivo',
    off: 'Disattivo',
    yes: 'Sì',
    no: 'No',
    later: 'Più tardi',
    restartNow: 'Riavvia ora',
    error: 'Qualcosa è andato storto',
    itemCount: { zero: 'Nessun elemento', one: '{count} elemento', many: '{count} di elementi', other: '{count} elementi' },
  },
  tabs: { themes: 'Temi', icons: 'Icone', live: 'Live', settings: 'Impostazioni' },
  settings: {
    language: {
      title: 'Lingua',
      row: 'Lingua dell’app',
      pickerHint: 'Apre l’elenco delle lingue',
      note: 'Le lingue diverse dall’inglese sono traduzioni automatiche in attesa di revisione da parte di madrelingua.',
      systemDefault: 'Predefinita di sistema',
      systemDefaultHint: 'Segue il telefono ({language})',
      pseudo: 'Pseudo (test)',
      sheetTitle: 'Scegli la lingua',
      restartTitle: 'Riavviare Glaze?',
      restartBody: 'Glaze deve riavviarsi per passare dal layout da sinistra a destra a quello da destra a sinistra.',
      restartManual: 'Chiudi Glaze e riaprilo per completare il cambio di direzione del layout.',
    },
  },
  install: { title: 'Installa icone' },
  live: { editTitle: 'Modifica loop' },
  theme: { title: 'Tema' },
  wallpaper: { title: 'Sfondo' },
  tips: { title: 'Suggerimenti' },
  feedback: { title: 'Invia feedback' },
  addApp: { title: 'Manca un’app?' },
};

export const it: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['it']);
