import React, { useEffect, useState } from 'react';
import api from '../services/api';

const TOOL_LOGOS = {
  zabbix:      { icon: 'Z', color: '#d40000', bg: 'rgba(212,0,0,0.12)' },
  grafana:     { icon: 'G', color: '#f46800', bg: 'rgba(244,104,0,0.12)' },
  dynatrace:   { icon: 'D', color: '#1496ff', bg: 'rgba(20,150,255,0.12)' },
  servicenow:  { icon: 'S', color: '#62d84e', bg: 'rgba(98,216,78,0.12)' },
  datadog:     { icon: 'D', color: '#632ca6', bg: 'rgba(99,44,166,0.12)' },
  prometheus:  { icon: 'P', color: '#e6522c', bg: 'rgba(230,82,44,0.12)' },
  kibana:      { icon: 'K', color: '#00bfb3', bg: 'rgba(0,191,179,0.12)' },
  outro:       { icon: '◈', color: 'var(--gold)', bg: 'var(--gold-dim)' },
};

const EMPTY_FORM = { name: '', url: '', tool_type: 'outro', description: '' };

export default function DashboardLinks() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { const res = await api.get('/api/dashboard-links'); setLinks(res.data); } catch {}
    setLoading(false);
  }
  function notify(text, ok=true) { setMsg({text,ok}); setTimeout(()=>setMsg(null),3000); }
  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(l) { setEditing(l); setForm({name:l.name,url:l.url,tool_type:l.tool_type,description:l.description||''}); setShowForm(true); }
  async function save() {
    if (!form.name || !form.url) return notify('Nome e URL são obrigatórios',false);
    setSaving(true);
    try {
      if (editing) { await api.put(`/api/dashboard-links/${editing.id}`,form); notify('Atualizado!'); }
      else { await api.post('/api/dashboard-links',form); notify('Criado!'); }
      setShowForm(false); load();
    } catch(e) { notify(e.response?.data?.error||'Erro',false); }
    setSaving(false);
  }
  async function remove(id) {
    if (!confirm('Remover este link?')) return;
    await api.delete(`/api/dashboard-links/${id}`); load();
  }

  return (
    <div style={S.root}>
      {msg && <div style={{...S.toast,background:msg.ok?'var(--green-dim)':'var(--red-dim)',borderColor:msg.ok?'rgba(46,204,143,0.3)':'rgba(255,87,87,0.3)',color:msg.ok?'var(--green)':'var(--red)'}}>{msg.ok?'✓':'✕'} {msg.text}</div>}
      <div style={S.header}>
        <div><h1 style={S.title}>Ferramentas</h1><p style={S.sub}>Links rápidos para suas ferramentas de monitoração</p></div>
        <button onClick={openNew} style={S.btn}>+ Adicionar Ferramenta</button>
      </div>

      {loading ? (
        <div style={S.grid}>{Array(6).fill(0).map((_,i)=><div key={i} className="skeleton" style={{height:'120px',borderRadius:'var(--radius-lg)'}} />)}</div>
      ) : links.length === 0 ? (
        <div style={S.empty}>
          <div style={{fontSize:'32px',marginBottom:'12px'}}>◈</div>
          <div style={{fontSize:'14px',color:'var(--text-muted)',marginBottom:'8px'}}>Nenhuma ferramenta cadastrada</div>
          <button onClick={openNew} style={S.btn}>+ Adicionar primeira ferramenta</button>
        </div>
      ) : (
        <div style={S.grid}>
          {links.map(l => {
            const logo = TOOL_LOGOS[l.tool_type] || TOOL_LOGOS.outro;
            return (
              <div key={l.id} style={S.card}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
                  <div style={{...S.logo,color:logo.color,background:logo.bg}}>{logo.icon}</div>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>openEdit(l)} style={S.btnSm}>✎</button>
                    <button onClick={()=>remove(l.id)} style={{...S.btnSm,color:'var(--red)'}}>✕</button>
                  </div>
                </div>
                <div style={{fontSize:'14px',fontWeight:600,color:'var(--text-accent)',marginBottom:'4px'}}>{l.name}</div>
                {l.description && <div style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'8px',lineHeight:1.4}}>{l.description}</div>}
                <a href={l.url} target="_blank" rel="noopener noreferrer" style={{fontSize:'11px',color:'var(--blue)',fontFamily:'var(--font-mono)',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  ↗ {l.url}
                </a>
              </div>
            );
          })}
          <div style={{...S.card,...S.addCard}} onClick={openNew}>
            <div style={{fontSize:'24px',color:'var(--text-muted)',marginBottom:'8px'}}>+</div>
            <div style={{fontSize:'12px',color:'var(--text-muted)'}}>Adicionar ferramenta</div>
          </div>
        </div>
      )}

      {showForm && (
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal} className="animate-in">
            <div style={S.modalHeader}><div style={S.modalTitle}>{editing?'✎ Editar Ferramenta':'+ Nova Ferramenta'}</div><button onClick={()=>setShowForm(false)} style={S.closeBtn}>✕</button></div>
            <div style={S.modalBody}>
              <div style={S.field}><label style={S.label}>Tipo</label>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {Object.entries(TOOL_LOGOS).map(([key,val])=>(
                    <button key={key} onClick={()=>setForm(f=>({...f,tool_type:key}))}
                      style={{padding:'6px 12px',borderRadius:'var(--radius)',border:`1px solid ${form.tool_type===key?val.color:'var(--border)'}`,background:form.tool_type===key?val.bg:'var(--bg-hover)',color:form.tool_type===key?val.color:'var(--text-muted)',cursor:'pointer',fontSize:'12px',textTransform:'capitalize'}}>
                      {key}
                    </button>
                  ))}
                </div>
              </div>
              <div style={S.field}><label style={S.label}>Nome *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Grafana Produção" style={S.input} /></div>
              <div style={S.field}><label style={S.label}>URL *</label><input value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} placeholder="https://grafana.empresa.com" style={S.input} /></div>
              <div style={S.field}><label style={S.label}>Descrição</label><input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Breve descrição..." style={S.input} /></div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'8px'}}>
                <button onClick={()=>setShowForm(false)} style={{...S.btn,background:'var(--bg-hover)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>Cancelar</button>
                <button onClick={save} disabled={saving} style={S.btn}>{saving?'...':editing?'✓ Salvar':'✓ Adicionar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root:{padding:'28px',maxWidth:'1200px',margin:'0 auto',position:'relative'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'24px'},
  title:{fontFamily:'var(--font-display)',fontSize:'26px',fontWeight:300,color:'var(--text-accent)'},
  sub:{fontSize:'12px',color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginTop:'2px'},
  btn:{background:'var(--gold-dim)',border:'1px solid rgba(201,168,76,0.3)',color:'var(--gold)',borderRadius:'var(--radius)',padding:'7px 16px',fontSize:'13px',cursor:'pointer'},
  btnSm:{background:'var(--bg-hover)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'4px 8px',fontSize:'11px',cursor:'pointer',color:'var(--text-secondary)'},
  grid:{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'16px'},
  card:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'20px'},
  addCard:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',border:'1px dashed var(--border)',background:'transparent',minHeight:'120px'},
  logo:{width:'40px',height:'40px',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:700},
  empty:{padding:'60px',textAlign:'center',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)'},
  toast:{position:'fixed',top:'20px',right:'20px',zIndex:999,padding:'12px 20px',borderRadius:'var(--radius)',border:'1px solid',fontSize:'13px',fontWeight:500,boxShadow:'0 4px 20px rgba(0,0,0,0.3)'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'},
  modal:{background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius-lg)',width:'100%',maxWidth:'500px',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',overflow:'hidden'},
  modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid var(--border)'},
  modalTitle:{fontSize:'16px',fontWeight:600,color:'var(--text-accent)',fontFamily:'var(--font-display)'},
  modalBody:{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'},
  closeBtn:{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'18px'},
  field:{display:'flex',flexDirection:'column',gap:'6px'},
  label:{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'var(--font-mono)'},
  input:{background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text-primary)',fontSize:'13px',outline:'none'},
};
