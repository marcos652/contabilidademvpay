import { useCallback, useRef, useState } from 'react';
import { getMysqlSummary } from '../services/salesService';

function formatDateRange(date, isEnd = false) {
  if (!date) return null;
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${isEnd ? '23:59:59' : '00:00:00'}`;
}
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
    const { customerHeader, startDate, endDate } = nextRange;
    const formattedStart = formatDateRange(startDate, false);
    const formattedEnd = formatDateRange(endDate, true);
    const result = await getMysqlSummary({
      customerId: customerHeader,
      startDate: formattedStart,
      endDate: formattedEnd,
    });
    // result pode ser array ou objeto, dependendo do backend
    if (Array.isArray(result)) {
      setSummary({
        totalSales: result.reduce((acc, row) => acc + Number(row.count_nsu || 0), 0),
        totalTransactions: result.reduce((acc, row) => acc + Number(row.count_nsu || 0), 0),
        totalAmount: result.reduce((acc, row) => acc + Number(row.total_amount || 0), 0),
      });
      setDailySeries(result.map(row => ({
        mes_ano: row.mes_ano,
        totalAmount: Number(row.total_amount || 0),
        countNsu: Number(row.count_nsu || 0),
        customers_id: row.customers_id,
      })));
    } else {
      setSummary({
        totalSales: Number(result.count_nsu || 0),
        totalTransactions: Number(result.count_nsu || 0),
        totalAmount: Number(result.total_amount || 0),
      });
      setDailySeries([]);
    }
    setCounterBreakdown([]);
    setSource('mysql');
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
          const result = await getMysqlSummary({
            customerId: customerId,
            startDate: formattedStart,
            endDate: formattedEnd,
          });
          totalTransactions += Number(result.count_nsu || 0);
          totalAmount += Number(result.total_amount || 0);
          successCount += 1;
          setReportRows((prev) => [
            ...prev,
            {
              id: Number(customerId),
              name: sub?.name || `ID ${customerId}`,
              transactions: Number(result.count_nsu || 0),
              amount: Number(result.total_amount || 0),
              status:
                Number(result.count_nsu || 0) === 0 &&
                Number(result.total_amount || 0) === 0
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
    setSource('mysql');
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
