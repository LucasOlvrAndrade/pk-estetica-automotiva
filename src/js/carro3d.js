/**
 * carro3d.js — Carro3D
 *
 * Um "mini motor 3D" feito só com Canvas 2D: sem Three.js, sem biblioteca.
 * Desenha o carro da abertura e o carro do topo da página.
 *
 * Como um motor 3D funciona, em 5 passos (os mesmos de um jogo):
 *  1. MODELO      o carro é uma lista de faces (polígonos) com pontos x, y, z.
 *  2. ROTAÇÃO     cada ponto é girado com seno e cosseno, conforme a câmera.
 *  3. PROJEÇÃO    o ponto 3D vira 2D dividindo por z: o que está longe fica menor.
 *  4. VISIBILIDADE faces de costas para a câmera são puladas; as outras são
 *                 pintadas da mais longe para a mais perto ("algoritmo do pintor").
 *  5. LUZ         a cor de cada face depende do ângulo entre ela e a luz.
 *
 * O carro: Honda Civic sedã 2001 (7ª geração), rebaixado, com kit aerodinâmico
 * no estilo Mugen (lábio dianteiro, saias, aerofólio) e rodas de 10 raios.
 * Só as formas: nenhum logotipo de marca é desenhado.
 *
 * Eixos do modelo: x = comprimento (frente = +x), y = altura, z = largura.
 * A unidade é mais ou menos 1 metro: o carro tem uns 4,45 m de comprimento.
 *
 * Este arquivo só sabe DESENHAR. Quem decide quando girar, acender os faróis
 * ou trocar a cor é o app.js.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam
 * (eles fazem "import { … } from"). A IIFE continua igual: tudo que está
 * dentro dela é privado, e só o objeto devolvido no "return" é público.
 */
