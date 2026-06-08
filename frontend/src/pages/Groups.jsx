import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const SEV = {
  '5': { l: 'DISASTER', c: 'var(--red)' },
  '4': { l: 'HIGH', c: 'var(--orange)' },
  '3': { l: 'AVERAGE', c: 'var(--yellow)' },
  '2': { l: 'WARNING', c: 'var(--blue)' },
  '1': { l: 'INFORMATION', c: 'var(--text-muted)' },
  '0': { l: 'N/C', c: 'var(--text-muted)' },
};

function HostModal({ host, onClose }) {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState('health');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!host) return;
    setLoading(true);
    Promise.all([
      api.get(`/api/zabbix/host/${host.hostid}/health`),
      api.get(`/api/zabbix/host/${host.hostid}/items`),
      api.get(`/api/zabbix/host/${host.hostid}/triggers`),
      api.get(`/api/zabbix/host/${host.hostid}/alerts`),
    ]).then(([h, i, t, a]) => {
      setHealth(h.data);
      setDetail({ items: i.data, triggers: t.data, alerts: a.data });
    }).catch(() => {
      setHealth(null);
      setDetail({ items: [], triggers: [], alerts: [] });
    }).finally(() => setLoading(false));
  }, [host]);

  if (!host) return null;

  const tabs = [['health','♥ Saúde'],['items','≡ Itens'],['triggers','◉ Triggers'],['alerts','◎ Alertas']];

  function renderContent() {
    if (loading) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius)' }} />)}
      </div>
    );

    if (tab === 'health' && health) {
      const { summary, alerts, queryItems } = health;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { label: 'Itens Ativos', value: summary.itemsActive, color: 'var(--green)' },
              { label: 'Itens Desativados', value: summary.itemsDisabled, color: 'var(--text-muted)' },
              { label: 'Triggers Ativas', value: summary.triggersActive, color: 'var(--blue)' },
              { label: 'Alertas Agora', value: summary.activeAlerts, color: summary.activeAlerts > 0 ? 'var(--red)' : 'var(--green)' },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: m.color }}>{m.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.label}</div>
              </div>
            ))}
          </div>
          {alerts.length > 0 && (
            <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.2)', borderRadius: 'var(--radius)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--red)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>◉ Alertas Ativos</div>
              {alerts.map(a => {
                const sev = SEV[a.priority] || SEV['0'];
                return (
                  <div key={a.triggerid} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,87,87,0.1)' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: sev.c, minWidth: '90px', fontFamily: 'var(--font-mono)' }}>{sev.l}</span>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{a.description}</span>
                  </div>
                );
              })}
            </div>
          )}
          {queryItems.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 'var(--radius)', padding: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--purple)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>◎ Queries SQL</div>
              {queryItems.map(item => (
                <div key={item.itemid} style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>{item.name}</div>
              ))}
            </div>
          )}
          <button onClick={() => navigate(`/hosts?open=${host.hostid}`)}
            style={{ alignSelf: 'flex-start', background: 'var(--blue-dim)', border: '1px solid rgba(74,158,255,0.3)', color: 'var(--blue)', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
            ⬡ Ver detalhes completos em Servidores →
          </button>
        </div>
      );
    }

    if (tab === 'items') {
      const items = detail?.items || [];
      return (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 120px 80px', gap: '12px', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            <span>Nome</span><span>Tipo</span><span>Intervalo</span>
          </div>
          {items.map(item => (
            <div key={item.itemid} style={{ display: 'grid', gridTemplateColumns: '2fr 120px 80px', gap: '12px', padding: '10px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center', opacity: item.status === '1' ? 0.5 : 1 }}>
              <div>
                <div style={{ fontSize: '13px', color: item.isQuery ? 'var(--purple)' : 'var(--text-primary)', fontWeight: 500 }}>{item.isQuery && '◎ '}{item.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{item.key_}</div>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.typeLabel}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{item.delayFormatted}</span>
            </div>
          ))}
          {items.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhum item</div>}
        </div>
      );
    }

    if (tab === 'triggers') {
      const triggers = detail?.triggers || [];
      return (
        <div>
          {triggers.map(t => {
            const sev = SEV[t.priority] || SEV['0'];
            return (
              <div key={t.triggerid} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 100px', gap: '12px', padding: '10px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{t.description}</div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: sev.c, fontFamily: 'var(--font-mono)' }}>{sev.l}</span>
                <span><span className={`badge ${t.status === '0' ? 'badge-ok' : 'badge-info'}`}>{t.status === '0' ? 'Ativo' : 'Desabilitado'}</span></span>
              </div>
            );
          })}
          {triggers.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Nenhuma trigger</div>}
        </div>
      );
    }

    if (tab === 'alerts') {
      const alerts = detail?.alerts || [];
      if (!alerts.length) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--green)' }}>✓ Nenhum alerta ativo</div>;
      return (
        <div>
          {alerts.map(a => {
            const sev = SEV[a.priority] || SEV['0'];
            return (
              <div key={a.triggerid} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: sev.c, minWidth: '90px', fontFamily: 'var(--font-mono)' }}>{sev.l}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{a.description}</span>
              </div>
            );
          })}
        </div>
      );
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '860px', height: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }} className="animate-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-accent)', fontFamily: 'var(--font-display)' }}>{host.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>{host.host} · {host.interfaces?.[0]?.ip || '—'}</div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <span className={`badge ${host.status === '0' ? 'badge-ok' : 'badge-info'}`}>{host.status === '0' ? 'Ativo' : 'Desativado'}</span>
              <span className={`badge ${host.available === '1' ? 'badge-ok' : host.available === '2' ? 'badge-disaster' : 'badge-info'}`}>{host.available === '1' ? 'Online' : host.available === '2' ? 'Offline' : 'Desconhecido'}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {tabs.map(([val, lbl]) => (
            <button key={val} onClick={() => setTab(val)}
              style={{ background: 'none', border: 'none', borderBottom: `2px solid ${tab === val ? 'var(--gold)' : 'transparent'}`, color: tab === val ? 'var(--gold)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)', padding: '10px 16px', transition: 'all 0.18s', whiteSpace: 'nowrap' }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 24px', flex: 1 }}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [hosts, setHosts] = useState([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [openHost, setOpenHost] = useState(null);

  useEffect(() => {
    api.get('/api/zabbix/hostgroups').then(r => setGroups(r.data)).finally(() => setLoading(false));
  }, []);

  async function openGroup(group) {
    setSelected(group);
    setHostsLoading(true);
    setHosts([]);
    try {
      const res = await api.get('/api/zabbix/hosts');
      const filtered = res.data.filter(h => h.groups?.some(g => g.name === group.name));
      setHosts(filtered);
    } catch { setHosts([]); }
    setHostsLoading(false);
  }

  const filtered = groups.filter(g => !filter || g.name?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Grupos de Hosts</h1>
          <p style={styles.sub}>{groups.length} grupos monitorados</p>
        </div>
      </div>

      <div style={styles.layout}>
        <div style={styles.sidebar}>
          <input placeholder="Filtrar grupos..." value={filter} onChange={e => setFilter(e.target.value)} style={styles.searchInput} />
          <div style={styles.groupList}>
            {loading ? Array(6).fill(0).map((_, i) =>
              <div key={i} className="skeleton" style={{ height: '52px', borderRadius: 'var(--radius)', marginBottom: '4px' }} />
            ) : filtered.map(g => (
              <div key={g.groupid} onClick={() => openGroup(g)}
                style={{ ...styles.groupItem, ...(selected?.groupid === g.groupid ? styles.groupItemActive : {}) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '16px', color: selected?.groupid === g.groupid ? 'var(--gold)' : 'var(--text-muted)' }}>⊞</span>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: selected?.groupid === g.groupid ? 'var(--gold)' : 'var(--text-primary)' }}>{g.name}</div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>→</span>
              </div>
            ))}
            {filtered.length === 0 && !loading && <div style={styles.empty}>Nenhum grupo encontrado</div>}
          </div>
        </div>

        <div style={styles.content}>
          {!selected ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>⊞</div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Selecione um grupo para ver seus hosts</div>
            </div>
          ) : (
            <>
              <div style={styles.contentHeader}>
                <div>
                  <div style={styles.contentTitle}>{selected.name}</div>
                  <div style={styles.contentSub}>{hostsLoading ? 'Carregando...' : `${hosts.length} host${hosts.length !== 1 ? 's' : ''}`}</div>
                </div>
              </div>
              <div style={styles.table}>
                <div style={{ ...styles.row, ...styles.headerRow }}>
                  <span>Servidor</span><span>IP</span><span>Status</span><span>Disponibilidade</span>
                </div>
                {hostsLoading ? Array(4).fill(0).map((_, i) =>
                  <div key={i} className="skeleton" style={{ height: '46px', margin: '4px 0', borderRadius: 'var(--radius)' }} />
                ) : hosts.length === 0 ? (
                  <div style={styles.empty}>Nenhum host neste grupo</div>
                ) : hosts.map(h => (
                  <div key={h.hostid}
                    style={{ ...styles.row, cursor: 'pointer' }}
                    className="animate-in"
                    onClick={() => setOpenHost(h)}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div>
                      <div style={styles.hostName}>{h.name}</div>
                      <div style={styles.mono}>{h.host}</div>
                      {h.parentTemplates?.length > 0 && (
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ◫ {h.parentTemplates.map(t => t.name).join(', ')}
                        </div>
                      )}
                    </div>
                    <span style={styles.mono}>{h.interfaces?.[0]?.ip || h.interfaces?.[0]?.dns || '—'}</span>
                    <span><span className={`badge ${h.status === '0' ? 'badge-ok' : 'badge-info'}`}>{h.status === '0' ? 'Ativo' : 'Desativado'}</span></span>
                    <span><span className={`badge ${h.available === '1' ? 'badge-ok' : h.available === '2' ? 'badge-disaster' : 'badge-info'}`}>{h.available === '1' ? 'Online' : h.available === '2' ? 'Offline' : 'Desconhecido'}</span></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {openHost && <HostModal host={openHost} onClose={() => setOpenHost(null)} />}
    </div>
  );
}

const styles = {
  root: { padding: '28px', width: '100%', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  layout: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px', height: 'calc(100vh - 180px)' },
  sidebar: { display: 'flex', flexDirection: 'column', gap: '10px' },
  searchInput: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none', width: '100%', boxSizing: 'border-box' },
  groupList: { display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1 },
  groupItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-surface)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' },
  groupItemActive: { border: '1px solid var(--gold)', background: 'var(--gold-dim)' },
  content: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  contentHeader: { padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  contentTitle: { fontSize: '16px', fontWeight: 600, color: 'var(--text-accent)', fontFamily: 'var(--font-display)' },
  contentSub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  table: { flex: 1, overflowY: 'auto' },
  row: { display: 'grid', gridTemplateColumns: '2fr 130px 100px 130px', gap: '12px', padding: '12px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', transition: 'background 0.15s' },
  headerRow: { background: 'var(--bg-card)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  hostName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' },
  mono: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' },
  empty: { padding: '40px', textAlign: 'center', color: 'var(--text-muted)' },
};