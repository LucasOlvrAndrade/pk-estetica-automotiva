/**
 * rotas.js: páginas por hash e menu lateral
 *
 * COMO FUNCIONA O ROTEAMENTO POR HASH
 * O "hash" é a parte do endereço depois do # (ex.: index.html#/agendar).
 * Mudar o hash NÃO recarrega a página e NÃO pede nada ao servidor: o navegador só
 * avisa o JavaScript (evento "hashchange"/"popstate") e guarda o endereço no histórico.
 * Por isso funciona em qualquer hospedagem estática, sem configurar o servidor, e:
 *  - o botão Voltar do navegador volta para a página anterior do app;
 *  - o F5 recarrega e o app lê o hash para abrir a mesma página.
 * Cada <section class="secao" id="..."> do index.html é uma página. Mostrar uma
 * página = tirar o atributo hidden dela e colocar nas outras.
 *
 * O menu lateral (desktop) pode ser recolhido (só ícones); a escolha fica salva no
 * LocalStorage pelo AppStorage. No celular, o mesmo menu vira uma gaveta.
 */
import { AppStorage } from './storage.js';
import { UI } from './ui.js';

export const Rotas = (function () {
  'use strict';

  const $ = UI.$;
  const NOME_SITE = 'PK Estética Automotiva';
  const PAGINA_INICIAL = 'inicio';
  const MIDIA_DESKTOP = window.matchMedia('(min-width: 1024px)');
  const movimentoReduzido = window.matchMedia('(prefers-reduced-motion: reduce)');

  /** Ordem e nome de cada página (o id é o mesmo da <section>). */
  const PAGINAS = [
    { id: 'inicio', titulo: 'Início' },
    { id: 'servicos', titulo: 'Serviços' },
    { id: 'diagnostico', titulo: 'Diagnóstico' },
    { id: 'agendar', titulo: 'Agendar' },
    { id: 'veiculos', titulo: 'Meus Veículos' },
    { id: 'acompanhamento', titulo: 'Acompanhamento' },
    { id: 'fidelidade', titulo: 'Fidelidade' },
    { id: 'historico', titulo: 'Histórico' },
    { id: 'como-funciona', titulo: 'Como funciona' },
    { id: 'atendimento', titulo: 'Atendimento' },
    { id: 'painel', titulo: 'Painel' },
  ];

  let atual = null; // id da página aberta agora
  const ouvintes = []; // funções avisadas a cada troca de página

  /* =====================================================================
   * 1. ROTEADOR
   * ===================================================================== */

  /** @param {string} id @returns {boolean} true se existe uma página com esse id. */
  function existe(id) {
    return PAGINAS.some(function (p) {
      return p.id === id;
    });
  }

  /**
   * Lê o hash do endereço e devolve o id da página.
   * Aceita o formato novo (#/agendar) e o antigo (#agendar, de links salvos antes).
   * @returns {string|null} id da página, ou null se o hash não é uma página.
   */
  function paginaDoHash() {
    const hash = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (hash === '') return PAGINA_INICIAL;
    return existe(hash) ? hash : null;
  }

  /**
   * Mostra uma página e esconde as outras.
   * @param {string} id Página a mostrar.
   * @param {{focar?: boolean}} [opcoes] focar: leva o foco ao título (troca feita pelo usuário).
   */
  function mostrar(id, opcoes) {
    const focar = !!(opcoes && opcoes.focar);
    const mudou = id !== atual;
    atual = id;

    document.querySelectorAll('main > .secao').forEach(function (secao) {
      const ativa = secao.id === id;
      secao.hidden = !ativa;
      // Transição de entrada (o CSS a desliga com "reduzir movimento")
      secao.classList.toggle('pagina-entrando', ativa && mudou && !movimentoReduzido.matches);
    });

    // Destaque no menu: aria-current="page" no link da página aberta
    document.querySelectorAll('#menu-principal a[data-pagina]').forEach(function (link) {
      if (link.dataset.pagina === id) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const pagina = PAGINAS.find(function (p) {
      return p.id === id;
    });
    document.title = id === PAGINA_INICIAL ? NOME_SITE : pagina.titulo + ' | ' + NOME_SITE;

    if (mudou) {
      window.scrollTo(0, 0); // página nova começa do topo
      // Avisa quem desenha coisas que dependem do tamanho (canvas, parallax)
      window.dispatchEvent(new Event('resize'));
      ouvintes.forEach(function (ouvinte) {
        ouvinte(id);
      });
    }

    // Leitor de tela e teclado: o foco vai para o título da página nova
    if (focar) {
      const titulo = document.querySelector('#' + id + ' h2');
      if (titulo) {
        titulo.setAttribute('tabindex', '-1');
        titulo.focus({ preventScroll: true });
      }
    }
  }

  /**
   * Vai para uma página (usado pelos botões internos, ex.: "Agendar este serviço").
   * Grava no histórico do navegador, então o Voltar funciona.
   * @param {string} id Página de destino.
   * @param {{focar?: boolean}} [opcoes]
   */
  function ir(id, opcoes) {
    if (!existe(id)) return;
    if (paginaDoHash() !== id || location.hash !== '#/' + id) {
      history.pushState(null, '', '#/' + id);
    }
    mostrar(id, opcoes);
  }

  /** Reage ao endereço: links #/..., Voltar/Avançar e hash digitado à mão. */
  function aoMudarEndereco() {
    const id = paginaDoHash();
    if (id === null) {
      // Hash antigo que aponta para algo DENTRO de uma página: abre essa página
      const alvo = location.hash.length > 1 ? document.getElementById(location.hash.slice(1)) : null;
      const secao = alvo ? alvo.closest('main > .secao') : null;
      if (secao) {
        history.replaceState(null, '', '#/' + secao.id);
        mostrar(secao.id, { focar: true });
      } else {
        history.replaceState(null, '', '#/' + (atual || PAGINA_INICIAL));
        mostrar(atual || PAGINA_INICIAL);
      }
      return;
    }
    // Endereço antigo (#agendar) vira o novo (#/agendar), sem criar entrada no histórico
    if (location.hash !== '#/' + id) history.replaceState(null, '', '#/' + id);
    mostrar(id, { focar: atual !== null });
  }

  /**
   * Registra uma função chamada sempre que a página muda.
   * @param {(id: string) => void} ouvinte
   */
  function aoTrocarPagina(ouvinte) {
    ouvintes.push(ouvinte);
  }

  /* =====================================================================
   * 2. MENU LATERAL
   * ===================================================================== */

  /**
   * Liga o menu lateral: recolher/expandir (desktop) e gaveta (celular).
   */
  function iniciarMenu() {
    const barra = $('barra-lateral');
    const botaoMenu = $('btn-menu');
    const botaoRecolher = $('btn-recolher');
    const fundo = $('barra-fundo');
    const html = document.documentElement;

    // ---- Desktop: recolher (só ícones) e expandir, lembrando a escolha ----
    function aplicarRecolhido(recolhido) {
      if (recolhido) html.dataset.menu = 'recolhido';
      else delete html.dataset.menu;
      botaoRecolher.setAttribute('aria-expanded', String(!recolhido));
      const texto = recolhido ? 'Expandir menu' : 'Recolher menu';
      botaoRecolher.querySelector('.menu-rotulo').textContent = texto;
    }
    aplicarRecolhido(!!AppStorage.obterPreferencias().menuRecolhido);
    botaoRecolher.addEventListener('click', function () {
      const recolher = html.dataset.menu !== 'recolhido';
      aplicarRecolhido(recolher);
      AppStorage.salvarPreferencias({ menuRecolhido: recolher });
      window.dispatchEvent(new Event('resize')); // a área do conteúdo mudou de largura
    });

    // ---- Dicas (nome da página ao lado do ícone) ----
    // A barra tem rolagem própria, que cortaria uma dica "absoluta". Por isso a dica é
    // "fixed" (presa à tela) e aqui calculamos a altura dela: o meio do item apontado.
    function posicionarDica(evento) {
      const item = evento.target.closest('a, .btn-recolher');
      if (!item) return;
      const caixa = item.getBoundingClientRect();
      item.style.setProperty('--dica-y', caixa.top + caixa.height / 2 + 'px');
    }
    barra.addEventListener('pointerover', posicionarDica);
    barra.addEventListener('focusin', posicionarDica);

    // ---- Celular: gaveta que abre pelo hambúrguer ----
    function gavetaAberta() {
      return botaoMenu.getAttribute('aria-expanded') === 'true';
    }

    /**
     * Abre ou fecha a gaveta. Fechada, ela fica "inert": o Tab não entra nela.
     * @param {boolean} abrir
     * @param {boolean} [devolverFoco] true para voltar o foco ao hambúrguer (Esc, toque fora).
     */
    function definirGaveta(abrir, devolverFoco) {
      botaoMenu.setAttribute('aria-expanded', String(abrir));
      html.classList.toggle('menu-aberto', abrir);
      fundo.hidden = !abrir;
      barra.inert = !abrir && !MIDIA_DESKTOP.matches;
      if (abrir) {
        const ativo = barra.querySelector('a[aria-current="page"]') || barra.querySelector('a');
        ativo.focus();
      } else if (devolverFoco) {
        botaoMenu.focus();
      }
    }

    botaoMenu.addEventListener('click', function () {
      definirGaveta(!gavetaAberta());
    });
    fundo.addEventListener('click', function () {
      definirGaveta(false, true);
    });
    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && gavetaAberta()) definirGaveta(false, true);
    });
    // Escolheu uma página: a gaveta fecha (no desktop não muda nada)
    barra.addEventListener('click', function (evento) {
      if (evento.target.closest('a') && gavetaAberta()) definirGaveta(false);
    });

    // Mudou de celular para desktop (ou o contrário): zera a gaveta
    function aoMudarTela() {
      definirGaveta(false);
    }
    MIDIA_DESKTOP.addEventListener('change', aoMudarTela);
    aoMudarTela();
  }

  /* =====================================================================
   * 3. INICIALIZAÇÃO
   * ===================================================================== */

  /**
   * Numera os títulos (01, 02…) pela ordem do menu e abre a página do endereço.
   */
  function iniciar() {
    PAGINAS.forEach(function (pagina, i) {
      const titulo = document.querySelector('#' + pagina.id + ' > h2');
      if (titulo) titulo.dataset.numero = String(i + 1).padStart(2, '0');
    });

    iniciarMenu();

    // "Pular para o conteúdo": leva o foco para a página aberta (sem mexer no hash)
    const pular = document.querySelector('.pular-conteudo');
    if (pular) {
      pular.addEventListener('click', function (evento) {
        evento.preventDefault();
        const titulo = document.querySelector('#' + atual + ' h2');
        if (titulo) {
          titulo.setAttribute('tabindex', '-1');
          titulo.focus();
        } else {
          $('conteudo').focus();
        }
      });
    }

    window.addEventListener('hashchange', aoMudarEndereco);
    window.addEventListener('popstate', aoMudarEndereco);
    aoMudarEndereco(); // 1ª página: a do endereço (F5 mantém a página certa)
  }

  return {
    PAGINAS: PAGINAS,
    iniciar: iniciar,
    ir: ir,
    aoTrocarPagina: aoTrocarPagina,
    /** @returns {string|null} id da página aberta. */
    atual: function () {
      return atual;
    },
  };
})();
