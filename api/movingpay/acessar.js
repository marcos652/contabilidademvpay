const readEnv = (keys, fallback = '') => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return fallback;
};

const MOVINGPAY_BASE_URL = readEnv(
  ['MOVINGPAY_API_BASE_URL', 'URL_BASE_API_MOVINGPAY', 'URL_base_da_API_VITE_MOVINGPAY', 'VITE_MOVINGPAY_API_BASE_URL'],
  'https://api.movingpay.com.br',
);

const MOVINGPAY_ACCESS_PATH = readEnv(
  ['MOVINGPAY_ACCESS_PATH', 'VITE_MOVINGPAY_ACCESS_PATH'],
  '/api/v3/acessar',
);

const MOVINGPAY_ACCESS_METHOD = readEnv(
  ['MOVINGPAY_ACCESS_METHOD', 'METODO_DE_ACESSO_MOVINGPAY', 'MÃ‰TODO_DE_ACESSO_MOVINGPAY', 'VITE_MOVINGPAY_ACCESS_METHOD'],
  'POST',
).toUpperCase();

const MOVINGPAY_AUTH_EMAIL = readEnv(
  ['MOVINGPAY_AUTH_EMAIL', 'EMAIL_DE_AUTENTICACAO_MOVINGPAY', 'EMAIL_DE_AUTENTICAÃ‡ÃƒO_MOVINGPAY', 'VITE_MOVINGPAY_AUTH_EMAIL'],
  '',
);

const MOVINGPAY_AUTH_PASSWORD = readEnv(
  ['MOVINGPAY_AUTH_PASSWORD', 'SENHA_DE_AUTENTICACAO_MOVINGPAY', 'SENHA_DE_AUTENTICAÃ‡ÃƒO_MOVINGPAY', 'VITE_MOVINGPAY_AUTH_PASSWORD'],
  '',
);

const MOVINGPAY_STATIC_TOKEN = readEnv(
  ['MOVINGPAY_API_TOKEN', 'VITE_MOVINGPAY_API_TOKEN'],
  '',
);

const pickText = (object, fields) => {
  for (const field of fields) {
    if (object?.[field] !== undefined && object?.[field] !== null && object?.[field] !== '') {
      return String(object[field]);
    }
  }
  return '';
};

const resolveAuthToken = (payload) => {
  return (
    pickText(payload, ['token', 'access_token', 'jwt']) ||
    pickText(payload?.data, ['token', 'access_token', 'jwt']) ||
    pickText(payload?.result, ['token', 'access_token', 'jwt']) ||
    pickText(payload?.auth, ['token', 'access_token', 'jwt']) ||
    (typeof payload?.data === 'string' ? payload.data : '')
  );
};

const canRefresh = () => Boolean(MOVINGPAY_AUTH_EMAIL && MOVINGPAY_AUTH_PASSWORD);

const buildRefreshUrl = () => {
  const url = new URL(MOVINGPAY_ACCESS_PATH, MOVINGPAY_BASE_URL);
  url.searchParams.set('email', MOVINGPAY_AUTH_EMAIL);
  url.searchParams.set('password', MOVINGPAY_AUTH_PASSWORD);
  return url.toString();
};

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  if (!canRefresh()) {
    return res.status(500).json({
      message: 'Credenciais de acesso nao configuradas para /acessar.',
      token: '',
    });
  }

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (MOVINGPAY_STATIC_TOKEN) {
      headers.Authorization = `Bearer ${MOVINGPAY_STATIC_TOKEN}`;
    }
    const customer = req.headers.customer;
    if (customer) {
      headers.customer = String(customer);
    }

    const upstream = await fetch(buildRefreshUrl(), {
      method: MOVINGPAY_ACCESS_METHOD,
      headers,
      body: MOVINGPAY_ACCESS_METHOD === 'POST' ? JSON.stringify({}) : undefined,
    });

    const text = await upstream.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text || 'Resposta invalida da rota /acessar.' };
    }

    const token = resolveAuthToken(payload);

    return res.status(upstream.status).json({
      status: upstream.status,
      token,
      payload,
      message: token ? 'Token gerado com sucesso.' : 'Rota /acessar chamada sem token valido.',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Falha ao chamar /acessar no backend.',
      token: '',
      error: String(error?.message || error),
    });
  }
}

