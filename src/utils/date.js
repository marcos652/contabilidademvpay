export const toInputDate = (date) => date.toISOString().slice(0, 10);

export const getCurrentMonthRange = () => {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return { startDate, endDate, codigoUnidadeNegocios: '0' };
};

export const parseDateInput = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};
