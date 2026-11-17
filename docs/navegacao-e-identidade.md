# Navegação por páginas, menu lateral e identidade Black Chrome

Este guia explica as duas últimas mudanças grandes do site:

1. a **identidade Black Chrome** (prompt 28);
2. a **navegação nova** (prompt 29): o Modo Estética saiu, o menu foi para a lateral e cada seção virou uma página.

---

## 1. O que mudou (resumo)

| Antes | Agora |
|-------|-------|
| Uma página só, com rolagem até cada seção | Uma página por vez, com endereço próprio: `#/servicos`, `#/agendar`... |
| Menu no topo (hambúrguer no celular) | Menu **lateral** fixo à esquerda, com ícone e nome. Pode ser **recolhido** (só ícones). No celular, vira uma **gaveta** |
| Botão "Modo Estética" mostrava telas escondidas | Páginas **Atendimento** (check-in, etapas, entrega) e **Painel** (métricas e dados de demonstração), no grupo "Estética" do menu |
| Amarelo PK + fonte Archivo | Preto em camadas, títulos e logo **cromados**, verde neon `#39FF88` como único acento, fontes Saira Extra Condensed + Manrope |

Nenhuma funcionalidade foi removida e os dados do LocalStorage continuam os mesmos (chaves `estetica:*`).
A única preferência nova é `menuRecolhido`, salva dentro de `estetica:preferencias`.

---

## 2. Arquivos

**Criados**
- `src/js/rotas.js`: roteador por hash e menu lateral.
- `src/js/movimento.js`: contadores, antes × depois, botões magnéticos, rolagem suave.
- `src/assets/logo/pk-monograma.svg` e `src/assets/logo/pk-logo-completo.svg`: o logo.
- `docs/navegacao-e-identidade.md` (este arquivo).

**Alterados**
- `index.html`: menu lateral, ícones SVG, páginas Atendimento e Painel, links `#/pagina`, logo, hero, antes × depois.
- `src/css/style.css`: tokens Black Chrome (seção 1), peças da identidade (seção 9), menu lateral e páginas (seção 10).
- `src/js/app.js`: usa o `Rotas` (o menu hambúrguer antigo saiu), botões que levavam a seções agora abrem páginas.
- `src/js/acompanhamento.js`: o Modo Estética saiu; a lista da equipe fica na página Atendimento.
- `src/js/agenda.js`: "Agendar novamente" e o resgate da fidelidade abrem a página Agendar.
- `src/main.js`: importa as fontes, o `Rotas` e o `Movimento`.
- `package.json`: `gsap`, `lenis`, `@fontsource/saira-extra-condensed`, `@fontsource/manrope`.
- `README.md`, `CLAUDE.md` e os documentos da pasta `docs/`, para tirar o Modo Estética.

**Removidos (só código, nenhuma funcionalidade)**
- O botão `#btn-modo-estetica`, o selo "Modo Estética", as classes `.so-estetica`/`.so-cliente` e o CSS do cabeçalho antigo.

---

## 3. Como funciona, por blocos

### 3.1 Roteamento por hash (`rotas.js`)

O **hash** é a parte do endereço depois do `#`: em `index.html#/agendar`, o hash é `#/agendar`.

Por que hash?
- Trocar o hash **não recarrega** a página e não pede nada ao servidor: funciona em qualquer
  hospedagem estática (como a Vercel), sem configurar rotas no servidor.
- O navegador guarda cada hash no **histórico**: o botão Voltar funciona sozinho.
- No F5, o endereço continua com `#/agendar`. O app lê esse hash e abre a mesma página.

Os blocos do arquivo:

1. **`PAGINAS`**: a lista das páginas (id e nome). O id é o mesmo da `<section id="...">` do HTML.
2. **`paginaDoHash()`**: lê `location.hash`, tira o `#/` e devolve o id. Aceita também o formato
   antigo (`#agendar`), para links salvos antes da mudança.
3. **`mostrar(id)`**: coloca o atributo `hidden` em todas as seções e tira só da página escolhida.
   Também:
   - marca o link do menu com `aria-current="page"`;
   - troca o título da aba ("Agendar: PK Estética Automotiva");
   - volta a rolagem para o topo;
   - liga a classe `.pagina-entrando` (a transição).
4. **`ir(id)`**: o que os botões internos usam (ex.: `Rotas.ir('agendar')`). Grava o endereço novo com
   `history.pushState` (entra no histórico) e chama `mostrar`.
