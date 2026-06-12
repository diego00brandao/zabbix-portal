import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

const SEVERITY = [
  { key: 'disaster', label: 'DISASTER',    color: '#ff5757' },
  { key: 'high',     label: 'HIGH',        color: '#ff9f43' },
  { key: 'average',  label: 'AVERAGE',     color: '#ffd43b' },
  { key: 'warning',  label: 'WARNING',     color: '#4a9eff' },
  { key: 'info',     label: 'INFORMATION', color: '#8892a4' },
];

const SEV_COLOR = {
  '5': '#ff5757', '4': '#ff9f43', '3': '#ffd43b', '2': '#4a9eff', '1': '#8892a4',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [tools, setTools] = React.useState([]);
  React.useEffect(() => {
    api.get('/api/dashboard-links').then(r => setTools(r.data)).catch(() => {});
  }, []);

  const [stats, setStats] = useState(null);
  const [extras, setExtras] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingExtras, setLoadingExtras] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    fetchStats();
    fetchExtras();
    const interval = setInterval(() => { fetchStats(); fetchExtras(); }, 60000);
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      setLoading(true);
      const res = await api.get('/api/zabbix/dashboard');
      setStats(res.data);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao carregar dados do Zabbix');
    } finally {
      setLoading(false);
    }
  }

  async function fetchExtras() {
    try {
      setLoadingExtras(true);
      const res = await api.get('/api/zabbix/dashboard/extras');
      setExtras(res.data);
    } catch {}
    finally { setLoadingExtras(false); }
  }

  const pieData = stats ? SEVERITY.map(s => ({
    name: s.label,
    value: stats.triggersBySeverity[s.key] || 0,
    color: s.color,
  })).filter(d => d.value > 0) : [];

  return (
    <div style={styles.root}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.sub}>{user?.areaName ? `Área: ${user.areaName}` : 'Visão Geral · Todos os Ambientes'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {stats?.zabbixVersion && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '4px 10px' }}>
              Zabbix {stats.zabbixVersion}
            </span>
          )}
          {lastUpdate && <span style={styles.lastUpdate}><span className="live-dot" /> {lastUpdate.toLocaleTimeString('pt-BR')}</span>}
          <button onClick={() => { fetchStats(); fetchExtras(); }} style={styles.refreshBtn} disabled={loading}>
            {loading ? '⟳' : '↺'} Atualizar
          </button>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>⚠ {error} — Verifique a configuração do Zabbix em <code>.env</code></div>}

      {/* KPI Cards */}
      {tools.length > 0 && (
        <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'20px' }}>
          {tools.map(t => {
            const colors = {zabbix:'#d40000',grafana:'#f46800',dynatrace:'#1496ff',servicenow:'#62d84e',datadog:'#632ca6',prometheus:'#e6522c',kibana:'#00bfb3',outro:'var(--gold)'};
            const color = colors[t.tool_type] || colors.outro;
            return (
              <a key={t.id} href={t.url} target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 14px', background:'var(--bg-surface)', border:`1px solid ${color}30`, borderRadius:'var(--radius)', textDecoration:'none' }}>
                <div style={{ width:'24px', height:'24px', borderRadius:'6px', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, color }}>{t.name[0].toUpperCase()}</div>
                <span style={{ fontSize:'12px', fontWeight:500, color:'var(--text-accent)' }}>{t.name}</span>
              </a>
            );
          })}
        </div>
      )}
      {(user?.role === 'admin' || user?.role === 'manager') ? (
        <>
        <div style={styles.grid}>
          <KpiCard loading={loading} icon="⬡" label="Servidores Ativos"
            value={stats?.enabledHosts} sub={`${stats?.disabledHosts || 0} desativados`}
            color="var(--green)" bg="var(--green-dim)" onClick={() => navigate('/hosts?status=active')} />
          <KpiCard loading={loading} icon="◫" label="Templates"
            value={stats?.templates} sub="em uso no ambiente"
            color="var(--blue)" bg="var(--blue-dim)" onClick={() => navigate('/templates')} />
          <KpiCard loading={loading} icon="≡" label="Itens Ativos"
            value={stats?.totalItems} sub={`${stats?.disabledItems || 0} desativados`}
            color="var(--purple)" bg="var(--purple-dim)" onClick={() => navigate('/items?status=active')} />
          <KpiCard loading={loading} icon="◉" label="Triggers Ativas"
            value={stats?.activeTriggerCount} sub={`${stats?.disabledTriggers || 0} desativadas`}
            color="var(--orange)" bg="var(--orange-dim)" onClick={() => navigate('/alltriggers?status=active')} />
          <KpiCard loading={loading} icon="🔴" label="Alertas Ativos"
            value={stats?.activeTriggers}
            sub={stats?.triggersBySeverity?.disaster > 0 ? `${stats.triggersBySeverity.disaster} DISASTER!` : 'nenhum crítico'}
            color={stats?.triggersBySeverity?.disaster > 0 ? 'var(--red)' : 'var(--orange)'}
            bg={stats?.triggersBySeverity?.disaster > 0 ? 'var(--red-dim)' : 'var(--orange-dim)'}
            urgent={stats?.triggersBySeverity?.disaster > 0} onClick={() => navigate('/triggers')} />
        </div>
        <div style={{ ...styles.card, marginBottom:'16px' }}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Histórico de Alertas — 7 dias</span>
          </div>
          {loadingExtras ? (
            <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius)' }} />
          ) : !extras?.alertHistory?.length ? (
            <div style={styles.emptyState}><p style={{ fontSize: '12px' }}>Sem dados de histórico</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={extras.alertHistory} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '12px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                <Line type="monotone" dataKey="count" stroke="#ff9f43" strokeWidth={2} dot={{ fill: '#ff9f43', r: 3 }} name="Alertas" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
        </>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'180px 180px 1fr', gap:'16px', marginBottom:'16px', alignItems:'stretch' }}>
          <KpiCard loading={loading} icon="⬡" label="Servidores Ativos"
            value={stats?.enabledHosts} sub={`${stats?.disabledHosts || 0} desativados`}
            color="var(--green)" bg="var(--green-dim)" onClick={() => navigate('/hosts?status=active')} />
          <KpiCard loading={loading} icon="🔴" label="Alertas Ativos"
            value={stats?.activeTriggers}
            sub={stats?.triggersBySeverity?.disaster > 0 ? `${stats.triggersBySeverity.disaster} DISASTER!` : 'nenhum crítico'}
            color={stats?.triggersBySeverity?.disaster > 0 ? 'var(--red)' : 'var(--orange)'}
            bg={stats?.triggersBySeverity?.disaster > 0 ? 'var(--red-dim)' : 'var(--orange-dim)'}
            urgent={stats?.triggersBySeverity?.disaster > 0} onClick={() => navigate('/triggers')} />
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>Histórico de Alertas — 7 dias</span>
            </div>
            {loadingExtras ? (
              <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius)' }} />
            ) : !extras?.alertHistory?.length ? (
              <div style={styles.emptyState}><p style={{ fontSize: '12px' }}>Sem dados de histórico</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={extras.alertHistory} margin={{ top: 4, right: 16, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '12px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                  <Line type="monotone" dataKey="count" stroke="#ff9f43" strokeWidth={2} dot={{ fill: '#ff9f43', r: 3 }} name="Alertas" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Segunda linha: Alertas por Severidade + Últimos Alertas + Top Hosts */}
      <div style={styles.threeCol}>
        {/* Alertas por severidade */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Alertas por Severidade</span>
             <span />
          </div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '36px' }} />)}
            </div>
          ) : pieData.length === 0 ? (
            <div style={styles.emptyState}><span style={{ fontSize: '28px' }}>✓</span><p>Nenhum alerta ativo</p></div>
          ) : (
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={pieData} innerRadius={30} outerRadius={46} paddingAngle={2} dataKey="value">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="transparent" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '12px' }} itemStyle={{ color: 'var(--text-primary)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {SEVERITY.map(s => {
                  const val = stats?.triggersBySeverity?.[s.key] || 0;
                  return (
                    <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={() => navigate('/triggers')}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: s.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{s.label}</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: val > 0 ? s.color : 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{val}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Últimos alertas */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Últimos Alertas</span>
            <span onClick={() => navigate('/triggers')} style={styles.cardLink}>ver todos →</span>
          </div>
          {loadingExtras ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '28px' }} />)}
            </div>
          ) : !extras?.recentAlerts?.length ? (
            <div style={styles.emptyState}><span style={{ fontSize: '22px' }}>✓</span><p style={{ fontSize: '12px' }}>Nenhum alerta recente</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {extras.recentAlerts.slice(0, 5).map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${SEV_COLOR[a.priority] || 'var(--text-muted)'}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{a.hosts?.[0]?.name || '—'}</div>
                  </div>
                  <span style={{ fontSize: '10px', color: SEV_COLOR[a.priority] || 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 600, flexShrink: 0 }}>
                    {['','INFO','WARN','AVG','HIGH','DIS'][parseInt(a.priority)] || a.priority}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top hosts com problemas */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>Top Hosts com Problemas</span>
              <span />
          </div>
          {loadingExtras ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '28px' }} />)}
            </div>
          ) : !extras?.topHosts?.length ? (
            <div style={styles.emptyState}><span style={{ fontSize: '22px' }}>✓</span><p style={{ fontSize: '12px' }}>Nenhum host com problemas</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {extras.topHosts.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', width: '16px', textAlign: 'center' }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--red)', fontFamily: 'var(--font-mono)', background: 'var(--red-dim)', padding: '2px 8px', borderRadius: '4px' }}>{h.alerts}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}



