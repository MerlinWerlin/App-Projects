// Portuguese (Brazil) (pt-BR). MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
// Missing keys fall back to English at runtime.
import type { LocaleMessages } from '../catalogue.ts';
import { mergeCatalogue, NS_TRANSLATIONS } from '../ns/index.ts';

const base: LocaleMessages = {
  common: {
    ok: 'OK',
    cancel: 'Cancelar',
    close: 'Fechar',
    done: 'Concluído',
    save: 'Salvar',
    delete: 'Apagar',
    retry: 'Tentar novamente',
    loading: 'Carregando…',
    back: 'Voltar',
    next: 'Avançar',
    continue: 'Continuar',
    learnMore: 'Saiba mais',
    share: 'Compartilhar',
    edit: 'Editar',
    reset: 'Redefinir',
    on: 'Ativado',
    off: 'Desativado',
    yes: 'Sim',
    no: 'Não',
    later: 'Mais tarde',
    restartNow: 'Reiniciar agora',
    error: 'Algo deu errado',
    itemCount: { zero: 'Nenhum item', one: '{count} item', many: '{count} de itens', other: '{count} itens' },
  },
  tabs: { themes: 'Temas', icons: 'Ícones', live: 'Live', settings: 'Ajustes' },
  settings: {
    language: {
      title: 'Idioma',
      row: 'Idioma do app',
      pickerHint: 'Abre a lista de idiomas',
      note: 'Os idiomas além do inglês são traduções automáticas aguardando revisão de falantes nativos.',
      systemDefault: 'Padrão do sistema',
      systemDefaultHint: 'Segue o seu celular ({language})',
      pseudo: 'Pseudo (teste)',
      sheetTitle: 'Escolher idioma',
      restartTitle: 'Reiniciar o Glaze?',
      restartBody: 'O Glaze precisa reiniciar para alternar entre o layout da esquerda para a direita e da direita para a esquerda.',
      restartManual: 'Feche o Glaze e abra-o novamente para concluir a mudança de direção do layout.',
    },
  },
  install: { title: 'Instalar ícones' },
  live: { editTitle: 'Editar loop' },
  theme: { title: 'Tema' },
  wallpaper: { title: 'Papel de parede' },
  tips: { title: 'Dicas' },
  feedback: { title: 'Enviar feedback' },
  addApp: { title: 'Falta um app?' },
};

export const ptBR: LocaleMessages = mergeCatalogue(base, NS_TRANSLATIONS['pt-BR']);
