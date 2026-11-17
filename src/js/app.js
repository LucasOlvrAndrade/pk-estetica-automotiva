/**
 * app.js — App
 *
 * "Maestro" da interface: liga os botões e formulários do index.html
 * às funções dos outros arquivos (AppStorage, Servicos, Api, Agenda, Checkin).
 * Os "import" logo abaixo dizem de quais módulos ele depende (antes era a ordem das tags <script>).
 *
 * REGRA DE SEGURANÇA: nenhum dado variável entra na página por innerHTML.
 * Usamos createElement + textContent (ou <template>), que tratam o texto
 * como texto puro — assim um nome com "<script>" nunca vira código.
 *
 * Blocos:
 *  1. Configuração e estado
 *  2. Utilitários (atalhos, criar elementos, debounce)
 *  3. Tema (escuro ⇄ claro)
 *  4. Menu hambúrguer
 *  5. Serviços: filtros, vitrine e preços
 *  6. Tabela comparativa
 *  7. Diálogo de detalhes
 *  8. Serviços salvos (favoritos)
 *  9. Diagnóstico (validação e desenho das recomendações)
 * 10. Carro 3D: abertura e carro do topo (o desenho é do carro3d.js)
 * 11. Títulos que se revelam ao rolar
 * 12. Inicialização
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam
 * (eles fazem "import { … } from"). A IIFE continua igual: tudo que está
 * dentro dela é privado, e só o objeto devolvido no "return" é público.
 */

import { AppStorage } from './storage.js';
import { Servicos } from './servicos.js';
import { Carro3D } from './carro3d.js';
import { UI } from './ui.js';
import { Veiculos } from './veiculos.js';
import { Agenda } from './agenda.js';
import { Checkin } from './checkin.js';
import { Acompanhamento } from './acompanhamento.js';
import { Fidelidade } from './fidelidade.js';
import { Historico } from './historico.js';
import { Movimento } from './movimento.js';
import { Rotas } from './rotas.js';

