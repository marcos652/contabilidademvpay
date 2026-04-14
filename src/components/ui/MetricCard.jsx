import { formatCurrency, formatNumber } from '../../utils/formatters';

function MetricCard({ title, value, type = 'number' }) {
  let formattedValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);
  // Adiciona sufixo 'Vendas' se o título indicar vendas
  if (/vendas/i.test(title)) {
    formattedValue = `${formattedValue} Vendas`;
  }
  return (
    <article className="metric-card fade-up">
      <p className="metric-card__title">{title}</p>
      <strong className="metric-card__value">{formattedValue}</strong>
    </article>
  );
}

export default MetricCard;
