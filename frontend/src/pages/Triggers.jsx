import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const SEVERITY_MAP = {
  '5': { label: 'DISASTER',    cls: 'badge-disaster', order: 0 },
  '4': { label: 'HIGH',        cls: 'badge-high',     order: 1 },
  '3': { label: 'AVERAGE',     cls: 'badge-average',  order: 2 },
  '2': { label: 'WARNING',     cls: 'badge-warning',  order: 3 },
  '1': { label: 'INFORMATION', cls: 'badge-info',     order: 4 },
  '0': { label: 'N/C',         cls: 'badge-info',     order: 5 },
};

const PERIODS = ['5m','15m','30m','1h','3h','6h','12h','1d','2d','7d','30d','60d','1y'];


function cleanTriggerName(desc) {
  if (!desc) return desc;
  return desc
    .replace(/\[\w+\]\{\$[^}]+\}\s*/g, '')
    .replace(/\{\$[^}]+\}\s*/g, '')
    .replace(/^\s*[-–]\s*/, '')
    .trim();
}

export default function Triggers() {
  const { user } = useAuth();
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [severity, setSeverity] = useState('');
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);

  // Modo: 'realtime' ou 'history'
  const [mode, setMode] = useState('realtime');
  const [period, setPeriod] = useState('1h');
  const [customMode, setCustomMode] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    if (mode === 'realtime') {
      fetchTriggers();
      const interval = setInterval(fetchTriggers, 30000);
      return () => clearInterval(interval);
    } else {
      if (customMode) return;
      fetchEvents();
    }
  }, [severity, mode, period, customMode]);

  async function fetchTriggers() {
    try {
      const params = severity ? `?severity=${severity}` : '';
      const res = await api.get(`/api/zabbix/triggers/active${params}`);
      setTriggers(res.data);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar alertas');
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvents(fromDate, toDate) {
    setLoading(true);
    setError('');
    try {
      let url = `/api/zabbix/events?period=${period}`;
      if (fromDate && toDate) {
        url = `/api/zabbix/events?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
      }
      const res = await api.get(url);
      setTriggers(res.data.map(e => ({
        triggerid: e.eventid,
        description: e.name || e.relatedObject?.description || '—',
        priority: e.severity || e.relatedObject?.priority || '0',
        lastchange: e.clock,
        hosts: e.hosts || [],
      })));
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  }

  function buscarCustom() {
    if (!dateFrom || !dateTo) return;
    fetchEvents(dateFrom, dateTo);
  }

  async function downloadCSV() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/reports/triggers?format=csv', { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'alertas.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = triggers.filter(t => {
    const n = (t.hosts?.map(h=>h.name).join(' ')||'').toUpperCase();
    if (techFilter === 'SQL' && !n.match(/SQL|PSQL|MSSQL|ORACLE|BD/)) return false;
    if (techFilter === 'LINUX' && !n.match(/LNX|LINUX/)) return false;
    if (techFilter === 'WINDOWS' && !n.match(/WIN|WND|W0[0-9]|SRV/)) return false;
    if (techFilter === 'REDE' && !n.match(/RTR|SW|FW|NET/)) return false;
    const matchText = !filter ||
      t.description?.toLowerCase().includes(filter.toLowerCase()) ||
      t.hosts?.some(h => h.name?.toLowerCase().includes(filter.toLowerCase()));
    const matchSev = !severity || t.priority === String(severity);
    return matchText && matchSev;
  });

  function timeSince(unix) {
    if (!unix || parseInt(unix) === 0) return '—';
    const d = new Date(parseInt(unix) * 1000);
    if (mode === 'history') return d.toLocaleString('pt-BR');
    const diff = Date.now() - parseInt(unix) * 1000;
    const m = Math.floor(diff / 60000);
    if (m < 60) return `há ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Alertas</h1>
          <p style={styles.sub}>{mode === 'realtime' ? 'Triggers disparadas em tempo real' : `Histórico de eventos — ${triggers.length} ocorrências`}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {lastUpdate && mode === 'realtime' && (
            <span style={styles.lastUpdate}>
              <span className="live-dot" /> {lastUpdate.toLocaleTimeString('pt-BR')}
            </span>
          )}
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filtered.length} alerta{filtered.length !== 1 ? 's' : ''}
          </span>
          {mode === 'realtime' && <button onClick={fetchTriggers} style={styles.refreshBtn}>↺ Atualizar</button>}
          <button onClick={downloadCSV} style={styles.exportBtn}>⤓ CSV</button>
        </div>
      </div>

      {/* Toggle modo */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <button onClick={() => { setMode('realtime'); setCustomMode(false); }}
          style={{ ...styles.modeBtn, ...(mode === 'realtime' ? styles.modeBtnActive : {}) }}>
          ● Tempo Real
        </button>
        <button onClick={() => { setMode('history'); setCustomMode(false); }}
          style={{ ...styles.modeBtn, ...(mode === 'history' && !customMode ? styles.modeBtnActiveHistory : {}) }}>
          ◷ Histórico
        </button>
      </div>

      {/* Seletor de período — só no modo histórico */}
      {mode === 'history' && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          {!customMode && PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '5px 12px', borderRadius: 'var(--radius)', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-mono)', transition: 'all 0.15s',
                background: period === p ? 'var(--gold-dim)' : 'var(--bg-hover)',
                color: period === p ? 'var(--gold)' : 'var(--text-muted)',
                borderColor: period === p ? 'rgba(201,168,76,0.4)' : 'var(--border)' }}>
              {p}
            </button>
          ))}
          <button onClick={() => setCustomMode(c => !c)}
            style={{ padding: '5px 12px', borderRadius: 'var(--radius)', border: '1px solid', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-mono)',
              background: customMode ? 'var(--purple-dim)' : 'var(--bg-hover)',
              color: customMode ? 'var(--purple)' : 'var(--text-muted)',
              borderColor: customMode ? 'rgba(167,139,250,0.4)' : 'var(--border)' }}>
            {customMode ? '✕ Fechar' : '⊞ Personalizado'}
          </button>

          {customMode && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', width: '100%', marginTop: '6px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>De</label>
                <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Até</label>
                <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '6px 10px', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font-mono)', outline: 'none' }} />
              </div>
              <button onClick={buscarCustom} disabled={!dateFrom || !dateTo}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius)', border: '1px solid rgba(201,168,76,0.4)', background: 'var(--gold-dim)', color: 'var(--gold)', fontSize: '12px', cursor: 'pointer', opacity: (!dateFrom || !dateTo) ? 0.5 : 1 }}>
                ◈ Buscar
              </button>
            </div>
          )}
        </div>
      )}

      <div style={styles.filters}>
        {(!user || user.role === 'admin' || user.role === 'manager') && (
          <div style={{ display:'flex', gap:'8px', marginBottom:'12px', flexWrap:'wrap' }}>
            {[['','Todos'],['SQL','🗄 Database'],['LINUX','🐧 Linux'],['WINDOWS','🖥 Windows'],['REDE','🌐 Rede']].map(([key,label])=>(
              <button key={key} onClick={()=>setTechFilter(key)}
                style={{ padding:'5px 14px', borderRadius:'var(--radius)', border:'1px solid', fontSize:'12px', cursor:'pointer',
                  background: techFilter===key?'var(--gold-dim)':'var(--bg-hover)',
                  color: techFilter===key?'var(--gold)':'var(--text-muted)',
                  borderColor: techFilter===key?'rgba(201,168,76,0.4)':'var(--border)' }}>
                {label}
              </button>
            ))}
          </div>
        )}
        <input placeholder="Filtrar por problema ou host..." value={filter} onChange={e => setFilter(e.target.value)} style={styles.searchInput} />
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={styles.select}>
          <option value="">Todas severidades</option>
          <option value="5">DISASTER</option>
          <option value="4">HIGH</option>
          <option value="3">AVERAGE</option>
          <option value="2">WARNING</option>
          <option value="1">INFORMATION</option>
        </select>
      </div>

      {error && <div style={styles.errorBanner}>⚠ {error}</div>}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Severidade</span>
          <span>Problema</span>
          <span>Template(s) Afetados</span>
          <span>{mode === 'history' ? 'Data/Hora' : 'Duração'}</span>
        </div>
        {loading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '52px', margin: '4px 0', borderRadius: 'var(--radius)' }} />)
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            <span style={{ fontSize: '32px' }}>✓</span>
            <p style={{ color: 'var(--green)' }}>
              {mode === 'realtime' ? 'Nenhum alerta ativo' : 'Nenhum evento encontrado para o período'}
              {filter ? ' para este filtro' : ''}
            </p>
          </div>
        ) : (
          filtered
            .sort((a, b) => mode === 'history'
              ? parseInt(b.lastchange) - parseInt(a.lastchange)
              : (SEVERITY_MAP[a.priority]?.order ?? 9) - (SEVERITY_MAP[b.priority]?.order ?? 9))
            .map(t => {
              const sev = SEVERITY_MAP[t.priority] || SEVERITY_MAP['0'];
              return (
                <div key={t.triggerid} style={styles.row} className="animate-in">
                  <span><span className={`badge ${sev.cls}`}>{sev.label}</span></span>
                  <span style={styles.cellMain}>{cleanTriggerName(t.description)}</span>
                  <span style={styles.cellHost}>{t.hosts?.map(h => h.name).join(', ') || '—'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    {timeSince(t.lastchange)}
                  </span>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

const styles = {
  root: { padding: '28px', maxWidth: '1400px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  lastUpdate: { fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' },
  refreshBtn: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)' },
  exportBtn: { background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)', borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)' },
  modeBtn: { padding: '6px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-mono)', transition: 'all 0.15s' },
  modeBtnActive: { background: 'var(--red-dim)', borderColor: 'rgba(255,87,87,0.4)', color: 'var(--red)' },
  modeBtnActiveHistory: { background: 'var(--blue-dim)', borderColor: 'rgba(74,158,255,0.4)', color: 'var(--blue)' },
  filters: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { flex: 1, minWidth: '200px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' },
  select: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' },
  errorBanner: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' },
  table: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '160px 1fr 220px 160px', gap: '16px', padding: '10px 20px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  row: { display: 'grid', gridTemplateColumns: '160px 1fr 220px 160px', gap: '16px', padding: '14px 20px', borderBottom: '1px solid var(--border)', alignItems: 'center' },
  cellMain: { fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 },
  cellHost: { fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' },
  empty: { padding: '48px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
};