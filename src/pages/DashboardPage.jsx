import DateRangeFilter from '../components/ui/DateRangeFilter';
import MetricCard from '../components/ui/MetricCard';
import LoadingState from '../components/ui/LoadingState';
import ErrorState from '../components/ui/ErrorState';
import CustomerTable from '../components/ui/CustomerTable';
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

  // Helper: formatar valor monetário
  const fmtCurrency = (v) =>
    Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtNumber = (v) =>
    Number(v || 0).toLocaleString('pt-BR');

  // Helper: gerar linhas exportáveis para qualquer modo
  const getExportableRows = () => {
    // Modo batch — usar reportRows diretamente
    if (reportRows && reportRows.length > 0) {
      return reportRows.map(row => ({
        name: row.name,
        id: row.id,
        transactions: row.transactions,
        amount: row.amount,
      }));
    }
    // Modo dailySeries (array de meses)
    if (dailySeries && dailySeries.length > 0) {
      return dailySeries.map(row => ({
        name: row.mes_ano || '-',
        id: row.customers_id || selectedCustomerHeader,
        transactions: row.countNsu,
        amount: row.totalAmount,
      }));
    }
    // Modo resumo (1 customer)
    if (summary && (summary.totalAmount || summary.totalTransactions)) {
      const sub = getSubacquirerById(selectedCustomerHeader);
      return [{
        name: sub?.name || `ID ${selectedCustomerHeader}`,
        id: Number(selectedCustomerHeader) || 0,
        transactions: summary.totalTransactions,
        amount: summary.totalAmount,
      }];
    }
    return [];
  };

  const hasExportData = hasSearched && !error && !loading &&
    (
      (reportRows && reportRows.length > 0) ||
      (dailySeries && dailySeries.length > 0) ||
      (summary && (summary.totalAmount > 0 || summary.totalTransactions > 0))
    );

  // Exportação XLSX fiel à especificação
  const handleExportXLSX = async () => {
    const rows = getExportableRows();
    if (rows.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Relatório');

    // Título
    sheet.mergeCells('A1:D1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Movingpay';
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };

    // Cabeçalho
    const headerRow = sheet.addRow(['Clientes', 'Nº Cliente', 'Transações', 'Valores']);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : colNumber === 4 ? 'right' : 'center' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Corpo da tabela
    rows.forEach((row, idx) => {
      const excelRow = sheet.addRow([
        row.name,
        row.id,
        row.transactions,
        row.amount,
      ]);
      const isEven = idx % 2 === 1;
      excelRow.eachCell((cell, colNumber) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 ? 'left' : colNumber === 4 ? 'right' : 'center',
        };
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FC' } };
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

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), 'relatorio_movingpay.xlsx');
  };

  // Exportação CSV (ponto e vírgula)
  const handleExportCSV = () => {
    const rows = getExportableRows();
    if (rows.length === 0) return;

    const header = ['Clientes', 'Nº Cliente', 'Transações', 'Valores'];
    const csvRows = rows.map(row => [
      `"${row.name}"`,
      row.id,
      row.transactions,
      `"${row.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}"`
    ]);
    const csv = [header, ...csvRows].map(r => r.join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'relatorio_movingpay.csv');
  };

  // Exportação JSON
  const handleExportJSON = () => {
    const rows = getExportableRows();
    if (rows.length === 0) return;

    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    saveAs(blob, 'relatorio_movingpay.json');
  };

  // Função auxiliar para renderizar o painel de consulta
  function renderConsultaPanel() {
    try {
      // Modo com dailySeries (múltiplos meses/clientes retornados como array)
      if (dailySeries && dailySeries.length > 0) {
        return (
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
                    <td>{fmtNumber(row.countNsu)}</td>
                    <td>{fmtCurrency(row.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      // Modo lote (batch) — tabela de relatório por customer
      if (isBatchMode) {
        return reportRows && reportRows.length > 0 ? (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Nº Cliente</th>
                  <th>Transações</th>
                  <th>Valor Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>
                      <span style={{
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        borderRadius: '999px',
                        padding: '2px 10px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                      }}>
                        {row.id}
                      </span>
                    </td>
                    <td>{fmtNumber(row.transactions)}</td>
                    <td style={{ fontWeight: 600 }}>{fmtCurrency(row.amount)}</td>
                    <td>
                      <span className={row.status === 'ok' ? 'status-ok' : 'status-error'}>
                        {row.status === 'ok' ? '✓ OK' : row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="console-empty">Nenhum resultado encontrado.</p>
        );
      }

      // Modo resumo — exibir no formato de tabela com os campos como relatório
      if (summary && (summary.totalAmount || summary.totalTransactions)) {
        return (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Customer</td>
                  <td>
                    <span style={{
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      borderRadius: '999px',
                      padding: '2px 10px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                    }}>
                      {selectedCustomerLabel}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Total de Vendas</td>
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>{fmtNumber(summary.totalSales)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Transações (NSU)</td>
                  <td style={{ fontWeight: 700, fontSize: '1rem' }}>{fmtNumber(summary.totalTransactions)}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Valor Movimentado</td>
                  <td style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--accent)' }}>
                    {fmtCurrency(summary.totalAmount)}
                  </td>
                </tr>
                {range?.startDate && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>Período</td>
                    <td>
                      {new Date(range.startDate).toLocaleDateString('pt-BR')} — {new Date(range.endDate).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      // Fallback: request logs
      if (requestLogs && requestLogs[0]) {
        return (
          <div className="report-table-wrap">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Campo</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Chamada</td>
                  <td>{requestLogs[0].route}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Status HTTP</td>
                  <td>
                    <span className={requestLogs[0].httpStatus < 400 ? 'status-ok' : 'status-error'}>
                      {requestLogs[0].httpStatus}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Customer</td>
                  <td>{requestLogs[0].customerHeader || '-'}</td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Token</td>
                  <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem' }}>
                    {requestLogs[0].tokenSource || '-'}
                  </td>
                </tr>
                {requestLogs[0].accessMessage && (
                  <tr>
                    <td style={{ fontWeight: 600 }}>Mensagem Acesso</td>
                    <td>{requestLogs[0].accessMessage}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      return <p className="console-empty">Nenhum resultado encontrado.</p>;
    } catch (e) {
      return <p className="console-empty">Erro ao exibir dados. Tente novamente.</p>;
    }
  }

  // Interface de exportação
  const ExportMenu = () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button variant="outline" onClick={handleExportXLSX}>📊 XLSX</Button>
      <Button variant="outline" onClick={handleExportCSV}>📄 CSV</Button>
      <Button variant="outline" onClick={handleExportJSON}>🔧 JSON</Button>
    </div>
  );

  return (
    <section className="dashboard">
      <DateRangeFilter
        range={range}
        onApply={applyRange}
        onCancel={cancelRequest}
        disabled={loading}
        loading={loading}
      />

      {loading && <LoadingState />}
      {!loading && hasSearched && error && <ErrorState message={error} onRetry={reload} />}

      {/* Painel de resultado após busca */}
      {!loading && hasSearched && !error && (
        <section className="console-panel fade-up">
          <div className="console-panel__header">
            <h3>Console de Consulta</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="console-badge">{isBatchMode ? 'Relatório em lote' : 'Modo resumo'}</span>
              {hasExportData && <ExportMenu />}
            </div>
          </div>
          {renderConsultaPanel()}

          {/* Summary cards quando tiver dados */}
          {summary && (summary.totalAmount > 0 || summary.totalTransactions > 0) && (
            <div className="metrics-grid" style={{ marginTop: '16px' }}>
              <MetricCard title="Total Transações" value={summary.totalTransactions} type="number" />
              <MetricCard title="Valor Movimentado" value={summary.totalAmount} type="currency" />
              <MetricCard title="Total Vendas" value={summary.totalSales} type="number" />
            </div>
          )}
        </section>
      )}

      {!loading && !hasSearched && (
        <section className="console-panel fade-up">
          <div className="console-panel__header">
            <h3>Console de Consulta</h3>
            <span className="console-badge">Aguardando</span>
          </div>
          <p className="console-empty">
            Selecione o período, marque os IDs desejados e clique em <strong>Aplicar filtro</strong>.
          </p>
        </section>
      )}
    </section>
  );
}

export default DashboardPage;
