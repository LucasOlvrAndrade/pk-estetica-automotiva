/**
 * modelo3d.js — Modelo3D
 *
 * Carrega o Civic 3D e prepara os materiais. É usado por DOIS lugares:
 *  - intro3d.js   (a abertura cinematográfica);
 *  - vitrine3d.js (o carro girável do Início).
 * Assim, o carro da abertura e o do Início são exatamente o mesmo.
 *
 * Modelo: "Honda Civic Type R (EK9) - Low Poly & Stylized", de marksform (Sketchfab),
 * licença CC BY 4.0. Não tem emblemas nem logotipos. Modificado: pintura preta,
 * cromados e compressão (Draco na geometria + WebP 1024 px nas texturas: 487 KB → 68 KB).
 *
 * Materiais (MeshPhysicalMaterial): pintura com verniz (clearcoat), rodas e escapamento
 * cromados, vidro fumê. O modelo é "low poly": as cores vêm de UMA textura (amarelo =
 * lataria). Um trecho de shader troca só o amarelo pela cor da pintura e acende os faróis
 * e lanternas pintados na textura.
 *
 * MÓDULO ES: carregado com import() só quando uma cena 3D vai rodar.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import urlModelo from '../assets/modelos/civic-ek9.glb?url';
// Decodificador Draco (o modelo vem comprimido). "?url" faz o Vite incluir os arquivos no build
// e devolver o endereço final de cada um.
import urlDracoJs from 'three/examples/jsm/libs/draco/draco_wasm_wrapper.js?url';
import urlDracoWasm from 'three/examples/jsm/libs/draco/draco_decoder.wasm?url';

export const Modelo3D = (function () {
  'use strict';

  const COMPRIMENTO = 4.2; // o modelo é reescalado para ~4,2 m (o arquivo vem minúsculo)
  const PRETO_PADRAO = 0x030304;

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
   *  1. onde a textura é AMARELA (lataria), a cor vira a da pintura (uPintura). O teste é pelo
   *     "tom" (vermelho e verde altos, azul baixo), não por uma cor exata: assim as bordas
   *     suavizadas entre o amarelo e os frisos pretos também mudam (sem filete amarelo);
   *  2. partes claras e neutras emitem luz SÓ na frente (faróis) e as vermelhas SÓ atrás
   *     (lanternas), conforme uFarois. A posição vem do vértice (z do modelo: frente = +z).
   * @param {THREE.Texture} textura Textura original da carroceria.
   * @returns {{material: THREE.MeshPhysicalMaterial, farois: {value: number}, cor: {value: THREE.Color}}}
   */
  function criarPintura(textura) {
    const farois = { value: 0 }; // 0 = apagados, 1 = acesos
    const cor = { value: new THREE.Color(PRETO_PADRAO) };
    const material = new THREE.MeshPhysicalMaterial({
      map: textura,
      metalness: 0.2,
      roughness: 0.22,
      clearcoat: 1, // camada de verniz por cima da cor: o "espelho"
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.3,
    });
    material.onBeforeCompile = function (shader) {
      shader.uniforms.uPintura = cor;
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
    return { material: material, farois: farois, cor: cor };
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
    const material = new THREE.MeshPhysicalMaterial({ map: textura, metalness: 1, roughness: 0.22, envMapIntensity: 1.6 });
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
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.85, 0.22, claro);');
    };
    return material;
  }

  /**
   * Carrega o modelo, ajusta tamanho e posição e aplica os materiais.
   * @param {{aoProgresso?: function(number): void}} [opcoes]
   * @returns {Promise<{pivo: THREE.Group, pintura: Object, comprimento: number, liberar: function(): void}>}
   *   pivo: grupo com o carro já em pé no chão (y = 0), centrado e com a FRENTE para +x.
   */
  async function carregar(opcoes) {
    opcoes = opcoes || {};
    const draco = new DRACOLoader();
    draco.setDecoderPath({ js: urlDracoJs, wasm: urlDracoWasm }); // endereços exatos (ver imports)
    const carregador = new GLTFLoader();
    carregador.setDRACOLoader(draco);
    const gltf = await carregador.loadAsync(urlModelo, function (evento) {
      if (opcoes.aoProgresso && evento.total) opcoes.aoProgresso(evento.loaded / evento.total);
    });
    draco.dispose(); // modelo decodificado: o "worker" do decodificador já pode sair
    const modelo = gltf.scene;

    // Escala e posição: o arquivo vem minúsculo e fora do centro
    const caixa = new THREE.Box3().setFromObject(modelo);
    const tamanho = caixa.getSize(new THREE.Vector3());
    modelo.scale.setScalar(COMPRIMENTO / Math.max(tamanho.x, tamanho.z));
    caixa.setFromObject(modelo);
    const centro = caixa.getCenter(new THREE.Vector3());
    modelo.position.set(-centro.x, -caixa.min.y, -centro.z);

    // Para que lado é a frente? Das rodas traseiras (RLWHEEL/RRWHEEL) para as dianteiras (FL/FR)
    const pivo = new THREE.Group();
    pivo.add(modelo);
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
      color: 0x07080a, // vidro fumê escuro
      metalness: 0,
      roughness: 0.12, // um pouco fosco: o reflexo não "estoura" na luz
      transparent: true,
      opacity: 0.85,
      envMapIntensity: 0.45,
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

    /** Libera geometrias, materiais e texturas do modelo da placa de vídeo. */
    function liberar() {
      pivo.traverse(function (no) {
        if (no.geometry) no.geometry.dispose();
        if (!no.material) return;
        Object.keys(no.material).forEach(function (chave) {
          if (no.material[chave] && no.material[chave].isTexture) no.material[chave].dispose();
        });
        no.material.dispose();
      });
    }

    return { pivo: pivo, pintura: pintura, comprimento: COMPRIMENTO, liberar: liberar };
  }

  return { carregar: carregar, COMPRIMENTO: COMPRIMENTO };
})();
