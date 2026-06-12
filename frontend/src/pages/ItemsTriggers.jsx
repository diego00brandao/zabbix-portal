import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';

const SEV = {
  '0': { l: 'N/C',      c: 'var(--text-muted)' },
  '1': { l: 'INFO',     c: 'var(--text-muted)' },
  '2': { l: 'WARNING',  c: 'var(--blue)' },
  '3': { l: 'AVERAGE',  c: '#f59e0b' },
  '4': { l: 'HIGH',     c: 'var(--orange)' },
  '5': { l: 'DISASTER', c: 'var(--red)' },
};

const TYPE_LABELS = {
  '0':'Zabbix Agent','2':'Zabbix Trapper','3':'Simple Check','5':'Zabbix Internal',
  '7':'Zabbix Agent (Active)','10':'External Check','11':'Database Monitor',
  '12':'IPMI Agent','13':'SSH Agent','14':'Telnet Agent','15':'Calculated',
  '16':'JMX Agent','17':'SNMP Trap','18':'Dependent Item','19':'HTTP Agent','20':'SNMP Agent',
};

function cleanName(name) {
  return (name||'').replace(/\[\w+\]\{\$[^}]+\}\s*/g,'').replace(/\{\$[^}]+\}\s*/g,'').trim();
}

export default function ItemsTriggers() {
  const [items, setItems]           = useState([]);
  const [triggers, setTriggers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState({});
  const [expandedTpl, setExpandedTpl] = useState({});
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      api.get('/api/zabbix/items'),
      api.get('/api/zabbix/triggers'),
    ]).then(([iRes, tRes]) => {
      setItems(iRes.data);
      setTriggers(tRes.data);
    }).finally(() => setLoading(false));
  }, []);

  // Build item map for dependent item lookup
  const itemMap = useMemo(() => {
    const m = {};
    items.forEach(i => { m[i.itemid] = i; });
    return m;
  }, [items]);

  // Group items by template
  const grouped = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const tplName = item.hosts?.[0]?.name || 'Sem Template';
      if (!map[tplName]) map[tplName] = [];
      map[tplName].push(item);
    });
    return map;
  }, [items]);

  function getLinkedTriggers(item) {
    const key = item.key_;
    if (!key) return [];
    // Extrai o primeiro parâmetro da chave (ex: "job_exec_30min" de "db.odbc.select[job_exec_30min,...]")
    const firstParam = key.includes('[') ? key.split('[')[1]?.split(',')[0]?.split(']')[0] : null;
    return triggers.filter(t => {
      const expr = t.expression || '';
      // Match exato com a chave completa
      if (expr.includes(`/${key}]`) || expr.includes(`/${key},`) || expr.includes(`/${key}"`)) return true;
      // Match pelo primeiro parâmetro dentro dos colchetes (específico o suficiente)
      if (firstParam && firstParam.length > 4 && expr.includes(`[${firstParam},`) ) return true;
      return false;
    });
  }

  function hasLinkedTrigger(item) {
    return getLinkedTriggers(item).length > 0;
  }

  function filterItems(items) {
    const q = search.toLowerCase();
    let result;
    switch(activeFilter) {
      case 'with-triggers':     result = items.filter(i => hasLinkedTrigger(i)); break;
      case 'lld':               result = items.filter(i => i.isPrototype); break;
      case 'lld-with-triggers': result = items.filter(i => i.isPrototype && hasLinkedTrigger(i)); break;
      default:                  result = items; break;
    }
    if (!q) return result;
    return result.filter(i =>
      i.name?.toLowerCase().includes(q) ||
      i.key_?.toLowerCase().includes(q) ||
      getLinkedTriggers(i).some(t => t.description?.toLowerCase().includes(q))
    );
  }

  // Get master item name for dependent items
  function getMasterItem(item) {
    if (String(item.type) !== '18') return null;
    // Try to find master by key pattern
    const masterKey = item.key_?.split('[')[0];
    if (!masterKey) return null;
    const master = items.find(i => i.itemid !== item.itemid && i.key_?.startsWith(masterKey) && String(i.type) !== '18');
    return master?.name || null;
  }

  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase();
    return Object.keys(grouped).filter(tpl => {
      const tplItems = filterItems(grouped[tpl]);
      if (tplItems.length === 0) return false;
      if (!q) return true;
      // Search by template name
      if (tpl.toLowerCase().includes(q)) return true;
      // Search by item name, key, or linked trigger name
      return tplItems.some(i =>
        i.name?.toLowerCase().includes(q) ||
        i.key_?.toLowerCase().includes(q) ||
        getLinkedTriggers(i).some(t => t.description?.toLowerCase().includes(q))
      );
    }).sort();
  }, [grouped, search, activeFilter, triggers]);

  function toggleItem(id) { setExpanded(e => ({ ...e, [id]: !e[id] })); }
  function toggleTpl(tpl) { setExpandedTpl(e => ({ ...e, [tpl]: e[tpl] === false ? true : false })); }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Itens & Triggers</h1>
          <p style={S.sub}>Visão relacional — itens monitorados e suas triggers vinculadas</p>
        </div>
        <span style={S.count}>{Object.keys(grouped).length} templates · {items.length} itens · {triggers.length} triggers</span>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
        {[
          ['all','Todos'],
          ['with-triggers','Com Triggers'],

        ].map(([key,label]) => (
          <button key={key} onClick={() => setActiveFilter(key)}
            style={{ padding:'6px 16px', borderRadius:'var(--radius)', border:'1px solid', fontSize:'12px', cursor:'pointer',
              background: activeFilter===key ? 'var(--gold-dim)' : 'var(--bg-hover)',
              color: activeFilter===key ? 'var(--gold)' : 'var(--text-muted)',
              borderColor: activeFilter===key ? 'rgba(201,168,76,0.4)' : 'var(--border)' }}>
            {label}
          </button>
        ))}
      </div>

      <input placeholder="Buscar por template, item, chave ou trigger..." value={search}
        onChange={e => setSearch(e.target.value)} style={S.searchInput} />

      {loading ? (
        Array(4).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height:'60px', borderRadius:'var(--radius-lg)', marginBottom:'8px' }} />)
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
          {filteredTemplates.map(tpl => {
            const tplItems = filterItems(grouped[tpl]);
            const isOpen = expandedTpl[tpl] !== false;
            return (
              <div key={tpl} style={S.tplBlock}>
                {/* Template header */}
                <div style={S.tplHeader} onClick={() => toggleTpl(tpl)}>
                  <span style={{ fontSize:'12px', color:'var(--gold)', fontFamily:'var(--font-mono)' }}>◫</span>
                  <span style={S.tplName}>{tpl}</span>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)', marginLeft:'auto', fontFamily:'var(--font-mono)' }}>{tplItems.length} itens</span>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)', marginLeft:'12px' }}>{isOpen ? '▲' : '▼'}</span>
                </div>

                {isOpen && (
                  <div style={{ borderTop:'1px solid var(--border)' }}>
                    {tplItems.map(item => {
                      const linked = getLinkedTriggers(item);
                      const isItemOpen = expanded[item.itemid];
                      const typeLabel = TYPE_LABELS[item.type] || item.type;
                      const isDB = item.type === '11' || item.type === 11;
                      const isDependent = String(item.type) === '18';
                      const masterName = isDependent ? getMasterItem(item) : null;

                      return (
                        <div key={item.itemid} style={S.itemBlock}>
                          {/* Item row */}
                          <div style={S.itemRow} onClick={() => toggleItem(item.itemid)}>
                            <div style={{ flex:1, minWidth:0 }}>
                              {/* Name + badges */}
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                                <span style={{ fontSize:'13px', fontWeight:600, color:'var(--text-accent)' }}>{item.name}</span>
                                {linked.length > 0 && (
                                  <span style={{ fontSize:'10px', color:'var(--blue)', background:'var(--blue-dim)', border:'1px solid rgba(74,158,255,0.2)', borderRadius:'4px', padding:'1px 6px', fontFamily:'var(--font-mono)' }}>
                                    ◉ {linked.length} trigger{linked.length>1?'s':''}
                                  </span>
                                )}
                                {isDB && <span style={{ fontSize:'10px', color:'var(--purple)', background:'var(--purple-dim)', border:'1px solid rgba(167,139,250,0.2)', borderRadius:'4px', padding:'1px 6px', fontFamily:'var(--font-mono)' }}>SQL</span>}
                                {item.isPrototype && <span style={{ fontSize:'10px', color:'var(--orange)', background:'rgba(255,159,67,0.12)', border:'1px solid rgba(255,159,67,0.3)', borderRadius:'4px', padding:'1px 6px', fontFamily:'var(--font-mono)' }}>LLD</span>}
                              </div>
                              {/* Key only */}
                              <div style={{ marginTop:'4px' }}>
                                <span style={S.mono}>{item.key_}</span>
                              </div>
                            </div>
                            <span style={{ fontSize:'11px', color:'var(--text-muted)', flexShrink:0 }}>{isItemOpen ? '▲' : '▼'}</span>
                          </div>

                          {isItemOpen && (
                            <div style={S.itemDetail}>
                              {/* Query SQL */}
                              {item.params && (
                                <div style={{ marginBottom:'12px' }}>
                                  <div style={S.detailLabel}>Query SQL</div>
                                  <pre style={S.queryPre}>{item.params}</pre>
                                </div>
                              )}
                              {/* Linked triggers */}
                              {linked.length > 0 && (
                                <div>
                                  <div style={S.detailLabel}>Triggers Vinculadas</div>
                                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                                    {linked.map(t => {
                                      const sev = SEV[t.priority] || SEV['0'];
                                      const isActive = t.value === '1';
                                      return (
                                        <div key={t.triggerid} style={{ ...S.triggerRow, borderLeft:`3px solid ${sev.c}` }}>
                                          <div style={{ flex:1, minWidth:0 }}>
                                            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
                                              <span style={{ fontSize:'12px', fontWeight:600, color:'var(--text-accent)' }}>{cleanName(t.description)}</span>
                                              <span style={{ fontSize:'11px', fontWeight:600, color:sev.c, fontFamily:'var(--font-mono)' }}>{sev.l}</span>
                                              <span style={{ fontSize:'11px', color: t.status==='1'?'var(--red)':'var(--green)', fontFamily:'var(--font-mono)', background: t.status==='1'?'var(--red-dim)':'var(--green-dim)', padding:'1px 6px', borderRadius:'4px' }}>{t.status==='1'?'Desativado':'Ativo'}</span>
                                              {t.isPrototype && <span style={{ fontSize:'10px', color:'var(--orange)', background:'rgba(255,159,67,0.12)', border:'1px solid rgba(255,159,67,0.3)', borderRadius:'4px', padding:'1px 5px', fontFamily:'var(--font-mono)' }}>LLD</span>}
                                            </div>
                                            {t.expression && (
                                              <div style={{ marginTop:'6px' }}>
                                                <div style={S.detailLabel}>Expressão</div>
                                                <pre style={{ ...S.queryPre, fontSize:'11px' }}>{t.expression}</pre>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  root: { padding:'28px', maxWidth:'1400px', margin:'0 auto' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' },
  title: { fontFamily:'var(--font-display)', fontSize:'26px', fontWeight:300, color:'var(--text-accent)' },
  sub: { fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:'2px' },
  count: { fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:'4px' },
  searchInput: { width:'100%', background:'var(--bg-surface)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'10px 16px', color:'var(--text-primary)', fontSize:'13px', outline:'none', marginBottom:'16px', boxSizing:'border-box' },
  tplBlock: { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' },
  tplHeader: { display:'flex', alignItems:'center', gap:'10px', padding:'12px 16px', cursor:'pointer', background:'var(--bg-card)' },
  tplName: { fontSize:'13px', fontWeight:600, color:'var(--text-accent)' },
  itemBlock: { borderBottom:'1px solid var(--border)' },
  itemRow: { display:'flex', alignItems:'center', gap:'12px', padding:'12px 16px', cursor:'pointer' },
  itemDetail: { padding:'12px 20px 16px 20px', background:'var(--bg-card)', borderTop:'1px solid var(--border)' },
  triggerRow: { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px' },
  mono: { fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' },
  tag: { fontSize:'11px', color:'var(--text-muted)', background:'var(--bg-hover)', borderRadius:'4px', padding:'1px 6px', fontFamily:'var(--font-mono)' },
  detailLabel: { fontSize:'10px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', fontFamily:'var(--font-mono)', marginBottom:'6px' },
  queryPre: { margin:0, fontSize:'12px', color:'var(--text-secondary)', fontFamily:'var(--font-mono)', whiteSpace:'pre-wrap', background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px', overflowX:'auto', lineHeight:1.5 },
};
