/**
 * vitrine3d.js: Vitrine3D
 *
 * O Civic 3D do Início (o MESMO modelo da abertura, carregado pelo modelo3d.js), num
 * "estúdio" simples: fundo transparente, reflexo do estúdio e um fio de neon embaixo.
 *
 * Interface simples (estado.giro, desenhar(), definirCor(hex), destruir()): o app.js troca a
 * imagem do Civic por ela sem mudar o resto (arrastar, setas do teclado, giro com a rolagem e
 * as amostras de cor continuam iguais).
 *
 * Mais leve que a abertura: sem pós-processamento e com pixelRatio limitado.
 *
 * MÓDULO ES: carregado com import() só depois que a página terminou de carregar.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Modelo3D } from './modelo3d.js';

export const Vitrine3D = (function () {
  'use strict';

  const GIRO_REFERENCIA = 0.55; // giro em que o carro aparece em 3/4 de frente (igual ao 2D)

  /**
   * Cria a vitrine 3D no canvas.
   * @param {HTMLCanvasElement} canvas Canvas vazio (sem contexto 2D).
   * @param {{cor?: string, celular?: boolean}} [opcoes] cor: hex da pintura (ex.: '#1c1d22');
   *   celular: versão mais leve (sem suavização de bordas e menos pixels).
   * @returns {Promise<{estado: {giro: number}, desenhar: function(): void, definirCor: function(string): void, destruir: function(): void}>}
   */
  async function criar(canvas, opcoes) {
    opcoes = opcoes || {};
    const estado = { giro: GIRO_REFERENCIA };

    // alpha: fundo transparente (aparece o "PK" e a luz verde do CSS atrás do carro)
    const celular = Boolean(opcoes.celular);
    const renderizador = new THREE.WebGLRenderer({ canvas: canvas, antialias: !celular, alpha: true });
    renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, celular ? 1.5 : 2)); // menos pixels no celular
    renderizador.toneMapping = THREE.ACESFilmicToneMapping;
    renderizador.toneMappingExposure = 0.9;
    renderizador.outputColorSpace = THREE.SRGBColorSpace;

    const cena = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderizador);
    const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    cena.environment = ambiente;
    cena.environmentIntensity = 0.6;

    // Uma luz principal de cima (desenha o volume) e um fio de neon verde embaixo
    const principal = new THREE.DirectionalLight(0xffffff, 1.2);
    principal.position.set(3, 6, 4);
    const neon = new THREE.PointLight(0x39ff88, 0.5, 2, 2);
    neon.position.set(0, 0.08, 0);
    cena.add(principal, neon);

    // Câmera em 3/4, um pouco acima, enquadrando o carro inteiro
    const camera = new THREE.PerspectiveCamera(30, 16 / 10, 0.1, 100);
    camera.position.set(0, 1.9, 7.4);
    camera.lookAt(0, 0.5, 0);

    const carro = await Modelo3D.carregar();
    const giratorio = new THREE.Group(); // gira em volta do centro do carro
    giratorio.add(carro.pivo);
    cena.add(giratorio);

    /** Ajusta o desenho ao tamanho do canvas na tela. */
    function ajustar() {
      const largura = canvas.clientWidth || 1;
      const altura = canvas.clientHeight || 1;
      renderizador.setSize(largura, altura, false);
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
    }

    /** Desenha um quadro com o giro atual (o app.js chama a cada quadro do loop). */
    function desenhar() {
      giratorio.rotation.y = -(estado.giro - GIRO_REFERENCIA) - Math.PI / 4;
      renderizador.render(cena, camera);
    }

    /**
     * Troca a cor da pintura (só a lataria: faróis, frisos e vidros continuam).
     * @param {string} hex Ex.: '#c0161d'.
     */
    function definirCor(hex) {
      if (carro.pintura) carro.pintura.cor.value.set(hex);
      desenhar();
    }

    const observador = new ResizeObserver(function () {
      ajustar();
      desenhar();
    });
    observador.observe(canvas);
    ajustar();
    if (opcoes.cor) definirCor(opcoes.cor);

    /** Libera tudo da placa de vídeo. */
    function destruir() {
      observador.disconnect();
      carro.liberar();
      ambiente.dispose();
      pmrem.dispose();
      renderizador.dispose();
    }

    return { estado: estado, desenhar: desenhar, definirCor: definirCor, destruir: destruir };
  }

  return { criar: criar };
})();
