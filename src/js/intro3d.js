/**
 * intro3d.js: Intro3D
 *
 * Cena da abertura em 3D real (Three.js) com o Civic carregado pelo modelo3d.js
 * (o mesmo carro do Início). Se o aparelho não aguenta (celular, sem WebGL, conexão
 * lenta, pouca memória), o app.js usa a cena leve com a imagem do mesmo Civic (civic-3d.webp).
 *
 * Como a cena funciona:
 *  - CENA       a "caixa" onde ficam o carro, o chão e as luzes.
 *  - CÂMERA     PerspectiveCamera: vê como um olho (o que está longe fica menor).
 *  - AMBIENTE   RoomEnvironment vira um "environment map": um estúdio invisível que se
 *               reflete na pintura e no cromo (é ele que dá o brilho espelhado).
 *  - LUZES      faróis (emissivos), neon verde embaixo e um holofote que varre o carro.
 *  - MATERIAIS  vêm prontos do modelo3d.js (pintura com verniz, cromados, vidro fumê).
 *  - LOOP       a cada quadro o app.js chama quadro(segundos) e a cena se redesenha.
 *  - PÓS        EffectComposer + bloom: o que é muito claro (faróis) ganha um brilho suave.
 *
 * As intensidades são contidas de propósito: o neon só "lambe" o chão e o vidro reflete
 * pouco, para o carro aparecer sem a cena estourar de luz.
 *
 * MÓDULO ES: carregado com import() só quando a abertura 3D vai rodar.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { Modelo3D } from './modelo3d.js';

export const Intro3D = (function () {
  'use strict';

  const COMPRIMENTO = Modelo3D.COMPRIMENTO;
  const VERDE_NEON = 0x39ff88;

  // Intensidades da cena (num lugar só, fácil de ajustar)
  const LUZ = {
    neon: 0.55, // luzes verdes embaixo do carro
    haloChao: 0.13, // opacidade do brilho verde pintado no chão
    holofote: 28, // luz de inspeção que varre a carroceria
    farolNoChao: 14, // facho dos faróis
    estudio: 0.45, // força do reflexo do estúdio (environment map)
  };

  /** Interpolação suave 0→1 (começa e termina devagar). */
  function suave(t) {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  }

  /**
   * Halo do neon no chão: um degradê radial verde desenhado num canvas (vira textura).
   * @returns {THREE.Mesh}
   */
  function criarNeonNoChao() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(57, 255, 136, 0.8)');
    g.addColorStop(0.4, 'rgba(57, 255, 136, 0.25)');
    g.addColorStop(1, 'rgba(57, 255, 136, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(COMPRIMENTO * 1.3, COMPRIMENTO * 0.6),
      new THREE.MeshBasicMaterial({
        map: textura,
        transparent: true,
        blending: THREE.AdditiveBlending, // soma luz em vez de cobrir
        depthWrite: false,
        opacity: 0,
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.01;
    return halo;
  }

  /**
   * Monta a cena e carrega o modelo.
   * @param {HTMLCanvasElement} canvas
   * @param {{aoProgresso?: function(number): void, celular?: boolean}} [opcoes]
   * @returns {Promise<{quadro: function(number, Object): void, destruir: function(): void}>}
   */
  async function criar(canvas, opcoes) {
    opcoes = opcoes || {};
    const celular = Boolean(opcoes.celular);

    // ---------- Renderizador ----------
    const renderizador = new THREE.WebGLRenderer({ canvas: canvas, antialias: !celular, powerPreference: 'high-performance' });
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, celular ? 1.5 : 2)); // DPR limitado
    renderizador.toneMapping = THREE.ACESFilmicToneMapping; // cores "de cinema" nas luzes fortes
    renderizador.toneMappingExposure = 0.75;
    renderizador.outputColorSpace = THREE.SRGBColorSpace;

    // ---------- Cena, ambiente e câmera ----------
    const cena = new THREE.Scene();
    cena.background = new THREE.Color(0x030304);
    const pmrem = new THREE.PMREMGenerator(renderizador);
    const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // estúdio para os reflexos
    cena.environment = ambiente;
    cena.environmentIntensity = 0; // começa no escuro: só os faróis aparecem
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    // ---------- Chão ----------
    const chao = new THREE.Mesh(
      new THREE.CircleGeometry(30, 64),
      new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.85, metalness: 0, envMapIntensity: 0.02 }) // chão fosco: quase não reflete
    );
    chao.rotation.x = -Math.PI / 2;
    cena.add(chao);
    const halo = criarNeonNoChao();
    cena.add(halo);

    // ---------- Luzes ----------
    const neon = [-1.1, 0, 1.1].map(function (x) {
      const luz = new THREE.PointLight(VERDE_NEON, 0, 1.8, 2); // alcance curto: fica embaixo do carro
      luz.position.set(x, 0.1, 0);
      cena.add(luz);
      return luz;
    });
    const holofote = new THREE.SpotLight(0xffffff, 0, 18, 0.32, 0.7, 1.2); // a "luz de inspeção"
    holofote.position.set(-6, 4.5, 2.5);
    cena.add(holofote, holofote.target);
    const luzFarol = new THREE.SpotLight(0xfff3dc, 0, 12, 0.32, 0.8, 1.6); // luz dos faróis no chão
    cena.add(luzFarol, luzFarol.target);

    // ---------- Modelo (o mesmo do Início) ----------
    const carro = await Modelo3D.carregar({ aoProgresso: opcoes.aoProgresso });
    cena.add(carro.pivo);
    const pintura = carro.pintura;

    // Luz dos faróis aponta para a frente (+x) a partir do para-choque
    luzFarol.position.set(COMPRIMENTO / 2 - 0.2, 0.7, 0);
    luzFarol.target.position.set(COMPRIMENTO * 2.5, 0, 0);

    // ---------- Pós-processamento ----------
    const composer = new EffectComposer(renderizador);
    composer.addPass(new RenderPass(cena, camera));
    // força 0.3 e limiar 0.98: só o que é MUITO claro (faróis) ganha um halo discreto
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.3, 0.98);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---------- Tamanho do canvas ----------
    function ajustar() {
      const largura = canvas.clientWidth || 1;
      const altura = canvas.clientHeight || 1;
      renderizador.setSize(largura, altura, false);
      composer.setSize(largura, altura);
      camera.aspect = largura / altura;
      // Tela em pé (celular): abre o ângulo para o carro caber
      camera.fov = largura < altura ? 52 : 32;
      camera.updateProjectionMatrix();
    }
    const observador = new ResizeObserver(ajustar);
    observador.observe(canvas);
    ajustar();

    /**
     * Desenha um quadro da abertura.
     * @param {number} s Segundos desde o início.
     * @param {{farois: number, tremor: number, duracao: number}} estado
     */
    function quadro(s, estado) {
      const d = estado.duracao;
      // Câmera: de frente, baixa e longe → dolly até 3/4 frontal, mais alta e perto
      const p = suave(s / (d * 0.85));
      const angulo = 0.18 + p * 0.62; // radianos a partir da frente
      const distancia = 13 - p * 5.2;
      const altura = 0.55 + p * 1.0;
      const tremor = estado.tremor;
      camera.position.set(
        Math.cos(angulo) * distancia + Math.sin(s * 91) * tremor,
        altura + Math.sin(s * 113) * tremor,
        Math.sin(angulo) * distancia
      );
      // Olhar um pouco abaixo do carro o deixa na metade de cima da tela (a marca PK fica embaixo)
      camera.lookAt(0.2, 0.05 + Math.sin(s * 97) * tremor * 0.5, 0);

      // Faróis, lanternas e neon
      if (pintura) pintura.farois.value = estado.farois;
      luzFarol.intensity = LUZ.farolNoChao * estado.farois;
      const neonLigado = suave((s - d * 0.12) / (d * 0.1));
      neon.forEach((l) => (l.intensity = LUZ.neon * neonLigado));
      halo.material.opacity = LUZ.haloChao * neonLigado;

      // Estúdio "acende" e o holofote varre a carroceria de trás para a frente
      cena.environmentIntensity = LUZ.estudio * suave((s - d * 0.22) / (d * 0.3));
      const varredura = suave((s - d * 0.22) / (d * 0.45));
      holofote.intensity = LUZ.holofote * Math.sin(Math.PI * varredura);
      holofote.position.x = -6 + 12 * varredura;
      holofote.target.position.set(holofote.position.x * 0.4, 0.6, 0);

      composer.render();
    }

    /** Libera tudo da memória da placa de vídeo (geometrias, materiais, texturas). */
    function destruir() {
      observador.disconnect();
      carro.liberar();
      chao.geometry.dispose();
      chao.material.dispose();
      halo.geometry.dispose();
      halo.material.map.dispose();
      halo.material.dispose();
      ambiente.dispose();
      pmrem.dispose();
      composer.dispose();
      renderizador.dispose();
    }

    return { quadro: quadro, destruir: destruir };
  }

  /** O navegador tem WebGL? (sem ele, a abertura usa o carro em Canvas 2D) */
  function suportado() {
    try {
      const teste = document.createElement('canvas');
      return Boolean(window.WebGLRenderingContext && (teste.getContext('webgl2') || teste.getContext('webgl')));
    } catch (erro) {
      return false;
    }
  }

  return { criar: criar, suportado: suportado };
})();
