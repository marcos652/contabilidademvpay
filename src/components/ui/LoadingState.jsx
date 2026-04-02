function LoadingState() {
  return (
    <div className="feedback feedback--loading" role="status" aria-live="polite">
      <span className="spinner" />
      <span>Carregando dados de vendas...</span>
    </div>
  );
}

export default LoadingState;
