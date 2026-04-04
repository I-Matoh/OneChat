import { useState, Suspense } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginBackground from '../components/LoginBackground';

function LoadingFallback() {
  return (
    <div className="loading-page">
      <div className="loading-spinner"></div>
      <p className="loading-text">Loading experience...</p>
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
      <Suspense fallback={<LoadingFallback />}>
        <LoginBackground />
      </Suspense>
      
      <div className="auth-container">
        <div className="auth-glow"></div>
        
        <div className="auth-card-glass">
          <div className="auth-header">
            <h1 className="auth-title">{isRegister ? 'Create Account' : 'Welcome back to OneChat'}</h1>
            <p className="auth-subtitle">{isRegister ? 'Start your journey with us' : 'Connect with the world in light'}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-wrapper">
                  <span className="input-icon material-symbols-outlined">person</span>
                  <input
                    className="input-glass"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div className="input-wrapper">
                <span className="input-icon material-symbols-outlined">mail</span>
                <input
                  className="input-glass"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <div className="label-row">
                <label className="form-label">Password</label>
                {!isRegister && <a className="forgot-link" href="#">Forgot Password?</a>}
              </div>
              <div className="input-wrapper">
                <span className="input-icon material-symbols-outlined">lock</span>
                <input
                  className="input-glass"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button className="btn-glass" type="submit" disabled={loading}>
              {loading ? '...' : isRegister ? 'Create Account' : 'Sign In'}
              <span className="btn-icon-arrow material-symbols-outlined">arrow_forward</span>
            </button>
          </form>

          <div className="auth-divider">
            <div className="divider-line"></div>
            <span className="divider-text">Or continue with</span>
            <div className="divider-line"></div>
          </div>

          <div className="social-buttons">
            <button className="btn-social">
              <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCoI9wN2NQbtwtVtciVy8Qicl2FC1tGtNoMNbhksU9rEDG3yFZRIsWn214C4yXfrfkBQz5wfYNYU0SeVHL5Zikte-V8P8r_m0GBdusbysD16E_G1WdsSkWG-4k_dpR73Zt6wKoovIddusRXkVb4OjWc5GT611kt-dxMDmtrXYg7Ezk3CV1EFXSVm7AVySVySwDix5i3C3TMtrirYb8p4oBXlaXshVQX_7kuY3AsGAljNEoJPswDPYg0MfpIFn1RMoBHYCEiHQ0dOuw" alt="Google" className="social-icon" />
              Google
            </button>
            <button className="btn-social">
              <span className="material-symbols-outlined social-icon">ios</span>
              Apple
            </button>
          </div>

          <div className="auth-toggle">
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button type="button" onClick={() => { setIsRegister(!isRegister); setError(''); }}>
              {isRegister ? 'Sign In' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
