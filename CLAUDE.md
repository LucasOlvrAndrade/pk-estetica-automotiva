# CLAUDE.md — PK Estética Automotiva

> Este arquivo é lido automaticamente pela IA (Claude Code) no início de cada sessão.
> Ele guarda o contexto do produto e as regras técnicas que valem para **todas** as etapas do projeto.

## Contexto acadêmico

Trabalho final da disciplina **Desenvolvimento de Interfaces**. O grupo está aprendendo e precisa
**entender e apresentar** todo o código gerado. Clareza e didática valem mais do que esperteza.

## Produto

- **Nome:** PK Estética Automotiva — aplicação web para uma estética automotiva.
- **Visão:** "Transformar o cuidado e a valorização automotiva em uma experiência simples, transparente e digital."
- **Problema:** donos de veículos têm dificuldade em achar estéticas confiáveis, com preço transparente,
  padrão técnico e agendamento prático.
- **Público:**
  - entusiastas e colecionadores;
  - donos de veículos de médio e alto padrão (25 a 55 anos);
  - quem quer valorizar o carro para revenda;
  - pessoas com rotina corrida.
- **Proposta de valor:** "Cuidado técnico com padrão de fábrica, acompanhamento 100% digital e proteção veicular garantida."
- **Princípios:** transparência absoluta, excelência técnica e conveniência.

## Regras técnicas fixas (não negociáveis)

> **Mudança de stack (Fase 2 da repaginação "Black Chrome", prompt 13):** o projeto deixou de ser
> "Vanilla sem build" e passou a usar **Vite + módulos ES**, com bibliotecas liberadas
> (Three.js, GSAP, Lenis, postprocessing). A lógica e a separação por arquivos continuam as mesmas.

1. **JavaScript puro em módulos ES, com Vite.** Bibliotecas permitidas quando trazem ganho real
   (Three.js, GSAP + ScrollTrigger, Lenis, postprocessing). **Sem framework de UI** (React etc.) e sem backend.
2. **Persistência apenas em `localStorage`**, sempre pelo `AppStorage`, com as **mesmas chaves `estetica:*`**
   (dados já salvos precisam continuar sendo lidos). O lado da estética fica nas páginas **Atendimento**
   (check-in, etapas, entrega) e **Painel** (métricas e dados de demonstração). O "Modo Estética" foi removido.
3. **Módulos ES, um objeto exportado por arquivo** (a IIFE continua: o que está dentro dela é privado):

   | Arquivo               | Exporta      |
   | --------------------- | ------------ |
   | `src/js/storage.js`        | `AppStorage`     |
   | `src/js/servicos.js`       | `Servicos`       |
   | `src/js/ui.js`             | `UI` (utilitários comuns: elementos, toasts, diálogos, formatação) |
   | `src/js/api.js`            | `Api`            |
   | `src/js/veiculos.js`       | `Veiculos`       |
   | `src/js/agenda.js`         | `Agenda`         |
   | `src/js/checkin.js`        | `Checkin`        |
   | `src/js/acompanhamento.js` | `Acompanhamento` |
   | `src/js/fidelidade.js`     | `Fidelidade`     |
   | `src/js/historico.js`      | `Historico`      |
   | `src/js/carro3d.js`        | `Carro3D`        |
   | `src/js/rotas.js`          | `Rotas` (páginas por hash `#/pagina` + menu lateral recolhível/gaveta) |
   | `src/js/movimento.js`      | `Movimento` (contadores, antes × depois, ímã, Lenis + GSAP) |
   | `src/js/intro3d.js`        | `Intro3D` (cena Three.js da abertura; carregado com `import()`) |
   | `src/js/app.js`            | `App`            |

   - **Modelo 3D da abertura** (`src/assets/modelos/civic-ek9.glb`): "Honda Civic Type R (EK9) - Low Poly &
     Stylized", de marksform (Sketchfab), **CC BY 4.0**, feito pelo próprio autor no Blender. Vale em todas
     as versões, inclusive a publicada. O crédito no rodapé (`#credito-modelo`) e no README é obrigatório.
     Comprimido com Draco + WebP (68 KB). O modelo antigo (Ddiaz Design, origem incerta) foi removido e não
     deve voltar ao projeto.
   - **Foto do antes × depois** (`src/assets/imagens/polimento.webp`): fornecida pelo grupo. As duas camadas
     usam a metade polida; o "antes" é gerado em CSS (filtro + micro-riscos).
   - Utilitários (criar elementos, toasts, confirmação, datas, moeda) vêm do `UI`: não duplicar.
   - **Navegação:** cada `<section class="secao">` do `<main>` é uma página. Para levar o usuário a outra
     página pelo código, use `Rotas.ir('agendar')` (nunca `scrollIntoView` até a seção). Links internos usam
     `href="#/pagina"`. Página nova = nova `<section>` + item em `Rotas.PAGINAS` + link no menu lateral.
   - **Identidade Black Chrome:** cores, fontes e medidas só pelos tokens do `style.css` (seção 1 e 9).
     Acento único: `--cor-neon` (status, foco, CTA em hover). Cromo: `--cromo`. Logo: `<use href="#pk-monograma">`.
   - Toda mudança de dado chama `UI.avisarMudanca()`; quem mostra dados usa `UI.aoMudarDados()`.

   - O `index.html` carrega **um único** `<script type="module" src="/src/main.js">`. Cada arquivo diz de
     quem depende com `import`. O `main.js` também deixa os objetos no `window` para testes pelo Console.
   - Modelo:

     ```js
     /**
      * Módulo de exemplo.
      */
     export const Exemplo = (function () {
       'use strict';

       // variáveis privadas: só existem aqui dentro
       let contador = 0;

       /**
        * Incrementa e devolve o contador.
        * @returns {number} Novo valor do contador.
        */
       function incrementar() {
         contador += 1;
         return contador;
       }

       // só o que está aqui fica visível para quem fizer import
       return { incrementar: incrementar };
     })();
     ```

