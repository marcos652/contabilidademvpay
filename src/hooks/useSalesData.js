import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { getMysqlSummary } from '../services/salesService';
import { firebaseAuth } from '../services/firebase';
import { SUBACQUIRERS } from '../constants/subacquirers';

function formatDateRange(date, isEnd = false) {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${isEnd ? '23:59:59.999' : '00:00:00'}`;
}

const BATCH_SIZE = 10;

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

// Fallback via /api/resumo (gera token + consulta numa só chamada)
async function fetchViaResumoAPI({ customerId, startDate, endDate }) {
  let headers = {};
  try {
    const user = firebaseAuth.currentUser;
    if (user) {
      const idToken = await user.getIdToken();
      headers.Authorization = `Bearer ${idToken}`;
    }
  } catch (e) { /* ignora */ }

  const res = await axios.post('/api/resumo', {
    customerId: String(customerId),
    startDate,
    endDate,
  }, { headers });

  const row = Array.isArray(res.data) ? res.data[0] || {} : res.data || {};
  return {
    count_nsu: Number(row.count_nsu || 0),
    total_amount: Number(row.total_amount || 0),
    source: 'api',
  };
}

// Tenta MySQL → cai para /api/resumo (token fresco a cada chamada)
async function fetchWithFallback({ customerId, startDate, endDate }) {
  try {
    const result = await getMysqlSummary({ customerId, startDate, endDate });
    const row = Array.isArray(result) ? result[0] || {} : result || {};
    return {
      count_nsu: Number(row.count_nsu || 0),
      total_amount: Number(row.total_amount || 0),
      source: 'mysql',
    };
  } catch (mysqlErr) {
    console.warn('MySQL falhou, usando /api/resumo:', mysqlErr.message);
    try {
      return await fetchViaResumoAPI({ customerId, startDate, endDate });
    } catch (apiErr) {
      console.warn('API resumo também falhou:', apiErr.message);
      return {
        count_nsu: 0,
        total_amount: 0,
        source: 'error',
        errorMessage: apiErr.response?.data?.message || apiErr.message || 'Sem acesso',
      };
    }
  }
}

export default function useSalesData() {
  const [range, setRange] = useState(null);
  const [summary, setSummary] = useState({ totalSales: 0, totalTransactions: 0, totalAmount: 0 });
  const [dailySeries, setDailySeries] = useState([]);
  const [counterBreakdown, setCounterBreakdown] = useState([]);
  const [reportRows, setReportRows] = useState([]);
  const [requestLogs, setRequestLogs] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState('api');
  const [hasSearched, setHasSearched] = useState(false);
  const abortControllerRef = useRef(null);

  const fetchSingle = useCallback(async (nextRange, signal) => {
    const { customerHeader, startDate, endDate } = nextRange;
    const formattedStart = formatDateRange(startDate, false);
    const formattedEnd = formatDateRange(endDate, true);
    const result = await fetchWithFallback({
      customerId: customerHeader,
      startDate: formattedStart,
      endDate: formattedEnd,
      signal,
    });
    setSummary({
      totalSales: result.count_nsu,
      totalTransactions: result.count_nsu,
      totalAmount: Number((result.total_amount / 100).toFixed(2)),
    });
    setDailySeries([]);
    setCounterBreakdown([]);
    setSource(result.source);
    setReportRows([]);
    setProgress({ done: 0, total: 0 });
    setRequestLogs([]);
  }, []);

  const fetchBatchSubacquirers = useCallback(async (nextRange, customerIds, signal) => {
    const ids = customerIds
      .map((id) => String(Number(id)))
      .filter(Boolean);
    const total = ids.length;
    let done = 0;
    let totalTransactions = 0;
    let totalAmount = 0;
    let successCount = 0;
    let usedSource = 'mysql';

    setDailySeries([]);
    setCounterBreakdown([]);
    setReportRows([]);
    setRequestLogs([]);
    setProgress({ done: 0, total });

    const groups = chunkArray(ids, BATCH_SIZE);

    for (const group of groups) {
      for (const customerId of group) {
        if (signal?.aborted) {
          throw new Error('Consulta cancelada pelo usuario.');
        }

        const sub = SUBACQUIRERS.find((item) => item.id === Number(customerId));
        try {
          const formattedStart = formatDateRange(nextRange.startDate, false);
          const formattedEnd = formatDateRange(nextRange.endDate, true);
          const result = await fetchWithFallback({
            customerId,
            startDate: formattedStart,
            endDate: formattedEnd,
            signal,
          });
          if (result.source === 'api') usedSource = 'api';
          if (result.source === 'error') usedSource = 'api';
          totalTransactions += result.count_nsu;
          const amountReais = Number((result.total_amount / 100).toFixed(2));
          totalAmount += amountReais;
          successCount += 1;
          setReportRows((prev) => [
            ...prev,
            {
              id: Number(customerId),
              name: sub?.name || `ID ${customerId}`,
              transactions: result.count_nsu,
              amount: amountReais,
              status:
                result.source === 'error'
                  ? 'sem acesso'
                  : result.count_nsu === 0 && amountReais === 0
                    ? 'cliente nao transacionando'
                    : 'ok',
            },
          ]);
        } catch (err) {
          if (signal?.aborted || err?.message === 'Consulta cancelada pelo usuario.') {
            throw err;
          }

          setReportRows((prev) => [
            ...prev,
            {
              id: Number(customerId),
              name: sub?.name || `ID ${customerId}`,
              transactions: 0,
              amount: 0,
              status: err.message || 'erro',
            },
          ]);
        } finally {
          done += 1;
          setProgress({ done, total });
        }
      }
    }

    setSummary({
      totalSales: totalTransactions,
      totalTransactions,
      totalAmount: Number(totalAmount.toFixed(2)),
    });
    setSource(usedSource);
    if (successCount === 0) {
      throw new Error('Nenhum ID retornou dados validos na consulta em lote.');
    }
  }, []);

  const fetchData = useCallback(async (nextRange) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setHasSearched(true);
    setLoading(true);
    setError('');
    try {
      if (Array.isArray(nextRange.batchCustomerIds) && nextRange.batchCustomerIds.length > 1) {
        await fetchBatchSubacquirers(nextRange, nextRange.batchCustomerIds, controller.signal);
      } else {
        await fetchSingle(nextRange, controller.signal);
      }
    } catch (err) {
      if (err?.requestTrace) {
        setRequestLogs((prev) => [...prev, err.requestTrace]);
      }
      if (controller.signal.aborted) {
        setError('Consulta cancelada pelo usuario.');
      } else {
        setError(err.message);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      setLoading(false);
    }
  }, [fetchBatchSubacquirers, fetchSingle]);

  const applyRange = (nextRange) => {
    setRange(nextRange);
    fetchData(nextRange);
  };

  return {
    range,
    summary,
    dailySeries,
    counterBreakdown,
    reportRows,
    requestLogs,
    progress,
    loading,
    error,
    source,
    hasSearched,
    applyRange,
    cancelRequest: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
    reload: () => {
      if (range) {
        fetchData(range);
      }
    },
  };
}
