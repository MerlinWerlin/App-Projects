// German (de). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'OK',
    cancel: 'Abbrechen',
    close: 'Schließen',
    done: 'Fertig',
    save: 'Sichern',
    delete: 'Löschen',
    retry: 'Erneut versuchen',
    loading: 'Wird geladen …',
    back: 'Zurück',
    next: 'Weiter',
    continue: 'Fortfahren',
    learnMore: 'Mehr erfahren',
    share: 'Teilen',
    edit: 'Bearbeiten',
    reset: 'Zurücksetzen',
    on: 'Ein',
    off: 'Aus',
    yes: 'Ja',
    no: 'Nein',
    later: 'Später',
    restartNow: 'Jetzt neu starten',
    showAll: 'Alle anzeigen',
    error: 'Etwas ist schiefgelaufen',
    itemCount: { zero: 'Keine Elemente', one: '{count} Element', other: '{count} Elemente' },
  },
  tabs: { themes: 'Themen', icons: 'Symbole', live: 'Live', settings: 'Einstellungen' },
  settings: {
    language: {
      title: 'Sprache',
      row: 'App-Sprache',
      pickerHint: 'Öffnet die Liste der Sprachen',
      note: 'Alle Sprachen außer Englisch sind maschinelle Übersetzungen, die noch von Muttersprachlern geprüft werden.',
      systemDefault: 'Systemstandard',
      systemDefaultHint: 'Folgt deinem Telefon ({language})',
      pseudo: 'Pseudo (Test)',
      sheetTitle: 'Sprache wählen',
      hintLine: 'Sprache: {language}',
      change: 'Ändern',
      restartTitle: 'Glaze neu starten?',
      restartBody: 'Glaze muss neu starten, um zwischen einem Layout von links nach rechts und von rechts nach links zu wechseln.',
      restartManual: 'Schließe Glaze und öffne es erneut, um den Wechsel der Layoutrichtung abzuschließen.',
    },
  },
  install: { title: 'Symbole installieren' },
  live: { editTitle: 'Schleife bearbeiten' },
  theme: { title: 'Thema' },
  wallpaper: { title: 'Hintergrundbild' },
  tips: { title: 'Tipps' },
  feedback: { title: 'Feedback senden' },
  addApp: { title: 'Fehlt eine App?' },
};

export const de: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['de']);
