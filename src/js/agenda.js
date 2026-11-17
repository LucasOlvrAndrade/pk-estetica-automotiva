/**
 * agenda.js — Agenda
 *
 * Regras de funcionamento da estética e o formulário #agendar.
 *
 * Funcionamento: segunda a sexta 8h–18h, sábado 8h–13h, domingo fechado.
 * Horários de 1 hora. Uma vaga por vez (um carro sendo atendido).
 *  - Serviço de até 8 h: ocupa as horas seguidas a partir do horário escolhido
 *    (precisa terminar antes de fechar). Entrega = início + duração.
 *  - Serviço de mais de 8 h: começa às 8h e ocupa o(s) dia(s) inteiro(s).
 *    Quantos dias? Os mesmos que o cliente vê no catálogo ("2 a 3 dias" → 3),
 *    para a previsão nunca contradizer o que está escrito no card.
 *
 * As funções da parte 1 são PURAS (testáveis no Console); a parte 2 cuida da tela.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
import { AppStorage } from './storage.js';
import { Servicos } from './servicos.js';
import { Api } from './api.js';
import { UI } from './ui.js';
import { Rotas } from './rotas.js';

export const Agenda = (function () {
  'use strict';

  const $ = UI.$;

  /** Horário de cada dia da semana (0 = domingo). null = fechado. */
  const EXPEDIENTE = Object.freeze({
    0: null,
    1: { abre: 8, fecha: 18 },
    2: { abre: 8, fecha: 18 },
    3: { abre: 8, fecha: 18 },
    4: { abre: 8, fecha: 18 },
    5: { abre: 8, fecha: 18 },
    6: { abre: 8, fecha: 13 },
  });
  const LIMITE_HORAS_POR_SLOT = 8; // acima disso o serviço ocupa o dia todo
  const TAXA_LEVA_TRAZ = 30;
  const SERVICO_RESGATE = 'polimento-comercial'; // Polimento de Refino (prêmio do cartão)

  /* =====================================================================
   * 1. REGRAS (funções puras)
   * ===================================================================== */

  /**
   * "AAAA-MM-DD" → Date à meia-noite local.
   * @param {string} dataIso
   * @returns {Date}
   */
  function paraDia(dataIso) {
    return UI.paraData(dataIso);
  }

  /**
   * Expediente de uma data.
   * @param {string} dataIso
   * @returns {{abre: number, fecha: number}|null} null = fechado.
   */
  function expedienteDe(dataIso) {
    return EXPEDIENTE[paraDia(dataIso).getDay()];
  }

  /**
   * Próximo dia útil (pula domingo).
   * @param {string} dataIso
   * @returns {string}
   */
  function proximoDiaAberto(dataIso) {
    const d = paraDia(dataIso);
    do {
      d.setDate(d.getDate() + 1);
    } while (!EXPEDIENTE[d.getDay()]);
    return UI.dataIso(d);
  }

  /**
   * Quantos dias inteiros um serviço longo ocupa, lendo o texto do catálogo
   * ("2 dias" → 2, "2 a 3 dias" → 3). Sem "dia" no texto, conta 8 h por dia.
   * @param {Object} servico
   * @returns {number}
   */
  function diasDoServico(servico) {
    const numeros = (String(servico.tempoExecucao).match(/\d+/g) || []).map(Number);
    if (/dia/.test(servico.tempoExecucao) && numeros.length) return Math.max.apply(null, numeros);
    return Math.ceil(servico.duracaoHoras / LIMITE_HORAS_POR_SLOT);
  }

  /** @returns {boolean} true se o serviço ocupa o dia inteiro. */
  function ocupaDiaTodo(servico) {
    return servico.duracaoHoras > LIMITE_HORAS_POR_SLOT;
  }

  /**
   * Dias (e horas) que um serviço ocupa a partir de data + horário.
   * @param {string} dataIso
   * @param {string} horario "HH:MM"
   * @param {Object} servico
   * @returns {{dias: Object<string, number[]>, fim: Date}|null} null = não cabe no expediente.
   */
  function ocupacaoDe(dataIso, horario, servico) {
    const inicio = parseInt(horario, 10);
    const dias = {};
    if (ocupaDiaTodo(servico)) {
      let dia = dataIso;
      let ultimo = dataIso;
      for (let n = 0; n < diasDoServico(servico); n++) {
        if (n > 0) dia = proximoDiaAberto(dia);
        const exp = expedienteDe(dia);
        if (!exp) return null;
        dias[dia] = [];
        for (let h = exp.abre; h < exp.fecha; h++) dias[dia].push(h);
        ultimo = dia;
      }
      const fim = paraDia(ultimo);
      fim.setHours(expedienteDe(ultimo).fecha, 0, 0, 0);
      return { dias: dias, fim: fim };
    }
    const exp = expedienteDe(dataIso);
    const horas = Math.ceil(servico.duracaoHoras);
    if (!exp || inicio < exp.abre || inicio + horas > exp.fecha) return null; // não termina antes de fechar
    dias[dataIso] = [];
    for (let h = inicio; h < inicio + horas; h++) dias[dataIso].push(h);
    const fim = paraDia(dataIso);
    fim.setHours(inicio + horas, 0, 0, 0);
    return { dias: dias, fim: fim };
  }

  /**
   * Mapa de horas ocupadas por dia, a partir dos agendamentos salvos (cancelados liberam a vaga).
   * @param {Object[]} agendamentos
   * @param {string} [ignorarId]
   * @returns {Object<string, Set<number>>}
   */
  function mapaOcupado(agendamentos, ignorarId) {
    const mapa = {};
    agendamentos.forEach(function (a) {
      if (a.status === 'cancelado' || a.id === ignorarId) return;
      const servico = Servicos.obter(a.servicoId);
      if (!servico) return;
      const ocupacao = ocupacaoDe(a.data, a.horario, servico);
      if (!ocupacao) return;
      Object.keys(ocupacao.dias).forEach(function (dia) {
        mapa[dia] = mapa[dia] || new Set();
        ocupacao.dias[dia].forEach(function (h) {
          mapa[dia].add(h);
        });
      });
    });
    return mapa;
  }

  /**
   * Grade de horários de uma data para um serviço.
   * @param {string} dataIso
   * @param {Object} servico
   * @param {Object[]} agendamentos
   * @param {Date} [agora] Para testes; por padrão, o relógio atual.
   * @returns {{fechado: boolean, slots: {horario: string, livre: boolean, motivo: string}[]}}
   */
  function gradeDoDia(dataIso, servico, agendamentos, agora) {
    const exp = expedienteDe(dataIso);
    if (!exp) return { fechado: true, slots: [] };
    const ocupado = mapaOcupado(agendamentos);
    const momento = agora || new Date();
    const slots = [];
    for (let h = exp.abre; h < exp.fecha; h++) {
      const horario = String(h).padStart(2, '0') + ':00';
      let motivo = '';
      const inicio = paraDia(dataIso);
      inicio.setHours(h, 0, 0, 0);
      const ocupacao = ocupacaoDe(dataIso, horario, servico);
      if (inicio <= momento) motivo = 'já passou';
      else if (ocupaDiaTodo(servico) && h !== exp.abre) motivo = 'serviço de dia inteiro começa às 8h';
      else if (!ocupacao) motivo = 'não termina antes de fechar';
      else {
        const conflito = Object.keys(ocupacao.dias).some(function (dia) {
          return ocupacao.dias[dia].some(function (hora) {
            return ocupado[dia] && ocupado[dia].has(hora);
          });
        });
        if (conflito) motivo = 'ocupado';
      }
      slots.push({ horario: horario, livre: !motivo, motivo: motivo });
    }
    return { fechado: false, slots: slots };
  }

  /**
   * Previsão de entrega.
   * @returns {Date|null}
   */
  function previsaoEntrega(dataIso, horario, servico) {
    const ocupacao = ocupacaoDe(dataIso, horario, servico);
    return ocupacao ? ocupacao.fim : null;
  }

  /**
   * Protocolo legível para o cliente: PK + data + 4 caracteres (ex.: PK261116-7QXA).
   * @param {Date} [base]
   * @returns {string}
   */
  function gerarProtocolo(base) {
    const d = base || new Date();
    const data = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    const sufixo = Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0');
    return 'PK' + data + '-' + sufixo;
  }

  /** Data no formato do calendário (.ics), hora local: 20261116T080000 */
  function dataIcs(d) {
    const p = function (n) {
      return String(n).padStart(2, '0');
    };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + 'T' + p(d.getHours()) + p(d.getMinutes()) + '00';
  }

  /** Texto seguro para o .ics (vírgula, ponto e vírgula e quebra de linha têm escape). */
  function textoIcs(texto) {
    return String(texto).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  }

  /**
   * Arquivo de calendário (.ics) do agendamento: abre no Google Agenda, Outlook, celular…
   * @param {Object} agendamento
   * @returns {string}
   */
  function gerarIcs(agendamento) {
    const servico = Servicos.obter(agendamento.servicoId);
    const inicio = paraDia(agendamento.data);
    inicio.setHours(parseInt(agendamento.horario, 10), 0, 0, 0);
    const fim = agendamento.previsaoEntrega ? new Date(agendamento.previsaoEntrega) : new Date(inicio.getTime() + 3600000);
    const agoraUtc = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    // O formato .ics exige quebra de linha CRLF (\r\n)
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PK Estetica Automotiva//Agendamento//PT-BR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + agendamento.id + '@pk-estetica',
      'DTSTAMP:' + agoraUtc,
      'DTSTART:' + dataIcs(inicio),
      'DTEND:' + dataIcs(fim),
      'SUMMARY:' + textoIcs('PK Estética – ' + (servico ? servico.nome : 'Serviço')),
      'DESCRIPTION:' + textoIcs('Protocolo ' + (agendamento.protocolo || '') + '\nValor: ' + UI.moeda(agendamento.valor)),
      'LOCATION:' + textoIcs('PK Estética Automotiva'),
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
  }

  /* =====================================================================
   * 2. TELA (#agendar)
   * ===================================================================== */

  const estado = { resgate: false };

  function veiculoEscolhido() {
    const id = $('agendar-veiculo').value;
    return AppStorage.listarVeiculos().find(function (v) {
      return v.id === id;
    });
  }

  function servicoEscolhido() {
    return Servicos.obter($('agendar-servico').value);
  }

  function horarioEscolhido() {
    const marcado = document.querySelector('input[name="horario"]:checked');
    return marcado ? marcado.value : '';
  }

  /** Preenche o select de veículos (mantendo a escolha atual ou a última usada). */
  function preencherVeiculos() {
    const select = $('agendar-veiculo');
    const atual = select.value || AppStorage.obterPreferencias().ultimoVeiculo || '';
    const veiculos = AppStorage.listarVeiculos();
    select.replaceChildren(new Option(veiculos.length ? 'Selecione um veículo' : 'Nenhum veículo cadastrado', ''));
    veiculos.forEach(function (v) {
      select.append(new Option(v.marca + ' ' + v.modelo + ' · ' + v.placa, v.id));
    });
    if (veiculos.some((v) => v.id === atual)) select.value = atual;
    $('agendar-veiculo-dica').hidden = veiculos.length > 0;
  }

  /** Desenha a grade de horários da data escolhida. */
  function renderizarGrade() {
    const grade = $('grade-horarios');
    const anterior = horarioEscolhido();
    grade.querySelectorAll('label, .dica').forEach(function (e) {
      e.remove();
    });
    const data = $('agendar-data').value;
    const servico = servicoEscolhido();
    const dica = UI.criar('p', 'dica');
    if (!data || !servico) {
      dica.textContent = 'Escolha o serviço e a data para ver os horários disponíveis.';
      grade.append(dica);
      return;
    }
    if (data < UI.dataIso()) {
      dica.textContent = 'Essa data já passou. Escolha hoje ou um dia futuro.';
      grade.append(dica);
      return;
    }
    const resultado = gradeDoDia(data, servico, AppStorage.listarAgendamentos());
    if (resultado.fechado) {
      dica.textContent = 'Fechado aos domingos. Escolha de segunda a sábado.';
      grade.append(dica);
      return;
    }
    const livres = resultado.slots.filter((s) => s.livre).length;
    dica.textContent = ocupaDiaTodo(servico)
      ? 'Este serviço ocupa o dia inteiro (' + diasDoServico(servico) + ' dia(s) de trabalho) e começa às 8h.'
      : livres + ' horário(s) livre(s) em ' + UI.dataLonga(data) + '.';
    grade.append(dica);
    resultado.slots.forEach(function (slot) {
      const rotulo = UI.criar('label');
      const radio = UI.criar('input');
      radio.type = 'radio';
      radio.name = 'horario';
      radio.value = slot.horario;
      radio.disabled = !slot.livre;
      radio.checked = slot.livre && slot.horario === anterior;
      rotulo.append(radio, ' ' + slot.horario);
      if (!slot.livre) {
        rotulo.title = slot.motivo; // dica no mouse; o texto oculto abaixo é para o leitor de tela
        rotulo.append(UI.criar('span', 'visualmente-oculto', ' (' + slot.motivo + ')'));
      }
      grade.append(rotulo);
    });
  }

  /** Total = serviço (pelo porte) + taxa do leva e traz. No resgate, o serviço sai de graça. */
  function calcularValores() {
    const servico = servicoEscolhido();
    const veiculo = veiculoEscolhido();
    const preco = servico && veiculo ? (estado.resgate ? 0 : Servicos.precoPara(servico, veiculo.porte)) : 0;
    const taxa = $('agendar-leva-traz').checked ? TAXA_LEVA_TRAZ : 0;
    return { preco: preco, taxa: taxa, total: preco + taxa };
  }

  /** Resumo antes de confirmar (transparência: nada de surpresa no preço). */
  function renderizarResumo() {
    const resumo = $('agendar-resumo');
    const servico = servicoEscolhido();
    const veiculo = veiculoEscolhido();
    const data = $('agendar-data').value;
    const horario = horarioEscolhido();
    resumo.replaceChildren();
    if (!servico || !veiculo) {
      resumo.append(UI.criar('span', null, 'Escolha o veículo e o serviço para ver o preço.'));
      return;
    }
    const valores = calcularValores();
    const previsao = data && horario ? previsaoEntrega(data, horario, servico) : null;
    const lista = UI.criar('dl', 'resumo-lista');
    function item(rotulo, valor) {
      const grupo = UI.criar('div');
      grupo.append(UI.criar('dt', null, rotulo), UI.criar('dd', null, valor));
      lista.append(grupo);
    }
    item('Veículo', veiculo.marca + ' ' + veiculo.modelo + ' (' + veiculo.placa + ')');
    item('Serviço', servico.nome + (estado.resgate ? ' — Fidelidade' : ''));
    item('Porte', Servicos.nomePorte(veiculo.porte));
    item('Preço', UI.moeda(valores.preco));
    if (valores.taxa) item('Leva e traz', UI.moeda(valores.taxa));
    item('Total', UI.moeda(valores.total));
    item('Data', data ? UI.dataLonga(data) : 'escolha a data');
    item('Horário', horario || 'escolha o horário');
    item('Previsão de entrega', previsao ? UI.dataHora(previsao) : '—');
    item('Leva e traz', $('agendar-leva-traz').checked ? 'Sim (buscamos e devolvemos)' : 'Não');
    if (estado.resgate) resumo.append(UI.criar('span', 'selo', 'Fidelidade'));
    resumo.append(lista);
  }

  function atualizar() {
    renderizarGrade();
    renderizarResumo();
  }

  /* ---------- Leva e traz + ViaCEP ---------- */

  function preencherEndereco(endereco) {
    $('agendar-logradouro').value = endereco.logradouro || '';
    $('agendar-bairro').value = endereco.bairro || '';
    $('agendar-cidade').value = endereco.cidade || '';
    $('agendar-uf').value = endereco.uf || '';
  }

  async function buscarCep() {
    const status = $('cep-status');
    const cep = $('agendar-cep').value;
    if (cep.replace(/\D/g, '').length !== 8) return;
    status.textContent = 'Buscando endereço…';
    $('agendar-cep').setAttribute('aria-busy', 'true');
    try {
      preencherEndereco(await Api.viacep(cep));
      status.textContent = 'Endereço encontrado. Confira e informe o número.';
      $('agendar-numero').focus();
    } catch (erro) {
      status.textContent =
        erro.codigo === 'NAO_ENCONTRADO' || erro.codigo === 'INVALIDO'
          ? erro.message
          : 'Não conseguimos consultar o CEP agora (' + erro.message.toLowerCase() + ') Preencha o endereço manualmente.';
      $('agendar-logradouro').focus();
    } finally {
      $('agendar-cep').removeAttribute('aria-busy');
    }
  }

  function aoMarcarLevaTraz() {
    const ligado = $('agendar-leva-traz').checked;
    $('endereco-leva-traz').disabled = !ligado;
    if (ligado && !$('agendar-cep').value) {
      // Formulário que lembra: o último endereço usado já vem preenchido
      const salvo = AppStorage.obterPreferencias().endereco;
      if (salvo) {
        $('agendar-cep').value = salvo.cep;
        $('agendar-numero').value = salvo.numero;
        $('agendar-complemento').value = salvo.complemento || '';
        preencherEndereco(salvo);
      }
    }
    renderizarResumo();
  }

  /* ---------- Confirmação ---------- */

  function mostrarErro(mensagem, campo) {
    const erro = $('agendar-erro');
    erro.textContent = mensagem;
    erro.hidden = false;
    if (campo) campo.focus();
  }

  function lerEndereco() {
    return {
      cep: $('agendar-cep').value,
      logradouro: $('agendar-logradouro').value.trim(),
      numero: $('agendar-numero').value.trim(),
      complemento: $('agendar-complemento').value.trim(),
      bairro: $('agendar-bairro').value.trim(),
      cidade: $('agendar-cidade').value.trim(),
      uf: $('agendar-uf').value.trim().toUpperCase(),
    };
  }

  function aoEnviar(evento) {
    evento.preventDefault();
    $('agendar-erro').hidden = true;
    const veiculo = veiculoEscolhido();
    const servico = servicoEscolhido();
    const data = $('agendar-data').value;
    const horario = horarioEscolhido();
    if (!veiculo) return mostrarErro('Escolha o veículo (ou cadastre um em "Meus Veículos").', $('agendar-veiculo'));
    if (!servico) return mostrarErro('Escolha o serviço.', $('agendar-servico'));
    if (!data || data < UI.dataIso()) return mostrarErro('Escolha uma data a partir de hoje.', $('agendar-data'));
    if (!horario) return mostrarErro('Escolha um horário livre na grade.', $('agendar-data'));

    // Conflito de horário: alguém pode ter agendado em outra aba enquanto você escolhia
    const ainda = gradeDoDia(data, servico, AppStorage.listarAgendamentos()).slots.find((s) => s.horario === horario);
    if (!ainda || !ainda.livre) {
      renderizarGrade();
      return mostrarErro('Esse horário acabou de ser ocupado. Escolha outro.', $('agendar-data'));
    }

    const levaTraz = $('agendar-leva-traz').checked;
    let endereco = null;
    if (levaTraz) {
      endereco = lerEndereco();
      const faltando = ['cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf'].find((c) => !endereco[c]);
      if (faltando) return mostrarErro('Complete o endereço do leva e traz (falta: ' + faltando + ').', $('agendar-' + faltando));
    }

    const valores = calcularValores();
    try {
      const agendamento = AppStorage.criarAgendamento({
        veiculoId: veiculo.id,
        servicoId: servico.id,
        data: data,
        horario: horario,
        levaTraz: levaTraz,
        endereco: endereco,
        observacoes: $('agendar-observacoes').value.trim(),
        valor: valores.total,
        taxaLevaTraz: valores.taxa,
        protocolo: gerarProtocolo(),
        previsaoEntrega: previsaoEntrega(data, horario, servico).toISOString(),
        fidelidade: estado.resgate,
      });
      if (estado.resgate) AppStorage.resgatarPolimento(agendamento.id); // zera o cartão só agora, na confirmação
      AppStorage.salvarPreferencias({ ultimoVeiculo: veiculo.id, endereco: endereco || AppStorage.obterPreferencias().endereco });
      estado.resgate = false;
      UI.toast('Agendamento confirmado! Protocolo ' + agendamento.protocolo, { tipo: 'sucesso' });
      $('form-agendamento').reset();
      $('endereco-leva-traz').disabled = true;
      renderizarConfirmacao(agendamento);
      UI.avisarMudanca('agendamentos');
    } catch (erro) {
      UI.toastErro(erro);
    }
  }

  /** Card de confirmação: protocolo, calendário e cancelamento. */
  function renderizarConfirmacao(agendamento) {
    const caixa = $('agendar-confirmacao');
    caixa.replaceChildren();
    const servico = Servicos.obter(agendamento.servicoId);
    const card = UI.criar('article', 'cartao confirmacao-card');
    card.dataset.id = agendamento.id;
    const titulo = UI.criar('h3', null, agendamento.status === 'cancelado' ? 'Agendamento cancelado' : 'Agendamento confirmado');
    titulo.tabIndex = -1;
    card.append(titulo);
    card.append(UI.criar('p', 'protocolo', 'Protocolo ' + agendamento.protocolo));
    card.append(
      UI.criar(
        'p',
        null,
        servico.nome + ' · ' + UI.dataLonga(agendamento.data) + ' às ' + agendamento.horario + ' · ' + UI.moeda(agendamento.valor)
      )
    );
    if (agendamento.previsaoEntrega) {
      card.append(UI.criar('p', 'dica', 'Previsão de entrega: ' + UI.dataHora(agendamento.previsaoEntrega)));
    }
    if (agendamento.status !== 'cancelado') {
      const acoes = UI.criar('div', 'servico-acoes');
      acoes.append(
        UI.botao('Adicionar ao calendário', 'btn btn-primario', { acao: 'ics' }),
        UI.botao('Cancelar agendamento', 'btn btn-secundario', { acao: 'cancelar' })
      );
      card.append(acoes);
    }
    caixa.append(card);
    titulo.focus();
  }

  /**
   * Cancela com confirmação (libera o horário na hora).
   * @param {string} id
   * @returns {Promise<boolean>} true se cancelou.
   */
  async function cancelar(id) {
    const agendamento = AppStorage.listarAgendamentos().find((a) => a.id === id);
    if (!agendamento) return false;
    const ok = await UI.confirmar({
      titulo: 'Cancelar agendamento?',
      mensagem: 'Protocolo ' + (agendamento.protocolo || '—') + '. O horário fica livre para outra pessoa.',
      confirmar: 'Cancelar agendamento',
    });
    if (!ok) return false;
    try {
      AppStorage.cancelarAgendamento(id);
      UI.toast('Agendamento cancelado. O horário foi liberado.', { tipo: 'info' });
      UI.avisarMudanca('agendamentos');
      return true;
    } catch (erro) {
      UI.toastErro(erro);
      return false;
    }
  }

  /**
   * Pré-preenche o formulário (usado por "Agendar novamente" e pelo resgate).
   * @param {{veiculoId?: string, servicoId?: string}} dados
   */
  function preencher(dados) {
    preencherVeiculos();
    if (dados.veiculoId) $('agendar-veiculo').value = dados.veiculoId;
    if (dados.servicoId) $('agendar-servico').value = dados.servicoId;
    atualizar();
    Rotas.ir('agendar'); // abre a página Agendar (já preenchida)
    $('agendar-data').focus({ preventScroll: true });
  }

  /** Resgate do cartão fidelidade: Polimento de Refino por R$ 0,00. */
  function prepararResgate() {
    estado.resgate = true;
    preencher({ servicoId: SERVICO_RESGATE });
    UI.toast('Polimento de Refino por R$ 0,00. Escolha a data e confirme para usar o prêmio.', { tipo: 'sucesso' });
  }

  function iniciar() {
    const form = $('form-agendamento');
    if (!form) return;
    form.noValidate = true; // a validação é nossa, com mensagens que explicam o que fazer
    $('agendar-data').min = UI.dataIso(); // o calendário não deixa escolher o passado
    preencherVeiculos();

    form.addEventListener('change', function (evento) {
      if (evento.target.id === 'agendar-servico' && estado.resgate && evento.target.value !== SERVICO_RESGATE) {
        estado.resgate = false;
        UI.toast('O prêmio de fidelidade vale só para o Polimento de Refino.', { tipo: 'info' });
      }
      if (evento.target.id === 'agendar-leva-traz') return aoMarcarLevaTraz();
      if (evento.target.name === 'horario') return renderizarResumo();
      atualizar();
    });
    $('agendar-cep').addEventListener('input', function (evento) {
      const n = evento.target.value.replace(/\D/g, '').slice(0, 8);
      evento.target.value = n.length > 5 ? n.slice(0, 5) + '-' + n.slice(5) : n; // máscara 00000-000
      if (n.length === 8) buscarCep();
    });
    form.addEventListener('submit', aoEnviar);

    $('agendar-confirmacao').addEventListener('click', async function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      const id = alvo.closest('.confirmacao-card').dataset.id;
      const agendamento = AppStorage.listarAgendamentos().find((a) => a.id === id);
      if (alvo.dataset.acao === 'ics') {
        UI.baixarArquivo('agendamento-' + agendamento.protocolo + '.ics', gerarIcs(agendamento), 'text/calendar');
      }
      if (alvo.dataset.acao === 'cancelar' && (await cancelar(id))) {
        renderizarConfirmacao(AppStorage.listarAgendamentos().find((a) => a.id === id));
      }
    });

    UI.aoMudarDados(function (mudanca) {
      if (mudanca.tipo === 'veiculos' || mudanca.tipo === 'tudo' || mudanca.outraAba) preencherVeiculos();
      atualizar();
    });
    atualizar();
  }

  return {
    EXPEDIENTE: EXPEDIENTE,
    TAXA_LEVA_TRAZ: TAXA_LEVA_TRAZ,
    gradeDoDia: gradeDoDia,
    previsaoEntrega: previsaoEntrega,
    diasDoServico: diasDoServico,
    gerarProtocolo: gerarProtocolo,
    gerarIcs: gerarIcs,
    iniciar: iniciar,
    preencher: preencher,
    prepararResgate: prepararResgate,
    cancelar: cancelar,
  };
})();