5. **`aoMudarEndereco()`**: é chamado pelos eventos `hashchange` e `popstate`. Isso cobre o clique num
   link `<a href="#/servicos">`, o Voltar/Avançar e o endereço digitado à mão. Se o hash não for uma
   página, ele cai numa página válida, sem quebrar.
6. **Menu lateral** (`iniciarMenu`):
   - **Recolher/expandir:** troca `data-menu="recolhido"` no `<html>`, o `aria-expanded` e o texto do
     botão, e salva a escolha com `AppStorage.salvarPreferencias({ menuRecolhido })`.
   - **Gaveta do celular:** o hambúrguer troca o `aria-expanded` e a classe `menu-aberto`. Fechada, a
     gaveta fica com `inert`, então o Tab não entra nela. Ela fecha ao escolher uma página, ao tocar
     no fundo escuro e com Esc (com Esc, o foco volta ao hambúrguer).
7. **Foco:** ao trocar de página pelo menu, o foco vai para o título (`h2`) da página nova. Assim, o
   leitor de tela anuncia onde a pessoa chegou.

### 3.2 Menu lateral no CSS (`style.css`, seção 10)

- **Desktop (≥ 1024 px):** a barra é `position: fixed` à esquerda e o `body` ganha
  `padding-left: var(--largura-barra)`.
- **Recolhido:** `--largura-barra` passa de 248 px para 76 px. O nome de cada página não some do HTML,
  porque continua sendo o nome do link para o leitor de tela. Ele vira uma **dica** posicionada ao lado
  do ícone e só aparece no hover ou no foco pelo teclado.
- **Celular:** a barra fica fora da tela (`translateX(-100%)`) e entra deslizando quando abre.
- **Página atual:** traço neon à esquerda e ícone verde.

### 3.3 Identidade Black Chrome

- **Tokens** (seção 1 do CSS): as quatro camadas de preto, o cromo (`--cromo`), o neon (`--cor-neon`) e
  as fontes. O tema Silver (claro) só redefine esses valores.
- **Texto cromado:** `background-clip: text` faz o degradê aparecer só dentro das letras. Uma segunda
  camada, a "luz de inspeção", atravessa o título uma vez quando ele aparece (`@keyframes varrer-cromo`).
- **Logo:** desenhado uma vez no topo do `<body>` (`<symbol id="pk-monograma">`) e reaproveitado com
  `<use href="#pk-monograma">` no menu, no rodapé e na abertura.
- **Botões:** inclinados com `skewX(-10deg)`, como uma faixa de corrida. O aperto usa a propriedade
  `scale` e o efeito ímã usa `translate`. São propriedades separadas, então uma não apaga a outra.
- **Antes × depois:** as duas "fotos" são degradês CSS. O controle é um `<input type="range">` de verdade
  (funciona com mouse, dedo e setas do teclado), e o JS só copia o valor para a variável `--pos`, que
  recorta a pintura polida com `clip-path`.
- **`movimento.js`:** contadores (0 até o valor), botões magnéticos e, só no
  desktop com mouse, rolagem suave (Lenis) e parallax (GSAP ScrollTrigger). As bibliotecas entram com
  `import()` e o celular nem as baixa.
- **"Reduzir movimento":** desliga transições de página, brilho do cromo, ímã e parallax. O
  antes × depois continua funcionando, porque é funcional e não enfeite.
- **Botão de recolher no topo:** fica ao lado do logo (expandido) ou logo abaixo dele (recolhido), para
  nunca sumir em telas baixas. A barra tem rolagem própria; por isso as dicas usam `position: fixed`
  e o `rotas.js` calcula a altura delas (`--dica-y`) a partir do item apontado.

---

## 4. Passo a passo no VS Code

