import { useMemo, useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import Header from './components/layout/Header';
import LoginPage from './pages/LoginPage';
import { useAuth } from './context/AuthContext';

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('mvpay-theme') || 'light');
  const { isAuthenticated, loadingAuth, user, logout } = useAuth();

  const appClassName = useMemo(() => `app ${theme}`, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const next = currentTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('mvpay-theme', next);
      return next;
    });
  };

  if (loadingAuth) {
    return (
      <div className={appClassName}>
        <main className="content">
          <section className="feedback feedback--loading fade-up">
            <span className="spinner" />
            <p>Validando autenticacao...</p>
          </section>
        </main>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={appClassName}>
        <main className="content">
          <LoginPage />
        </main>
      </div>
    );
  }

  return (
    <div className={appClassName}>
      <Header theme={theme} onToggleTheme={toggleTheme} userEmail={user?.email} onLogout={logout} />
      <main className="content">
        <DashboardPage />
      </main>
    </div>
  );
}

export default App;
