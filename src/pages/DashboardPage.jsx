import DateRangeFilter from '../components/ui/DateRangeFilter';
import MetricCard from '../components/ui/MetricCard';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import DailySalesChart from '../components/charts/DailySalesChart';
import useSalesData from '../hooks/useSalesData';
import { exportSalesExcel } from '../utils/export';
import { getSubacquirerById } from '../constants/subacquirers';

function DashboardPage() {
  const {
    range,
    summary,
    dailySeries,
    reportRows,
    requestLogs,
    progress,
    loading,
    error,
    source,
    hasSearched,
    applyRange,
    cancelRequest,
    reload,
  } = useSalesData();

  const selectedCustomerHeader = range?.customerHeader || '-';
  const selectedBatchIds = Array.isArray(range?.batchCustomerIds) ? range.batchCustomerIds : [];
  const selectedSub = selectedCustomerHeader !== '-' ? getSubacquirerById(selectedCustomerHeader) : null;
  const isBatchMode = selectedBatchIds.length > 1;
  const isSpecificUnit = !isBatchMode && selectedCustomerHeader !== '-';
  const selectedCustomerLabel =
    isBatchMode
      ? `${selectedBatchIds.length} IDs`
      : selectedCustomerHeader !== '-'
      ? `${selectedCustomerHeader} - ${selectedSub?.name || 'NOME NAO MAPEADO'}`
      : '-';
  const scopeLabel = isBatchMode
    ? `Lote de ${selectedBatchIds.length} subs`
    : isSpecificUnit
    ? `Sub ${selectedCustomerHeader} - ${selectedSub?.name || 'NOME NAO MAPEADO'}`
    : 'Todas as subs';
  const latestRequest = [...requestLogs].reverse()[0] || null;
  const latestGeneratedToken =
    [...requestLogs].reverse().find((log) => String(log.generatedToken || '').trim())?.generatedToken || '';

  const handleExport = () => {
    exportSalesExcel({
      range,
      summary,
      customerHeader: selectedCustomerHeader === '-' ? '' : selectedCustomerHeader,
      reportRows,
    });
  };

  return (
    <section className="dashboard">
      <DateRangeFilter
        range={range}
        onApply={applyRange}
        onCancel={cancelRequest}
        disabled={loading}
        loading={loading}
      />

      <div className="metrics-grid">
        <MetricCard
          title={isSpecificUnit ? `Total de vendas da sub ${selectedCustomerHeader}` : 'Total de vendas do periodo'}
          value={summary.totalSales}
        />
        <MetricCard
          title={
            isSpecificUnit
              ? `Quantidade de transacoes da sub ${selectedCustomerHeader}`
              : 'Quantidade de transacoes (NSU)'
          }
          value={summary.totalTransactions}
        />
        <MetricCard
          title={isSpecificUnit ? `Valor da sub ${selectedCustomerHeader}` : 'Valor movimentado no periodo'}
          value={summary.totalAmount}
          type="currency"
        />
      </div>

      <div className="dashboard-toolbar fade-up">
        <p className="source-tag">
          Origem dos dados: <strong>{source === 'api' ? 'API MovingPay' : 'Modo demonstracao'}</strong>
          {' | '}
          Consulta: <strong>{scopeLabel}</strong>
          {' | '}
          Header customer: <strong>{selectedCustomerLabel}</strong>
        </p>
        {isBatchMode && (
          <p className="source-tag">
            Progresso lote: <strong>{progress.done}/{progress.total}</strong>
          </p>
        )}
        <button type="button" className="btn btn--secondary" onClick={cancelRequest} disabled={!loading}>
          Parar consulta
        </button>
        <button type="button" className="btn" onClick={handleExport} disabled={!hasSearched || loading || !!error}>
          Exportar Excel
        </button>
      </div>
      {hasSearched && (
        <section className="console-panel fade-up">
          <div className="console-panel__header">
            <h3>Token Gerado</h3>
            <span className="console-badge">/acessar</span>
          </div>
          <p className="console-log call-log">{latestGeneratedToken || 'Nenhum token novo retornado ainda.'}</p>
          {latestRequest && (
            <p className="console-log call-log">
              Acessar chamado: {latestRequest.accessAttempted || '-'} | Pode renovar: {latestRequest.canRefresh || '-'}{' '}
              | Fonte token: {latestRequest.tokenSource || '-'} | Status acesso: {latestRequest.accessStatus || '-'}
              {latestRequest.accessMessage ? ` | Msg: ${latestRequest.accessMessage}` : ''}
            </p>
          )}
        </section>
      )}

      {loading && <LoadingState />}
      {!loading && hasSearched && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && hasSearched && !error && dailySeries.length > 0 && <DailySalesChart data={dailySeries} />}
      {!loading && hasSearched && !error && dailySeries.length === 0 && (
        <section className="console-panel fade-up">
          <div className="console-panel__header">
            <h3>Console de Consulta</h3>
            <span className="console-badge">{isBatchMode ? 'Relatorio em lote' : 'Modo resumo'}</span>
          </div>
          {isBatchMode ? (
            <>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Clientes</th>
                      <th>N Cliente</th>
                      <th>Transacoes</th>
                      <th>Valores</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.id}</td>
                        <td>{row.transactions}</td>
                        <td>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(Number(row.amount || 0))}
                        </td>
                        <td>{row.status === 'ok' ? 'OK' : row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <p className="console-log">
                Dados carregados. Neste modo de consulta (`opcoes=resumo`), a API retorna apenas resumo e nao a serie por dia.
              </p>
              {requestLogs[0] && (
                <div className="console-log call-log">
                  <strong>Chamada:</strong> {requestLogs[0].route}
                  <br />
                  <strong>Status:</strong> {requestLogs[0].httpStatus} | <strong>Customer:</strong>{' '}
                  {requestLogs[0].customerHeader || '-'} | <strong>Token:</strong> {requestLogs[0].tokenSource || '-'} |
                  <strong> /acessar:</strong> {requestLogs[0].accessAttempted || '-'}
                  <br />
                  <strong>Token novo:</strong> {requestLogs[0].generatedToken || '-'}
                  {requestLogs[0].accessMessage ? (
                    <>
                      <br />
                      <strong>Mensagem acesso:</strong> {requestLogs[0].accessMessage}
                    </>
                  ) : null}
                </div>
              )}
            </>
          )}
        </section>
      )}
      {!loading && !hasSearched && (
        <section className="console-panel fade-up">
          <div className="console-panel__header">
            <h3>Console de Consulta</h3>
            <span className="console-badge">Aguardando</span>
          </div>
          <p className="console-empty">Selecione o periodo, marque os IDs desejados e clique em Aplicar filtro.</p>
        </section>
      )}
    </section>
  );
}

export default DashboardPage;
