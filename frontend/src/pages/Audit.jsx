import React, { useEffect, useState, useMemo } from 'react';
import api from '../services/api';

const PERIODS = ['5m','15m','30m','1h','3h','6h','12h','1d','2d','7d','30d','60d','1y'];

const ACTION_MAP = {
  '0':        { l: 'Criado',      c: '#2ecc8f', bg: 'rgba(46,204,143,0.10)', risk: 'low'      },
  '1':        { l: 'Atualizado',  c: '#4a9eff', bg: 'rgba(74,158,255,0.10)', risk: 'medium'   },
  '2':        { l: 'Removido',    c: '#ff5757', bg: 'rgba(255,87,87,0.12)',  risk: 'critical' },
  '3':        { l: 'Login',       c: '#94a3b8', bg: 'rgba(148,163,184,0.10)',risk: 'info'     },
  '4':        { l: 'Logout',      c: '#94a3b8', bg: 'rgba(148,163,184,0.10)',risk: 'info'     },
  '5':        { l: 'Habilitado',  c: '#2ecc8f', bg: 'rgba(46,204,143,0.10)', risk: 'low'      },
  '6':        { l: 'Desabilitado',c: '#f59e0b', bg: 'rgba(245,158,11,0.12)', risk: 'high'     },
  '8':        { l: 'Logout',      c: '#94a3b8', bg: 'rgba(148,163,184,0.10)',risk: 'info'     },
  'disabled': { l: 'Desativado',  c: '#f59e0b', bg: 'rgba(245,158,11,0.12)', risk: 'high'     },
  'enabled':  { l: 'Ativado',     c: '#2ecc8f', bg: 'rgba(46,204,143,0.10)', risk: 'low'      },
};

const RESOURCE_MAP = {
  '0':  { l: 'Sistema',          icon: '⚙'  },
  '4':  { l: 'Host',             icon: '⬡'  },
  '6':  { l: 'Gráfico',          icon: '📈' },
  '13': { l: 'Trigger',          icon: '◉'  },
  '15': { l: 'Item',             icon: '≡'  },
  '17': { l: 'Macro',            icon: '⊙'  },
  '30': { l: 'Template',         icon: '◫'  },
  '31': { l: 'Trigger Prot.',    icon: '◉'  },
  '35': { l: 'Gráfico Prot.',    icon: '📈' },
  '36': { l: 'Item Prot.',       icon: '≡'  },
  '43': { l: 'Grupo de Hosts',   icon: '⊞'  },
  '45': { l: 'Dashboard',        icon: '▦'  },
  '52': { l: 'Discovery',        icon: '◎'  },
};

const RELEVANT_RESOURCES = new Set(['4','13','15','30','31','36','43','52']);
const HIGH_RISK_ACTIONS   = new Set(['2','6']);
const CRITICAL_RESOURCES  = new Set(['4','13','15','30']);

