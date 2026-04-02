import { useCallback, useRef, useState } from 'react';
import { getSalesSummary } from '../services/salesService';
import { SUBACQUIRERS } from '../constants/subacquirers';

const BATCH_SIZE = 10;

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

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
    const result = await getSalesSummary({ ...nextRange, signal });
    setSummary(result.summary);
    setDailySeries(result.dailySeries);
    setCounterBreakdown(result.counterBreakdown || []);
    setSource(result.source);
    setReportRows([]);
    setProgress({ done: 0, total: 0 });
    setRequestLogs(result.requestTrace ? [result.requestTrace] : []);
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
          const result = await getSalesSummary({
            ...nextRange,
            codigoUnidadeNegocios: '0',
            customerHeader: String(customerId),
            signal,
          });

          totalTransactions += Number(result.summary?.totalTransactions || 0);
          totalAmount += Number(result.summary?.totalAmount || 0);
          successCount += 1;

          setReportRows((prev) => [
            ...prev,
            {
              id: Number(customerId),
              name: sub?.name || `ID ${customerId}`,
              transactions: Number(result.summary?.totalTransactions || 0),
              amount: Number(result.summary?.totalAmount || 0),
              status:
                Number(result.summary?.totalTransactions || 0) === 0 &&
                Number(result.summary?.totalAmount || 0) === 0
                  ? 'cliente nao transacionando'
                  : 'ok',
            },
          ]);
          if (result.requestTrace) {
            setRequestLogs((prev) => [...prev, result.requestTrace]);
          }
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
    setSource('api');
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
