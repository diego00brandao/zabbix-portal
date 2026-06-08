import React, { useEffect, useState } from 'react';
import api from '../services/api';

const STATUS_OPTIONS = ['To Do', 'In Progress', 'Done'];
const STATUS_COLORS = {
  'To Do':      { bg: 'var(--bg-hover)',  color: 'var(--text-muted)', border: 'var(--border)' },
  'In Progress':{ bg: 'var(--blue-dim)', color: 'var(--blue)',        border: 'rgba(74,158,255,0.3)' },
  'Done':       { bg: 'var(--green-dim)',color: 'var(--green)',       border: 'rgba(46,204,143,0.3)' },
};
const EMPTY_FORM = { title:'', description:'', related_resource:'', resource_type:'host', ticket:'', status:'To Do', progress:0 };

export default function ChangeLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    try { const res = await api.get('/api/changelog'); setEntries(res.data); } catch {}
    setLoading(false);
  }
  function notify(text, ok=true) { setMsg({text,ok}); setTimeout(()=>setMsg(null),3000); }
  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(e) { setEditing(e); setForm({title:e.title,description:e.description,related_resource:e.related_resource||'',resource_type:e.resource_type||'host',ticket:e.ticket||'',status:e.status,progress:e.progress}); setShowForm(true); }
  async function save() {
    if (!form.title) return notify('Título é obrigatório',false);
    setSaving(true);
    try {
      if (editing) { await api.put(`/api/changelog/${editing.id}`,form); notify('Atualizado!'); }
      else { await api.post('/api/changelog',form); notify('Criado!'); }
      setShowForm(false); load();
    } catch(e) { notify(e.response?.data?.error||'Erro',false); }
    setSaving(false);
  }
  async function remove(id) {
    if (!confirm('Excluir esta entrada?')) return;
    await api.delete(`/api/changelog/${id}`); load();
  }

  const filtered = entries.filter(e => {
    const matchText = !filter || e.title?.toLowerCase().includes(filter.toLowerCase()) || e.description?.toLowerCase().includes(filter.toLowerCase()) || e.ticket?.toLowerCase().includes(filter.toLowerCase());
    return matchText && (!statusFilter || e.status===statusFilter);
  });

  return (
    <div style={S.root}>
      {msg && <div style={{...S.toast,background:msg.ok?'var(--green-dim)':'var(--red-dim)',borderColor:msg.ok?'rgba(46,204,143,0.3)':'rgba(255,87,87,0.3)',color:msg.ok?'var(--green)':'var(--red)'}}>{msg.ok?'✓':'✕'} {msg.text}</div>}
      <div style={S.header}>
        <div><h1 style={S.title}>Change Log</h1><p style={S.sub}>Documentação técnica do time de Observability</p></div>
        <button onClick={openNew} style={S.btn}>+ Nova Entrada</button>
      </div>
      <div style={S.filters}>
        <input placeholder="Buscar por título, descrição ou chamado..." value={filter} onChange={e=>setFilter(e.target.value)} style={S.searchInput} />
        <div style={S.tabs}>
          {['',...STATUS_OPTIONS].map(s=>(
            <button key={s} onClick={()=>setStatusFilter(s)} style={{...S.tab,...(statusFilter===s?{background:s?STATUS_COLORS[s].bg:'var(--gold-dim)',color:s?STATUS_COLORS[s].color:'var(--gold)'}:{})}}>
              {s||'Todos'}
            </button>
          ))}
        </div>
        <span style={S.count}>{filtered.length} entrada{filtered.length!==1?'s':''}</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
        {loading ? Array(4).fill(0).map((_,i)=><div key={i} className="skeleton" style={{height:'80px',borderRadius:'var(--radius-lg)'}} />) :
         filtered.length===0 ? <div style={S.empty}>Nenhuma entrada encontrada</div> :
         filtered.map(e=>{
           const stCfg=STATUS_COLORS[e.status]||STATUS_COLORS['To Do'];
           const isExp=expanded===e.id;
           return (
             <div key={e.id} style={{...S.card,borderLeft:`3px solid ${stCfg.color}`}}>
               <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px'}}>
                 <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setExpanded(isExp?null:e.id)}>
                   <div style={{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap'}}>
                     <span style={{fontSize:'14px',fontWeight:600,color:'var(--text-accent)'}}>{e.title}</span>
                     <span style={{fontSize:'11px',fontWeight:600,color:stCfg.color,background:stCfg.bg,border:`1px solid ${stCfg.border}`,borderRadius:'4px',padding:'2px 8px',fontFamily:'var(--font-mono)'}}>{e.status}</span>
                     {e.ticket&&<span style={{fontSize:'11px',color:'var(--blue)',background:'var(--blue-dim)',border:'1px solid rgba(74,158,255,0.2)',borderRadius:'4px',padding:'2px 8px',fontFamily:'var(--font-mono)'}}>🎫 {e.ticket}</span>}
                     {e.related_resource&&<span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>◈ {e.resource_type}: {e.related_resource}</span>}
                   </div>
                   <div style={{display:'flex',gap:'12px',marginTop:'8px',alignItems:'center'}}>
                     <div style={{flex:1,height:'5px',background:'var(--bg-hover)',borderRadius:'3px',overflow:'hidden'}}>
                       <div style={{width:`${e.progress}%`,height:'100%',background:e.progress===100?'var(--green)':'var(--blue)',borderRadius:'3px'}} />
                     </div>
                     <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)',whiteSpace:'nowrap'}}>{e.progress}%</span>
                     <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>por {e.created_by}</span>
                     <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{new Date(e.created_at).toLocaleDateString('pt-BR')}</span>
                     <span style={{fontSize:'10px',color:'var(--text-muted)'}}>{isExp?'▲':'▼'}</span>
                   </div>
                 </div>
                 <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                   <button onClick={()=>openEdit(e)} style={S.btnSm}>✎</button>
                   <button onClick={()=>remove(e.id)} style={{...S.btnSm,color:'var(--red)'}}>🗑</button>
                 </div>
               </div>
               {isExp&&e.description&&(
                 <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
                   <pre style={{margin:0,fontSize:'13px',color:'var(--text-secondary)',fontFamily:'var(--font-sans)',whiteSpace:'pre-wrap',lineHeight:1.6}}>{e.description}</pre>
                 </div>
               )}
             </div>
           );
         })}
      </div>
      {showForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal} className="animate-in">
            <div style={S.modalHeader}><div style={S.modalTitle}>{editing?'✎ Editar Entrada':'+ Nova Entrada'}</div><button onClick={()=>setShowForm(false)} style={S.closeBtn}>✕</button></div>
            <div style={S.modalBody}>
              <div style={S.field}><label style={S.label}>Título *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Criado template Oracle 19c" style={S.input} /></div>
              <div style={S.field}><label style={S.label}>Descrição</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Descreva o que foi feito, motivação, impacto..." style={{...S.input,minHeight:'120px',resize:'vertical'}} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                <div style={S.field}><label style={S.label}>Tipo de Recurso</label><select value={form.resource_type} onChange={e=>setForm(f=>({...f,resource_type:e.target.value}))} style={S.select}><option value="host">Host</option><option value="template">Template</option><option value="trigger">Trigger</option><option value="item">Item</option><option value="grupo">Grupo</option><option value="outro">Outro</option></select></div>
                <div style={S.field}><label style={S.label}>Recurso Relacionado</label><input value={form.related_resource} onChange={e=>setForm(f=>({...f,related_resource:e.target.value}))} placeholder="Nome do host, template..." style={S.input} /></div>
              </div>
              <div style={S.field}><label style={S.label}>Chamado Jira / ServiceNow</label><input value={form.ticket} onChange={e=>setForm(f=>({...f,ticket:e.target.value}))} placeholder="Ex: OBS-456 ou CHG0098765" style={S.input} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                <div style={S.field}><label style={S.label}>Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={S.select}>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}</select></div>
                <div style={S.field}><label style={S.label}>Progresso: {form.progress}%</label><input type="range" min="0" max="100" step="5" value={form.progress} onChange={e=>setForm(f=>({...f,progress:parseInt(e.target.value)}))} style={{width:'100%',accentColor:'var(--blue)',marginTop:'8px'}} /></div>
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'8px'}}>
                <button onClick={()=>setShowForm(false)} style={{...S.btn,background:'var(--bg-hover)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>Cancelar</button>
                <button onClick={save} disabled={saving} style={S.btn}>{saving?'...':editing?'✓ Salvar':'✓ Criar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
const S={
  root:{padding:'28px',maxWidth:'1200px',margin:'0 auto',position:'relative'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'},
  title:{fontFamily:'var(--font-display)',fontSize:'26px',fontWeight:300,color:'var(--text-accent)'},
  sub:{fontSize:'12px',color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginTop:'2px'},
  btn:{background:'var(--gold-dim)',border:'1px solid rgba(201,168,76,0.3)',color:'var(--gold)',borderRadius:'var(--radius)',padding:'7px 16px',fontSize:'13px',cursor:'pointer'},
  btnSm:{background:'var(--bg-hover)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'5px 10px',fontSize:'12px',cursor:'pointer',color:'var(--text-secondary)'},
  filters:{display:'flex',gap:'12px',alignItems:'center',marginBottom:'16px',flexWrap:'wrap'},
  searchInput:{flex:1,minWidth:'200px',background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'8px 14px',color:'var(--text-primary)',fontSize:'13px',outline:'none'},
  tabs:{display:'flex',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'},
  tab:{background:'none',border:'none',padding:'6px 12px',color:'var(--text-muted)',cursor:'pointer',fontSize:'12px',transition:'all var(--transition)'},
  count:{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)',whiteSpace:'nowrap'},
  card:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'16px 20px'},
  empty:{padding:'40px',textAlign:'center',color:'var(--text-muted)',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)'},
  toast:{position:'fixed',top:'20px',right:'20px',zIndex:999,padding:'12px 20px',borderRadius:'var(--radius)',border:'1px solid',fontSize:'13px',fontWeight:500,boxShadow:'0 4px 20px rgba(0,0,0,0.3)'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'},
  modal:{background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius-lg)',width:'100%',maxWidth:'600px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'},
  modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid var(--border)'},
  modalTitle:{fontSize:'16px',fontWeight:600,color:'var(--text-accent)',fontFamily:'var(--font-display)'},
  modalBody:{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'},
  closeBtn:{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'18px'},
  field:{display:'flex',flexDirection:'column',gap:'6px'},
  label:{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'var(--font-mono)'},
  input:{background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text-primary)',fontSize:'13px',outline:'none',fontFamily:'var(--font-sans)'},
  select:{background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text-primary)',fontSize:'13px',outline:'none',cursor:'pointer'},
};