const RISK_CONFIG = {
  critical: { l: 'Crítico', c: '#ff5757', bg: 'rgba(255,87,87,0.12)',  border: 'rgba(255,87,87,0.25)'  },
  high:     { l: 'Alto',    c: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' },
  medium:   { l: 'Médio',   c: '#4a9eff', bg: 'rgba(74,158,255,0.10)', border: 'rgba(74,158,255,0.20)' },
  low:      { l: 'Baixo',   c: '#2ecc8f', bg: 'rgba(46,204,143,0.10)', border: 'rgba(46,204,143,0.20)' },
  info:     { l: 'Info',    c: '#94a3b8', bg: 'rgba(148,163,184,0.08)',border: 'rgba(148,163,184,0.15)' },
};

function getRisk(log) {
  const action   = getEffectiveAction(log);
  const resource = String(log.resourcetype);
  if (action === '2') return 'critical';
  if (action === 'disabled' && CRITICAL_RESOURCES.has(resource)) return 'high';
  if (action === 'disabled') return 'high';
  if (action === '1' && CRITICAL_RESOURCES.has(resource)) return 'medium';
  if (action === '0' || action === 'enabled') return 'low';
  return ACTION_MAP[action]?.risk || 'info';
}


function getEffectiveAction(log) {
  const action = String(log.action);
  if (action !== '1') return action;

  // Tenta parsear os details
  let details = log.details;
  if (typeof details === 'string') {
    try { details = JSON.parse(details); } catch { return action; }
  }
  if (!details) return action;

  // Formato do Zabbix 7: { "host.status": ["update", oldval, newval] }
  const statusEntry = details['host.status'] || details['status'] ||
    details['trigger.status'] || details['item.status'] ||
    details['template.status'];

  if (statusEntry && Array.isArray(statusEntry)) {
    const newval = statusEntry[statusEntry.length - 1];
   if (newval === 1 || newval === '1') return 'enabled';
    if (newval === 0 || newval === '0') return 'disabled';
  }

  // Tenta pelo formato antigo {key: {old, new}}
  const entries = Object.entries(details);
  for (const [key, val] of entries) {
    if (key.includes('status')) {
      const newval = Array.isArray(val) ? val[val.length-1] : val?.new;
      if (newval === 1 || newval === '1') return 'disabled';
      if (newval === 0 || newval === '0') return 'enabled';
    }
  }

  return action;
}

function formatDetails(details) {
  if (!details) return [];
  if (typeof details === 'string') { try { details = JSON.parse(details); } catch { return []; } }
  if (Array.isArray(details)) return details;
  return Object.entries(details).map(([key, val]) => {
    // Formato Zabbix 6: ["update", oldval, newval]
    if (Array.isArray(val) && val[0] === 'update') {
      return { key: key.replace(/^[^.]+\./, ''), oldval: val[1] ?? '', newval: val[2] ?? '' };
    }
    // Formato Zabbix 6: ["add", newval] ou ["delete", oldval]
    if (Array.isArray(val) && val[0] === 'add') return { key: key.replace(/^[^.]+\./, ''), oldval: '', newval: val[1] ?? '' };
    if (Array.isArray(val) && val[0] === 'delete') return { key: key.replace(/^[^.]+\./, ''), oldval: val[1] ?? '', newval: '' };
    return { key: key.replace(/^[^.]+\./, ''), oldval: val?.old ?? '', newval: val?.new ?? val ?? '' };
  });
}

function getChangeSummary(details) {
  const parsed = formatDetails(details);
  if (!parsed.length) return null;
  const important = ['status','name','delay','url','expression','priority','value_type'];
  const relevant  = parsed.filter(d => important.some(k => d.key?.toLowerCase().includes(k)));
  const toShow    = relevant.length > 0 ? relevant : parsed.slice(0, 2);
  return toShow.map(d => {
    if (d.key === 'status') {
      const was = d.oldval === '0' ? 'Ativo' : d.oldval === '1' ? 'Desabilitado' : d.oldval;
      const now = d.newval === '0' ? 'Ativo' : d.newval === '1' ? 'Desabilitado' : d.newval;
      return `${was || '?'} → ${now || '?'}`;
    }
    if (d.oldval && d.newval) return `${d.key}: ${String(d.oldval).slice(0,30)} → ${String(d.newval).slice(0,30)}`;
    return `${d.key}: ${d.newval || d.oldval || '?'}`;
  }).join('  ·  ');
}

function formatTime(clock) {
  if (!clock) return '—';
  return new Date(parseInt(clock)*1000).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function formatTimeShort(clock) {
  if (!clock) return '—';
  const d    = new Date(parseInt(clock)*1000);
  const diff = Date.now() - d;
  if (diff < 60000)    return 'agora';
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m atrás`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
  return d.toLocaleDateString('pt-BR');
}

function isSuspicious(log) {
  const hour = new Date(parseInt(log.clock)*1000).getHours();
  return (hour >= 22 || hour < 6) && HIGH_RISK_ACTIONS.has(String(log.action));
}

function isOffHours(clock) {
  if (!clock) return false;
  const hour = new Date(parseInt(clock)*1000).getHours();
  return hour >= 22 || hour < 6;
}

function StatCard({ icon, label, value, sub, color, alert, active, onClick }) {
  return (
    <div onClick={onClick} style={{ background: active ? `${color}18` : alert ? `${color}10` : 'var(--bg-card)', border: `1px solid ${active ? color+'60' : alert ? color+'35' : 'var(--border)'}`, borderRadius: '10px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative', overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: 'all 0.15s' }}>
      {(active||alert) && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: color }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '28px', fontWeight: 700, color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function RiskBadge({ risk }) {
  const cfg = RISK_CONFIG[risk] || RISK_CONFIG.info;
  return <span style={{ fontSize: '10px', fontWeight: 700, color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '4px', padding: '2px 7px', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{cfg.l}</span>;
}

function ActionBadge({ action }) {
  const cfg = ACTION_MAP[action] || { l: action, c: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };
  return <span style={{ fontSize: '11px', fontWeight: 600, color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.c}30`, borderRadius: '4px', padding: '3px 9px', fontFamily: 'var(--font-mono)' }}>{cfg.l}</span>;
}

