// `tips` namespace, it. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const it: NonNullable<LocaleMessages['tips']> = {
  intro: 'Brevi note su come Glaze funziona con iOS. I suggerimenti compaiono accanto alla funzione che spiegano; nascondi quelli che non ti servono e recuperali qui.',
  showAll: 'Mostra di nuovo tutti i suggerimenti',
  showAllDone: 'Tutti i suggerimenti verranno mostrati di nuovo',
  allShowing: 'Tutti i suggerimenti sono già visibili',
  hidden: 'Nascosto',
  showing: 'Visibile',
  showAgain: 'Mostra di nuovo',
  hide: 'Nascondi',
  toggleA11y: '{action}: {tip}',
  rowA11y: '{title}. {body} Appare in {place}. {status}.',
  meta: '{place} · {status}',
  hiddenHint: {
    one: '{count} suggerimento nascosto verrà mostrato di nuovo',
    many: '{count} di suggerimenti nascosti verranno mostrati di nuovo',
    other: '{count} suggerimenti nascosti verranno mostrati di nuovo',
  },
  groups: {
    start: 'Per iniziare',
    themes: 'Temi',
    wallpaper: 'Foto e sfondi',
    icons: 'Icone, forme e personalizzazioni',
    install: 'Installare le icone',
    live: 'Live Photo',
  },
  places: {
    firstRun: 'Scheda Temi',
    themes: 'Anteprima tema',
    wallpaper: 'Creatore di sfondi',
    icons: 'Scheda Icone',
    install: 'Installa icone',
    live: 'Scheda Live',
    shapes: 'Impostazioni forma icona',
    override: 'Scheda Icone',
    addApp: 'Scheda Icone',
  },
  items: {
    iconsAdded: {
      title: 'Le icone si aggiungono, non si sostituiscono',
      body: 'iOS non permette a nessuna app di cambiare l’icona di un’altra. Glaze aggiunge un collegamento a tema che apre l’app vera; sposta le originali nella Libreria app.',
    },
    bulkInstall: {
      title: 'Installazione in blocco (beta facoltativa)',
      body: 'Beta facoltativa: un solo profilo installa tutto il set in una volta in Impostazioni. Il metodo guidato con Comandi Rapidi è quello predefinito e funziona sempre.',
    },
    liveLock: {
      title: 'Crea uno sfondo Live Photo',
      body: 'Trasforma un video in Live Photo nella scheda Live. Impostalo da Foto › Condividi › Usa come sfondo; si muove quando riattivi l’iPhone.',
    },
    themePick: {
      title: 'Parti da un tema',
      body: 'Apri un tema per vedere sfondo e icone insieme. Dopo puoi ancora cambiare forma, colori o una singola icona.',
    },
    photoBackground: {
      title: 'Usa una tua foto',
      body: 'Glaze non può impostare gli sfondi da solo. Salva il risultato in Foto, poi sceglilo in Impostazioni › Sfondo.',
    },
    wallpaperSave: {
      title: 'Applicare uno sfondo salvato',
      body: 'In Impostazioni › Sfondo, tocca Aggiungi nuovo sfondo e scegli l’immagine da Foto. Ha già la misura del tuo iPhone, quindi non serve lo zoom.',
    },
    iconShapes: {
      title: 'Come appaiono le forme su iPhone',
      body: 'iOS mostra le icone aggiunte dentro il suo quadrato arrotondato. Le forme cerchio e goccia stanno su un colore di sfondo dentro quel quadrato.',
    },
    iconOverride: {
      title: 'Usa una tua immagine per un’icona',
      body: 'Una personalizzazione cambia l’icona di un’app in questo tema, o in tutti se vuoi. Ripristina riporta l’icona del tema e conserva la tua immagine.',
    },
    missingApp: {
      title: 'L’app non è nell’elenco?',
      body: 'Glaze non vede quali app sono installate, quindi usa un catalogo. Aggiungi la tua app e un’immagine, creata qui o con qualsiasi strumento.',
    },
    installNotVerified: {
      title: '“Non verificato” è normale',
      body: 'Il profilo è creato sul tuo telefono e non è firmato, quindi Impostazioni mostra Non verificato. Aggiunge solo icone alla schermata Home.',
    },
    liveLoop: {
      title: 'Come si muovono le Live Photo',
      body: 'Uno sfondo Live Photo si muove quando riattivi o premi la schermata di blocco; non è un loop continuo. Expo Go mostra solo un’anteprima.',
    },
  },
};