export const App = (function () {
  'use strict';

  /* =====================================================================
   * 1. CONFIGURAÇÃO E ESTADO
   * ===================================================================== */

  /** Tempo de espera da busca: só filtra 300ms depois da última tecla. */
  const ESPERA_BUSCA_MS = 300;

  /**
   * Estado da tela de serviços: o que o usuário escolheu agora.
   * Fica num objeto só para ser fácil de ver (e de mostrar no Console).
   */
  const estado = {
    porte: 'hatch',
    categoria: 'todos',
    busca: '',
    focoAntesDoDialogo: null, // para devolver o foco ao fechar o diálogo
    indoParaAgenda: false, // true quando o diálogo fecha por "Agendar este serviço"
    porteDiagnostico: 'hatch', // porte respondido no diagnóstico (preço do "Ver detalhes")
  };

  /* =====================================================================
   * 2. UTILITÁRIOS
   * Os utilitários comuns (criar elementos, debounce, toasts) moram no
   * ui.js e são usados por todos os módulos. Aqui só ficam atalhos.
   * ===================================================================== */

  const $ = UI.$;
  const criar = UI.criar;
  const debounce = UI.debounce;
  const mostrarToast = UI.toast;

  /**
   * Preço de um serviço já formatado para o porte escolhido na vitrine.
   * @param {string} servicoId
   * @returns {string} Ex.: "R$ 1.750,00".
   */
  function precoFormatado(servicoId) {
    return UI.moeda(Servicos.precoPara(servicoId, estado.porte));
  }

  /* =====================================================================
   * 3. TEMA (escuro ⇄ claro)
   * O script no <head> já aplicou o tema certo antes de desenhar a página;
   * aqui só ligamos o botão e salvamos a escolha.
   * ===================================================================== */

  /**
   * Aplica um tema e atualiza o botão (ícone, aria-label e aria-pressed).
   * @param {'claro'|'escuro'} tema
   * @param {boolean} [suave] true = transição de cores (desligada com "reduzir movimento").
   */
  function aplicarTema(tema, suave) {
    const raiz = document.documentElement;
    if (suave && !UI.movimentoReduzido()) {
      raiz.classList.add('trocando-tema');
      setTimeout(function () {
        raiz.classList.remove('trocando-tema');
      }, 400);
    }
    if (tema === 'claro') raiz.dataset.tema = 'claro';
    else delete raiz.dataset.tema;
    const botao = $('btn-tema');
    if (!botao) return;
    const escuro = tema !== 'claro';
    botao.setAttribute('aria-pressed', String(escuro));
    botao.setAttribute('aria-label', escuro ? 'Tema escuro ligado. Mudar para o tema claro' : 'Tema claro ligado. Mudar para o tema escuro');
    botao.querySelector('span').textContent = escuro ? '☾' : '☀';
  }

  function iniciarTema() {
    const sistemaClaro = window.matchMedia('(prefers-color-scheme: light)');
    aplicarTema(document.documentElement.dataset.tema === 'claro' ? 'claro' : 'escuro');
    $('btn-tema').addEventListener('click', function () {
      const novo = document.documentElement.dataset.tema === 'claro' ? 'escuro' : 'claro';
      aplicarTema(novo, true);
      AppStorage.definirTema(novo);
    });
    // Se a pessoa nunca escolheu, o site acompanha o sistema quando ele muda
    sistemaClaro.addEventListener('change', function (evento) {
      if (!AppStorage.obterTema()) aplicarTema(evento.matches ? 'claro' : 'escuro', true);
    });
  }

  /* =====================================================================
   * 5. SERVIÇOS: FILTROS, VITRINE E PREÇOS
   * ===================================================================== */

  /**
   * Cria os chips de categoria ("Todos" + as categorias do catálogo).
   * São <input type="radio"> de verdade: funcionam com teclado (setas).
   */
  function criarChipsCategoria() {
    const grupo = $('filtro-categorias');
    const opcoes = [['todos', 'Todos']].concat(Object.entries(Servicos.CATEGORIAS));

    opcoes.forEach(function (opcao) {
      const rotulo = criar('label');
      const input = criar('input');
      input.type = 'radio';
      input.name = 'categoria';
      input.value = opcao[0];
      input.checked = opcao[0] === estado.categoria;
      rotulo.append(input, ' ' + opcao[1]);
      grupo.append(rotulo);
    });

    // Um único "ouvinte" no grupo, em vez de um por chip (delegação de eventos)
    grupo.addEventListener('change', function (evento) {
      estado.categoria = evento.target.value;
      renderizarVitrine();
    });
  }

  /**
   * Cria UM card de serviço copiando o <template id="tpl-card-servico">.
   * @param {Object} servico Item do catálogo (Servicos.listar()).
   * @param {number} indice Posição na vitrine (atrasa a animação em cascata).
   * @returns {HTMLElement} O <article> pronto.
   */
  function criarCard(servico, indice) {
    const molde = $('tpl-card-servico');
    // content.cloneNode(true) = cópia completa do molde, com todos os filhos
    const card = molde.content.cloneNode(true).querySelector('.servico-card');
    const idTitulo = 'servico-nome-' + servico.id;

    card.dataset.id = servico.id;
    card.style.setProperty('--i', indice);
    card.setAttribute('aria-labelledby', idTitulo);

    card.querySelector('.servico-icone').textContent = servico.icone;
    card.querySelector('.servico-categoria').textContent = Servicos.nomeCategoria(servico.categoria);
    const titulo = card.querySelector('.servico-nome');
    titulo.id = idTitulo;
    titulo.textContent = servico.nome;
    card.querySelector('.servico-resumo').textContent = servico.resumo;
    card.querySelector('.servico-durabilidade').textContent = 'Durabilidade: ' + servico.durabilidade;

    // Barras: a largura vem da variável CSS --nivel; o texto oculto é para leitor de tela
    ['protecao', 'brilho'].forEach(function (medida) {
      card.querySelector('[data-medidor="' + medida + '"]').style.setProperty('--nivel', servico[medida] + '%');
      card.querySelector('[data-medidor-texto="' + medida + '"]').textContent = servico[medida] + ' de 100';
    });

    // data-preco-id / data-preco-rotulo: marcam o que muda quando o porte muda
    const rotuloPreco = card.querySelector('.servico-preco-rotulo');
    rotuloPreco.dataset.precoRotulo = '';
    rotuloPreco.textContent = 'Preço para ' + Servicos.nomePorte(estado.porte);
    const valor = card.querySelector('.servico-preco-valor');
    valor.dataset.precoId = servico.id;
    valor.textContent = precoFormatado(servico.id);

    // aria-describedby: o leitor de tela lê "Ver detalhes, Vitrificação Cerâmica"
    card.querySelectorAll('button').forEach(function (botao) {
      botao.setAttribute('aria-describedby', idTitulo);
    });
    card.querySelector('[data-acao="salvar"]').setAttribute('aria-pressed', String(AppStorage.estaSalvo(servico.id)));

    return card;
  }

  /**
   * Desenha a vitrine de acordo com o estado (categoria + busca).
   * Também atualiza a contagem anunciada ao leitor de tela.
   */
  function renderizarVitrine() {
    const vitrine = $('vitrine-servicos');
    const lista = Servicos.filtrar({ categoria: estado.categoria, busca: estado.busca });
    const total = Servicos.listar().length;

    vitrine.replaceChildren(); // apaga os cards antigos

    if (lista.length === 0) {
      const vazio = criar('div', 'vazio');
      const texto = estado.busca
        ? 'Nenhum serviço encontrado para "' + estado.busca + '".'
        : 'Nenhum serviço nesta categoria.';
      vazio.append(criar('p', null, texto));
      const limpar = criar('button', 'btn btn-secundario', 'Limpar filtros');
      limpar.type = 'button';
      limpar.addEventListener('click', limparFiltros);
      vazio.append(limpar);
      vitrine.append(vazio);
    } else {
      lista.forEach(function (servico, indice) {
        vitrine.append(criarCard(servico, indice));
      });
    }

    // A cascata de entrada é para a 1ª vez. Daqui em diante (filtros, busca) o CSS
    // usa só um fade rápido: filtrar é frequente e a cascata deixaria a busca lenta.
    if (vitrine.dataset.jaExibida) {
      vitrine.dataset.filtrada = '';
    }
    vitrine.dataset.jaExibida = 'sim';

    $('servicos-contagem').textContent =
      lista.length === total
        ? total + ' serviços · preços para ' + Servicos.nomePorte(estado.porte)
        : 'Mostrando ' + lista.length + ' de ' + total + ' serviços';
  }

  /**
   * Volta a mostrar todos os serviços (botão "Limpar filtros").
   */
  function limparFiltros() {
    estado.categoria = 'todos';
    estado.busca = '';
    $('servicos-busca').value = '';
    document.querySelector('#filtro-categorias input[value="todos"]').checked = true;
    renderizarVitrine();
    $('servicos-busca').focus();
  }

  /**
   * Troca todos os preços da página para o porte atual, SEM redesenhar os cards
   * (redesenhar repetiria a animação de entrada a cada troca).
   */
  function atualizarPrecos() {
    document.querySelectorAll('[data-preco-id]').forEach(function (elemento) {
      elemento.textContent = precoFormatado(elemento.dataset.precoId);
    });
    document.querySelectorAll('[data-preco-rotulo]').forEach(function (elemento) {
      elemento.textContent = 'Preço para ' + Servicos.nomePorte(estado.porte);
    });
    renderizarComparativo(); // a tabela é pequena: mais simples redesenhar
  }

  /**
   * Liga os filtros: porte, busca (com debounce) e clique nos cards.
   */
  function iniciarServicos() {
    // Porte inicial: o do primeiro veículo cadastrado, se houver
    const veiculos = AppStorage.listarVeiculos();
    if (veiculos.length && Servicos.PORTES[veiculos[0].porte]) {
      estado.porte = veiculos[0].porte;
    }
    const seletorPorte = $('servicos-porte');
    seletorPorte.value = estado.porte;
    seletorPorte.addEventListener('change', function () {
      estado.porte = seletorPorte.value;
      atualizarPrecos();
      $('servicos-contagem').textContent = 'Preços atualizados para ' + Servicos.nomePorte(estado.porte) + '.';
    });

    // Busca: o debounce espera a pessoa parar de digitar por 300ms
    const busca = $('servicos-busca');
    busca.addEventListener(
      'input',
      debounce(function () {
        estado.busca = busca.value.trim();
        renderizarVitrine();
      }, ESPERA_BUSCA_MS)
    );

    // Delegação: um ouvinte na vitrine serve para todos os botões de todos os cards
    $('vitrine-servicos').addEventListener('click', function (evento) {
      const botao = evento.target.closest('[data-acao]');
      if (!botao) return;
      const id = botao.closest('.servico-card').dataset.id;
      if (botao.dataset.acao === 'detalhes') abrirDetalhes(id);
      if (botao.dataset.acao === 'salvar') alternarSalvo(id);
    });

    criarChipsCategoria();
    renderizarVitrine();
    renderizarComparativo();
  }

  /* =====================================================================
   * 6. TABELA COMPARATIVA (Cera × Selante × Vitrificação × PPF)
   * ===================================================================== */

  /**
   * Converte um nível 0–100 em palavra (a cor/barra nunca é a única informação).
   * @param {number} valor
   * @returns {string}
   */
  function nivelEmTexto(valor) {
    if (valor >= 85) return 'Muito alta';
    if (valor >= 60) return 'Alta';
    if (valor >= 35) return 'Média';
    return 'Baixa';
  }

  /**
   * Cria uma célula <td> com rótulo para o modo "cards" do celular.
   * @param {string} rotulo Texto mostrado antes do valor no celular (data-rotulo).
   * @param {string|Node} conteudo Texto ou elemento.
   * @param {string} [classe]
   * @returns {HTMLTableCellElement}
   */
  function celula(rotulo, conteudo, classe) {
    const td = criar('td', classe);
    td.dataset.rotulo = rotulo;
    td.append(conteudo);
    return td;
  }

  /**
   * Conteúdo de célula de nível: palavra + mini barra.
   * @param {number} valor 0–100.
   * @returns {HTMLElement}
   */
  function conteudoNivel(valor) {
    const caixa = criar('span', 'nivel');
    caixa.append(criar('span', null, nivelEmTexto(valor)));
    const barra = criar('span', 'nivel-barra');
    barra.setAttribute('aria-hidden', 'true');
    barra.style.setProperty('--nivel', valor + '%');
    caixa.append(barra);
    return caixa;
  }

  /**
   * Desenha as linhas da tabela comparativa com o preço do porte atual.
   */
  function renderizarComparativo() {
    const tbody = $('tabela-comparativa').tBodies[0];
    const rotuloPreco = 'Preço (' + Servicos.nomePorte(estado.porte) + ')';
    $('comparativo-th-preco').textContent = rotuloPreco;

    tbody.replaceChildren();
    Servicos.comparativo().forEach(function (servico) {
      const linha = criar('tr');
      const nome = criar('th', null, servico.nome);
      nome.scope = 'row'; // cabeçalho da LINHA: o leitor de tela associa as células a ele
      linha.append(
        nome,
        celula('Durabilidade', servico.durabilidade),
        celula('Proteção', conteudoNivel(servico.protecao)),
        celula('Brilho', conteudoNivel(servico.brilho)),
        celula('Tempo de execução', servico.tempoExecucao),
        celula(rotuloPreco, precoFormatado(servico.id), 'num'),
        celula('Indicado para', servico.indicadoPara)
      );
      tbody.append(linha);
    });
  }

  /* =====================================================================
   * 7. DIÁLOGO DE DETALHES
   * ===================================================================== */

  /**
   * Troca os itens de uma lista (<ul> ou <ol>) por novos <li>.
   * @param {HTMLElement} lista
   * @param {string[]} itens
   */
  function preencherLista(lista, itens) {
    lista.replaceChildren();
    itens.forEach(function (texto) {
      lista.append(criar('li', null, texto));
    });
  }

  /**
   * Abre o <dialog> com todos os detalhes de um serviço (ou pacote).
   * @param {string} id Id do serviço.
   * @param {string} [porte] Porte para o preço. Padrão: o porte escolhido na vitrine.
   *   O diagnóstico passa o porte que a pessoa respondeu lá.
   */
  function abrirDetalhes(id, porte) {
    const servico = Servicos.obter(id);
    const dialogo = $('dialog-servico');
    if (!servico || !dialogo) return;
    const portePreco = porte || estado.porte;

    estado.focoAntesDoDialogo = document.activeElement;
    dialogo.dataset.servicoId = id;

    $('detalhe-icone').textContent = servico.icone;
    $('detalhe-categoria').textContent = Servicos.nomeCategoria(servico.categoria);
    $('detalhe-titulo').textContent = servico.nome;
    $('detalhe-descricao').textContent = servico.descricao;
    $('detalhe-preco-rotulo').textContent = 'Preço para ' + Servicos.nomePorte(portePreco);
    $('detalhe-preco-rotulo').dataset.precoRotulo = '';
    $('detalhe-preco-valor').dataset.precoId = id;
    $('detalhe-preco-valor').textContent = Servicos.formatarMoeda(Servicos.precoPara(id, portePreco));
    $('detalhe-tecnica').textContent = servico.tecnica;
    preencherLista($('detalhe-produtos'), servico.produtos);
    preencherLista($('detalhe-etapas'), servico.etapas);
    $('detalhe-durabilidade').textContent = servico.durabilidade;
    preencherLista($('detalhe-cuidados'), servico.cuidados);

    // showModal(): abre por cima de tudo, prende o foco dentro e fecha com Esc
    dialogo.showModal();
    dialogo.scrollTop = 0;
  }

  /**
   * Leva ao formulário de agendamento com o serviço já escolhido.
   * @param {string} id Id do serviço.
   */
  function agendarServico(id) {
    const servico = Servicos.obter(id);
    const seletor = $('agendar-servico');
    if (!servico || !seletor) return;

    seletor.value = id;
    // Avisa quem estiver "ouvindo" o select (a agenda vai recalcular o resumo)
    seletor.dispatchEvent(new Event('change', { bubbles: true }));

    Rotas.ir('agendar'); // abre a página Agendar com o serviço já escolhido
    // O próximo campo a preencher é o veículo; preventScroll evita um "pulo" extra
    $('agendar-veiculo').focus({ preventScroll: true });
    mostrarToast('"' + servico.nome + '" selecionado. Agora escolha o veículo e a data.', { tipo: 'info' });
  }

  /**
   * Liga os eventos do diálogo: clique no fundo, botão Agendar e foco ao fechar.
   */
  function iniciarDialogoDetalhes() {
    const dialogo = $('dialog-servico');
    if (!dialogo) return;

    // Clique no fundo escuro: o alvo é o próprio <dialog> (o conteúdo fica no .dialog-conteudo)
    dialogo.addEventListener('click', function (evento) {
      if (evento.target === dialogo) dialogo.close();
    });

    $('btn-detalhe-agendar').addEventListener('click', function () {
      // Marca ANTES de fechar: o evento "close" não deve devolver o foco ao card
      estado.indoParaAgenda = true;
      dialogo.close();
      agendarServico(dialogo.dataset.servicoId);
    });

    // Ao fechar, o foco volta ao botão que abriu (exceto quando fomos para a agenda)
    dialogo.addEventListener('close', function () {
      const anterior = estado.focoAntesDoDialogo;
      if (!estado.indoParaAgenda && anterior && anterior.isConnected) {
        anterior.focus();
      }
      estado.indoParaAgenda = false;
      estado.focoAntesDoDialogo = null;
    });
  }

  /**
   * Preenche o <select> de serviços do formulário de agendamento.
   * <optgroup> separa "Serviços" de "Pacotes" (os pacotes vêm do diagnóstico).
   */
  function preencherSelectAgendamento() {
    const seletor = $('agendar-servico');
    if (!seletor || seletor.options.length > 1) return; // já preenchido
    [
      ['Serviços', Servicos.listar()],
      ['Pacotes', Servicos.listarPacotes()],
    ].forEach(function (grupo) {
      const optgroup = criar('optgroup');
      optgroup.label = grupo[0];
      grupo[1].forEach(function (servico) {
        const opcao = criar('option', null, servico.nome);
        opcao.value = servico.id;
        optgroup.append(opcao);
      });
      seletor.append(optgroup);
    });
  }

  /* =====================================================================
   * 8. SERVIÇOS SALVOS (favoritos)
   * ===================================================================== */

  /**
   * Salva ou remove um serviço dos salvos e oferece "Desfazer" por 5 segundos.
   * @param {string} id Id do serviço.
   */
  function alternarSalvo(id) {
    const servico = Servicos.obter(id);
    if (!servico) return;

    let ficouSalvo;
    try {
      ficouSalvo = AppStorage.alternarSalvo(id);
    } catch (erro) {
      mostrarToast(erro.message, { tipo: 'erro' });
      return;
    }
    atualizarSalvosNaTela();

    mostrarToast((ficouSalvo ? 'Serviço salvo: ' : 'Removido dos salvos: ') + servico.nome, {
      tipo: ficouSalvo ? 'sucesso' : 'info',
      acao: {
        rotulo: 'Desfazer',
        aoClicar: function () {
          // Só desfaz se nada mudou nesse meio-tempo
          if (AppStorage.estaSalvo(id) === ficouSalvo) {
            AppStorage.alternarSalvo(id);
            atualizarSalvosNaTela();
          }
        },
      },
    });
  }

  /**
   * Sincroniza a tela com os salvos: botões dos cards (aria-pressed) e a lista do histórico.
   */
  function atualizarSalvosNaTela() {
    document.querySelectorAll('#vitrine-servicos .servico-card').forEach(function (card) {
      card.querySelector('[data-acao="salvar"]').setAttribute('aria-pressed', String(AppStorage.estaSalvo(card.dataset.id)));
    });
    // Botões "Salvar" das recomendações do diagnóstico
    document.querySelectorAll('#diagnostico-resultado .recomendacao').forEach(function (card) {
      card.querySelector('[data-acao="salvar"]').setAttribute('aria-pressed', String(AppStorage.estaSalvo(card.dataset.id)));
    });
    renderizarSalvos();
  }

  /**
   * Desenha a lista "Serviços salvos" em #historico (ou o estado vazio).
   */
  function renderizarSalvos() {
    const lista = $('lista-salvos');
    const ids = AppStorage.listarSalvos().filter(function (id) {
      return Servicos.obter(id) !== null; // ignora ids que não existem mais no catálogo
    });

    lista.replaceChildren();
    $('salvos-vazio').hidden = ids.length > 0;

    ids.forEach(function (id) {
      const servico = Servicos.obter(id);
      const item = criar('li');
      item.dataset.id = id;

      const info = criar('div', 'salvo-info');
      info.append(criar('strong', null, servico.nome));
      const preco = criar('span', 'texto-suave num', precoFormatado(id));
      preco.dataset.precoId = id;
      info.append(preco);

      const acoes = criar('div', 'salvo-acoes');
      const verDetalhes = criar('button', 'btn btn-secundario', 'Ver detalhes');
      verDetalhes.type = 'button';
      verDetalhes.dataset.acao = 'detalhes';
      verDetalhes.setAttribute('aria-label', 'Ver detalhes de ' + servico.nome);
      const remover = criar('button', 'btn btn-secundario', 'Remover');
      remover.type = 'button';
      remover.dataset.acao = 'remover';
      remover.setAttribute('aria-label', 'Remover ' + servico.nome + ' dos salvos');
      acoes.append(verDetalhes, remover);

      item.append(info, acoes);
      lista.append(item);
    });
  }

  /**
   * Liga os botões da lista de salvos (delegação de eventos).
   */
  function iniciarSalvos() {
    $('lista-salvos').addEventListener('click', function (evento) {
      const botao = evento.target.closest('[data-acao]');
      if (!botao) return;
      const id = botao.closest('li').dataset.id;

      if (botao.dataset.acao === 'detalhes') {
        abrirDetalhes(id);
      }
      if (botao.dataset.acao === 'remover') {
        alternarSalvo(id);
        // O botão clicado sumiu: leva o foco para o título da lista, para não "se perder"
        $('salvos-titulo').focus();
      }
    });
    renderizarSalvos();
  }

  /* =====================================================================
   * 9. DIAGNÓSTICO
   * A lógica (filtrar, pontuar e explicar) fica em Servicos.recomendar,
   * uma função pura. Aqui fica só o que mexe na tela: ler o formulário,
   * mostrar erros e desenhar as recomendações.
   * ===================================================================== */

  /**
   * Lê a resposta marcada em cada pergunta.
   * form.elements['porte'] é a lista de rádios com name="porte";
   * o .value dela é o value do rádio marcado ('' se nenhum).
   * @param {HTMLFormElement} form
   * @returns {Object} Ex.: { porte: 'seda', pintura: '', ... }.
   */
  function lerRespostasDiagnostico(form) {
    const respostas = {};
    Servicos.PERGUNTAS.forEach(function (pergunta) {
      respostas[pergunta.campo] = form.elements[pergunta.campo].value;
    });
    return respostas;
  }

  /**
   * Marca no formulário as respostas de um diagnóstico salvo.
   * Atribuir .value à lista de rádios marca o rádio com aquele value.
   * @param {HTMLFormElement} form
   * @param {Object} respostas
   */
  function preencherFormularioDiagnostico(form, respostas) {
    Servicos.PERGUNTAS.forEach(function (pergunta) {
      form.elements[pergunta.campo].value = respostas[pergunta.campo] || '';
    });
  }

  /**
   * Mostra (ou apaga) o erro de UMA pergunta.
   * aria-invalid diz ao leitor de tela que a resposta está errada;
   * aria-describedby faz ele ler a mensagem junto com a opção focada.
   * @param {HTMLFormElement} form
   * @param {string} campo Ex.: 'pintura'.
   * @param {string} [mensagem] Vazio = sem erro.
   */
  function marcarErroDiagnostico(form, campo, mensagem) {
    const aviso = $('erro-' + campo);
    const invalido = Boolean(mensagem);
    aviso.textContent = mensagem || '';
    aviso.hidden = !invalido;
    form.querySelectorAll('input[name="' + campo + '"]').forEach(function (input) {
      if (invalido) {
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', aviso.id);
      } else {
        input.removeAttribute('aria-invalid');
        input.removeAttribute('aria-describedby');
      }
    });
  }

  /**
   * Valida todas as perguntas, marca os erros e põe o foco na primeira inválida.
   * @param {HTMLFormElement} form
   * @param {Object} respostas
   * @returns {boolean} true se está tudo respondido.
   */
  function validarFormularioDiagnostico(form, respostas) {
    const erros = Servicos.validarRespostas(respostas);
    const invalidos = erros.map(function (erro) {
      return erro.campo;
    });

    Servicos.PERGUNTAS.forEach(function (pergunta) {
      const comErro = invalidos.indexOf(pergunta.campo) !== -1;
      marcarErroDiagnostico(form, pergunta.campo, comErro ? pergunta.mensagem : '');
    });

    if (erros.length) {
      // Foco no 1º rádio da 1ª pergunta sem resposta: o leitor de tela lê a pergunta e o erro
      form.querySelector('input[name="' + erros[0].campo + '"]').focus();
      return false;
    }
    return true;
  }

  /**
   * Cria um par <dt>/<dd> para a lista de dados do card.
   * @param {HTMLElement} lista O <dl>.
   * @param {string} termo
   * @param {string|Node} valor
   */
  function adicionarDado(lista, termo, valor) {
    const grupo = criar('div');
    const dd = criar('dd');
    dd.append(valor);
    grupo.append(criar('dt', null, termo), dd);
    lista.append(grupo);
  }

  /**
   * Cria o card de UMA recomendação.
   * @param {Object} recomendacao Item de Servicos.recomendar().recomendacoes.
   * @param {number} posicao 0 = a mais indicada.
   * @param {string} porte Porte respondido no diagnóstico.
   * @returns {HTMLElement} O <li> pronto.
   */
  function criarCardRecomendacao(recomendacao, posicao, porte) {
    const servico = recomendacao.servico;
    const idTitulo = 'recomendacao-nome-' + servico.id;

    const item = criar('li');
    const card = criar('article', 'recomendacao' + (posicao === 0 ? ' recomendacao--destaque' : ''));
    card.dataset.id = servico.id;
    card.setAttribute('aria-labelledby', idTitulo);
    card.style.setProperty('--i', posicao); // entrada em cascata (mesma animação dos cards de serviço)

    // Cabeçalho: ícone, categoria, nome e o selo da 1ª opção
    const cabecalho = criar('div', 'recomendacao-cabecalho');
    const icone = criar('span', 'servico-icone', servico.icone);
    icone.setAttribute('aria-hidden', 'true');
    const textos = criar('div');
    textos.append(criar('p', 'servico-categoria', (posicao + 1) + 'ª opção · ' + Servicos.nomeCategoria(servico.categoria)));
    const titulo = criar('h4', 'recomendacao-nome', servico.nome);
    titulo.id = idTitulo;
    textos.append(titulo);
    cabecalho.append(icone, textos);
    if (posicao === 0) cabecalho.append(criar('span', 'selo', 'Mais indicado'));
    card.append(cabecalho);

    card.append(criar('p', 'recomendacao-motivo', recomendacao.motivo));

    // Pacote: mostra o que vem dentro, na ordem em que é feito
    if (servico.itens) {
      const nomes = servico.itens.map(function (id) {
        return Servicos.obter(id).nome;
      });
      card.append(criar('p', 'recomendacao-inclui', 'Inclui, nesta ordem: ' + nomes.join(' → ')));
    }

    // Dados: preço para o porte, tempo e durabilidade
    const dados = criar('dl', 'recomendacao-dados');
    const preco = criar('span', 'num', Servicos.formatarMoeda(recomendacao.preco));
    const conteudoPreco = document.createDocumentFragment();
    conteudoPreco.append(preco);
    if (recomendacao.acimaDoOrcamento) {
      conteudoPreco.append(' ', criar('span', 'etiqueta-alerta', 'acima do seu orçamento'));
    }
    adicionarDado(dados, 'Preço (' + Servicos.nomePorte(porte) + ')', conteudoPreco);
    adicionarDado(dados, 'Tempo', servico.tempoExecucao);
    adicionarDado(dados, 'Durabilidade', servico.durabilidade);
    card.append(dados);

    // Ações
    const acoes = criar('div', 'servico-acoes');
    [
      ['detalhes', 'Ver detalhes', 'btn btn-secundario'],
      ['salvar', 'Salvar', 'btn btn-secundario btn-salvar'],
      ['agendar', 'Agendar', 'btn btn-primario'],
    ].forEach(function (definicao) {
      const botao = criar('button', definicao[2], definicao[1]);
      botao.type = 'button';
      botao.dataset.acao = definicao[0];
      botao.setAttribute('aria-describedby', idTitulo); // "Agendar, Correção + Vitrificação"
      if (definicao[0] === 'salvar') {
        botao.setAttribute('aria-pressed', String(AppStorage.estaSalvo(servico.id)));
      }
      acoes.append(botao);
    });
    card.append(acoes);

    item.append(card);
    return item;
  }

  /**
   * Desenha o resultado do diagnóstico em #diagnostico-resultado.
   * @param {Object} respostas As 5 respostas.
   * @param {Object} resultado Retorno de Servicos.recomendar(respostas).
   * @param {string} [feitoEm] Data ISO, quando o resultado veio do LocalStorage.
   */
  function renderizarDiagnostico(respostas, resultado, feitoEm) {
    const caixa = $('diagnostico-resultado');
    estado.porteDiagnostico = respostas.porte;
    caixa.replaceChildren();

    // tabindex="-1": o título pode receber foco pelo JS, mas não entra no Tab
    const titulo = criar('h3', 'resultado-titulo', 'Recomendado para você');
    titulo.id = 'diagnostico-resultado-titulo';
    titulo.tabIndex = -1;
    caixa.append(titulo);

    // Resumo das respostas: a pessoa confere em que o resultado se baseou
    const resumo = Servicos.PERGUNTAS.map(function (pergunta) {
      return Servicos.rotuloResposta(pergunta.campo, respostas[pergunta.campo]);
    }).join(' · ');
    caixa.append(criar('p', 'resultado-resumo', resumo));

    if (feitoEm) {
      const data = new Date(feitoEm);
      if (!isNaN(data.getTime())) {
        caixa.append(
          criar(
            'p',
            'dica',
            'Seu último diagnóstico, de ' + data.toLocaleDateString('pt-BR') + '. Mude as respostas para refazer.'
          )
        );
      }
    }

    resultado.avisos.forEach(function (texto) {
      const aviso = criar('p', 'aviso-diagnostico');
      const icone = criar('span', null, '⚠');
      icone.setAttribute('aria-hidden', 'true');
      aviso.append(icone, criar('span', null, texto));
      caixa.append(aviso);
    });

    const lista = criar('ol', 'recomendacoes');
    lista.setAttribute('aria-label', 'Recomendações, da mais indicada para a menos indicada');
    resultado.recomendacoes.forEach(function (recomendacao, posicao) {
      lista.append(criarCardRecomendacao(recomendacao, posicao, respostas.porte));
    });
    caixa.append(lista);
  }

  /**
   * Liga o formulário do diagnóstico: validação, envio, botões do resultado
   * e reabertura do último diagnóstico salvo.
   */
  function iniciarDiagnostico() {
    const form = $('form-diagnostico');
    const caixa = $('diagnostico-resultado');
    if (!form || !caixa) return;

    // Ao escolher uma opção, apaga o erro daquela pergunta
    form.addEventListener('change', function (evento) {
      const campo = evento.target.name;
      if (evento.target.getAttribute('aria-invalid') === 'true') {
        marcarErroDiagnostico(form, campo, '');
      }
    });

    form.addEventListener('submit', function (evento) {
      evento.preventDefault(); // sem isso a página recarregaria
      const respostas = lerRespostasDiagnostico(form);
      if (!validarFormularioDiagnostico(form, respostas)) return;

      const resultado = Servicos.recomendar(respostas);
      try {
        AppStorage.salvarDiagnostico({
          respostas: respostas,
          recomendados: resultado.recomendacoes.map(function (r) {
            return r.servico.id;
          }),
        });
      } catch (erro) {
        // Não salvar não impede de mostrar o resultado
        mostrarToast(erro.message, { tipo: 'erro' });
      }

      renderizarDiagnostico(respostas, resultado);
      // Leva o foco (e a rolagem) ao resultado: no celular ele fica embaixo do formulário
      $('diagnostico-resultado-titulo').focus();
    });

    // Delegação: um ouvinte para os botões de todos os cards de recomendação
    caixa.addEventListener('click', function (evento) {
      const botao = evento.target.closest('[data-acao]');
      if (!botao) return;
      const id = botao.closest('.recomendacao').dataset.id;
      if (botao.dataset.acao === 'detalhes') abrirDetalhes(id, estado.porteDiagnostico);
      if (botao.dataset.acao === 'salvar') alternarSalvo(id);
      if (botao.dataset.acao === 'agendar') agendarServico(id);
    });

    // Reabre o último diagnóstico (só se as respostas salvas ainda forem válidas)
    const salvo = AppStorage.obterDiagnostico();
    if (salvo && salvo.respostas && Servicos.validarRespostas(salvo.respostas).length === 0) {
      preencherFormularioDiagnostico(form, salvo.respostas);
      renderizarDiagnostico(salvo.respostas, Servicos.recomendar(salvo.respostas), salvo.feitoEm);
    } else {
      // Sem diagnóstico salvo: já marca o porte do 1º veículo cadastrado, se houver
      const veiculos = AppStorage.listarVeiculos();
      if (veiculos.length && Servicos.PORTES[veiculos[0].porte]) {
        form.elements.porte.value = veiculos[0].porte;
      }
    }
  }

  /* =====================================================================
   * 10. CARRO 3D: ABERTURA E CARRO DO TOPO
   * O Carro3D (carro3d.js) só sabe DESENHAR. Aqui fica o "quando e quanto":
   * a linha do tempo da abertura e a interação com o carro do topo.
   * ===================================================================== */

  /** Pessoas que pediram "reduzir movimento" no sistema: sem abertura, sem giro sozinho. */
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** A abertura roda uma vez por sessão (fechou a aba, vê de novo na próxima visita). */
  const CHAVE_ABERTURA = 'pk:abertura-vista';
  const DURACAO_ABERTURA_MS = 3300;
  const SUBIDA_PORTA_MS = 900; // igual à transição de .abertura no CSS

  /** Rotação em que o VTEC "entra" (o comando de válvulas muda para o perfil bravo). */
  const RPM_VTEC = 5500;
  const RPM_MAXIMA = 8000; // fim da escala do conta-giros

  /**
   * Roteiro do motor na abertura, como uma tabela: em cada trecho de tempo,
   * a marcha engatada e a rotação no começo e no fim do trecho.
   * As quedas de rotação entre as marchas são as TROCAS do câmbio manual.
   */
  const ROTEIRO_MOTOR = [
    { ate: 0.45, marcha: 'N', de: 0, para: 0 }, // desligado
    { ate: 0.7, marcha: 'N', de: 0, para: 950 }, // partida
    { ate: 0.9, marcha: 'N', de: 950, para: 900 }, // marcha lenta
    { ate: 1.5, marcha: '1', de: 1400, para: 7200 }, // 1ª esticada
    { ate: 1.62, marcha: '2', de: 7200, para: 4700 }, // troca: embreagem, a rotação cai
    { ate: 2.25, marcha: '2', de: 4700, para: 7600 }, // 2ª
    { ate: 2.37, marcha: '3', de: 7600, para: 5300 }, // troca
    { ate: 9, marcha: '3', de: 5300, para: 7900 }, // 3ª até o fim
  ];

  /**
   * Marcha e rotação num instante da abertura (função pura: só usa o tempo).
   * @param {number} segundos
   * @returns {{marcha: string, rpm: number}}
   */
  function motorNaAbertura(segundos) {
    let inicioDoTrecho = 0;
    for (let i = 0; i < ROTEIRO_MOTOR.length; i++) {
      const trecho = ROTEIRO_MOTOR[i];
      if (segundos < trecho.ate || i === ROTEIRO_MOTOR.length - 1) {
        const duracao = Math.min(trecho.ate, 3.3) - inicioDoTrecho;
        const t = Math.max(0, Math.min(1, (segundos - inicioDoTrecho) / duracao));
        return { marcha: trecho.marcha, rpm: trecho.de + (trecho.para - trecho.de) * t };
      }
      inicioDoTrecho = trecho.ate;
    }
    return { marcha: 'N', rpm: 0 };
  }

  /** Formata a rotação de 100 em 100, com ponto de milhar (ex.: 7.200). */
  const formatoRpm = new Intl.NumberFormat('pt-BR');

  /** Pose em que o carro do topo começa: igual à pose final da abertura. */
  const GIRO_INICIAL = 0.55;

  /**
   * A abertura já foi vista nesta sessão?
   * sessionStorage é uma preferência de tela (não é dado do app), por isso não passa pelo AppStorage.
   * @returns {boolean}
   */
  function aberturaJaVista() {
    try {
      return sessionStorage.getItem(CHAVE_ABERTURA) === 'sim';
    } catch (erro) {
      return false; // navegador bloqueou o armazenamento: mostra a abertura
    }
  }

  function marcarAberturaVista() {
    try {
      sessionStorage.setItem(CHAVE_ABERTURA, 'sim');
    } catch (erro) {
      // sem armazenamento: tudo bem, só vai mostrar de novo na próxima visita
    }
  }

  /** Cor escolhida nas amostras do topo (ou o Preto Ônix, a cor da identidade Black Chrome). */
  function corDoCarro() {
    const marcada = document.querySelector('input[name="cor-carro"]:checked');
    return marcada ? marcada.value : '#1c1d22';
  }

  /**
   * Faróis "dando partida": apagados, piscam e acendem de vez.
   * @param {number} segundos Tempo desde o começo da abertura.
   * @returns {number} 0 (apagado) a 1 (aceso).
   */
  function faroisNaPartida(segundos) {
    if (segundos < 0.45) return 0;
    if (segundos < 0.55) return 1;
    if (segundos < 0.68) return 0.15;
    return 1;
  }

  /**
   * Entrada do texto do topo: as linhas do título sobem de dentro da "máscara".
   * Só mexe em classes; quem anima é o CSS (.hero--preparar).
   */
  function revelarHero() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    if (movimentoReduzido.matches) {
      hero.classList.remove('hero--preparar');
      return;
    }
    hero.classList.add('hero--preparar');
    // Dois quadros: o navegador precisa DESENHAR o estado escondido antes de animar a volta
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        hero.classList.remove('hero--preparar');
        hero.classList.add('hero--revelado'); // dispara a luz correndo no título cromado
      });
    });
  }

  /** Duração da abertura em 3D (a de 2D é DURACAO_ABERTURA_MS). */
  const DURACAO_3D_MS = 6200;
  const LIMITE_CARREGAMENTO_MS = 12000; // passou disso, usa o carro em 2D

  /**
   * O aparelho aguenta a cena 3D? (sem WebGL, com economia de dados, conexão lenta
   * ou pouca memória/processador, usa o carro em Canvas 2D, que é leve).
   * @returns {boolean}
   */
  function aparelhoAguenta3D() {
    // Celular e tablet (só toque, sem mouse): carro em 2D. A cena 3D (shaders, bloom, Draco)
    // trava o processador do celular por segundos e derruba a nota de desempenho (Lighthouse).
    if (!window.matchMedia('(pointer: fine)').matches) return false;
    const conexao = navigator.connection;
    if (conexao && (conexao.saveData || /(^|-)2g|3g/.test(conexao.effectiveType || ''))) return false;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return false;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
    try {
      const teste = document.createElement('canvas');
      return Boolean(teste.getContext('webgl2') || teste.getContext('webgl'));
    } catch (erro) {
      return false;
    }
  }

  /** Rejeita a promessa se ela demorar mais que `ms`. */
  function comTempoLimite(promessa, ms) {
    return Promise.race([
      promessa,
      new Promise(function (_, rejeitar) {
        setTimeout(function () {
          rejeitar(new Error('tempo esgotado'));
        }, ms);
      }),
    ]);
  }

  /**
   * Cena 2D (Canvas 2D, carro3d.js) com a mesma "interface" da cena 3D:
   * quadro(segundos, estado) e destruir().
   */
  function criarCena2D() {
    const carro = Carro3D.criar($('carro-abertura'), { cor: corDoCarro() });
    carro.estado.centroVertical = 0.42; // carro mais alto: a marca PK fica embaixo dele
    return {
      quadro: function (segundos, estado) {
        const p = Carro3D.suavizar(Math.min(1, segundos / 2.6));
        carro.estado.giro = 2.3 + (GIRO_INICIAL - 2.3) * p; // de frente → 3/4
        carro.estado.distancia = 13 + (8.2 - 13) * p;
        carro.estado.inclinacao = 0.06 + (0.26 - 0.06) * p;
        carro.estado.farois = estado.farois;
        carro.estado.alturaAlvo = 0.66 + Math.sin(segundos * 95) * estado.tremor;
        carro.desenhar();
      },
      destruir: carro.destruir,
    };
  }

  /**
   * Abertura: o carro surge no escuro, dá a partida (faróis + painel de marchas e VTEC),
   * a marca PK aparece e a "porta de garagem" sobe revelando o site.
   * No computador, a cena Three.js com o modelo 3D; celular, tablet e aparelhos que não
   * aguentam usam o carro em Canvas 2D.
   * Pode ser pulada a qualquer momento (botão, Esc, roda do mouse ou toque).
   * @param {boolean} [forcar] true = mostrar mesmo que já tenha sido vista (botão "Rever").
   */
  async function iniciarAbertura(forcar) {
    const abertura = $('abertura');
    const hero = document.querySelector('.hero');
    if (!abertura || !hero) {
      if (abertura) abertura.hidden = true;
      return;
    }

    const deveRodar = !movimentoReduzido.matches && (forcar || !aberturaJaVista());
    if (!deveRodar) {
      abertura.hidden = true;
      if (forcar) {
        mostrarToast('A abertura está desligada porque seu sistema pede menos movimento.', { tipo: 'info' });
      } else {
        revelarHero();
      }
      return;
    }

    abertura.hidden = false;
    abertura.style.animation = 'none'; // o JS assumiu: desliga a rede de segurança do CSS
    abertura.classList.remove('abertura--saindo', 'abertura--marca', 'abertura--ligada');
    document.documentElement.classList.add('abertura-ativa');
    hero.classList.add('hero--preparar'); // o topo espera escondido atrás da "porta"

    let cena = null;
    let canvas3d = null;
    let quadro = 0;
    let encerrada = false;
    let duracaoMs = DURACAO_ABERTURA_MS;

    // Painel do motor
    const painelMarcha = $('painel-marcha');
    const painelBarra = $('painel-rpm-barra');
    const painelNumero = $('painel-rpm-numero');
    const painelVtec = $('painel-vtec');
    painelVtec.classList.remove('acesa');

    /** Atualiza marcha, conta-giros e luz VTEC (só mexe no DOM quando o valor muda). */
    function atualizarPainel(motor) {
      const rotulo = motor.marcha === 'N' ? 'N' : motor.marcha + 'ª';
      if (painelMarcha.textContent !== rotulo) painelMarcha.textContent = rotulo;
      painelBarra.style.transform = 'scaleX(' + Math.min(1, motor.rpm / RPM_MAXIMA) + ')';
      painelNumero.textContent = formatoRpm.format(Math.round(motor.rpm / 100) * 100);
      painelVtec.classList.toggle('acesa', motor.rpm >= RPM_VTEC);
    }

    /** Sobe a porta, libera a página e limpa tudo (canvas, cena 3D, memória). */
    function encerrar() {
      if (encerrada) return;
      encerrada = true;
      cancelAnimationFrame(quadro);
      marcarAberturaVista();
      abertura.classList.add('abertura--saindo');
      document.documentElement.classList.remove('abertura-ativa');
      hero.classList.remove('hero--preparar'); // o topo entra enquanto a porta sobe
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('wheel', encerrar);
      window.removeEventListener('touchmove', encerrar);
      setTimeout(function () {
        abertura.hidden = true;
        abertura.classList.remove('abertura--saindo', 'abertura--marca', 'abertura--ligada', 'abertura--carregando');
        if (cena) cena.destruir();
        if (canvas3d) canvas3d.remove();
      }, SUBIDA_PORTA_MS);
    }

    function aoTeclar(evento) {
      if (evento.key === 'Escape') encerrar();
    }

    // Pular funciona desde o primeiro instante, inclusive durante o carregamento do 3D
    $('btn-pular-abertura').onclick = encerrar;
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('wheel', encerrar, { passive: true });
    window.addEventListener('touchmove', encerrar, { passive: true });

    // Cena 3D (Three.js) só se o aparelho aguenta; senão, o carro em Canvas 2D (mais leve)
    if (aparelhoAguenta3D()) {
      abertura.classList.add('abertura--carregando');
      const barra = $('abertura-progresso-barra');
      const texto = $('abertura-progresso-texto');
      function progresso(fracao) {
        barra.style.transform = 'scaleX(' + fracao + ')';
        texto.textContent = Math.round(fracao * 100) + '%';
      }
      progresso(0);
      canvas3d = criar('canvas', 'carro-canvas carro-canvas--3d');
      canvas3d.setAttribute('aria-hidden', 'true');
      abertura.insertBefore(canvas3d, abertura.firstChild);
      try {
        const modulo = await comTempoLimite(import('./intro3d.js'), LIMITE_CARREGAMENTO_MS);
        if (!encerrada) {
          cena = await comTempoLimite(
            modulo.Intro3D.criar(canvas3d, { aoProgresso: progresso, celular: window.matchMedia('(pointer: coarse)').matches }),
            LIMITE_CARREGAMENTO_MS
          );
          duracaoMs = DURACAO_3D_MS;
          $('carro-abertura').hidden = true; // o canvas 2D fica de lado
        }
      } catch (erro) {
        // Sem 3D (rede lenta, erro de WebGL…): segue com o carro em 2D, sem travar a tela
        cena = null;
        canvas3d.remove();
        canvas3d = null;
      }
      abertura.classList.remove('abertura--carregando');
      if (encerrada) {
        if (cena) cena.destruir(); // pularam durante o carregamento
        return;
      }
    }
    if (!cena) {
      $('carro-abertura').hidden = false;
      cena = criarCena2D();
    }

    // O roteiro do motor foi escrito para 3,3 s: na abertura 3D (mais longa) ele é esticado
    const escala = 3.3 / (duracaoMs / 1000);
    const inicio = performance.now();

    /** Um quadro: calcula motor, faróis e tremor pelo tempo e manda a cena desenhar. */
    function animar(agora) {
      const segundos = (agora - inicio) / 1000;
      const motor = motorNaAbertura(segundos * escala);
      // Motor em giro alto faz o carro tremer de leve (e mais forte com o VTEC ligado)
      const tremor = motor.rpm >= RPM_VTEC ? 0.006 : 0.0025 * (motor.rpm / RPM_MAXIMA);
      cena.quadro(segundos, {
        farois: faroisNaPartida(segundos * escala),
        tremor: duracaoMs === DURACAO_3D_MS ? tremor * 2.5 : tremor,
        duracao: duracaoMs / 1000,
      });
      if (segundos * escala > 0.45) abertura.classList.add('abertura--ligada'); // painel acende na partida
      atualizarPainel(motor);
      // A marca PK sobe da máscara (no 3D, só no fim, para não cobrir o carro)
      if (segundos * 1000 > (duracaoMs === DURACAO_3D_MS ? duracaoMs * 0.72 : 1100)) abertura.classList.add('abertura--marca');
      if (segundos * 1000 >= duracaoMs) {
        encerrar();
        return;
      }
      quadro = requestAnimationFrame(animar);
    }
    quadro = requestAnimationFrame(animar);
  }

  /**
   * Carro do topo: gira sozinho devagar, gira ao rolar a página, pode ser
   * arrastado (com inércia) ou girado pelas setas do teclado, e troca de cor.
   */
  function iniciarCarroHero() {
    const canvas = $('carro-hero');
    if (!canvas) return;

    const carro = Carro3D.criar(canvas, { cor: corDoCarro() });
    const VOLTA_POR_SEGUNDO = (Math.PI * 2) / 30; // uma volta a cada 30 s: ambiente, não distrai
    const ATRITO = 0.94; // a cada quadro a inércia perde 6%

    let giroBase = GIRO_INICIAL; // parte do giro que vem do arraste, teclado e giro sozinho
    let velocidade = 0; // inércia depois de soltar o arraste (radianos por quadro)
    let arrastando = false;
    let ultimoX = 0;
    let focado = false;
    let visivel = false;
    let quadro = 0;
    let anterior = 0;

    /** Rolar a página também gira o carro (o movimento responde à pessoa). */
    function giroDaRolagem() {
      return movimentoReduzido.matches ? 0 : window.scrollY * 0.0025;
    }

    function desenharAgora() {
      carro.estado.giro = giroBase + giroDaRolagem();
      carro.desenhar();
    }

    /** Atualiza o "valor" do slider para o leitor de tela (em graus de 0 a 359). */
    function atualizarAria() {
      const graus = Math.round((((carro.estado.giro * 180) / Math.PI) % 360 + 360) % 360);
      canvas.setAttribute('aria-valuenow', String(graus));
      canvas.setAttribute('aria-valuetext', graus + ' graus');
    }

    /** Um quadro: aplica inércia, giro sozinho e desenha. */
    function animar(agora) {
      const segundos = Math.min(0.05, (agora - anterior) / 1000); // limita saltos (aba voltando)
      anterior = agora;
      if (!arrastando) {
        giroBase += velocidade;
        velocidade *= ATRITO;
        if (Math.abs(velocidade) < 0.0005) velocidade = 0;
        // Gira sozinho só quando ninguém está mexendo nele
        if (velocidade === 0 && !focado) giroBase += VOLTA_POR_SEGUNDO * segundos;
      }
      desenharAgora();
      quadro = requestAnimationFrame(animar);
    }

    /** Liga o loop só quando faz sentido: visível, aba aberta e movimento permitido. */
    function atualizarLoop() {
      const deveRodar = visivel && !document.hidden && !movimentoReduzido.matches;
      if (deveRodar && !quadro) {
        anterior = performance.now();
        quadro = requestAnimationFrame(animar);
      } else if (!deveRodar && quadro) {
        cancelAnimationFrame(quadro);
        quadro = 0;
      }
    }

    // Fora da tela, o carro não gasta bateria: o loop para
    new IntersectionObserver(function (entradas) {
      visivel = entradas[0].isIntersecting;
      atualizarLoop();
      if (visivel) desenharAgora();
    }).observe(canvas);
    document.addEventListener('visibilitychange', atualizarLoop);

    // Arrastar (mouse, dedo ou caneta: "pointer" cobre os três)
    canvas.addEventListener('pointerdown', function (evento) {
      if (arrastando) return; // um segundo dedo não "rouba" o arraste
      arrastando = true;
      velocidade = 0;
      ultimoX = evento.clientX;
      canvas.setPointerCapture(evento.pointerId); // continua recebendo mesmo saindo do canvas
    });
    canvas.addEventListener('pointermove', function (evento) {
      if (!arrastando) return;
      const delta = (evento.clientX - ultimoX) * 0.01;
      ultimoX = evento.clientX;
      giroBase += delta;
      velocidade = movimentoReduzido.matches ? 0 : delta; // a última velocidade vira inércia
      if (!quadro) desenharAgora(); // sem loop (movimento reduzido): desenha na hora
    });
    function soltar() {
      arrastando = false;
      atualizarAria();
    }
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar); // ex.: o navegador assumiu a rolagem

    // Teclado: setas giram 15° (45° com Shift). Ação de teclado não é animada: responde na hora.
    canvas.addEventListener('keydown', function (evento) {
      const passo = evento.shiftKey ? Math.PI / 4 : Math.PI / 12;
      if (evento.key === 'ArrowRight' || evento.key === 'ArrowUp') giroBase += passo;
      else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowDown') giroBase -= passo;
      else if (evento.key === 'Home') giroBase = GIRO_INICIAL - giroDaRolagem();
      else return;
      evento.preventDefault(); // as setas não rolam a página enquanto giram o carro
      velocidade = 0;
      desenharAgora();
      atualizarAria();
    });
    canvas.addEventListener('focus', function () {
      focado = true; // parado enquanto alguém usa o teclado nele
      atualizarAria(); // o leitor de tela anuncia o ângulo atual (o giro sozinho mudou o valor)
    });
    canvas.addEventListener('blur', function () {
      focado = false;
    });

    // Rolar a página: com o loop parado (movimento reduzido), nada a fazer
    window.addEventListener(
      'scroll',
      function () {
        if (!quadro && visivel && !movimentoReduzido.matches) desenharAgora();
      },
      { passive: true }
    );

    // Cor da pintura
    document.querySelector('.cores-carro').addEventListener('change', function (evento) {
      carro.definirCor(evento.target.value);
    });

    desenharAgora();
    atualizarAria();
  }

  /* =====================================================================
   * 11. TÍTULOS QUE SE REVELAM AO ROLAR
   * Só os títulos de seção (não "tudo"): a revelação marca o começo de
   * um capítulo. Animar todo bloco que aparece vira enfeite e atrasa a leitura.
   * ===================================================================== */

  /**
   * Embrulha o texto de cada título em uma "máscara" e revela quando entra na tela.
   */
  function iniciarTitulos() {
    if (movimentoReduzido.matches || !('IntersectionObserver' in window)) return;

    const observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          entrada.target.classList.add('revelado');
          observador.unobserve(entrada.target); // revela uma vez só
        });
      },
      { rootMargin: '0px 0px -12% 0px' } // espera o título entrar um pouco na tela
    );

    document.querySelectorAll('.secao > h2').forEach(function (titulo) {
      const mascara = criar('span', 'titulo-mascara');
      const texto = criar('span');
      while (titulo.firstChild) texto.append(titulo.firstChild); // move o texto para dentro
      mascara.append(texto);
      titulo.append(mascara);
      observador.observe(titulo);
    });
  }

  /* =====================================================================
   * 12. INICIALIZAÇÃO
   * ===================================================================== */

  /**
   * Ponto de partida do app: chamado uma vez, quando o HTML terminou de carregar.
   */
  function iniciar() {
    UI.prepararDialogos();
    iniciarTema();
    Rotas.iniciar(); // menu lateral + páginas por hash (#/servicos, #/agendar...)
    preencherSelectAgendamento();
    iniciarServicos();
    iniciarDialogoDetalhes();
    iniciarSalvos();
    iniciarDiagnostico();
    Veiculos.iniciar();
    Agenda.iniciar();
    Checkin.iniciar();
    Acompanhamento.iniciar();
    Fidelidade.iniciar();
    Historico.iniciar();
    iniciarCarroHero();
    iniciarTitulos();
    Movimento.iniciar(); // contadores, antes × depois, cursor, ímã e rolagem suave

    // "Rever a abertura" (rodapé): volta ao topo e roda de novo — útil na apresentação
    const rever = $('btn-rever-abertura');
    if (rever) {
      rever.addEventListener('click', function () {
        Rotas.ir('inicio'); // a abertura termina mostrando o Início
        iniciarAbertura(true);
      });
    }
  }

  // A abertura é decidida JÁ (sem esperar o DOMContentLoaded): este script está no fim
  // do <body>, então o HTML dela já existe. Assim, quem já viu não enxerga nem um "piscar".
  iniciarAbertura(false);

  // DOMContentLoaded = "o HTML inteiro já foi lido"; só então mexemos nos elementos.
  document.addEventListener('DOMContentLoaded', iniciar);

  return {
    iniciar: iniciar,
    mostrarToast: mostrarToast,
    abrirDetalhes: abrirDetalhes,
    reverAbertura: function () {
      iniciarAbertura(true);
    },
    estado: estado, // exposto para inspecionar no Console (F12)
  };
})();
