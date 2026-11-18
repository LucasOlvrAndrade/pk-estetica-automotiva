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
 *  - AMBIENTE   a própria sala (o box) é "fotografada" em 360° e vira o environment map, que se
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
    box: 1, // tubos de LED e painéis do teto do box
    holofote: 28, // luz de inspeção que varre a carroceria
    farolNoChao: 14, // facho dos faróis
    estudio: 1.3, // força do reflexo do box (environment map: os tubos refletidos na pintura)
    ambiente: 0.9, // luz difusa do box (deixa ver o piso e as vagas)
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
   * Desenha uma textura num canvas 2D e devolve como textura do Three.js (repetida).
   * @param {number} largura
   * @param {number} altura
   * @param {function(CanvasRenderingContext2D): void} desenhar
   * @param {number} repX Quantas vezes repete na horizontal.
   * @param {number} repY Quantas vezes repete na vertical.
   * @param {boolean} cor true = textura de cor (sRGB); false = dado (ex.: aspereza).
   * @returns {THREE.CanvasTexture}
   */
  function texturaDeCanvas(largura, altura, desenhar, repX, repY, cor) {
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    desenhar(canvas.getContext('2d'));
    const textura = new THREE.CanvasTexture(canvas);
    textura.wrapS = textura.wrapT = THREE.RepeatWrapping;
    textura.repeat.set(repX, repY);
    textura.anisotropy = 8; // nítida mesmo vista "deitada" (o chão)
    if (cor) textura.colorSpace = THREE.SRGBColorSpace;
    return textura;
  }

  /** Sorteio com semente: a textura sai sempre igual. */
  function sorteador(semente) {
    let x = semente;
    return function () {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x / 2147483648;
    };
  }

  /**
   * Piso de box de estética: placas plásticas de encaixe (as "grades" pretas de lava-rápido),
   * com furinhos e frestas entre as placas. Volta a textura de COR e a de ASPEREZA.
   * @returns {{cor: THREE.CanvasTexture, aspereza: THREE.CanvasTexture}}
   */
  function criarTexturasChao() {
    const LADO = 512;
    const PLACAS = 4; // 4 x 4 placas por repetição (cada placa = 40 cm)
    const passo = LADO / PLACAS;
    function desenhar(ctx, modo) {
      const r = sorteador(7);
      const cor = modo === 'cor';
      ctx.fillStyle = cor ? '#050506' : '#ffffff'; // frestas: escuras e ásperas
      ctx.fillRect(0, 0, LADO, LADO);
      for (let i = 0; i < PLACAS; i++) {
        for (let j = 0; j < PLACAS; j++) {
          const x = i * passo;
          const y = j * passo;
          const tom = 30 + Math.floor(r() * 8); // cada placa com um tom levemente diferente
          ctx.fillStyle = cor ? 'rgb(' + tom + ',' + tom + ',' + (tom + 3) + ')' : '#6e6e6e';
          ctx.fillRect(x + 3, y + 3, passo - 6, passo - 6);
          // furinhos da placa (grade 8 x 8)
          ctx.fillStyle = cor ? '#0c0c0e' : '#d0d0d0';
          const furo = passo / 8;
          for (let a = 0; a < 8; a++) {
            for (let b = 0; b < 8; b++) {
              ctx.fillRect(x + 3 + a * furo + furo * 0.28, y + 3 + b * furo + furo * 0.28, furo * 0.42, furo * 0.42);
            }
          }
        }
      }
    }
    return {
      cor: texturaDeCanvas(LADO, LADO, (ctx) => desenhar(ctx, 'cor'), 1, 1, true),
      aspereza: texturaDeCanvas(LADO, LADO, (ctx) => desenhar(ctx, 'aspereza'), 1, 1, false),
    };
  }

  /**
   * Sombra de contato embaixo do carro (sem ela, com o chão texturizado, o carro parece flutuar).
   * Um degradê escuro num plano, bem mais barato que sombra calculada em tempo real.
   * @returns {THREE.Mesh}
   */
  function criarSombra() {
    const textura = texturaDeCanvas(
      256,
      256,
      function (ctx) {
        const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        g.addColorStop(0, 'rgba(0,0,0,0.95)');
        g.addColorStop(0.55, 'rgba(0,0,0,0.7)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 256);
      },
      1,
      1,
      true
    );
    const sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(COMPRIMENTO * 1.2, COMPRIMENTO * 0.62),
      new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false, color: 0x000000 })
    );
    sombra.rotation.x = -Math.PI / 2;
    sombra.position.y = 0.012;
    return sombra;
  }

  /**
   * O BOX DE ESTÉTICA (inspirado num box real de detailing):
   *  - sala fechada com paredes pretas e o lado da câmera aberto (como a porta da garagem);
   *  - tubos de LED em diagonal nas paredes, formando "setas" (chevrons), alternando luz
   *    branca e luz quente;
   *  - teto com painéis de luz e pontinhos de spot;
   *  - piso de placas pretas de encaixe e as faixas das vagas pintadas no chão (verde da marca).
   * As luzes são MeshBasicMaterial com cor "acima de 1" (HDR): brilham sozinhas e o bloom dá
   * o halo. Elas não iluminam a cena de verdade (seria pesado); quem ilumina o carro é o
   * environment map feito a partir DESTA sala (ver criar()): por isso os tubos aparecem
   * refletidos na pintura, como na foto de referência.
   * @returns {{grupo: THREE.Group, acender: function(function(number, number): number): void, liberar: function(): void}}
   */
  function criarEstudio() {
    const grupo = new THREE.Group();
    const geometrias = [];
    const materiais = [];
    const texturas = [];
    const luzes = []; // tudo que acende: tubos e painéis do teto

    // Medidas da sala (o carro está no centro, com a frente para +x; a câmera fica em +x / +z)
    const FUNDO = -8; // parede do fundo (x)
    const FRENTE = 15; // lado aberto (x)
    const LADO_Z = 6.5; // paredes laterais em z = ±6,5
    const ALTURA = 4.4;
    const COMPR = FRENTE - FUNDO;
    const LARG = LADO_Z * 2;
    const centroX = (FRENTE + FUNDO) / 2;

    // ---------- Piso ----------
    const tex = criarTexturasChao();
    texturas.push(tex.cor, tex.aspereza);
    [tex.cor, tex.aspereza].forEach((t) => t.repeat.set(COMPR / 1.6, LARG / 1.6)); // placas de 40 cm
    const geoPiso = new THREE.PlaneGeometry(COMPR, LARG);
    const matPiso = new THREE.MeshStandardMaterial({ map: tex.cor, roughnessMap: tex.aspereza, roughness: 1, metalness: 0, envMapIntensity: 0.6 });
    const piso = new THREE.Mesh(geoPiso, matPiso);
    piso.rotation.x = -Math.PI / 2;
    piso.position.x = centroX;
    grupo.add(piso);
    geometrias.push(geoPiso);
    materiais.push(matPiso);

    // ---------- Paredes e teto (pretos, foscos) ----------
    const matParede = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.85, envMapIntensity: 0.5 });
    materiais.push(matParede);
    function plano(largura, altura, x, y, z, rotX, rotY, material) {
      const geo = new THREE.PlaneGeometry(largura, altura);
      geometrias.push(geo);
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      m.rotation.set(rotX, rotY, 0);
      grupo.add(m);
      return m;
    }
    plano(LARG, ALTURA, FUNDO, ALTURA / 2, 0, 0, Math.PI / 2, matParede); // fundo
    plano(COMPR, ALTURA, centroX, ALTURA / 2, -LADO_Z, 0, 0, matParede); // lateral de trás
    plano(COMPR, ALTURA, centroX, ALTURA / 2, LADO_Z, 0, Math.PI, matParede); // lateral da câmera
    plano(COMPR, LARG, centroX, ALTURA, 0, Math.PI / 2, 0, matParede); // teto

    // ---------- Tubos de LED em "setas" ----------
    const BRANCA = new THREE.Color(0xe9efff);
    const QUENTE = new THREE.Color(0xffb04a);
    const geoTubo = new THREE.CylinderGeometry(0.03, 0.03, 1.25, 8);
    geometrias.push(geoTubo);
    /**
     * Uma coluna de 2 tubos formando "<" ou ">" na parede.
     * @param {THREE.Vector3} posicao Centro da coluna (já encostado na parede).
     * @param {number} giroParede Rotação y da parede (os tubos ficam "deitados" nela).
     * @param {THREE.Color} cor
     * @param {number} sentido 1 ou -1 (para qual lado a seta aponta).
     * @param {number} atraso 0 a 1: ordem em que acende.
     */
    function coluna(posicao, giroParede, cor, sentido, atraso) {
      const material = new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: true });
      materiais.push(material);
      luzes.push({ material: material, base: cor, atraso: atraso });
      [-1, 1].forEach(function (cima) {
        const tubo = new THREE.Mesh(geoTubo, material);
        const suporte = new THREE.Group(); // gira com a parede
        suporte.position.copy(posicao);
        suporte.rotation.y = giroParede;
        tubo.position.y = cima * 0.62;
        tubo.rotation.z = cima * sentido * 0.62; // inclinação da diagonal
        suporte.add(tubo);
        grupo.add(suporte);
      });
    }
    // lateral de trás (z = -6,5) e lateral da câmera (z = +6,5): colunas a cada 1,1 m
    let n = 0;
    for (let x = FUNDO + 1; x < FRENTE - 1; x += 1.1, n++) {
      const cor = n % 2 ? QUENTE : BRANCA;
      const atraso = (x - FUNDO) / COMPR;
      coluna(new THREE.Vector3(x, 1.75, -LADO_Z + 0.06), 0, cor, n % 2 ? 1 : -1, atraso);
      coluna(new THREE.Vector3(x, 1.75, LADO_Z - 0.06), Math.PI, cor, n % 2 ? 1 : -1, atraso);
    }
    // parede do fundo
    n = 0;
    for (let z = -LADO_Z + 1; z < LADO_Z - 0.5; z += 1.1, n++) {
      coluna(new THREE.Vector3(FUNDO + 0.06, 1.75, z), Math.PI / 2, n % 2 ? QUENTE : BRANCA, n % 2 ? 1 : -1, 0);
    }

    // ---------- Teto: painéis de luz e spots ----------
    const geoPainel = new THREE.PlaneGeometry(2.6, 0.22);
    const geoSpot = new THREE.CircleGeometry(0.06, 12);
    geometrias.push(geoPainel, geoSpot);
    for (let x = FUNDO + 2; x < FRENTE - 1; x += 3.4) {
      const material = new THREE.MeshBasicMaterial({ color: 0x000000 });
      materiais.push(material);
      luzes.push({ material: material, base: BRANCA, atraso: (x - FUNDO) / COMPR });
      [-2.2, 2.2].forEach(function (z) {
        const painel = new THREE.Mesh(geoPainel, material);
        painel.position.set(x, ALTURA - 0.02, z);
        painel.rotation.x = Math.PI / 2;
        grupo.add(painel);
      });
      for (let k = -4; k <= 4; k++) {
        const spot = new THREE.Mesh(geoSpot, material);
        spot.position.set(x + 1.7, ALTURA - 0.02, k * 0.55);
        spot.rotation.x = Math.PI / 2;
        grupo.add(spot);
      }
    }

    // ---------- Faixas das vagas (tinta verde da marca no chão) ----------
    const matFaixa = new THREE.MeshStandardMaterial({ color: 0x2bd873, roughness: 0.55, envMapIntensity: 0.8, emissive: 0x0b3a20 });
    materiais.push(matFaixa);
    function faixa(largura, profundidade, x, z) {
      const geo = new THREE.PlaneGeometry(largura, profundidade);
      geometrias.push(geo);
      const m = new THREE.Mesh(geo, matFaixa);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.008, z);
      grupo.add(m);
    }
    const ESP = 0.16; // espessura da faixa
    // vaga do carro: x de -3,3 até 3,6 e z de -1,9 até 1,9; a vaga vizinha fica atrás (z negativo)
    faixa(6.9, ESP, 0.15, 1.9);
    faixa(6.9, ESP, 0.15, -1.9);
    faixa(6.9, ESP, 0.15, -5.7);
    faixa(ESP, 7.6 + ESP, -3.3, -1.9);

    /** Acende cada luz (0 a 1), com uma "piscada" de lâmpada ligando no começo. */
    function acender(nivelDe) {
      luzes.forEach(function (luz, i) {
        const nivel = nivelDe(luz.atraso, i);
        luz.material.color.copy(luz.base).multiplyScalar(nivel * 1.5); // > 1: entra no bloom (halo dos tubos)
      });
    }

    return {
      grupo: grupo,
      acender: acender,
      liberar: function () {
        geometrias.forEach((g) => g.dispose());
        materiais.forEach((m) => m.dispose());
        texturas.forEach((t) => t.dispose());
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
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

    // ---------- O box (sala, luzes, piso e vagas) ----------
    const estudio = criarEstudio();
    cena.add(estudio.grupo);

    // Reflexos: "fotografa" a sala com todas as luzes acesas, do ponto onde fica o carro, e usa
    // essa foto 360° como environment map. Assim os tubos de LED aparecem refletidos na pintura.
    const pmrem = new THREE.PMREMGenerator(renderizador);
    estudio.acender(() => 1);
    const ambiente = pmrem.fromScene(cena, 0.02, 0.1, 60, { position: new THREE.Vector3(0, 1.1, 0) }).texture;
    estudio.acender(() => 0); // e apaga tudo: a abertura começa no escuro
    cena.environment = ambiente;
    cena.environmentIntensity = 0; // começa no escuro: só os faróis aparecem

    const sombra = criarSombra();
    cena.add(sombra);
    const halo = criarNeonNoChao();
    cena.add(halo);

    // ---------- Luzes ----------
    // Sem luzes verdes de verdade: elas viravam manchas verdes na lataria e no para-choque
    // no começo da abertura (cena escura). O neon é só o halo pintado no chão (criarNeonNoChao).
    // Luz difusa do box: o teto claro em cima e o piso escuro embaixo (acende com os tubos)
    const luzDoBox = new THREE.HemisphereLight(0xfff4e6, 0x101012, 0);
    cena.add(luzDoBox);
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
    // força 0.25, raio curto e limiar 0.98: só o que é MUITO claro (faróis e tubos) ganha halo
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.25, 0.15, 0.98);
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

      // As luzes do box acendem do fundo para a frente, cada uma com uma "piscada" de lâmpada
      estudio.acender(function (atraso, i) {
        const t = (s - d * (0.18 + atraso * 0.3)) / (d * 0.06);
        if (t <= 0) return 0;
        if (t >= 1) return LUZ.box;
        return LUZ.box * (Math.sin(s * 70 + i * 1.7) > 0.1 ? suave(t) : 0.15);
      });

      // Estúdio "acende" e o holofote varre a carroceria de trás para a frente
      const boxAceso = suave((s - d * 0.22) / (d * 0.3));
      cena.environmentIntensity = LUZ.estudio * boxAceso;
      luzDoBox.intensity = LUZ.ambiente * boxAceso;
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
      sombra.geometry.dispose();
      sombra.material.map.dispose();
      sombra.material.dispose();
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
