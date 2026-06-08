import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

const PAGE_SIZE = 50;

export default function Items() {
  const location = useLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/zabbix/items');
        setItems(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar itens');
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

  useEffect(() => { setPage(1); }, [filter, typeFilter, statusFilter]);

  async function downloadCSV() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/reports/items?format=csv', { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'itens.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = items.filter(item => {
    const matchText = !filter ||
      item.name?.toLowerCase().includes(filter.toLowerCase()) ||
      item.key_?.toLowerCase().includes(filter.toLowerCase()) ||
      item.hosts?.[0]?.name?.toLowerCase().includes(filter.toLowerCase());
    const matchType = typeFilter === 'all' ||
      (typeFilter === 'query' && item.isQuery) ||
      (typeFilter === 'db' && (item.type === '11' || item.key_?.startsWith('db.odbc') || item.key_?.startsWith('db.query') || item.typeLabel === 'Database Monitor'));
    const matchStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.status === '0') ||
      (statusFilter === 'disabled' && item.status === '1');
    return matchText && matchType && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const statusLabel = statusFilter === 'active' ? ' · Ativos' : statusFilter === 'disabled' ? ' · Desativados' : '';

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Itens Monitorados{statusLabel}</h1>
          <p style={styles.sub}>Coletores, queries SQL e métricas</p>
        </div>
        <button onClick={downloadCSV} style={styles.exportBtn}>⤓ CSV</button>
      </div>

      <div style={styles.filters}>
        <input
          placeholder="Filtrar por nome, chave ou host..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={styles.searchInput}
        />
        <div style={styles.tabs}>
          {[['all', 'Todos'], ['db', '◎ Database']].map(([val, lbl]) => (
            <button key={val} onClick={() => setTypeFilter(val)}
              style={{ ...styles.tab, ...(typeFilter === val ? styles.tabActive : {}) }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={styles.tabs}>
          {[['all', 'Todos'], ['active', 'Ativos'], ['disabled', 'Desativados']].map(([val, lbl]) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              style={{ ...styles.tab, ...(statusFilter === val ? styles.tabActiveStatus : {}) }}>
              {lbl}
            </button>
          ))}
        </div>
        <span style={styles.count}>{filtered.length} itens</span>
      </div>

      {error && <div style={styles.errorBanner}>⚠ {error}</div>}

      <div style={styles.table}>
        <div style={styles.tableHeader}>
          <span>Nome</span>
          <span>Template/Host</span>
          <span>Tipo</span>
          <span>Intervalo</span>
        </div>

        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '46px', margin: '4px 0', borderRadius: 'var(--radius)' }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>Nenhum item encontrado</div>
        ) : (
          paginated.map(item => {
            const isExp = expanded === item.itemid;
            const hasQuery = item.isQuery && item.params;
            return (
              <div key={item.itemid} style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ ...styles.row, ...(item.isQuery ? styles.rowQuery : {}), ...(item.status === '1' ? { opacity: 0.6 } : {}), cursor: hasQuery ? 'pointer' : 'default' }}
                  onClick={() => hasQuery && setExpanded(isExp ? null : item.itemid)}
                  onMouseEnter={e => { if(hasQuery) e.currentTarget.style.background='var(--bg-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='transparent'; }}
                  className="animate-in">
                  <div>
                    <div style={{ ...styles.itemName, ...(item.isQuery ? { color: 'var(--purple)' } : {}) }}>
                      {item.isQuery && '◎ '}{item.name}
                      {hasQuery && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--purple)' }}>{isExp ? '▲' : '▼'}</span>}
                      {item.status === '1' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '3px' }}>desativado</span>}
                    </div>
                    <div style={styles.itemKey}>{item.key_}</div>
                  </div>
                  <span style={styles.host}>{item.hosts?.[0]?.name || '—'}</span>
                  <span style={styles.typeBadge}>{item.typeLabel}</span>
                  <span style={styles.mono}>{item.delayFormatted}</span>
                </div>
                {isExp && hasQuery && (
                  <div style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>Query SQL</div>
                    <pre style={{ margin: 0, fontSize: '12px', color: 'var(--purple)', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 'var(--radius)', padding: '10px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>{item.params}</pre>
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
          <span style={styles.pageInfo}>Página {page} de {totalPages} · {filtered.length} itens</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={styles.pageBtn}>»</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  root: { padding: '28px', maxWidth: '1600px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  exportBtn: { background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  filters: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' },
  searchInput: { flex: 1, minWidth: '200px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' },
  tabs: { display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  tab: { background: 'none', border: 'none', padding: '6px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'all var(--transition)' },
  tabActive: { background: 'var(--purple-dim)', color: 'var(--purple)' },
  tabActiveStatus: { background: 'var(--blue-dim)', color: 'var(--blue)' },
  count: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' },
  errorBanner: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' },
  table: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  tableHeader: { display: 'grid', gridTemplateColumns: '2fr 160px 140px 90px', gap: '12px', padding: '10px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  row: { display: 'grid', gridTemplateColumns: '2fr 160px 140px 90px', gap: '12px', padding: '10px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center' },
  rowQuery: { borderLeft: '2px solid rgba(167,139,250,0.4)' },
  itemName: { fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemKey: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  typeBadge: { background: 'var(--bg-hover)', color: 'var(--text-muted)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' },
  mono: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' },
  host: { fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { padding: '40px', textAlign: 'center', color: 'var(--text-muted)' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', marginTop: '8px' },
  pageBtn: { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-mono)' },
  pageInfo: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '0 8px' },
};
