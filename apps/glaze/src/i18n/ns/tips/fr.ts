// `tips` namespace, fr. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const fr: NonNullable<LocaleMessages['tips']> = {
  intro: 'De courtes notes sur le fonctionnement de Glaze avec iOS. Les astuces apparaissent près de la fonction qu’elles expliquent ; masquez celles dont vous n’avez pas besoin et retrouvez-les ici.',
  showAll: 'Réafficher toutes les astuces',
  showAllDone: 'Toutes les astuces s’afficheront de nouveau',
  allShowing: 'Toutes les astuces sont déjà affichées',
  hidden: 'Masquée',
  showing: 'Affichée',
  showAgain: 'Réafficher',
  hide: 'Masquer',
  toggleA11y: '{action} : {tip}',
  rowA11y: '{title}. {body} Apparaît dans {place}. {status}.',
  meta: '{place} · {status}',
  hiddenHint: {
    one: '{count} astuce masquée s’affichera de nouveau',
    many: '{count} d’astuces masquées s’afficheront de nouveau',
    other: '{count} astuces masquées s’afficheront de nouveau',
  },
  groups: {
    start: 'Premiers pas',
    themes: 'Thèmes',
    wallpaper: 'Photos et fonds d’écran',
    icons: 'Icônes, formes et remplacements',
    install: 'Installer les icônes',
    live: 'Live Photos',
  },
  places: {
    firstRun: 'Onglet Thèmes',
    themes: 'Aperçu du thème',
    wallpaper: 'Créateur de fonds d’écran',
    icons: 'Onglet Icônes',
    install: 'Installer les icônes',
    live: 'Créateur de Live Photos',
    shapes: 'Réglages de forme d’icône',
    override: 'Onglet Icônes',
    addApp: 'Onglet Icônes',
  },
  items: {
    iconsAdded: {
      title: 'Les icônes sont ajoutées, pas remplacées',
      body: 'iOS ne permet à aucune app de changer l’icône d’une autre. Glaze ajoute un raccourci à thème qui ouvre la vraie app ; rangez les originales dans la bibliothèque d’apps.',
    },
    bulkInstall: {
      title: 'Tout installer d’un coup',
      body: 'Un seul profil ajoute tout votre ensemble d’un coup, via Safari puis Réglages. Pour un par un, la méthode guidée avec Raccourcis est toujours là.',
    },
    liveLock: {
      title: 'Créer une Live Photo',
      body: 'Transformez une vidéo en Live Photo avec le Créateur de Live Photos, dans Fonds d’écran. Elle s’anime dans Photos ; en fond d’écran, l’iPhone la garde souvent fixe.',
    },
    themePick: {
      title: 'Partez d’un thème',
      body: 'Ouvrez un thème pour voir son fond d’écran et ses icônes ensemble. Vous pourrez ensuite changer la forme, les couleurs ou une seule icône.',
    },
    photoBackground: {
      title: 'Utilisez votre propre photo',
      body: 'Glaze ne peut pas définir le fond d’écran lui-même. Enregistrez le résultat dans Photos, puis choisissez-le dans Réglages › Fond d’écran.',
    },
    wallpaperSave: {
      title: 'Appliquer un fond d’écran enregistré',
      body: 'Dans Réglages › Fond d’écran, touchez Ajouter un fond d’écran et choisissez l’image dans Photos. Elle est déjà à la taille de votre iPhone, inutile de zoomer.',
    },
    iconShapes: {
      title: 'L’aspect des formes sur iPhone',
      body: 'iOS affiche les icônes ajoutées dans son propre carré arrondi. Les formes cercle et goutte reposent sur une couleur de fond dans ce carré.',
    },
    iconOverride: {
      title: 'Votre image pour une icône',
      body: 'Un remplacement change l’icône d’une app dans ce thème, ou dans tous si vous le souhaitez. Restaurer remet l’icône du thème et garde votre image.',
    },
    missingApp: {
      title: 'App absente de la liste ?',
      body: 'Glaze ne voit pas quelles apps sont installées, il utilise donc un catalogue. Ajoutez votre app et une image, créée ici ou dans n’importe quel outil.',
    },
    installNotVerified: {
      title: '« Non vérifié » est normal',
      body: 'Le profil est créé sur votre téléphone et n’est pas signé, donc Réglages indique Non vérifié. Il ajoute seulement des icônes à l’écran d’accueil.',
    },
    liveLoop: {
      title: 'Comment s’animent les Live Photos',
      body: 'Une Live Photo s’anime quand vous appuyez dessus dans Photos ; ce n’est pas une boucle continue. En fond d’écran, l’iPhone peut indiquer que le mouvement n’est pas disponible.',
    },
  },
};
