import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email.trim(), password);
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError('Email ou senha invalidos.');
      } else if (code === 'auth/user-not-found') {
        setError('Usuario nao encontrado no Firebase.');
      } else {
        setError('Nao foi possivel autenticar. Verifique os dados e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="login-page">
      <div className="login-card fade-up">
        <p className="eyebrow">MovingPay</p>
        <h2>Acesso ao painel</h2>
        <p className="login-subtitle">Entre com seu usuario Firebase para abrir o dashboard.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seu.email@empresa.com"
              required
              autoComplete="username"
              disabled={loading}
            />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Sua senha"
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </label>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {error && <small className="filter-error">{error}</small>}
      </div>
    </section>
  );
}

export default LoginPage;

