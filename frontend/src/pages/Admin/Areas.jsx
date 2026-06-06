import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'];

const EMPTY_FORM = { name: '', description: '', color: '#3B82F6', zabbix_hostgroup_ids: [], zabbix_template_ids: [], zabbix_connection_ids: [] };

export default function Areas() {
  const [areas, setAreas]             = useState([]);
  const [groups, setGroups]           = useState([]);
  const [templates, setTemplates]     = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editing, setEditing]         = useState(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState(null);
  const [tab, setTab]                 = useState('groups');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [a, g, t, c] = await Promise.all([
        api.get('/api/admin/areas'),
        api.get('/api/zabbix/hostgroups'),
        api.get('/api/zabbix/templates'),
        api.get('/api/connections'),
      ]);
      setAreas(a.data);
      setGroups(g.data);
      setTemplates(t.data);
      setConnections(c.data);
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
    setTab('groups');
    setShowForm(true);
  }

  function openEdit(a) {
    setEditing(a);
    setForm({
      name: a.name,
      description: a.description || '',
      color: a.color,
      zabbix_hostgroup_ids: a.zabbix_hostgroup_ids || [],
      zabbix_template_ids: a.zabbix_template_ids || [],
      zabbix_connection_ids: a.zabbix_connection_ids || [],
    });
    setTab('groups');
    setShowForm(true);
  }

  function toggleGroup(id) {
    setForm(f => ({ ...f, zabbix_hostgroup_ids: f.zabbix_hostgroup_ids.includes(id) ? f.zabbix_hostgroup_ids.filter(x => x !== id) : [...f.zabbix_hostgroup_ids, id] }));
  }

  function toggleTemplate(id) {
    setForm(f => ({ ...f, zabbix_template_ids: f.zabbix_template_ids.includes(id) ? f.zabbix_template_ids.filter(x => x !== id) : [...f.zabbix_template_ids, id] }));
  }

  function toggleConnection(id) {
    setForm(f => ({ ...f, zabbix_connection_ids: f.zabbix_connection_ids.includes(id) ? f.zabbix_connection_ids.filter(x => x !== id) : [...f.zabbix_connection_ids, id] }));
  }

  async function save() {
    if (!form.name) return notify('Nome é obrigatório', false);
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/api/admin/areas/${editing.id}`, form);
        notify('Área atualizada!');
      } else {
        await api.post('/api/admin/areas', form);
        notify('Área criada!');
      }
      setShowForm(false);
      load();
    } catch (e) { notify(e.response?.data?.error || 'Erro ao salvar', false); }
    setSaving(false);
  }

  return (
    <div style={S.root}>
      {msg && <div style={{ ...S.toast, background: msg.ok ? 'var(--green-dim)' : 'var(--red-dim)', borderColor: msg.ok ? 'rgba(46,204,143,0.3)' : 'rgba(255,87,87,0.3)', color: msg.ok ? 'var(--green)' : 'var(--red)' }}>{msg.ok ? '✓' : '✕'} {msg.text}</div>}

      <div style={S.header}>
        <div>
          <h1 style={S.title}>Áreas</h1>
          <p style={S.sub}>{areas.length} área{areas.length !== 1 ? 's' : ''} cadastrada{areas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} style={S.btn}>+ Nova Área</button>
      </div>

      <div style={S.grid}>
        {loading ? Array(4).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height:'160px', borderRadius:'var(--radius-lg)' }} />) :
         areas.map(a => (
          <div key={a.id} style={{ ...S.card, borderTop: `3px solid ${a.color}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'12px', height:'12px', borderRadius:'50%', background: a.color, flexShrink:0 }} />
                <div style={{ fontSize:'15px', fontWeight:600, color:'var(--text-accent)' }}>{a.name}</div>
              </div>
              <button onClick={() => openEdit(a)} style={S.btnSm}>✎ Editar</button>
            </div>
            {a.description && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'10px', lineHeight:1.5 }}>{a.description}</div>}
            <div style={{ display:'flex', gap:'16px', paddingTop:'10px', borderTop:'1px solid var(--border)', flexWrap:'wrap' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'20px', fontWeight:700, color: a.color, fontFamily:'var(--font-mono)' }}>{a.user_count || 0}</div>
                <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Usuários</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'20px', fontWeight:700, color:'var(--text-accent)', fontFamily:'var(--font-mono)' }}>{(a.zabbix_hostgroup_ids || []).length}</div>
                <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Grupos</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'20px', fontWeight:700, color:'var(--purple)', fontFamily:'var(--font-mono)' }}>{(a.zabbix_template_ids || []).length}</div>
                <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Templates</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'20px', fontWeight:700, color:'var(--blue)', fontFamily:'var(--font-mono)' }}>{(a.zabbix_connection_ids || []).length}</div>
                <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Conexões</div>
              </div>
            </div>
            {(a.zabbix_connection_ids || []).length > 0 && (
              <div style={{ marginTop:'10px', display:'flex', gap:'4px', flexWrap:'wrap' }}>
                {connections.filter(c => (a.zabbix_connection_ids || []).includes(String(c.id))).map(c => (
                  <span key={c.id} style={{ fontSize:'10px', background:'var(--blue-dim)', color:'var(--blue)', border:'1px solid rgba(74,158,255,0.2)', borderRadius:'4px', padding:'2px 6px', fontFamily:'var(--font-mono)' }}>
                    ⇌ {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {areas.length === 0 && !loading && (
          <div style={{ gridColumn:'1/-1', padding:'60px', textAlign:'center', color:'var(--text-muted)', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)' }}>
            Nenhuma área cadastrada. Clique em "+ Nova Área" para começar.
          </div>
        )}
      </div>

      {showForm && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={S.modal} className="animate-in">
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>{editing ? '✎ Editar Área' : '+ Nova Área'}</div>
              <button onClick={() => setShowForm(false)} style={S.closeBtn}>✕</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.field}>
                <label style={S.label}>Nome da área *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Banco de Dados, Redes..." style={S.input} />
              </div>
              <div style={S.field}>
                <label style={S.label}>Descrição</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Responsabilidade desta área..." style={S.input} />
              </div>
              <div style={S.field}>
                <label style={S.label}>Cor</label>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      style={{ width:'28px', height:'28px', borderRadius:'50%', background:c, cursor:'pointer', border: form.color === c ? '3px solid white' : '2px solid transparent', boxSizing:'border-box', transition:'all 0.15s' }} />
                  ))}
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    style={{ width:'28px', height:'28px', borderRadius:'50%', border:'none', cursor:'pointer', padding:0 }} title="Cor personalizada" />
                </div>
              </div>

              <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'4px' }}>
                {[
                  ['groups', `⊞ Grupos (${form.zabbix_hostgroup_ids.length})`],
                  ['templates', `◫ Templates (${form.zabbix_template_ids.length})`],
                  ['connections', `⇌ Conexões (${form.zabbix_connection_ids.length})`],
                ].map(([key, label]) => (
                  <button key={key} onClick={() => setTab(key)}
                    style={{ background:'none', border:'none', borderBottom:`2px solid ${tab===key?'var(--gold)':'transparent'}`, color: tab===key?'var(--gold)':'var(--text-muted)', padding:'8px 14px', cursor:'pointer', fontSize:'12px', fontFamily:'var(--font-sans)', marginBottom:'-1px' }}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'groups' && (
                <div style={S.field}>
                  <div style={S.listBox}>
                    {groups.length === 0 ? (
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', padding:'8px', textAlign:'center' }}>Carregando grupos...</div>
                    ) : groups.map(g => (
                      <label key={g.groupid} style={{ ...S.listItem, background: form.zabbix_hostgroup_ids.includes(g.groupid) ? 'var(--blue-dim)' : 'transparent' }}>
                        <input type="checkbox" checked={form.zabbix_hostgroup_ids.includes(g.groupid)} onChange={() => toggleGroup(g.groupid)} style={{ accentColor:'var(--blue)', cursor:'pointer' }} />
                        <span style={{ fontSize:'12px', color: form.zabbix_hostgroup_ids.includes(g.groupid) ? 'var(--blue)' : 'var(--text-primary)', fontFamily:'var(--font-mono)' }}>{g.name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{form.zabbix_hostgroup_ids.length} grupo{form.zabbix_hostgroup_ids.length !== 1 ? 's' : ''} selecionado{form.zabbix_hostgroup_ids.length !== 1 ? 's' : ''}</div>
                </div>
              )}

              {tab === 'templates' && (
                <div style={S.field}>
                  <div style={S.listBox}>
                    {templates.length === 0 ? (
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', padding:'8px', textAlign:'center' }}>Carregando templates...</div>
                    ) : templates.map(t => (
                      <label key={t.templateid} style={{ ...S.listItem, background: form.zabbix_template_ids.includes(t.templateid) ? 'var(--gold-dim)' : 'transparent' }}>
                        <input type="checkbox" checked={form.zabbix_template_ids.includes(t.templateid)} onChange={() => toggleTemplate(t.templateid)} style={{ accentColor:'var(--gold)', cursor:'pointer' }} />
                        <div>
                          <div style={{ fontSize:'12px', color: form.zabbix_template_ids.includes(t.templateid) ? 'var(--gold)' : 'var(--text-primary)', fontFamily:'var(--font-mono)' }}>{t.name}</div>
                          {t.description && <div style={{ fontSize:'10px', color:'var(--text-muted)' }}>{t.description.slice(0,60)}...</div>}
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{form.zabbix_template_ids.length} template{form.zabbix_template_ids.length !== 1 ? 's' : ''} selecionado{form.zabbix_template_ids.length !== 1 ? 's' : ''}</div>
                </div>
              )}

              {tab === 'connections' && (
                <div style={S.field}>
                  <div style={S.listBox}>
                    {connections.length === 0 ? (
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', padding:'8px', textAlign:'center' }}>Nenhuma conexão cadastrada. Acesse Administração → Conexões.</div>
                    ) : connections.map(c => (
                      <label key={c.id} style={{ ...S.listItem, background: form.zabbix_connection_ids.includes(String(c.id)) ? 'var(--blue-dim)' : 'transparent' }}>
                        <input type="checkbox" checked={form.zabbix_connection_ids.includes(String(c.id))} onChange={() => toggleConnection(String(c.id))} style={{ accentColor:'var(--blue)', cursor:'pointer' }} />
                        <div>
                          <div style={{ fontSize:'12px', color: form.zabbix_connection_ids.includes(String(c.id)) ? 'var(--blue)' : 'var(--text-primary)', fontFamily:'var(--font-mono)' }}>
                            {c.name} {c.active ? <span style={{ fontSize:'10px', color:'var(--green)' }}>● ativo</span> : ''}
                          </div>
                          <div style={{ fontSize:'10px', color:'var(--text-muted)' }}>{c.url}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{form.zabbix_connection_ids.length} conexão{form.zabbix_connection_ids.length !== 1 ? 'ões' : ''} selecionada{form.zabbix_connection_ids.length !== 1 ? 's' : ''}</div>
                </div>
              )}

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
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' },
  title: { fontFamily:'var(--font-display)', fontSize:'26px', fontWeight:300, color:'var(--text-accent)' },
  sub: { fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:'2px' },
  btn: { background:'var(--gold-dim)', border:'1px solid rgba(201,168,76,0.3)', color:'var(--gold)', borderRadius:'var(--radius)', padding:'7px 16px', fontSize:'13px', cursor:'pointer', fontFamily:'var(--font-sans)' },
  btnSm: { background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'5px 10px', fontSize:'12px', cursor:'pointer', color:'var(--text-secondary)' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'16px' },
  card: { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'18px 20px' },
  toast: { position:'fixed', top:'20px', right:'20px', zIndex:999, padding:'12px 20px', borderRadius:'var(--radius)', border:'1px solid', fontSize:'13px', fontWeight:500, boxShadow:'0 4px 20px rgba(0,0,0,0.3)' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' },
  modal: { background:'var(--bg-surface)', border:'1px solid var(--border-light)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:'560px', maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' },
  modalHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid var(--border)' },
  modalTitle: { fontSize:'16px', fontWeight:600, color:'var(--text-accent)', fontFamily:'var(--font-display)' },
  modalBody: { padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px' },
  closeBtn: { background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'18px' },
  field: { display:'flex', flexDirection:'column', gap:'6px' },
  label: { fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'var(--font-mono)' },
  input: { background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'8px 12px', color:'var(--text-primary)', fontSize:'13px', outline:'none' },
  listBox: { maxHeight:'220px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'2px', background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'6px' },
  listItem: { display:'flex', alignItems:'flex-start', gap:'8px', padding:'6px 8px', borderRadius:'4px', cursor:'pointer', transition:'background 0.15s' },
};