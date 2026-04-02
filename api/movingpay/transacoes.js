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
  ['MOVINGPAY_ACCESS_METHOD', 'METODO_DE_ACESSO_MOVINGPAY', 'MÉTODO_DE_ACESSO_MOVINGPAY', 'VITE_MOVINGPAY_ACCESS_METHOD'],
  'POST',
).toUpperCase();

const MOVINGPAY_AUTH_EMAIL = readEnv(
  ['MOVINGPAY_AUTH_EMAIL', 'EMAIL_DE_AUTENTICACAO_MOVINGPAY', 'EMAIL_DE_AUTENTICAÇÃO_MOVINGPAY', 'VITE_MOVINGPAY_AUTH_EMAIL'],
  '',
);

const MOVINGPAY_AUTH_PASSWORD = readEnv(
  ['MOVINGPAY_AUTH_PASSWORD', 'SENHA_DE_AUTENTICACAO_MOVINGPAY', 'SENHA_DE_AUTENTICAÇÃO_MOVINGPAY', 'VITE_MOVINGPAY_AUTH_PASSWORD'],
  '',
);

const MOVINGPAY_STATIC_TOKEN = readEnv(
  ['MOVINGPAY_API_TOKEN', 'VITE_MOVINGPAY_API_TOKEN'],
  '',
);

let cachedToken = MOVINGPAY_STATIC_TOKEN;
let cachedTokenExpiryMs = 0;
const FORCE_REFRESH_EVERY_REQUEST = true;
const REQUIRE_ACCESS_REFRESH = String(process.env.MOVINGPAY_REQUIRE_ACCESS_REFRESH || 'true') === 'true';

const pickText = (object, fields) => {
  for (const field of fields) {
    if (object?.[field] !== undefined && object?.[field] !== null && object?.[field] !== '') {
      return String(object[field]);
    }
  }
  return '';
};

const resolveAuthToken = (payload) => {
  const directToken =
    pickText(payload, ['token', 'access_token', 'jwt']) ||
    pickText(payload?.data, ['token', 'access_token', 'jwt']) ||
    pickText(payload?.result, ['token', 'access_token', 'jwt']) ||
    pickText(payload?.auth, ['token', 'access_token', 'jwt']);

  if (directToken) {
    return directToken;
  }

  if (typeof payload?.data === 'string' && payload.data.length > 20) {
    return payload.data;
  }

  return '';
};

