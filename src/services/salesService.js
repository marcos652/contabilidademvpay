
import axios from 'axios';
import apiClient from './apiClient';
// Endpoint MySQL: usa /api/mysql-summary (Vercel serverless) ou localhost para dev
const MYSQL_API_URL = import.meta.env.VITE_MYSQL_API_URL || '/api/mysql-summary';

export async function getMysqlSummary({ customerId, startDate, endDate }) {
  const response = await axios.post(MYSQL_API_URL, {
    customerId: customerId ?? null,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  });
  return response.data;
}

const ONLY_APPROVED = true;
const toQueryString = (params) => {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => search.append(key, String(item)));
      return;
    }
    search.append(key, String(value));
  });
  return search.toString();
};

const buildRequestTraceFromResponse = (response, params, customer) => {
  const headers = response?.headers || {};
  const accessMessageEncoded = headers['x-movingpay-access-message'] || '';
  let accessMessage = accessMessageEncoded;
  try {
    accessMessage = decodeURIComponent(accessMessageEncoded);
  } catch {
    accessMessage = accessMessageEncoded;
  }

  const payload = response?.data || {};
  const debugPayload = payload?.__debug || payload?.debug || {};

  return {
    route: `/api/movingpay/transacoes?${toQueryString(params)}`,
    httpStatus: response?.status || 0,
    customerHeader: customer || '',
    tokenSource: headers['x-movingpay-token-source'] || debugPayload.tokenSource || '',
    accessAttempted: headers['x-movingpay-access-attempted'] || debugPayload.accessAttempted || '',
    canRefresh: headers['x-movingpay-can-refresh'] || debugPayload.canRefresh || '',
    accessStatus: headers['x-movingpay-access-status'] || debugPayload.accessStatus || '',
    accessMessage: accessMessage || debugPayload.accessMessage || '',
    generatedToken: headers['x-movingpay-generated-token'] || debugPayload.generatedToken || '',
    at: new Date().toISOString(),
  };
};

const pad = (value) => String(value).padStart(2, '0');

const toDateKey = (date) => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};

const toApiDateTime = (date, endOfDay = false) => {
  const dateKey = toDateKey(date);
  return `${dateKey} ${endOfDay ? '23:59:59' : '00:00:00'}`;
};

const pickNumber = (object, fields) => {
  for (const field of fields) {
    if (object?.[field] !== undefined && object?.[field] !== null && object?.[field] !== '') {
      const numeric = Number(String(object[field]).replace(',', '.'));
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
  }
  return 0;
};

const pickText = (object, fields) => {
  for (const field of fields) {
    if (object?.[field] !== undefined && object?.[field] !== null && object?.[field] !== '') {
      return String(object[field]);
    }
  }
  return '';
};

const resolveTransactions = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.transacoes)) {
    return payload.transacoes;
  }

  if (Array.isArray(payload?.result)) {
    return payload.result;
  }

  return [];
};

const extractDateFromTransaction = (transaction) => {
  const rawDate = pickText(transaction, [
    'start_date',
    'data_transacao',
    'created_at',
    'capture_date',
    'data',
  ]);

  if (!rawDate) {
    return '';
  }

  return rawDate.slice(0, 10);
};

const normalizeTransaction = (transaction) => {
  const amount = pickNumber(transaction, [
    'valor_liquido',
    'valor_bruto',
    'valor',
    'amount',
    'value',
    'total',
  ]);

  const nsu = pickText(transaction, ['nsu', 'NSU', 'codigo_nsu', 'numero_nsu', 'tid']);
  const date = extractDateFromTransaction(transaction);

  return {
    date,
    amount,
    nsu,
  };
};

