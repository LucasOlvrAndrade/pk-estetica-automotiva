# Descrição dos arquivos

Cada módulo de `src/js/` exporta **um objeto** (criado com IIFE: o que está dentro é privado).
As setas indicam quem importa quem.

| Arquivo | Objeto | Responsabilidade | Principais funções |
|---------|--------|------------------|--------------------|
| `index.html` | (nenhum) | Estrutura semântica de todas as seções, diálogos e o script de tema no `<head>` | (nenhuma) |
| `src/main.js` | (nenhum) | Ponto de entrada: importa os módulos e os expõe no `window` para testes no Console | (nenhuma) |
| `src/js/storage.js` | `AppStorage` | **Único** acesso ao LocalStorage (chaves `estetica:*`), com fallback em memória e tratamento de quota | `listarVeiculos`, `salvarVeiculo`, `criarAgendamento`, `atualizarStatus` (ordem de status validada), `salvarCheckin`, `confirmarCheckin`, `adicionarCarimbo`, `resgatarPolimento`, `registrarAvaliacao`, `obterPreferencias`, `adicionarDemo`, `removerDemo`, `exportarDados`, `importarDados` |
| `src/js/servicos.js` | `Servicos` | Catálogo (8 serviços + 6 pacotes), preços por porte e a lógica pura do diagnóstico | `listar`, `obter`, `filtrar`, `precoPara`, `formatarMoeda`, `validarRespostas`, `recomendar` |
| `src/js/ui.js` | `UI` | Utilitários de interface usados por todos: criar elementos, toasts, diálogos, confirmação, formatação de data/moeda, compressão de imagem, download, notificações e sincronização entre seções/abas | `criar`, `botao`, `toast`, `confirmar`, `abrirDialogo`, `comprimirImagem`, `baixarArquivo`, `notificar`, `avisarMudanca`, `aoMudarDados` |
| `src/js/api.js` | `Api` | APIs externas com `fetch`, `async/await`, tempo limite de 6 s (`AbortController`) e cache no `sessionStorage` | `fipe.listarMarcas`, `fipe.listarModelos`, `fipe.listarAnos`, `viacep` |
| `src/js/veiculos.js` | `Veiculos` | Seção Meus Veículos: selects encadeados da FIPE, modo manual de reserva, placa com máscara/validação, cards com editar/remover | `placaValida`, `formatarPlaca`, `iniciar` |
| `src/js/agenda.js` | `Agenda` | Regras de funcionamento (horários, dia inteiro, previsão de entrega), grade de horários, leva e traz com ViaCEP, escolha do dia por semana, resumo, protocolo, cancelamento e resgate do cartão | `gradeDoDia`, `previsaoEntrega`, `gerarProtocolo`, `gerarIcs`, `preencher`, `prepararResgate`, `cancelar` |
| `src/js/checkin.js` | `Checkin` | Check-in do atendente (fotos comprimidas, mapa de avarias SVG, km, combustível, itens) e o relatório do cliente com lightbox | `abrir`, `renderizarRelatorio`, `abrirFoto` |
| `src/js/acompanhamento.js` | `Acompanhamento` | Página Atendimento (avançar etapas, foto por etapa, entrega) e página Acompanhamento do cliente (linha do tempo, %, previsão); avisos de "pronto" e NPS | `etapasDe`, `progressoDe`, `proximoPasso` |
| `src/js/rotas.js` | `Rotas` | Páginas por hash (`#/agendar`): mostra uma seção por vez, Voltar/F5, título da aba, foco no título; menu lateral recolhível (salvo no LocalStorage) e gaveta no celular | `ir`, `atual`, `aoTrocarPagina`, `PAGINAS` |
| `src/js/movimento.js` | `Movimento` | Acabamento de movimento: contadores do hero, comparador antes × depois, cursor e botões magnéticos; Lenis + GSAP ScrollTrigger (só desktop com mouse, sem "reduzir movimento") | `iniciar`, `contar` |
| `src/assets/logo/*.svg` | (nenhum) | Monograma PK cromado e logo completo (o site usa a cópia embutida no `index.html`) | (nenhuma) |
| `src/js/fidelidade.js` | `Fidelidade` | Cartão PK Club: carimbos, "faltam X", recompensa, resgate e histórico | `textoStatus`, `iniciar` |
| `src/js/historico.js` | `Historico` | Histórico com filtros, lembrete de manutenção, pesquisa NPS, painel de métricas e dados de demonstração | `calcularMetricas`, `abrirNps`, `montarDemo` |
| `src/js/carro3d.js` | `Carro3D` | Mini motor 3D em Canvas 2D (modelo, rotação, projeção, pintor, luz) | `criar`, `suavizar` |
| `src/js/modelo3d.js` | `Modelo3D` | Carrega o Civic 3D (Draco), centraliza, orienta a frente e aplica os materiais (pintura com verniz trocada no shader, cromados, vidro fumê). Usado pela abertura e pelo Início | `carregar`, `COMPRIMENTO` |
| `src/js/intro3d.js` | `Intro3D` | Cena cinematográfica da abertura (câmera em dolly, neon, holofote, bloom) | `criar`, `suportado` |
| `src/js/vitrine3d.js` | `Vitrine3D` | O mesmo Civic girável no Início, com a mesma interface do `Carro3D` (giro, desenhar, cor) | `criar` |
| `src/js/app.js` | `App` | Orquestra a página: tema, menu, vitrine de serviços, comparativo, detalhes, salvos, diagnóstico, abertura, carro do topo e títulos; inicia os outros módulos | `iniciar`, `abrirDetalhes`, `reverAbertura` |
| `src/css/style.css` | (nenhum) | Design tokens, componentes, temas escuro/claro, responsividade e "reduzir movimento" | (nenhuma) |
| `vite.config.js` | (nenhum) | Build do site (`dist/`) com caminhos relativos | (nenhuma) |
