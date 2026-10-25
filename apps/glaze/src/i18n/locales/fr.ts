// French (fr). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'OK',
    cancel: 'Annuler',
    close: 'Fermer',
    done: 'Terminé',
    save: 'Enregistrer',
    delete: 'Supprimer',
    retry: 'Réessayer',
    loading: 'Chargement…',
    back: 'Retour',
    next: 'Suivant',
    continue: 'Continuer',
    learnMore: 'En savoir plus',
    share: 'Partager',
    edit: 'Modifier',
    reset: 'Réinitialiser',
    on: 'Activé',
    off: 'Désactivé',
    yes: 'Oui',
    no: 'Non',
    later: 'Plus tard',
    restartNow: 'Redémarrer maintenant',
    showAll: 'Tout afficher',
    error: 'Une erreur s’est produite',
    itemCount: { zero: 'Aucun élément', one: '{count} élément', many: '{count} d’éléments', other: '{count} éléments' },
  },
  tabs: { themes: 'Thèmes', icons: 'Icônes', live: 'Live', settings: 'Réglages' },
  settings: {
    language: {
      title: 'Langue',
      row: 'Langue de l’app',
      pickerHint: 'Ouvre la liste des langues',
      note: 'Les langues autres que l’anglais sont des traductions automatiques en attente de relecture par des locuteurs natifs.',
      systemDefault: 'Langue du système',
      systemDefaultHint: 'Suit votre téléphone ({language})',
      pseudo: 'Pseudo (test)',
      sheetTitle: 'Choisir la langue',
      hintLine: 'Langue : {language}',
      change: 'Modifier',
      restartTitle: 'Redémarrer Glaze ?',
      restartBody: 'Glaze doit redémarrer pour passer d’une mise en page de gauche à droite à une mise en page de droite à gauche.',
      restartManual: 'Fermez Glaze et rouvrez-le pour terminer le changement de sens de la mise en page.',
    },
  },
  install: { title: 'Installer les icônes' },
  live: { editTitle: 'Modifier la boucle' },
  theme: { title: 'Thème' },
  wallpaper: { title: 'Fond d’écran' },
  tips: { title: 'Astuces' },
  feedback: { title: 'Envoyer un avis' },
  addApp: { title: 'Une app manque ?' },
};

export const fr: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['fr']);
