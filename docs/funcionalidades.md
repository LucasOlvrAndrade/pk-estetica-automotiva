# Funcionalidades

## Mapa: rubrica do professor → funcionalidade

| Item da rubrica | Funcionalidade no app | Onde |
|-----------------|-----------------------|------|
| Preferências | Diagnóstico (porte, pintura, objetivo, orçamento, tempo), tema escolhido, último veículo e endereço lembrados | Diagnóstico, botão de tema, Agendar |
| Recomendação | Algoritmo do diagnóstico: 3 recomendações ordenadas, com motivo em linguagem simples | Diagnóstico ([algoritmo](algoritmo-recomendacao.md)) |
| Favoritos | Serviços salvos, com "Desfazer" | Botão Salvar nos cards → Histórico › Serviços salvos |
| Histórico | Lista de serviços com filtros, check-in, "Agendar novamente" e lembrete de manutenção | Histórico |
| Tema | Escuro/claro, salvo; na 1ª visita segue o sistema; sem "flash" | Botão ☾/☀ no topo |
| Persistência | LocalStorage via `AppStorage` (chaves `estetica:*`) | Todas as seções |
| APIs | Tabela FIPE e ViaCEP, com tempo limite e plano B | Meus Veículos, Agendar |
| Acessibilidade | Teclado, foco visível e devolvido, `aria-live`, contraste AA nos dois temas, "reduzir movimento" | Todo o site |

## Funcionalidades em detalhe

| Funcionalidade | Como funciona | Requisito / problema que atende |
|----------------|---------------|---------------------------------|
| Vitrine de serviços | Cards com preço pelo porte, filtros por categoria, busca com debounce e comparativo Cera × Selante × Vitrificação × PPF | Transparência de preço |
| Diagnóstico | 5 perguntas → filtros (preço, tempo, correção antes de proteção) → pontuação → 3 opções; orçamento +20% se faltar opção | Escolher o serviço certo sem conhecer os termos técnicos |
| Meus Veículos | Marca → Modelo → Ano pela FIPE; se a API falhar, campos de texto; placa ABC-1234 ou ABC1D23 | Cadastro rápido e sem erro |
| Agendamento | Seg–sex 8h–18h, sáb 8h–13h; slots de 1 h; serviços > 8 h ocupam dias inteiros; resumo com preço, previsão e leva e traz (ViaCEP, R$ 30,00); protocolo e `.ics` | Conveniência e preço fechado antes de confirmar |
| Check-in | Até 6 fotos comprimidas (1024 px, JPEG 0,6), mapa de avarias clicável/teclado, km, combustível, itens; status vira "recebido" | Confiança: estado do carro registrado na entrada |
| Acompanhamento | Linha do tempo com as etapas do serviço, horários, fotos, % e previsão; atualiza sozinho (inclusive entre abas); notificação no "pronto" | Acompanhamento 100% digital |
| Atendimento (página) | Visão da equipe: check-in, avançar etapa, foto por etapa, entrega | Simula o lado da estética sem backend |
| Painel (página) | Métricas e dados de demonstração | Indicadores do Product Vision Canvas |
| Menu lateral + páginas | Rotas por hash, recolher com dica, gaveta no celular, Voltar/F5 | Navegação e consistência |
| NPS | Pesquisa 0–10 após a entrega | Medir satisfação (meta NPS > 85) |
| Fidelidade | 5 lavagens = Polimento de Refino grátis; resgate leva ao agendamento com R$ 0,00 | Recorrência (meta 40%) |
| Painel de métricas | NPS, recorrência, ticket médio por mês, mais vendidos, participação de PPF/Vitrificação; dados de demonstração | Gestão da estética |
| Como funciona | 5 passos, perguntas frequentes e glossário | Ajuda e linguagem do cliente |
| Abertura 3D | Civic com painel de marchas e VTEC; 1x por sessão, pulável, desligada com "reduzir movimento" | Identidade da marca |