4. **Rodar e entregar:**
   - `npm run dev` → servidor de desenvolvimento (http://localhost:5173).
   - `npm run build` → pasta `dist/` (versão otimizada, a que vai para o site publicado).
   - `npm run preview` → testa a `dist/` em http://localhost:4173.
   - O antigo "arquivo do professor" (`dist-professor`, arquivo único) foi descontinuado: a entrega é o site.
5. **Estrutura de pastas:**

   ```
   index.html              estrutura da página
   src/main.js             ponto de entrada
   src/js/*.js             módulos
   src/css/style.css
   public/                 arquivos copiados como estão (modelos 3D, imagens)
   package.json  vite.config.js  README.md
   docs/  CLAUDE.md  PROMPTS.md
   node_modules/  dist/     gerados automaticamente: não editar
   ```

6. **Idioma:** código (nomes de variáveis/funções), comentários (JSDoc nas funções públicas) e textos da
   interface em **português do Brasil**.
7. **Moeda:** valores em reais sempre formatados com
   `new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
8. **Formatação:** 2 espaços de indentação, ponto e vírgula, aspas simples no JS.
9. **Controle de versão: repositório público no GitHub** (pedido do grupo no prompt 34).
   - O `.gitignore` deixa de fora `node_modules/`, `dist/`, `.env*` e `.vercel/`: nunca versionar
     segredos nem o build.
   - Commit e push só quando o grupo pedir. A publicação do site continua pela Vercel (pasta `dist/`).
   - Backup alternativo: compactar a pasta em `.zip` **sem a pasta `node_modules`** (o `npm install` recria).

## PADRÃO DE ENTREGA

A partir do prompt 14, o grupo pediu para **não** receber mais passo a passo para iniciantes:
a IA executa o trabalho de ponta a ponta e entrega um resumo objetivo.

1. Arquivos criados, alterados ou removidos.
2. O que foi feito e decisões relevantes (curto).
3. Como foi testado e o resultado.
4. Uma nova linha no PROMPTS.md.

O código continua comentado (JSDoc nas funções públicas e um "por quê" curto nos blocos não óbvios),
porque o grupo ainda precisa conseguir apresentá-lo.

## Registro de prompts (PROMPTS.md)

Ao final de **cada** tarefa, adicionar uma linha na tabela do `PROMPTS.md`, com número sequencial,
preenchendo todas as colunas **exceto "Autor" e "Adaptações do aluno"**, que ficam em branco para o grupo preencher.
