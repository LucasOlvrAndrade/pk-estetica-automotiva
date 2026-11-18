/**
 * storage.js: AppStorage
 *
 * ÚNICO ponto de acesso ao LocalStorage do app.
 * Nenhum outro arquivo deve chamar localStorage diretamente: todos usam AppStorage.
 * Assim, se a forma de salvar mudar, só este arquivo precisa ser alterado.
 *
 * Por que "AppStorage" e não "Storage"? Porque "Storage" já existe no navegador
 * (é o tipo do próprio localStorage) e sobrescrevê-lo quebraria o site.
 *
 * MÓDULO ES: o "export" abaixo é o que os outros arquivos enxergam
 * (eles fazem "import { … } from"). A IIFE continua igual: tudo que está
 * dentro dela é privado, e só o objeto devolvido no "return" é público.
 */
export const AppStorage = (function () {
  'use strict';

  /* =====================================================================
   * 1. CONSTANTES
   * ===================================================================== */

  /**
   * Prefixo de todas as chaves. Em file:// todas as páginas locais
   * dividem o mesmo LocalStorage; o prefixo evita misturar com outros projetos.
   */
  const PREFIXO = 'estetica:';

  /** Nomes das chaves usadas pelo app (sem o prefixo). */
  const CHAVES = Object.freeze({
    VEICULOS: 'veiculos',
    AGENDAMENTOS: 'agendamentos',
    CHECKINS: 'checkins',
    FIDELIDADE: 'fidelidade',
    SALVOS: 'salvos',
    AVALIACOES: 'avaliacoes',
    TEMA: 'tema',
    DIAGNOSTICO: 'diagnostico',
    PREFERENCIAS: 'preferencias', // o que os formulários lembram (último veículo, endereço)
  });

  /** Status possíveis de um agendamento. */
  const STATUS = Object.freeze({
    AGENDADO: 'agendado',
    RECEBIDO: 'recebido',
    EM_EXECUCAO: 'em-execucao',
    PRONTO: 'pronto',
    ENTREGUE: 'entregue',
    CANCELADO: 'cancelado',
  });

  /**
   * Para cada status, quais são os próximos permitidos.
   * Impede saltos sem sentido (ex.: de "agendado" direto para "entregue").
   * "em-execucao" pode ir para ele mesmo: é assim que a etapa atual é trocada.
   */
  const TRANSICOES = Object.freeze({
    agendado: ['recebido', 'cancelado'],
    recebido: ['em-execucao', 'cancelado'],
    'em-execucao': ['em-execucao', 'pronto'],
    pronto: ['entregue'],
    entregue: [],
    cancelado: [],
  });

  /** Quantidade de carimbos para ganhar o polimento. */
  const CARIMBOS_PARA_PREMIO = 5;

  /** Código do erro de espaço cheio, para o app conseguir identificá-lo. */
  const CODIGO_QUOTA = 'QUOTA_EXCEDIDA';

  /** Versão do formato do arquivo de backup (exportar/importar). */
  const VERSAO_BACKUP = 1;

  /* =====================================================================
   * 2. ESCOLHA DO "ARMAZÉM": LocalStorage ou memória
   * ===================================================================== */

  /**
   * Testa se o LocalStorage funciona de verdade.
   * Pode falhar em navegação anônima, com cookies bloqueados ou em alguns
   * navegadores abrindo via file://.
   * @returns {boolean} true se der para gravar e apagar.
   */
  function localStorageDisponivel() {
    try {
      const teste = PREFIXO + '__teste__';
      window.localStorage.setItem(teste, '1');
      window.localStorage.removeItem(teste);
      return true;
    } catch (erro) {
      return false;
    }
  }

  /**
   * Cria um armazém que guarda tudo num objeto na memória.
   * Funciona igual ao LocalStorage, mas os dados somem ao recarregar a página.
   * @returns {{getItem: Function, setItem: Function, removeItem: Function, chaves: Function}}
   */
  function criarArmazemMemoria() {
    const dados = {};
    return {
      getItem: function (chave) {
        return Object.prototype.hasOwnProperty.call(dados, chave) ? dados[chave] : null;
      },
      setItem: function (chave, valor) {
        dados[chave] = String(valor);
      },
      removeItem: function (chave) {
        delete dados[chave];
      },
      chaves: function () {
        return Object.keys(dados);
      },
    };
  }

  /**
   * Embrulha o LocalStorage real com a mesma "cara" do armazém em memória,
   * para o resto do código não precisar saber qual dos dois está em uso.
   * @returns {{getItem: Function, setItem: Function, removeItem: Function, chaves: Function}}
   */
  function criarArmazemLocal() {
    const ls = window.localStorage;
    return {
      getItem: function (chave) {
        return ls.getItem(chave);
      },
      setItem: function (chave, valor) {
        ls.setItem(chave, valor);
      },
      removeItem: function (chave) {
        ls.removeItem(chave);
      },
      chaves: function () {
        const lista = [];
        for (let i = 0; i < ls.length; i++) {
          lista.push(ls.key(i));
        }
        return lista;
      },
    };
  }

  const usandoMemoria = !localStorageDisponivel();
  const armazem = usandoMemoria ? criarArmazemMemoria() : criarArmazemLocal();

  if (usandoMemoria) {
    console.warn('[AppStorage] LocalStorage indisponível: usando memória. Os dados serão perdidos ao recarregar.');
  }

  /* =====================================================================
   * 3. FUNÇÕES PRIVADAS (só existem aqui dentro)
   * ===================================================================== */

  /**
   * Verifica se um erro do navegador significa "acabou o espaço".
   * Cada navegador usa um nome/código diferente para isso.
   * @param {*} erro Erro capturado no catch.
   * @returns {boolean}
   */
  function ehErroDeQuota(erro) {
    if (!erro) return false;
    return (
      erro.name === 'QuotaExceededError' ||
      erro.name === 'NS_ERROR_DOM_QUOTA_REACHED' || // Firefox antigo
      erro.code === 22 ||
      erro.code === 1014
    );
  }

  /**
   * Lê uma chave e converte de texto JSON para objeto.
   * Se a chave não existir ou o conteúdo estiver corrompido, devolve o padrão.
   * @template T
   * @param {string} chave Nome da chave, sem prefixo.
   * @param {T} padrao Valor devolvido quando não há dado válido.
   * @returns {T}
   */
  function ler(chave, padrao) {
    const texto = armazem.getItem(PREFIXO + chave);
    if (texto === null) return padrao;
    try {
      return JSON.parse(texto);
    } catch (erro) {
      // Dado corrompido (ex.: alguém editou à mão no DevTools): não deixa o app quebrar.
      console.warn('[AppStorage] Dado corrompido em "' + chave + '". Usando valor padrão.', erro);
      return padrao;
    }
  }

  /**
   * Converte o valor para JSON e grava.
   * @param {string} chave Nome da chave, sem prefixo.
   * @param {*} valor Qualquer valor que possa virar JSON.
   * @throws {Error} Com erro.codigo === 'QUOTA_EXCEDIDA' quando o espaço acabou.
   */
  function salvar(chave, valor) {
    try {
      armazem.setItem(PREFIXO + chave, JSON.stringify(valor));
    } catch (erro) {
      if (ehErroDeQuota(erro)) {
        // Erro "tratável": o app pode mostrar a mensagem num toast.
        const erroAmigavel = new Error(
          'O armazenamento do navegador está cheio. Tente usar menos fotos ou fotos menores, ' +
            'ou exporte seus dados e apague registros antigos.'
        );
        erroAmigavel.codigo = CODIGO_QUOTA;
        erroAmigavel.original = erro;
        throw erroAmigavel;
      }
      throw new Error('Não foi possível salvar os dados: ' + erro.message);
    }
  }

  /**
   * Gera um identificador único.
   * crypto.randomUUID() só existe em navegadores novos e em contexto seguro;
   * por isso há uma alternativa com data + número aleatório.
   * @returns {string}
   */
  function gerarId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /**
   * Data e hora atuais em formato ISO (ex.: "2026-11-10T13:45:00.000Z").
   * @returns {string}
   */
  function agora() {
    return new Date().toISOString();
  }

  /**
   * Garante que um texto obrigatório foi preenchido.
   * @param {*} valor Valor a verificar.
   * @param {string} nomeCampo Nome mostrado na mensagem de erro.
   * @throws {Error} Se estiver vazio.
   */
  function exigir(valor, nomeCampo) {
    if (valor === undefined || valor === null || String(valor).trim() === '') {
      throw new Error('O campo "' + nomeCampo + '" é obrigatório.');
    }
  }

  /* =====================================================================
   * 4. VEÍCULOS
   * ===================================================================== */

  /**
   * @typedef {Object} Veiculo
   * @property {string} id
   * @property {string} marca
   * @property {string} modelo
   * @property {number} ano
   * @property {string} placa Em maiúsculas, sem hífen.
   * @property {string} cor
   * @property {'hatch'|'seda'|'suv'|'picape'} porte
   */

  /**
   * Lista todos os veículos cadastrados.
   * @returns {Veiculo[]}
   */
  function listarVeiculos() {
    return ler(CHAVES.VEICULOS, []);
  }

  /**
   * Cria um veículo novo ou atualiza um existente (se vier com id já salvo).
   * @param {Partial<Veiculo>} dados Dados do formulário.
   * @returns {Veiculo} O veículo como ficou salvo.
   * @throws {Error} Se faltar campo obrigatório ou a placa já existir.
   */
  function salvarVeiculo(dados) {
    exigir(dados.marca, 'Marca');
    exigir(dados.modelo, 'Modelo');
    exigir(dados.placa, 'Placa');
    exigir(dados.porte, 'Porte');

    const veiculos = listarVeiculos();
    // Padroniza a placa para comparar "abc-1d23" e "ABC1D23" como iguais.
    const placa = String(dados.placa).toUpperCase().replace(/[^A-Z0-9]/g, '');

    const duplicado = veiculos.some(function (v) {
      return v.placa === placa && v.id !== dados.id;
    });
    if (duplicado) {
      throw new Error('Já existe um veículo cadastrado com a placa ' + placa + '.');
    }

    const veiculo = {
      id: dados.id || gerarId(),
      marca: String(dados.marca).trim(),
      modelo: String(dados.modelo).trim(),
      ano: Number(dados.ano) || null,
      placa: placa,
      cor: dados.cor ? String(dados.cor).trim() : '',
      porte: dados.porte,
    };

    const indice = veiculos.findIndex(function (v) {
      return v.id === veiculo.id;
    });
    if (indice >= 0) {
      veiculos[indice] = veiculo; // edição
    } else {
      veiculos.push(veiculo); // cadastro novo
    }

    salvar(CHAVES.VEICULOS, veiculos);
    return veiculo;
  }

  /**
   * Remove um veículo pelo id.
   * @param {string} id
   * @returns {boolean} true se encontrou e removeu.
   */
  function removerVeiculo(id) {
    const veiculos = listarVeiculos();
    const restantes = veiculos.filter(function (v) {
      return v.id !== id;
    });
    if (restantes.length === veiculos.length) return false;
    salvar(CHAVES.VEICULOS, restantes);
    return true;
  }

  /* =====================================================================
   * 5. AGENDAMENTOS
   * ===================================================================== */

  /**
   * @typedef {Object} Agendamento
   * @property {string} id
   * @property {string} veiculoId
   * @property {string} servicoId
   * @property {string} data Formato "AAAA-MM-DD".
   * @property {string} horario Formato "HH:MM".
   * @property {boolean} levaTraz
   * @property {Object|null} endereco
   * @property {string} observacoes
   * @property {number} valor Preço em reais.
   * @property {string} status Um dos valores de AppStorage.STATUS.
   * @property {string|null} etapaAtual Etapa em andamento quando status = "em-execucao".
   * @property {{status: string, etapa: (string|null), em: string}[]} historicoStatus
   * @property {string} criadoEm
   */

  /**
   * Lista todos os agendamentos.
   * @returns {Agendamento[]}
   */
  function listarAgendamentos() {
    return ler(CHAVES.AGENDAMENTOS, []);
  }

  /**
   * Cria um agendamento com status "agendado".
   * @param {Object} dados Dados do formulário de agendamento.
   * @returns {Agendamento}
   * @throws {Error} Se faltar veículo, serviço, data ou horário.
   */
  function criarAgendamento(dados) {
    exigir(dados.veiculoId, 'Veículo');
    exigir(dados.servicoId, 'Serviço');
    exigir(dados.data, 'Data');
    exigir(dados.horario, 'Horário');

    const momento = agora();
    const agendamento = {
      id: gerarId(),
      veiculoId: dados.veiculoId,
      servicoId: dados.servicoId,
      data: dados.data,
      horario: dados.horario,
      levaTraz: Boolean(dados.levaTraz),
      endereco: dados.levaTraz ? dados.endereco || null : null,
      observacoes: dados.observacoes || '',
      valor: Number(dados.valor) || 0,
      taxaLevaTraz: Number(dados.taxaLevaTraz) || 0,
      protocolo: dados.protocolo || null,
      previsaoEntrega: dados.previsaoEntrega || null, // data e hora ISO
      fidelidade: Boolean(dados.fidelidade), // resgate do cartão (valor R$ 0,00)
      fotosEtapas: {}, // { "Nome da etapa": dataURL }: 1 foto por etapa
      demo: Boolean(dados.demo), // dado de demonstração (pode ser apagado em lote)
      status: STATUS.AGENDADO,
      etapaAtual: null,
      // Guardar cada mudança permite montar a linha do tempo com horários.
      historicoStatus: [{ status: STATUS.AGENDADO, etapa: null, em: momento }],
      criadoEm: momento,
    };

    const lista = listarAgendamentos();
    lista.push(agendamento);
    salvar(CHAVES.AGENDAMENTOS, lista);
    return agendamento;
  }

  /**
   * Muda o status de um agendamento, respeitando a ordem permitida:
   * agendado → recebido → em-execucao → pronto → entregue (ou cancelado).
   * @param {string} id Id do agendamento.
   * @param {string} status Novo status (use AppStorage.STATUS).
   * @param {string} [etapaAtual] Só para "em-execucao": nome da etapa (ex.: "Polimento").
   * @returns {Agendamento} O agendamento atualizado.
   * @throws {Error} Se o agendamento não existir ou a mudança não for permitida.
   */
  function atualizarStatus(id, status, etapaAtual) {
    const lista = listarAgendamentos();
    const agendamento = lista.find(function (a) {
      return a.id === id;
    });
    if (!agendamento) {
      throw new Error('Agendamento não encontrado.');
    }

    const permitidos = TRANSICOES[agendamento.status] || [];
    if (permitidos.indexOf(status) === -1) {
      throw new Error('Não é possível mudar de "' + agendamento.status + '" para "' + status + '".');
    }

    agendamento.status = status;
    agendamento.etapaAtual = status === STATUS.EM_EXECUCAO ? etapaAtual || null : null;
    agendamento.historicoStatus.push({ status: status, etapa: agendamento.etapaAtual, em: agora() });

    salvar(CHAVES.AGENDAMENTOS, lista);
    return agendamento;
  }

  /**
   * Guarda a foto de uma etapa do serviço (uma por etapa: a nova substitui a antiga).
   * @param {string} id Id do agendamento.
   * @param {string} etapa Nome da etapa.
   * @param {string} dataUrl Imagem já comprimida.
   * @returns {Agendamento}
   * @throws {Error} Se o agendamento não existir ou a foto não couber no armazenamento.
   */
  function anexarFotoEtapa(id, etapa, dataUrl) {
    const lista = listarAgendamentos();
    const agendamento = lista.find(function (a) {
      return a.id === id;
    });
    if (!agendamento) throw new Error('Agendamento não encontrado.');
    agendamento.fotosEtapas = agendamento.fotosEtapas || {};
    agendamento.fotosEtapas[etapa] = dataUrl;
    salvar(CHAVES.AGENDAMENTOS, lista);
    return agendamento;
  }

  /**
   * Cancela um agendamento (só funciona antes de o serviço começar).
   * @param {string} id
   * @returns {Agendamento}
   * @throws {Error} Se o serviço já estiver em execução ou concluído.
   */
  function cancelarAgendamento(id) {
    return atualizarStatus(id, STATUS.CANCELADO);
  }

  /* =====================================================================
   * 6. CHECK-INS
   * Guardados num objeto { [agendamentoId]: checkin }, para achar rápido.
   * ===================================================================== */

  /**
   * @typedef {Object} Checkin
   * @property {string} agendamentoId
   * @property {string[]} fotos Imagens em base64 (data URL). Ocupam muito espaço!
   * @property {string[]} avarias
   * @property {string} observacoes
   * @property {string} registradoEm
   * @property {boolean} confirmado Se o cliente já confirmou o check-in.
   * @property {string|null} confirmadoEm
   */

  /**
   * Salva (ou atualiza) o check-in feito pela estética na entrada do veículo.
   * @param {string} agendamentoId
   * @param {Object} dados Fotos, avarias, quilometragem, observações etc.
   * @returns {Checkin}
   * @throws {Error} Com codigo "QUOTA_EXCEDIDA" se as fotos não couberem.
   */
  function salvarCheckin(agendamentoId, dados) {
    exigir(agendamentoId, 'Agendamento');
    const checkins = ler(CHAVES.CHECKINS, {});
    const anterior = checkins[agendamentoId] || {};

    // Object.assign junta: o que já existia + o que chegou agora.
    const checkin = Object.assign(
      { fotos: [], avarias: [], observacoes: '' },
      anterior,
      dados,
      {
        agendamentoId: agendamentoId,
        registradoEm: anterior.registradoEm || agora(),
        confirmado: false, // qualquer alteração exige nova confirmação do cliente
        confirmadoEm: null,
      }
    );

    checkins[agendamentoId] = checkin;
    salvar(CHAVES.CHECKINS, checkins);
    return checkin;
  }

  /**
   * Busca o check-in de um agendamento.
   * @param {string} agendamentoId
   * @returns {Checkin|null} null se ainda não houver check-in.
   */
  function obterCheckin(agendamentoId) {
    const checkins = ler(CHAVES.CHECKINS, {});
    return checkins[agendamentoId] || null;
  }

  /**
   * Marca o check-in como confirmado pelo cliente.
   * @param {string} agendamentoId
   * @returns {Checkin}
   * @throws {Error} Se o check-in não existir.
   */
  function confirmarCheckin(agendamentoId) {
    const checkins = ler(CHAVES.CHECKINS, {});
    const checkin = checkins[agendamentoId];
    if (!checkin) {
      throw new Error('Check-in não encontrado para este agendamento.');
    }
    checkin.confirmado = true;
    checkin.confirmadoEm = agora();
    salvar(CHAVES.CHECKINS, checkins);
    return checkin;
  }

  /* =====================================================================
   * 7. FIDELIDADE
   * ===================================================================== */

  /**
   * @typedef {Object} CartaoFidelidade
   * @property {number} carimbos De 0 a 5.
   * @property {number} resgates Quantos polimentos já foram resgatados.
   * @property {string[]} agendamentosCarimbados Evita carimbar o mesmo serviço duas vezes.
   */

  /**
   * Devolve o cartão fidelidade (cria um vazio se ainda não existir).
   * @returns {CartaoFidelidade}
   */
  function obterCartao() {
    const cartao = ler(CHAVES.FIDELIDADE, { carimbos: 0, resgates: 0, agendamentosCarimbados: [] });
    // Campos novos: cartões antigos ganham listas vazias (continuam funcionando)
    cartao.historico = cartao.historico || []; // [{ agendamentoId, servicoId, em }]
    cartao.historicoResgates = cartao.historicoResgates || []; // [{ em, agendamentoId }]
    return cartao;
  }

  /**
   * Adiciona um carimbo (máximo de 5). O app deve chamar quando o serviço for entregue.
   * @param {string} [agendamentoId] Se informado, o mesmo serviço não ganha dois carimbos.
   * @param {string} [servicoId] Serviço que gerou o carimbo (vai para o histórico).
   * @returns {CartaoFidelidade}
   */
  function adicionarCarimbo(agendamentoId, servicoId) {
    const cartao = obterCartao();
    if (agendamentoId && cartao.agendamentosCarimbados.indexOf(agendamentoId) !== -1) {
      return cartao; // já carimbado: não faz nada
    }
    if (cartao.carimbos < CARIMBOS_PARA_PREMIO) {
      cartao.carimbos += 1;
    }
    if (agendamentoId) {
      cartao.agendamentosCarimbados.push(agendamentoId);
    }
    cartao.historico.push({ agendamentoId: agendamentoId || null, servicoId: servicoId || null, em: agora() });
    salvar(CHAVES.FIDELIDADE, cartao);
    return cartao;
  }

  /**
   * Troca 5 carimbos por um polimento grátis e zera o cartão.
   * @param {string} [agendamentoId] Agendamento do polimento resgatado (vai para o histórico).
   * @returns {CartaoFidelidade}
   * @throws {Error} Se ainda não houver 5 carimbos.
   */
  function resgatarPolimento(agendamentoId) {
    const cartao = obterCartao();
    if (cartao.carimbos < CARIMBOS_PARA_PREMIO) {
      const faltam = CARIMBOS_PARA_PREMIO - cartao.carimbos;
      throw new Error('Faltam ' + faltam + ' carimbo(s) para resgatar o polimento.');
    }
    cartao.carimbos = 0;
    cartao.resgates += 1;
    cartao.historicoResgates.push({ em: agora(), agendamentoId: agendamentoId || null });
    salvar(CHAVES.FIDELIDADE, cartao);
    return cartao;
  }

  /* =====================================================================
   * 8. SERVIÇOS SALVOS (favoritos)
   * ===================================================================== */

  /**
   * Lista os ids dos serviços salvos.
   * @returns {string[]}
   */
  function listarSalvos() {
    return ler(CHAVES.SALVOS, []);
  }

  /**
   * Salva o serviço se não estiver salvo; remove se já estiver.
   * @param {string} servicoId
   * @returns {boolean} true se ficou salvo, false se foi removido.
   */
  function alternarSalvo(servicoId) {
    const salvos = listarSalvos();
    const posicao = salvos.indexOf(servicoId);
    if (posicao === -1) {
      salvos.push(servicoId);
    } else {
      salvos.splice(posicao, 1);
    }
    salvar(CHAVES.SALVOS, salvos);
    return posicao === -1;
  }

  /**
   * Diz se um serviço está salvo.
   * @param {string} servicoId
   * @returns {boolean}
   */
  function estaSalvo(servicoId) {
    return listarSalvos().indexOf(servicoId) !== -1;
  }

  /* =====================================================================
   * 9. AVALIAÇÕES (NPS)
   * ===================================================================== */

  /**
   * @typedef {Object} Avaliacao
   * @property {string} id
   * @property {string} agendamentoId
   * @property {number} nota De 0 a 10.
   * @property {string} comentario
   * @property {string} criadaEm
   */

  /**
   * Registra a nota NPS de um serviço. Se o serviço já tinha nota, ela é substituída.
   * @param {{agendamentoId: string, nota: number, comentario?: string}} avaliacao
   * @returns {Avaliacao}
   * @throws {Error} Se a nota não for um número inteiro de 0 a 10.
   */
  function registrarAvaliacao(avaliacao) {
    exigir(avaliacao.agendamentoId, 'Agendamento');
    const nota = Number(avaliacao.nota);
    if (!Number.isInteger(nota) || nota < 0 || nota > 10) {
      throw new Error('A nota deve ser um número inteiro de 0 a 10.');
    }

    const lista = listarAvaliacoes().filter(function (a) {
      return a.agendamentoId !== avaliacao.agendamentoId; // remove nota antiga do mesmo serviço
    });
    const nova = {
      id: gerarId(),
      agendamentoId: avaliacao.agendamentoId,
      nota: nota,
      comentario: avaliacao.comentario ? String(avaliacao.comentario).trim() : '',
      criadaEm: avaliacao.criadaEm || agora(),
      demo: Boolean(avaliacao.demo),
    };
    lista.push(nova);
    salvar(CHAVES.AVALIACOES, lista);
    return nova;
  }

  /**
   * Lista todas as avaliações.
   * @returns {Avaliacao[]}
   */
  function listarAvaliacoes() {
    return ler(CHAVES.AVALIACOES, []);
  }

  /* =====================================================================
   * 10. TEMA E ÚLTIMO DIAGNÓSTICO
   * ===================================================================== */

  /**
   * @returns {'claro'|'escuro'|null} null se o usuário nunca escolheu.
   */
  function obterTema() {
    return ler(CHAVES.TEMA, null);
  }

  /**
   * @param {'claro'|'escuro'} tema
   */
  function definirTema(tema) {
    salvar(CHAVES.TEMA, tema === 'escuro' ? 'escuro' : 'claro');
  }

  /**
   * Respostas e resultado do último diagnóstico feito.
   * @returns {Object|null}
   */
  function obterDiagnostico() {
    return ler(CHAVES.DIAGNOSTICO, null);
  }

  /**
   * Guarda o último diagnóstico (com a data em que foi feito).
   * @param {Object} diagnostico Respostas do formulário e serviço recomendado.
   */
  function salvarDiagnostico(diagnostico) {
    salvar(CHAVES.DIAGNOSTICO, Object.assign({}, diagnostico, { feitoEm: agora() }));
  }

  /**
   * Preferências que os formulários lembram (ex.: último veículo, endereço do leva e traz).
   * @returns {Object}
   */
  function obterPreferencias() {
    return ler(CHAVES.PREFERENCIAS, {});
  }

  /**
   * Junta novas preferências às que já existem.
   * @param {Object} novas
   */
  function salvarPreferencias(novas) {
    salvar(CHAVES.PREFERENCIAS, Object.assign(obterPreferencias(), novas));
  }

  /**
   * Grava dados de demonstração prontos (veículos, agendamentos e avaliações marcados com demo: true).
   * @param {{veiculos: Object[], agendamentos: Object[], avaliacoes: Object[]}} dados
   */
  function adicionarDemo(dados) {
    salvar(CHAVES.VEICULOS, listarVeiculos().concat(dados.veiculos));
    salvar(CHAVES.AGENDAMENTOS, listarAgendamentos().concat(dados.agendamentos));
    salvar(CHAVES.AVALIACOES, listarAvaliacoes().concat(dados.avaliacoes));
  }

  /**
   * Apaga só o que foi criado como demonstração (dados reais ficam).
   * @returns {number} Quantos registros foram apagados.
   */
  function removerDemo() {
    const veiculos = listarVeiculos();
    const agendamentos = listarAgendamentos();
    const avaliacoes = listarAvaliacoes();
    const idsDemo = agendamentos
      .filter(function (a) {
        return a.demo;
      })
      .map(function (a) {
        return a.id;
      });
    const naoDemo = function (item) {
      return !item.demo;
    };
    const restantesAval = avaliacoes.filter(function (a) {
      return !a.demo && idsDemo.indexOf(a.agendamentoId) === -1;
    });
    const total =
      veiculos.length - veiculos.filter(naoDemo).length +
      (agendamentos.length - agendamentos.filter(naoDemo).length) +
      (avaliacoes.length - restantesAval.length);
    salvar(CHAVES.VEICULOS, veiculos.filter(naoDemo));
    salvar(CHAVES.AGENDAMENTOS, agendamentos.filter(naoDemo));
    salvar(CHAVES.AVALIACOES, restantesAval);
    return total;
  }

  /* =====================================================================
   * 11. MANUTENÇÃO: uso, backup e limpeza
   * ===================================================================== */

  /**
   * Lista as chaves (completas, com prefixo) que pertencem a este app.
   * @returns {string[]}
   */
  function chavesDoApp() {
    return armazem.chaves().filter(function (chave) {
      return chave && chave.indexOf(PREFIXO) === 0;
    });
  }

  /**
   * Quanto espaço o app ocupa. O navegador costuma liberar cerca de 5 MB (~5.120 KB).
   * Cada caractere ocupa 2 bytes no LocalStorage, por isso a multiplicação por 2.
   * @returns {number} Kilobytes usados, com 1 casa decimal.
   */
  function usoArmazenamento() {
    let bytes = 0;
    chavesDoApp().forEach(function (chave) {
      const valor = armazem.getItem(chave) || '';
      bytes += (chave.length + valor.length) * 2;
    });
    return Math.round((bytes / 1024) * 10) / 10;
  }

  /**
   * Gera um texto JSON com todos os dados do app, para backup.
   * @returns {string}
   */
  function exportarDados() {
    const dados = {};
    Object.keys(CHAVES).forEach(function (nome) {
      const chave = CHAVES[nome];
      dados[chave] = ler(chave, null);
    });
    return JSON.stringify(
      { app: 'pk-estetica', versao: VERSAO_BACKUP, exportadoEm: agora(), dados: dados },
      null,
      2
    );
  }

  /**
   * Restaura um backup gerado por exportarDados().
   * Valida tudo ANTES de gravar; se falhar no meio, desfaz o que já gravou.
   * @param {string|Object} json Texto do arquivo de backup (ou o objeto já convertido).
   * @returns {number} Quantas chaves foram importadas.
   * @throws {Error} Se o arquivo for inválido ou não couber no armazenamento.
   */
  function importarDados(json) {
    let backup;
    try {
      backup = typeof json === 'string' ? JSON.parse(json) : json;
    } catch (erro) {
      throw new Error('Arquivo inválido: o conteúdo não é um JSON válido.');
    }
    if (!backup || backup.app !== 'pk-estetica' || typeof backup.dados !== 'object' || !backup.dados) {
      throw new Error('Arquivo inválido: este não é um backup da PK Estética Automotiva.');
    }

    // Só aceita chaves conhecidas, para ninguém injetar dados estranhos.
    const conhecidas = Object.keys(CHAVES).map(function (nome) {
      return CHAVES[nome];
    });
    const paraGravar = Object.keys(backup.dados).filter(function (chave) {
      return conhecidas.indexOf(chave) !== -1 && backup.dados[chave] !== null;
    });

    // Cópia de segurança do estado atual, para desfazer em caso de erro.
    const copia = {};
    conhecidas.forEach(function (chave) {
      copia[chave] = armazem.getItem(PREFIXO + chave);
    });

    try {
      paraGravar.forEach(function (chave) {
        salvar(chave, backup.dados[chave]);
      });
    } catch (erro) {
      conhecidas.forEach(function (chave) {
        if (copia[chave] === null) armazem.removeItem(PREFIXO + chave);
        else armazem.setItem(PREFIXO + chave, copia[chave]);
      });
      throw erro;
    }
    return paraGravar.length;
  }

  /**
   * Apaga TODOS os dados do app (só as chaves com prefixo "estetica:").
   * @returns {number} Quantas chaves foram apagadas.
   */
  function limparTudo() {
    const chaves = chavesDoApp();
    chaves.forEach(function (chave) {
      armazem.removeItem(chave);
    });
    return chaves.length;
  }

  /**
   * Apaga todos os dados de uso (reais e de demonstração): veículos, agendamentos, check-ins,
   * cartão fidelidade, avaliações, serviços salvos e último diagnóstico.
   * O tema e as preferências de tela (ex.: menu recolhido) continuam.
   * @returns {number} Quantas chaves tinham dados e foram apagadas.
   */
  function apagarDadosDeUso() {
    const chaves = [
      CHAVES.VEICULOS,
      CHAVES.AGENDAMENTOS,
      CHAVES.CHECKINS,
      CHAVES.FIDELIDADE,
      CHAVES.AVALIACOES,
      CHAVES.SALVOS,
      CHAVES.DIAGNOSTICO,
    ];
    let apagadas = 0;
    chaves.forEach(function (chave) {
      if (armazem.getItem(PREFIXO + chave) !== null) apagadas += 1;
      armazem.removeItem(PREFIXO + chave);
    });
    return apagadas;
  }

  /**
   * Diz se os dados estão só na memória (LocalStorage indisponível).
   * Útil para o app avisar: "seus dados não serão salvos".
   * @returns {boolean}
   */
  function estaUsandoMemoria() {
    return usandoMemoria;
  }

  /* =====================================================================
   * 12. API PÚBLICA: só o que está aqui fica visível para os outros arquivos
   * ===================================================================== */
  return {
    // constantes
    STATUS: STATUS,
    CODIGO_QUOTA: CODIGO_QUOTA,
    CARIMBOS_PARA_PREMIO: CARIMBOS_PARA_PREMIO,

    // veículos
    listarVeiculos: listarVeiculos,
    salvarVeiculo: salvarVeiculo,
    removerVeiculo: removerVeiculo,

    // agendamentos
    listarAgendamentos: listarAgendamentos,
    criarAgendamento: criarAgendamento,
    atualizarStatus: atualizarStatus,
    cancelarAgendamento: cancelarAgendamento,
    anexarFotoEtapa: anexarFotoEtapa,

    // check-ins
    salvarCheckin: salvarCheckin,
    obterCheckin: obterCheckin,
    confirmarCheckin: confirmarCheckin,

    // fidelidade
    obterCartao: obterCartao,
    adicionarCarimbo: adicionarCarimbo,
    resgatarPolimento: resgatarPolimento,

    // salvos
    listarSalvos: listarSalvos,
    alternarSalvo: alternarSalvo,
    estaSalvo: estaSalvo,

    // NPS
    registrarAvaliacao: registrarAvaliacao,
    listarAvaliacoes: listarAvaliacoes,

    // tema e diagnóstico
    obterTema: obterTema,
    definirTema: definirTema,
    obterDiagnostico: obterDiagnostico,
    salvarDiagnostico: salvarDiagnostico,

    // preferências e demonstração
    obterPreferencias: obterPreferencias,
    salvarPreferencias: salvarPreferencias,
    adicionarDemo: adicionarDemo,
    removerDemo: removerDemo,
    apagarDadosDeUso: apagarDadosDeUso,
    PREFIXO: PREFIXO,

    // manutenção
    usoArmazenamento: usoArmazenamento,
    exportarDados: exportarDados,
    importarDados: importarDados,
    limparTudo: limparTudo,
    estaUsandoMemoria: estaUsandoMemoria,
  };
})();
