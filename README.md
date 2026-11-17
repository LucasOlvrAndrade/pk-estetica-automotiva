# PK Estética Automotiva

Trabalho final da disciplina **Desenvolvimento de Interfaces** (2026).


Aplicação web de uma estética automotiva: o cliente descobre o serviço certo para o carro, vê o preço
fechado, agenda, acompanha cada etapa pelo celular, avalia e acumula fidelidade. O lado da estética
fica nas páginas **Atendimento** e **Painel** do menu lateral. Publicado em **https://pkestetica.lucas-andrade.dev**.

Identidade **Black Chrome**: pretos em camadas, títulos e logo cromados, um único acento verde neon
(`#39FF88`), tipografia Saira Extra Condensed + Manrope, e o tema claro **Silver**.

## Integrantes

| Nome | GitHub |
|------|--------|
| Henrique Mota Monteiro | [@Henriquemotaux](https://github.com/Henriquemotaux) |
| João Pedro Duarte Borges | [@joaopedroduarteborges](https://github.com/joaopedroduarteborges) |
| Lucas de Oliveira Andrade | [@LucasOlvrAndrade](https://github.com/LucasOlvrAndrade) |
| Lucas Martins Barreto | [@LucasBarretoDev-eng](https://github.com/LucasBarretoDev-eng) |
| Yuri Marques Oliveira | [@yuriyz22](https://github.com/yuriyz22) |

## Funcionalidades

Cada item é uma **página** com endereço próprio (`#/servicos`, `#/agendar`...), aberta pelo menu
lateral (recolhível; vira gaveta no celular). Voltar do navegador e F5 mantêm a página.

| Página | O que faz |
|--------|-----------|
| Início | Abertura com o Civic em 3D, painel de marchas/VTEC; título cromado, números da marca, faixa de serviços, comparador **antes × depois** arrastável sobre foto real de polimento |
| Serviços | Vitrine com preço por porte, filtros, busca, comparativo, detalhes e serviços salvos |
| Diagnóstico | 5 perguntas → 3 recomendações com motivo ([algoritmo](docs/algoritmo-recomendacao.md)) |
| Agendar | Horários reais (seg–sex 8–18h, sáb 8–13h), previsão de entrega, leva e traz com ViaCEP, protocolo e `.ics` |
| Meus Veículos | Cadastro pela tabela FIPE (com plano B), placa antiga ou Mercosul |
| Acompanhamento | Linha do tempo, %, fotos das etapas, previsão; atualiza sozinho entre abas; notificação no "pronto" |
| Atendimento | Uso da equipe: check-in (fotos + mapa de avarias), avançar etapas com foto, entrega |
| Painel | Métricas (NPS × meta, recorrência, ticket médio, mais vendidos) e dados de demonstração |
| Fidelidade | 5 lavagens = Polimento de Refino grátis |
| Histórico | Filtros, rever check-in, agendar novamente, lembrete de manutenção, NPS |
| Como funciona | Passos, perguntas frequentes e glossário |

Detalhes e mapa da rubrica: [docs/funcionalidades.md](docs/funcionalidades.md).

## Tecnologias

- HTML5 semântico, CSS3 (tokens, Grid, `:has()`, temas, `prefers-reduced-motion`) e JavaScript em **módulos ES**.
- **Vite** (servidor de desenvolvimento e build).
- **GSAP + ScrollTrigger** e **Lenis** (parallax e rolagem suave, só no desktop com mouse; carregados sob demanda).
- Fontes **@fontsource** (Saira Extra Condensed e Manrope) embutidas no build: funcionam sem internet.
- Rotas por **hash** (`#/pagina`) sem biblioteca: `src/js/rotas.js`.
- Sem framework de UI e sem backend: dados no **LocalStorage** (chaves `estetica:*`).
- Validado no W3C (HTML e CSS sem erros) e auditado com axe-core (WCAG 2.1 AA, sem violações graves em nenhuma página, nos dois temas).
- Lighthouse (celular, versão publicada): Desempenho 95, Acessibilidade 100, Boas práticas 100.

## APIs usadas

| API | Uso | Tratamento de falha |
|-----|-----|---------------------|
| [Tabela FIPE (parallelum)](https://deividfortuna.github.io/fipe/) | Marcas, modelos e anos | Tempo limite de 6 s; cache no `sessionStorage`; campos de texto se falhar |
| [ViaCEP](https://viacep.com.br/) | Endereço do leva e traz | "CEP não encontrado" e preenchimento manual sem rede |
| Notification API (navegador) | Aviso de "veículo pronto" | Só com permissão dada pelo usuário |

## Abertura 3D e créditos do modelo

O site e o `npm run dev` abrem com uma cena **Three.js** (no computador; celular e tablet usam o carro em 2D, mais leve):
Civic preto com pintura espelhada, rodas e escapamento cromados, neon verde por baixo, faróis com
bloom, luz de estúdio varrendo a carroceria e o painel de marchas/VTEC. Sem WebGL, com conexão lenta
ou em aparelho fraco, ela cai para o carro em Canvas 2D.

**Modelo 3D: Honda Civic Type R (EK9) por marksform – [Sketchfab](https://sketchfab.com/3d-models/honda-civic-type-r-ek9-low-poly-stylized-599b4155e11d41ee9ea9d8306b4b5cff)**,
licença [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modificado: pintura preta (troca da cor
da lataria no shader), rodas e escapamento cromados, texto da marca no pneu escondido e compressão
Draco + WebP (487 KB → 68 KB). O modelo não tem emblemas nem logotipos.