function KpiCard({ loading, icon, label, value, sub, color, bg, urgent, onClick }) {
  return (
    <div onClick={onClick}
      style={{ ...styles.kpiCard, border: `1px solid ${urgent ? 'rgba(255,87,87,0.3)' : 'var(--border)'}`, ...(urgent ? { boxShadow: '0 0 20px rgba(255,87,87,0.08)' } : {}), cursor: onClick ? 'pointer' : 'default', transition: 'border-color 0.18s' }}
      className="animate-in"
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = color; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderColor = urgent ? 'rgba(255,87,87,0.3)' : 'var(--border)'; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ ...styles.kpiIcon, color, background: bg }}>{icon}</div>
        {urgent && <span className="badge badge-disaster">Crítico</span>}
      </div>
      {loading ? (
        <><div className="skeleton" style={{ height: '32px', width: '60%', marginTop: '12px' }} /><div className="skeleton" style={{ height: '14px', width: '80%', marginTop: '6px' }} /></>
      ) : (
        <><div style={{ ...styles.kpiValue, color }}>{value ?? '—'}</div><div style={styles.kpiLabel}>{label}</div><div style={styles.kpiSub}>{sub}</div></>
      )}
    </div>
  );
}

const styles = {
  root: { padding: '28px', width: '100%', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)', letterSpacing: '0.01em' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'var(--font-mono)' },
  lastUpdate: { fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)' },
  refreshBtn: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '6px 14px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', transition: 'all var(--transition)' },
  errorBanner: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.25)', borderRadius: 'var(--radius)', padding: '12px 16px', color: 'var(--red)', fontSize: '13px', marginBottom: '20px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '20px' },
  threeCol: { display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: '16px', marginBottom: '0' },
  kpiCard: { background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '2px' },
  kpiIcon: { width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', marginBottom: '4px' },
  kpiValue: { fontSize: '28px', fontWeight: 600, fontFamily: 'var(--font-mono)', lineHeight: 1.1, marginTop: '8px' },
  kpiLabel: { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px' },
  kpiSub: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-accent)', letterSpacing: '0.04em', textTransform: 'uppercase' },
  cardLink: { fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)', cursor: 'pointer' },
  emptyState: { textAlign: 'center', padding: '20px', color: 'var(--green)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' },
};