// `plus` namespace, de. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const de: NonNullable<LocaleMessages['plus']> = {
  lock: {
    subjectIntro: '{subject} gehört zu Glaze Plus.',
    price: 'Einmalig {price}. Niemals ein Abo.',
    included: 'Enthalten',
    widgets: 'Zusätzliche Widget-Stile',
    symbols: 'Ausgewählte Zeichensätze',
    loops: 'Theme-Clips für Live Photos',
    free: 'Immer kostenlos',
    freeIcons: 'Eigene Symbole, unbegrenzt',
    freeInstall: 'Geführte Kurzbefehle-Installation (und Sammel-Beta)',
    freeLive: 'Live-Photo-Maker mit deinem eigenen Video',
    notNow: 'Nicht jetzt',
    oneMoment: 'Einen Moment…',
    unlock: 'Freischalten (bald)',
    unlockHint: 'Glaze Plus ist noch nicht erhältlich',
    unavailable: 'Glaze Plus kommt mit der Store-Version.',
    failed: 'Der Kauf ist nicht durchgegangen, es wurde nichts berechnet. Store-Code: {code}.',
    close: "Schließen",
    restore: "Käufe wiederherstellen",
    restoreHint: "Sucht nach einem früheren Kauf von Glaze Plus und schaltet ihn wieder frei",
    restored: "Glaze Plus wiederhergestellt. Danke!",
    restoreNone: "Kein früherer Kauf von Glaze Plus gefunden.",
    restoreFailed: "Wiederherstellen gerade nicht möglich. Versuche es später erneut.",
    themes: {
      one: '{count} weiteres Theme in {packs} Paketen',
      other: '{count} weitere Themes in {packs} Paketen',
    },
    freeThemes: {
      one: '{count} illustriertes Start-Theme und der Hintergrund-Editor',
      other: '{count} illustrierte Start-Themes und der Hintergrund-Editor',
    },
  },
  tipJar: {
    title: 'Trinkgeldglas',
    body: 'Gefällt dir Glaze? Gib ein freiwilliges Trinkgeld. Es schaltet nichts frei, es sagt nur Danke.',
    small: 'Kleines Trinkgeld',
    kind: 'Nettes Trinkgeld',
    generous: 'Großzügiges Trinkgeld',
    soon: 'Kommt mit der Store-Version.',
    a11y: 'Trinkgeldglas. Freiwilliges Trinkgeld zur Unterstützung von Glaze. Schaltet nichts frei. Kommt mit der Store-Version.',
  },
  packErrors: {
    network: 'Das Paket ist nicht erreichbar. Prüfe deine Verbindung und versuch es noch einmal.',
    integrity: 'Der Download war beschädigt und wurde verworfen. Versuch es noch einmal.',
    appVersion: 'Dieses Paket braucht eine neuere Glaze-Version.',
    cancelled: 'Download abgebrochen.',
    disabled: 'Themepakete kommen mit der Store-Version',
    generic: 'Mit diesem Paket ist etwas schiefgelaufen. Versuch es noch einmal.',
  },
};
