/**
 * fidelidade.js: Fidelidade
 *
 * Cartão PK Club: 5 carimbos (um por PROCEDIMENTO entregue, qualquer serviço ou pacote;
 * o próprio prêmio resgatado não conta) valem um Polimento de Refino grátis.
 * Mostra os carimbos (os novos entram com animação), quanto falta, o estado
 * "Recompensa disponível", o botão de resgate e o histórico.
 * Quem DÁ o carimbo é o acompanhamento.js, no "Entregue".
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
import { AppStorage } from './storage.js';
import { Servicos } from './servicos.js';
import { UI } from './ui.js';
import { Agenda } from './agenda.js';

export const Fidelidade = (function () {
  'use strict';

  const $ = UI.$;
  const META = AppStorage.CARIMBOS_PARA_PREMIO;
  const VALIDADE_MESES = 12;

  /** Quantos carimbos já estavam desenhados (para animar só os novos). */
  let desenhados = null;

  /**
   * Texto de quanto falta (singular e plural certos).
   * @param {number} carimbos
   * @returns {string}
   */
  function textoStatus(carimbos) {
    if (carimbos >= META) return 'Recompensa disponível! Seu Polimento de Refino está liberado.';
    const faltam = META - carimbos;
    return carimbos + ' de ' + META + ' carimbos · ' + (faltam === 1 ? 'Falta 1 procedimento' : 'Faltam ' + faltam + ' procedimentos') + ' para o seu polimento grátis.';
  }

  /** Data de validade de um carimbo (12 meses depois). */
  function validade(iso) {
    const d = new Date(iso);
    d.setMonth(d.getMonth() + VALIDADE_MESES);
    return d;
  }

  function renderizar() {
    const cartao = AppStorage.obterCartao();
    const itens = $('carimbos').querySelectorAll('.carimbo');
    itens.forEach(function (item, i) {
      const ganho = i < cartao.carimbos;
      item.classList.toggle('carimbado', ganho);
      // Na 1ª pintura os carimbos aparecem parados; depois, só os novos animam
      item.classList.toggle('sem-animacao', ganho && (desenhados === null || i < desenhados));
      item.setAttribute('aria-label', 'Carimbo ' + (i + 1) + (ganho ? ': conquistado' : ': vazio'));
    });
    desenhados = cartao.carimbos;

    const completo = cartao.carimbos >= META;
    $('cartao-fidelidade').classList.toggle('recompensa', completo);
    $('fidelidade-status').textContent = textoStatus(cartao.carimbos);
    $('btn-resgatar').hidden = !completo;

    // Histórico: carimbos e resgates, do mais recente para o mais antigo
    const lista = $('historico-carimbos');
    lista.replaceChildren();
    const eventos = cartao.historico
      .map(function (h) {
        const servico = Servicos.obter(h.servicoId);
        return {
          em: h.em,
          texto: 'Carimbo · ' + (servico ? servico.nome : 'serviço') + ' · válido até ' + UI.data(validade(h.em)),
        };
      })
      .concat(
        cartao.historicoResgates.map(function (r) {
          return { em: r.em, texto: 'Resgate · Polimento de Refino por ' + UI.moeda(0) };
        })
      )
      .sort((a, b) => b.em.localeCompare(a.em));
    if (!eventos.length) {
      lista.append(UI.criar('li', 'texto-suave', 'Nenhum carimbo ainda. Cada lavagem entregue vale um.'));
    }
    eventos.forEach(function (e) {
      const item = UI.criar('li');
      const quando = UI.criar('time', null, UI.data(e.em));
      quando.dateTime = e.em;
      item.append(quando, ': ' + e.texto);
      lista.append(item);
    });
  }

  function iniciar() {
    if (!$('cartao-fidelidade')) return;
    $('btn-resgatar').addEventListener('click', function () {
      Agenda.prepararResgate();
    });
    UI.aoMudarDados(renderizar);
    renderizar();
  }

  return { iniciar: iniciar, textoStatus: textoStatus };
})();
