import * as React from "react";

export function Button({ children, onClick, variant = "outline", ...props }) {
  return (
    <button
      onClick={onClick}
      className={`btn btn--${variant}`}
      style={{ padding: '8px 18px', borderRadius: 6, border: '1.5px solid #60a5fa', background: variant === 'outline' ? '#fff' : '#60a5fa', color: variant === 'outline' ? '#2563eb' : '#fff', fontWeight: 600, fontSize: 15, cursor: 'pointer', marginRight: 4, transition: 'background 0.2s, color 0.2s' }}
      {...props}
    >
      {children}
    </button>
  );
}
