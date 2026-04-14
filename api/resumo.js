// Endpoint unificado: gera token via /acessar e consulta resumo via /transacoes
// Tudo numa só chamada serverless — resolve o problema de token expirado

const readEnv = (keys, fallback = '') => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return fallback;
};

const BASE_URL = readEnv(
  ['MOVINGPAY_API_BASE_URL', 'VITE_MOVINGPAY_API_BASE_URL'],
  'https://api.movingpay.com.br'
);
const AUTH_EMAIL = readEnv(['MOVINGPAY_AUTH_EMAIL', 'VITE_MOVINGPAY_AUTH_EMAIL'], '');
const AUTH_PASSWORD = readEnv(['MOVINGPAY_AUTH_PASSWORD', 'VITE_MOVINGPAY_AUTH_PASSWORD'], '');
const STATIC_TOKEN = readEnv(['MOVINGPAY_API_TOKEN', 'VITE_MOVINGPAY_API_TOKEN'], '');

const pickToken = (payload) => {
  const fields = ['token', 'access_token', 'jwt'];
  for (const f of fields) {
    if (payload?.[f]) return String(payload[f]);
    if (payload?.data?.[f]) return String(payload.data[f]);
    if (payload?.result?.[f]) return String(payload.result[f]);
    if (payload?.payload?.[f]) return String(payload.payload[f]);
  }
  if (typeof payload?.data === 'string' && payload.data.length > 20) return payload.data;
  return '';
};

// Step 1: Gerar token via /acessar
async function gerarToken(customer) {
  const url = new URL('/api/v3/acessar', BASE_URL);
  url.searchParams.set('email', AUTH_EMAIL);
  url.searchParams.set('password', AUTH_PASSWORD);

  const headers = { 'Content-Type': 'application/json' };
  if (STATIC_TOKEN) {
    headers.Authorization = `Bearer ${STATIC_TOKEN}`;
  }
  if (customer) {
    headers.customer = String(customer);
  }

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => ({}));
  const token = pickToken(data);

  return { token, status: res.status, data };
}

// Step 2: Consultar resumo via /transacoes com o token gerado
async function consultarResumo(token, customer, startDate, endDate) {
  const url = new URL('/api/v3/transacoes', BASE_URL);
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('finish_date', endDate);
  url.searchParams.set('Situacao[]', 'APPR');
  url.searchParams.set('opcoes', 'resumo');
  url.searchParams.set('limit', '50');
  url.searchParams.set('page', '1');
  url.searchParams.set('orderby', 'start_date,desc');
  url.searchParams.set('not_show_deleted_at', '1');
  url.searchParams.set('codigoUnidadeNegocios', '0');

  const headers = {
    Authorization: `Bearer ${token}`,
  };
  if (customer) {
    headers.customer = String(customer);
  }

  const res = await fetch(url.toString(), { headers });
  const data = await res.json().catch(() => ({}));

  return { status: res.status, data };
}

// Extrair valores do contador da MovingPay
function extrairResumo(payload) {
  const contador = payload?.contador;
  if (!contador) {
    return { total_amount: 0, count_nsu: 0 };
  }

  const aprovadas = contador.aprovadas || {};
  const valor = Number(aprovadas.valor || 0); // já em centavos
  const quantidade = Number(aprovadas.quantidade || 0);

  return {
    total_amount: valor,
    count_nsu: quantidade,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  if (!AUTH_EMAIL || !AUTH_PASSWORD) {
    return res.status(500).json({
      message: 'Credenciais MOVINGPAY_AUTH_EMAIL/PASSWORD não configuradas no Vercel.',
    });
  }

  const { customerId, startDate, endDate } = req.body || {};

  try {
    // 1. Gerar token com customer header
    const auth = await gerarToken(customerId);

    if (!auth.token) {
      return res.status(401).json({
        message: 'Não foi possível gerar token via /acessar.',
        accessStatus: auth.status,
        accessData: auth.data,
      });
    }

    // 2. Consultar resumo com token fresco
    const resumo = await consultarResumo(auth.token, customerId, startDate, endDate);

    if (resumo.status !== 200) {
      // Tentar sem customer header (consulta global)
      const resumoGlobal = await consultarResumo(auth.token, null, startDate, endDate);
      if (resumoGlobal.status === 200) {
        const valores = extrairResumo(resumoGlobal.data);
        return res.status(200).json([{
          customers_id: customerId,
          ...valores,
          _source: 'api-global',
          _tokenStatus: auth.status,
        }]);
      }

      return res.status(resumo.status).json({
        message: `API retornou ${resumo.status}`,
        error: resumo.data?.message || resumo.data?.mensagem || 'Erro desconhecido',
        _tokenGenerated: true,
        _tokenStatus: auth.status,
      });
    }

    // 3. Extrair dados do contador
    const valores = extrairResumo(resumo.data);

    return res.status(200).json([{
      customers_id: customerId,
      ...valores,
      _source: 'api',
      _tokenStatus: auth.status,
    }]);

  } catch (err) {
    return res.status(500).json({
      message: 'Erro ao consultar MovingPay.',
      error: err.message,
    });
  }
}
