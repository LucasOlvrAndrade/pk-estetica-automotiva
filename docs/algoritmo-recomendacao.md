# Algoritmo de recomendação (diagnóstico)

Código: `Servicos.recomendar(respostas)` em `src/js/servicos.js`, função **pura**
(só usa as respostas e o catálogo; não lê a tela nem grava nada).

## Entradas

| Pergunta | Opções |
|----------|--------|
| Porte | hatch, sedã, SUV, picape (define o preço) |
| Pintura | nova, riscos leves, riscos visíveis, opaca/oxidada |
| Objetivo | limpeza, brilho, proteção duradoura, valorizar para revenda |
| Orçamento | até R$ 200, até R$ 600, até R$ 1.500, sem limite |
| Tempo | até 3 h, 1 dia (8 h), 2 a 3 dias (72 h) |

Candidatos: os 8 serviços do catálogo **e** 6 pacotes (ex.: Correção + Vitrificação).

## Passo 1: Filtros eliminatórios

Um candidato sai da lista se:

1. o **preço para o porte** passa do orçamento;
2. a **duração** passa do tempo disponível;
3. a pintura tem **riscos visíveis ou está opaca** e o candidato tem proteção (cera, selante,
   vitrificação, PPF) **sem** a correção de pintura: proteger por cima do risco "sela" o defeito.

## Passo 2: Folga de orçamento

Se sobrarem **menos de 3** candidatos, o orçamento é ampliado em **20%** e os filtros rodam de novo.
Os itens que só entraram pela folga ganham a etiqueta "acima do seu orçamento" e um aviso explica.

## Passo 3: Pontuação e ordem

`pontos = tabela do objetivo (0 a 10) + ajuste pela pintura`

| Pintura | Ajuste |
|---------|--------|
| riscos visíveis / opaca | +5 se inclui correção (ou +1 se o objetivo é limpeza); −3 se só tem polimento de refino |
| riscos leves | +2 para polimento de refino; −1 para correção (agressiva demais) |
| nova | −4 para correção (desgasta o verniz à toa); −1 para refino; +2 para vitrificação/PPF |

Ordena por pontos (maior primeiro); empate → o mais barato. Ficam os **3 primeiros**,
cada um com um **motivo** em linguagem simples.

## Exemplo passo a passo

Respostas: **Sedã · Riscos visíveis · Proteção duradoura · Sem limite · 2 a 3 dias**

1. **Filtros:** sem limite de preço; 72 h de tempo. Vitrificação, PPF, Selante e Cera **saem** (proteção
   sem correção em pintura riscada). Correção + Vitrificação (72 h) **fica**.
2. **Folga:** sobram mais de 3 → não precisa.
3. **Pontos** (objetivo "proteção"):

| Candidato | Tabela | Ajuste | Total | Preço (sedã) |
|-----------|--------|--------|-------|--------------|
| Correção + Vitrificação | 10 | +5 | **15** | R$ 2.800,00 |
| Correção + Selante | 8 | +5 | **13** | R$ 1.450,00 |
| Pacote Revenda | 6 | +5 | **11** | R$ 1.770,00 |
| Correção de Pintura | 3 | +5 | 8 | R$ 1.050,00 |

Resultado: 1º **Correção + Vitrificação** (selo "Mais indicado"), com o motivo
"Sua pintura tem riscos visíveis: o polimento técnico corrige antes de proteger.
Em seguida, Vitrificação Cerâmica protege o resultado por 2 a 3 anos."

## Garantia testada

As 768 combinações possíveis de respostas foram testadas automaticamente: nenhuma recomenda
proteção sem correção em pintura riscada/opaca, e todas devolvem de 1 a 3 opções.