function ExpandedDetail({ log }) {
  const resource = RESOURCE_MAP[String(log.resourcetype)] || { l: log.resourcetype, icon: '◈' };
  const diffs = formatDetails(log.details);
  const hasDiff = diffs.some(d => d.oldval !== '' || d.newval !== '');
  return (
    <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{resource.icon}</span>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-accent)' }}>{log.resourcename || '—'}</span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>· por <b style={{ color: 'var(--text-secondary)' }}>{log.username || log.userid}</b></span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>· {formatTime(log.clock)}</span>
        {log.parentHost && (
          <span style={{ fontSize: '11px', color: log.parentHost.isTemplate ? 'var(--gold)' : 'var(--blue)', fontFamily: 'var(--font-mono)' }}>
            {log.parentHost.isTemplate ? '◫' : '⬡'} {log.parentHost.name}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: hasDiff ? '14px' : '0' }}>
        {[
          { label: 'IP de Origem',  value: log.ip || '—', icon: '🌐' },
          { label: 'Host/Template', value: log.parentHost?.name || (String(log.resourcetype)==='2' ? log.resourcename : '—'), icon: log.parentHost?.isTemplate ? '◫' : '⬡' },
          { label: 'Resource ID',   value: log.resourceid || '—', icon: '🔑' },
          { label: 'Horário',       value: isOffHours(log.clock) ? '⚠ Fora do horário' : '✓ Horário comercial', icon: '🕐' },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ background: 'var(--bg-hover)', borderRadius: '6px', padding: '8px 12px' }}>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{icon} {label}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{value}</div>
          </div>
        ))}
      </div>
      {hasDiff && (
        <div style={{ marginTop: '4px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
            ◈ Mudanças detectadas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {diffs.map((d, i) => (
              <div key={i} style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)' }}>
                  {d.key}
                </div>
                {d.oldval !== '' && (
                  <div style={{ display: 'flex', gap: '8px', padding: '8px 10px', background: 'rgba(255,87,87,0.06)', borderTop: '1px solid rgba(255,87,87,0.15)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff5757', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>− ANTES</span>
                    <pre style={{ margin: 0, fontSize: '11px', color: '#ff9999', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>{String(d.oldval)}</pre>
                  </div>
                )}
                {d.newval !== '' && (
                  <div style={{ display: 'flex', gap: '8px', padding: '8px 10px', background: 'rgba(46,204,143,0.06)', borderTop: '1px solid rgba(46,204,143,0.15)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#2ecc8f', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>+ DEPOIS</span>
                    <pre style={{ margin: 0, fontSize: '11px', color: '#7dffcc', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flex: 1 }}>{String(d.newval)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ObjectTimeline({ logs, targetName, onClose }) {
  const objectLogs = logs.filter(l => l.resourcename === targetName).sort((a,b) => parseInt(b.clock)-parseInt(a.clock));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '12px', width: '100%', maxWidth: '680px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-accent)' }}>Histórico do Objeto</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>{targetName} · {objectLogs.length} eventos</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column' }}>
          {objectLogs.map((log, i) => {
            const risk    = getRisk(log);
            const riskCfg = RISK_CONFIG[risk];
            return (
              <div key={log.auditid||i} style={{ display: 'flex', gap: '16px', position: 'relative' }}>
                {i < objectLogs.length-1 && <div style={{ position: 'absolute', left: '15px', top: '32px', bottom: '-8px', width: '2px', background: 'var(--border)' }} />}
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: riskCfg.bg, border: `2px solid ${riskCfg.c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1, fontSize: '12px' }}>
                  {RESOURCE_MAP[String(log.resourcetype)]?.icon || '◈'}
                </div>
                <div style={{ flex: 1, paddingBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <ActionBadge action={String(log.action)} />
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>por <b>{log.username||log.userid}</b></span>
                    {log.parentHost && <span style={{ fontSize: '11px', color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}>⬡ {log.parentHost.name}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{formatTime(log.clock)}</span>
                    {log.ip && <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>IP: {log.ip}</span>}
                  </div>
                  {getChangeSummary(log.details) && (
                    <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-hover)', borderRadius: '4px', padding: '4px 8px', fontFamily: 'var(--font-mono)' }}>
                      {getChangeSummary(log.details)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {objectLogs.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Nenhum evento para este objeto</div>}
        </div>
      </div>
    </div>
  );
}

export default function Audit() {
  const [logs, setLogs]                     = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState('');
  const [lastUpdate, setLastUpdate]         = useState(null);
  const [search, setSearch]                 = useState('');
  const [actionFilter, setActionFilter]     = useState('');
  const [riskFilter, setRiskFilter]         = useState('');
  const [showAll, setShowAll]               = useState(true);
  const [expanded, setExpanded]             = useState(null);
  const [objectTimeline, setObjectTimeline] = useState(null);
  const [activeTab, setActiveTab]           = useState('feed');
  const [typeFilter, setTypeFilter]         = useState('');
  const [userFilter, setUserFilter]         = useState('');
  const [showUsers, setShowUsers]           = useState(false);
  const [page, setPage]                     = useState(1);
  const [period, setPeriod]                 = useState('1d');
  const [customMode, setCustomMode]         = useState(false);
  const [dateFrom, setDateFrom]             = useState('');
  const [dateTo, setDateTo]                 = useState('');

  useEffect(() => { fetchLogs('1d'); }, []);

  async function fetchLogs(p, from, to) {
    setLoading(true);
    try {
      let url;
      if (from && to) {
        url = `/api/zabbix/audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      } else {
        url = `/api/zabbix/audit?period=${p || period}`;
      }
      const res = await api.get(url);
      setLogs(res.data);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar audit log');
    } finally { setLoading(false); }
  }

  const enrichedLogs = useMemo(() => logs.map(l => ({
    ...l,
    _risk:            getRisk(l),
    _effectiveAction: getEffectiveAction(l),
    _suspicious:      isSuspicious(l),
    _offHours:        isOffHours(l.clock),
    _details:         formatDetails(l.details),
    _summary:         getChangeSummary(l.details),
  })), [logs]);

  // Group events by recordsetid to collapse bulk operations
  const groupedLogs = useMemo(() => {
    const groups = {};
    enrichedLogs.forEach(l => {
      const key = l.recordsetid || l.auditid;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    return Object.values(groups).map(group => {
      if (group.length === 1) return group[0];
      // Multiple events in same recordset - find the "main" one (host creation)
      const main = group.find(l => String(l.resourcetype) === '4') || group[0];
      return {
        ...main,
        _groupCount: group.length,
        _groupTypes: [...new Set(group.map(l => RESOURCE_MAP[String(l.resourcetype)]?.l || l.resourcetype))],
        _groupItems: group,
      };
    });
  }, [enrichedLogs]);

  const filtered = useMemo(() => groupedLogs.filter(l => {
    if (!showAll && !RELEVANT_RESOURCES.has(String(l.resourcetype))) return false;
    if (typeFilter && String(l.resourcetype) !== typeFilter) return false;
    if (userFilter && (l.username||l.userid) !== userFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!l.username?.toLowerCase().includes(q) &&
          !l.resourcename?.toLowerCase().includes(q) &&
          !l.parentHost?.name?.toLowerCase().includes(q) &&
          !l.ip?.includes(q) &&
          !l._summary?.toLowerCase().includes(q)) return false;
    }
    if (actionFilter && l._effectiveAction !== actionFilter) return false;
    if (riskFilter   && l._risk          !== riskFilter)   return false;
    return true;
  }), [groupedLogs, showAll, search, actionFilter, riskFilter, typeFilter, userFilter]);

  React.useEffect(() => { setPage(1); }, [search, actionFilter, riskFilter, typeFilter, userFilter]);

  const analytics = useMemo(() => {
    const today   = new Date(); today.setHours(0,0,0,0);
    const todayTs = today.getTime()/1000;
    const todayLogs    = enrichedLogs.filter(l => parseInt(l.clock) >= todayTs);
    const criticalLogs = enrichedLogs.filter(l => l._risk === 'critical');
    const userCount    = {}; enrichedLogs.forEach(l => { const u = l.username||l.userid||'?'; userCount[u] = (userCount[u]||0)+1; });
    const topUser      = Object.entries(userCount).sort((a,b) => b[1]-a[1])[0];
    const actionCount  = {}; enrichedLogs.forEach(l => { const a = String(l.action); actionCount[a] = (actionCount[a]||0)+1; });
    const resourceCount= {}; enrichedLogs.filter(l => RELEVANT_RESOURCES.has(String(l.resourcetype))).forEach(l => { const r = String(l.resourcetype); resourceCount[r] = (resourceCount[r]||0)+1; });
    const objectCount  = {}; enrichedLogs.forEach(l => { if (l.resourcename) objectCount[l.resourcename] = (objectCount[l.resourcename]||0)+1; });
    const topObjects   = Object.entries(objectCount).sort((a,b) => b[1]-a[1]).slice(0,5);
    const hourDist     = Array(24).fill(0); enrichedLogs.forEach(l => { if (l.clock) hourDist[new Date(parseInt(l.clock)*1000).getHours()]++; });
    const peakHour     = hourDist.indexOf(Math.max(...hourDist));
    return { todayCount: todayLogs.length, criticalCount: criticalLogs.length, topUser, actionCount, resourceCount, topObjects, hourDist, peakHour, uniqueUsers: Object.keys(userCount).length, userCount };
  }, [enrichedLogs]);

  const uniqueActions = useMemo(() => [...new Set(logs.map(l => String(l.action)))].filter(Boolean), [logs]);

  function downloadCSV() {
    const header = ['Data/Hora','Usuário','Ação','Risco','Objeto','Host/Template','IP','Resumo da Mudança'];
    const rows   = filtered.map(l => [
      formatTime(l.clock), l.username||l.userid||'—',
      ACTION_MAP[String(l.action)]?.l||l.action,
      RISK_CONFIG[l._risk]?.l||l._risk,
      l.resourcename||'—', l.parentHost?.name||'—', l.ip||'—', l._summary||'—',
    ]);
    const csv = '\uFEFF' + [header,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = `audit_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Audit Log</h1>
          <p style={S.sub}>Alterações em hosts, triggers, itens e templates</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {lastUpdate && <span style={S.lastUpdate}><span style={{ width:'6px',height:'6px',borderRadius:'50%',background:'#2ecc8f',display:'inline-block' }} />{lastUpdate.toLocaleTimeString('pt-BR')}</span>}
          <button onClick={() => fetchLogs(period)} disabled={loading} style={S.btnSecondary}>{loading?'⟳':'↺'} Atualizar</button>
          <button onClick={downloadCSV} style={S.btnExport}>⤓ CSV</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:'12px', marginBottom:'20px' }}>
        <StatCard icon="📋" label="Total" value={enrichedLogs.length} sub={`${analytics.todayCount} hoje`} color="var(--text-accent)" active={!typeFilter} onClick={() => setTypeFilter('')} />
        <StatCard icon="◉"  label="Triggers"  value={groupedLogs.filter(l=>String(l.resourcetype)==='13').length||0} sub="alterações" color="#ff9f43" active={typeFilter==='13'} onClick={() => setTypeFilter(t => t==='13'?'':'13')} />
        <StatCard icon="≡"  label="Itens"     value={groupedLogs.filter(l=>String(l.resourcetype)==='15').length||0} sub="alterações" color="#a78bfa" active={typeFilter==='15'} onClick={() => setTypeFilter(t => t==='15'?'':'15')} />
        <StatCard icon="◫"  label="Templates" value={groupedLogs.filter(l=>String(l.resourcetype)==='30').length||0} sub="alterações" color="#4a9eff" active={typeFilter==='30'} onClick={() => setTypeFilter(t => t==='30'?'':'30')} />
        <StatCard icon="⬡"  label="Hosts"     value={groupedLogs.filter(l=>String(l.resourcetype)==='4').length}  sub="alterações" color="#2ecc8f" active={typeFilter==='4'}  onClick={() => setTypeFilter(t => t==='4'?'':'4')} />
        <StatCard icon="👥" label="Usuários"  value={analytics.uniqueUsers} sub={analytics.topUser?`+ ativo: ${analytics.topUser[0]}`:''} color="#94a3b8" onClick={() => setShowUsers(true)} />
      </div>
      {error && <div style={S.errorBanner}>⚠ {error}</div>}

      <div style={S.tabs}>
        {[['feed','Feed']].map(([key,label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{ ...S.tab, ...(activeTab===key?S.tabActive:{}) }}>{label}</button>
        ))}
      </div>

      {activeTab === 'feed' && (
        <>
          {/* Seletor de período */}
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center', marginBottom:'14px' }}>
            {!customMode && PERIODS.map(p => (
              <button key={p} onClick={() => { setPeriod(p); fetchLogs(p); }}
                style={{ padding:'5px 12px', borderRadius:'var(--radius)', border:'1px solid', fontSize:'11px', cursor:'pointer', fontFamily:'var(--font-mono)', transition:'all 0.15s',
                  background: period===p ? 'var(--gold-dim)' : 'var(--bg-hover)',
                  color: period===p ? 'var(--gold)' : 'var(--text-muted)',
                  borderColor: period===p ? 'rgba(201,168,76,0.4)' : 'var(--border)' }}>
                {p}
              </button>
            ))}
            <button onClick={() => setCustomMode(c => !c)}
              style={{ padding:'5px 12px', borderRadius:'var(--radius)', border:'1px solid', fontSize:'11px', cursor:'pointer', fontFamily:'var(--font-mono)',
                background: customMode ? 'var(--purple-dim)' : 'var(--bg-hover)',
                color: customMode ? 'var(--purple)' : 'var(--text-muted)',
                borderColor: customMode ? 'rgba(167,139,250,0.4)' : 'var(--border)' }}>
              {customMode ? '✕ Fechar' : '⊞ Personalizado'}
            </button>
          </div>

          {customMode && (
            <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', flexWrap:'wrap', background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:'14px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                <label style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', textTransform:'uppercase' }}>De</label>
                <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ background:'var(--bg-surface)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'6px 10px', color:'var(--text-primary)', fontSize:'12px', fontFamily:'var(--font-mono)', outline:'none' }} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                <label style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', textTransform:'uppercase' }}>Até</label>
                <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ background:'var(--bg-surface)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'6px 10px', color:'var(--text-primary)', fontSize:'12px', fontFamily:'var(--font-mono)', outline:'none' }} />
              </div>
              <button onClick={() => { if (dateFrom && dateTo) fetchLogs(null, dateFrom, dateTo); }}
                disabled={!dateFrom || !dateTo}
                style={{ padding:'6px 16px', borderRadius:'var(--radius)', border:'1px solid rgba(201,168,76,0.4)', background:'var(--gold-dim)', color:'var(--gold)', fontSize:'12px', cursor:'pointer', opacity:(!dateFrom||!dateTo)?0.5:1 }}>
                ◈ Buscar
              </button>
            </div>
          )}

          <div style={S.filters}>
            <input placeholder="Buscar por usuário, objeto, host, IP ou mudança..." value={search} onChange={e => setSearch(e.target.value)} style={S.searchInput} />
            <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={S.select}>
              <option value="">Todas as ações</option>
              <option value="0">Criado</option>
              <option value="2">Removido</option>
              <option value="enabled">Ativado</option>
              <option value="disabled">Desativado</option>
              <option value="1">Atualizado</option>
            </select>
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)} style={S.select}>
              <option value="">Todos os riscos</option>
              {Object.entries(RISK_CONFIG).map(([k,v]) => <option key={k} value={k}>{v.l}</option>)}
            </select>
            <span style={S.count}>{filtered.length} evento{filtered.length!==1?'s':''}</span>
          </div>
          <div style={S.table}>
            <div style={S.tableHeader}>
              <span>Horário</span><span>Usuário</span><span>Ação</span><span>Risco</span>
              <span>Afetado</span><span>IP</span><span>Flags</span>
            </div>
            {loading ? Array(8).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height:'56px', margin:'3px 0', borderRadius:'6px' }} />) :
             filtered.length === 0 ? <div style={S.empty}>Nenhum evento encontrado</div> :
             filtered.slice((page-1)*50, page*50).map((log, i) => {
               const isExp      = expanded === (log.auditid||i);
               const hasDetails = log._details.length > 0;
               return (
                 <div key={log.auditid||i} style={{ borderBottom:'1px solid var(--border)', borderLeft: log._suspicious?'3px solid #ff5757':log._risk==='high'?'3px solid #f59e0b':'3px solid transparent' }}>
                   <div style={{ ...S.row, cursor: hasDetails?'pointer':'default', background: isExp?'var(--bg-card)':'transparent' }}
                     onClick={() => hasDetails && setExpanded(isExp?null:(log.auditid||i))}
                     onMouseEnter={e => { if (!isExp) e.currentTarget.style.background='var(--bg-hover)'; }}
                     onMouseLeave={e => { if (!isExp) e.currentTarget.style.background='transparent'; }}>

                     <div>
                       <div style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{formatTimeShort(log.clock)}</div>
                       <div style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>
                         {log.clock ? new Date(parseInt(log.clock)*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '—'}
                       </div>
                     </div>

                     <div style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{log.username||log.userid||'—'}</div>
                     <ActionBadge action={log._effectiveAction} />
                     <RiskBadge risk={log._risk} />

                     <div style={{ overflow:'hidden' }}>
                       <div style={{ fontSize:'13px', color:'var(--text-accent)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor: log.resourcename?'pointer':'default' }}
                         onClick={e => { e.stopPropagation(); if (log.resourcename) setObjectTimeline(log.resourcename); }}
                         title={log.resourcename?'Ver histórico completo':''}>
                         {log.resourcename||'—'}
                         {log.resourcename && <span style={{ fontSize:'10px', color:'#4a9eff', marginLeft:'4px' }}>⊙</span>}
                       </div>
                       {log.parentHost && (
                         <div style={{ fontSize:'11px', color: log.parentHost.isTemplate?'var(--gold)':'var(--blue)', marginTop:'2px', fontFamily:'var(--font-mono)', display:'flex', alignItems:'center', gap:'4px' }}>
                           <span>{log.parentHost.isTemplate?'◫':'⬡'}</span>
                           <span>{log.parentHost.name}</span>
                           {log.parentHost.host && log.parentHost.host !== log.parentHost.name && <span style={{ opacity:0.6 }}>({log.parentHost.host})</span>}
                         </div>
                       )}
                     </div>

                     <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{log.ip||'—'}</span>
                     <div style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
                       {log._suspicious && <span style={{ fontSize:'10px', color:'#ff5757', fontWeight:600, fontFamily:'var(--font-mono)' }}>⚠ SUSPEITO</span>}
                       {log.resourceid  && <span style={{ fontSize:'10px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>ID:{log.resourceid}</span>}
                     </div>
                   </div>
                   {isExp && <ExpandedDetail log={log} />}
                 </div>
               );
             })
            }
          </div>
          {Math.ceil(filtered.length/50) > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', padding:'16px' }}>
              <button onClick={() => setPage(1)} disabled={page===1} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-secondary)', borderRadius:'var(--radius)', padding:'5px 10px', cursor:'pointer', fontSize:'13px', fontFamily:'var(--font-mono)' }}>«</button>
              <button onClick={() => setPage(p=>Math.max(1,p-1))} disabled={page===1} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-secondary)', borderRadius:'var(--radius)', padding:'5px 10px', cursor:'pointer', fontSize:'13px', fontFamily:'var(--font-mono)' }}>‹</button>
              <span style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', padding:'0 8px' }}>Página {page} de {Math.ceil(filtered.length/50)} · {filtered.length} eventos</span>
              <button onClick={() => setPage(p=>Math.min(Math.ceil(filtered.length/50),p+1))} disabled={page===Math.ceil(filtered.length/50)} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-secondary)', borderRadius:'var(--radius)', padding:'5px 10px', cursor:'pointer', fontSize:'13px', fontFamily:'var(--font-mono)' }}>›</button>
              <button onClick={() => setPage(Math.ceil(filtered.length/50))} disabled={page===Math.ceil(filtered.length/50)} style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-secondary)', borderRadius:'var(--radius)', padding:'5px 10px', cursor:'pointer', fontSize:'13px', fontFamily:'var(--font-mono)' }}>»</button>
            </div>
          )}
        </>
      )}

      {objectTimeline && <ObjectTimeline logs={enrichedLogs} targetName={objectTimeline} onClose={() => setObjectTimeline(null)} />}
      {showUsers && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}
          onClick={e => e.target===e.currentTarget && setShowUsers(false)}>
          <div style={{ background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'12px', width:'100%', maxWidth:'500px', maxHeight:'70vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:'16px', fontWeight:600, color:'var(--text-accent)' }}>Usuários Ativos no Período</div>
              <button onClick={() => setShowUsers(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'18px' }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', padding:'16px 24px' }}>
              {Object.entries(analytics.userCount||{}).sort((a,b)=>b[1]-a[1]).map(([user, count]) => (
                <div key={user} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                  onClick={() => { setUserFilter(u => u===user?'':user); setShowUsers(false); }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'var(--bg-hover)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, color:'var(--text-accent)' }}>{user[0]?.toUpperCase()}</div>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:600, color: userFilter===user?'var(--gold)':'var(--text-accent)' }}>{user}</div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{count} evento{count!==1?'s':''}</div>
                    </div>
                  </div>
                  <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{userFilter===user?'● filtrado':'clique pra filtrar'}</span>
                </div>
              ))}
            </div>
            {userFilter && (
              <div style={{ padding:'12px 24px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'flex-end' }}>
                <button onClick={() => setUserFilter('')} style={{ fontSize:'12px', color:'var(--red)', background:'none', border:'none', cursor:'pointer' }}>✕ Limpar filtro</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  root: { padding:'28px', maxWidth:'1700px', margin:'0 auto' },
  header: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' },
  title: { fontFamily:'var(--font-display)', fontSize:'26px', fontWeight:300, color:'var(--text-accent)', margin:0 },
  sub: { fontSize:'12px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', marginTop:'4px' },
  lastUpdate: { fontSize:'11px', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'6px', fontFamily:'var(--font-mono)' },
  btnSecondary: { background:'var(--bg-surface)', border:'1px solid var(--border)', color:'var(--text-secondary)', borderRadius:'var(--radius)', padding:'7px 13px', cursor:'pointer', fontSize:'12px', fontFamily:'var(--font-sans)' },
  btnExport: { background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.3)', color:'var(--gold)', borderRadius:'var(--radius)', padding:'7px 13px', cursor:'pointer', fontSize:'12px', fontFamily:'var(--font-sans)' },
  filters: { display:'flex', gap:'10px', alignItems:'center', marginBottom:'14px', flexWrap:'wrap' },
  searchInput: { flex:1, minWidth:'220px', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 14px', color:'var(--text-primary)', fontSize:'13px', outline:'none' },
  select: { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px', color:'var(--text-primary)', fontSize:'12px', outline:'none', cursor:'pointer' },
  count: { fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' },
  errorBanner: { background:'rgba(255,87,87,0.08)', border:'1px solid rgba(255,87,87,0.25)', borderRadius:'var(--radius)', padding:'10px 14px', color:'#ff5757', fontSize:'13px', marginBottom:'16px' },
  tabs: { display:'flex', gap:'4px', marginBottom:'16px', borderBottom:'1px solid var(--border)' },
  tab: { background:'none', border:'none', borderBottom:'2px solid transparent', color:'var(--text-muted)', padding:'8px 16px', cursor:'pointer', fontSize:'13px', fontFamily:'var(--font-sans)', marginBottom:'-1px', transition:'all 0.15s' },
  tabActive: { color:'var(--text-accent)', borderBottomColor:'var(--blue)' },
  table: { background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', overflow:'hidden' },
  tableHeader: { display:'grid', gridTemplateColumns:'110px 120px 120px 90px 1fr 120px 90px', gap:'16px', padding:'12px 28px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)', fontSize:'10px', fontWeight:600, color:'var(--text-muted)', letterSpacing:'0.08em', textTransform:'uppercase' },
  row: { display:'grid', gridTemplateColumns:'110px 120px 120px 90px 1fr 120px 90px', gap:'16px', padding:'14px 28px', alignItems:'center', transition:'background 0.12s' },
};