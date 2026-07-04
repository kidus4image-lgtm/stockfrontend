'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../lib/api';
import { showError, showSuccess } from '../../lib/toast';
import './login.css';

function getPasswordStrength(pw: string): { level: 'weak' | 'medium' | 'strong'; text: string } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 'weak', text: 'Weak' };
  if (score <= 3) return { level: 'medium', text: 'Medium' };
  return { level: 'strong', text: 'Strong' };
}

const PARTICLE_COUNT = 15;

export default function LoginPage() {
  const router = useRouter();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<{ id: number; left: string; size: number; duration: number; delay: number; color: string }[]>([]);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    setParticles(
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 6 + 3,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 10,
        color: ['#3b82f6', '#1d4ed8', '#10b981', '#f59e0b'][Math.floor(Math.random() * 4)],
      }))
    );
  }, []);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleRipple = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipple({ x, y, id: Date.now() });
    setTimeout(() => setRipple(null), 600);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!username || !password) {
      showError('Please fill in all fields.');
      setLoading(false);
      triggerShake();
      return;
    }

    try {
      const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
      const response = await apiFetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      if (isRegistering) {
        showSuccess('Registration successful! Please login.');
        setIsRegistering(false);
        setPassword('');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/');
      }
    } catch (err: any) {
      showError(err.message || 'Connection failed.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isDesktop = window.matchMedia('(min-width: 901px)').matches;
    if (isDesktop) {
      document.body.style.overflow = 'hidden';
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setUsername('');
        setPassword('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const usernameFilled = username.length > 0;
  const passwordFilled = password.length > 0;
  const strength = getPasswordStrength(password);

  return (
    <div className="login-container">
      <div className="login-bg-particles" aria-hidden="true">
        {particles.map((p) => (
          <div
            key={p.id}
            className="login-particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      <div className="login-content-wrapper">
        <div className="login-context-section">
          <div className="context-content">
            <div className="context-badge">Nexlify 2.0</div>
            <h1 className="context-title">Master Your Retail Operations</h1>
            <p className="context-subtitle">Absolute control over inventory, sales, and cash flow in one seamless, high-performance platform.</p>
            
            <div className="feature-list">
              <div className="feature-item" style={{ animationDelay: '0.1s' }}>
                <div className="feature-icon-wrapper">
                  <span className="feature-icon">📦</span>
                </div>
                <div className="feature-text">
                  <h3>Smart Inventory</h3>
                  <p>Real-time stock tracking with automated low-stock alerts and batch management.</p>
                </div>
              </div>
              
              <div className="feature-item" style={{ animationDelay: '0.2s' }}>
                <div className="feature-icon-wrapper">
                  <span className="feature-icon">💸</span>
                </div>
                <div className="feature-text">
                  <h3>Cash Flow Insights</h3>
                  <p>Monitor receivables, track payments, and forecast revenue effortlessly.</p>
                </div>
              </div>
              
              <div className="feature-item" style={{ animationDelay: '0.3s' }}>
                <div className="feature-icon-wrapper">
                  <span className="feature-icon">📊</span>
                </div>
                <div className="feature-text">
                  <h3>Actionable Analytics</h3>
                  <p>Generate instant reports on sales performance, customer aging, and daily operations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      <div className="login-form-section">
        <div className={`login-card${shake ? ' shake' : ''}`}>
            <div className="login-header">
              <div className="login-logo-container">
                <div className="login-logo-icon">🛡️</div>
                <span className="login-logo-text">Nexlify</span>
              </div>
              <h2>
                {isRegistering ? 'Create Account' : 'Welcome Back'}
              </h2>
              <p>
                {isRegistering
                  ? 'Register for a Nexlify account'
                  : 'Sign in to access your secure dashboard'}
              </p>
            </div>

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-wrapper">
                <span className="input-prefix" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  id="username"
                  className={`form-input${usernameFilled ? ' valid' : ''}`}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoComplete="username"
                  placeholder="Enter your username"
                />
                <span className={`input-icon${usernameFilled ? ' show' : ''}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <span className="input-prefix" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className={`form-input${passwordFilled ? ' valid' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete={isRegistering ? 'new-password' : 'current-password'}
                  placeholder="Enter your password"
                />
                {passwordFilled && (
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              {isRegistering && (
                <>
                  <div className={`password-strength${passwordFilled ? ' show' : ''}`}>
                    <div className={`strength-bar ${passwordFilled ? strength.level : ''}`} />
                  </div>
                  <div className={`strength-text${passwordFilled ? ' show' : ''}`} style={{ color: strength.level === 'weak' ? '#ef4444' : strength.level === 'medium' ? '#f59e0b' : '#10b981' }}>
                    {strength.text} password
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={loading}
              ref={btnRef}
              onMouseDown={handleRipple}
            >
              <span className="login-btn-content">
                {loading ? (
                  <>
                    <span className="btn-spinner" /> Processing...
                  </>
                ) : isRegistering ? (
                  'Create Account'
                ) : (
                  'Sign In'
                )}
              </span>
              {ripple && (
                <span
                  className="btn-ripple"
                  style={{
                    left: ripple.x,
                    top: ripple.y,
                    width: 10,
                    height: 10,
                    marginLeft: -5,
                    marginTop: -5,
                  }}
                />
              )}
            </button>

            <div className="auth-switch-row">
              <span className="auth-switch-text">
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              </span>
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setPassword('');
                }}
              >
                {isRegistering ? 'Sign In' : 'Register'}
              </button>
            </div>
          </form>

          <div className="auth-switch auth-switch-footer">
            🛡️ Nexlify — Secure Retail Inventory &amp; Cash Flow System. Authorized access only.
          </div>
        </div>
      </div>
      </div>


    </div>
  );
}
