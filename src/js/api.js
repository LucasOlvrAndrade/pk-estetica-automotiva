/**
 * api.js: Api
 *
 * Conversa com serviços externos:
 *  - Tabela FIPE (parallelum.com.br): marcas, modelos e anos de carros.
 *  - ViaCEP (viacep.com.br): endereço a partir do CEP.
 *
 * Toda chamada tem tempo limite de 6 s (AbortController) e as respostas da
 * FIPE ficam no sessionStorage: abrir o formulário de novo não repete a busca.
 * Os erros saem com "codigo" para a tela decidir o que mostrar:
 *  'TEMPO' (demorou), 'REDE' (sem internet), 'HTTP' (servidor respondeu erro),
 *  'NAO_ENCONTRADO' (CEP inexistente), 'INVALIDO' (CEP mal digitado).
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam.
 */
export const Api = (function () {
  'use strict';

  const TEMPO_LIMITE_MS = 6000;
  const BASE_FIPE = 'https://parallelum.com.br/fipe/api/v1/carros';
  const PREFIXO_CACHE = 'pk:fipe:';

  /**
   * Cria um Error com código, para quem chamou saber o tipo de falha.
   * @param {string} mensagem
   * @param {string} codigo
   * @returns {Error}
   */
  function erroCom(mensagem, codigo) {
    const erro = new Error(mensagem);
    erro.codigo = codigo;
    return erro;
  }

  /**
   * fetch + JSON com tempo limite. Se passar de 6 s, o AbortController cancela a requisição.
   * @param {string} url
   * @returns {Promise<any>}
   */
  async function buscarJson(url) {
    const controle = new AbortController();
    const temporizador = setTimeout(function () {
      controle.abort();
    }, TEMPO_LIMITE_MS);
    try {
      const resposta = await fetch(url, { signal: controle.signal });
      if (!resposta.ok) {
        throw erroCom('O serviço respondeu com erro (' + resposta.status + ').', 'HTTP');
      }
      return await resposta.json();
    } catch (erro) {
      if (erro.codigo) throw erro;
      if (erro.name === 'AbortError') throw erroCom('O serviço demorou demais para responder.', 'TEMPO');
      throw erroCom('Sem conexão com o serviço.', 'REDE');
    } finally {
      clearTimeout(temporizador); // limpa o relógio dando certo ou errado
    }
  }

  /**
   * Igual ao buscarJson, mas guarda a resposta no sessionStorage (dura até fechar a aba).
   * @param {string} url
   * @returns {Promise<any>}
   */
  async function buscarComCache(url) {
    const chave = PREFIXO_CACHE + url;
    try {
      const guardado = sessionStorage.getItem(chave);
      if (guardado) return JSON.parse(guardado);
    } catch (erro) {
      // sessionStorage indisponível ou corrompido: busca de novo
    }
    const dados = await buscarJson(url);
    try {
      sessionStorage.setItem(chave, JSON.stringify(dados));
    } catch (erro) {
      // cache cheio: tudo bem, só não guarda
    }
    return dados;
  }

  /**
   * @typedef {{codigo: string, nome: string}} ItemFipe
   */

  /**
   * Marcas de carros da tabela FIPE.
   * @returns {Promise<ItemFipe[]>}
   */
  function listarMarcas() {
    return buscarComCache(BASE_FIPE + '/marcas');
  }

  /**
   * Modelos de uma marca.
   * @param {string} codMarca
   * @returns {Promise<ItemFipe[]>}
   */
  async function listarModelos(codMarca) {
    const dados = await buscarComCache(BASE_FIPE + '/marcas/' + encodeURIComponent(codMarca) + '/modelos');
    return dados.modelos || []; // a API devolve { modelos: [...], anos: [...] }
  }

  /**
   * Anos de um modelo. O código vem como "2015-1" (ano-combustível).
   * @param {string} codMarca
   * @param {string} codModelo
   * @returns {Promise<ItemFipe[]>}
   */
  function listarAnos(codMarca, codModelo) {
    return buscarComCache(
      BASE_FIPE + '/marcas/' + encodeURIComponent(codMarca) + '/modelos/' + encodeURIComponent(codModelo) + '/anos'
    );
  }

  /**
   * Endereço de um CEP pelo ViaCEP.
   * @param {string} cep Com ou sem hífen.
   * @returns {Promise<{logradouro: string, bairro: string, cidade: string, uf: string}>}
   * @throws {Error} codigo 'INVALIDO', 'NAO_ENCONTRADO', 'TEMPO', 'REDE' ou 'HTTP'.
   */
  async function viacep(cep) {
    const numeros = String(cep).replace(/\D/g, '');
    if (numeros.length !== 8) throw erroCom('O CEP precisa ter 8 números.', 'INVALIDO');
    const dados = await buscarJson('https://viacep.com.br/ws/' + numeros + '/json/');
    // CEP com formato certo, mas que não existe: o ViaCEP responde { erro: true }
    if (dados.erro) throw erroCom('CEP não encontrado. Confira os números ou preencha o endereço.', 'NAO_ENCONTRADO');
    return { logradouro: dados.logradouro, bairro: dados.bairro, cidade: dados.localidade, uf: dados.uf };
  }

  return {
    fipe: { listarMarcas: listarMarcas, listarModelos: listarModelos, listarAnos: listarAnos },
    viacep: viacep,
  };
})();