const createDailySeries = (startDate, endDate, transactions) => {
  const grouped = new Map();

  transactions.forEach((transaction) => {
    if (!transaction.date) {
      return;
    }

    if (!grouped.has(transaction.date)) {
      grouped.set(transaction.date, {
        date: transaction.date,
        amount: 0,
        nsuSet: new Set(),
        count: 0,
      });
    }

    const current = grouped.get(transaction.date);
    current.amount += transaction.amount;
    current.count += 1;
    if (transaction.nsu) {
      current.nsuSet.add(transaction.nsu);
    }
  });

  const dailySeries = [];
  const cursor = new Date(startDate);
  const limit = new Date(endDate);

  while (cursor <= limit) {
    const dayKey = toDateKey(cursor);
    const existing = grouped.get(dayKey);

    if (existing) {
      dailySeries.push({
        date: dayKey,
        amount: Number(existing.amount.toFixed(2)),
        nsu: existing.nsuSet.size,
        count: existing.count,
      });
    } else {
      dailySeries.push({
        date: dayKey,
        amount: 0,
        nsu: 0,
        count: 0,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return dailySeries;
};

const buildSummary = (dailySeries) => {
  return dailySeries.reduce(
    (acc, day) => {
      acc.totalSales += day.count;
      acc.totalTransactions += day.nsu;
      acc.totalAmount += day.amount;
      return acc;
    },
    {
      totalSales: 0,
      totalTransactions: 0,
      totalAmount: 0,
    },
  );
};

const normalizeMoneyFromApi = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  // No resumo da MovingPay, os valores chegam em centavos.
  return Number((numeric / 100).toFixed(2));
};

const buildSummaryFromContador = (contador) => {
  if (!contador || typeof contador !== 'object') {
    return null;
  }

  if (ONLY_APPROVED) {
    const approved = contador.aprovadas || {};
    const approvedAmount = normalizeMoneyFromApi(approved.valor);
    const approvedCount = Number(approved.quantidade || 0);

    return {
      totalSales: approvedCount,
      totalTransactions: approvedCount,
      totalAmount: Number(approvedAmount.toFixed(2)),
    };
  }

  let totalAmount = 0;
  let totalCount = 0;

  Object.values(contador).forEach((statusItem) => {
    totalAmount += normalizeMoneyFromApi(statusItem?.valor);
    totalCount += Number(statusItem?.quantidade || 0);
  });

  return {
    totalSales: totalCount,
    totalTransactions: totalCount,
    totalAmount: Number(totalAmount.toFixed(2)),
  };
};

const buildCounterBreakdown = (contador) => {
  if (!contador || typeof contador !== 'object') {
    return [];
  }

  if (ONLY_APPROVED) {
    const approved = contador.aprovadas || {};
    return [
      {
        status: 'aprovadas',
        quantity: Number(approved.quantidade || 0),
        amount: normalizeMoneyFromApi(approved.valor),
      },
    ];
  }

  return Object.entries(contador).map(([status, statusItem]) => ({
    status,
    quantity: Number(statusItem?.quantidade || 0),
    amount: normalizeMoneyFromApi(statusItem?.valor),
  }));
};

const normalizeCodigoUnidadeNegocios = (value) => {
  const input = String(value ?? '').trim();

  if (!input || input === '0') {
    return '0';
  }

  if (!/^[0-9]+$/.test(input)) {
    return '0';
  }

  return input;
};

const normalizeCustomerHeader = (value, codigoUnidadeNegocios) => {
  const input = String(value ?? '').trim();
  if (input) {
    if (/^[0-9]+$/.test(input)) return String(Number(input));
    return '';
  }

  const unitCode = normalizeCodigoUnidadeNegocios(codigoUnidadeNegocios);
  if (unitCode !== '0') {
    return String(Number(unitCode));
  }

  return '';
};

const buildParams = (startDate, endDate, page, codigoUnidadeNegocios) => {
  const unitCode = normalizeCodigoUnidadeNegocios(codigoUnidadeNegocios);

  return {
    start_date: toApiDateTime(startDate, false),
    finish_date: toApiDateTime(endDate, true),
    'Situacao[]': 'APPR',
    Bandeira: '',
    Adquirente: '',
    TipoTransacao: '',
    capture_method: '',
    payment_method: '',
    capture_partner: '',
    split_rules: '',
    not_show_deleted_at: 1,
    resolucao_adquirente: '',
    page,
    orderby: 'start_date,desc',
    limit: 50,
    opcoes: 'resumo',
    codigoUnidadeNegocios: unitCode,
  };
};

async function fetchSalesPayload(
  startDate,
  endDate,
  codigoUnidadeNegocios,
  customerHeader,
  signal,
) {
  const customer = normalizeCustomerHeader(customerHeader, codigoUnidadeNegocios);
  const params = buildParams(startDate, endDate, 1, codigoUnidadeNegocios);

  let accessResponse = null;
  try {
    accessResponse = await apiClient.post(
      '/acessar',
      {},
      {
        headers: customer ? { customer } : undefined,
        signal,
      },
    );
  } catch (error) {
    accessResponse = error?.response || null;
  }

  const response = await apiClient.get('/transacoes', {
    params,
    headers: customer ? { customer } : undefined,
    signal,
  });

  const requestTrace = buildRequestTraceFromResponse(response, params, customer);
  if (accessResponse) {
    requestTrace.accessRoute = '/api/movingpay/acessar';
    requestTrace.accessHttpStatus = accessResponse?.status || 0;
    requestTrace.generatedToken =
      accessResponse?.data?.token || requestTrace.generatedToken || accessResponse?.data?.payload?.token || '';
  }

  return {
    payload: response?.data,
    requestTrace,
  };
}

export async function getSalesSummary({
  startDate,
  endDate,
  codigoUnidadeNegocios = '0',
  customerHeader = '',
  signal,
}) {
  try {
    if (!normalizeCustomerHeader(customerHeader, codigoUnidadeNegocios)) {
      throw new Error(
        'Informe o Customer (header) ou um Codigo Unidade Negocios diferente de 0 para a consulta.',
      );
    }

    const result = await fetchSalesPayload(
      startDate,
      endDate,
      codigoUnidadeNegocios,
      customerHeader,
      signal,
    );
    const payload = result.payload;
    const summaryFromContador = buildSummaryFromContador(payload?.contador);

    if (summaryFromContador) {
      return {
        summary: summaryFromContador,
        dailySeries: [],
        counterBreakdown: buildCounterBreakdown(payload?.contador),
        source: 'api',
        requestTrace: result.requestTrace,
      };
    }

    const transactions = resolveTransactions(payload);
    const normalized = transactions.map(normalizeTransaction).filter((item) => item.date);

    const dailySeries = createDailySeries(startDate, endDate, normalized);
    const summary = buildSummary(dailySeries);

    return {
      summary,
      dailySeries,
      counterBreakdown: [],
      source: 'api',
      requestTrace: result.requestTrace,
    };
  } catch (error) {
    if (error?.code === 'ERR_CANCELED' || error?.name === 'CanceledError') {
      throw new Error('Consulta cancelada pelo usuario.');
    }

    const statusCode = error.response?.status;
    const apiMessage = error.response?.data?.message || error.response?.data?.mensagem;
    const requestTrace = error.response
      ? buildRequestTraceFromResponse(
          error.response,
          buildParams(startDate, endDate, 1, codigoUnidadeNegocios),
          normalizeCustomerHeader(customerHeader, codigoUnidadeNegocios),
        )
      : null;

    if (statusCode === 498 && apiMessage === 'CUSTOMER_ACCOUNT_MULTIPLE') {
      const nextError = new Error(
        'API retornou 498 (CUSTOMER_ACCOUNT_MULTIPLE). O token atual nao possui acesso/escopo para as contas da subadquirente selecionadas. Gere um novo token com esse escopo e tente novamente.',
      );
      nextError.requestTrace = requestTrace;
      throw nextError;
    }
    if (statusCode === 498 && apiMessage === 'account access deniedy') {
      const nextError = new Error(
        'API retornou 498 (account access denied). O token atual nao tem acesso a essa unidade/conta. Use codigoUnidadeNegocios permitido para seu usuario ou solicite liberacao no MovingPay.',
      );
      nextError.requestTrace = requestTrace;
      throw nextError;
    }

    const nextError = new Error(
      apiMessage ||
        error.response?.data?.erro ||
        'Nao foi possivel carregar os dados da API MovingPay.',
    );
    nextError.requestTrace = requestTrace;
    throw nextError;
  }
}
