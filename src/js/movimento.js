/**
 * movimento.js — camada de movimento da identidade "Black Chrome"
 *
 * Tudo aqui é ACABAMENTO: se este arquivo falhar, o site continua funcionando igual.
 *  1. Contadores: os números do hero contam de 0 até o valor quando aparecem.
 *  2. Antes × depois: liga o controle deslizante ao recorte da pintura polida.
 *  3. Botões magnéticos: só com mouse de verdade.
 *  4. Rolagem suave (Lenis) + parallax ligado à rolagem (GSAP ScrollTrigger):
 *     só no desktop com mouse. As bibliotecas são carregadas com import() SÓ nesse
 *     caso, então o celular nem baixa esse código (ajuda a nota de desempenho).
 *
 * Com "reduzir movimento" ligado no sistema, só o item 2 roda (é funcional, não enfeite).
 */
import { Servicos } from './servicos.js';

export const Movimento = (function () {
  'use strict';

  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)');
  // "Mouse de verdade": tem hover e ponteiro preciso (no toque, o ímã não faz sentido)
  const mouse = window.matchMedia('(hover: hover) and (pointer: fine)');
  const desktop = window.matchMedia('(min-width: 1024px)');

  let lenis = null; // instância do Lenis (quando ligado), exposta para testes

  /* =====================================================================
   * 1. CONTADORES
   * ===================================================================== */

  /**
   * Anima um número de 0 até o valor final, desacelerando no fim.
   * @param {HTMLElement} elemento Elemento com o atributo data-contar.
   */
  function contar(elemento) {
    const alvo = Number(elemento.dataset.contar) || 0;
    const duracao = 1400;
    const inicio = performance.now();
    function quadro(agora) {
      const t = Math.min(1, (agora - inicio) / duracao);
      const suave = 1 - Math.pow(1 - t, 4); // "ease-out": rápido no começo, assenta no fim
      elemento.textContent = String(Math.round(alvo * suave));
      if (t < 1) requestAnimationFrame(quadro);
    }
    requestAnimationFrame(quadro);
  }

  /**
   * Prepara os contadores: o valor final já está no HTML; só animamos se puder.
   */
  function iniciarContadores() {
    const servicos = document.getElementById('numero-servicos');
    if (servicos) {
      const total = Servicos.listar().length;
      servicos.dataset.contar = String(total);
      servicos.textContent = String(total);
    }

    const numeros = document.querySelectorAll('[data-contar]');
    if (reduzido.matches || !('IntersectionObserver' in window)) return;

    const observador = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (entrada) {
          if (!entrada.isIntersecting) return;
          contar(entrada.target);
          observador.unobserve(entrada.target); // conta uma vez só
        });
      },
      { threshold: 0.6 }
    );
    numeros.forEach(function (numero) {
      observador.observe(numero);
    });
  }

  /* =====================================================================
   * 2. ANTES × DEPOIS
   * ===================================================================== */

  /**
   * Liga o <input type="range"> ao recorte da pintura polida (variável --pos).
   * Na 1ª vez que o quadro aparece, a alça "passeia" de 85% a 50% para mostrar
   * que dá para arrastar (só se o usuário ainda não mexeu).
   */
  function iniciarAntesDepois() {
    const controle = document.getElementById('antes-depois-controle');
    if (!controle) return;
    const quadro = controle.closest('.antes-depois-quadro');
    let mexeu = false;

    function aplicar(valor) {
      quadro.style.setProperty('--pos', valor + '%');
    }

    controle.addEventListener('input', function () {
      mexeu = true;
      aplicar(controle.value);
    });

    if (reduzido.matches || !('IntersectionObserver' in window)) return;

    const observador = new IntersectionObserver(
      function (entradas) {
        if (!entradas[0].isIntersecting) return;
        observador.disconnect();
        const inicio = performance.now();
        function quadroAnim(agora) {
          if (mexeu) return; // o usuário assumiu o controle: paramos a demonstração
          const t = Math.min(1, (agora - inicio) / 1300);
          const suave = 1 - Math.pow(1 - t, 3);
          const valor = Math.round(85 - 35 * suave);
          controle.value = String(valor);
          aplicar(valor);
          if (t < 1) requestAnimationFrame(quadroAnim);
        }
        requestAnimationFrame(quadroAnim);
      },
      { threshold: 0.5 }
    );
    observador.observe(quadro);
  }

  /* =====================================================================
   * 3. BOTÕES MAGNÉTICOS
   * ===================================================================== */

  /**
   * Botões principais "puxam" um pouco na direção do mouse (efeito ímã).
   * Usa a propriedade CSS "translate", separada do "transform" (que guarda a inclinação).
   */
  function iniciarMagneticos() {
    document.querySelectorAll('.hero-acoes .btn, .btn-primario').forEach(function (botao) {
      botao.addEventListener('pointermove', function (evento) {
        if (evento.pointerType !== 'mouse') return;
        const caixa = botao.getBoundingClientRect();
        const dx = evento.clientX - (caixa.left + caixa.width / 2);
        const dy = evento.clientY - (caixa.top + caixa.height / 2);
        botao.style.translate = (dx * 0.22).toFixed(1) + 'px ' + (dy * 0.35).toFixed(1) + 'px';
      });
      botao.addEventListener('pointerleave', function () {
        botao.style.translate = '';
      });
    });
  }

  /* =====================================================================
   * 4. ROLAGEM SUAVE + PARALLAX
   * ===================================================================== */

  /**
   * Liga o Lenis (inércia na rolagem) e o GSAP ScrollTrigger (animações presas à rolagem).
   * Carregados com import(): só entram quando este caminho roda.
   */
  async function iniciarRolagem() {
    const [{ default: Lenis }, { gsap }, { ScrollTrigger }] = await Promise.all([
      import('lenis'),
      import('gsap'),
      import('gsap/ScrollTrigger'),
    ]);
    gsap.registerPlugin(ScrollTrigger);

    lenis = new Lenis({
      lerp: 0.12, // quanto menor, mais "deslizante"; 0.12 ainda responde rápido
      // dentro de diálogos e do menu lateral, a rolagem é a normal do navegador
      prevent: function (no) {
        return !!no.closest('dialog, .barra-lateral, [data-lenis-prevent]');
      },
    });

    // Um relógio só: o GSAP comanda o Lenis, e o ScrollTrigger sabe de cada rolagem
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (tempo) {
      lenis.raf(tempo * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Durante a abertura a página não pode rolar: o Lenis para junto
    function sincronizarAbertura() {
      if (document.documentElement.classList.contains('abertura-ativa')) lenis.stop();
      else lenis.start();
    }
    new MutationObserver(sincronizarAbertura).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    sincronizarAbertura();

    // Parallax: o carro do hero sobe mais devagar que o texto (profundidade)
    gsap.to('.hero-carro', {
      yPercent: -14,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
    });
    // O título "vai embora" para cima e apaga um pouco quando a página desce
    gsap.to('.hero-titulo', {
      yPercent: -18,
      opacity: 0.35,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 },
    });
    // A faixa anda para o lado conforme a rolagem (mantendo a inclinação de -2°)
    gsap.fromTo(
      '.faixa',
      { xPercent: 3, rotation: -2 },
      {
        xPercent: -3,
        rotation: -2,
        ease: 'none',
        scrollTrigger: { trigger: '.faixa', start: 'top bottom', end: 'bottom top', scrub: 1.2 },
      }
    );
  }

  /* =====================================================================
   * INICIALIZAÇÃO
   * ===================================================================== */

  /**
   * Liga tudo o que o aparelho e as preferências do usuário permitem.
   */
  function iniciar() {
    iniciarContadores();
    iniciarAntesDepois();
    if (reduzido.matches || !mouse.matches) return;
    iniciarMagneticos();
    if (desktop.matches) {
      iniciarRolagem().catch(function () {
        // sem as bibliotecas (ex.: erro de rede no dev): a rolagem nativa continua
      });
    }
  }

  return {
    iniciar: iniciar,
    contar: contar,
    /** Instância do Lenis (ou null), para testes pelo Console. */
    lenis: function () {
      return lenis;
    },
  };
})();
