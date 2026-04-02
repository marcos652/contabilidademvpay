function Header({ theme, onToggleTheme, userEmail, onLogout }) {
  return (
    <header className="header">
      <div className="header__title">
        <p className="eyebrow">MovingPay</p>
        <h1>Dashboard de vendas mensais</h1>
      </div>
      <div className="header__actions">
        <span className="source-tag">{userEmail || 'Usuario autenticado'}</span>
        <button type="button" className="btn btn--secondary header__theme" onClick={onToggleTheme}>
          Tema: {theme === 'light' ? 'Claro' : 'Escuro'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onLogout}>
          Sair
        </button>
      </div>
    </header>
  );
}

export default Header;
