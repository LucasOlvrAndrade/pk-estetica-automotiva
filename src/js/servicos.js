/**
 * servicos.js — Servicos
 *
 * Catálogo de serviços da estética, pacotes e funções "puras" sobre ele
 * (buscar, filtrar, calcular preço por porte, formatar moeda e
 * a lógica de recomendação do diagnóstico).
 * Não mexe na tela: quem desenha os cards e o resultado é o app.js.
 * Assim, se o preço mudar, só este arquivo é alterado.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam
 * (eles fazem "import { … } from"). A IIFE continua igual: tudo que está
 * dentro dela é privado, e só o objeto devolvido no "return" é público.
 */
export const Servicos = (function () {
  'use strict';

  /* =====================================================================
   * 1. TABELAS DE APOIO
   * ===================================================================== */

  /** Portes de veículo aceitos e o nome exibido na tela. */
  const PORTES = Object.freeze({
    hatch: 'Hatch',
    seda: 'Sedã',
    suv: 'SUV',
    picape: 'Picape',
  });

  /** Categorias usadas nos chips de filtro. */
  const CATEGORIAS = Object.freeze({
    lavagem: 'Lavagem',
    interior: 'Interior',
    correcao: 'Correção de pintura',
    protecao: 'Proteção',
  });

  /** Ids dos serviços da tabela comparativa, na ordem das linhas. */
  const IDS_COMPARATIVO = Object.freeze(['cera', 'selante', 'vitrificacao', 'ppf']);

  /** Formatador de moeda criado UMA vez (criar a cada uso é mais lento). */
  const formatadorBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  /* =====================================================================
   * 2. CATÁLOGO
   * protecao e brilho vão de 0 a 100 (barras do card).
   * precos: valor em reais para cada porte.
   * duracaoHoras: usado depois pela agenda e pelo diagnóstico.
   * ===================================================================== */

  /**
   * @typedef {Object} Servico
   * @property {string} id
   * @property {string} nome
   * @property {string} categoria Chave de CATEGORIAS.
   * @property {string} icone Caractere decorativo do card.
   * @property {string} resumo Uma frase para o card.
   * @property {string} descricao
   * @property {string} tecnica
   * @property {string[]} produtos
   * @property {string[]} etapas
   * @property {string} durabilidade Texto exibido (ex.: "2 a 3 anos").
   * @property {number} protecao 0 a 100.
   * @property {number} brilho 0 a 100.
   * @property {string} tempoExecucao Texto exibido (ex.: "1 dia").
   * @property {number} duracaoHoras
   * @property {{hatch: number, seda: number, suv: number, picape: number}} precos
   * @property {string} indicadoPara
   * @property {string[]} cuidados Cuidados pós-serviço.
   * @property {boolean} [contaFidelidade] true = ganha carimbo no cartão fidelidade.
   */

  /** @type {Servico[]} */
  const CATALOGO = [
    {
      id: 'lavagem-tecnica',
      contaFidelidade: true, // ganha carimbo no cartão PK Club
      nome: 'Lavagem Técnica',
      categoria: 'lavagem',
      icone: '◌',
      resumo: 'Limpeza completa sem riscar a pintura, com técnica de dois baldes.',
      descricao:
        'Lavagem detalhada de carroceria, rodas, caixas de roda e vidros, feita para remover a sujeira sem criar micro-riscos.',
      tecnica:
        'Pré-lavagem com espuma ativa, lavagem pelo método de dois baldes com luva de microfibra e secagem com toalha de alta absorção.',
      produtos: ['Shampoo automotivo pH neutro', 'Espuma ativa (snow foam)', 'Limpador de rodas', 'Toalhas de microfibra'],
      etapas: [
        'Pré-lavagem com espuma ativa',
        'Limpeza de rodas e caixas de roda',
        'Lavagem pelo método de dois baldes',
        'Enxágue e secagem com microfibra',
        'Limpeza de vidros e acabamento de pneus',
      ],
      durabilidade: 'Até 15 dias',
      protecao: 10,
      brilho: 40,
      tempoExecucao: '2 horas',
      duracaoHoras: 2,
      precos: { hatch: 120, seda: 140, suv: 170, picape: 190 },
      indicadoPara: 'Manutenção semanal ou quinzenal',
      cuidados: ['Evite estacionar sob árvores nas primeiras horas', 'Não use rodo de silicone na pintura'],
    },
    {
      id: 'higienizacao-interna',
      contaFidelidade: true,
      nome: 'Higienização Interna',
      categoria: 'interior',
      icone: '◇',
      resumo: 'Bancos, carpetes e teto limpos a fundo, com eliminação de odores.',
      descricao:
        'Limpeza profunda do interior: extração de sujeira dos tecidos, limpeza de plásticos e couro e eliminação de fungos e odores.',
      tecnica:
        'Aspiração, aplicação de produto por zona, escovação e extração com máquina, seguida de oxi-sanitização do ar-condicionado.',
      produtos: [
        'Limpador multiuso diluído',
        'Extratora de estofados',
        'Hidratante de couro',
        'Sanitizante para ar-condicionado',
      ],
      etapas: [
        'Aspiração completa',
        'Limpeza de bancos e carpetes com extratora',
        'Limpeza de painel, portas e plásticos',
        'Hidratação de couro (se houver)',
        'Sanitização do ar-condicionado',
      ],
      durabilidade: '3 a 6 meses',
      protecao: 20,
      brilho: 10,
      tempoExecucao: '5 horas',
      duracaoHoras: 5,
      precos: { hatch: 280, seda: 320, suv: 380, picape: 420 },
      indicadoPara: 'Carro com manchas, cheiro ou para revenda',
      cuidados: ['Deixe os vidros entreabertos por 2 horas', 'Evite comer dentro do carro na primeira semana'],
    },
    {
      id: 'polimento-comercial',
      nome: 'Polimento Comercial',
      categoria: 'correcao',
      icone: '◐',
      resumo: 'Devolve o brilho e reduz riscos leves em uma etapa.',
      descricao:
        'Polimento de uma etapa que remove marcas de lavagem e riscos superficiais, devolvendo brilho e profundidade à cor.',
      tecnica:
        'Descontaminação com clay bar e polimento com politriz roto-orbital usando composto de refino em uma única etapa.',
      produtos: ['Clay bar (massa descontaminante)', 'Composto polidor de refino', 'Boinas de espuma', 'Removedor de oleosidade'],
      etapas: [
        'Lavagem técnica',
        'Descontaminação da pintura com clay bar',
        'Isolamento de borrachas e plásticos',
        'Polimento de refino',
        'Limpeza final e inspeção sob luz',
      ],
      durabilidade: 'Até 6 meses (com proteção)',
      protecao: 20,
      brilho: 80,
      tempoExecucao: '1 dia',
      duracaoHoras: 8,
      precos: { hatch: 450, seda: 520, suv: 620, picape: 700 },
      indicadoPara: 'Pintura sem brilho ou com riscos leves',
      cuidados: ['Aplique uma proteção (cera ou selante) para manter o resultado', 'Lave somente com shampoo neutro'],
    },
    {
      id: 'polimento-tecnico',
      nome: 'Correção de Pintura',
      categoria: 'correcao',
      icone: '◑',
      resumo: 'Polimento técnico em etapas para remover riscos visíveis e oxidação.',
      descricao:
        'Correção em duas etapas (corte e refino) para remover riscos visíveis, hologramas e oxidação, com medição da espessura da pintura.',
      tecnica:
        'Medição com medidor de camada, corte com composto abrasivo e refino com composto fino, sempre respeitando a margem de verniz.',
      produtos: [
        'Medidor de espessura de pintura',
        'Composto de corte',
        'Composto de refino',
        'Boinas de lã e de espuma',
      ],
      etapas: [
        'Lavagem e descontaminação',
        'Medição da espessura da pintura',
        'Polimento de corte',
        'Polimento de refino',
        'Inspeção sob luz e limpeza final',
      ],
      durabilidade: 'Permanente (os riscos removidos não voltam)',
      protecao: 25,
      brilho: 95,
      tempoExecucao: '2 dias',
      duracaoHoras: 16,
      precos: { hatch: 900, seda: 1050, suv: 1250, picape: 1400 },
      indicadoPara: 'Riscos visíveis, pintura opaca ou oxidada',
      cuidados: ['Recomenda-se proteger com selante ou vitrificação', 'Evite lava-rápido com escovas'],
    },
    {
      id: 'cera',
      nome: 'Cera de Carnaúba',
      categoria: 'protecao',
      icone: '◍',
      resumo: 'Brilho quente e proteção básica contra sol e chuva.',
      descricao:
        'Aplicação de cera à base de carnaúba, que realça a cor e cria uma camada protetora leve contra raios UV e água.',
      tecnica: 'Aplicação manual com aplicador de espuma em camada fina, cura de 15 minutos e remoção com microfibra.',
      produtos: ['Cera de carnaúba', 'Aplicador de espuma', 'Toalhas de microfibra'],
      etapas: ['Lavagem técnica', 'Aplicação da cera por painel', 'Tempo de cura', 'Remoção e lustro final'],
      durabilidade: '1 a 3 meses',
      protecao: 35,
      brilho: 70,
      tempoExecucao: '3 horas',
      duracaoHoras: 3,
      precos: { hatch: 180, seda: 210, suv: 250, picape: 280 },
      indicadoPara: 'Brilho rápido com baixo investimento',
      cuidados: ['Não lave nas primeiras 24 horas', 'Reaplique a cada 2 ou 3 meses'],
    },
    {
      id: 'selante',
      nome: 'Selante Sintético',
      categoria: 'protecao',
      icone: '◆',
      resumo: 'Proteção sintética que dura meses e repele água.',
      descricao:
        'Selante à base de polímeros que se liga à pintura, oferecendo proteção mais duradoura que a cera e forte efeito repelente de água.',
      tecnica: 'Descontaminação, remoção de oleosidade e aplicação do selante em camada única com cura controlada.',
      produtos: ['Selante polimérico', 'Removedor de oleosidade', 'Clay bar', 'Toalhas de microfibra'],
      etapas: [
        'Lavagem técnica',
        'Descontaminação com clay bar',
        'Remoção de oleosidade',
        'Aplicação do selante',
        'Cura e inspeção',
      ],
      durabilidade: '6 a 12 meses',
      protecao: 60,
      brilho: 75,
      tempoExecucao: '4 horas',
      duracaoHoras: 4,
      precos: { hatch: 350, seda: 400, suv: 480, picape: 540 },
      indicadoPara: 'Quem quer proteção prática para o dia a dia',
      cuidados: ['Não lave nas primeiras 48 horas', 'Use shampoo neutro, sem cera'],
    },
    {
      id: 'vitrificacao',
      nome: 'Vitrificação Cerâmica',
      categoria: 'protecao',
      icone: '✦',
      resumo: 'Camada cerâmica rígida: brilho de vitrine e proteção por anos.',
      descricao:
        'Revestimento cerâmico (à base de SiO₂) que forma uma camada rígida e transparente sobre o verniz, com alta resistência química e brilho intenso.',
      tecnica:
        'Correção de pintura de uma etapa, preparação da superfície e aplicação do revestimento cerâmico em ambiente controlado, com cura por 24 horas.',
      produtos: [
        'Revestimento cerâmico profissional',
        'Composto polidor de refino',
        'Removedor de oleosidade',
        'Lâmpada de inspeção',
      ],
      etapas: [
        'Lavagem e descontaminação',
        'Polimento de preparação',
        'Remoção de oleosidade',
        'Aplicação do revestimento cerâmico',
        'Cura controlada por 24 horas',
        'Inspeção final e entrega do certificado',
      ],
      durabilidade: '2 a 3 anos',
      protecao: 90,
      brilho: 95,
      tempoExecucao: '2 a 3 dias',
      duracaoHoras: 48,
      precos: { hatch: 1500, seda: 1750, suv: 2100, picape: 2400 },
      indicadoPara: 'Carro novo ou para valorizar na revenda',
      cuidados: [
        'Não lave nos primeiros 7 dias',
        'Evite produtos ácidos ou alcalinos fortes',
        'Faça a revisão de manutenção a cada 6 meses',
      ],
    },
    {
      id: 'ppf',
      nome: 'PPF (Película de Proteção)',
      categoria: 'protecao',
      icone: '⬢',
      resumo: 'Película transparente que protege contra pedras e riscos.',
      descricao:
        'Película de poliuretano transparente (Paint Protection Film) aplicada sobre a pintura. Absorve impactos de pedras e se regenera de riscos leves com o calor.',
      tecnica:
        'Corte computadorizado da película para o modelo do veículo e aplicação com solução deslizante, sem desmontar peças sempre que possível.',
      produtos: ['Película PPF autorregenerativa', 'Solução de aplicação', 'Espátulas de instalação', 'Soprador térmico'],
      etapas: [
        'Lavagem e descontaminação',
        'Polimento de preparação (se necessário)',
        'Corte da película no plotter',
        'Aplicação painel por painel',
        'Selagem das bordas com calor',
        'Inspeção após 24 horas',
      ],
      durabilidade: '5 a 10 anos',
      protecao: 100,
      brilho: 80,
      tempoExecucao: '3 dias',
      duracaoHoras: 72,
      precos: { hatch: 3500, seda: 4000, suv: 4800, picape: 5500 },
      indicadoPara: 'Esportivos, colecionáveis e quem roda em estrada',
      cuidados: [
        'Não lave nos primeiros 7 dias',
        'Bolhas pequenas somem sozinhas em até 2 semanas',
        'Evite lavadora de alta pressão perto das bordas',
      ],
    },
  ];

  // Congela o catálogo para nenhuma parte do app alterar os dados sem querer
  CATALOGO.forEach(function (s) {
    Object.freeze(s);
  });
  Object.freeze(CATALOGO);

  /* =====================================================================
   * 2b. PACOTES (combinações de serviços do catálogo)
   * Usados pelo diagnóstico. Um pacote é montado a partir dos serviços
   * que ele inclui: preço = soma dos preços, etapas e cuidados = união.
   * Assim, um pacote "parece" um serviço comum e funciona no diálogo
   * de detalhes, nos salvos e no agendamento sem código extra.
   * `itens` está na ORDEM de execução: a correção vem sempre antes da proteção.
   * ===================================================================== */

  /** Definição "crua" dos pacotes (o resto é calculado em montarPacote). */
  const DEFINICAO_PACOTES = [
    {
      id: 'pacote-correcao-vitrificacao',
      nome: 'Correção + Vitrificação',
      icone: '✶',
      resumo: 'Remove os riscos e sela a pintura corrigida com camada cerâmica.',
      itens: ['polimento-tecnico', 'vitrificacao'],
      // A correção substitui o polimento de preparação da vitrificação: por isso não são 5 dias
      tempoExecucao: '3 dias',
      duracaoHoras: 72,
      indicadoPara: 'Pintura riscada que precisa de proteção duradoura',
    },
    {
      id: 'pacote-revenda',
      nome: 'Pacote Revenda',
      icone: '★',
      resumo: 'Pintura corrigida, interior higienizado e proteção para a vistoria do comprador.',
      itens: ['polimento-tecnico', 'higienizacao-interna', 'selante'],
      tempoExecucao: '2 a 3 dias',
      duracaoHoras: 24, // a higienização é feita em paralelo, por outro técnico
      indicadoPara: 'Quem vai vender o carro e quer o melhor preço',
    },
    {
      id: 'pacote-correcao-selante',
      nome: 'Correção + Selante',
      icone: '◈',
      resumo: 'Remove os riscos e protege com selante sintético por meses.',
      itens: ['polimento-tecnico', 'selante'],
      tempoExecucao: '2 a 3 dias',
      duracaoHoras: 20,
      indicadoPara: 'Pintura riscada com orçamento intermediário',
    },
    {
      id: 'pacote-refino-cera',
      nome: 'Refino + Cera',
      icone: '◉',
      resumo: 'Polimento de refino para tirar as marcas e cera de carnaúba para o brilho.',
      itens: ['polimento-comercial', 'cera'],
      tempoExecucao: '1 a 2 dias',
      duracaoHoras: 11,
      indicadoPara: 'Brilho máximo com investimento moderado',
    },
    {
      id: 'pacote-refino-selante',
      nome: 'Refino + Selante',
      icone: '◎',
      resumo: 'Polimento de refino e selante: brilho que dura meses.',
      itens: ['polimento-comercial', 'selante'],
      tempoExecucao: '1 a 2 dias',
      duracaoHoras: 12,
      indicadoPara: 'Brilho com proteção prática para o dia a dia',
    },
    {
      id: 'pacote-lavagem-completa',
      contaFidelidade: true,
      nome: 'Lavagem Completa',
      icone: '◎',
      resumo: 'Lavagem técnica por fora e higienização profunda por dentro.',
      itens: ['lavagem-tecnica', 'higienizacao-interna'],
      tempoExecucao: '1 dia',
      duracaoHoras: 7,
      indicadoPara: 'Carro sujo por dentro e por fora',
    },
  ];

  /**
   * Junta várias listas de texto numa só, sem repetir itens iguais.
   * @param {string[][]} listas
   * @returns {string[]}
   */
  function unirSemRepetir(listas) {
    const resultado = [];
    listas.forEach(function (lista) {
      lista.forEach(function (texto) {
        if (resultado.indexOf(texto) === -1) resultado.push(texto);
      });
    });
    return resultado;
  }

  /**
   * Transforma a definição de um pacote num objeto com o MESMO formato de um Servico.
   * @param {Object} definicao Item de DEFINICAO_PACOTES.
   * @returns {Servico} Com o campo extra `itens` (ids dos serviços incluídos).
   */
  function montarPacote(definicao) {
    const servicos = definicao.itens.map(function (id) {
      return CATALOGO.find(function (s) {
        return s.id === id;
      });
    });
    // A durabilidade do pacote é a do serviço que mais protege (ex.: a vitrificação)
    const maisProtetor = servicos.reduce(function (melhor, s) {
      return s.protecao > melhor.protecao ? s : melhor;
    });
    const precos = {};
    Object.keys(PORTES).forEach(function (porte) {
      precos[porte] = servicos.reduce(function (soma, s) {
        return soma + s.precos[porte];
      }, 0);
    });
    const nomes = servicos.map(function (s) {
      return s.nome;
    });

    return Object.freeze({
      id: definicao.id,
      nome: definicao.nome,
      categoria: 'pacote',
      icone: definicao.icone,
      resumo: definicao.resumo,
      descricao: 'Pacote com ' + nomes.join(' + ') + ', feitos nesta ordem. ' + definicao.resumo,
      tecnica: servicos
        .map(function (s, i) {
          return i + 1 + 'ª fase (' + s.nome + '): ' + s.tecnica;
        })
        .join(' '),
      produtos: unirSemRepetir(servicos.map(function (s) {
        return s.produtos;
      })),
      etapas: unirSemRepetir(servicos.map(function (s) {
        return s.etapas;
      })),
      durabilidade: maisProtetor.durabilidade,
      protecao: Math.max.apply(null, servicos.map(function (s) {
        return s.protecao;
      })),
      brilho: Math.max.apply(null, servicos.map(function (s) {
        return s.brilho;
      })),
      tempoExecucao: definicao.tempoExecucao,
      duracaoHoras: definicao.duracaoHoras,
      precos: Object.freeze(precos),
      indicadoPara: definicao.indicadoPara,
      cuidados: unirSemRepetir(servicos.map(function (s) {
        return s.cuidados;
      })),
      itens: Object.freeze(definicao.itens.slice()),
      contaFidelidade: Boolean(definicao.contaFidelidade),
    });
  }

  /** @type {Servico[]} Pacotes prontos (mesmo formato dos serviços). */
  const PACOTES = Object.freeze(DEFINICAO_PACOTES.map(montarPacote));

  /* =====================================================================
   * 3. FUNÇÕES PRIVADAS
   * ===================================================================== */

  /**
   * Deixa o texto em minúsculas e sem acentos, para a busca achar
   * "vitrificacao" ao digitar "Vitrificação" (e vice-versa).
   * @param {string} texto
   * @returns {string}
   */
  function normalizar(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD') // separa a letra do acento: "ç" → "c" + "¸"
      .replace(/[̀-ͯ]/g, '') // remove os acentos separados
      .trim();
  }

  /* =====================================================================
   * 4. API PÚBLICA
   * ===================================================================== */

  /**
   * Lista todos os serviços.
   * @returns {Servico[]}
   */
  function listar() {
    return CATALOGO.slice(); // cópia da lista, para ninguém reordenar a original
  }

  /**
   * Lista os pacotes (combinações de serviços usadas pelo diagnóstico).
   * Eles NÃO aparecem na vitrine: só no diagnóstico, nos salvos e no agendamento.
   * @returns {Servico[]}
   */
  function listarPacotes() {
    return PACOTES.slice();
  }

  /**
   * Busca um serviço (ou pacote) pelo id.
   * @param {string} id
   * @returns {Servico|null}
   */
  function obter(id) {
    function mesmoId(s) {
      return s.id === id;
    }
    return CATALOGO.find(mesmoId) || PACOTES.find(mesmoId) || null;
  }

  /**
   * Filtra o catálogo por categoria e por um trecho do nome.
   * @param {{categoria?: string, busca?: string}} filtro "todos" ou vazio = sem filtro.
   * @returns {Servico[]}
   */
  function filtrar(filtro) {
    const categoria = filtro && filtro.categoria;
    const busca = normalizar(filtro && filtro.busca);
    return CATALOGO.filter(function (s) {
      const passaCategoria = !categoria || categoria === 'todos' || s.categoria === categoria;
      const passaBusca = !busca || normalizar(s.nome).indexOf(busca) !== -1;
      return passaCategoria && passaBusca;
    });
  }

  /**
   * Preço de um serviço para um porte.
   * @param {Servico|string} servico O serviço ou o id dele.
   * @param {string} porte hatch | seda | suv | picape
   * @returns {number} Valor em reais (0 se não encontrar).
   */
  function precoPara(servico, porte) {
    const s = typeof servico === 'string' ? obter(servico) : servico;
    if (!s) return 0;
    return s.precos[porte] || s.precos.hatch;
  }

  /**
   * Formata um número como moeda brasileira (ex.: 1500 → "R$ 1.500,00").
   * @param {number} valor
   * @returns {string}
   */
  function formatarMoeda(valor) {
    return formatadorBRL.format(Number(valor) || 0);
  }

  /**
   * Nome do porte para exibir (ex.: "seda" → "Sedã").
   * @param {string} porte
   * @returns {string}
   */
  function nomePorte(porte) {
    return PORTES[porte] || porte;
  }

  /**
   * Nome da categoria para exibir (ex.: "protecao" → "Proteção").
   * @param {string} categoria
   * @returns {string}
   */
  function nomeCategoria(categoria) {
    if (categoria === 'pacote') return 'Pacote'; // fora de CATEGORIAS para não virar chip de filtro
    return CATEGORIAS[categoria] || categoria;
  }

  /**
   * Serviços da tabela comparativa (Cera × Selante × Vitrificação × PPF).
   * @returns {Servico[]}
   */
  function comparativo() {
    return IDS_COMPARATIVO.map(obter).filter(Boolean);
  }

  /* =====================================================================
   * 5. DIAGNÓSTICO — funções PURAS
   * "Pura" = só usa o que recebe e devolve um resultado: não lê a tela e
   * não grava nada. Por isso dá para testar direto no Console (F12):
   *   Servicos.recomendar({ porte: 'seda', pintura: 'opaca', objetivo: 'protecao',
   *                         orcamento: 'sem-limite', tempo: '2-3-dias' })
   * Quem desenha o resultado na tela é o app.js.
   * ===================================================================== */

  /** Quantas recomendações mostrar. */
  const QTD_RECOMENDACOES = 3;

  /** Folga aplicada ao orçamento quando sobram poucas opções (20%). */
  const FOLGA_ORCAMENTO = 0.2;

  /** Valor máximo de cada opção de orçamento (Infinity = sem limite). */
  const ORCAMENTOS = Object.freeze({ 200: 200, 600: 600, 1500: 1500, 'sem-limite': Infinity });

  /** Horas máximas de cada opção de tempo (1 dia = jornada de 8 horas). */
  const TEMPOS = Object.freeze({ '3h': 3, '1-dia': 8, '2-3-dias': 72 });

  /** Texto de cada resposta (o mesmo que aparece nos chips do formulário). */
  const ROTULOS = Object.freeze({
    porte: PORTES,
    pintura: { nova: 'Nova', 'riscos-leves': 'Riscos leves', 'riscos-visiveis': 'Riscos visíveis', opaca: 'Opaca/oxidada' },
    objetivo: {
      limpeza: 'Limpeza',
      brilho: 'Brilho',
      protecao: 'Proteção duradoura',
      revenda: 'Valorizar para revenda',
    },
    orcamento: {
      200: 'Até ' + formatadorBRL.format(200),
      600: 'Até ' + formatadorBRL.format(600),
      1500: 'Até ' + formatadorBRL.format(1500),
      'sem-limite': 'Sem limite',
    },
    tempo: { '3h': 'Até 3h', '1-dia': '1 dia', '2-3-dias': '2 a 3 dias' },
  });

  /** As 5 perguntas obrigatórias, na ordem do formulário, com a mensagem de erro. */
  const PERGUNTAS = Object.freeze([
    { campo: 'porte', mensagem: 'Escolha o porte do veículo.' },
    { campo: 'pintura', mensagem: 'Escolha o estado da pintura.' },
    { campo: 'objetivo', mensagem: 'Escolha o seu objetivo.' },
    { campo: 'orcamento', mensagem: 'Escolha um orçamento.' },
    { campo: 'tempo', mensagem: 'Escolha quanto tempo o carro pode ficar na estética.' },
  ]);

  /**
   * Pontos (0 a 10) de cada serviço/pacote para cada objetivo.
   * É uma tabela para ficar fácil de ler e de ajustar: quanto maior, mais indicado.
   *  - revenda:  polimento técnico + vitrificação / pacote revenda
   *  - protecao: vitrificação e PPF
   *  - brilho:   polimento de refino + cera/selante
   *  - limpeza:  lavagens e higienização
   */
  const PONTOS_POR_OBJETIVO = Object.freeze({
    revenda: {
      'pacote-revenda': 10,
      'pacote-correcao-vitrificacao': 10,
      'polimento-tecnico': 8,
      'pacote-correcao-selante': 8,
      vitrificacao: 7,
      'higienizacao-interna': 6,
      'pacote-refino-selante': 6,
      'polimento-comercial': 5,
      'pacote-refino-cera': 5,
      'pacote-lavagem-completa': 5,
      selante: 4,
      ppf: 4,
      cera: 3,
      'lavagem-tecnica': 2,
    },
    protecao: {
      vitrificacao: 10,
      ppf: 10,
      'pacote-correcao-vitrificacao': 10,
      'pacote-correcao-selante': 8,
      selante: 7,
      'pacote-refino-selante': 7,
      'pacote-revenda': 6,
      cera: 4,
      'pacote-refino-cera': 4,
      'polimento-tecnico': 3,
      'polimento-comercial': 1,
      'higienizacao-interna': 1,
      'lavagem-tecnica': 1,
      'pacote-lavagem-completa': 1,
    },
    brilho: {
      'pacote-refino-cera': 10,
      'pacote-refino-selante': 10,
      'polimento-comercial': 9,
      cera: 7,
      'polimento-tecnico': 7,
      'pacote-correcao-selante': 7,
      'pacote-correcao-vitrificacao': 7,
      vitrificacao: 6,
      selante: 6,
      'pacote-revenda': 5,
      'lavagem-tecnica': 3,
      'pacote-lavagem-completa': 3,
      ppf: 2,
      'higienizacao-interna': 0,
    },
    limpeza: {
      'lavagem-tecnica': 10,
      'pacote-lavagem-completa': 10,
      'higienizacao-interna': 9,
      cera: 4,
      selante: 3,
      'pacote-revenda': 3,
      'polimento-comercial': 2,
      'pacote-refino-cera': 2,
      'pacote-refino-selante': 2,
      'polimento-tecnico': 1,
      vitrificacao: 1,
      'pacote-correcao-selante': 1,
      'pacote-correcao-vitrificacao': 1,
      ppf: 0,
    },
  });

  /**
   * Serviços que compõem um item: o pacote devolve os seus itens; o serviço, ele mesmo.
   * @param {Servico} servico
   * @returns {Servico[]}
   */
  function componentes(servico) {
    if (!servico.itens) return [servico];
    return servico.itens.map(function (id) {
      return obter(id);
    });
  }

  /**
   * O item inclui o serviço com esse id? (ex.: o pacote inclui 'polimento-tecnico'?)
   * @param {Servico} servico
   * @param {string} id
   * @returns {boolean}
   */
  function inclui(servico, id) {
    return servico.id === id || (servico.itens || []).indexOf(id) !== -1;
  }

  /**
   * Primeiro serviço de PROTEÇÃO dentro do item (cera, selante, vitrificação, PPF), se houver.
   * @param {Servico} servico
   * @returns {Servico|null}
   */
  function protecaoIncluida(servico) {
    return (
      componentes(servico).find(function (s) {
        return s.categoria === 'protecao';
      }) || null
    );
  }

  /**
   * Pintura que precisa de correção técnica antes de qualquer proteção?
   * @param {string} pintura
   * @returns {boolean}
   */
  function pinturaPrecisaCorrecao(pintura) {
    return pintura === 'riscos-visiveis' || pintura === 'opaca';
  }

  /**
   * REGRA DE PADRÃO TÉCNICO: em pintura riscada ou opaca, proteção só COM correção antes.
   * Proteger por cima dos riscos "sela" o defeito embaixo da camada.
   * @param {Servico} servico
   * @param {string} pintura
   * @returns {boolean} false = o item é eliminado.
   */
  function respeitaCorrecaoAntesDaProtecao(servico, pintura) {
    if (!pinturaPrecisaCorrecao(pintura)) return true;
    return protecaoIncluida(servico) === null || inclui(servico, 'polimento-tecnico');
  }

  /**
   * Bônus ou desconto de pontos conforme o estado da pintura.
   * @param {Servico} servico
   * @param {Object} respostas
   * @returns {number}
   */
  function ajustePelaPintura(servico, respostas) {
    const tecnico = inclui(servico, 'polimento-tecnico');
    const comercial = inclui(servico, 'polimento-comercial');

    if (pinturaPrecisaCorrecao(respostas.pintura)) {
      if (tecnico) return respostas.objetivo === 'limpeza' ? 1 : 5; // a correção é o que resolve
      if (comercial) return -3; // uma etapa não remove riscos profundos
      return 0;
    }
    if (respostas.pintura === 'riscos-leves') {
      if (comercial) return 2; // refino resolve riscos leves
      if (tecnico) return -1; // mais agressivo que o necessário
      return 0;
    }
    // Pintura nova: não há o que corrigir; proteção de longa duração é a melhor hora
    if (tecnico) return -4; // desgastaria o verniz sem necessidade
    if (comercial) return -1;
    if (inclui(servico, 'vitrificacao') || inclui(servico, 'ppf')) return 2;
    return 0;
  }

  /**
   * Frase curta, em linguagem simples, explicando POR QUE o item foi recomendado.
   * @param {Servico} servico
   * @param {Object} respostas
   * @returns {string}
   */
  function gerarMotivo(servico, respostas) {
    const protecao = protecaoIncluida(servico);
    const fraseProtecao = protecao
      ? ' Em seguida, ' + protecao.nome + ' protege o resultado por ' + protecao.durabilidade.toLowerCase() + '.'
      : ' Depois, vale aplicar uma proteção para o resultado durar mais.';

    // 1. Pintura riscada/opaca: a correção vem antes de tudo
    if (pinturaPrecisaCorrecao(respostas.pintura)) {
      if (inclui(servico, 'polimento-tecnico')) {
        const inicio =
          respostas.pintura === 'opaca'
            ? 'Sua pintura está opaca: a correção de pintura remove a oxidação e devolve o brilho antes de proteger.'
            : 'Sua pintura tem riscos visíveis: o polimento técnico corrige antes de proteger.';
        const interior = inclui(servico, 'higienizacao-interna')
          ? ' O interior higienizado completa a boa impressão na vistoria.'
          : '';
        return inicio + fraseProtecao + interior;
      }
      if (inclui(servico, 'polimento-comercial')) {
        return 'O polimento comercial disfarça parte das marcas, mas riscos visíveis só saem com a correção técnica.';
      }
      // Lavagem/higienização: explica pelo objetivo e deixa claro que não resolve a pintura
      return motivoPeloObjetivo(servico, respostas, protecao) + ' Atenção: não corrige a pintura.';
    }

    // 2. Riscos leves: o polimento de refino basta
    if (respostas.pintura === 'riscos-leves' && inclui(servico, 'polimento-comercial')) {
      return (
        'Seus riscos são leves: o polimento de refino resolve em uma etapa, sem desgastar o verniz.' +
        (protecao ? fraseProtecao : '')
      );
    }

    // 3. Pintura nova + proteção de longa duração
    if (respostas.pintura === 'nova' && protecao && (protecao.id === 'vitrificacao' || protecao.id === 'ppf')) {
      return 'Pintura nova é a base ideal: ' + protecao.nome + ' protege desde já, sem precisar corrigir nada.';
    }

    // 4. Pelo objetivo
    return motivoPeloObjetivo(servico, respostas, protecao);
  }

  /**
   * Parte do motivo que depende só do objetivo escolhido.
   * @param {Servico} servico
   * @param {Object} respostas
   * @param {Servico|null} protecao Proteção incluída no item, se houver.
   * @returns {string}
   */
  function motivoPeloObjetivo(servico, respostas, protecao) {
    if (servico.id === 'pacote-lavagem-completa') return 'Limpa por fora e por dentro no mesmo dia.';
    if (servico.id === 'lavagem-tecnica') return 'Remove a sujeira sem riscar a pintura, com a técnica de dois baldes.';
    if (servico.id === 'higienizacao-interna') {
      return respostas.objetivo === 'revenda'
        ? 'Interior limpo e sem cheiro é o primeiro detalhe que o comprador repara.'
        : 'Tira manchas e odores de bancos, carpetes e ar-condicionado.';
    }
    // Se o item É a própria proteção, não repete o nome (ele já está no título do card)
    const sujeito = protecao && protecao.id !== servico.id ? protecao.nome + ' ' : '';
    function frase(verbo) {
      const texto = sujeito + verbo;
      return texto.charAt(0).toUpperCase() + texto.slice(1);
    }
    if (respostas.objetivo === 'brilho' && protecao) {
      return frase('realça o brilho da pintura e o mantém por ' + protecao.durabilidade.toLowerCase() + '.');
    }
    if (protecao) {
      return frase('protege a pintura por ' + protecao.durabilidade.toLowerCase() + '.');
    }
    return 'Indicado para: ' + servico.indicadoPara.toLowerCase() + '.';
  }

  /**
   * Confere se todas as perguntas foram respondidas com uma opção válida.
   * @param {Object} respostas Ex.: { porte: 'seda', pintura: 'nova', ... }.
   * @returns {{campo: string, mensagem: string}[]} Lista vazia = tudo certo.
   */
  function validarRespostas(respostas) {
    respostas = respostas || {};
    return PERGUNTAS.filter(function (pergunta) {
      const valor = respostas[pergunta.campo];
      // hasOwnProperty: só aceita valores que existem na lista de opções
      return !valor || !Object.prototype.hasOwnProperty.call(ROTULOS[pergunta.campo], valor);
    });
  }

  /**
   * Texto de uma resposta (ex.: rotuloResposta('tempo', '1-dia') → "1 dia").
   * @param {string} campo
   * @param {string} valor
   * @returns {string}
   */
  function rotuloResposta(campo, valor) {
    return (ROTULOS[campo] && ROTULOS[campo][valor]) || valor;
  }

  /**
   * @typedef {Object} Recomendacao
   * @property {Servico} servico Serviço ou pacote.
   * @property {number} preco Preço para o porte informado.
   * @property {number} pontos Pontuação usada na ordenação.
   * @property {string} motivo Explicação em linguagem simples.
   * @property {boolean} acimaDoOrcamento true quando só entrou com a folga de 20%.
   */

  /**
   * Monta as recomendações do diagnóstico.
   * Passo 1: filtros ELIMINATÓRIOS (preço, tempo e correção antes da proteção).
   * Passo 2: se sobrarem menos de 3, amplia o orçamento em 20%.
   * Passo 3: pontua, ordena e fica com as 3 melhores.
   * @param {Object} respostas porte, pintura, objetivo, orcamento, tempo.
   * @returns {{recomendacoes: Recomendacao[], avisos: string[], orcamentoAmpliado: boolean, limiteOrcamento: number}}
   * @throws {Error} Se faltar alguma resposta.
   */
  function recomendar(respostas) {
    const erros = validarRespostas(respostas);
    if (erros.length) {
      throw new Error('Diagnóstico incompleto: ' + erros.map(function (e) {
        return e.campo;
      }).join(', '));
    }

    const porte = respostas.porte;
    const orcamento = ORCAMENTOS[respostas.orcamento];
    const limiteHoras = TEMPOS[respostas.tempo];
    const candidatos = CATALOGO.concat(PACOTES);

    /** Aplica os 3 filtros eliminatórios com um limite de preço. */
    function filtrarPorLimite(limitePreco) {
      return candidatos.filter(function (s) {
        return (
          precoPara(s, porte) <= limitePreco &&
          s.duracaoHoras <= limiteHoras &&
          respeitaCorrecaoAntesDaProtecao(s, respostas.pintura)
        );
      });
    }

    // Passo 1 e 2: filtra; se sobrar pouco, tenta de novo com 20% a mais
    let limiteOrcamento = orcamento;
    let orcamentoAmpliado = false;
    let aprovados = filtrarPorLimite(orcamento);
    if (aprovados.length < QTD_RECOMENDACOES && isFinite(orcamento)) {
      limiteOrcamento = orcamento * (1 + FOLGA_ORCAMENTO);
      orcamentoAmpliado = true;
      aprovados = filtrarPorLimite(limiteOrcamento);
    }

    // Passo 3: pontua e ordena (empate: o mais barato primeiro)
    const tabela = PONTOS_POR_OBJETIVO[respostas.objetivo];
    const recomendacoes = aprovados
      .map(function (s) {
        const preco = precoPara(s, porte);
        return {
          servico: s,
          preco: preco,
          pontos: (tabela[s.id] || 0) + ajustePelaPintura(s, respostas),
          motivo: gerarMotivo(s, respostas),
          acimaDoOrcamento: preco > orcamento,
        };
      })
      .sort(function (a, b) {
        return b.pontos - a.pontos || a.preco - b.preco;
      })
      .slice(0, QTD_RECOMENDACOES);

    // Avisos: transparência sobre o que foi ajustado ou ficou de fora
    const avisos = [];
    const algumAcima = recomendacoes.some(function (r) {
      return r.acimaDoOrcamento;
    });
    if (orcamentoAmpliado) {
      avisos.push(
        'Poucas opções cabiam em ' +
          formatarMoeda(orcamento) +
          '. Ampliamos o orçamento em 20% (até ' +
          formatarMoeda(limiteOrcamento) +
          ')' +
          (algumAcima ? ' e marcamos o que passa do seu limite.' : ', mas nenhuma opção nova coube.')
      );
    }
    if (recomendacoes.length < QTD_RECOMENDACOES) {
      avisos.push(
        'Só ' +
          recomendacoes.length +
          (recomendacoes.length === 1 ? ' opção cabe' : ' opções cabem') +
          ' no tempo e no orçamento escolhidos. Com mais tempo ou orçamento, aparecem outras alternativas.'
      );
    }
    const temCorrecao = recomendacoes.some(function (r) {
      return inclui(r.servico, 'polimento-tecnico');
    });
    if (pinturaPrecisaCorrecao(respostas.pintura) && !temCorrecao) {
      const correcao = obter('polimento-tecnico');
      avisos.push(
        'Sua pintura precisa de correção técnica (' +
          correcao.tempoExecucao +
          ', ' +
          formatarMoeda(precoPara(correcao, porte)) +
          ' para ' +
          nomePorte(porte) +
          '), que não coube no tempo ou no orçamento. Por isso não indicamos nenhuma proteção agora: ela selaria os riscos.'
      );
    }

    return {
      recomendacoes: recomendacoes,
      avisos: avisos,
      orcamentoAmpliado: orcamentoAmpliado,
      limiteOrcamento: limiteOrcamento,
    };
  }

  return {
    PORTES: PORTES,
    CATEGORIAS: CATEGORIAS,
    PERGUNTAS: PERGUNTAS,
    listar: listar,
    listarPacotes: listarPacotes,
    validarRespostas: validarRespostas,
    rotuloResposta: rotuloResposta,
    recomendar: recomendar,
    obter: obter,
    filtrar: filtrar,
    precoPara: precoPara,
    formatarMoeda: formatarMoeda,
    nomePorte: nomePorte,
    nomeCategoria: nomeCategoria,
    comparativo: comparativo,
  };
})();
