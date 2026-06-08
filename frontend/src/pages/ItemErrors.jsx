import React, { useEffect, useState } from 'react';
import api from '../services/api';

const PAGE_SIZE = 50;

export default function ItemErrors() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/zabbix/dashboard/extras');
        setItems(res.data.itemsWithError || []);
      } catch (err) {
        setError('Erro ao carregar itens');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { setPage(1); }, [filter]);

  const filtered = items.filter(i =>
    !filter ||
    i.name?.toLowerCase().includes(filter.toLowerCase()) ||
    i.hosts?.[0]?.name?.toLowerCase().includes(filter.toLowerCase()) ||
    i.error?.toLowerCase().includes(filter.toLowerCase())
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Itens com Erro de Coleta</h1>
          <p style={styles.sub}>Itens com falha na coleta de dados</p>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--red)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>{filtered.length} itens</span>
      </div>
      <div style={{ marginBottom: '16px' }}>
        <input placeholder="Buscar por item, host ou erro..." value={filter} onChange={e => setFilter(e.target.value)} style={styles.searchInput} />
      </div>
      {error && <div style={styles.errorBanner}>⚠ {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          Array(6).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius)' }} />)
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>Nenhum item com erro encontrado</div>
        ) : (
          paginated.map((item, i) => (
            <div key={i} style={styles.card}>
              <div style={styles.cardTop}>
                <div style={styles.itemName}>{item.name}</div>
                <div style={styles.host}>{item.hosts?.[0]?.name || '—'}</div>
              </div>
              <div style={styles.errorMsg}>{item.error}</div>
            </div>
          ))
        )}
      </div>
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={styles.pageBtn}>«</button>
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={styles.pageBtn}>‹</button>
          <span style={styles.pageInfo}>Página {page} de {totalPages} · {filtered.length} itens</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={styles.pageBtn}>›</button>
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
  searchInput: { width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' },
  errorBanner: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' },
  card: { padding: '12px 16px', background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.2)', borderRadius: 'var(--radius)' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  itemName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' },
  host: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  errorMsg: { fontSize: '11px', color: 'var(--red)', lineHeight: 1.5 },
  empty: { padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', marginTop: '8px' },
  pageBtn: { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '5px 10px', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-mono)' },
  pageInfo: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', padding: '0 8px' },
};
