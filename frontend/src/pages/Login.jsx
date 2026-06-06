import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Falha na autenticação');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Grid decorativo de fundo */}
      <div style={styles.grid} />
      <div style={styles.glow} />

      <div style={styles.card} className="animate-in">
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logoMark}>
            <span style={styles.logoIcon}>◈</span>
          </div>
          <h1 style={styles.title}>Portal de Monitoração</h1>
          <p style={styles.subtitle}>Banco PAN · BTG Pactual</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Usuário</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              placeholder="seu.usuario"
              required
              autoFocus
              style={styles.input}
              onFocus={e => e.target.style.borderColor = 'var(--gold)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Senha</label>
            <input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              required
              style={styles.input}
              onFocus={e => e.target.style.borderColor = 'var(--gold)'}
              onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
            />
          </div>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}
            onMouseEnter={e => { if (!loading) e.target.style.background = 'var(--gold-light)'; }}
            onMouseLeave={e => { if (!loading) e.target.style.background = 'var(--gold)'; }}
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>

        <p style={styles.footer}>
          Acesso restrito · Monitoração Corporativa
        </p>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: `
      linear-gradient(var(--border) 1px, transparent 1px),
      linear-gradient(90deg, var(--border) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
    opacity: 0.4,
    maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
  },
  glow: {
    position: 'absolute',
    width: '600px', height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 1,
    width: '100%', maxWidth: '400px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px 36px',
    boxShadow: '0 0 0 1px rgba(201,168,76,0.05), var(--shadow)',
  },
  header: { textAlign: 'center', marginBottom: '32px' },
  logoMark: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: '48px', height: '48px',
    background: 'var(--gold-dim)',
    border: '1px solid rgba(201,168,76,0.3)',
    borderRadius: '12px',
    marginBottom: '16px',
  },
  logoIcon: {
    fontSize: '22px', color: 'var(--gold)',
    fontFamily: 'var(--font-display)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '22px',
    fontWeight: 300,
    color: 'var(--text-accent)',
    letterSpacing: '0.02em',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    fontFamily: 'var(--font-mono)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '11px', fontWeight: 500,
    color: 'var(--text-secondary)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
  },
  input: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-light)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    transition: 'border-color var(--transition)',
    width: '100%',
  },
  errorBox: {
    background: 'var(--red-dim)',
    border: '1px solid rgba(255,87,87,0.25)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    color: 'var(--red)',
    fontSize: '13px',
    display: 'flex', gap: '8px', alignItems: 'center',
  },
  btn: {
    background: 'var(--gold)',
    color: '#0a0c10',
    border: 'none',
    borderRadius: 'var(--radius)',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    transition: 'background var(--transition)',
    marginTop: '8px',
    letterSpacing: '0.03em',
  },
  btnDisabled: {
    background: 'var(--text-muted)',
    cursor: 'not-allowed',
  },
  footer: {
    textAlign: 'center',
    marginTop: '24px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
  },
};
