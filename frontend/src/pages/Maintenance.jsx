import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function Maintenance() {
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/api/zabbix/maintenances');
        setMaintenances(res.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao carregar manutenções');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = Math.floor(Date.now() / 1000);

  const filtered = maintenances.filter(m => {
    const matchText = !filter ||
      m.name?.toLowerCase().includes(filter.toLowerCase()) ||
      m.hosts?.some(h => h.name?.toLowerCase().includes(filter.toLowerCase()) || h.host?.toLowerCase().includes(filter.toLowerCase())) ||
      m.groups?.some(g => g.name?.toLowerCase().includes(filter.toLowerCase()));
    return matchText;
  });

  function getStatus(m) {
    const since = parseInt(m.active_since);
    const till = parseInt(m.active_till);
    if (now >= since && now <= till) return { label: 'Ativa', color: 'var(--green)', bg: 'var(--green-dim)' };
    if (now < since) return { label: 'Agendada', color: 'var(--blue)', bg: 'var(--blue-dim)' };
    return { label: 'Encerrada', color: 'var(--text-muted)', bg: 'var(--bg-hover)' };
  }

  function fmtDate(ts) {
    if (!ts || ts === '0') return '—';
    return new Date(parseInt(ts) * 1000).toLocaleString('pt-BR');
  }
  function timeRemaining(m) {
    const till = parseInt(m.active_till);
    const since = parseInt(m.active_since);
    const ref = now >= since && now <= till ? till : (now < since ? since : null);
    if (!ref) return null;
    const diff = ref - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const label = now >= since ? 'Expira em' : 'Inicia em';
    if (days > 0) return `${label}: ${days}d ${hours}h`;
    if (hours > 0) return `${label}: ${hours}h ${mins}min`;
    return `${label}: ${mins}min`;
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Manutenções</h1>
          <p style={styles.sub}>Janelas de manutenção cadastradas no Zabbix</p>
        </div>
        <span style={styles.count}>{filtered.length} manutenção(ões)</span>
      </div>

      <div style={styles.filters}>
        <input
          placeholder="Buscar por nome da manutenção, host ou grupo..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {error && <div style={styles.errorBanner}>⚠ {error}</div>}

      <div style={styles.list}>
        {loading ? (
          Array(5).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '90px', margin: '4px 0', borderRadius: 'var(--radius)' }} />
          ))
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>Nenhuma manutenção encontrada</div>
        ) : (
          filtered.map(m => {
            const status = getStatus(m);
            return (
              <div key={m.maintenanceid} style={styles.card}>
                <div style={styles.cardTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <span style={{ ...styles.statusBadge, color: status.color, background: status.bg }}>
                      {status.label}
                    </span>
                    <div style={styles.name}>{m.name}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px' }}>
                    <div style={styles.dates}>
                      <span style={styles.dateLabel}>Início:</span>
                      <span style={styles.dateValue}>{fmtDate(m.active_since)}</span>
                      <span style={styles.dateLabel}>Fim:</span>
                      <span style={styles.dateValue}>{fmtDate(m.active_till)}</span>
                    </div>
                    {timeRemaining(m) && (
                      <span style={{ fontSize:'11px', fontFamily:'var(--font-mono)', color: getStatus(m).label === 'Ativa' ? 'var(--orange)' : 'var(--blue)', background: getStatus(m).label === 'Ativa' ? 'var(--orange-dim)' : 'var(--blue-dim)', padding:'2px 8px', borderRadius:'4px' }}>
                        ⏱ {timeRemaining(m)}
                      </span>
                    )}
                  </div>
                </div>

                {m.description && (
                  <div style={styles.desc}>{m.description}</div>
                )}

                <div style={styles.cardBottom}>
                  {m.hosts?.length > 0 && (
                    <div style={styles.tagGroup}>
                      <span style={styles.tagLabel}>Hosts:</span>
                      <div style={styles.tags}>
                        {m.hosts.map(h => (
                          <span key={h.hostid} style={styles.tag}>{h.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.groups?.length > 0 && (
                    <div style={styles.tagGroup}>
                      <span style={styles.tagLabel}>Grupos:</span>
                      <div style={styles.tags}>
                        {m.groups.map(g => (
                          <span key={g.groupid} style={{ ...styles.tag, background: 'var(--blue-dim)', color: 'var(--blue)', borderColor: 'rgba(74,158,255,0.2)' }}>{g.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  root: { padding: '28px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  count: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', alignSelf: 'center' },
  filters: { marginBottom: '16px' },
  searchInput: { width: '100%', boxSizing: 'border-box', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' },
  errorBanner: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--red)', fontSize: '13px', marginBottom: '16px' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '8px', flexWrap: 'wrap' },
  name: { fontSize: '14px', fontWeight: 600, color: 'var(--text-accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  statusBadge: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' },
  dates: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', fontFamily: 'var(--font-mono)', flexShrink: 0 },
  dateLabel: { color: 'var(--text-muted)' },
  dateValue: { color: 'var(--text-secondary)', marginRight: '8px' },
  desc: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px', lineHeight: 1.5 },
  cardBottom: { display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--border)' },
  tagGroup: { display: 'flex', alignItems: 'flex-start', gap: '8px' },
  tagLabel: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', paddingTop: '2px' },
  tags: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  tag: { fontSize: '11px', background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 7px', fontFamily: 'var(--font-mono)' },
  empty: { padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
};
