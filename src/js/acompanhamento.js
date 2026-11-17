/**
 * acompanhamento.js: Acompanhamento
 *
 * Duas visões do mesmo serviço, cada uma na sua página:
 *  - ATENDIMENTO (#/atendimento, equipe): lista os agendamentos com botões que
 *    avançam o status: check-in → etapas do serviço (do catálogo) → pronto → entregue.
 *  - ACOMPANHAMENTO (#/acompanhamento, cliente): linha do tempo, % de progresso,
 *    fotos das etapas, previsão de entrega e o relatório do check-in.
 *
 * As duas se atualizam sozinhas: nesta aba (evento local) e em outra aba
 * (evento "storage" do navegador). Demonstração: abra duas abas, uma em cada página.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
import { AppStorage } from './storage.js';
import { Servicos } from './servicos.js';
import { UI } from './ui.js';
import { Checkin } from './checkin.js';
import { Agenda } from './agenda.js';
import { Rotas } from './rotas.js';
import { Historico } from './historico.js';

export const Acompanhamento = (function () {
  'use strict';

  const $ = UI.$;
  const S = AppStorage.STATUS;
  const NOMES_STATUS = {
    agendado: 'Agendado',
    recebido: 'Check-in feito',
    'em-execucao': 'Em lavagem',
    pronto: 'Pronto para retirada',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  };

  /** As 3 etapas que o cliente vê. A última muda com o leva e traz. */
  const ETAPA_CHECKIN = 'Check-in';
  const ETAPA_LAVAGEM = 'Em lavagem';

  /**
   * Nome do status para mostrar na tela (com leva e traz, "pronto" vira "A caminho").
   * @param {Object} agendamento
   * @returns {string}
   */
  function nomeStatus(agendamento) {
    if (agendamento.status === S.PRONTO && agendamento.levaTraz) return 'A caminho';
    return NOMES_STATUS[agendamento.status] || agendamento.status;
  }

  /** Último status visto de cada agendamento (para perceber quando mudou). */
  const statusVisto = {};

  /* =====================================================================
   * 1. REGRAS DA LINHA DO TEMPO (funções puras)
   * ===================================================================== */

  /**
   * As etapas que o cliente acompanha. São só 3, iguais para todos os serviços:
   * Check-in → Em lavagem → Pronto para retirada (ou "A caminho", com leva e traz).
   * @param {Object} agendamento
   * @returns {string[]}
   */
  function etapasDe(agendamento) {
    return [ETAPA_CHECKIN, ETAPA_LAVAGEM, agendamento.levaTraz ? 'A caminho' : 'Pronto para retirada'];
  }

  /**
   * Em qual etapa o serviço está (índice em etapasDe) e quando cada etapa começou.
   * @param {Object} agendamento
   * @returns {{etapas: string[], atual: number, inicios: Object<string,string>, percentual: number}}
   */
  function progressoDe(agendamento) {
    const etapas = etapasDe(agendamento);
    const inicios = {};
    (agendamento.historicoStatus || []).forEach(function (h) {
      if (h.status === S.RECEBIDO) inicios[etapas[0]] = h.em;
      if (h.status === S.EM_EXECUCAO && !inicios[etapas[1]]) inicios[etapas[1]] = h.em; // 1ª vez que entrou em lavagem
      if (h.status === S.PRONTO) inicios[etapas[2]] = h.em;
    });
    // atual = etapa em andamento (destacada); percentual = quanto do serviço já foi feito
    let atual;
    let percentual;
    switch (agendamento.status) {
      case S.AGENDADO:
        atual = 0; // esperando o check-in
        percentual = 0;
        break;
      case S.RECEBIDO:
        atual = 1; // check-in feito, a lavagem é a próxima
        percentual = 33;
        break;
      case S.EM_EXECUCAO:
        atual = 1; // lavando
        percentual = 66;
        break;
      case S.PRONTO:
        atual = 2; // pronto para retirada (ou a caminho)
        percentual = 100;
        break;
      default:
        atual = etapas.length; // entregue (ou cancelado): tudo concluído
        percentual = 100;
    }
    return { etapas: etapas, atual: atual, inicios: inicios, percentual: percentual };
  }

  /**
   * Próxima ação do atendente para um agendamento.
   * @param {Object} agendamento
   * @returns {{status: string, etapa?: string, rotulo: string}|null}
   */
  function proximoPasso(agendamento) {
    if (agendamento.status === S.RECEBIDO) return { status: S.EM_EXECUCAO, etapa: ETAPA_LAVAGEM, rotulo: 'Iniciar lavagem' };
    if (agendamento.status === S.EM_EXECUCAO) {
      return { status: S.PRONTO, rotulo: agendamento.levaTraz ? 'Saiu para entrega' : 'Pronto para retirada' };
    }
    if (agendamento.status === S.PRONTO) return { status: S.ENTREGUE, rotulo: 'Marcar como entregue' };
    return null;
  }

  /* =====================================================================
   * 2. QUEM ESTÁ NA TELA
   * ===================================================================== */

  /**
   * A pessoa está na página Atendimento (é a equipe mexendo)?
   * Nesse caso, a mudança de status foi o próprio clique dela: não avisamos "o cliente".
   * @returns {boolean}
   */
  function naPaginaAtendimento() {
    return Rotas.atual() === 'atendimento';
  }

  /* =====================================================================
   * 3. VISÃO DO ATENDENTE
   * ===================================================================== */

  function veiculoDe(agendamento) {
    return AppStorage.listarVeiculos().find((v) => v.id === agendamento.veiculoId);
  }

  function ativos() {
    return AppStorage.listarAgendamentos()
      .filter((a) => a.status !== S.ENTREGUE && a.status !== S.CANCELADO)
      .sort((a, b) => (a.data + a.horario).localeCompare(b.data + b.horario));
  }

  function badge(agendamento) {
    const b = UI.criar('span', 'badge', nomeStatus(agendamento));
    b.dataset.status = agendamento.status;
    return b;
  }

  function cardAtendente(agendamento) {
    const servico = Servicos.obter(agendamento.servicoId);
    const veiculo = veiculoDe(agendamento);
    const card = UI.criar('article', 'cartao atendente-card');
    card.dataset.id = agendamento.id;
    const topo = UI.criar('div', 'andamento-topo');
    const textos = UI.criar('div');
    const titulo = UI.criar('h4', null, agendamento.horario + ' · ' + (servico ? servico.nome : agendamento.servicoId));
    titulo.id = 'atendente-' + agendamento.id;
    textos.append(
      titulo,
      UI.criar(
        'p',
        'texto-suave',
        (veiculo ? veiculo.marca + ' ' + veiculo.modelo + ' · ' + veiculo.placa : 'Veículo removido') +
          ' · ' + UI.data(agendamento.data) + (agendamento.levaTraz ? ' · leva e traz' : '')
      )
    );
    topo.append(textos, badge(agendamento));
    card.append(topo);

    const acoes = UI.criar('div', 'servico-acoes');
    const passo = proximoPasso(agendamento);
    if (agendamento.status === S.AGENDADO) {
      acoes.append(UI.botao('Fazer check-in', 'btn btn-primario', { acao: 'checkin' }));
      acoes.append(UI.botao('Cancelar', 'btn btn-secundario', { acao: 'cancelar' }));
    }
    if (passo) acoes.append(UI.botao(passo.rotulo, 'btn btn-primario', { acao: 'avancar' }));
    if (agendamento.status === S.EM_EXECUCAO) {
      // Foto da etapa: o <label> funciona como botão e abre a câmera no celular
      const rotulo = UI.criar('label', 'btn btn-secundario', 'Anexar foto da lavagem');
      const arquivo = UI.criar('input', 'visualmente-oculto');
      arquivo.type = 'file';
      arquivo.accept = 'image/*';
      arquivo.setAttribute('capture', 'environment');
      arquivo.dataset.acao = 'foto';
      rotulo.append(arquivo);
      acoes.append(rotulo);
    }
    acoes.querySelectorAll('button, label').forEach((b) => b.setAttribute('aria-describedby', titulo.id));
    card.append(acoes);
    return card;
  }

  function renderizarAtendente() {
    const lista = $('lista-atendente');
    if (!lista) return;
    lista.replaceChildren();
    const hoje = UI.dataIso();
    const todos = ativos();
    const doDia = todos.filter((a) => a.data === hoje);
    const outros = todos.filter((a) => a.data !== hoje);
    if (!todos.length) {
      lista.append(UI.criar('p', 'vazio', 'Nenhum agendamento em aberto. Os novos aparecem aqui na hora.'));
      return;
    }
    [
      ['Hoje (' + UI.data(hoje) + ')', doDia],
      ['Outros em aberto', outros],
    ].forEach(function (grupo) {
      if (!grupo[1].length) return;
      lista.append(UI.criar('h4', 'grupo-titulo', grupo[0]));
      grupo[1].forEach((a) => lista.append(cardAtendente(a)));
    });
  }

  /** Executa o próximo passo do agendamento (com as consequências de "pronto" e "entregue"). */
  function avancar(id) {
    const agendamento = AppStorage.listarAgendamentos().find((a) => a.id === id);
    const passo = agendamento && proximoPasso(agendamento);
    if (!passo) return;
    try {
      AppStorage.atualizarStatus(id, passo.status, passo.etapa);
    } catch (erro) {
      UI.toastErro(erro);
      return;
    }
    const servico = Servicos.obter(agendamento.servicoId);
    if (passo.status === S.PRONTO) UI.toast('Serviço pronto! O cliente foi avisado.', { tipo: 'sucesso' });
    if (passo.status === S.ENTREGUE) {
      if (servico && servico.contaFidelidade) {
        AppStorage.adicionarCarimbo(id, servico.id);
        UI.toast('Entregue! +1 carimbo no cartão PK Club.', { tipo: 'sucesso' });
      } else {
        UI.toast('Serviço entregue.', { tipo: 'sucesso' });
      }
      statusVisto[id] = S.ENTREGUE; // esta aba já abre a pesquisa; não repetir no re-render
      UI.avisarMudanca('agendamentos');
      Historico.abrirNps(id);
      return;
    }
    UI.avisarMudanca('agendamentos');
  }

  async function anexarFoto(id, arquivo) {
    const agendamento = AppStorage.listarAgendamentos().find((a) => a.id === id);
    if (!agendamento || !arquivo) return;
    try {
      const reduzida = await UI.comprimirImagem(arquivo);
      // Cada foto ganha uma chave própria (com a hora): dá para anexar várias durante a lavagem
      AppStorage.anexarFotoEtapa(id, ETAPA_LAVAGEM + ' ' + new Date().toISOString(), reduzida.dataUrl);
      UI.toast('Foto da lavagem anexada (' + UI.bytes(reduzida.bytes) + ').', { tipo: 'sucesso' });
      UI.avisarMudanca('agendamentos');
    } catch (erro) {
      UI.toast(
        erro.codigo === AppStorage.CODIGO_QUOTA
          ? 'A foto não coube no armazenamento do navegador. Remova fotos antigas de check-in.'
          : erro.message,
        { tipo: 'erro' }
      );
    }
  }

  /* =====================================================================
   * 4. VISÃO DO CLIENTE
   * ===================================================================== */

  /** Agendamentos que o cliente pode acompanhar: os ativos + o último entregue. */
  function acompanhaveis() {
    const lista = ativos();
    const entregues = AppStorage.listarAgendamentos()
      .filter((a) => a.status === S.ENTREGUE && !a.demo)
      .sort((a, b) => (b.data + b.horario).localeCompare(a.data + a.horario));
    if (entregues.length) lista.push(entregues[0]);
    return lista;
  }

  function renderizarCliente() {
    const opcoes = acompanhaveis();
    const select = $('acompanhamento-agendamento');
    const escolhido = select.value;
    $('acompanhamento-vazio').hidden = opcoes.length > 0;
    $('acompanhamento-escolha').hidden = opcoes.length < 2;
    $('servico-andamento').hidden = !opcoes.length;
    $('checkin-recebido').hidden = true;
    if (!opcoes.length) return;

    select.replaceChildren();
    opcoes.forEach(function (a) {
      const servico = Servicos.obter(a.servicoId);
      select.append(new Option((servico ? servico.nome : '') + ' · ' + UI.data(a.data) + ' · ' + nomeStatus(a), a.id));
    });
    if (opcoes.some((a) => a.id === escolhido)) select.value = escolhido;
    const agendamento = opcoes.find((a) => a.id === select.value) || opcoes[0];

    const servico = Servicos.obter(agendamento.servicoId);
    const veiculo = veiculoDe(agendamento);
    const progresso = progressoDe(agendamento);
    $('andamento-titulo').textContent = servico ? servico.nome : 'Serviço';
    $('andamento-resumo').textContent =
      (veiculo ? veiculo.marca + ' ' + veiculo.modelo + ' · ' : '') + 'protocolo ' + (agendamento.protocolo || 'sem número');
    const b = $('andamento-badge');
    b.textContent = nomeStatus(agendamento);
    b.dataset.status = agendamento.status;
    $('andamento-progresso').value = progresso.percentual;
    $('andamento-progresso').textContent = progresso.percentual + '%';
    $('andamento-percentual').textContent = progresso.percentual + '%';
    $('andamento-previsao').textContent = agendamento.previsaoEntrega
      ? (agendamento.status === S.ENTREGUE ? 'Entregue. Previsão era ' : 'Previsão de entrega: ') + UI.dataHora(agendamento.previsaoEntrega)
      : '';

    // Linha do tempo
    const linha = $('linha-tempo');
    linha.replaceChildren();
    progresso.etapas.forEach(function (nome, i) {
      const item = UI.criar('li', null, nome);
      if (i < progresso.atual) item.classList.add('concluida');
      if (i === progresso.atual && agendamento.status !== S.ENTREGUE) item.setAttribute('aria-current', 'step');
      if (progresso.inicios[nome]) {
        const quando = UI.criar('time', null, UI.hora(progresso.inicios[nome]) + ' · ' + UI.data(progresso.inicios[nome]));
        quando.dateTime = progresso.inicios[nome];
        item.append(quando);
      }
      // Fotos: todas as anexadas durante o serviço aparecem em "Em lavagem"
      // (inclusive as de agendamentos antigos, que tinham outros nomes de etapa)
      const fotos = i === 1 ? Object.values(agendamento.fotosEtapas || {}) : [];
      const galeria = fotos.map(function (dataUrl, n) {
        return { dataUrl: dataUrl, legenda: 'lavagem, foto ' + (n + 1) };
      });
      fotos.forEach(function (dataUrl, n) {
        const ver = UI.criar('button', 'etapa-foto');
        ver.type = 'button';
        ver.setAttribute('aria-label', 'Ver foto ' + (n + 1) + ' da lavagem');
        const img = UI.criar('img');
        img.src = dataUrl;
        img.alt = '';
        ver.append(img);
        ver.addEventListener('click', function () {
          Checkin.abrirFoto(galeria, n);
        });
        item.append(ver);
      });
      linha.append(item);
    });

    // Relatório do check-in
    if (agendamento.status !== S.AGENDADO) {
      $('checkin-recebido').hidden = false;
      Checkin.renderizarRelatorio($('checkin-relatorio'), agendamento.id, { permitirConfirmar: true });
    }

    const botaoAviso = $('btn-avisar-pronto');
    botaoAviso.hidden =
      !('Notification' in window) || Notification.permission !== 'default' || agendamento.status === S.ENTREGUE;
  }

  /**
   * Percebe mudanças de status vindas de OUTRA aba (ou desta, fora da página Atendimento)
   * e avisa: toast + notificação no "pronto"; pesquisa NPS no "entregue".
   */
  function perceberMudancas() {
    AppStorage.listarAgendamentos().forEach(function (a) {
      const antes = statusVisto[a.id];
      statusVisto[a.id] = a.status;
      if (antes === undefined || antes === a.status) return;
      if (naPaginaAtendimento()) return; // quem avisa o atendente é o próprio clique dele
      const servico = Servicos.obter(a.servicoId);
      if (a.status === S.PRONTO && a.levaTraz) {
        UI.toast('Seu veículo está a caminho!', { tipo: 'sucesso' });
        UI.notificar('Seu veículo está a caminho!', (servico ? servico.nome : 'Serviço') + ' concluído na PK Estética.');
      } else if (a.status === S.PRONTO) {
        UI.toast('Seu veículo está pronto! Já pode retirar.', { tipo: 'sucesso' });
        UI.notificar('Seu veículo está pronto para retirada!', (servico ? servico.nome : 'Serviço') + ' concluído na PK Estética.');
      }
      if (a.status === S.ENTREGUE && !AppStorage.listarAvaliacoes().some((av) => av.agendamentoId === a.id)) {
        Historico.abrirNps(a.id);
      }
    });
  }

  function renderizar() {
    perceberMudancas();
    renderizarAtendente();
    renderizarCliente();
  }

  /* =====================================================================
   * 5. INICIALIZAÇÃO
   * ===================================================================== */

  function iniciar() {
    if (!$('acompanhamento')) return;
    // Sessões antigas guardavam o "Modo Estética" aqui; ele não existe mais
    try {
      sessionStorage.removeItem('pk:modo');
    } catch (erro) {
      // sem sessionStorage: nada a limpar
    }

    $('lista-atendente').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('button[data-acao]');
      if (!alvo) return;
      const id = alvo.closest('.atendente-card').dataset.id;
      if (alvo.dataset.acao === 'checkin') Checkin.abrir(id);
      if (alvo.dataset.acao === 'avancar') avancar(id);
      if (alvo.dataset.acao === 'cancelar') Agenda.cancelar(id);
    });
    $('lista-atendente').addEventListener('change', function (evento) {
      if (evento.target.dataset.acao !== 'foto') return;
      anexarFoto(evento.target.closest('.atendente-card').dataset.id, evento.target.files[0]);
    });
    $('acompanhamento-agendamento').addEventListener('change', renderizarCliente);
    $('btn-avisar-pronto').addEventListener('click', async function () {
      const permitido = await UI.pedirNotificacoes();
      UI.toast(
        permitido ? 'Combinado! Avisaremos quando o carro ficar pronto.' : 'Sem permissão de notificação: o aviso aparece só aqui na página.',
        { tipo: permitido ? 'sucesso' : 'info' }
      );
      renderizarCliente();
    });

    // Marca o status atual de tudo como "já visto" (não avisar mudanças antigas ao abrir)
    AppStorage.listarAgendamentos().forEach((a) => (statusVisto[a.id] = a.status));
    UI.aoMudarDados(renderizar);
    renderizar();
  }

  return {
    etapasDe: etapasDe,
    progressoDe: progressoDe,
    proximoPasso: proximoPasso,
    iniciar: iniciar,
  };
})();
