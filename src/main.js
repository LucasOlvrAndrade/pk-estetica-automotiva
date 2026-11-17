/**
 * main.js — ponto de entrada
 *
 * É o ÚNICO script que o index.html carrega. Ele importa os módulos e o Vite
 * descobre sozinho a ordem certa: cada arquivo diz de quem depende com "import".
 */
// Fontes da identidade Black Chrome (pacote @fontsource): o Vite coloca os arquivos
// .woff2 dentro do build, então funcionam sem internet. Só o subconjunto "latin"
// (que já tem á, ç, õ...) e só os pesos usados: menos bytes para baixar.
import '@fontsource/saira-extra-condensed/latin-700.css';
import '@fontsource/saira-extra-condensed/latin-800.css';
import '@fontsource/saira-extra-condensed/latin-900.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';

import { AppStorage } from './js/storage.js';
import { Servicos } from './js/servicos.js';
import { UI } from './js/ui.js';
import { Api } from './js/api.js';
import { Veiculos } from './js/veiculos.js';
import { Agenda } from './js/agenda.js';
import { Checkin } from './js/checkin.js';
import { Acompanhamento } from './js/acompanhamento.js';
import { Fidelidade } from './js/fidelidade.js';
import { Historico } from './js/historico.js';
import { Carro3D } from './js/carro3d.js';
import { Movimento } from './js/movimento.js';
import { Rotas } from './js/rotas.js';
import { App } from './js/app.js';

// Módulos NÃO criam variáveis globais. Para testar pelo Console (F12)
// (ex.: AppStorage.listarAgendamentos() ou Agenda.gradeDoDia(...)),
// deixamos os objetos acessíveis no window de propósito.
Object.assign(window, {
  AppStorage,
  Servicos,
  UI,
  Api,
  Veiculos,
  Agenda,
  Checkin,
  Acompanhamento,
  Fidelidade,
  Historico,
  Carro3D,
  Movimento,
  Rotas,
  App,
});
