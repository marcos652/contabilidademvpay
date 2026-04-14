import { LOGO_BASE64 } from '../assets/logo';

function Header({ theme, onToggleTheme, userEmail, onLogout }) {
  return (
    <header className="header">
      <div className="header__title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <img
          src={LOGO_BASE64}
          alt="MovingPay"
          style={{ width: '36px', height: '36px', objectFit: 'contain' }}
        />
        <div>
          <p className="eyebrow">MovingPay</p>
          <h1>Dashboard de Vendas</h1>
        </div>
      </div>
      <div className="header__actions">
        <span className="source-tag" style={{ 
          background: 'var(--accent-soft)', 
          padding: '5px 14px', 
          borderRadius: '999px',
          fontSize: '0.78rem',
          fontWeight: 600,
          border: '1px solid var(--tag-border)',
          color: 'var(--text-secondary)'
        }}>
          {userEmail || 'Usuário autenticado'}
        </span>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onToggleTheme}
          style={{ padding: '8px 14px', fontSize: '0.8rem', gap: '6px', display: 'flex', alignItems: 'center' }}
        >
          {theme === 'light' ? '🌙' : '☀️'} {theme === 'light' ? 'Escuro' : 'Claro'}
        </button>
        <button
          type="button"
          className="btn btn--secondary"
          onClick={onLogout}
          style={{ padding: '8px 14px', fontSize: '0.8rem' }}
        >
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
