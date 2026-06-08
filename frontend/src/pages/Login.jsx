import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function Login() {
  const { login } = useAuth();

  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // 'login' | 'reset' | 'register' // 'login' | 'reset'
  const [resetForm, setResetForm] = useState({ username: '', password: '', confirm: '' });
  const [regForm, setRegForm] = useState({ username: '', password: '', confirm: '', full_name: '', email: '' });
  const [regMsg, setRegMsg] = useState('');
  const [regError, setRegError] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetError, setResetError] = useState('');

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

  

  async function handleReset(e) {
    e.preventDefault();
    setResetError('');
    setResetMsg('');
    if (resetForm.password !== resetForm.confirm) return setResetError('As senhas não coincidem');
    if (resetForm.password.length < 8) return setResetError('Senha deve ter pelo menos 8 caracteres');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { username: resetForm.username, password: resetForm.password });
      setResetMsg('Senha alterada com sucesso!');
      setTimeout(() => { setMode('login'); setResetForm({ username: '', password: '', confirm: '' }); }, 2000);
    } catch (err) {
      setResetError(err.response?.data?.error || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegError(''); setRegMsg('');
    if (regForm.password !== regForm.confirm) return setRegError('As senhas não coincidem');
    if (regForm.password.length < 8) return setRegError('Senha deve ter pelo menos 8 caracteres');
    setLoading(true);
    try {
      await api.post('/api/auth/register', { username: regForm.username, password: regForm.password, full_name: regForm.full_name, email: regForm.email });
      setRegMsg('Cadastro enviado! Aguarde aprovação do administrador.');
      setTimeout(() => { setMode('login'); setRegForm({ username: '', password: '', confirm: '', full_name: '', email: '' }); }, 3000);
    } catch (err) { setRegError(err.response?.data?.error || 'Erro ao cadastrar'); }
    finally { setLoading(false); }
  }

  return (
    <div style={styles.root}>
      <div style={styles.grid} />
      <div style={styles.glow} />
      <div style={styles.card} className="animate-in">
        <div style={styles.header}>
          <div style={styles.logoMark}><span style={styles.logoIcon}>◈</span></div>
          <h1 style={styles.title}>Observability Portal</h1>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Usuário</label>
              <input type="text" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="seu.usuario" required autoFocus style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Senha</label>
              <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="••••••••" required style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} />
            </div>
            {error && <div style={styles.errorBox}><span>⚠</span> {error}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }} onMouseEnter={e => { if(!loading) e.target.style.background='var(--gold-light)'; }} onMouseLeave={e => { if(!loading) e.target.style.background='var(--gold)'; }}>
              {loading ? 'Autenticando...' : 'Entrar'}
            </button>
            <button type="button" onClick={() => { setMode('reset'); setError(''); }} style={styles.linkBtn}>Esqueci minha senha</button>
            <button type="button" onClick={() => { setMode('register'); setError(''); }} style={{ ...styles.linkBtn, color: 'var(--gold)', textDecoration: 'none' }}>Solicitar acesso</button>
          </form>
        ) : mode === 'register' ? (
          <form onSubmit={handleRegister} style={styles.form}>
            <div style={styles.field}><label style={styles.label}>Nome completo *</label><input type="text" value={regForm.full_name} onChange={e => setRegForm(p => ({ ...p, full_name: e.target.value }))} placeholder="João da Silva" required style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} /></div>
            <div style={styles.field}><label style={styles.label}>Usuário *</label><input type="text" value={regForm.username} onChange={e => setRegForm(p => ({ ...p, username: e.target.value }))} placeholder="joao.silva" required style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} /></div>
            <div style={styles.field}><label style={styles.label}>E-mail</label><input type="email" value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} placeholder="joao@empresa.com" style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} /></div>
            <div style={styles.field}><label style={styles.label}>Senha *</label><input type="password" value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} placeholder="mínimo 8 caracteres" required style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} /></div>
            <div style={styles.field}><label style={styles.label}>Confirmar Senha *</label><input type="password" value={regForm.confirm} onChange={e => setRegForm(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" required style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} /></div>
            {regError && <div style={styles.errorBox}><span>⚠</span> {regError}</div>}
            {regMsg && <div style={styles.successBox}><span>✓</span> {regMsg}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}>{loading ? 'Enviando...' : 'Solicitar Acesso'}</button>
            <button type="button" onClick={() => { setMode('login'); setRegError(''); setRegMsg(''); }} style={styles.linkBtn}>← Voltar ao login</button>
          </form>
        ) : (
          <form onSubmit={handleReset} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Usuário</label>
              <input type="text" value={resetForm.username} onChange={e => setResetForm(p => ({ ...p, username: e.target.value }))} placeholder="seu.usuario" required autoFocus style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Nova Senha</label>
              <input type="password" value={resetForm.password} onChange={e => setResetForm(p => ({ ...p, password: e.target.value }))} placeholder="mínimo 8 caracteres" required style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirmar Senha</label>
              <input type="password" value={resetForm.confirm} onChange={e => setResetForm(p => ({ ...p, confirm: e.target.value }))} placeholder="••••••••" required style={styles.input} onFocus={e => e.target.style.borderColor='var(--gold)'} onBlur={e => e.target.style.borderColor='var(--border-light)'} />
            </div>
            {resetError && <div style={styles.errorBox}><span>⚠</span> {resetError}</div>}
            {resetMsg && <div style={styles.successBox}><span>✓</span> {resetMsg}</div>}
            <button type="submit" disabled={loading} style={{ ...styles.btn, ...(loading ? styles.btnDisabled : {}) }}>
              {loading ? 'Salvando...' : 'Alterar Senha'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setResetError(''); setResetMsg(''); }} style={styles.linkBtn}>
              ← Voltar ao login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' },
  grid: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize: '48px 48px', opacity: 0.4, maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)' },
  glow: { position: 'absolute', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' },
  card: { position: 'relative', zIndex: 1, width: '100%', maxWidth: '400px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '40px 36px', boxShadow: '0 0 0 1px rgba(201,168,76,0.05), var(--shadow)' },
  header: { textAlign: 'center', marginBottom: '32px' },
  logoMark: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: '12px', marginBottom: '16px' },
  logoIcon: { fontSize: '22px', color: 'var(--gold)', fontFamily: 'var(--font-display)' },
  title: { fontFamily: 'Georgia, serif', fontSize: '28px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em', marginBottom: '4px', textShadow: '0 0 20px rgba(201,168,76,0.3)' },
  subtitle: { fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' },
  input: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-sans)', outline: 'none', transition: 'border-color var(--transition)', width: '100%' },
  errorBox: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' },
  successBox: { background: 'var(--green-dim)', border: '1px solid rgba(46,204,143,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--green)', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' },
  btn: { background: 'var(--gold)', color: '#0a0c10', border: 'none', borderRadius: 'var(--radius)', padding: '12px', fontSize: '14px', fontWeight: 600, fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'background var(--transition)', marginTop: '8px', letterSpacing: '0.03em' },
  btnDisabled: { background: 'var(--text-muted)', cursor: 'not-allowed' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', textAlign: 'center', padding: '4px', fontFamily: 'var(--font-sans)', textDecoration: 'underline' },
};
