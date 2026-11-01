// `tips` namespace, de. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const de: NonNullable<LocaleMessages['tips']> = {
  intro: 'Kurze Hinweise, wie Glaze mit iOS funktioniert. Tipps erscheinen neben der Funktion, die sie erklären; blende aus, was du nicht brauchst, und hol es hier zurück.',
  showAll: 'Alle Tipps wieder anzeigen',
  showAllDone: 'Alle Tipps werden wieder angezeigt',
  allShowing: 'Alle Tipps werden bereits angezeigt',
  hidden: 'Ausgeblendet',
  showing: 'Sichtbar',
  showAgain: 'Wieder anzeigen',
  hide: 'Ausblenden',
  toggleA11y: '{action}: {tip}',
  rowA11y: '{title}. {body} Erscheint in: {place}. {status}.',
  meta: '{place} · {status}',
  hiddenHint: {
    one: '{count} ausgeblendeter Tipp wird wieder angezeigt',
    other: '{count} ausgeblendete Tipps werden wieder angezeigt',
  },
  groups: {
    start: 'Erste Schritte',
    themes: 'Themes',
    wallpaper: 'Fotos und Hintergründe',
    icons: 'Symbole, Formen und Anpassungen',
    install: 'Symbole installieren',
    live: 'Live Photos',
  },
  places: {
    firstRun: 'Tab „Themes“',
    themes: 'Theme-Vorschau',
    wallpaper: 'Hintergrund-Editor',
    icons: 'Tab „Symbole“',
    install: 'Symbole installieren',
    live: 'Live-Photo-Editor',
    shapes: 'Einstellungen zur Symbolform',
    override: 'Tab „Symbole“',
    addApp: 'Tab „Symbole“',
  },
  items: {
    iconsAdded: {
      title: 'Symbole werden hinzugefügt, nicht ersetzt',
      body: 'iOS lässt keine App das Symbol einer anderen ändern. Glaze fügt einen gestalteten Kurzbefehl hinzu, der die echte App öffnet; verschiebe die Originale in die App-Mediathek.',
    },
    bulkInstall: {
      title: 'Alle auf einmal installieren',
      body: 'Ein Profil fügt dein ganzes Set auf einmal hinzu, über Safari und dann die Einstellungen. Lieber einzeln: Die geführte Kurzbefehle-Methode ist immer da.',
    },
    liveLock: {
      title: 'Live Photo erstellen',
      body: 'Mach im Live-Photo-Editor (unter „Hintergründe“) aus einem Video ein Live Photo. In Fotos bewegt es sich; als Hintergrund lässt das iPhone es oft unbewegt.',
    },
    themePick: {
      title: 'Starte mit einem Theme',
      body: 'Öffne ein Theme, um Hintergrund und Symbole zusammen zu sehen. Form, Farben oder einzelne Symbole kannst du danach noch ändern.',
    },
    photoBackground: {
      title: 'Eigenes Foto verwenden',
      body: 'Glaze kann Hintergründe nicht selbst festlegen. Sichere das Ergebnis in Fotos und wähle es dann unter Einstellungen › Hintergrundbild.',
    },
    wallpaperSave: {
      title: 'Gesicherten Hintergrund anwenden',
      body: 'Tippe unter Einstellungen › Hintergrundbild auf „Neues Hintergrundbild hinzufügen“ und wähle das Bild aus Fotos. Es hat schon die Größe deines iPhone, Zoomen ist nicht nötig.',
    },
    iconShapes: {
      title: 'So wirken Formen auf dem iPhone',
      body: 'iOS zeigt hinzugefügte Symbole in seinem eigenen abgerundeten Quadrat. Kreis- und Tropfenformen liegen auf einer Hintergrundfarbe in diesem Quadrat.',
    },
    iconOverride: {
      title: 'Eigenes Bild für ein Symbol',
      body: 'Eine Anpassung ändert das Symbol einer App in diesem Theme oder auf Wunsch in allen. „Wiederherstellen“ holt das Theme-Symbol zurück und behält dein Bild.',
    },
    missingApp: {
      title: 'App nicht in der Liste?',
      body: 'Glaze sieht nicht, welche Apps installiert sind, und nutzt daher einen Katalog. Füge deine eigene App mit Bild hinzu, hier oder in einem beliebigen Bildprogramm erstellt.',
    },
    installNotVerified: {
      title: '„Nicht überprüft“ ist normal',
      body: 'Das Profil wird auf deinem Telefon erstellt und ist nicht signiert, daher zeigen die Einstellungen „Nicht überprüft“. Es fügt nur Home-Bildschirm-Symbole hinzu.',
    },
    liveLoop: {
      title: 'So bewegen sich Live Photos',
      body: 'Ein Live Photo bewegt sich, wenn du es in Fotos drückst; es läuft nicht im Dauer-Loop. Als Hintergrund meldet das iPhone eventuell „Bewegung nicht verfügbar“.',
    },
  },
};
