// `tips` namespace, pt-BR. MACHINE TRANSLATION awaiting native-speaker review (docs/I18N.md).
import type { LocaleMessages } from '../../catalogue.ts';

export const ptBR: NonNullable<LocaleMessages['tips']> = {
  intro: 'Notas curtas sobre como o Glaze funciona com o iOS. As dicas aparecem ao lado do recurso que explicam; oculte as que não precisar e traga-as de volta aqui.',
  showAll: 'Mostrar todas as dicas de novo',
  showAllDone: 'Todas as dicas vão aparecer de novo',
  allShowing: 'Todas as dicas já estão aparecendo',
  hidden: 'Oculta',
  showing: 'Visível',
  showAgain: 'Mostrar de novo',
  hide: 'Ocultar',
  toggleA11y: '{action}: {tip}',
  rowA11y: '{title}. {body} Aparece em {place}. {status}.',
  meta: '{place} · {status}',
  hiddenHint: {
    one: '{count} dica oculta vai aparecer de novo',
    many: '{count} de dicas ocultas vão aparecer de novo',
    other: '{count} dicas ocultas vão aparecer de novo',
  },
  groups: {
    start: 'Primeiros passos',
    themes: 'Temas',
    wallpaper: 'Fotos e papéis de parede',
    icons: 'Ícones, formatos e personalizações',
    install: 'Instalar ícones',
    live: 'Live Photos',
  },
  places: {
    firstRun: 'Aba Temas',
    themes: 'Prévia do tema',
    wallpaper: 'Criador de papel de parede',
    icons: 'Aba Ícones',
    install: 'Instalar ícones',
    live: 'Criador de Live Photos',
    shapes: 'Ajustes de formato do ícone',
    override: 'Aba Ícones',
    addApp: 'Aba Ícones',
  },
  items: {
    iconsAdded: {
      title: 'Os ícones são adicionados, não substituídos',
      body: 'O iOS não deixa nenhum app mudar o ícone de outro. O Glaze adiciona um atalho temático que abre o app de verdade; mova os originais para a Biblioteca de Apps.',
    },
    bulkInstall: {
      title: 'Instalação em lote (beta opcional)',
      body: 'Beta opcional: um único perfil instala todo o seu conjunto de uma vez em Ajustes. O método guiado com Atalhos é o padrão e sempre funciona.',
    },
    liveLock: {
      title: 'Crie uma Live Photo',
      body: 'Transforme um vídeo em Live Photo no Criador de Live Photos, em Papéis de parede. Ela se move no Fotos; como papel de parede, o iPhone muitas vezes a deixa parada.',
    },
    themePick: {
      title: 'Comece com um tema',
      body: 'Abra um tema para ver o papel de parede e os ícones juntos. Depois você ainda pode mudar o formato, as cores ou qualquer ícone.',
    },
    photoBackground: {
      title: 'Use sua própria foto',
      body: 'O Glaze não consegue definir papéis de parede sozinho. Salve o resultado no Fotos e escolha-o em Ajustes › Imagem de Fundo.',
    },
    wallpaperSave: {
      title: 'Aplicar um papel de parede salvo',
      body: 'Em Ajustes › Imagem de Fundo, toque em Adicionar Nova Imagem de Fundo e escolha a imagem no Fotos. Ela já tem o tamanho do seu iPhone, sem precisar de zoom.',
    },
    iconShapes: {
      title: 'Como os formatos ficam no iPhone',
      body: 'O iOS mostra os ícones adicionados dentro do próprio quadrado arredondado. Os formatos círculo e gota ficam sobre uma cor de fundo dentro desse quadrado.',
    },
    iconOverride: {
      title: 'Use sua imagem em um ícone',
      body: 'Uma personalização muda o ícone de um app neste tema, ou em todos se você quiser. Restaurar traz de volta o ícone do tema e mantém sua imagem.',
    },
    missingApp: {
      title: 'O app não está na lista?',
      body: 'O Glaze não vê quais apps estão instalados, por isso usa um catálogo. Adicione seu app e uma imagem, feita aqui ou em qualquer editor.',
    },
    installNotVerified: {
      title: '“Não Verificado” é normal',
      body: 'O perfil é criado no seu celular e não é assinado, por isso Ajustes mostra Não Verificado. Ele só adiciona ícones à Tela de Início.',
    },
    liveLoop: {
      title: 'Como as Live Photos se movem',
      body: 'Uma Live Photo se move quando você a pressiona no Fotos; não é um loop contínuo. Como papel de parede, o iPhone pode dizer que o movimento não está disponível.',
    },
  },
};
