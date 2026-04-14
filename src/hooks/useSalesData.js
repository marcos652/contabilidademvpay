import { useCallback, useRef, useState } from 'react';
import { getMysqlSummary, getSalesSummary } from '../services/salesService';
import { SUBACQUIRERS } from '../constants/subacquirers';

function formatDateRange(date, isEnd = false) {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${isEnd ? '23:59:59' : '00:00:00'}`;
}

const BATCH_SIZE = 10;

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

// Tenta MySQL como fonte primária, cai para MovingPay API se falhar
async function fetchWithFallback({ customerId, startDate, endDate, signal }) {
  try {
    const result = await getMysqlSummary({ customerId, startDate, endDate });
    // MySQL retorna array, pega o primeiro resultado
    const row = Array.isArray(result) ? result[0] || {} : result || {};
    return {
      count_nsu: Number(row.count_nsu || 0),
      total_amount: Number(row.total_amount || 0),
      source: 'mysql',
    };
  } catch (mysqlErr) {
    console.warn('MySQL falhou, tentando MovingPay API:', mysqlErr.message);
    // Fallback: usa a API MovingPay
    try {
      const apiResult = await getSalesSummary({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        customerHeader: String(customerId),
        signal,
      });
      return {
        count_nsu: apiResult.summary?.totalTransactions || 0,
        // API já retorna em reais, converter para centavos para manter consistência
        total_amount: (apiResult.summary?.totalAmount || 0) * 100,
        source: 'api',
      };
    } catch (apiErr) {
      // Se a API também falhou (498, etc), retorna zeros com erro
      console.warn('API MovingPay também falhou:', apiErr.message);
      return {
        count_nsu: 0,
        total_amount: 0,
        source: 'error',
        errorMessage: apiErr.message || 'Sem acesso via API',
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
