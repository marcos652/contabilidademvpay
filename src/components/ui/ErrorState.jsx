function ErrorState({ message, onRetry }) {
  return (
    <div className="feedback feedback--error" role="alert">
      <p>{message}</p>
      <button type="button" className="btn btn--secondary" onClick={onRetry}>
        Tentar novamente
      </button>
    </div>
  );
}

export default ErrorState;
