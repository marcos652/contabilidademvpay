import DateRangeFilter from '../components/ui/DateRangeFilter';
import MetricCard from '../components/ui/MetricCard';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import CustomerTable from '../components/ui/CustomerTable';
// import DailySalesChart from '../components/charts/DailySalesChart';
import useSalesData from '../hooks/useSalesData';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Button } from '../components/ui/Button';
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


  // Exportação XLSX fiel à especificação
  const handleExportXLSX = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatório');

    // Título
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Movingpay';
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF60A5FA' } };

    // Cabeçalho
    const headerRow = sheet.addRow(['Clientes', 'Nº Cliente', 'Transações', 'Valores']);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : colNumber === 4 ? 'right' : 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9F99D' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Corpo da tabela
    reportRows.forEach((row, idx) => {
      const excelRow = sheet.addRow([
        row.name,
        row.id,
        row.transactions,
        row.amount,
      ]);
      // Zebra
      const isEven = idx % 2 === 1;
      excelRow.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 ? 'left' : colNumber === 4 ? 'right' : 'center',
        };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }
        if (colNumber === 4) {
          cell.numFmt = 'R$ #,##0.00';
        }
      });
    });

    // Ajuste automático de largura
    sheet.columns.forEach((col) => {
      let maxLength = 0;
      col.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value ? cell.value.toString() : '';
        maxLength = Math.max(maxLength, value.length);
      });
      col.width = maxLength + 4;
    });

    // Salvar arquivo
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'relatorio_movingpay.xlsx');
  };

  // Exportação CSV (ponto e vírgula)
  const handleExportCSV = () => {
    const header = ['Clientes', 'Nº Cliente', 'Transações', 'Valores'];
    const rows = reportRows.map(row => [
      `"${row.name}"`,
      row.id,
      row.transactions,
      `"${row.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}"`
    ]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'relatorio_movingpay.csv');
  };

  // Exportação JSON
  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(reportRows, null, 2)], { type: 'application/json' });
    saveAs(blob, 'relatorio_movingpay.json');
  };

  // Interface de exportação
  const ExportMenu = () => (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      <Button variant="outline" onClick={handleExportXLSX}>Exportar XLSX</Button>
      <Button variant="outline" onClick={handleExportCSV}>Exportar CSV</Button>
      <Button variant="outline" onClick={handleExportJSON}>Exportar JSON</Button>
    </div>
  );

  return (
    <section className="dashboard">
      <ExportMenu />
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
      {/* Exibir tabela mensal ao invés de gráfico diário */}
      {!loading && hasSearched && !error && dailySeries.length > 0 && (
        <section className="console-panel fade-up">
          <div className="console-panel__header">
            <h3>Resumo mensal</h3>
          </div>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Mês/Ano</th>
                  <th>Customer ID</th>
                  <th>Transações</th>
                  <th>Valor Total</th>
                </tr>
              </thead>
              <tbody>
                {dailySeries.map((row, idx) => (
                  <tr key={idx}>
                    <td>{row.mes_ano}</td>
                    <td>{row.customers_id}</td>
                    <td>{row.countNsu}</td>
                    <td>{row.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {!loading && hasSearched && !error && dailySeries.length === 0 && (
        <section className="console-panel fade-up">
          <div className="console-panel__header">
            <h3>Console de Consulta</h3>
            <span className="console-badge">{isBatchMode ? 'Relatorio em lote' : 'Modo resumo'}</span>
          </div>
          {isBatchMode ? (
            <CustomerTable rows={reportRows} />
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
