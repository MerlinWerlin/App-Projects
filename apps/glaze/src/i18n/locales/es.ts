// Spanish (es). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'Aceptar',
    cancel: 'Cancelar',
    close: 'Cerrar',
    done: 'Listo',
    save: 'Guardar',
    delete: 'Eliminar',
    retry: 'Reintentar',
    loading: 'Cargando…',
    back: 'Atrás',
    next: 'Siguiente',
    continue: 'Continuar',
    learnMore: 'Más información',
    share: 'Compartir',
    edit: 'Editar',
    reset: 'Restablecer',
    on: 'Activado',
    off: 'Desactivado',
    yes: 'Sí',
    no: 'No',
    later: 'Más tarde',
    restartNow: 'Reiniciar ahora',
    showAll: 'Mostrar todo',
    error: 'Algo salió mal',
    itemCount: { zero: 'Ningún elemento', one: '{count} elemento', many: '{count} de elementos', other: '{count} elementos' },
  },
  tabs: { themes: 'Temas', icons: 'Iconos', live: 'Live', settings: 'Ajustes' },
  settings: {
    language: {
      title: 'Idioma',
      row: 'Idioma de la app',
      pickerHint: 'Abre la lista de idiomas',
      note: 'Los idiomas distintos del inglés son traducciones automáticas pendientes de revisión por hablantes nativos.',
      systemDefault: 'Predeterminado del sistema',
      systemDefaultHint: 'Sigue a tu teléfono ({language})',
      pseudo: 'Pseudo (pruebas)',
      sheetTitle: 'Elegir idioma',
      hintLine: 'Idioma: {language}',
      change: 'Cambiar',
      restartTitle: '¿Reiniciar Glaze?',
      restartBody: 'Glaze necesita reiniciarse para cambiar entre diseño de izquierda a derecha y de derecha a izquierda.',
      restartManual: 'Cierra Glaze y ábrelo de nuevo para terminar de cambiar la dirección del diseño.',
    },
  },
  install: { title: 'Instalar iconos' },
  live: { editTitle: 'Editar bucle' },
  theme: { title: 'Tema' },
  wallpaper: { title: 'Fondo de pantalla' },
  tips: { title: 'Consejos' },
  feedback: { title: 'Enviar comentarios' },
  addApp: { title: '¿Falta una app?' },
};

export const es: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['es']);
