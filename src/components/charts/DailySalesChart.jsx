import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatDateLabel } from '../../utils/formatters';

function DailySalesChart({ data }) {
  return (
    <section className="chart-card fade-up">
      <div className="chart-card__header">
        <h2>Vendas por dia</h2>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} />
            <YAxis tickFormatter={(value) => `R$ ${Math.round(value / 1000)}k`} />
            <Tooltip
              formatter={(value) => formatCurrency(value)}
              labelFormatter={(label) => `Dia ${formatDateLabel(label)}`}
            />
            <Legend />
            <Bar dataKey="amount" fill="var(--accent)" radius={[8, 8, 2, 2]} name="Valor movimentado" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default DailySalesChart;
