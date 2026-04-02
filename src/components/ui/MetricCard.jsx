import { formatCurrency, formatNumber } from '../../utils/formatters';

function MetricCard({ title, value, type = 'number' }) {
  const formattedValue = type === 'currency' ? formatCurrency(value) : formatNumber(value);

  return (
    <article className="metric-card fade-up">
      <p className="metric-card__title">{title}</p>
      <strong className="metric-card__value">{formattedValue}</strong>
    </article>
  );
}

export default MetricCard;
