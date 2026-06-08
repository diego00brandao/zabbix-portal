import React, { useEffect, useState } from 'react';
import api from '../services/api';

const EMPTY_FORM = { name: '', url: '', auth_type: 'token', token: '', username: '', password: '' };

export default function Connections() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try { const r = await api.get('/api/connections'); setConnections(r.data); }
    catch {}
    setLoading(false);
  }

  function notify(text, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setTestResult(null);
    setShowForm(true);
  }

  function openEdit(c) {
    setEditing(c);
    setForm({ name: c.name, url: c.url, auth_type: c.auth_type, token: '', username: c.username || '', password: '' });
    setTestResult(null);
    setShowForm(true);
  }

  async function testConn() {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.post('/api/connections/test', form);
      setTestResult(r.data);
    } catch (e) {
      setTestResult({ success: false, error: e.response?.data?.error || e.message });
    }
    setTesting(false);
  }

  async function save() {
    if (!form.name || !form.url) return notify('Nome e URL são obrigatórios', false);
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/connections/${editing.id}`, form);
        notify('Conexão atualizada!');
      } else {
        await api.post('/api/connections', form);
        notify('Conexão criada!');
      }
      setShowForm(false);
      load();
    } catch (e) {
      notify(e.response?.data?.error || 'Erro ao salvar', false);
    }
    setSaving(false);
  }

  async function activate(id) {
    setActivating(id);
    try {
      await api.post(`/api/connections/${id}/activate`);
      notify('Conexão ativada! Portal agora usa esta fonte.');
      load();
    } catch (e) {
      notify(e.response?.data?.error || 'Erro ao ativar', false);
    }
    setActivating(null);
  }

  async function useEnv() {
    try {
      await api.post('/api/connections/use-env');
      notify('Usando configuração do .env');
      load();
    } catch {}
  }

  async function remove(c) {
    if (!confirm(`Remover "${c.name}"?`)) return;
    try {
      await api.delete(`/api/connections/${c.id}`);
      notify('Conexão removida');
      load();
    } catch (e) {
      notify(e.response?.data?.error || 'Erro ao remover', false);
    }
  }

  const hasActive = connections.some(c => c.active);

  return (
    <div style={s.root}>
      {msg && (
        <div style={{ ...s.toast, background: msg.ok ? 'var(--green-dim)' : 'var(--red-dim)', borderColor: msg.ok ? 'rgba(46,204,143,0.3)' : 'rgba(255,87,87,0.3)', color: msg.ok ? 'var(--green)' : 'var(--red)' }}>
          {msg.ok ? '✓' : '✕'} {msg.text}
        </div>
      )}

      <div style={s.header}>
        <div>
          <h1 style={s.title}>Conexões Zabbix</h1>
          <p style={s.sub}>Gerencie as fontes de dados — igual aos datasources do Grafana</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {hasActive && (
            <button onClick={useEnv} style={{ ...s.btn, background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              ↩ Usar .env
            </button>
          )}
          <button onClick={openNew} style={s.btn}>+ Nova Conexão</button>
        </div>
      </div>
      {/* Lista de conexões */}
      {loading ? (
        Array(3).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius-lg)', marginBottom: '10px' }} />)
      ) : connections.length === 0 ? (
        <div style={s.empty}>Nenhuma conexão cadastrada. Clique em "+ Nova Conexão" para adicionar.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {connections.map(c => (
            <div key={c.id} style={{ ...s.card, borderColor: c.active ? 'var(--green)' : 'var(--border)', background: c.active ? 'rgba(46,204,143,0.05)' : 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ fontSize: '24px' }}>{c.auth_type === 'token' ? '🔑' : '👤'}</div>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-accent)' }}>{c.name}</div>
                      {c.active && <span style={{ ...s.badge, background: 'var(--green-dim)', color: 'var(--green)', border: '1px solid rgba(46,204,143,0.3)' }}>● ATIVA</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{c.url}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {c.auth_type === 'token' ? '🔑 Token API' : `👤 ${c.username}`} · Criado em {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {!c.active && (
                    <button onClick={() => activate(c.id)} disabled={activating === c.id}
                      style={{ ...s.btn, background: 'var(--green-dim)', borderColor: 'rgba(46,204,143,0.3)', color: 'var(--green)', fontSize: '12px' }}>
                      {activating === c.id ? '...' : '▶ Ativar'}
                    </button>
                  )}
                  <button onClick={() => openEdit(c)} style={{ ...s.btnSm, color: 'var(--blue)' }}>✎ Editar</button>
                  <button onClick={() => remove(c)} style={{ ...s.btnSm, color: 'var(--red)' }}>✕ Remover</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal formulário */}
      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={s.modal} className="animate-in">
            <div style={s.modalHeader}>
              <div style={s.modalTitle}>{editing ? '✎ Editar Conexão' : '+ Nova Conexão Zabbix'}</div>
              <button onClick={() => setShowForm(false)} style={s.closeBtn}>✕</button>
            </div>

            <div style={s.modalBody}>
              <div style={s.field}>
                <label style={s.label}>Nome da conexão *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Zabbix Produção, Zabbix HMG..." style={s.input} />
              </div>

              <div style={s.field}>
                <label style={s.label}>URL da API Zabbix *</label>
                <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="http://192.168.1.82/zabbix/api_jsonrpc.php" style={s.input} />
              </div>

              <div style={s.field}>
                <label style={s.label}>Tipo de autenticação</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[['token', '🔑 Token API'], ['userpass', '👤 Usuário/Senha']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setForm(f => ({ ...f, auth_type: val }))}
                      style={{ ...s.btn, flex: 1, fontSize: '13px', background: form.auth_type === val ? 'var(--blue-dim)' : 'var(--bg-hover)', borderColor: form.auth_type === val ? 'rgba(74,158,255,0.4)' : 'var(--border)', color: form.auth_type === val ? 'var(--blue)' : 'var(--text-muted)' }}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {form.auth_type === 'token' ? (
                <div style={s.field}>
                  <label style={s.label}>Token API *</label>
                  <input value={form.token} onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
                    placeholder={editing ? '(deixe vazio para manter o atual)' : 'Cole o token da API do Zabbix'}
                    style={s.input} type="password" />
                </div>
              ) : (
                <>
                  <div style={s.field}>
                    <label style={s.label}>Usuário *</label>
                    <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="Admin" style={s.input} />
                  </div>
                  <div style={s.field}>
                    <label style={s.label}>Senha *</label>
                    <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={editing ? '(deixe vazio para manter a atual)' : 'Senha do Zabbix'}
                      style={s.input} type="password" />
                  </div>
                </>
              )}

              {/* Resultado do teste */}
              {testResult && (
                <div style={{ padding: '12px 16px', borderRadius: 'var(--radius)', background: testResult.success ? 'var(--green-dim)' : 'var(--red-dim)', border: `1px solid ${testResult.success ? 'rgba(46,204,143,0.3)' : 'rgba(255,87,87,0.3)'}`, fontSize: '13px', color: testResult.success ? 'var(--green)' : 'var(--red)' }}>
                  {testResult.success
                    ? `✓ Conexão OK! Zabbix v${testResult.version} · ${testResult.hosts} hosts encontrados`
                    : `✕ Falha: ${testResult.error}`}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button onClick={testConn} disabled={testing || !form.url}
                  style={{ ...s.btn, background: 'var(--blue-dim)', borderColor: 'rgba(74,158,255,0.3)', color: 'var(--blue)', opacity: (!form.url) ? 0.5 : 1 }}>
                  {testing ? '⟳ Testando...' : '⚡ Testar Conexão'}
                </button>
                <button onClick={save} disabled={saving}
                  style={{ ...s.btn, marginLeft: 'auto' }}>
                  {saving ? '...' : editing ? '✓ Salvar alterações' : '✓ Criar conexão'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  root: { padding: '28px', maxWidth: '900px', margin: '0 auto', position: 'relative' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  btn: { background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)', borderRadius: 'var(--radius)', padding: '7px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  btnSm: { background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px', transition: 'border-color 0.2s' },
  badge: { fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '999px', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' },
  empty: { padding: '60px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
  toast: { position: 'fixed', top: '20px', right: '20px', zIndex: 999, padding: '12px 20px', borderRadius: 'var(--radius)', border: '1px solid', fontSize: '13px', fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' },
  modalTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--text-accent)', fontFamily: 'var(--font-display)' },
  modalBody: { padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' },
  input: { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' },
};