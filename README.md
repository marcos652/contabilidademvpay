# MovingPay Sales Dashboard

Dashboard moderno em React para consulta de vendas mensais da subadquirente via API da MovingPay.

## Stack

- React + Vite
- Axios para consumo da API
- Recharts para grafico de vendas por dia
- CSS responsivo com tema claro/escuro

## Estrutura

- `src/components`: componentes visuais reutilizaveis
- `src/pages`: paginas do sistema (dashboard)
- `src/services`: integracoes com API
- `src/context`: base de autenticacao futura
- `src/hooks`: hooks de dados e estado
- `src/utils`: formatacao, datas, exportacao

## Configuracao

1. Instale dependencias:

```bash
npm install
```

2. Configure variaveis de ambiente:

```bash
cp .env.example .env
```

Preencha:

- `VITE_MOVINGPAY_API_BASE_URL` (ex.: `https://api.movingpay.com.br`)
- `VITE_MOVINGPAY_API_TOKEN`

3. Rode o projeto:

```bash
npm run dev
```

## Integracao API

Endpoint integrado:

- `GET /api/v3/transacoes`

Parametros enviados automaticamente pelo dashboard:

- `start_date=YYYY-MM-DD 00:00:00`
- `finish_date=YYYY-MM-DD 23:59:59`
- filtros padrao (`Situacao`, `Bandeira`, `Adquirente`, etc.)
- `orderby=start_date,desc`
- `limit=50`
- `page` (com paginacao automatica)
- `opcoes=resumo`
- `codigoUnidadeNegocios=0`

Obs.: o frontend consolida os dados retornados pela API para gerar:

- total de vendas (quantidade de registros)
- quantidade de transacoes (NSU unicos)
- valor total movimentado
- grafico diario

## Extras implementados

- Filtro por intervalo de datas
- Atualizacao dinamica dos cards e grafico
- Loading e tratamento de erro
- Exportacao CSV
- Tema claro/escuro
- Animacoes suaves
- Layout responsivo (desktop/mobile)
