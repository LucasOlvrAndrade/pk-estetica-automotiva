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
 *  - LUZES      faróis (emissivos) e um holofote que varre o carro. O neon verde é só um
 *               brilho pintado no chão (não é luz): assim não reflete na lataria.
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

  // Intensidades da cena (num lugar só, fácil de ajustar)
  const LUZ = {
    haloChao: 0.1, // opacidade do brilho verde pintado no chão
    barrasFundo: 0.5, // barras de LED do estúdio, ao fundo
    faixasChao: 0.18, // faixas da vaga no chão
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
   * Ambientação de estúdio de detailing ao fundo: parede escura em volta, barras de LED
   * verticais (como as de inspeção de pintura) e as faixas de uma vaga no chão.
   * As barras acendem uma a uma junto com a varredura do holofote (ver quadro()).
   * São MeshBasicMaterial (brilham sozinhas, sem custo de luz) e ficam longe do carro:
   * dão profundidade sem iluminar nem refletir na lataria.
   * @returns {{grupo: THREE.Group, barras: {material: THREE.Material, atraso: number}[], faixas: THREE.Material, liberar: function(): void}}
   */
  function criarEstudio() {
    const grupo = new THREE.Group();
    const geometrias = [];
    const materiais = [];

    // Parede: um cilindro aberto visto por dentro, quase preto
    const geoParede = new THREE.CylinderGeometry(15, 15, 9, 64, 1, true);
    const matParede = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.9, side: THREE.BackSide, envMapIntensity: 0.25 });
    const parede = new THREE.Mesh(geoParede, matParede);
    parede.position.y = 4.5;
    grupo.add(parede);
    geometrias.push(geoParede);
    materiais.push(matParede);

    // Barras de LED em volta (duas por "coluna", com um vão no meio, como luminárias de estúdio)
    const geoBarra = new THREE.PlaneGeometry(0.14, 1.5);
    geometrias.push(geoBarra);
    const barras = [];
    const QUANTAS = 22;
    for (let i = 0; i < QUANTAS; i++) {
      const angulo = (i / QUANTAS) * Math.PI * 2;
      const x = Math.cos(angulo) * 14.6;
      const z = Math.sin(angulo) * 14.6;
      const material = new THREE.MeshBasicMaterial({ color: 0xdfe3ea, transparent: true, opacity: 0 });
      materiais.push(material);
      [1.0, 2.75].forEach(function (y) {
        const barra = new THREE.Mesh(geoBarra, material);
        barra.position.set(x, y, z);
        barra.lookAt(0, y, 0); // virada para o carro
        grupo.add(barra);
      });
      // acende de trás para a frente, junto com o holofote (que vai de x = -6 até x = +6)
      barras.push({ material: material, atraso: (x + 14.6) / 29.2 });
    }

    // Faixas da vaga no chão (cinza, discretas): o carro "estacionado" no box
    const matFaixa = new THREE.MeshBasicMaterial({ color: 0x8a8f99, transparent: true, opacity: 0 });
    materiais.push(matFaixa);
    [
      [6.4, 0.05, 0, 1.75], // laterais (comprimento ao longo de x)
      [6.4, 0.05, 0, -1.75],
      [0.05, 3.5, -3.2, 0], // fundo da vaga
    ].forEach(function (f) {
      const geo = new THREE.PlaneGeometry(f[0], f[1]);
      geometrias.push(geo);
      const faixa = new THREE.Mesh(geo, matFaixa);
      faixa.rotation.x = -Math.PI / 2;
      faixa.position.set(f[2], 0.005, f[3]);
      grupo.add(faixa);
    });

    return {
      grupo: grupo,
      barras: barras,
      faixas: matFaixa,
      liberar: function () {
        geometrias.forEach((g) => g.dispose());
        materiais.forEach((m) => m.dispose());
      },
    };
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
    const estudio = criarEstudio();
    cena.add(estudio.grupo);
    // Névoa escura: o chão e o fundo somem aos poucos na distância (dá profundidade)
    cena.fog = new THREE.Fog(0x030304, 12, 34);

    // ---------- Luzes ----------
    // Sem luzes verdes de verdade: elas viravam manchas verdes na lataria e no para-choque
    // no começo da abertura (cena escura). O neon é só o halo pintado no chão (criarNeonNoChao).
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

      // Faróis e lanternas
      if (pintura) pintura.farois.value = estado.farois;
      luzFarol.intensity = LUZ.farolNoChao * estado.farois;
      // O brilho do neon no chão só aparece no fim, com o carro já iluminado pelo estúdio
      halo.material.opacity = LUZ.haloChao * suave((s - d * 0.5) / (d * 0.3));

      // Barras de LED do fundo acendem em sequência, acompanhando o holofote; faixas da vaga juntas
      estudio.barras.forEach(function (b) {
        b.material.opacity = LUZ.barrasFundo * suave((s - d * (0.2 + b.atraso * 0.35)) / (d * 0.08));
      });
      estudio.faixas.opacity = LUZ.faixasChao * suave((s - d * 0.3) / (d * 0.3));

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
      estudio.liberar();
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
