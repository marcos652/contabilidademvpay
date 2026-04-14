import React from 'react';

function CustomerTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="console-empty">Nenhum cliente encontrado.</p>;
  }

  return (
    <div className="customer-checklist-horizontal">
      {rows.map((row) => (
        <div key={row.id} className="customer-checklist-horizontal-item">
          <input type="checkbox" className="customer-checklist-checkbox" disabled />
          <span className="customer-checklist-name">{row.name}</span>
          <span className="customer-checklist-id">{row.id}</span>
        </div>
      ))}
    </div>
  );
}

export default CustomerTable;
