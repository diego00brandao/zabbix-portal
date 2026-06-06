import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const ROLES = { admin: 'Administrador', viewer: 'Visualizador' };
const ROLE_COLORS = { admin: 'var(--red)', manager: 'var(--blue)', viewer: 'var(--text-muted)' };

const EMPTY_FORM = { username: '', password: '', full_name: '', email: '', role: 'viewer', area_id: '' };

export default function Users() {
  const [users, setUsers]   = useState([]);
  const [areas, setAreas]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState(null);
  const [filter, setFilter]     = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([api.get('/api/admin/users'), api.get('/api/admin/areas')]);
      setUsers(u.data);
      setAreas(a.data);
    } catch {}
    setLoading(false);
  }

  function notify(text, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(u) {
    setEditing(u);
    setForm({ username: u.username, password: '', full_name: u.full_name, email: u.email || '', role: u.role, area_id: u.area_id || '' });
    setShowForm(true);
  }

  async function save() {
    if (!form.full_name || (!editing && !form.username) || (!editing && !form.password)) {
      return notify('Preencha todos os campos obrigatórios', false);
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/admin/users/${editing.id}`, { ...form, active: editing.active });
        notify('Usuário atualizado!');
      } else {
        await api.post('/api/admin/users', form);
        notify('Usuário criado!');
      }
      setShowForm(false);
      load();
    } catch (e) { notify(e.response?.data?.error || 'Erro ao salvar', false); }
    setSaving(false);
  }

  async function toggleActive(u) {
    try {
      if (u.active) {
        await api.delete(`/api/admin/users/${u.id}`);
        notify(`${u.full_name} desativado`);
      } else {
        await api.put(`/api/admin/users/${u.id}`, { ...u, active: true });
        notify(`${u.full_name} ativado`);
      }
      load();
    } catch (e) { notify(e.response?.data?.error || 'Erro', false); }
  }

  const filtered = users.filter(u =>
    !filter ||
    u.full_name?.toLowerCase().includes(filter.toLowerCase()) ||
    u.username?.toLowerCase().includes(filter.toLowerCase()) ||
    u.area_name?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div style={S.root}>
      {msg && <div style={{ ...S.toast, background: msg.ok ? 'var(--green-dim)' : 'var(--red-dim)', borderColor: msg.ok ? 'rgba(46,204,143,0.3)' : 'rgba(255,87,87,0.3)', color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.ok ? '✓' : '✕'} {msg.text}</div>}

      <div style={S.header}>
        <div>
          <h1 style={S.title}>Usuários</h1>
          <p style={S.sub}>{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} style={S.btn}>+ Novo Usuário</button>
      </div>

      <div style={S.filters}>
        <input placeholder="Filtrar por nome, usuário ou área..." value={filter} onChange={e => setFilter(e.target.value)} style={S.searchInput} />
        <span style={S.count}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={S.table}>
        <div style={S.tableHeader}>
          <span>Nome</span><span>Usuário</span><span>Perfil</span><span>Área</span><span>Último Login</span><span>Status</span><span>Ações</span>
        </div>
        {loading ? Array(4).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height:'52px', margin:'4px 0', borderRadius:'var(--radius)' }} />) :
         filtered.map(u => (
          <div key={u.id} style={{ ...S.row, opacity: u.active ? 1 : 0.5 }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:600, color:'var(--text-accent)' }}>{u.full_name}</div>
              {u.email && <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{u.email}</div>}
            </div>
            <span style={{ fontFamily:'var(--font-mono)', fontSize:'12px', color:'var(--text-secondary)' }}>{u.username}</span>
            <span style={{ fontSize:'11px', fontWeight:600, color: ROLE_COLORS[u.role] || 'var(--text-muted)' }}>{ROLES[u.role] || u.role}</span>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              {u.area_color && <div style={{ width:'8px', height:'8px', borderRadius:'50%', background: u.area_color, flexShrink:0 }} />}
              <span style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{u.area_name || '—'}</span>
            </div>
            <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
              {u.last_login ? new Date(u.last_login).toLocaleDateString('pt-BR') : 'Nunca'}
            </span>
            <span>
              <span className={`badge ${u.active ? 'badge-ok' : 'badge-info'}`}>{u.active ? 'Ativo' : 'Inativo'}</span>
            </span>
            <div style={{ display:'flex', gap:'6px' }}>
              <button onClick={() => openEdit(u)} style={S.btnSm}>✎ Editar</button>
              <button onClick={() => toggleActive(u)} style={{ ...S.btnSm, color: u.active ? 'var(--red)' : 'var(--green)' }}>
                {u.active ? '✕ Desativar' : '✓ Ativar'}
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loading && <div style={S.empty}>Nenhum usuário encontrado</div>}
      </div>

      {showForm && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={S.modal} className="animate-in">
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{editing ? '✎ Editar Usuário' : '+ Novo Usuário'}</div>
              <button onClick={() => setShowForm(false)} style={S.closeBtn}>✕</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.grid2}>
                <div style={S.field}>
                  <label style={S.label}>Nome completo *</label>
                  <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="João da Silva" style={S.input} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>E-mail</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="joao@empresa.com" style={S.input} type="email" />
                </div>
              </div>
              <div style={S.grid2}>
                <div style={S.field}>
                  <label style={S.label}>Usuário *{editing ? ' (não editável)' : ''}</label>
                  <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="joao.silva" style={S.input} disabled={!!editing} />
                </div>
                <div style={S.field}>
                  <label style={S.label}>Senha {editing ? '(deixe vazio para manter)' : '*'}</label>
                  <input value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" style={S.input} type="password" />
                </div>
              </div>
              <div style={S.grid2}>
                <div style={S.field}>
                  <label style={S.label}>Perfil</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={S.select}>
                    <option value="viewer">Visualizador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div style={S.field}>
                  <label style={S.label}>Área</label>
                  <select value={form.area_id} onChange={e => setForm(f => ({ ...f, area_id: e.target.value }))} style={S.select}>
                    <option value="">Sem área</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'8px' }}>
                <button onClick={() => setShowForm(false)} style={{ ...S.btn, background:'var(--bg-hover)', color:'var(--text-muted)', border:'1px solid var(--border)' }}>Cancelar</button>
                <button onClick={save} disabled={saving} style={S.btn}>{saving ? '...' : editing ? '✓ Salvar' : '✓ Criar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root: { padding:'28px', maxWidth:'1200px', margin:'0 auto', position:'relative' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px' },
  title: { fontFamily:'var(--font-display)', fontSize:'26px', fontWeight:300, color:'var(--text-accent)' },
  sub: { fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:'2px' },
  btn: { background:'var(--gold-dim)', border:'1px solid rgba(201,168,76,0.3)', color:'var(--gold)', borderRadius:'var(--radius)', padding:'7px 16px', fontSize:'13px', cursor:'pointer', fontFamily:'var(--font-sans)' },
  btnSm: { background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'5px 10px', fontSize:'12px', cursor:'pointer', fontFamily:'var(--font-sans)', color:'var(--text-secondary)' },
  filters: { display:'flex', gap:'12px', alignItems:'center', marginBottom:'16px' },
  searchInput: { flex:1, background:'var(--bg-surface)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'8px 14px', color:'var(--text-primary)', fontSize:'13px', outline:'none' },
  count: { fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' },
  table: { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' },
  tableHeader: { display:'grid', gridTemplateColumns:'1.5fr 120px 110px 140px 110px 80px 160px', gap:'12px', padding:'10px 20px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase' },
  row: { display:'grid', gridTemplateColumns:'1.5fr 120px 110px 140px 110px 80px 160px', gap:'12px', padding:'14px 20px', borderBottom:'1px solid var(--border)', alignItems:'center', transition:'background 0.15s' },
  empty: { padding:'40px', textAlign:'center', color:'var(--text-muted)' },
  toast: { position:'fixed', top:'20px', right:'20px', zIndex:999, padding:'12px 20px', borderRadius:'var(--radius)', border:'1px solid', fontSize:'13px', fontWeight:500, boxShadow:'0 4px 20px rgba(0,0,0,0.3)' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modal: { background:'var(--bg-surface)', border:'1px solid var(--border-light)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:'580px', boxShadow:'0 20px 60px rgba(0,0,0,0.5)', overflow:'hidden' },
  modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid var(--border)' },
  modalTitle: { fontSize:'16px', fontWeight:600, color:'var(--text-accent)', fontFamily:'var(--font-display)' },
  modalBody: { padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px' },
  closeBtn: { background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'18px' },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' },
  field: { display:'flex', flexDirection:'column', gap:'6px' },
  label: { fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'var(--font-mono)' },
  input: { background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'8px 12px', color:'var(--text-primary)', fontSize:'13px', outline:'none' },
  select: { background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'8px 12px', color:'var(--text-primary)', fontSize:'13px', outline:'none', cursor:'pointer' },
};