import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LOGO_BASE64 } from '../assets/logo';

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
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <img
            src={LOGO_BASE64}
            alt="MovingPay"
            style={{ height: '80px', width: 'auto', objectFit: 'contain', marginBottom: '12px' }}
          />
          <p className="eyebrow" style={{ fontSize: '0.68rem', letterSpacing: '0.22em' }}>MovingPay</p>
          <h2 style={{ marginTop: '6px' }}>Acesso ao painel</h2>
          <p className="login-subtitle">Entre com seu usuário Firebase para abrir o dashboard.</p>
        </div>

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
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                Entrando...
              </span>
            ) : 'Entrar'}
          </button>
        </form>

        {error && (
          <div style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'var(--danger-soft)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            fontSize: '0.82rem',
            fontWeight: 500,
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

export default LoginPage;
