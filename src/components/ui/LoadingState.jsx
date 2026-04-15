function LoadingState() {
  return (
    <div className="dashboard fade-up" role="status" aria-live="polite">
      {/* Skeleton metric cards */}
      <div className="metrics-grid">
        {[1, 2, 3].map((i) => (
          <article key={i} className="metric-card skeleton-card">
            <div className="skeleton skeleton-text" style={{ width: '60%', height: 14 }} />
            <div className="skeleton skeleton-text" style={{ width: '80%', height: 28, marginTop: 10 }} />
          </article>
        ))}
      </div>

      {/* Skeleton console panel */}
      <section className="console-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="skeleton skeleton-text" style={{ width: 180, height: 18 }} />
          <div className="skeleton skeleton-text" style={{ width: 120, height: 28, borderRadius: 999 }} />
        </div>

        {/* Skeleton table rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton skeleton-row" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </section>
    </div>
  );
}

export default LoadingState;
