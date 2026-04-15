import { useEffect, useRef, useState } from 'react';
import { formatCurrency, formatNumber } from '../../utils/formatters';

function useAnimatedValue(target, duration = 900) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const numTarget = Number(target || 0);
    fromRef.current = display;
    startRef.current = null;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const step = (timestamp) => {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(fromRef.current + (numTarget - fromRef.current) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(numTarget);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

function MetricCard({ title, value, type = 'number' }) {
  const animatedValue = useAnimatedValue(value);

  let formattedValue = type === 'currency'
    ? formatCurrency(animatedValue)
    : formatNumber(Math.round(animatedValue));

  if (/vendas/i.test(title)) {
    formattedValue = `${formatNumber(Math.round(animatedValue))} Vendas`;
  }

  return (
    <article className="metric-card fade-up">
      <p className="metric-card__title">{title}</p>
      <strong className="metric-card__value">{formattedValue}</strong>
    </article>
  );
}

export default MetricCard;
