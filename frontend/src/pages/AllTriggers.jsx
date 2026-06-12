import { useAuth } from '../context/AuthContext';
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

const PAGE_SIZE = 50;

const SEVERITY_MAP = {
  '5': { label: 'DISASTER',    cls: 'badge-disaster' },
  '4': { label: 'HIGH',        cls: 'badge-high'     },
  '3': { label: 'AVERAGE',     cls: 'badge-average'  },
  '2': { label: 'WARNING',     cls: 'badge-warning'  },
  '1': { label: 'INFORMATION', cls: 'badge-info'     },
  '0': { label: 'N/C',         cls: 'badge-info'     },
};

export default function AllTriggers() {
  const location = useLocation();
  const { user } = useAuth();
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('');
  const [error, setError] = useState('');
  const [expandedTrigger, setExpandedTrigger] = useState(null);
  const [page, setPage] = useState(1);
  const [techFilter, setTechFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/zabbix/triggers');
        setTriggers(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar triggers');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setStatusFilter(p.get('status') || 'all');
    setPage(1);
  }, [location.search]);

  useEffect(() => { setPage(1); }, [filter, statusFilter, severityFilter]);

  async function downloadCSV() {
    const rows = filtered.map(t => [
      t.hosts?.map(h => h.name).join(', ') || '—',
      t.description,
      SEVERITY_MAP[t.priority]?.label || t.priority,
      t.status === '0' ? 'Ativo' : 'Desabilitado',
      t.lastchange && parseInt(t.lastchange) > 0
        ? new Date(parseInt(t.lastchange) * 1000).toLocaleString('pt-BR')
        : '—',
    ]);
    const header = 'Host;Trigger;Severidade;Status;Última mudança';
    const csv = '\uFEFF' + [header, ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'triggers.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = triggers.filter(a => {
    const n = (a.hosts?.map(h=>h.name).join(' ')||'').toUpperCase();
    if (techFilter === 'SQL' && !n.match(/SQL|PSQL|MSSQL|ORACLE|BD/)) return false;
    if (techFilter === 'LINUX' && !n.match(/LNX|LINUX/)) return false;
    if (techFilter === 'WINDOWS' && !n.match(/WIN|WND|W0[0-9]|SRV/)) return false;
    if (techFilter === 'REDE' && !n.match(/RTR|SW|FW|NET/)) return false;
    return true;
  }).filter(t => {
    const matchText = !filter ||
      t.description?.toLowerCase().includes(filter.toLowerCase()) ||
      t.hosts?.some(h => h.name?.toLowerCase().includes(filter.toLowerCase()));
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && t.status === '0') ||
      (statusFilter === 'disabled' && t.status === '1');
    const matchSev = !severityFilter || t.priority === severityFilter;
    return matchText && matchStatus && matchSev;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusLabel = statusFilter === 'active' ? ' · Ativas' : statusFilter === 'disabled' ? ' · Desativadas' : '';

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Triggers{statusLabel}</h1>
          <p style={styles.sub}>Todas as triggers cadastradas no ambiente</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {filtered.length} trigger{filtered.length !== 1 ? 's' : ''}
          </span>
          <button onClick={downloadCSV} style={styles.exportBtn}>⤓ CSV</button>
        </div>
      </div>

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
      <input
          placeholder="Filtrar por trigger ou host..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={styles.searchInput}
        />
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} style={styles.select}>
          <option value="">Todas severidades</option>
          <option value="5">DISASTER</option>
          <option value="4">HIGH</option>
          <option value="3">AVERAGE</option>
          <option value="2">WARNING</option>
          <option value="1">INFORMATION</option>
        </select>
        <div style={styles.tabs}>
          {[['all', 'Todas'], ['active', 'Ativas'], ['disabled', 'Desativadas']].map(([val, lbl]) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              style={{ ...styles.tab, ...(statusFilter === val ? styles.tabActive : {}) }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {error && <div style={styles.errorBanner}>⚠ {error}</div>}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Trigger</span>
          <span>Template</span>
          <span>Severidade</span>
          <span>Status</span>
          <span>Última mudança</span>
        </div>

        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '46px', margin: '4px 0', borderRadius: 'var(--radius)' }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>Nenhuma trigger encontrada</div>
        ) : (
          paginated.map(t => {
            const sev = SEVERITY_MAP[t.priority] || SEVERITY_MAP['0'];
            const isExp = expandedTrigger === t.triggerid;
            return (
              <div key={t.triggerid} style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ ...styles.row, ...(t.status === '1' ? { opacity: 0.6 } : {}), cursor: 'pointer' }}
                  onClick={() => setExpandedTrigger(isExp ? null : t.triggerid)}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {t.description}
                      <span style={{ fontSize: '10px', color: '#4a9eff' }}>{isExp ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                    {t.hosts?.map(h => h.name).join(', ') || '—'}
                  </span>
                  <span><span className={`badge ${sev.cls}`}>{sev.label}</span></span>
                  <span>
                    <span className={`badge ${t.status === '0' ? 'badge-ok' : 'badge-info'}`}>
                      {t.status === '0' ? 'Ativa' : 'Desabilitada'}
                    </span>
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {t.lastchange && parseInt(t.lastchange) > 0
                      ? new Date(parseInt(t.lastchange) * 1000).toLocaleString('pt-BR')
                      : '—'}
                  </span>
                </div>
                {isExp && (
                  <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
                      Expressão completa
                    </div>
                    <pre style={{ margin: 0, fontSize: '12px', color: 'var(--purple)', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                      {t.expression || '—'}
                    </pre>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      ID: {t.triggerid}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={styles.pageBtn}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>‹</button>
          <span style={styles.pageInfo}>Página {page} de {totalPages} · {filtered.length} triggers</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={styles.pageBtn}>»</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { padding: '28px', maxWidth: '1400px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  exportBtn: { background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  filters: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: '200px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' },
  select: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' },
  tabs: { display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  tab: { background: 'none', border: 'none', padding: '6px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'all var(--transition)' },
  tabActive: { background: 'var(--orange-dim)', color: 'var(--orange)' },
  errorBanner: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' },
  table: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 180px 130px 110px 150px', gap: '12px', padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  row: { display: 'grid', gridTemplateColumns: '2fr 180px 130px 110px 150px', gap: '12px', padding: '12px 16px', alignItems: 'center' },
  empty: { padding: '40px', textAlign: 'center', color: 'var(--text-muted)' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', marginTop: '8px' },
  pageBtn: { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-mono)' },
  pageInfo: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '0 8px' },
};
