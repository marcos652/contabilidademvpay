import React from 'react';

function CustomerTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="console-empty">Nenhum cliente encontrado.</p>;
  }

  return (
    <div className="customer-table-wrap">
      <table className="customer-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>ID</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className={idx % 2 === 0 ? 'even' : 'odd'}>
              <td>{row.name}</td>
              <td>{row.id}</td>
              <td style={{ textAlign: 'right' }}>
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(Number(row.amount || 0))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default CustomerTable;
