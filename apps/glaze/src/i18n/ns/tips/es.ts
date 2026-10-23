// `tips` namespace, es. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const es: NonNullable<LocaleMessages['tips']> = {
  intro: 'Notas breves sobre cómo funciona Glaze con iOS. Los consejos aparecen junto a la función que explican; oculta los que no necesites y recupéralos aquí.',
  showAll: 'Mostrar todos los consejos',
  showAllDone: 'Todos los consejos se mostrarán otra vez',
  allShowing: 'Ya se muestran todos los consejos',
  hidden: 'Oculto',
  showing: 'Visible',
  showAgain: 'Mostrar otra vez',
  hide: 'Ocultar',
  toggleA11y: '{action}: {tip}',
  rowA11y: '{title}. {body} Aparece en {place}. {status}.',
  meta: '{place} · {status}',
  hiddenHint: {
    one: '{count} consejo oculto se mostrará otra vez',
    many: '{count} de consejos ocultos se mostrarán otra vez',
    other: '{count} consejos ocultos se mostrarán otra vez',
  },
  groups: {
    start: 'Primeros pasos',
    themes: 'Temas',
    wallpaper: 'Fotos y fondos',
    icons: 'Iconos, formas y personalizaciones',
    install: 'Instalar iconos',
    live: 'Pantalla bloqueada animada',
  },
  places: {
    firstRun: 'Pestaña Temas',
    themes: 'Vista previa del tema',
    wallpaper: 'Creador de fondos',
    icons: 'Pestaña Iconos',
    install: 'Instalar iconos',
    live: 'Pestaña Live Lock',
    shapes: 'Ajustes de forma de icono',
    override: 'Pestaña Iconos',
    addApp: 'Pestaña Iconos',
  },
  items: {
    iconsAdded: {
      title: 'Los iconos se añaden, no se reemplazan',
      body: 'iOS no permite que una app cambie el icono de otra. Glaze añade un acceso directo con tema que abre la app real; mueve los originales a la Biblioteca de apps.',
    },
    bulkInstall: {
      title: 'Instala todos los iconos a la vez',
      body: 'Glaze pone todo tu conjunto en un perfil, así lo instalas una vez en Ajustes en lugar de crear un atajo por app.',
    },
    liveLock: {
      title: 'Haz que tu pantalla bloqueada se mueva',
      body: 'Pon en bucle tu propio vídeo o GIF en la pantalla bloqueada desde la pestaña Live Lock.',
    },
    themePick: {
      title: 'Empieza con un tema',
      body: 'Abre un tema para ver su fondo y sus iconos juntos. Después puedes cambiar la forma, los colores o cualquier icono.',
    },
    photoBackground: {
      title: 'Usa tu propia foto',
      body: 'Glaze no puede poner fondos por sí mismo. Guarda el resultado en Fotos y elígelo en Ajustes › Fondo de pantalla.',
    },
    wallpaperSave: {
      title: 'Aplicar un fondo guardado',
      body: 'En Ajustes › Fondo de pantalla, toca Añadir fondo nuevo y elige la imagen de Fotos. Ya tiene el tamaño de tu iPhone, así que no hace falta ampliar.',
    },
    iconShapes: {
      title: 'Cómo se ven las formas en el iPhone',
      body: 'iOS muestra los iconos añadidos dentro de su propio cuadrado redondeado. Las formas de círculo y gota se colocan sobre un color de fondo dentro de ese cuadrado.',
    },
    iconOverride: {
      title: 'Usa tu propia imagen para un icono',
      body: 'Una personalización cambia el icono de una app en este tema, o en todos si quieres. Restaurar recupera el icono del tema y conserva tu imagen.',
    },
    missingApp: {
      title: '¿La app no está en la lista?',
      body: 'Glaze no puede ver qué apps tienes instaladas, así que usa un catálogo. Añade tu app y una imagen, hecha aquí o en cualquier editor.',
    },
    installNotVerified: {
      title: '“No verificado” es normal',
      body: 'El perfil se crea en tu teléfono y no está firmado, por eso Ajustes muestra No verificado. Solo añade iconos a la pantalla de inicio.',
    },
    liveLoop: {
      title: 'Dónde se mueven de verdad los bucles',
      body: 'En iOS 26, la versión completa de Glaze reproduce el bucle en la pantalla bloqueada; en iOS anteriores, una Live Photo se reproduce al mantener pulsado. Expo Go solo muestra una vista previa.',
    },
  },
};
