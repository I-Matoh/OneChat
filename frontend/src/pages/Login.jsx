import { useState, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginBackground from '../components/LoginBackground';

function LoadingFallback() {
  return (
    <div className="login-3d-loading">
      <div className="loading-spinner"></div>
      <p>Loading experience...</p>
    </div>
  );
}

export default function Login() {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await register(name, email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      {/* 3D Background */}
      <Suspense fallback={<LoadingFallback />}>
        <LoginBackground />
      </Suspense>
      
      <form className="auth-card" onSubmit={handleSubmit}>
        <img src="/logo.png" alt="OneChat" className="auth-logo" />
        <h1 className="auth-title">{isRegister ? 'Create Account' : 'Welcome Back'}</h1>
        <p className="auth-subtitle">
          {isRegister ? 'Join OneChat and start collaborating' : 'Sign in to continue to OneChat'}
        </p>

        {isRegister && (
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              className="form-input"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="form-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <input
            id="password"
            className="form-input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <button className="btn btn-primary auth-btn" type="submit" disabled={loading}>
          {loading ? '...' : isRegister ? 'Create Account' : 'Sign In'}
        </button>

        <div className="auth-toggle">
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}
