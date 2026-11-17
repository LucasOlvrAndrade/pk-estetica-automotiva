/**
 * intro3d.js — Intro3D
 *
 * Cena da abertura em 3D real (Three.js) com o modelo .glb do Civic.
 * Se o aparelho não aguenta (sem WebGL, conexão lenta, pouca memória), o app.js
 * usa o carro em Canvas 2D (carro3d.js).
 *
 * Como a cena funciona:
 *  - CENA       a "caixa" onde ficam o carro, o chão e as luzes.
 *  - CÂMERA     PerspectiveCamera: vê como um olho (o que está longe fica menor).
 *  - AMBIENTE   RoomEnvironment vira um "environment map": um estúdio invisível que se
 *               reflete na pintura e no cromo (é ele que dá o brilho espelhado).
 *  - LUZES      faróis (emissivos), neon verde embaixo e um holofote que varre o carro.
 *  - MATERIAIS  MeshPhysicalMaterial: pintura preta com verniz (clearcoat), rodas e
 *               escapamento cromados, vidro fumê. O modelo é "low poly": as cores vêm de
 *               UMA textura (amarelo = lataria). Um trecho de shader troca só o amarelo
 *               pelo preto e acende os faróis e lanternas pintados na textura.
 *  - LOOP       a cada quadro o app.js chama quadro(segundos) e a cena se redesenha.
 *  - PÓS        EffectComposer + bloom: o que é muito claro (faróis, neon) ganha brilho.
 *
 * Modelo: "Honda Civic Type R (EK9) - Low Poly & Stylized", de marksform (Sketchfab),
 * licença CC BY 4.0. Não tem emblemas nem logotipos. Modificado: pintura preta,
 * cromados e compressão (Draco na geometria + WebP 1024 px nas texturas: 487 KB → 68 KB).
 *
 * MÓDULO ES: carregado com import() só quando a abertura 3D vai rodar.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import urlModelo from '../assets/modelos/civic-ek9.glb?url';
// Decodificador Draco (o modelo vem comprimido). "?url" faz o Vite incluir os arquivos no build
// e devolver o endereço final de cada um.
import urlDracoJs from 'three/examples/jsm/libs/draco/draco_wasm_wrapper.js?url';
import urlDracoWasm from 'three/examples/jsm/libs/draco/draco_decoder.wasm?url';

export const Intro3D = (function () {
  'use strict';

  const COMPRIMENTO = 4.2; // o modelo é reescalado para ~4,2 m (o arquivo vem minúsculo)
  const VERDE_NEON = 0x39ff88;

  /** Interpolação suave 0→1 (começa e termina devagar). */
  function suave(t) {
    const x = Math.min(1, Math.max(0, t));
    return x * x * (3 - 2 * x);
  }

  /** Centro (no mundo) dos objetos cujo NOME casa com a expressão (ex.: /^F[LR]WHEEL/). */
  function centroDos(raiz, padrao) {
    const caixa = new THREE.Box3();
    let achou = false;
    raiz.traverse(function (no) {
      if (padrao.test(no.name)) {
        caixa.expandByObject(no);
        achou = true;
      }
    });
    return achou ? caixa.getCenter(new THREE.Vector3()) : null;
  }

  /**
   * Pintura da carroceria: MeshPhysicalMaterial com verniz e a textura original.
   * onBeforeCompile acrescenta 2 trechos ao shader pronto do Three.js:
   *  1. onde a textura é AMARELA (lataria), a cor vira o preto da pintura. O teste é pelo
   *     "tom" (vermelho e verde altos, azul baixo), não por uma cor exata: assim as bordas
   *     suavizadas entre o amarelo e os frisos pretos também viram preto (sem filete amarelo);
   *  2. partes claras e neutras emitem luz SÓ na frente (faróis) e as vermelhas SÓ atrás
   *     (lanternas), conforme uFarois. A posição vem do vértice (z do modelo: frente = +z).
   * @param {THREE.Texture} textura Textura original da carroceria.
   * @returns {{material: THREE.MeshPhysicalMaterial, farois: {value: number}}}
   */
  function criarPintura(textura) {
    const farois = { value: 0 }; // 0 = apagados, 1 = acesos (a abertura anima)
    const material = new THREE.MeshPhysicalMaterial({
      map: textura,
      metalness: 0.2,
      roughness: 0.18,
      clearcoat: 1, // camada de verniz por cima da cor: o "espelho"
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.8,
    });
    material.onBeforeCompile = function (shader) {
      shader.uniforms.uPintura = { value: new THREE.Color(0x030304) };
      shader.uniforms.uFarois = farois;
      // Vértice: passa a posição z (frente/trás do carro) para o fragmento
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying float vProfundidade;\nvoid main() {')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvProfundidade = position.z;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uPintura;\nuniform float uFarois;\nvarying float vProfundidade;\nvoid main() {')
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            'vec3 corTextura = diffuseColor.rgb;',
            // "amarelado" = o menor entre vermelho e verde, menos o azul
            'float lataria = smoothstep(0.04, 0.16, min(corTextura.r, corTextura.g) - corTextura.b);',
            'diffuseColor.rgb = mix(corTextura, uPintura, lataria);',
          ].join('\n')
        )
        .replace(
          '#include <emissivemap_fragment>',
          [
            '#include <emissivemap_fragment>',
            'float farol = smoothstep(0.4, 0.6, min(corTextura.r, min(corTextura.g, corTextura.b))) * step(1.15, vProfundidade);',
            'float lanterna = smoothstep(0.3, 0.5, corTextura.r) * (1.0 - smoothstep(0.05, 0.15, corTextura.g)) * step(vProfundidade, -1.05);',
            'totalEmissiveRadiance += (vec3(1.0, 0.96, 0.9) * farol * 2.2 + vec3(1.0, 0.12, 0.18) * lanterna * 1.8) * uFarois;',
          ].join('\n')
        );
    };
    return { material: material, farois: farois };
  }

  /**
   * Rodas e escapamento: o que é claro na textura vira CROMO (metal polido refletindo o
   * estúdio); o que é escuro (pneu) fica fosco. Também via onBeforeCompile.
   * A textura da roda tem "HONDA CIVIC TYPE R EK9" escrito no pneu (lado direito da imagem,
   * u > 0,62): ali a cor vira a do pneu, então o texto da marca some. A assinatura do autor
   * ("© madizon", u ≈ 0,53) continua.
   * @param {THREE.Texture} textura
   * @returns {THREE.MeshPhysicalMaterial}
   */
  function criarCromado(textura) {
    const material = new THREE.MeshPhysicalMaterial({ map: textura, metalness: 1, roughness: 0.2, envMapIntensity: 2 });
    material.onBeforeCompile = function (shader) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_fragment>',
          [
            '#include <map_fragment>',
            '#ifdef USE_MAP',
            'if (vMapUv.x > 0.62) diffuseColor.rgb = vec3(0.018);', // apaga o texto da marca no pneu
            '#endif',
            'float claro = smoothstep(0.12, 0.35, dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)));',
          ].join('\n')
        )
        .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= claro;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.85, 0.18, claro);');
    };
    return material;
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
    g.addColorStop(0, 'rgba(57, 255, 136, 0.9)');
    g.addColorStop(0.45, 'rgba(57, 255, 136, 0.35)');
    g.addColorStop(1, 'rgba(57, 255, 136, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(COMPRIMENTO * 1.55, COMPRIMENTO * 0.85),
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
    renderizador.toneMappingExposure = 0.8;
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
      new THREE.MeshStandardMaterial({ color: 0x020203, roughness: 0.6, metalness: 0.1, envMapIntensity: 0.05 }) // chão quase preto: reflete pouco o estúdio
    );
    chao.rotation.x = -Math.PI / 2;
    cena.add(chao);
    const halo = criarNeonNoChao();
    cena.add(halo);

    // ---------- Luzes ----------
    const neon = [-1.2, 0, 1.2].map(function (x) {
      const luz = new THREE.PointLight(VERDE_NEON, 0, 2.6, 2);
      luz.position.set(x, 0.12, 0);
      cena.add(luz);
      return luz;
    });
    const holofote = new THREE.SpotLight(0xffffff, 0, 18, 0.32, 0.6, 1.2); // a "luz de inspeção"
    holofote.position.set(-6, 4.5, 2.5);
    cena.add(holofote, holofote.target);
    const luzFarol = new THREE.SpotLight(0xfff3dc, 0, 12, 0.32, 0.8, 1.6); // luz dos faróis no chão
    cena.add(luzFarol, luzFarol.target);

    // ---------- Modelo ----------
    const draco = new DRACOLoader();
    draco.setDecoderPath({ js: urlDracoJs, wasm: urlDracoWasm }); // endereços exatos (ver imports)
    const carregador = new GLTFLoader();
    carregador.setDRACOLoader(draco);
    const gltf = await carregador.loadAsync(urlModelo, function (evento) {
      if (opcoes.aoProgresso && evento.total) opcoes.aoProgresso(evento.loaded / evento.total);
    });
    const modelo = gltf.scene;

    // Escala e posição: o arquivo vem minúsculo e fora do centro
    const caixa = new THREE.Box3().setFromObject(modelo);
    const tamanho = caixa.getSize(new THREE.Vector3());
    const escala = COMPRIMENTO / Math.max(tamanho.x, tamanho.z);
    modelo.scale.setScalar(escala);
    caixa.setFromObject(modelo);
    const centro = caixa.getCenter(new THREE.Vector3());
    modelo.position.set(-centro.x, -caixa.min.y, -centro.z);

    // Para que lado é a frente? Das rodas traseiras (RLWHEEL/RRWHEEL) para as dianteiras (FL/FR)
    const pivo = new THREE.Group();
    pivo.add(modelo);
    cena.add(pivo);
    const dianteiras = centroDos(modelo, /^F[LR]WHEEL/);
    const traseiras = centroDos(modelo, /^R[LR]WHEEL/);
    if (dianteiras && traseiras) {
      const frente = dianteiras.sub(traseiras);
      pivo.rotation.y = Math.atan2(frente.z, frente.x); // gira até a frente apontar para +x
    }

    // Materiais. Este modelo não tem emblema nem logotipo da Honda (as cores vêm de uma textura).
    let pintura = null;
    const cromados = {}; // um material por textura (as 4 rodas compartilham o mesmo)
    const vidro = new THREE.MeshPhysicalMaterial({
      color: 0x0b0d10, // vidro fumê
      metalness: 0,
      roughness: 0.04,
      transparent: true,
      opacity: 0.7,
      envMapIntensity: 1.6,
    });
    modelo.traverse(function (no) {
      if (!no.isMesh) return;
      const nome = no.material.name;
      const textura = no.material.map;
      if (/CHASSIS/.test(nome)) {
        if (!pintura) pintura = criarPintura(textura);
        no.material = pintura.material;
      } else if (/WHEEL|EXHAUST/.test(nome)) {
        if (!cromados[nome]) cromados[nome] = criarCromado(textura);
        no.material = cromados[nome];
      } else if (/GLASS/.test(nome)) {
        no.material = vidro;
      }
    });

    // Luz dos faróis aponta para a frente (+x) a partir do para-choque
    luzFarol.position.set(COMPRIMENTO / 2 - 0.2, 0.7, 0);
    luzFarol.target.position.set(COMPRIMENTO * 2.5, 0, 0);

    // ---------- Pós-processamento ----------
    const composer = new EffectComposer(renderizador);
    composer.addPass(new RenderPass(cena, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 0.96); // só o que é MUITO claro brilha
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
      luzFarol.intensity = 22 * estado.farois;
      const neonLigado = suave((s - d * 0.12) / (d * 0.1));
      neon.forEach((l) => (l.intensity = 1.6 * neonLigado));
      halo.material.opacity = 0.38 * neonLigado;

      // Estúdio "acende" e o holofote varre a carroceria de trás para a frente
      cena.environmentIntensity = 0.55 * suave((s - d * 0.22) / (d * 0.3));
      const varredura = suave((s - d * 0.22) / (d * 0.45));
      holofote.intensity = 70 * Math.sin(Math.PI * varredura);
      holofote.position.x = -6 + 12 * varredura;
      holofote.target.position.set(holofote.position.x * 0.4, 0.6, 0);

      composer.render();
    }

    /** Libera tudo da memória da placa de vídeo (geometrias, materiais, texturas). */
    function destruir() {
      observador.disconnect();
      cena.traverse(function (no) {
        if (no.geometry) no.geometry.dispose();
        if (no.material) {
          const lista = Array.isArray(no.material) ? no.material : [no.material];
          lista.forEach(function (m) {
            Object.keys(m).forEach(function (chave) {
              if (m[chave] && m[chave].isTexture) m[chave].dispose();
            });
            m.dispose();
          });
        }
      });
      ambiente.dispose();
      pmrem.dispose();
      draco.dispose(); // encerra o "worker" do decodificador
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