const decodeJwtExpMs = (token) => {
  try {
    const pieces = String(token).split('.');
    if (pieces.length !== 3) return 0;
    const normalized = pieces[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(normalized, 'base64').toString('utf8');
    const payload = JSON.parse(json);
    if (!payload?.exp) return 0;
    return Number(payload.exp) * 1000;
  } catch {
    return 0;
  }
};

const setCachedToken = (token) => {
  if (!token) return;
  cachedToken = token;
  const expMs = decodeJwtExpMs(token);
  cachedTokenExpiryMs = expMs || Date.now() + 45 * 60 * 1000;
};

const hasValidCachedToken = () => {
  if (!cachedToken) return false;
  if (!cachedTokenExpiryMs) return true;
  return Date.now() < cachedTokenExpiryMs - 30_000;
};

const canRefresh = () => Boolean(MOVINGPAY_AUTH_EMAIL && MOVINGPAY_AUTH_PASSWORD);

const buildRefreshUrl = () => {
  const url = new URL(MOVINGPAY_ACCESS_PATH, MOVINGPAY_BASE_URL);
  url.searchParams.set('email', MOVINGPAY_AUTH_EMAIL);
  url.searchParams.set('password', MOVINGPAY_AUTH_PASSWORD);
  return url.toString();
};

const refreshToken = async (customer) => {
  if (!canRefresh()) {
    return { token: '', status: 0, message: 'Credenciais de acesso nao configuradas.' };
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (cachedToken) {
    headers.Authorization = `Bearer ${cachedToken}`;
  }
  if (customer) {
    headers.customer = String(customer);
  }

  const response = await fetch(buildRefreshUrl(), {
    method: MOVINGPAY_ACCESS_METHOD,
    headers,
    body: MOVINGPAY_ACCESS_METHOD === 'POST' ? JSON.stringify({}) : undefined,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    return {
      token: '',
      status: response.status,
      message: errorBody || `Falha no /acessar (HTTP ${response.status})`,
    };
  }

  const payload = await response.json();
  const nextToken = resolveAuthToken(payload);
  if (nextToken) {
    setCachedToken(nextToken);
  }
  return {
    token: nextToken,
    status: response.status,
    message: nextToken ? 'ok' : 'Resposta de /acessar sem token.',
  };
};

const ensureToken = async (customer) => {
  let refreshStatus = 0;
  let refreshMessage = '';
  let source = 'none';
  let accessAttempted = false;

  if (FORCE_REFRESH_EVERY_REQUEST && canRefresh()) {
    accessAttempted = true;
    const refreshed = await refreshToken(customer);
    refreshStatus = refreshed.status;
    refreshMessage = refreshed.message;
    if (refreshed.token) {
      source = 'access';
      return { token: refreshed.token, source, refreshStatus, refreshMessage, accessAttempted };
    }
    if (REQUIRE_ACCESS_REFRESH) {
      return { token: '', source, refreshStatus, refreshMessage, accessAttempted };
    }
  }

  if (REQUIRE_ACCESS_REFRESH && !canRefresh()) {
    refreshMessage = 'Credenciais de acesso ausentes no ambiente.';
    return { token: '', source, refreshStatus, refreshMessage, accessAttempted };
  }

  if (hasValidCachedToken()) {
    source = 'cache';
    return { token: cachedToken, source, refreshStatus, refreshMessage, accessAttempted };
  }

  if (!FORCE_REFRESH_EVERY_REQUEST && canRefresh()) {
    accessAttempted = true;
    const refreshed = await refreshToken(customer);
    refreshStatus = refreshed.status;
    refreshMessage = refreshed.message;
    if (refreshed.token) {
      source = 'access';
      return { token: refreshed.token, source, refreshStatus, refreshMessage, accessAttempted };
    }
  }

  if (MOVINGPAY_STATIC_TOKEN) {
    setCachedToken(MOVINGPAY_STATIC_TOKEN);
    source = 'static';
    return { token: MOVINGPAY_STATIC_TOKEN, source, refreshStatus, refreshMessage, accessAttempted };
  }

  return { token: '', source, refreshStatus, refreshMessage, accessAttempted };
};

const appendQueryParams = (targetUrl, query) => {
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => targetUrl.searchParams.append(key, String(item)));
      return;
    }
    targetUrl.searchParams.set(key, String(value));
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const customer = req.headers.customer;
    const authResult = await ensureToken(customer);
    const token = authResult.token;
    res.setHeader('x-movingpay-token-source', authResult.source || 'none');
    res.setHeader('x-movingpay-access-attempted', authResult.accessAttempted ? 'true' : 'false');
    res.setHeader('x-movingpay-can-refresh', canRefresh() ? 'true' : 'false');
    if (authResult.refreshStatus) {
      res.setHeader('x-movingpay-access-status', String(authResult.refreshStatus));
    }
    if (authResult.refreshMessage) {
      res.setHeader('x-movingpay-access-message', encodeURIComponent(String(authResult.refreshMessage).slice(0, 180)));
    }

    if (!token) {
      return res.status(500).json({
        message: 'Nao foi possivel gerar token na rota /acessar antes da consulta.',
        hint: 'Verifique MOVINGPAY_AUTH_EMAIL/MOVINGPAY_AUTH_PASSWORD e se o endpoint /acessar retorna token valido.',
        accessStatus: authResult.refreshStatus || null,
        accessMessage: authResult.refreshMessage || null,
      });
    }

    const upstreamUrl = new URL('/api/v3/transacoes', MOVINGPAY_BASE_URL);
    appendQueryParams(upstreamUrl, req.query);

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    if (customer) {
      headers.customer = String(customer);
    }

    let upstreamResponse = await fetch(upstreamUrl.toString(), { headers });

    if (upstreamResponse.status === 401 && canRefresh()) {
      const refreshed = await refreshToken(customer);
      if (refreshed.token) {
        headers.Authorization = `Bearer ${refreshed.token}`;
        upstreamResponse = await fetch(upstreamUrl.toString(), { headers });
      }
    }

    const body = await upstreamResponse.text();
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      payload = { message: body || 'Resposta invalida da MovingPay.' };
    }

    return res.status(upstreamResponse.status).json(payload);
  } catch (error) {
    return res.status(500).json({
      message: 'Falha ao consultar MovingPay no backend.',
      error: String(error?.message || error),
    });
  }
}
