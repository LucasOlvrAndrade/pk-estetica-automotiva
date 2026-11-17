/**
 * ui.js — UI
 *
 * Utilitários de interface usados por TODOS os módulos de tela:
 * criar elementos com segurança, toasts, diálogos, formatação de data,
 * compressão de imagem, download de arquivo, notificações e o "aviso de
 * dados alterados" que mantém as seções (e as abas) sincronizadas.
 *
 * Existe para não repetir o mesmo código em cada arquivo.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
import { Servicos } from './servicos.js';
import { AppStorage } from './storage.js';

export const UI = (function () {
  'use strict';

  const DURACAO_TOAST_MS = 3500;
  const DURACAO_TOAST_COM_ACAO_MS = 5000; // tempo para clicar em "Desfazer"
  const SAIDA_TOAST_MS = 150; // igual ao --dur-saida do CSS
  const MAX_TOASTS = 3;
  const EVENTO_DADOS = 'pk:dados'; // evento disparado quando qualquer dado muda

  const formatoData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const formatoDataLonga = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const formatoDataHora = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

  /* =====================================================================
   * 1. DOM
   * ===================================================================== */

  /**
   * Atalho para document.getElementById.
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  function $(id) {
    return document.getElementById(id);
  }

  /**
   * Cria um elemento já com classe e texto (textContent nunca interpreta HTML).
   * @param {string} tag
   * @param {string} [classe]
   * @param {string|number} [texto]
   * @returns {HTMLElement}
   */
  function criar(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined && texto !== null) elemento.textContent = String(texto);
    return elemento;
  }

  /**
   * Cria um <button type="button">.
   * @param {string} texto
   * @param {string} [classe='btn btn-secundario']
   * @param {Object} [dados] Atributos data-* (ex.: { acao: 'remover', id: '...' }).
   * @returns {HTMLButtonElement}
   */
  function botao(texto, classe, dados) {
    const b = criar('button', classe || 'btn btn-secundario', texto);
    b.type = 'button';
    Object.keys(dados || {}).forEach(function (chave) {
      b.dataset[chave] = dados[chave];
    });
    return b;
  }

  /**
   * Só chama a função depois que as chamadas param por `espera` ms (usado na busca).
   * @param {Function} funcao
   * @param {number} espera
   * @returns {Function}
   */
  function debounce(funcao, espera) {
    let temporizador;
    return function () {
      const argumentos = arguments;
      const contexto = this;
      clearTimeout(temporizador);
      temporizador = setTimeout(function () {
        funcao.apply(contexto, argumentos);
      }, espera);
    };
  }

  /** @returns {boolean} true se a pessoa pediu "reduzir movimento" no sistema. */
  function movimentoReduzido() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* =====================================================================
   * 2. FORMATAÇÃO
   * ===================================================================== */

  /** R$ com Intl (o formatador fica no Servicos, que é quem cuida de preços). */
  function moeda(valor) {
    return Servicos.formatarMoeda(valor);
  }

  /**
   * Converte "AAAA-MM-DD" (data sem hora) ou ISO em Date, sem o fuso deslocar o dia.
   * @param {string|Date} valor
   * @returns {Date}
   */
  function paraData(valor) {
    if (valor instanceof Date) return valor;
    if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
      const partes = valor.split('-').map(Number);
      return new Date(partes[0], partes[1] - 1, partes[2]); // meia-noite LOCAL
    }
    return new Date(valor);
  }

  /** 16/11/2026 */
  function data(valor) {
    return formatoData.format(paraData(valor));
  }

  /** segunda-feira, 16 de novembro */
  function dataLonga(valor) {
    return formatoDataLonga.format(paraData(valor));
  }

  /** 16/11/2026, 14:30 */
  function dataHora(valor) {
    return formatoDataHora.format(paraData(valor));
  }

  /** 14:30 */
  function hora(valor) {
    return formatoHora.format(paraData(valor));
  }

  /**
   * Data de hoje em "AAAA-MM-DD" (fuso local), o formato do <input type="date">.
   * @param {Date} [base]
   * @returns {string}
   */
  function dataIso(base) {
    const d = base || new Date();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mes + '-' + dia;
  }

  /**
   * 1536 → "1,5 KB"
   * @param {number} bytes
   * @returns {string}
   */
  function bytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace('.', ',') + ' KB';
    return (n / 1024 / 1024).toFixed(2).replace('.', ',') + ' MB';
  }

  /* =====================================================================
   * 3. TOASTS (avisos rápidos; o container #toasts tem role="status")
   * ===================================================================== */

  /**
   * Mostra uma mensagem rápida. Pausa com o mouse/foco em cima e com a aba escondida.
   * @param {string} mensagem
   * @param {{tipo?: 'sucesso'|'erro'|'alerta'|'info', acao?: {rotulo: string, aoClicar: Function}}} [opcoes]
   * @returns {{fechar: Function}}
   */
  function toast(mensagem, opcoes) {
    opcoes = opcoes || {};
    const caixa = $('toasts');
    // Nasce com "toast--entrando" (estado de partida); a classe sai no quadro seguinte e o CSS anima
    const elemento = criar('div', 'toast toast--entrando toast--' + (opcoes.tipo || 'info'));
    elemento.append(criar('span', 'toast-texto', mensagem));
    const duracao = opcoes.acao ? DURACAO_TOAST_COM_ACAO_MS : DURACAO_TOAST_MS;
    let temporizador;

    function fechar() {
      clearTimeout(temporizador);
      document.removeEventListener('visibilitychange', aoTrocarDeAba);
      if (!elemento.isConnected || elemento.classList.contains('saindo')) return;
      elemento.classList.add('saindo'); // o CSS anima a saída
      setTimeout(function () {
        elemento.remove();
      }, SAIDA_TOAST_MS);
    }

    function contar(ms) {
      clearTimeout(temporizador);
      temporizador = setTimeout(fechar, ms);
    }

    // Detalhe invisível: com a aba escondida o tempo para
    function aoTrocarDeAba() {
      if (document.hidden) clearTimeout(temporizador);
      else contar(2000);
    }

    if (opcoes.acao) {
      const acao = botao(opcoes.acao.rotulo, 'toast-acao');
      acao.addEventListener('click', function () {
        opcoes.acao.aoClicar();
        fechar();
      });
      elemento.append(acao);
    }

    elemento.addEventListener('mouseenter', function () {
      clearTimeout(temporizador);
    });
    elemento.addEventListener('focusin', function () {
      clearTimeout(temporizador);
    });
    elemento.addEventListener('mouseleave', function () {
      contar(2000);
    });
    elemento.addEventListener('focusout', function () {
      contar(2000);
    });
    document.addEventListener('visibilitychange', aoTrocarDeAba);
    elemento.fechar = fechar;

    caixa.append(elemento);
    // Dois quadros: o navegador precisa desenhar o estado de partida antes de animar
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        elemento.classList.remove('toast--entrando');
      });
    });
    // No máximo 3 ao mesmo tempo: os mais antigos saem (com animação)
    const ativos = Array.from(caixa.children).filter(function (t) {
      return !t.classList.contains('saindo');
    });
    ativos.slice(0, Math.max(0, ativos.length - MAX_TOASTS)).forEach(function (antigo) {
      antigo.fechar();
    });
    contar(duracao);
    return { fechar: fechar };
  }

  /**
   * Toast de erro padronizado: mostra a mensagem do erro, com tratamento
   * especial para o "armazenamento cheio".
   * @param {Error} erro
   */
  function toastErro(erro) {
    toast(erro && erro.message ? erro.message : 'Algo deu errado. Tente de novo.', { tipo: 'erro' });
  }

  /* =====================================================================
   * 4. DIÁLOGOS
   * ===================================================================== */

  /** Foco de antes de cada diálogo abrir, para devolver ao fechar. */
  const focoAnterior = new WeakMap();

  /**
   * Abre um <dialog> como modal (o navegador prende o foco dentro e Esc fecha).
   * Ao fechar, o foco volta para quem abriu.
   * @param {HTMLDialogElement} dialogo
   */
  function abrirDialogo(dialogo) {
    if (dialogo.open) return;
    focoAnterior.set(dialogo, document.activeElement);
    dialogo.showModal();
  }

  /**
   * Liga o comportamento padrão de todos os diálogos da página:
   * botões [data-fechar], clique no fundo escuro e foco devolvido.
   */
  function prepararDialogos() {
    document.querySelectorAll('dialog').forEach(function (dialogo) {
      dialogo.addEventListener('click', function (evento) {
        if (evento.target === dialogo) dialogo.close(); // clique no fundo
        if (evento.target.closest('[data-fechar]')) dialogo.close();
      });
      dialogo.addEventListener('close', function () {
        const anterior = focoAnterior.get(dialogo);
        if (anterior && anterior.isConnected && !dialogo.dataset.semDevolverFoco) anterior.focus();
        delete dialogo.dataset.semDevolverFoco;
      });
    });
  }

  /**
   * Pergunta de confirmação com o <dialog id="dialog-confirmacao">.
   * Esc ou "Cancelar" = não; o botão de confirmar = sim.
   * @param {{titulo: string, mensagem: string, confirmar?: string}} opcoes
   * @returns {Promise<boolean>}
   */
  function confirmar(opcoes) {
    const dialogo = $('dialog-confirmacao');
    $('dialog-titulo').textContent = opcoes.titulo;
    $('dialog-mensagem').textContent = opcoes.mensagem;
    dialogo.querySelector('[value="confirmar"]').textContent = opcoes.confirmar || 'Confirmar';
    dialogo.returnValue = '';
    abrirDialogo(dialogo);
    // Foco no "Cancelar": numa ação destrutiva, o padrão seguro é não fazer nada
    dialogo.querySelector('[value="cancelar"]').focus();
    return new Promise(function (resolver) {
      dialogo.addEventListener(
        'close',
        function () {
          resolver(dialogo.returnValue === 'confirmar');
        },
        { once: true }
      );
    });
  }

  /* =====================================================================
   * 5. ARQUIVOS E IMAGENS
   * ===================================================================== */

  /**
   * Reduz uma foto (máximo 1024 px no maior lado, JPEG qualidade 0.6) usando <canvas>.
   * Fotos de celular têm 3 a 6 MB; reduzidas ficam com ~100 KB e cabem no LocalStorage.
   * @param {File} arquivo
   * @param {{maximo?: number, qualidade?: number}} [opcoes]
   * @returns {Promise<{dataUrl: string, bytes: number, largura: number, altura: number}>}
   */
  function comprimirImagem(arquivo, opcoes) {
    const maximo = (opcoes && opcoes.maximo) || 1024;
    const qualidade = (opcoes && opcoes.qualidade) || 0.6;
    return new Promise(function (resolver, rejeitar) {
      if (!arquivo || !/^image\//.test(arquivo.type)) {
        rejeitar(new Error('O arquivo "' + (arquivo && arquivo.name) + '" não é uma imagem.'));
        return;
      }
      const endereco = URL.createObjectURL(arquivo);
      const imagem = new Image();
      imagem.onload = function () {
        const escala = Math.min(1, maximo / Math.max(imagem.width, imagem.height));
        const largura = Math.round(imagem.width * escala);
        const altura = Math.round(imagem.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        canvas.getContext('2d').drawImage(imagem, 0, 0, largura, altura);
        URL.revokeObjectURL(endereco); // libera a memória da foto original
        const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
        // Tamanho real: o base64 usa 4 caracteres para cada 3 bytes
        const tamanho = Math.round(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);
        resolver({ dataUrl: dataUrl, bytes: tamanho, largura: largura, altura: altura });
      };
      imagem.onerror = function () {
        URL.revokeObjectURL(endereco);
        rejeitar(new Error('Não foi possível ler a imagem "' + arquivo.name + '".'));
      };
      imagem.src = endereco;
    });
  }

  /**
   * Faz o navegador baixar um arquivo gerado na hora (ex.: o .ics do calendário).
   * @param {string} nome
   * @param {string} conteudo
   * @param {string} tipo Ex.: 'text/calendar'.
   */
  function baixarArquivo(nome, conteudo, tipo) {
    const endereco = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const link = criar('a');
    link.href = endereco;
    link.download = nome;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(endereco);
    }, 1000);
  }

  /* =====================================================================
   * 6. NOTIFICAÇÕES DO SISTEMA (Notification API)
   * ===================================================================== */

  /** @returns {boolean} true se o navegador tem notificações e a pessoa permitiu. */
  function notificacoesPermitidas() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  /**
   * Pede permissão. Só deve ser chamada depois de um clique da pessoa
   * (pedir ao abrir a página é intrusivo e os navegadores bloqueiam).
   * @returns {Promise<boolean>}
   */
  function pedirNotificacoes() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission !== 'default') return Promise.resolve(Notification.permission === 'granted');
    return Notification.requestPermission().then(function (resposta) {
      return resposta === 'granted';
    });
  }

  /**
   * Mostra uma notificação do sistema, se permitida (senão, não faz nada).
   * @param {string} titulo
   * @param {string} corpo
   */
  function notificar(titulo, corpo) {
    if (!notificacoesPermitidas()) return;
    try {
      new Notification(titulo, { body: corpo, tag: 'pk-estetica' });
    } catch (erro) {
      // Alguns navegadores de celular só permitem notificação via service worker: o toast já avisou
    }
  }

  /* =====================================================================
   * 7. SINCRONIZAÇÃO ENTRE SEÇÕES E ABAS
   * Quem muda um dado chama avisarMudanca(); quem mostra dados se inscreve
   * com aoMudarDados(). O evento "storage" do navegador avisa as OUTRAS abas.
   * ===================================================================== */

  /**
   * Avisa a página que algum dado mudou (todas as seções se redesenham).
   * @param {string} [tipo] Ex.: 'agendamentos'.
   */
  function avisarMudanca(tipo) {
    document.dispatchEvent(new CustomEvent(EVENTO_DADOS, { detail: { tipo: tipo || 'tudo', outraAba: false } }));
  }

  /**
   * Executa `funcao` sempre que um dado mudar (nesta aba ou em outra aba).
   * @param {Function} funcao Recebe { tipo, outraAba }.
   */
  function aoMudarDados(funcao) {
    document.addEventListener(EVENTO_DADOS, function (evento) {
      funcao(evento.detail);
    });
  }

  // O navegador dispara "storage" nas OUTRAS abas quando o LocalStorage muda
  window.addEventListener('storage', function (evento) {
    if (!evento.key || evento.key.indexOf(AppStorage.PREFIXO) !== 0) return;
    document.dispatchEvent(
      new CustomEvent(EVENTO_DADOS, {
        detail: { tipo: evento.key.slice(AppStorage.PREFIXO.length), outraAba: true },
      })
    );
  });

  return {
    $: $,
    criar: criar,
    botao: botao,
    debounce: debounce,
    movimentoReduzido: movimentoReduzido,
    moeda: moeda,
    paraData: paraData,
    data: data,
    dataLonga: dataLonga,
    dataHora: dataHora,
    hora: hora,
    dataIso: dataIso,
    bytes: bytes,
    toast: toast,
    toastErro: toastErro,
    abrirDialogo: abrirDialogo,
    prepararDialogos: prepararDialogos,
    confirmar: confirmar,
    comprimirImagem: comprimirImagem,
    baixarArquivo: baixarArquivo,
    notificacoesPermitidas: notificacoesPermitidas,
    pedirNotificacoes: pedirNotificacoes,
    notificar: notificar,
    avisarMudanca: avisarMudanca,
    aoMudarDados: aoMudarDados,
  };
})();
