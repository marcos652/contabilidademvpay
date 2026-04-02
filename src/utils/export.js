import * as XLSX from 'xlsx';

const formatCurrencyBr = (value) => {
  return Number(value || 0);
};

const buildSheetRows = ({ range, summary, customerHeader, reportRows = [] }) => {
  if (reportRows.length > 0) {
    return [
      ['', 'Movingpay', '', ''],
      ['Clientes', 'N Cliente', 'Transacoes', 'Valores'],
      ...reportRows.map((row) => [
        row.name,
        Number(row.id) || 0,
        Number(row.transactions) || 0,
        formatCurrencyBr(row.amount || 0),
      ]),
    ];
  }

  const id =
    range?.codigoUnidadeNegocios && range.codigoUnidadeNegocios !== '0'
      ? range.codigoUnidadeNegocios
      : customerHeader || '0';
  const clientLabel =
    customerHeader && customerHeader !== '0'
      ? `CLIENTE ${String(customerHeader).toUpperCase()}`
      : 'TODOS';

  return [
    ['', 'Movingpay', '', ''],
    ['Clientes', 'N Cliente', 'Transacoes', 'Valores'],
    [
      clientLabel,
      Number(id) || 0,
      Number(summary?.totalTransactions) || 0,
      formatCurrencyBr(summary?.totalAmount || 0),
    ],
  ];
};

export const exportSalesExcel = ({ range, summary, customerHeader, reportRows }) => {
  const rows = buildSheetRows({ range, summary, customerHeader, reportRows });
  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 40 },
    { wch: 12 },
    { wch: 14 },
    { wch: 16 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatorio');
  XLSX.writeFile(workbook, `relatorio-movingpay-${new Date().toISOString().slice(0, 10)}.xlsx`);
};
