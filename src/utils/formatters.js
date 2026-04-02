const formatNumber = (value) => new Intl.NumberFormat('pt-BR').format(Number(value || 0));

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));

const formatDateLabel = (isoDate) => {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}`;
};

export { formatNumber, formatCurrency, formatDateLabel };
