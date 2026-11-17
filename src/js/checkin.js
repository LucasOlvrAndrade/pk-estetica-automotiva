/**
 * checkin.js — Checkin
 *
 * Check-in do veículo (feito pelo atendente, na página Atendimento):
 * fotos comprimidas, mapa de avarias em SVG (vista de cima), km, combustível,
 * itens deixados e observações. Ao salvar, o status vira "recebido".
 * Também desenha o RELATÓRIO que o cliente vê (galeria com lightbox,
 * mapa somente leitura e o botão "Li e concordo").
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
import { AppStorage } from './storage.js';
import { Servicos } from './servicos.js';
import { UI } from './ui.js';

export const Checkin = (function () {
  'use strict';

  const $ = UI.$;
  const MAX_FOTOS = 6;
  const SVG = 'http://www.w3.org/2000/svg';
  const ANGULOS = ['frente', 'traseira', 'lateral esquerda', 'lateral direita', 'interior', 'detalhe'];
  const TIPOS = { risco: 'Risco', amassado: 'Amassado', lascado: 'Lascado', mancha: 'Mancha', trinca: 'Trinca' };

  /** Regiões do mapa (vista de cima, frente para cima). Coordenadas no viewBox 200×400. */
  const REGIOES = [
    { id: 'para-choque-dianteiro', nome: 'Para-choque dianteiro', x: 40, y: 8, l: 120, a: 22 },
    { id: 'capo', nome: 'Capô', x: 42, y: 34, l: 116, a: 74 },
    { id: 'para-lama-dianteiro-esquerdo', nome: 'Para-lama dianteiro esquerdo', x: 14, y: 40, l: 24, a: 76 },
    { id: 'para-lama-dianteiro-direito', nome: 'Para-lama dianteiro direito', x: 162, y: 40, l: 24, a: 76 },
    { id: 'porta-dianteira-esquerda', nome: 'Porta dianteira esquerda', x: 14, y: 122, l: 24, a: 80 },
    { id: 'porta-dianteira-direita', nome: 'Porta dianteira direita', x: 162, y: 122, l: 24, a: 80 },
    { id: 'teto', nome: 'Teto', x: 46, y: 140, l: 108, a: 110 },
    { id: 'porta-traseira-esquerda', nome: 'Porta traseira esquerda', x: 14, y: 208, l: 24, a: 80 },
    { id: 'porta-traseira-direita', nome: 'Porta traseira direita', x: 162, y: 208, l: 24, a: 80 },
    { id: 'para-lama-traseiro-esquerdo', nome: 'Para-lama traseiro esquerdo', x: 14, y: 294, l: 24, a: 70 },
    { id: 'para-lama-traseiro-direito', nome: 'Para-lama traseiro direito', x: 162, y: 294, l: 24, a: 70 },
    { id: 'porta-malas', nome: 'Porta-malas', x: 42, y: 296, l: 116, a: 66 },
    { id: 'para-choque-traseiro', nome: 'Para-choque traseiro', x: 40, y: 370, l: 120, a: 22 },
  ];

  /** Estado do formulário aberto. */
  const estado = { agendamentoId: null, fotos: [], avarias: {}, regiaoAtual: null };

  /* =====================================================================
   * 1. MAPA DE AVARIAS (SVG)
   * ===================================================================== */

  function nomeRegiao(id) {
    const r = REGIOES.find((x) => x.id === id);
    return r ? r.nome : id;
  }

  function el(tag, atributos) {
    const e = document.createElementNS(SVG, tag);
    Object.keys(atributos).forEach(function (chave) {
      e.setAttribute(chave, atributos[chave]);
    });
    return e;
  }

  /**
   * Desenha o mapa.
   * @param {HTMLElement} container
   * @param {Object<string,string>} avarias { regiaoId: tipo }
   * @param {boolean} editavel true = regiões focáveis e clicáveis.
   */
  function desenharMapa(container, avarias, editavel) {
    container.replaceChildren();
    const lista = Object.keys(avarias);
    const svg = el('svg', { viewBox: '0 0 200 400', class: 'mapa-svg' + (editavel ? ' mapa-svg--editavel' : '') });
    if (!editavel) {
      // Somente leitura: o desenho todo vira UMA imagem com descrição em texto
      svg.setAttribute('role', 'img');
      svg.setAttribute(
        'aria-label',
        lista.length
          ? 'Mapa de avarias: ' + lista.map((id) => nomeRegiao(id) + ' com ' + TIPOS[avarias[id]].toLowerCase()).join('; ')
          : 'Mapa de avarias: nenhuma avaria registrada'
      );
    }
    // Contorno da carroceria e para-brisas (decorativos)
    svg.append(el('rect', { x: 10, y: 4, width: 180, height: 392, rx: 46, class: 'mapa-carroceria', 'aria-hidden': 'true' }));
    svg.append(el('rect', { x: 46, y: 112, width: 108, height: 26, rx: 6, class: 'mapa-vidro', 'aria-hidden': 'true' }));
    svg.append(el('rect', { x: 46, y: 252, width: 108, height: 40, rx: 6, class: 'mapa-vidro', 'aria-hidden': 'true' }));

    REGIOES.forEach(function (r) {
      const tipo = avarias[r.id];
      const forma = el('rect', { x: r.x, y: r.y, width: r.l, height: r.a, rx: 6, class: 'mapa-regiao' });
      forma.dataset.regiao = r.id;
      if (tipo) forma.dataset.tipo = tipo;
      if (editavel) {
        forma.setAttribute('tabindex', '0'); // focável pelo Tab
        forma.setAttribute('role', 'button');
        forma.setAttribute('aria-label', r.nome + ': ' + (tipo ? TIPOS[tipo] : 'sem avaria'));
      } else {
        forma.setAttribute('aria-hidden', 'true');
      }
      svg.append(forma);
      if (tipo) {
        const marca = el('text', { x: r.x + r.l / 2, y: r.y + r.a / 2 + 4, class: 'mapa-marca', 'aria-hidden': 'true' });
        marca.textContent = TIPOS[tipo][0]; // R, A, L, M, T
        svg.append(marca);
      }
    });
    container.append(svg);
  }

  /** Legenda em texto: a cor nunca é a única informação. */
  function desenharLegenda(lista, avarias) {
    lista.replaceChildren();
    const ids = Object.keys(avarias);
    if (!ids.length) {
      lista.append(UI.criar('li', 'texto-suave', 'Nenhuma avaria registrada.'));
      return;
    }
    ids.forEach(function (id) {
      const item = UI.criar('li');
      const amostra = UI.criar('span', 'legenda-cor');
      amostra.dataset.tipo = avarias[id];
      amostra.setAttribute('aria-hidden', 'true');
      item.append(amostra, nomeRegiao(id) + ' — ' + TIPOS[avarias[id]]);
      lista.append(item);
    });
  }

  function redesenharMapaEditavel() {
    desenharMapa($('checkin-mapa'), estado.avarias, true);
    desenharLegenda($('checkin-legenda'), estado.avarias);
  }

  /** Clique/Enter numa região: mostra a escolha do tipo de avaria. */
  function escolherRegiao(regiaoId) {
    estado.regiaoAtual = regiaoId;
    $('avaria-escolha').hidden = false;
    $('avaria-rotulo').textContent = 'Tipo de avaria — ' + nomeRegiao(regiaoId);
    $('avaria-tipo').value = estado.avarias[regiaoId] || '';
    $('avaria-tipo').focus();
  }

  /* =====================================================================
   * 2. FOTOS
   * ===================================================================== */

  function desenharPrevias() {
    const lista = $('checkin-previa');
    lista.replaceChildren();
    estado.fotos.forEach(function (foto, i) {
      const item = UI.criar('li', 'previa-item');
      const img = UI.criar('img');
      img.src = foto.dataUrl;
      img.alt = 'Foto ' + (i + 1) + ' do check-in – ' + foto.legenda;
      const campo = UI.criar('label', 'previa-angulo');
      campo.append('Ângulo ');
      const select = UI.criar('select');
      select.dataset.indice = i;
      ANGULOS.forEach(function (a) {
        select.append(new Option(a, a, false, a === foto.legenda));
      });
      campo.append(select);
      const remover = UI.botao('Remover', 'btn btn-secundario btn-pequeno', { remover: i });
      remover.setAttribute('aria-label', 'Remover foto ' + (i + 1));
      item.append(img, UI.criar('span', 'previa-tamanho', UI.bytes(foto.bytes)), campo, remover);
      lista.append(item);
    });
    const total = estado.fotos.reduce((s, f) => s + f.bytes, 0);
    $('checkin-fotos-info').textContent =
      estado.fotos.length + ' de ' + MAX_FOTOS + ' fotos · ' + UI.bytes(total) + ' no total (reduzidas para no máximo 1024 px).';
  }

  async function aoEscolherFotos(evento) {
    const arquivos = Array.from(evento.target.files || []);
    const espaco = MAX_FOTOS - estado.fotos.length;
    if (arquivos.length > espaco) {
      UI.toast('Máximo de ' + MAX_FOTOS + ' fotos. Só as ' + Math.max(espaco, 0) + ' primeiras foram usadas.', { tipo: 'alerta' });
    }
    $('checkin-fotos-info').textContent = 'Reduzindo as fotos…';
    for (const arquivo of arquivos.slice(0, Math.max(espaco, 0))) {
      try {
        const reduzida = await UI.comprimirImagem(arquivo);
        reduzida.legenda = ANGULOS[estado.fotos.length] || 'detalhe';
        estado.fotos.push(reduzida);
      } catch (erro) {
        UI.toastErro(erro);
      }
    }
    evento.target.value = ''; // permite escolher a mesma foto de novo
    desenharPrevias();
  }

  /* =====================================================================
   * 3. ABRIR E SALVAR O CHECK-IN
   * ===================================================================== */

  /**
   * Abre o diálogo de check-in de um agendamento.
   * @param {string} agendamentoId
   */
  function abrir(agendamentoId) {
    const agendamento = AppStorage.listarAgendamentos().find((a) => a.id === agendamentoId);
    if (!agendamento) return;
    const veiculo = AppStorage.listarVeiculos().find((v) => v.id === agendamento.veiculoId);
    const servico = Servicos.obter(agendamento.servicoId);
    estado.agendamentoId = agendamentoId;
    estado.fotos = [];
    estado.avarias = {};
    estado.regiaoAtual = null;
    $('form-checkin').reset();
    $('checkin-combustivel-valor').textContent = '50%';
    $('avaria-escolha').hidden = true;
    $('checkin-erro').hidden = true;
    $('checkin-resumo').textContent =
      (veiculo ? veiculo.marca + ' ' + veiculo.modelo + ' · ' + veiculo.placa + ' · ' : '') +
      (servico ? servico.nome : '') +
      ' · protocolo ' + (agendamento.protocolo || '—');
    desenharPrevias();
    redesenharMapaEditavel();
    UI.abrirDialogo($('dialog-checkin'));
  }

  function mostrarErro(mensagem) {
    const erro = $('checkin-erro');
    erro.textContent = mensagem;
    erro.hidden = false;
    erro.scrollIntoView({ block: 'nearest' });
  }

  function aoSalvar(evento) {
    evento.preventDefault();
    const km = $('checkin-km').value;
    if (km === '' || Number(km) < 0) {
      mostrarErro('Informe a quilometragem do painel (só números).');
      $('checkin-km').focus();
      return;
    }
    const dados = {
      fotos: estado.fotos.map((f) => ({ dataUrl: f.dataUrl, legenda: f.legenda })),
      avarias: Object.keys(estado.avarias).map((id) => ({ regiao: id, tipo: estado.avarias[id] })),
      km: Number(km),
      combustivel: Number($('checkin-combustivel').value),
      itens: $('checkin-itens').value.trim(),
      observacoes: $('checkin-observacoes').value.trim(),
    };
    try {
      AppStorage.salvarCheckin(estado.agendamentoId, dados);
    } catch (erro) {
      if (erro.codigo === AppStorage.CODIGO_QUOTA) {
        const total = estado.fotos.reduce((s, f) => s + f.bytes, 0);
        mostrarErro(
          'As fotos (' + UI.bytes(total) + ') não cabem no armazenamento do navegador, que guarda cerca de 5 MB no total. ' +
            'Remova algumas fotos e tente de novo.'
        );
      } else {
        mostrarErro(erro.message);
      }
      return;
    }
    try {
      AppStorage.atualizarStatus(estado.agendamentoId, AppStorage.STATUS.RECEBIDO);
    } catch (erro) {
      // já estava "recebido": só o check-in foi atualizado
    }
    $('dialog-checkin').close();
    UI.toast('Check-in salvo. O cliente já pode conferir o relatório.', { tipo: 'sucesso' });
    UI.avisarMudanca('agendamentos');
  }

  /* =====================================================================
   * 4. RELATÓRIO (o que o cliente vê) E LIGHTBOX
   * ===================================================================== */

  /** Converte check-ins antigos (fotos como texto, avarias como texto) para o formato atual. */
  function normalizar(checkin) {
    const fotos = (checkin.fotos || []).map(function (f) {
      return typeof f === 'string' ? { dataUrl: f, legenda: 'detalhe' } : f;
    });
    const avarias = {};
    (checkin.avarias || []).forEach(function (a) {
      if (typeof a === 'object' && a.regiao) avarias[a.regiao] = a.tipo;
    });
    return Object.assign({}, checkin, { fotos: fotos, avariasMapa: avarias });
  }

  const lightbox = { fotos: [], indice: 0 };

  function mostrarFoto() {
    const foto = lightbox.fotos[lightbox.indice];
    $('foto-ampliada').src = foto.dataUrl;
    $('foto-ampliada').alt = 'Foto ' + (lightbox.indice + 1) + ' do check-in – ' + foto.legenda;
    $('foto-legenda').textContent = 'Foto ' + (lightbox.indice + 1) + ' de ' + lightbox.fotos.length + ' – ' + foto.legenda;
  }

  /**
   * Abre a foto ampliada (setas ← → e os botões navegam; Esc fecha).
   * @param {Object[]} fotos
   * @param {number} indice
   */
  function abrirFoto(fotos, indice) {
    lightbox.fotos = fotos;
    lightbox.indice = indice;
    mostrarFoto();
    UI.abrirDialogo($('dialog-foto'));
  }

  function navegar(passo) {
    lightbox.indice = (lightbox.indice + passo + lightbox.fotos.length) % lightbox.fotos.length;
    mostrarFoto();
  }

  /**
   * Desenha o relatório de check-in.
   * @param {HTMLElement} container
   * @param {string} agendamentoId
   * @param {{permitirConfirmar?: boolean}} [opcoes]
   * @returns {boolean} false se ainda não houver check-in.
   */
  function renderizarRelatorio(container, agendamentoId, opcoes) {
    container.replaceChildren();
    const bruto = AppStorage.obterCheckin(agendamentoId);
    if (!bruto) {
      container.append(UI.criar('p', 'vazio', 'O check-in aparece aqui quando a estética receber o veículo.'));
      return false;
    }
    const checkin = normalizar(bruto);

    // Galeria
    const galeria = UI.criar('ul', 'galeria');
    galeria.setAttribute('aria-label', 'Fotos do check-in');
    checkin.fotos.forEach(function (foto, i) {
      const item = UI.criar('li');
      const botaoFoto = UI.criar('button', 'galeria-botao');
      botaoFoto.type = 'button';
      botaoFoto.setAttribute('aria-label', 'Ampliar foto ' + (i + 1) + ' – ' + foto.legenda);
      const img = UI.criar('img');
      img.src = foto.dataUrl;
      img.alt = 'Foto ' + (i + 1) + ' do check-in – ' + foto.legenda;
      img.loading = 'lazy';
      botaoFoto.append(img);
      botaoFoto.addEventListener('click', function () {
        abrirFoto(checkin.fotos, i);
      });
      item.append(botaoFoto);
      galeria.append(item);
    });
    if (!checkin.fotos.length) galeria.append(UI.criar('li', 'texto-suave', 'Sem fotos.'));

    // Mapa somente leitura + legenda
    const mapaArea = UI.criar('div', 'mapa-avarias-area');
    const mapa = UI.criar('div', 'mapa-avarias');
    desenharMapa(mapa, checkin.avariasMapa, false);
    const legenda = UI.criar('ul', 'legenda-avarias');
    desenharLegenda(legenda, checkin.avariasMapa);
    mapaArea.append(mapa, legenda);

    // Dados
    const dados = UI.criar('dl', 'resumo-lista');
    [
      ['Registrado em', UI.dataHora(checkin.registradoEm)],
      ['Quilometragem', checkin.km !== undefined ? checkin.km.toLocaleString('pt-BR') + ' km' : '—'],
      ['Combustível', checkin.combustivel !== undefined ? checkin.combustivel + '%' : '—'],
      ['Itens deixados', checkin.itens || 'nenhum'],
      ['Observações', checkin.observacoes || '—'],
    ].forEach(function (par) {
      const grupo = UI.criar('div');
      grupo.append(UI.criar('dt', null, par[0]), UI.criar('dd', null, par[1]));
      dados.append(grupo);
    });

    container.append(galeria, mapaArea, dados);

    // Confirmação do cliente
    if (checkin.confirmado) {
      container.append(UI.criar('p', 'confirmado', '✓ Você confirmou o estado registrado em ' + UI.dataHora(checkin.confirmadoEm) + '.'));
    } else if (opcoes && opcoes.permitirConfirmar) {
      const confirmar = UI.botao('Li e concordo com o estado registrado', 'btn btn-primario');
      confirmar.addEventListener('click', function () {
        AppStorage.confirmarCheckin(agendamentoId);
        UI.toast('Obrigado! Sua confirmação foi registrada.', { tipo: 'sucesso' });
        UI.avisarMudanca('checkins');
      });
      container.append(confirmar);
    }
    return true;
  }

  /* =====================================================================
   * 5. INICIALIZAÇÃO
   * ===================================================================== */

  function iniciar() {
    const form = $('form-checkin');
    if (!form) return;
    $('checkin-fotos').addEventListener('change', aoEscolherFotos);
    $('checkin-previa').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-remover]');
      if (!alvo) return;
      estado.fotos.splice(Number(alvo.dataset.remover), 1);
      desenharPrevias();
      $('checkin-fotos').focus();
    });
    $('checkin-previa').addEventListener('change', function (evento) {
      if (evento.target.dataset.indice === undefined) return;
      estado.fotos[Number(evento.target.dataset.indice)].legenda = evento.target.value;
      desenharPrevias();
    });
    $('checkin-combustivel').addEventListener('input', function (evento) {
      $('checkin-combustivel-valor').textContent = evento.target.value + '%';
    });

    // Mapa: clique ou Enter/Espaço numa região
    const mapa = $('checkin-mapa');
    mapa.addEventListener('click', function (evento) {
      const regiao = evento.target.closest('[data-regiao]');
      if (regiao) escolherRegiao(regiao.dataset.regiao);
    });
    mapa.addEventListener('keydown', function (evento) {
      const regiao = evento.target.closest('[data-regiao]');
      if (regiao && (evento.key === 'Enter' || evento.key === ' ')) {
        evento.preventDefault();
        escolherRegiao(regiao.dataset.regiao);
      }
    });
    $('avaria-tipo').addEventListener('change', function (evento) {
      const regiao = estado.regiaoAtual;
      if (!regiao) return;
      if (evento.target.value) estado.avarias[regiao] = evento.target.value;
      else delete estado.avarias[regiao];
      redesenharMapaEditavel();
      const forma = mapa.querySelector('[data-regiao="' + regiao + '"]');
      if (forma) forma.focus(); // volta para a mesma região do mapa
    });

    form.addEventListener('submit', aoSalvar);

    $('foto-anterior').addEventListener('click', function () {
      navegar(-1);
    });
    $('foto-proxima').addEventListener('click', function () {
      navegar(1);
    });
    $('dialog-foto').addEventListener('keydown', function (evento) {
      if (evento.key === 'ArrowLeft') navegar(-1);
      if (evento.key === 'ArrowRight') navegar(1);
    });
  }

  return {
    REGIOES: REGIOES,
    TIPOS: TIPOS,
    abrir: abrir,
    renderizarRelatorio: renderizarRelatorio,
    abrirFoto: abrirFoto,
    iniciar: iniciar,
  };
})();
