import React, { useState, useEffect } from 'react';
import { fetchCaptcha, loginUser, registerUser } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AuthModal({ isOpen, onClose }) {
  const { saveUserSession } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaData, setCaptchaData] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadNewCaptcha = async () => {
    try {
      setCaptchaAnswer('');
      const data = await fetchCaptcha();
      setCaptchaData(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      loadNewCaptcha();
    }
  }, [isOpen, isRegister]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password.trim()) {
      setError('Please fill in both username and password.');
      return;
    }

    if (!captchaAnswer.trim()) {
      setError('Please answer the captcha calculation.');
      return;
    }

    setLoading(true);
    try {
      let user;
      if (isRegister) {
        user = await registerUser(username.trim(), password, captchaData?.captchaId, captchaAnswer.trim());
      } else {
        user = await loginUser(username.trim(), password, captchaData?.captchaId, captchaAnswer.trim());
      }
      saveUserSession(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed');
      loadNewCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        className="pro-card"
        style={{
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          padding: '28px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)' }}>
            {isRegister ? 'Create Your Account' : 'Log In to VocabMaster'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
          {isRegister
            ? 'Sign up to persistently save your word mastery and quiz scores.'
            : 'Access your saved progress, stats, and quiz history.'}
        </p>

        {error && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              fontSize: '12px',
              fontWeight: '600',
              marginBottom: '16px',
              border: '1px solid var(--color-danger)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. sat_prep_alex"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-card)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-card)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
              }}
            />
          </div>

          {/* Interactive CAPTCHA section */}
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-muted)',
              border: '1px solid var(--border-card)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Security Captcha
              </span>
              <button
                type="button"
                onClick={loadNewCaptcha}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-blue)',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                ↻ Refresh Captcha
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  padding: '8px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px dashed var(--border-card)',
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  fontWeight: '800',
                  color: 'var(--accent-blue)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                }}
              >
                {captchaData ? captchaData.question : 'Loading...'}
              </div>

              <input
                type="text"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                placeholder="Enter answer"
                required
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-card)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '11px', marginTop: '6px', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Processing...' : isRegister ? 'Register & Log In' : 'Log In'}
          </button>
        </form>

        <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontWeight: '700', cursor: 'pointer' }}
              >
                Log In
              </button>
            </span>
          ) : (
            <span>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', fontWeight: '700', cursor: 'pointer' }}
              >
                Create Account
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