1. Abra a pasta do projeto no VS Code e o terminal (**Ctrl + '**).
2. `npm install`: baixa as bibliotecas novas (GSAP, Lenis e as fontes). Precisa só uma vez.
3. `npm run dev` e abra http://localhost:5173.
4. Navegue pelo menu lateral e confira o endereço mudando (`#/servicos`, `#/agendar`...).
5. `npm run build` gera a `dist/` (versão do site) e `npm run preview` testa essa versão em
   http://localhost:4173.

---

## 5. Roteiro de teste

**Preparação:** abra a página Painel → **Gerar dados de demonstração**.

### Desktop (janela larga, ≥ 1024 px)

| Página | O que clicar | O que deve aparecer |
|--------|--------------|---------------------|
| Menu | Clicar em cada item | Só aquela página aparece; o item fica com traço verde; o endereço muda para `#/...`; a aba mostra o nome da página |
| Menu | Botão « ao lado do logo | A barra fica só com ícones e o botão (agora ») desce para baixo do logo, sempre visível. Passe o mouse (ou use Tab) num ícone: o nome aparece ao lado. Aperte F5: continua recolhida. Clique de novo para expandir |
| Início | Rolar a página | Título cromado com brilho, números contando, faixa de serviços, antes × depois (arraste ou use as setas depois do Tab) |
| Início | "Agendar agora" | Abre a página Agendar |
| Serviços | "Ver detalhes" → "Agendar este serviço" | Abre a página Agendar com o serviço já escolhido |
| Diagnóstico | Responder e enviar | 3 recomendações; "Agendar" abre a página Agendar preenchida |
| Agendar | Escolher veículo, serviço, data e horário | Resumo e confirmação com protocolo, como antes |
| Meus Veículos | "Cadastrar veículo" | Formulário com a FIPE |
| Acompanhamento | Escolher o serviço | Linha do tempo, %, fotos, previsão |
| Fidelidade | Ver o cartão | Cartão em metal escovado com os carimbos |
| Histórico | "Agendar novamente" | Abre a página Agendar preenchida, com o foco na data |
| Como funciona | Abrir as perguntas | Passos, FAQ e glossário |
| Atendimento | "Fazer check-in" → "Avançar etapa" | Diálogo de check-in; as etapas avançam; em outra aba aberta em Acompanhamento, tudo atualiza sozinho |
| Painel | Gerar e limpar dados de demonstração | Gráficos aparecem e somem; os dados reais ficam |
| Navegador | Voltar, Avançar e F5 | Voltam para a página certa; o F5 mantém a página aberta |

### Celular (DevTools F12 → ícone de celular → 390 × 844)

| O que fazer | O que deve aparecer |
|-------------|---------------------|
| Abrir o site | Barra no topo com "Menu" e o logo; sem rolagem para os lados |
| Tocar em "Menu" | A gaveta entra pela esquerda com fundo escuro; o foco vai para a página atual |
| Escolher uma página | A gaveta fecha e a página abre |
| Abrir e apertar Esc | A gaveta fecha e o foco volta para "Menu" |
| Abrir e tocar no fundo escuro | A gaveta fecha |
| Percorrer as 11 páginas | Tudo legível em uma coluna, botões com área de toque confortável |

### Reduzir movimento e sem internet

- **Reduzir movimento:** no Windows, Configurações → Acessibilidade → Efeitos visuais → desligar
  "Efeitos de animação". As páginas trocam sem deslizar e o título não tem brilho correndo.
- **Sem internet:** DevTools → Network → **Offline** e recarregar. As fontes continuam, porque estão
  dentro do build. A FIPE e o ViaCEP mostram o preenchimento manual.

---

## 6. Erros comuns e como resolver

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| `Failed to resolve import "gsap"` (ou `"lenis"`) no terminal | As bibliotecas novas não foram instaladas | Rodar `npm install` |
| Todas as seções aparecem juntas | O JavaScript não carregou (erro antes do `Rotas.iniciar()`) | F12 → Console: ver a 1ª mensagem vermelha |
| `Rotas is not defined` no Console | Teste digitado antes da página carregar | Esperar carregar e tentar de novo (o `main.js` expõe `Rotas` no `window`) |
| Clicar num link não troca a página | O link usa `href="#agendar"` (formato antigo) dentro de um código novo | Use `href="#/agendar"`. O formato antigo ainda funciona, mas é convertido |
| Botão novo leva para a seção errada ou não faz nada | O código usou `scrollIntoView` até uma seção escondida | Troque por `Rotas.ir('id-da-pagina')` |
| O menu não lembra se estava recolhido | LocalStorage bloqueado (janela anônima com bloqueio) | Normal: sem armazenamento, volta expandido |
| Título aparece sem cor (invisível) | Navegador antigo sem `background-clip: text` | Atualizar o navegador. No Alto Contraste do Windows, o CSS já troca para cor sólida |