export const Carro3D = (function () {
  'use strict';

  /* =====================================================================
   * 1. CONFIGURAÇÃO
   * ===================================================================== */

  /** Telas "retina" têm 2 ou 3 pixels por ponto. Acima de 2 o custo sobe e ninguém vê diferença. */
  const MAX_DPR = 2;

  /* Medidas do Civic sedã 2001 (7ª geração), rebaixado:
     4,45 m de comprimento, 2,62 m entre-eixos, ~1,40 m de altura. */
  const RAIO_PNEU = 0.33;
  const RAIO_ARCO = 0.37; // arco do para-lama justo no pneu: carro rebaixado
  const ALTURA_ASSOALHO = 0.15; // baixo, com as saias laterais quase no chão
  const EIXOS = [-1.25, 1.37]; // eixo traseiro e dianteiro (a frente tem balanço maior)
  const SEGMENTOS_RODA = 20; // quantos "gomos" formam o círculo do pneu
  const RAIOS_DA_RODA = 10; // roda de 10 raios, no estilo das rodas de corrida dos anos 2000

  /** Cores fixas (R, G, B) de cada material. A pintura vem da cor escolhida. */
  const CORES = {
    vidro: [14, 17, 24],
    pneu: [24, 24, 26],
    roda: [170, 174, 182],
    furo: [10, 10, 12],
    caixa: [8, 8, 9],
    chassi: [18, 18, 20],
    grade: [12, 12, 14],
    farol: [120, 124, 132],
    lanterna: [96, 10, 16],
  };

  /**
   * Acabamento de cada material:
   *  especular = força do reflexo da luz; expoente = tamanho do reflexo
   *  (maior = reflexo pequeno e nítido, como verniz); borda = brilho no contorno.
   */
  const ACABAMENTO = {
    pintura: { especular: 0.9, expoente: 34, borda: 0.4 },
    vidro: { especular: 1, expoente: 90, borda: 0.3 },
    roda: { especular: 0.7, expoente: 16, borda: 0.2 },
    farol: { especular: 1, expoente: 50, borda: 0 },
    lanterna: { especular: 0.6, expoente: 40, borda: 0 },
    padrao: { especular: 0.06, expoente: 8, borda: 0.06 },
  };

  /** Luz mínima: sem ela, as faces de costas para a luz ficariam pretas. */
  const LUZ_AMBIENTE = 0.2;

  /** Direção DE ONDE vem a luz, vista pela câmera: de cima, da esquerda e da frente. */
  const LUZ = normalizar([-0.45, 0.8, -0.4]);

  /* =====================================================================
   * 2. MATEMÁTICA DE VETORES (vetor = [x, y, z])
   * ===================================================================== */

  function subtrair(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function somar(a, b) {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  function escalar(a, k) {
    return [a[0] * k, a[1] * k, a[2] * k];
  }

  /** Produto escalar: diz o quanto dois vetores apontam para o mesmo lado (1 = igual, -1 = oposto). */
  function produtoEscalar(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  function normalizar(a) {
    const tamanho = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / tamanho, a[1] / tamanho, a[2] / tamanho];
  }

  /**
   * Normal de um polígono pelo método de Newell: funciona até com polígonos
   * que não são perfeitamente planos. A normal é a "seta" que sai da face.
   * Pontos em sentido anti-horário (vistos de fora) → normal para fora.
   * @param {number[][]} pontos
   * @returns {number[]} Vetor unitário.
   */
  function normalDoPoligono(pontos) {
    const n = [0, 0, 0];
    for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i];
      const b = pontos[(i + 1) % pontos.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return normalizar(n);
  }

  function centroDe(pontos) {
    const soma = pontos.reduce(somar, [0, 0, 0]);
    return escalar(soma, 1 / pontos.length);
  }

  /* =====================================================================
   * 3. MODELO DO CARRO
   * O corpo nasce de um PERFIL (a silhueta vista de lado) "esticado" na
   * largura, como massa passando por um molde. Cada ponto do perfil tem
   * a sua meia-largura (w): a cabine é mais estreita que a carroceria.
   * ===================================================================== */

  /**
   * Cria uma face e já calcula a normal.
   * @param {number[][]} pontos
   * @param {string} material Chave de CORES/ACABAMENTO ou 'pintura'.
   * @returns {{pontos: number[][], normal: number[], material: string}}
   */
  function criarFace(pontos, material) {
    return { pontos: pontos, normal: normalDoPoligono(pontos), material: material };
  }

  /**
   * Garante que a normal da face aponta para o lado desejado (inverte a ordem se não).
   * @param {Object} face
   * @param {number[]} direcao
   * @returns {Object} A face (talvez invertida).
   */
  function orientar(face, direcao) {
    if (produtoEscalar(face.normal, direcao) >= 0) return face;
    return criarFace(face.pontos.slice().reverse(), face.material);
  }

  /**
   * Silhueta lateral do Civic sedã em sentido anti-horário (de trás para a frente
   * pela parte de baixo, depois de volta por cima). `material` vale para a faixa
   * que vai DESTE ponto ao próximo; `nome` marca faixas onde colamos detalhes.
   * @returns {{x: number, y: number, w: number, material: string, nome?: string}[]}
   */
  function montarPerfil() {
    const perfil = [];
    function ponto(x, y, w, material, nome) {
      perfil.push({ x: x, y: y, w: w, material: material || 'pintura', nome: nome });
    }

    /** Arco do para-lama: meia-volta por cima da roda, de trás para a frente. */
    function arcoDaRoda(centroX) {
      const centroY = RAIO_PNEU;
      // ângulo em que o arco encontra o assoalho
      const angulo = Math.asin((ALTURA_ASSOALHO - centroY) / RAIO_ARCO);
      const inicio = Math.PI - angulo; // lado de trás
      const fim = angulo; // lado da frente
      const passos = 10;
      for (let i = 0; i <= passos; i++) {
        const a = inicio + ((fim - inicio) * i) / passos;
        const ultimo = i === passos;
        ponto(centroX + RAIO_ARCO * Math.cos(a), centroY + RAIO_ARCO * Math.sin(a), 0.86, ultimo ? 'chassi' : 'caixa');
      }
    }

    // Parte de baixo, de trás para a frente (o para-choque traseiro do kit desce mais)
    ponto(-2.1, 0.22, 0.84, 'chassi');
    ponto(-1.66, ALTURA_ASSOALHO, 0.86, 'chassi');
    arcoDaRoda(EIXOS[0]);
    arcoDaRoda(EIXOS[1]);
    // Frente: lábio do para-choque (kit) quase no chão, entrada de ar grande, faróis
    ponto(2.22, 0.12, 0.85); // lábio
    ponto(2.31, 0.19, 0.86, 'pintura', 'grade'); // para-choque com a entrada de ar
    ponto(2.3, 0.44, 0.86, 'pintura', 'farol'); // faixa dos faróis
    ponto(2.17, 0.66, 0.85, 'pintura', 'capo'); // capô curto e inclinado
    ponto(1.1, 0.86, 0.84);
    ponto(0.88, 0.9, 0.8, 'vidro'); // para-brisa bem deitado
    // Teto: arco longo de sedã
    ponto(0.02, 1.36, 0.66);
    ponto(-0.55, 1.4, 0.65);
    ponto(-0.95, 1.33, 0.67, 'vidro'); // vidro traseiro
    // Porta-malas (o "três volumes" do sedã) e traseira
    ponto(-1.52, 1.02, 0.8);
    ponto(-1.8, 1.01, 0.82); // fim da tampa (o aerofólio fica aqui em cima)
    ponto(-2.08, 0.98, 0.83, 'pintura', 'lanterna');
    ponto(-2.2, 0.72, 0.84, 'pintura', 'escape');
    ponto(-2.18, 0.4, 0.84);
    return perfil;
  }

  /**
   * Meia-largura da lateral da cabine numa altura y (a cabine "fecha" para cima).
   * @param {number} y
   * @returns {number}
   */
  function larguraDaCabine(y) {
    return 0.8 - ((y - 0.92) / 0.48) * 0.15;
  }

  /**
   * Caixa (6 faces) alinhada aos eixos: usada no aerofólio, nos suportes e nos retrovisores.
   * @returns {Object[]} As 6 faces, todas com a normal para fora.
   */
  function criarCaixa(x0, x1, y0, y1, z0, z1, material) {
    const p = function (x, y, z) {
      return [x, y, z];
    };
    return [
      orientar(criarFace([p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], material), [0, 1, 0]),
      orientar(criarFace([p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)], material), [0, -1, 0]),
      orientar(criarFace([p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), p(x1, y0, z1)], material), [1, 0, 0]),
      orientar(criarFace([p(x0, y0, z0), p(x0, y1, z0), p(x0, y1, z1), p(x0, y0, z1)], material), [-1, 0, 0]),
      orientar(criarFace([p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], material), [0, 0, 1]),
      orientar(criarFace([p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)], material), [0, 0, -1]),
    ];
  }

  /**
   * Monta uma roda: pneu (banda + flancos) e o aro de 10 raios.
   * @param {number} centroX Posição do eixo.
   * @param {number} lado 1 = lado +z, -1 = lado -z.
   * @returns {{centro: number[], faces: Object[], decalques: Object[]}}
   */
  function montarRoda(centroX, lado) {
    const centroY = RAIO_PNEU;
    const zFora = lado * 0.84; // rente ao para-lama: roda "no limite", como em carro rebaixado
    const zDentro = lado * 0.6;
    const paraFora = [0, 0, lado];

    /** Pontos de um círculo no plano da roda. */
    function circulo(raio, z, de, ate, passos) {
      const pontos = [];
      for (let i = 0; i < passos; i++) {
        const a = de + ((ate - de) * i) / (passos - (ate - de >= Math.PI * 2 ? 0 : 1));
        pontos.push([centroX + raio * Math.cos(a), centroY + raio * Math.sin(a), z]);
      }
      return pontos;
    }

    const faces = [];
    const volta = Math.PI * 2;
    const externo = circulo(RAIO_PNEU, zFora, 0, volta, SEGMENTOS_RODA);
    const interno = circulo(RAIO_PNEU, zDentro, 0, volta, SEGMENTOS_RODA);

    // Banda de rodagem: um retângulo entre cada par de pontos vizinhos
    for (let i = 0; i < SEGMENTOS_RODA; i++) {
      const j = (i + 1) % SEGMENTOS_RODA;
      const meio = ((i + 0.5) / SEGMENTOS_RODA) * volta;
      const radial = [Math.cos(meio), Math.sin(meio), 0];
      faces.push(orientar(criarFace([externo[i], externo[j], interno[j], interno[i]], 'pneu'), radial));
    }
    faces.push(orientar(criarFace(externo, 'pneu'), paraFora));
    faces.push(orientar(criarFace(interno, 'pneu'), escalar(paraFora, -1)));

    // Aro: disco prata e 10 "janelas" escuras entre os raios, coladas no flanco externo
    const decalques = [];
    const zAro = zFora + lado * 0.006;
    decalques.push(orientar(criarFace(circulo(0.235, zAro, 0, volta, SEGMENTOS_RODA), 'roda'), paraFora));
    const passo = volta / RAIOS_DA_RODA;
    for (let k = 0; k < RAIOS_DA_RODA; k++) {
      const de = k * passo + 0.12; // o espaço que sobra entre as janelas vira o raio
      const ate = de + passo - 0.24;
      const externoFuro = circulo(0.205, zAro + lado * 0.004, de, ate, 3);
      const internoFuro = circulo(0.075, zAro + lado * 0.004, de, ate, 2).reverse();
      decalques.push(orientar(criarFace(externoFuro.concat(internoFuro), 'furo'), paraFora));
    }
    decalques.push(orientar(criarFace(circulo(0.055, zAro + lado * 0.008, 0, volta, 8), 'roda'), paraFora));

    return { centro: [centroX, centroY, lado * 0.72], faces: faces, decalques: decalques };
  }

  /**
   * Monta o modelo completo: carroceria, kit aerodinâmico, detalhes e 4 rodas.
   * @returns {{corpo: Object[], decalques: Object[], rodas: Object[]}}
   */
  function construirModelo() {
    const perfil = montarPerfil();
    const corpo = [];
    const decalques = [];
    const faixas = []; // faixa i liga o ponto i ao i+1 (guardada para colar faróis etc.)

    // 3.1 Faixas: cada aresta do perfil vira um retângulo na largura do carro
    perfil.forEach(function (a, i) {
      const b = perfil[(i + 1) % perfil.length];
      const pontos = [
        [a.x, a.y, a.w],
        [b.x, b.y, b.w],
        [b.x, b.y, -b.w],
        [a.x, a.y, -a.w],
      ];
      // No contorno anti-horário, "para fora" fica à direita da aresta
      const paraFora = [b.y - a.y, -(b.x - a.x), 0];
      const face = orientar(criarFace(pontos, a.material), paraFora);
      faixas.push({ a: a, b: b, face: face });
      corpo.push(face);
    });

    // 3.2 Laterais: o próprio perfil, de um lado e do outro
    corpo.push(orientar(criarFace(perfil.map(function (p) {
      return [p.x, p.y, p.w];
    }), 'pintura'), [0, 0, 1]));
    corpo.push(orientar(criarFace(perfil.map(function (p) {
      return [p.x, p.y, -p.w];
    }), 'pintura'), [0, 0, -1]));

    // 3.3 Kit aerodinâmico: aerofólio na tampa do porta-malas (dois suportes + a lâmina)
    //     e retrovisores. Entram no "corpo" para serem ordenados junto com ele.
    [1, -1].forEach(function (lado) {
      const z0 = lado * 0.5;
      const z1 = lado * 0.55;
      corpo.push.apply(corpo, criarCaixa(-1.95, -1.88, 1.0, 1.13, Math.min(z0, z1), Math.max(z0, z1), 'pintura'));
      const r0 = lado * 0.8; // retrovisor: encostado na base do vidro dianteiro
      const r1 = lado * 0.92;
      corpo.push.apply(corpo, criarCaixa(0.6, 0.72, 0.9, 0.98, Math.min(r0, r1), Math.max(r0, r1), 'pintura'));
    });
    corpo.push.apply(corpo, criarCaixa(-2.1, -1.8, 1.13, 1.16, -0.74, 0.74, 'pintura'));

    /** Cola um retângulo numa faixa (t = 0..1 ao longo da faixa, z = largura). */
    function colarNaFaixa(nome, t0, t1, z0, z1, material) {
      const faixa = faixas.find(function (f) {
        return f.a.nome === nome;
      });
      const afastar = escalar(faixa.face.normal, 0.012); // um pouco para fora, para ficar por cima
      function ponto(t, z) {
        return somar([faixa.a.x + (faixa.b.x - faixa.a.x) * t, faixa.a.y + (faixa.b.y - faixa.a.y) * t, z], afastar);
      }
      decalques.push(
        orientar(criarFace([ponto(t0, z0), ponto(t1, z0), ponto(t1, z1), ponto(t0, z1)], material), faixa.face.normal)
      );
    }

    // 3.4 Frente e traseira
    [1, -1].forEach(function (lado) {
      // Faróis grandes que "sobem" para o capô (marca da 7ª geração)
      colarNaFaixa('farol', 0.3, 0.97, lado * 0.36, lado * 0.84, 'farol');
      colarNaFaixa('capo', 0.0, 0.16, lado * 0.52, lado * 0.82, 'farol');
      // Lanternas nos cantos da traseira
      colarNaFaixa('lanterna', 0.1, 0.92, lado * 0.42, lado * 0.82, 'lanterna');
    });
    colarNaFaixa('farol', 0.45, 0.92, -0.28, 0.28, 'grade'); // grade pequena entre os faróis
    colarNaFaixa('grade', 0.12, 0.78, -0.62, 0.62, 'grade'); // entrada de ar grande do para-choque do kit
    colarNaFaixa('escape', 0.62, 0.86, -0.66, -0.5, 'furo'); // ponteira do escapamento

    // 3.5 Laterais: vidros das 4 portas, frisos das portas e saias laterais do kit
    const vidroDianteiro = [
      [0.74, 0.96],
      [0.06, 1.31],
      [-0.36, 1.35],
      [-0.36, 0.96],
    ];
    const vidroTraseiro = [
      [-0.46, 0.96],
      [-0.46, 1.35],
      [-0.86, 1.31],
      [-1.22, 1.05],
      [-1.22, 0.96],
    ];
    [1, -1].forEach(function (lado) {
      [vidroDianteiro, vidroTraseiro].forEach(function (janela) {
        decalques.push(
          orientar(criarFace(janela.map(function (p) {
            return [p[0], p[1], lado * (larguraDaCabine(p[1]) + 0.012)];
          }), 'vidro'), [0, 0, lado])
        );
      });
      // Frisos das portas: linhas finas escuras (frente da porta dianteira, entre as portas, fim da traseira)
      [0.8, -0.41, -1.27].forEach(function (x) {
        decalques.push(
          orientar(criarFace([
            [x - 0.007, 0.3, lado * 0.872],
            [x + 0.007, 0.3, lado * 0.872],
            [x + 0.007, 0.93, lado * 0.872],
            [x - 0.007, 0.93, lado * 0.872],
          ], 'furo'), [0, 0, lado])
        );
      });
      // Saia lateral: face inclinada para baixo e para fora (fica mais escura na luz e "salta")
      decalques.push(
        orientar(criarFace([
          [-0.84, 0.15, lado * 0.9],
          [0.95, 0.15, lado * 0.9],
          [0.95, 0.28, lado * 0.872],
          [-0.84, 0.28, lado * 0.872],
        ], 'pintura'), [0, -0.5, lado])
      );
    });

    // 3.6 Rodas
    const rodas = [];
    EIXOS.forEach(function (x) {
      rodas.push(montarRoda(x, 1), montarRoda(x, -1));
    });

    return { corpo: corpo, decalques: decalques, rodas: rodas };
  }

  /** O modelo é o mesmo para todos os carros da página: é construído uma vez só. */
  let modeloPronto = null;
  function obterModelo() {
    if (!modeloPronto) modeloPronto = construirModelo();
    return modeloPronto;
  }

  /* =====================================================================
   * 4. CORES
   * ===================================================================== */

  /**
   * "#ffc21a" → [255, 194, 26]
   * @param {string} hex
   * @returns {number[]}
   */
  function hexParaRgb(hex) {
    const limpo = String(hex).replace('#', '');
    const n = parseInt(limpo.length === 3 ? limpo.replace(/./g, '$&$&') : limpo, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function paraRgb(c) {
    return (
      'rgb(' +
      Math.min(255, Math.round(c[0])) +
      ',' +
      Math.min(255, Math.round(c[1])) +
      ',' +
      Math.min(255, Math.round(c[2])) +
      ')'
    );
  }

  /* =====================================================================
   * 5. RENDERIZADOR (um por <canvas>)
   * ===================================================================== */

  /**
   * Liga um carro 3D a um <canvas>.
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [opcoes]
   * @param {string} [opcoes.cor='#ffc21a'] Cor da pintura.
   * @returns {{estado: Object, desenhar: Function, definirCor: Function, destruir: Function}}
   */
  function criar(canvas, opcoes) {
    opcoes = opcoes || {};
    const ctx = canvas.getContext('2d');
    const modelo = obterModelo();

    /**
     * Tudo o que muda a imagem. O app.js altera estes valores e chama desenhar().
     *  giro      ângulo em volta do carro (radianos; 0 = de lado, frente à direita)
     *  inclinacao altura da câmera (radianos; maior = vê mais o teto)
     *  distancia afastamento da câmera
     *  farois    0 = apagados, 1 = acesos
     */
    const estado = {
      giro: 0.55,
      inclinacao: 0.26,
      distancia: 6.4,
      alturaAlvo: 0.66, // altura do ponto para onde a câmera olha (meio do carro)
      centroVertical: 0.56, // onde fica o centro do carro na altura do canvas (0 = topo, 1 = base)
      farois: 0,
      cor: hexParaRgb(opcoes.cor || '#ffc21a'),
    };

    let largura = 0;
    let altura = 0;

    /** Ajusta a resolução interna do canvas ao tamanho na tela (sem borrar). */
    function ajustarTamanho() {
      const caixa = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      largura = caixa.width;
      altura = caixa.height;
      canvas.width = Math.max(1, Math.round(largura * dpr));
      canvas.height = Math.max(1, Math.round(altura * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // desenhamos em "pixels de CSS"
    }

    /**
     * Prepara a câmera do quadro atual: seno e cosseno calculados UMA vez.
     * @returns {{ver: Function, girar: Function, projetar: Function, foco: number}}
     */
    function prepararCamera() {
      const cg = Math.cos(estado.giro);
      const sg = Math.sin(estado.giro);
      const ci = Math.cos(estado.inclinacao);
      const si = Math.sin(estado.inclinacao);
      // Foco = "zoom". Depende do tamanho do canvas para o carro caber em qualquer tela.
      const foco = Math.min(largura * 0.95, altura * 2.1);
      const centroX = largura / 2;
      const centroY = altura * estado.centroVertical;

      /** Gira um vetor: primeiro em volta do eixo y (giro), depois do x (inclinação). */
      function girar(v) {
        const x1 = v[0] * cg + v[2] * sg;
        const z1 = -v[0] * sg + v[2] * cg;
        return [x1, v[1] * ci + z1 * si, -v[1] * si + z1 * ci];
      }

      return {
        foco: foco,
        girar: girar,
        /** Modelo → câmera: centraliza no carro, gira e afasta. */
        ver: function (p) {
          const v = girar([p[0], p[1] - estado.alturaAlvo, p[2]]);
          v[2] += estado.distancia;
          return v;
        },
        /** Câmera → tela: a divisão por z é a perspectiva. */
        projetar: function (v) {
          return [centroX + (v[0] * foco) / v[2], centroY - (v[1] * foco) / v[2]];
        },
      };
    }

    /**
     * Cor final de uma face: base × (ambiente + difusa) + reflexo + brilho de contorno.
     * @param {string} material
     * @param {number[]} normal Normal já girada (espaço da câmera).
     * @param {number[]} centro Centro da face no espaço da câmera.
     * @returns {string}
     */
    function corDaFace(material, normal, centro) {
      let base = material === 'pintura' ? estado.cor : CORES[material];
      // Faróis e lanterna "acendem": a cor vai do apagado ao aceso
      if (material === 'farol') base = misturar(base, [255, 248, 230], estado.farois);
      if (material === 'lanterna') base = misturar(base, [255, 40, 50], estado.farois);

      const acabamento = ACABAMENTO[material] || ACABAMENTO.padrao;
      const olho = normalizar(escalar(centro, -1)); // direção da face até a câmera
      const difusa = Math.max(0, produtoEscalar(normal, LUZ));
      const meio = normalizar(somar(LUZ, olho));
      const especular = Math.pow(Math.max(0, produtoEscalar(normal, meio)), acabamento.expoente) * acabamento.especular;
      const borda = Math.pow(1 - Math.abs(produtoEscalar(normal, olho)), 3) * acabamento.borda;

      const emissiva = material === 'farol' || material === 'lanterna' ? estado.farois * 0.9 : 0;
      const k = Math.min(1, LUZ_AMBIENTE + difusa * 0.8 + emissiva);
      return paraRgb([
        base[0] * k + 255 * especular + 210 * borda,
        base[1] * k + 255 * especular + 210 * borda,
        base[2] * k + 255 * especular + 220 * borda,
      ]);
    }

    /**
     * Desenha uma lista de faces: descarta as de costas e, se pedido,
     * ordena da mais longe para a mais perto (algoritmo do pintor).
     * @returns {Object[]} As faces visíveis (com dados de tela).
     */
    function desenharFaces(faces, camera, ordenar) {
      const visiveis = [];
      faces.forEach(function (face) {
        const pontos = face.pontos.map(camera.ver);
        const centro = centroDe(pontos);
        const normal = camera.girar(face.normal);
        // Normal apontando para longe da câmera = face de costas: não desenha
        if (produtoEscalar(normal, centro) >= 0) return;
        visiveis.push({ face: face, pontos: pontos, centro: centro, normal: normal });
      });
      if (ordenar) {
        visiveis.sort(function (a, b) {
          return b.centro[2] - a.centro[2]; // maior z = mais longe = primeiro
        });
      }
      visiveis.forEach(function (v) {
        const cor = corDaFace(v.face.material, v.normal, v.centro);
        ctx.beginPath();
        v.pontos.forEach(function (p, i) {
          const tela = camera.projetar(p);
          if (i === 0) ctx.moveTo(tela[0], tela[1]);
          else ctx.lineTo(tela[0], tela[1]);
        });
        ctx.closePath();
        ctx.fillStyle = cor;
        ctx.fill();
        // Contorno da mesma cor: fecha as "frestas" de 1px entre faces vizinhas
        ctx.strokeStyle = cor;
        ctx.stroke();
      });
      return visiveis;
    }

    /** Elipse no chão (y = 0), projetada com perspectiva. */
    function caminhoNoChao(camera, centroX, raioX, raioZ) {
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const tela = camera.projetar(camera.ver([centroX + raioX * Math.cos(a), 0, raioZ * Math.sin(a)]));
        if (i === 0) ctx.moveTo(tela[0], tela[1]);
        else ctx.lineTo(tela[0], tela[1]);
      }
    }

    /** Sombra suave embaixo do carro e, com faróis acesos, a luz no chão à frente. */
    function desenharChao(camera) {
      const desfoque = Math.max(2, camera.foco * 0.012);
      ctx.save();
      ctx.filter = 'blur(' + desfoque + 'px)'; // navegador sem suporte: sombra sem desfoque
      caminhoNoChao(camera, 0, 2.5, 1.15);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fill();
      if (estado.farois > 0) {
        ctx.filter = 'blur(' + desfoque * 4 + 'px)';
        ctx.globalCompositeOperation = 'lighter'; // soma luz em vez de cobrir
        caminhoNoChao(camera, 3.9, 1.7, 1.3);
        ctx.fillStyle = 'rgba(255, 236, 190, ' + 0.16 * estado.farois + ')';
        ctx.fill();
      }
      ctx.restore();
    }

    /** Halo em volta dos faróis e da lanterna acesos. */
    function desenharHalos(visiveis, camera) {
      if (estado.farois <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      visiveis.forEach(function (v) {
        const material = v.face.material;
        if (material !== 'farol' && material !== 'lanterna') return;
        const tela = camera.projetar(v.centro);
        const raio = (camera.foco * (material === 'farol' ? 0.55 : 0.35)) / v.centro[2];
        const halo = ctx.createRadialGradient(tela[0], tela[1], 0, tela[0], tela[1], raio);
        const cor = material === 'farol' ? '255, 244, 220' : '255, 40, 50';
        halo.addColorStop(0, 'rgba(' + cor + ', ' + 0.5 * estado.farois + ')');
        halo.addColorStop(1, 'rgba(' + cor + ', 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(tela[0] - raio, tela[1] - raio, raio * 2, raio * 2);
      });
      ctx.restore();
    }

    /**
     * Desenha um quadro. Ordem: chão → rodas (de longe para perto) → carroceria → detalhes → halos.
     * As rodas vêm antes da carroceria: a lateral cobre a parte do pneu que fica
     * dentro do para-lama, e o arco recortado deixa ver o resto.
     */
    function desenhar() {
      if (!largura || !altura) return;
      ctx.clearRect(0, 0, largura, altura);
      const camera = prepararCamera();
      desenharChao(camera);

      modelo.rodas
        .map(function (roda) {
          return { roda: roda, z: camera.ver(roda.centro)[2] };
        })
        .sort(function (a, b) {
          return b.z - a.z;
        })
        .forEach(function (item) {
          desenharFaces(item.roda.faces, camera, true);
          desenharFaces(item.roda.decalques, camera, false);
        });

      desenharFaces(modelo.corpo, camera, true);
      const detalhes = desenharFaces(modelo.decalques, camera, false);
      desenharHalos(detalhes, camera);
    }

    /**
     * Troca a cor da pintura.
     * @param {string} hex Ex.: '#c0161d'.
     */
    function definirCor(hex) {
      estado.cor = hexParaRgb(hex);
      desenhar();
    }

    // Redesenha quando o canvas muda de tamanho (girar o celular, redimensionar a janela)
    const observador = new ResizeObserver(function () {
      ajustarTamanho();
      desenhar();
    });
    observador.observe(canvas);
    ajustarTamanho();

    /** Desliga o observador e solta o canvas (chamar quando o carro não for mais usado). */
    function destruir() {
      observador.disconnect();
      ctx.clearRect(0, 0, largura, altura);
    }

    return { estado: estado, desenhar: desenhar, definirCor: definirCor, destruir: destruir };
  }

  /* =====================================================================
   * 6. UTILITÁRIO DE ANIMAÇÃO (usado pelo app.js)
   * ===================================================================== */

  /** Mistura duas cores: t = 0 → a, t = 1 → b. */
  function misturar(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  /**
   * Curva "expo out": começa rápida e assenta devagar (0 → 1).
   * @param {number} t Progresso de 0 a 1.
   * @returns {number}
   */
  function suavizar(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  return {
    criar: criar,
    suavizar: suavizar,
  };
})();
