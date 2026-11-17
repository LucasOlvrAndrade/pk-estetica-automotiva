/**
 * historico.js: Historico
 *
 * Seção #historico:
 *  1. Tabela de serviços (mais recente primeiro) com filtro por veículo e status,
 *     "Ver check-in", "Agendar novamente", "Avaliar" e o lembrete de manutenção.
 *  2. Pesquisa NPS num <dialog> (escala 0 a 10 em radiogroup acessível).
 *  3. Painel de métricas (página Painel), com barras em CSS puro.
 *  4. Dados de demonstração para a apresentação (gerar e limpar).
 *
 * As contas do painel ficam em funções PURAS (calcularMetricas), testáveis no Console.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
import { AppStorage } from './storage.js';
import { Servicos } from './servicos.js';
import { UI } from './ui.js';
import { Checkin } from './checkin.js';
import { Agenda } from './agenda.js';

export const Historico = (function () {
  'use strict';

  const $ = UI.$;
  const S = AppStorage.STATUS;
  const DIAS_MANUTENCAO = 90;
  const META_NPS = 85;
  const META_RECORRENCIA = 40;
  const NOMES_STATUS = {
    agendado: 'Agendado',
    recebido: 'Check-in feito',
    'em-execucao': 'Em lavagem',
    pronto: 'Pronto para retirada',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };
  const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });

  /* =====================================================================
   * 1. REGRAS (funções puras)
   * ===================================================================== */

  /** O serviço (ou pacote) inclui alguma proteção (cera, selante, vitrificação, PPF)? */
  function temProtecao(servico) {
    if (!servico) return false;
    if (servico.categoria === 'protecao') return true;
    return (servico.itens || []).some((id) => Servicos.obter(id).categoria === 'protecao');
  }

  /**
   * Indicadores do painel.
   * @param {Object[]} agendamentos
   * @param {Object[]} avaliacoes
   * @returns {Object}
   */
  function calcularMetricas(agendamentos, avaliacoes) {
    const entregues = agendamentos.filter((a) => a.status === S.ENTREGUE);
    const faturamento = entregues.reduce((s, a) => s + (a.valor || 0), 0);

    // NPS = % de promotores (9 a 10) − % de detratores (0 a 6)
    const promotores = avaliacoes.filter((a) => a.nota >= 9).length;
    const detratores = avaliacoes.filter((a) => a.nota <= 6).length;
    const nps = avaliacoes.length ? Math.round(((promotores - detratores) / avaliacoes.length) * 100) : null;

    // Recorrência = veículos com 2+ serviços entregues ÷ veículos atendidos
    const porVeiculo = {};
    entregues.forEach((a) => (porVeiculo[a.veiculoId] = (porVeiculo[a.veiculoId] || 0) + 1));
    const atendidos = Object.keys(porVeiculo).length;
    const recorrentes = Object.keys(porVeiculo).filter((id) => porVeiculo[id] >= 2).length;
    const recorrencia = atendidos ? Math.round((recorrentes / atendidos) * 100) : null;

    // Ticket médio por mês (últimos 6 meses)
    const meses = [];
    const hoje = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const doMes = entregues.filter((a) => a.data.slice(0, 7) === chave);
      const total = doMes.reduce((s, a) => s + (a.valor || 0), 0);
      meses.push({ rotulo: formatoMes.format(d), ticket: doMes.length ? total / doMes.length : 0, quantidade: doMes.length });
    }

    // Mais vendidos
    const contagem = {};
    entregues.forEach((a) => (contagem[a.servicoId] = (contagem[a.servicoId] || 0) + 1));
    const maisVendidos = Object.keys(contagem)
      .map((id) => ({ nome: (Servicos.obter(id) || { nome: id }).nome, quantidade: contagem[id] }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    // Participação de PPF + Vitrificação no faturamento
    const premium = entregues
      .filter(function (a) {
        const s = Servicos.obter(a.servicoId);
        return s && ['ppf', 'vitrificacao'].some((id) => s.id === id || (s.itens || []).indexOf(id) !== -1);
      })
      .reduce((s, a) => s + (a.valor || 0), 0);

    return {
      entregues: entregues.length,
      faturamento: faturamento,
      ticketMedio: entregues.length ? faturamento / entregues.length : 0,
      nps: nps,
      avaliacoes: avaliacoes.length,
      recorrencia: recorrencia,
      atendidos: atendidos,
      meses: meses,
      maisVendidos: maisVendidos,
      participacaoPremium: faturamento ? Math.round((premium / faturamento) * 100) : 0,
    };
  }

  /* =====================================================================
   * 2. TABELA DE HISTÓRICO
   * ===================================================================== */

  function celula(rotulo, conteudo) {
    const td = UI.criar('td');
    td.dataset.rotulo = rotulo; // no celular a tabela vira cards com esse rótulo
    td.append(conteudo);
    return td;
  }

  function preencherFiltroVeiculos() {
    const select = $('filtro-veiculo');
    const atual = select.value;
    select.replaceChildren(new Option('Todos', ''));
    AppStorage.listarVeiculos().forEach((v) => select.append(new Option(v.marca + ' ' + v.modelo + ' · ' + v.placa, v.id)));
    if (Array.from(select.options).some((o) => o.value === atual)) select.value = atual;
  }

  function renderizarTabela() {
    const tbody = $('tabela-historico').tBodies[0];
    const veiculo = $('filtro-veiculo').value;
    const status = $('filtro-status').value;
    const veiculos = AppStorage.listarVeiculos();
    const avaliados = AppStorage.listarAvaliacoes().map((a) => a.agendamentoId);
    const lista = AppStorage.listarAgendamentos()
      .filter((a) => (!veiculo || a.veiculoId === veiculo) && (!status || a.status === status))
      .sort((a, b) => (b.data + b.horario).localeCompare(a.data + a.horario));

    tbody.replaceChildren();
    if (!lista.length) {
      const linha = UI.criar('tr');
      const td = UI.criar('td', 'vazio-tabela', veiculo || status ? 'Nenhum serviço com esses filtros.' : 'Nenhum serviço ainda. Que tal agendar o primeiro?');
      td.colSpan = 6;
      linha.append(td);
      tbody.append(linha);
      return;
    }
    lista.forEach(function (a) {
      const servico = Servicos.obter(a.servicoId);
      const v = veiculos.find((x) => x.id === a.veiculoId);
      const linha = UI.criar('tr');
      linha.dataset.id = a.id;
      const data = UI.criar('time', null, UI.data(a.data) + ' ' + a.horario);
      data.dateTime = a.data + 'T' + a.horario;
      const nomeServico = UI.criar('span', null, servico ? servico.nome : a.servicoId);
      const conteudoServico = document.createDocumentFragment();
      conteudoServico.append(nomeServico);
      if (a.fidelidade) conteudoServico.append(' ', UI.criar('span', 'selo', 'Fidelidade'));
      const badge = UI.criar('span', 'badge', NOMES_STATUS[a.status]);
      badge.dataset.status = a.status;
      const acoes = UI.criar('div', 'acoes-tabela');
      if (AppStorage.obterCheckin(a.id)) acoes.append(UI.botao('Ver check-in', 'btn btn-secundario btn-pequeno', { acao: 'checkin' }));
      acoes.append(UI.botao('Agendar novamente', 'btn btn-secundario btn-pequeno', { acao: 'repetir' }));
      if (a.status === S.ENTREGUE && avaliados.indexOf(a.id) === -1) {
        acoes.append(UI.botao('Avaliar', 'btn btn-secundario btn-pequeno', { acao: 'avaliar' }));
      }
      if (a.status === S.AGENDADO) acoes.append(UI.botao('Cancelar', 'btn btn-secundario btn-pequeno', { acao: 'cancelar' }));
      linha.append(
        celula('Data', data),
        celula('Veículo', v ? v.marca + ' ' + v.modelo : 'Veículo removido'),
        celula('Serviço', conteudoServico),
        celula('Valor', UI.moeda(a.valor)),
        celula('Status', badge),
        celula('Ações', acoes)
      );
      linha.lastChild.classList.add('celula-acoes');
      tbody.append(linha);
    });
  }

  /** "Hora da manutenção": a última proteção entregue foi há mais de 90 dias. */
  function renderizarLembrete() {
    const alerta = $('alerta-manutencao');
    const protecoes = AppStorage.listarAgendamentos()
      .filter((a) => a.status === S.ENTREGUE && temProtecao(Servicos.obter(a.servicoId)))
      .sort((a, b) => b.data.localeCompare(a.data));
    alerta.replaceChildren();
    if (!protecoes.length) {
      alerta.hidden = true;
      return;
    }
    const ultima = protecoes[0];
    const dias = Math.floor((Date.now() - UI.paraData(ultima.data).getTime()) / 86400000);
    if (dias <= DIAS_MANUTENCAO) {
      alerta.hidden = true;
      return;
    }
    const servico = Servicos.obter(ultima.servicoId);
    const icone = UI.criar('span', null, '⚠');
    icone.setAttribute('aria-hidden', 'true');
    const texto = UI.criar(
      'span',
      null,
      'Hora da manutenção: sua última proteção (' + servico.nome + ') foi em ' + UI.data(ultima.data) + ', há ' + dias + ' dias. '
    );
    const botao = UI.botao('Agendar manutenção', 'btn btn-secundario btn-pequeno');
    botao.addEventListener('click', function () {
      Agenda.preencher({ veiculoId: ultima.veiculoId, servicoId: 'lavagem-tecnica' });
    });
    texto.append(botao);
    alerta.append(icone, texto);
    alerta.hidden = false;
  }

  /* =====================================================================
   * 3. PESQUISA NPS
   * ===================================================================== */

  let npsAgendamento = null;

  /**
   * Abre a pesquisa NPS de um serviço entregue.
   * @param {string} agendamentoId
   */
  function abrirNps(agendamentoId) {
    const dialogo = $('dialog-nps');
    if (!dialogo || dialogo.open) return;
    npsAgendamento = agendamentoId;
    $('form-nps').reset();
    $('nps-erro').hidden = true;
    UI.abrirDialogo(dialogo);
    dialogo.querySelector('input[name="nps"]').focus();
  }

  function aoEnviarNps(evento) {
    evento.preventDefault(); // method="dialog" fecharia antes de validarmos
    const marcada = document.querySelector('input[name="nps"]:checked');
    if (!marcada) {
      $('nps-erro').textContent = 'Escolha uma nota de 0 a 10.';
      $('nps-erro').hidden = false;
      $('dialog-nps').querySelector('input[name="nps"]').focus();
      return;
    }
    try {
      AppStorage.registrarAvaliacao({
        agendamentoId: npsAgendamento,
        nota: Number(marcada.value),
        comentario: $('nps-comentario').value,
      });
      $('dialog-nps').close();
      UI.toast('Obrigado pela avaliação! Ela ajuda a gente a melhorar.', { tipo: 'sucesso' });
      UI.avisarMudanca('avaliacoes');
    } catch (erro) {
      $('nps-erro').textContent = erro.message;
      $('nps-erro').hidden = false;
    }
  }

  function prepararNps() {
    const opcoes = $('nps-opcoes');
    opcoes.setAttribute('role', 'radiogroup');
    opcoes.setAttribute('aria-label', 'Nota de 0 a 10');
    for (let n = 0; n <= 10; n++) {
      const rotulo = UI.criar('label', 'nps-nota');
      const radio = UI.criar('input');
      radio.type = 'radio';
      radio.name = 'nps';
      radio.value = String(n);
      radio.required = true;
      rotulo.append(radio, UI.criar('span', null, n));
      opcoes.append(rotulo);
    }
    // novalidate: sem isso o navegador barra o envio com o balão dele e a nossa mensagem não aparece
    $('form-nps').noValidate = true;
    $('form-nps').addEventListener('submit', aoEnviarNps);
  }

  /* =====================================================================
   * 4. PAINEL DE MÉTRICAS (barras em CSS puro)
   * ===================================================================== */

  /**
   * Barra horizontal: largura pelo --valor (0 a 100) e marcador da meta.
   * @returns {HTMLElement}
   */
  function barra(valor, meta, rotulo) {
    const trilho = UI.criar('div', 'barra');
    trilho.style.setProperty('--valor', Math.max(0, Math.min(100, valor)) + '%');
    if (meta !== undefined) {
      trilho.style.setProperty('--meta', meta + '%');
      trilho.classList.add('barra--meta');
    }
    trilho.setAttribute('role', 'img');
    trilho.setAttribute('aria-label', rotulo);
    return trilho;
  }

  function indicador(titulo, valor, detalhe, situacao) {
    const caixa = UI.criar('div', 'indicador' + (situacao ? ' indicador--' + situacao : ''));
    caixa.append(UI.criar('p', 'indicador-titulo', titulo), UI.criar('p', 'indicador-valor', valor), UI.criar('p', 'indicador-detalhe', detalhe));
    return caixa;
  }

  function renderizarMetricas() {
    const area = $('metricas');
    if (!area) return;
    const m = calcularMetricas(AppStorage.listarAgendamentos(), AppStorage.listarAvaliacoes());
    area.replaceChildren();
    if (!m.entregues) {
      area.append(UI.criar('p', 'vazio', 'Sem serviços entregues ainda. Use "Gerar dados de demonstração" para ver o painel funcionando.'));
      return;
    }

    // Indicadores principais
    const topo = UI.criar('div', 'indicadores');
    const npsOk = m.nps !== null && m.nps > META_NPS;
    topo.append(
      indicador('NPS', m.nps === null ? 'sem dados' : String(m.nps), 'meta > ' + META_NPS + ' · ' + m.avaliacoes + ' avaliações', m.nps === null ? '' : npsOk ? 'ok' : 'abaixo'),
      indicador(
        'Recorrência',
        m.recorrencia === null ? 'sem dados' : m.recorrencia + '%',
        'meta ' + META_RECORRENCIA + '% · ' + m.atendidos + ' veículos atendidos',
        m.recorrencia === null ? '' : m.recorrencia >= META_RECORRENCIA ? 'ok' : 'abaixo'
      ),
      indicador('Ticket médio', UI.moeda(m.ticketMedio), m.entregues + ' serviços entregues'),
      indicador('Faturamento', UI.moeda(m.faturamento), 'PPF + Vitrificação: ' + m.participacaoPremium + '%')
    );
    area.append(topo);

    // Metas em barras (NPS vai de −100 a 100: convertemos para 0 a 100 na barra)
    const metas = UI.criar('div', 'grafico');
    metas.append(UI.criar('h4', null, 'Metas'));
    if (m.nps !== null) {
      metas.append(UI.criar('p', 'grafico-rotulo', 'NPS ' + m.nps + ' (meta > ' + META_NPS + ')'));
      metas.append(barra((m.nps + 100) / 2, (META_NPS + 100) / 2, 'NPS ' + m.nps + ', meta maior que ' + META_NPS));
    }
    if (m.recorrencia !== null) {
      metas.append(UI.criar('p', 'grafico-rotulo', 'Recorrência ' + m.recorrencia + '% (meta ' + META_RECORRENCIA + '%)'));
      metas.append(barra(m.recorrencia, META_RECORRENCIA, 'Recorrência ' + m.recorrencia + ' por cento, meta ' + META_RECORRENCIA));
    }
    metas.append(UI.criar('p', 'grafico-rotulo', 'Participação de PPF e Vitrificação no faturamento: ' + m.participacaoPremium + '%'));
    metas.append(barra(m.participacaoPremium, undefined, m.participacaoPremium + ' por cento do faturamento'));
    area.append(metas);

    // Ticket médio por mês: colunas
    const maiorTicket = Math.max.apply(null, m.meses.map((x) => x.ticket).concat(1));
    const colunas = UI.criar('div', 'grafico');
    colunas.append(UI.criar('h4', null, 'Ticket médio por mês'));
    const lista = UI.criar('ul', 'colunas');
    m.meses.forEach(function (mes) {
      const item = UI.criar('li');
      item.style.setProperty('--valor', Math.round((mes.ticket / maiorTicket) * 100) + '%');
      item.setAttribute('aria-label', mes.rotulo + ': ' + UI.moeda(mes.ticket) + ' em ' + mes.quantidade + ' serviços');
      const coluna = UI.criar('span', 'coluna');
      coluna.setAttribute('aria-hidden', 'true');
      item.append(UI.criar('span', 'coluna-valor', mes.ticket ? UI.moeda(mes.ticket).replace(',00', '') : 'sem dados'), coluna, UI.criar('span', 'coluna-rotulo', mes.rotulo));
      lista.append(item);
    });
    colunas.append(lista);
    area.append(colunas);

    // Mais vendidos
    const ranking = UI.criar('div', 'grafico');
    ranking.append(UI.criar('h4', null, 'Serviços mais vendidos'));
    const maior = m.maisVendidos.length ? m.maisVendidos[0].quantidade : 1;
    m.maisVendidos.forEach(function (s) {
      ranking.append(UI.criar('p', 'grafico-rotulo', s.nome + ' · ' + s.quantidade));
      ranking.append(barra((s.quantidade / maior) * 100, undefined, s.nome + ': ' + s.quantidade + ' vendidos'));
    });
    area.append(ranking);
  }

  /* =====================================================================
   * 5. DADOS DE DEMONSTRAÇÃO
   * ===================================================================== */

  /** Sorteio com semente fixa: gera sempre os mesmos dados (a apresentação fica previsível). */
  function sorteador(semente) {
    let x = semente;
    return function () {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x / 2147483648;
    };
  }

  /**
   * Monta veículos, agendamentos e avaliações dos últimos 6 meses (todos com demo: true).
   * @returns {{veiculos: Object[], agendamentos: Object[], avaliacoes: Object[]}}
   */
  function montarDemo() {
    const r = sorteador(20261116);
    const id = () => 'demo-' + Math.floor(r() * 1e9).toString(36);
    const veiculos = [
      { marca: 'Honda', modelo: 'Civic', ano: 2001, placa: 'DMO1A23', cor: 'Preto', porte: 'seda' },
      { marca: 'Toyota', modelo: 'Corolla', ano: 2020, placa: 'DMO2B34', cor: 'Prata', porte: 'seda' },
      { marca: 'Jeep', modelo: 'Compass', ano: 2022, placa: 'DMO3C45', cor: 'Branco', porte: 'suv' },
      { marca: 'Volkswagen', modelo: 'Gol', ano: 2015, placa: 'DMO4567', cor: 'Vermelho', porte: 'hatch' },
      { marca: 'Ford', modelo: 'Ranger', ano: 2019, placa: 'DMO5E67', cor: 'Cinza', porte: 'picape' },
    ].map((v) => Object.assign({ id: id(), demo: true }, v));
    // Pesos: lavagens vendem mais; PPF é raro e caro
    const servicos = ['lavagem-tecnica', 'lavagem-tecnica', 'lavagem-tecnica', 'higienizacao-interna', 'pacote-lavagem-completa', 'polimento-comercial', 'selante', 'cera', 'vitrificacao', 'pacote-correcao-vitrificacao', 'ppf'];
    const agendamentos = [];
    const avaliacoes = [];
    for (let n = 0; n < 36; n++) {
      const veiculo = veiculos[Math.floor(r() * veiculos.length)];
      const servico = Servicos.obter(servicos[Math.floor(r() * servicos.length)]);
      const dia = new Date();
      dia.setDate(dia.getDate() - (3 + Math.floor(r() * 175)));
      if (dia.getDay() === 0) dia.setDate(dia.getDate() - 1); // domingo fechado
      const data = UI.dataIso(dia);
      const inicio = new Date(dia);
      inicio.setHours(8 + Math.floor(r() * 3), 0, 0, 0);
      const fim = new Date(inicio.getTime() + Math.max(2, Math.min(servico.duracaoHoras, 48)) * 3600000);
      const cancelado = r() < 0.08;
      const historicoStatus = [{ status: S.AGENDADO, etapa: null, em: new Date(inicio.getTime() - 3 * 86400000).toISOString() }];
      if (cancelado) historicoStatus.push({ status: S.CANCELADO, etapa: null, em: new Date(inicio.getTime() - 86400000).toISOString() });
      else {
        historicoStatus.push({ status: S.RECEBIDO, etapa: null, em: inicio.toISOString() });
        historicoStatus.push({ status: S.PRONTO, etapa: null, em: fim.toISOString() });
        historicoStatus.push({ status: S.ENTREGUE, etapa: null, em: new Date(fim.getTime() + 3600000).toISOString() });
      }
      const agendamento = {
        id: id(),
        veiculoId: veiculo.id,
        servicoId: servico.id,
        data: data,
        horario: String(inicio.getHours()).padStart(2, '0') + ':00',
        levaTraz: r() < 0.2,
        endereco: null,
        observacoes: '',
        valor: Servicos.precoPara(servico, veiculo.porte),
        taxaLevaTraz: 0,
        protocolo: Agenda.gerarProtocolo(dia),
        previsaoEntrega: fim.toISOString(),
        fidelidade: false,
        fotosEtapas: {},
        demo: true,
        status: cancelado ? S.CANCELADO : S.ENTREGUE,
        etapaAtual: null,
        historicoStatus: historicoStatus,
        criadoEm: historicoStatus[0].em,
      };
      agendamentos.push(agendamento);
      if (!cancelado && r() < 0.8) {
        const sorteio = r();
        const nota = sorteio < 0.72 ? 9 + Math.floor(r() * 2) : sorteio < 0.92 ? 7 + Math.floor(r() * 2) : 4 + Math.floor(r() * 3);
        avaliacoes.push({ id: id(), agendamentoId: agendamento.id, nota: nota, comentario: '', criadaEm: fim.toISOString(), demo: true });
      }
    }
    return { veiculos: veiculos, agendamentos: agendamentos, avaliacoes: avaliacoes };
  }

  function gerarDemo() {
    if (AppStorage.listarAgendamentos().some((a) => a.demo)) {
      UI.toast('Os dados de demonstração já estão carregados.', { tipo: 'info' });
      return;
    }
    try {
      const dados = montarDemo();
      AppStorage.adicionarDemo(dados);
      UI.toast('Demonstração carregada: ' + dados.agendamentos.length + ' serviços dos últimos 6 meses.', { tipo: 'sucesso' });
      UI.avisarMudanca('tudo');
    } catch (erro) {
      UI.toastErro(erro);
    }
  }

  async function limparDemo() {
    const ok = await UI.confirmar({
      titulo: 'Limpar dados de demonstração?',
      mensagem: 'Só os veículos, serviços e avaliações fictícios serão apagados. Seus dados reais ficam.',
      confirmar: 'Limpar demonstração',
    });
    if (!ok) return;
    const apagados = AppStorage.removerDemo();
    UI.toast(apagados ? apagados + ' registros de demonstração apagados.' : 'Não havia dados de demonstração.', { tipo: 'info' });
    UI.avisarMudanca('tudo');
  }

  /* =====================================================================
   * 6. INICIALIZAÇÃO
   * ===================================================================== */

  function renderizar() {
    preencherFiltroVeiculos();
    renderizarTabela();
    renderizarLembrete();
    renderizarMetricas();
  }

  function iniciar() {
    if (!$('historico')) return;
    prepararNps();
    $('filtro-veiculo').addEventListener('change', renderizarTabela);
    $('filtro-status').addEventListener('change', renderizarTabela);
    $('tabela-historico').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      const agendamento = AppStorage.listarAgendamentos().find((a) => a.id === alvo.closest('tr').dataset.id);
      if (!agendamento) return;
      if (alvo.dataset.acao === 'checkin') {
        Checkin.renderizarRelatorio($('relatorio-conteudo'), agendamento.id, { permitirConfirmar: false });
        UI.abrirDialogo($('dialog-relatorio'));
      }
      if (alvo.dataset.acao === 'repetir') Agenda.preencher({ veiculoId: agendamento.veiculoId, servicoId: agendamento.servicoId });
      if (alvo.dataset.acao === 'avaliar') abrirNps(agendamento.id);
      if (alvo.dataset.acao === 'cancelar') Agenda.cancelar(agendamento.id);
    });
    $('btn-gerar-demo').addEventListener('click', gerarDemo);
    $('btn-limpar-demo').addEventListener('click', limparDemo);
    UI.aoMudarDados(renderizar);
    renderizar();
  }

  return {
    calcularMetricas: calcularMetricas,
    temProtecao: temProtecao,
    montarDemo: montarDemo,
    abrirNps: abrirNps,
    iniciar: iniciar,
  };
})();
