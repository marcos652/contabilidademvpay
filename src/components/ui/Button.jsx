import * as React from "react";

export function Button({ children, onClick, variant = "outline", ...props }) {
  const baseStyle = {
    padding: '8px 18px',
    borderRadius: 'var(--radius-sm)',
    fontWeight: 650,
    fontSize: '0.82rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
    transition: 'all 180ms ease',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  };

  const variants = {
    outline: {
      background: 'transparent',
      border: '1.5px solid var(--border-strong)',
      color: 'var(--text-secondary)',
    },
    primary: {
      background: 'var(--accent)',
      border: '1.5px solid var(--accent)',
      color: '#fff',
    },
  };

  return (
    <button
      onClick={onClick}
      className={`btn btn--${variant}`}
      style={{ ...baseStyle, ...variants[variant] }}
      {...props}
    >
      {children}
    </button>
  );
}
