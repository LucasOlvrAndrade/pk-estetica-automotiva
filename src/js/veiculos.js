/**
 * veiculos.js: Veiculos
 *
 * Seção "Meus Veículos": formulário com a tabela FIPE (Marca → Modelo → Ano),
 * placa com máscara (padrão antigo ABC-1234 ou Mercosul ABC1D23), cards com
 * editar e remover, e estado vazio.
 * Se a FIPE falhar (offline, lenta, fora do ar), os selects viram campos de texto.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
import { AppStorage } from './storage.js';
import { Servicos } from './servicos.js';
import { Api } from './api.js';
import { UI } from './ui.js';

export const Veiculos = (function () {
  'use strict';

  const $ = UI.$;
  const PLACA_ANTIGA = /^[A-Z]{3}\d{4}$/; // ABC1234 (mostrada como ABC-1234)
  const PLACA_MERCOSUL = /^[A-Z]{3}\d[A-Z]\d{2}$/; // ABC1D23
  const AVISO_FIPE = 'Não conseguimos carregar a tabela FIPE, digite manualmente.';

  let modoManual = false;
  let marcasCarregadas = false;

  /* =====================================================================
   * 1. PLACA (funções puras)
   * ===================================================================== */

  /**
   * Só letras e números, em maiúsculas, no máximo 7 caracteres.
   * @param {string} texto
   * @returns {string}
   */
  function limparPlaca(texto) {
    return String(texto || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  }

  /**
   * A placa (sem hífen) está num dos dois padrões brasileiros?
   * @param {string} placa
   * @returns {boolean}
   */
  function placaValida(placa) {
    const limpa = limparPlaca(placa);
    return PLACA_ANTIGA.test(limpa) || PLACA_MERCOSUL.test(limpa);
  }

  /**
   * Formata para exibir: o padrão antigo ganha hífen (ABC-1234); o Mercosul não tem.
   * @param {string} placa
   * @returns {string}
   */
  function formatarPlaca(placa) {
    const limpa = limparPlaca(placa);
    // 5º caractere é número → padrão antigo (no Mercosul ele é letra)
    if (limpa.length >= 5 && /\d/.test(limpa[4])) return limpa.slice(0, 3) + '-' + limpa.slice(3);
    return limpa;
  }

  /* =====================================================================
   * 2. SELECTS DA FIPE
   * ===================================================================== */

  /**
   * Troca as opções de um select. A 1ª opção (value="") é o texto de orientação.
   * @param {HTMLSelectElement} select
   * @param {string} orientacao
   * @param {{codigo: string, nome: string}[]} itens
   */
  function preencherSelect(select, orientacao, itens) {
    select.replaceChildren(new Option(orientacao, ''));
    itens.forEach(function (item) {
      select.append(new Option(item.nome, item.codigo));
    });
  }

  /**
   * Estado "carregando" de um select: desabilitado + aria-busy (o CSS mostra o spinner).
   */
  function carregando(select, ligado, texto) {
    select.disabled = ligado;
    select.setAttribute('aria-busy', String(ligado));
    if (ligado) select.replaceChildren(new Option(texto, ''));
  }

  /**
   * A FIPE falhou: troca os selects por campos de texto e avisa.
   */
  function entrarModoManual() {
    modoManual = true;
    document.querySelectorAll('#form-veiculo .campo-fipe').forEach(function (campo) {
      campo.hidden = true;
      campo.querySelector('select').disabled = true;
    });
    document.querySelectorAll('#form-veiculo .campo-manual').forEach(function (campo) {
      campo.hidden = false;
      const entrada = campo.querySelector('input');
      entrada.disabled = false;
      entrada.required = true;
    });
    const aviso = $('fipe-aviso');
    aviso.textContent = AVISO_FIPE;
    aviso.hidden = false;
  }

  /** Carrega as marcas (só uma vez por página; o cache evita repetir a busca). */
  async function carregarMarcas() {
    if (marcasCarregadas || modoManual) return;
    const select = $('veiculo-marca');
    carregando(select, true, 'Carregando marcas…');
    try {
      preencherSelect(select, 'Selecione a marca', await Api.fipe.listarMarcas());
      carregando(select, false);
      marcasCarregadas = true;
    } catch (erro) {
      entrarModoManual();
    }
  }

  async function aoEscolherMarca() {
    const modelo = $('veiculo-modelo');
    const ano = $('veiculo-ano');
    preencherSelect(ano, 'Escolha o modelo primeiro', []);
    ano.disabled = true;
    if (!$('veiculo-marca').value) {
      preencherSelect(modelo, 'Escolha a marca primeiro', []);
      modelo.disabled = true;
      return;
    }
    carregando(modelo, true, 'Carregando modelos…');
    try {
      preencherSelect(modelo, 'Selecione o modelo', await Api.fipe.listarModelos($('veiculo-marca').value));
      carregando(modelo, false);
    } catch (erro) {
      entrarModoManual();
    }
  }

  async function aoEscolherModelo() {
    const ano = $('veiculo-ano');
    if (!$('veiculo-modelo').value) {
      preencherSelect(ano, 'Escolha o modelo primeiro', []);
      ano.disabled = true;
      return;
    }
    carregando(ano, true, 'Carregando anos…');
    try {
      const anos = await Api.fipe.listarAnos($('veiculo-marca').value, $('veiculo-modelo').value);
      preencherSelect(ano, 'Selecione o ano', anos);
      carregando(ano, false);
    } catch (erro) {
      entrarModoManual();
    }
  }

  /**
   * Na edição, tenta reencontrar marca, modelo e ano nos selects pelo nome salvo.
   * Se algo não bater, passa para o modo manual já preenchido.
   * @param {Object} veiculo
   */
  async function selecionarNaFipe(veiculo) {
    function escolher(select, comparar) {
      const opcao = Array.from(select.options).find(function (o) {
        return o.value && comparar(o.text);
      });
      if (opcao) select.value = opcao.value;
      return Boolean(opcao);
    }
    await carregarMarcas();
    if (!modoManual && escolher($('veiculo-marca'), (t) => t === veiculo.marca)) {
      await aoEscolherMarca();
      if (!modoManual && escolher($('veiculo-modelo'), (t) => t === veiculo.modelo)) {
        await aoEscolherModelo();
        if (!modoManual && escolher($('veiculo-ano'), (t) => t.indexOf(String(veiculo.ano)) === 0)) return;
      }
    }
    if (!modoManual) entrarModoManual();
    $('veiculo-marca-texto').value = veiculo.marca;
    $('veiculo-modelo-texto').value = veiculo.modelo;
    $('veiculo-ano-texto').value = veiculo.ano || '';
  }

  /* =====================================================================
   * 3. FORMULÁRIO
   * ===================================================================== */

  /**
   * Abre o formulário (novo ou edição).
   * @param {Object} [veiculo] Se vier, o formulário entra em modo edição.
   */
  function abrirFormulario(veiculo) {
    const form = $('form-veiculo');
    form.reset();
    $('veiculo-id').value = veiculo ? veiculo.id : '';
    $('form-veiculo-titulo').textContent = veiculo ? 'Editar veículo' : 'Novo veículo';
    $('veiculo-erro').hidden = true;
    form.hidden = false;
    $('btn-cadastrar-veiculo').setAttribute('aria-expanded', 'true');
    if (veiculo) {
      $('veiculo-placa').value = formatarPlaca(veiculo.placa);
      $('veiculo-cor').value = veiculo.cor;
      $('veiculo-porte').value = veiculo.porte;
      selecionarNaFipe(veiculo);
    } else {
      carregarMarcas();
    }
    form.scrollIntoView({ block: 'start' });
    (modoManual ? $('veiculo-marca-texto') : $('veiculo-marca')).focus({ preventScroll: true });
  }

  function fecharFormulario() {
    $('form-veiculo').hidden = true;
    $('btn-cadastrar-veiculo').setAttribute('aria-expanded', 'false');
    $('btn-cadastrar-veiculo').focus();
  }

  /** Mostra um erro no formulário e põe o foco no campo com problema. */
  function mostrarErro(mensagem, campo) {
    const erro = $('veiculo-erro');
    erro.textContent = mensagem;
    erro.hidden = false;
    if (campo) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
    }
  }

  /** Lê o formulário (do modo FIPE ou do modo manual). */
  function lerFormulario() {
    let marca;
    let modelo;
    let ano;
    if (modoManual) {
      marca = $('veiculo-marca-texto').value.trim();
      modelo = $('veiculo-modelo-texto').value.trim();
      ano = $('veiculo-ano-texto').value;
    } else {
      const sMarca = $('veiculo-marca');
      const sModelo = $('veiculo-modelo');
      const sAno = $('veiculo-ano');
      marca = sMarca.value ? sMarca.selectedOptions[0].text : '';
      modelo = sModelo.value ? sModelo.selectedOptions[0].text : '';
      ano = sAno.value ? parseInt(sAno.selectedOptions[0].text, 10) : ''; // "2015 Gasolina" → 2015
    }
    return {
      id: $('veiculo-id').value || undefined,
      marca: marca,
      modelo: modelo,
      ano: ano,
      placa: limparPlaca($('veiculo-placa').value),
      cor: $('veiculo-cor').value.trim(),
      porte: $('veiculo-porte').value,
    };
  }

  function aoEnviar(evento) {
    evento.preventDefault();
    const form = $('form-veiculo');
    form.querySelectorAll('[aria-invalid]').forEach(function (c) {
      c.removeAttribute('aria-invalid');
    });
    const dados = lerFormulario();
    const campoMarca = modoManual ? $('veiculo-marca-texto') : $('veiculo-marca');
    const campoModelo = modoManual ? $('veiculo-modelo-texto') : $('veiculo-modelo');
    const campoAno = modoManual ? $('veiculo-ano-texto') : $('veiculo-ano');

    // Prevenção de erros: cada problema diz o que fazer para resolver
    if (!dados.marca) return mostrarErro('Escolha a marca do veículo.', campoMarca);
    if (!dados.modelo) return mostrarErro('Escolha o modelo do veículo.', campoModelo);
    if (!dados.ano) return mostrarErro('Escolha o ano do veículo.', campoAno);
    if (!placaValida(dados.placa)) {
      return mostrarErro('Placa inválida. Use o padrão antigo (ABC-1234) ou o Mercosul (ABC1D23).', $('veiculo-placa'));
    }
    if (!dados.porte) return mostrarErro('Escolha o porte: ele define o preço dos serviços.', $('veiculo-porte'));

    try {
      const salvo = AppStorage.salvarVeiculo(dados);
      UI.toast((dados.id ? 'Veículo atualizado: ' : 'Veículo cadastrado: ') + salvo.marca + ' ' + salvo.modelo, {
        tipo: 'sucesso',
      });
      fecharFormulario();
      UI.avisarMudanca('veiculos');
    } catch (erro) {
      mostrarErro(erro.message, $('veiculo-placa'));
    }
  }

  /* =====================================================================
   * 4. LISTA DE CARDS
   * ===================================================================== */

  /** Agendamentos ainda ativos de um veículo (impedem a remoção). */
  function agendamentosAtivos(veiculoId) {
    return AppStorage.listarAgendamentos().filter(function (a) {
      return a.veiculoId === veiculoId && ['entregue', 'cancelado'].indexOf(a.status) === -1;
    });
  }

  function renderizar() {
    const lista = $('lista-veiculos');
    const veiculos = AppStorage.listarVeiculos();
    lista.replaceChildren();

    if (!veiculos.length) {
      const vazio = UI.criar('div', 'vazio');
      vazio.append(UI.criar('p', null, 'Nenhum veículo cadastrado ainda. Cadastre o primeiro para agendar em poucos cliques.'));
      vazio.append(UI.botao('Cadastrar meu primeiro veículo', 'btn btn-primario', { acao: 'novo' }));
      lista.append(vazio);
      return;
    }

    veiculos.forEach(function (v) {
      const card = UI.criar('article', 'cartao veiculo-card');
      card.dataset.id = v.id;
      const idTitulo = 'veiculo-titulo-' + v.id;
      card.setAttribute('aria-labelledby', idTitulo);
      const titulo = UI.criar('h3', null, v.marca + ' ' + v.modelo);
      titulo.id = idTitulo;
      const placa = UI.criar('p', 'veiculo-placa', formatarPlaca(v.placa));
      placa.setAttribute('aria-label', 'Placa ' + formatarPlaca(v.placa).split('').join(' '));
      const dados = UI.criar('dl', 'veiculo-dados');
      [
        ['Ano', v.ano || 'não informado'],
        ['Cor', v.cor || 'não informada'],
        ['Porte', Servicos.nomePorte(v.porte)],
      ].forEach(function (par) {
        const grupo = UI.criar('div');
        grupo.append(UI.criar('dt', null, par[0]), UI.criar('dd', null, par[1]));
        dados.append(grupo);
      });
      const acoes = UI.criar('div', 'servico-acoes');
      const editar = UI.botao('Editar', 'btn btn-secundario', { acao: 'editar' });
      const remover = UI.botao('Remover', 'btn btn-secundario', { acao: 'remover' });
      editar.setAttribute('aria-describedby', idTitulo);
      remover.setAttribute('aria-describedby', idTitulo);
      acoes.append(editar, remover);
      card.append(titulo, placa, dados, acoes);
      lista.append(card);
    });
  }

  /**
   * Remove com confirmação e oferece "Desfazer" (o veículo volta igual, com o mesmo id).
   * @param {string} id
   */
  async function remover(id) {
    const veiculo = AppStorage.listarVeiculos().find(function (v) {
      return v.id === id;
    });
    if (!veiculo) return;
    if (agendamentosAtivos(id).length) {
      UI.toast('Este veículo tem um serviço em andamento. Cancele ou conclua o serviço antes de remover.', {
        tipo: 'alerta',
      });
      return;
    }
    const ok = await UI.confirmar({
      titulo: 'Remover veículo?',
      mensagem: veiculo.marca + ' ' + veiculo.modelo + ' (' + formatarPlaca(veiculo.placa) + ') sairá da sua lista.',
      confirmar: 'Remover',
    });
    if (!ok) return;
    AppStorage.removerVeiculo(id);
    UI.avisarMudanca('veiculos');
    $('veiculos-titulo').focus(); // o card sumiu: o foco não pode se perder
    UI.toast('Veículo removido.', {
      tipo: 'info',
      acao: {
        rotulo: 'Desfazer',
        aoClicar: function () {
          AppStorage.salvarVeiculo(veiculo);
          UI.avisarMudanca('veiculos');
        },
      },
    });
  }

  /* =====================================================================
   * 5. INICIALIZAÇÃO
   * ===================================================================== */

  function iniciar() {
    const form = $('form-veiculo');
    if (!form) return;
    $('veiculos-titulo').tabIndex = -1; // recebe foco depois de remover um card

    $('btn-cadastrar-veiculo').addEventListener('click', function () {
      if (form.hidden) abrirFormulario();
      else fecharFormulario();
    });
    $('btn-cancelar-veiculo').addEventListener('click', fecharFormulario);
    $('veiculo-marca').addEventListener('change', aoEscolherMarca);
    $('veiculo-modelo').addEventListener('change', aoEscolherModelo);
    form.addEventListener('submit', aoEnviar);

    // Máscara da placa: maiúsculas e hífen automático no padrão antigo
    $('veiculo-placa').addEventListener('input', function (evento) {
      evento.target.value = formatarPlaca(evento.target.value);
      evento.target.removeAttribute('aria-invalid');
    });

    $('lista-veiculos').addEventListener('click', function (evento) {
      const alvo = evento.target.closest('[data-acao]');
      if (!alvo) return;
      if (alvo.dataset.acao === 'novo') return abrirFormulario();
      const id = alvo.closest('.veiculo-card').dataset.id;
      if (alvo.dataset.acao === 'editar') {
        abrirFormulario(
          AppStorage.listarVeiculos().find(function (v) {
            return v.id === id;
          })
        );
      }
      if (alvo.dataset.acao === 'remover') remover(id);
    });

    UI.aoMudarDados(renderizar);
    renderizar();
  }

  return {
    iniciar: iniciar,
    placaValida: placaValida,
    formatarPlaca: formatarPlaca,
    limparPlaca: limparPlaca,
  };
})();
