import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';

const STATUS_OPTIONS = ['To Do', 'In Progress', 'Done'];
const STATUS_COLORS = {
  'To Do':      { bg: 'var(--bg-hover)',  color: 'var(--text-muted)', border: 'var(--border)' },
  'In Progress':{ bg: 'var(--blue-dim)', color: 'var(--blue)',        border: 'rgba(74,158,255,0.3)' },
  'Done':       { bg: 'var(--green-dim)',color: 'var(--green)',       border: 'rgba(46,204,143,0.3)' },
};
const EMPTY_FORM = { title:'', description:'', related_resource:'', resource_type:'host', ticket:'', status:'To Do', progress:0 };
const EMPTY_PROJECT = { name:'', description:'' };


function DescWithImages({ text }) {
  const parts = [];
  const imgRegex = /!\[.*?\]\((data:image\/[^)]+)\)/g;
  let last = 0, m;
  while ((m = imgRegex.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={last} style={{whiteSpace:'pre-wrap'}}>{text.slice(last, m.index)}</span>);
    parts.push(<img key={m.index} src={m[1]} alt="imagem" style={{maxWidth:'100%',borderRadius:'6px',margin:'8px 0',display:'block'}} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={last} style={{whiteSpace:'pre-wrap'}}>{text.slice(last)}</span>);
  return <div style={{margin:'0 0 12px 0',fontSize:'13px',color:'var(--text-secondary)',fontFamily:'var(--font-sans)',lineHeight:1.6}}>{parts}</div>;
}
export default function ChangeLog() {
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [projectForm, setProjectForm] = useState(EMPTY_PROJECT);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [attachments, setAttachments] = useState({});
  const fileRef = useRef(null);
  const [uploadingFor, setUploadingFor] = useState(null);

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { if (selectedProject) loadEntries(selectedProject.id); else setEntries([]); }, [selectedProject]);

  async function loadProjects() {
    setLoading(true);
    try { const res = await api.get('/api/changelog/projects'); setProjects(res.data); } catch {}
    setLoading(false);
  }

  async function loadEntries(projectId) {
    try {
      const res = await api.get(`/api/changelog/projects/${projectId}/entries`);
      setEntries(res.data);
      const att = {};
      for (const e of res.data) {
        try { const r = await api.get(`/api/changelog/entries/${e.id}/attachments`); att[e.id] = r.data; } catch {}
      }
      setAttachments(att);
    } catch {}
  }

  function notify(text, ok=true) { setMsg({text,ok}); setTimeout(()=>setMsg(null),3000); }

  async function saveProject() {
    if (!projectForm.name) return notify('Nome é obrigatório',false);
    setSaving(true);
    try {
      if (editingProject) { await api.put(`/api/changelog/projects/${editingProject.id}`, projectForm); notify('Projeto atualizado!'); }
      else { await api.post('/api/changelog/projects', projectForm); notify('Projeto criado!'); }
      setShowProjectForm(false); setProjectForm(EMPTY_PROJECT); setEditingProject(null); loadProjects();
    } catch(e) { notify(e.response?.data?.error||'Erro',false); }
    setSaving(false);
  }

  async function deleteProject(id) {
    if (!confirm('Excluir projeto e todas as atividades?')) return;
    await api.delete(`/api/changelog/projects/${id}`);
    if (selectedProject?.id === id) setSelectedProject(null);
    loadProjects();
  }

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }
  function openEdit(e) { setEditing(e); setForm({title:e.title,description:e.description,related_resource:e.related_resource||'',resource_type:e.resource_type||'host',ticket:e.ticket||'',status:e.status,progress:e.progress}); setShowForm(true); }

  async function save() {
    if (!form.title) return notify('Título é obrigatório',false);
    if (!selectedProject) return notify('Selecione um projeto primeiro',false);
    setSaving(true);
    try {
      if (editing) { await api.put(`/api/changelog/entries/${editing.id}`, form); notify('Atualizado!'); }
      else { await api.post(`/api/changelog/projects/${selectedProject.id}/entries`, form); notify('Criado!'); }
      setShowForm(false); loadEntries(selectedProject.id);
    } catch(e) { notify(e.response?.data?.error||'Erro',false); }
    setSaving(false);
  }

  async function remove(id) {
    if (!confirm('Excluir esta atividade?')) return;
    await api.delete(`/api/changelog/entries/${id}`); loadEntries(selectedProject.id);
  }

  async function uploadFile(entryId, file) {
    const formData = new FormData(); formData.append('file', file);
    try {
      await api.post(`/api/changelog/entries/${entryId}/attachments`, formData);
      notify('Arquivo enviado!'); loadEntries(selectedProject.id);
    } catch { notify('Erro ao enviar arquivo',false); }
  }

  async function deleteAttachment(attachId) {
    await api.delete(`/api/changelog/attachments/${attachId}`); loadEntries(selectedProject.id);
  }

  const filtered = entries.filter(e => {
    const matchText = !filter || e.title?.toLowerCase().includes(filter.toLowerCase()) || e.description?.toLowerCase().includes(filter.toLowerCase()) || e.ticket?.toLowerCase().includes(filter.toLowerCase());
    return matchText && (!statusFilter || e.status===statusFilter);
  });

  const stats = {
    total: entries.length, todo: entries.filter(e=>e.status==='To Do').length,
    inprogress: entries.filter(e=>e.status==='In Progress').length, done: entries.filter(e=>e.status==='Done').length,
    avgProgress: entries.length ? Math.round(entries.reduce((a,e)=>a+e.progress,0)/entries.length) : 0,
  };

  return (
    <div style={S.root}>
      {msg && <div style={{...S.toast,background:msg.ok?'var(--green-dim)':'var(--red-dim)',borderColor:msg.ok?'rgba(46,204,143,0.3)':'rgba(255,87,87,0.3)',color:msg.ok?'var(--green)':'var(--red)'}}>{msg.ok?'✓':'✕'} {msg.text}</div>}
      <div style={S.header}>
        <div><h1 style={S.title}>Change Log</h1><p style={S.sub}>Documentação técnica do time de Observability</p></div>
        <button onClick={()=>{setEditingProject(null);setProjectForm(EMPTY_PROJECT);setShowProjectForm(true);}} style={S.btn}>+ Novo Projeto</button>
      </div>
      <div style={S.layout}>
        <div style={S.sidebar}>
          <div style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px',fontFamily:'var(--font-mono)'}}>Projetos</div>
          <input placeholder="Buscar projeto..." value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} style={{width:'100%',marginBottom:'8px',background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'6px 10px',color:'var(--text-primary)',fontSize:'12px',outline:'none',boxSizing:'border-box'}} />
          {loading ? Array(3).fill(0).map((_,i)=><div key={i} className="skeleton" style={{height:'44px',borderRadius:'var(--radius)',marginBottom:'6px'}} />) :
           projects.filter(p=>!projectFilter||p.name.toLowerCase().includes(projectFilter.toLowerCase())).length===0 ? <div style={{fontSize:'12px',color:'var(--text-muted)',textAlign:'center',padding:'20px 0'}}>Nenhum projeto</div> :
           projects.filter(p=>!projectFilter||p.name.toLowerCase().includes(projectFilter.toLowerCase())).map(p=>(
            <div key={p.id} style={{...S.projectItem,...(selectedProject?.id===p.id?S.projectItemActive:{})}} onClick={()=>setSelectedProject(p)}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:'13px',fontWeight:600,color:selectedProject?.id===p.id?'var(--gold)':'var(--text-accent)',wordBreak:'break-word',lineHeight:1.4}}>{p.name}</div>
                <div style={{fontSize:'10px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{p.entry_count||0} atividade{p.entry_count!==1?'s':''}</div>
              </div>
              <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                <button onClick={e=>{e.stopPropagation();setEditingProject(p);setProjectForm({name:p.name,description:p.description||''});setShowProjectForm(true);}} style={S.iconBtn}>✎</button>
                <button onClick={e=>{e.stopPropagation();deleteProject(p.id);}} style={{...S.iconBtn,color:'var(--red)'}}>✕</button>
              </div>
            </div>
          ))}
        </div>
        <div style={{flex:1,minWidth:0}}>
          {!selectedProject ? (
            <div style={S.empty}><div style={{fontSize:'28px',marginBottom:'12px'}}>📁</div><div style={{fontSize:'14px',color:'var(--text-muted)'}}>Selecione um projeto ou crie um novo</div></div>
          ) : (
            <>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'16px'}}>
                <div>
                  <div style={{fontSize:'18px',fontWeight:600,color:'var(--text-accent)'}}>{selectedProject.name}</div>
                  {selectedProject.description&&<div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'2px'}}>{selectedProject.description}</div>}
                </div>
                <button onClick={openNew} style={S.btn}>+ Nova Atividade</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px',marginBottom:'16px'}}>
                {[{label:'Total',value:stats.total,color:'var(--text-accent)'},{label:'To Do',value:stats.todo,color:'var(--text-muted)'},{label:'In Progress',value:stats.inprogress,color:'var(--blue)'},{label:'Done',value:stats.done,color:'var(--green)'}].map(s=>(
                  <div key={s.label} style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'10px',textAlign:'center'}}>
                    <div style={{fontSize:'20px',fontWeight:700,fontFamily:'var(--font-mono)',color:s.color}}>{s.value}</div>
                    <div style={{fontSize:'10px',color:'var(--text-muted)',marginTop:'2px'}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{marginBottom:'16px',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                  <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>Progresso geral</span>
                  <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>{stats.avgProgress}%</span>
                </div>
                <div style={{height:'8px',background:'var(--bg-hover)',borderRadius:'4px',overflow:'hidden'}}>
                  <div style={{width:`${stats.avgProgress}%`,height:'100%',background:stats.avgProgress===100?'var(--green)':'var(--blue)',borderRadius:'4px',transition:'width 0.3s'}} />
                </div>
              </div>
              <div style={S.filters}>
                <input placeholder="Buscar atividade..." value={filter} onChange={e=>setFilter(e.target.value)} style={S.searchInput} />
                <div style={S.tabs}>
                  {['',...STATUS_OPTIONS].map(s=>(
                    <button key={s} onClick={()=>setStatusFilter(s)} style={{...S.tab,...(statusFilter===s?{background:s?STATUS_COLORS[s].bg:'var(--gold-dim)',color:s?STATUS_COLORS[s].color:'var(--gold)'}:{})}}>
                      {s||'Todas'}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                {filtered.length===0 ? <div style={S.empty}>Nenhuma atividade</div> :
                 filtered.map(e=>{
                   const stCfg=STATUS_COLORS[e.status]||STATUS_COLORS['To Do'];
                   const isExp=expanded===e.id;
                   const atts=attachments[e.id]||[];
                   return (
                     <div key={e.id} style={{...S.card,borderLeft:`3px solid ${stCfg.color}`}}>
                       <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'12px'}}>
                         <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setExpanded(isExp?null:e.id)}>
                           <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                             <span style={{fontSize:'13px',fontWeight:600,color:'var(--text-accent)'}}>{e.title}</span>
                             <span style={{fontSize:'11px',fontWeight:600,color:stCfg.color,background:stCfg.bg,border:`1px solid ${stCfg.border}`,borderRadius:'4px',padding:'2px 8px',fontFamily:'var(--font-mono)'}}>{e.status}</span>
                             {e.ticket&&<span style={{fontSize:'11px',color:'var(--blue)',background:'var(--blue-dim)',border:'1px solid rgba(74,158,255,0.2)',borderRadius:'4px',padding:'2px 8px',fontFamily:'var(--font-mono)'}}>🎫 {e.ticket}</span>}
                             {e.related_resource&&<span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>◈ {e.resource_type}: {e.related_resource}</span>}
                             {atts.length>0&&<span style={{fontSize:'11px',color:'var(--text-muted)'}}>📎 {atts.length}</span>}
                           </div>
                           <div style={{display:'flex',gap:'12px',marginTop:'6px',alignItems:'center'}}>
                             <div style={{flex:1,height:'5px',background:'var(--bg-hover)',borderRadius:'3px',overflow:'hidden'}}>
                               <div style={{width:`${e.progress}%`,height:'100%',background:e.progress===100?'var(--green)':'var(--blue)',borderRadius:'3px'}} />
                             </div>
                             <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)',whiteSpace:'nowrap'}}>{e.progress}%</span>
                             <span style={{fontSize:'11px',color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>por {e.created_by}</span>
                             <span style={{fontSize:'10px',color:'var(--text-muted)'}}>{isExp?'▲':'▼'}</span>
                           </div>
                         </div>
                         <div style={{display:'flex',gap:'4px',flexShrink:0}}>
                           <button onClick={()=>{setUploadingFor(e.id);fileRef.current?.click();}} style={S.iconBtn} title="Anexar">📎</button>
                           <button onClick={()=>openEdit(e)} style={S.iconBtn}>✎</button>
                           <button onClick={()=>remove(e.id)} style={{...S.iconBtn,color:'var(--red)'}}>🗑</button>
                         </div>
                       </div>
                       {isExp&&(
                         <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--border)'}}>
                           {e.description&&<DescWithImages text={e.description} />}
                           {atts.length>0&&(
                             <div>
                               <div style={{fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:'8px',fontFamily:'var(--font-mono)'}}>📎 Anexos</div>
                               <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                                 {atts.map(att=>(
                                   <div key={att.id} style={{display:'flex',alignItems:'center',gap:'6px',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'6px 10px'}}>
                                     <a href="#" onClick={async e=>{e.preventDefault();const r=await api.get(`/api/changelog/attachments/${att.id}/download`,{responseType:'blob'});const url=URL.createObjectURL(r.data);const a=document.createElement('a');a.href=url;a.download=att.filename;a.click();URL.revokeObjectURL(url);}} style={{fontSize:'12px',color:'var(--blue)',textDecoration:'none'}}>
                                       {att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? '🖼' : att.filename.match(/\.pdf$/i) ? '📄' : '📎'} {att.filename}
                                     </a>
                                     <span style={{fontSize:'10px',color:'var(--text-muted)'}}>{(att.size/1024).toFixed(1)}KB</span>
                                     <button onClick={()=>deleteAttachment(att.id)} style={{background:'none',border:'none',color:'var(--red)',cursor:'pointer',fontSize:'12px',padding:'0'}}>✕</button>
                                   </div>
                                 ))}
                               </div>
                             </div>
                           )}
                         </div>
                       )}
                     </div>
                   );
                 })}
              </div>
            </>
          )}
        </div>
      </div>
      <input ref={fileRef} type="file" style={{display:'none'}} accept="*/*"
        onChange={e=>{if(e.target.files[0]&&uploadingFor){uploadFile(uploadingFor,e.target.files[0]);e.target.value='';setUploadingFor(null);}}} />
      {showProjectForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowProjectForm(false)}>
          <div style={{...S.modal,maxWidth:'440px'}} className="animate-in">
            <div style={S.modalHeader}><div style={S.modalTitle}>{editingProject?'✎ Editar Projeto':'+ Novo Projeto'}</div><button onClick={()=>setShowProjectForm(false)} style={S.closeBtn}>✕</button></div>
            <div style={S.modalBody}>
              <div style={S.field}><label style={S.label}>Nome *</label><input value={projectForm.name} onChange={e=>setProjectForm(f=>({...f,name:e.target.value}))} placeholder="Ex: Criação de Templates DBA" style={S.input} autoFocus /></div>
              <div style={S.field}><label style={S.label}>Descrição</label><textarea value={projectForm.description} onChange={e=>setProjectForm(f=>({...f,description:e.target.value}))} placeholder="Objetivo do projeto..." style={{...S.input,minHeight:'80px',resize:'vertical'}} /></div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:'10px',marginTop:'8px'}}>
                <button onClick={()=>setShowProjectForm(false)} style={{...S.btn,background:'var(--bg-hover)',color:'var(--text-muted)',border:'1px solid var(--border)'}}>Cancelar</button>
                <button onClick={saveProject} disabled={saving} style={S.btn}>{saving?'...':editingProject?'✓ Salvar':'✓ Criar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showForm&&(
        <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div style={S.modal} className="animate-in">
            <div style={S.modalHeader}><div style={S.modalTitle}>{editing?'✎ Editar Atividade':'+ Nova Atividade'}</div><button onClick={()=>setShowForm(false)} style={S.closeBtn}>✕</button></div>
            <div style={S.modalBody}>
              <div style={S.field}><label style={S.label}>Título *</label><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Ex: Criado template Oracle 19c" style={S.input} /></div>
              <div style={S.field}><label style={S.label}>Descrição</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} onPaste={e=>{const items=e.clipboardData?.items;if(!items)return;for(const item of items){if(item.type.startsWith('image/')){e.preventDefault();const file=item.getAsFile();const reader=new FileReader();reader.onload=ev=>{const tag=`\n![imagem](${ev.target.result})\n`;setForm(f=>({...f,description:(f.description||'')+tag}));};reader.readAsDataURL(file);break;}}}} placeholder="Descreva o que foi feito..." style={{...S.input,minHeight:'100px',resize:'vertical'}} /></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px'}}>
                <div style={S.field}><label style={S.label}>Tipo</label><select value={form.resource_type} onChange={e=>setForm(f=>({...f,resource_type:e.target.value}))} style={S.select}><option value="host">Host</option><option value="template">Template</option><option value="trigger">Trigger</option><option value="item">Item</option><option value="grupo">Grupo</option><option value="outro">Outro</option></select></div>
                <div style={S.field}><label style={S.label}>Recurso</label><input value={form.related_resource} onChange={e=>setForm(f=>({...f,related_resource:e.target.value}))} placeholder="Nome do host, template..." style={S.input} /></div>
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
  root:{padding:'28px',maxWidth:'1400px',margin:'0 auto',position:'relative'},
  header:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'},
  title:{fontFamily:'var(--font-display)',fontSize:'26px',fontWeight:300,color:'var(--text-accent)'},
  sub:{fontSize:'12px',color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginTop:'2px'},
  btn:{background:'var(--gold-dim)',border:'1px solid rgba(201,168,76,0.3)',color:'var(--gold)',borderRadius:'var(--radius)',padding:'7px 16px',fontSize:'13px',cursor:'pointer'},
  iconBtn:{background:'var(--bg-hover)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'4px 8px',fontSize:'11px',cursor:'pointer',color:'var(--text-secondary)'},
  layout:{display:'grid',gridTemplateColumns:'240px 1fr',gap:'20px'},
  sidebar:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'16px',height:'fit-content',position:'sticky',top:'20px'},
  projectItem:{display:'flex',alignItems:'center',gap:'8px',padding:'10px',borderRadius:'var(--radius)',cursor:'pointer',marginBottom:'4px',border:'1px solid transparent',transition:'all 0.15s'},
  projectItemActive:{background:'var(--gold-dim)',border:'1px solid rgba(201,168,76,0.3)'},
  filters:{display:'flex',gap:'10px',alignItems:'center',marginBottom:'12px',flexWrap:'wrap'},
  searchInput:{flex:1,minWidth:'140px',background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'7px 12px',color:'var(--text-primary)',fontSize:'12px',outline:'none'},
  tabs:{display:'flex',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'},
  tab:{background:'none',border:'none',padding:'5px 10px',color:'var(--text-muted)',cursor:'pointer',fontSize:'11px',transition:'all var(--transition)'},
  card:{background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'14px 18px'},
  empty:{padding:'40px',textAlign:'center',color:'var(--text-muted)',background:'var(--bg-surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)'},
  toast:{position:'fixed',top:'20px',right:'20px',zIndex:999,padding:'12px 20px',borderRadius:'var(--radius)',border:'1px solid',fontSize:'13px',fontWeight:500,boxShadow:'0 4px 20px rgba(0,0,0,0.3)'},
  overlay:{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:100,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'},
  modal:{background:'var(--bg-surface)',border:'1px solid var(--border-light)',borderRadius:'var(--radius-lg)',width:'100%',maxWidth:'580px',maxHeight:'90vh',overflow:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'},
  modalHeader:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid var(--border)'},
  modalTitle:{fontSize:'16px',fontWeight:600,color:'var(--text-accent)',fontFamily:'var(--font-display)'},
  modalBody:{padding:'20px 24px',display:'flex',flexDirection:'column',gap:'14px'},
  closeBtn:{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'18px'},
  field:{display:'flex',flexDirection:'column',gap:'6px'},
  label:{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',fontFamily:'var(--font-mono)'},
  input:{background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text-primary)',fontSize:'13px',outline:'none',fontFamily:'var(--font-sans)'},
  select:{background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text-primary)',fontSize:'13px',outline:'none',cursor:'pointer'},
};
