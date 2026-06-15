import { interpretExpression } from '../utils/interpretExpression';
import React, { useEffect, useState } from 'react';
// pulse styles injected
if (typeof document !== 'undefined' && !document.getElementById('pulse-styles')) {
  const s = document.createElement('style');
  s.id = 'pulse-styles';
  s.textContent = `
    @keyframes pulse-green { 0%,100%{box-shadow:0 0 0 0 rgba(46,204,143,0.6)} 50%{box-shadow:0 0 0 5px rgba(46,204,143,0)} }
    @keyframes pulse-red   { 0%,100%{box-shadow:0 0 0 0 rgba(255,87,87,0.7)}  50%{box-shadow:0 0 0 5px rgba(255,87,87,0)}  }
    @keyframes pulse-gray  { 0%,100%{box-shadow:0 0 0 0 rgba(136,146,164,0.5)} 50%{box-shadow:0 0 0 4px rgba(136,146,164,0)} }
    .dot-green { width:10px;height:10px;border-radius:50%;background:#2ecc8f;animation:pulse-green 1.5s infinite;flex-shrink:0 }
    .dot-red   { width:10px;height:10px;border-radius:50%;background:#ff5757;animation:pulse-red 1.2s infinite;flex-shrink:0 }
    .dot-gray  { width:10px;height:10px;border-radius:50%;background:#8892a4;animation:pulse-gray 2s infinite;flex-shrink:0 }
  `;
  document.head.appendChild(s);
}

import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts';
import api from '../services/api';

const SEV = {
  '5': { l: 'DISASTER',    c: 'var(--red)' },
  '4': { l: 'HIGH',        c: 'var(--orange)' },
  '3': { l: 'AVERAGE',     c: 'var(--yellow)' },
  '2': { l: 'WARNING',     c: 'var(--blue)' },
  '1': { l: 'INFORMATION', c: 'var(--text-muted)' },
  '0': { l: 'N/C',         c: 'var(--text-muted)' },
};

function DetailModal({ title, subtitle, stats, tabs, activeTab, onTabChange, children, onClose }) {
  return (
    <div style={styles.modalOverlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modal} className="animate-in">
        <div style={styles.modalHeader}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.modalTitle}>{title}</div>
            {subtitle && <div style={styles.modalDesc}>{subtitle}</div>}
            {stats && <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>{stats}</div>}
          </div>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>
        <div style={styles.tabs}>
          {tabs.map(([val, lbl]) => (
            <button key={val} onClick={() => onTabChange(val)}
              style={{ ...styles.tab, ...(activeTab === val ? styles.tabActive : {}) }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

function ItemsTable({ items }) {
  const [filter, setFilter] = useState('');
  const filtered = items?.filter(i =>
    !filter ||
    i.name?.toLowerCase().includes(filter.toLowerCase()) ||
    i.key_?.toLowerCase().includes(filter.toLowerCase())
  ) || [];
  if (!items?.length) return <div style={styles.empty}>Nenhum item encontrado</div>;
  return (
    <div>
      <input placeholder="Filtrar itens..." value={filter} onChange={e => setFilter(e.target.value)}
        style={{ ...styles.searchInput, marginBottom: '10px', width: '100%' }} />
      <div style={styles.detailTableHeader}>
        <span>Nome</span><span>Tipo</span><span>Intervalo</span><span>Última Coleta</span><span>Valor</span>
      </div>
      {filtered.map(item => (
        <div key={item.itemid} style={{ ...styles.detailRow, ...(item.status === '1' ? { opacity: 0.5 } : {}) }}>
          <div>
            <div style={{ fontSize: '13px', color: item.isQuery ? 'var(--purple)' : 'var(--text-primary)', fontWeight: 500 }}>
              {item.isQuery && '◎ '}{item.name}
              {item.status === '1' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: '3px' }}>desativado</span>}
            </div>
            <div style={styles.mono}>{item.key_}</div>
          </div>
          <span style={styles.typeBadge}>{item.typeLabel}</span>
          <span style={styles.mono}>{item.delayFormatted}</span>
          <span style={styles.mono}>{item.lastclock && parseInt(item.lastclock) > 0 ? new Date(parseInt(item.lastclock)*1000).toLocaleString('pt-BR') : '—'}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{(() => { const v = item.lastvalue; const u = item.units; if (!v || v === '') return '—'; const n = parseFloat(v); if (isNaN(n)) return v; if (u === 'B' || u === 'Bps') { if (n >= 1073741824) return (n/1073741824).toFixed(2) + ' G' + u; if (n >= 1048576) return (n/1048576).toFixed(2) + ' M' + u; if (n >= 1024) return (n/1024).toFixed(2) + ' K' + u; return n.toFixed(2) + ' ' + u; } if (u === 'bps') { if (n >= 1000000) return (n/1000000).toFixed(2) + ' Mbps'; if (n >= 1000) return (n/1000).toFixed(2) + ' Kbps'; return n.toFixed(2) + ' bps'; } if (u === 'ms') { if (n >= 1000) return (n/1000).toFixed(2) + ' s'; return n.toFixed(2) + ' ms'; } if (u === 's') { if (n >= 86400) return (n/86400).toFixed(1) + ' d'; if (n >= 3600) return (n/3600).toFixed(1) + ' h'; if (n >= 60) return (n/60).toFixed(1) + ' m'; return n.toFixed(2) + ' s'; } if (u === 'unixtime') return new Date(n*1000).toLocaleString('pt-BR'); if (u === 'unixtime') return new Date(n*1000).toLocaleString('pt-BR'); if (u === '%') return n.toFixed(2) + ' %'; if (u) return n.toFixed(2) + ' ' + u; return n.toFixed(2); })()}</span>
        </div>
      ))}
      {filtered.length === 0 && <div style={styles.empty}>Nenhum item para "{filter}"</div>}
    </div>
  );
}



function timeAgo(ts) {
  if (!ts || ts === '0') return '\u2014';
  const diff = Math.floor(Date.now() / 1000) - parseInt(ts);
  if (diff < 60) return 'h\u00e1 menos de 1 min';
  if (diff < 3600) return `h\u00e1 ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `h\u00e1 ${Math.floor(diff/3600)}h`;
  if (diff < 2592000) return `h\u00e1 ${Math.floor(diff/86400)} dia${Math.floor(diff/86400)>1?'s':''}`;
  if (diff < 31536000) return `h\u00e1 ${Math.floor(diff/2592000)} m\u00eas${Math.floor(diff/2592000)>1?'es':''}`;
  return `h\u00e1 ${Math.floor(diff/31536000)} ano${Math.floor(diff/31536000)>1?'s':''}`;
}
function TriggersTable({ triggers, showTimeAgo }) {
  const [trigSearch, setTrigSearch] = React.useState('');
  const filtered = (triggers||[]).filter(t => !trigSearch || (t.description||'').toLowerCase().includes(trigSearch.toLowerCase()));
  if (!triggers?.length) return <div style={styles.empty}>Nenhum trigger encontrado</div>;
  return (
    <div>
      <input placeholder="Filtrar triggers..." value={trigSearch} onChange={e => setTrigSearch(e.target.value)} style={{ width:'100%', background:'var(--bg-surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'7px 12px', color:'var(--text-primary)', fontSize:'12px', outline:'none', marginBottom:'8px', boxSizing:'border-box' }} />
      <div style={styles.detailTableHeader2}>
        <span>Trigger</span><span>Severidade</span><span>{showTimeAgo ? 'Dura\u00e7\u00e3o' : 'Status'}</span>
      </div>
      {filtered.map(t => {
        const sev = SEV[t.priority] || SEV['0'];
        return (
          <div key={t.triggerid} style={styles.detailRow2}>
            <div>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{t.description}</div>
              {t.expression && (() => {
                const interpreted = interpretExpression(t.expression);
                return interpreted
                  ? <div style={{ fontSize: '11px', marginTop: '3px', color: 'var(--blue)', fontWeight: 500 }}>◈ {interpreted}</div>
                  : <div style={{ fontSize: '11px', marginTop: '2px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{t.expression.slice(0, 120)}…</div>;
              })()}


            </div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: sev.c, fontFamily: 'var(--font-mono)' }}>{sev.l}</span>
            {showTimeAgo
              ? <span style={{ fontSize: '12px', color: 'var(--orange)', fontFamily: 'var(--font-mono)' }}>{timeAgo(t.lastchange)}</span>
              : <span><span className={`badge ${t.status === '0' ? 'badge-ok' : 'badge-info'}`}>{t.status === '0' ? 'Ativo' : 'Desabilitado'}</span></span>
            }
          </div>
        );
      })}
    </div>
  );
}

function TimelineTab({ alerts }) {
  if (!alerts?.length) return <div style={styles.empty}>Nenhum evento encontrado</div>;
  const sorted = [...alerts].sort((a, b) => parseInt(b.lastchange || 0) - parseInt(a.lastchange || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sorted.map(alert => {
        const sev = SEV[alert.priority] || SEV['0'];
        return (
          <div key={alert.triggerid} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '12px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ minWidth: '70px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {alert.lastchange ? new Date(parseInt(alert.lastchange) * 1000).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '--:--'}
            </div>
            <div style={{ width: '10px', height: '10px', borderRadius: '999px', marginTop: '4px', background: sev.c, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{alert.description}</div>
              <div style={{ marginTop: '4px', fontSize: '11px', color: sev.c, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>{sev.l}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HostsList({ hosts }) {
  if (!hosts?.length) return <div style={styles.empty}>Nenhum host usa este template</div>;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
      {hosts.map(h => (
        <div key={h.hostid} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--green)', fontSize: '14px' }}>⬡</span>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{h.name}</span>
        </div>
      ))}
    </div>
  );
}

function HealthReport({ health, onDownloadJSON, onDownloadCSV, onDownloadExcel, onTemplateClick }) {
  const { user } = useAuth();
  if (!health) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius)' }} />)}
    </div>
  );
  const { summary, host, alerts } = health;
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

      {host.parentTemplates?.length > 0 && (user?.role === 'admin' || user?.role === 'manager') && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>◫ Templates Vinculados</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {host.parentTemplates.map(t => (
              <span key={t.templateid} onClick={() => onTemplateClick && onTemplateClick(t.templateid)}
                style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: '4px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {alerts.length > 0 && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.2)', borderRadius: 'var(--radius)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>◉</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--red)' }}>{alerts.length} alerta{alerts.length > 1 ? 's' : ''} ativo{alerts.length > 1 ? 's' : ''} agora</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>— veja a aba Alertas para detalhes</span>
        </div>
      )}
      {false && alerts.length > 0 && (
        <div>
          {[...alerts].sort((a,b) => parseInt(b.lastchange||0) - parseInt(a.lastchange||0)).map(a => {
            const sev = SEV[a.priority] || SEV['0'];
            return (
              <div key={a.triggerid} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,87,87,0.1)' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: sev.c, minWidth: '90px', fontFamily: 'var(--font-mono)' }}>{sev.l}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', flex: 1 }}>{a.description}</span>
                {a.lastchange && parseInt(a.lastchange) > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {timeAgo(a.lastchange)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onDownloadJSON} style={{ ...styles.exportBtn }}>⤓ JSON</button>
        <button onClick={onDownloadCSV} style={{ ...styles.exportBtn, background: 'var(--blue-dim)', borderColor: 'rgba(74,158,255,0.3)', color: 'var(--blue)' }}>⤓ CSV</button>
        <button onClick={onDownloadExcel} style={{ ...styles.exportBtn, background: 'var(--green-dim)', borderColor: 'rgba(46,204,143,0.3)', color: 'var(--green)' }}>⤓ Excel</button>
      </div>
    </div>
  );
}

function TrendsTab({ hostId }) {
  const [period, setPeriod] = useState('1d');
  const [customMode, setCustomMode] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [trends, setTrends] = useState(null);
  const [loading, setLoading] = useState(false);

  const periods = ['5m','15m','30m','1h','3h','6h','12h','1d','2d','7d','30d','60d','1y'];
  const periodLabels = {
    '5m':'5 minutos','15m':'15 minutos','30m':'30 minutos','1h':'1 hora',
    '3h':'3 horas','6h':'6 horas','12h':'12 horas','1d':'1 dia',
    '2d':'2 dias','7d':'7 dias','30d':'30 dias','60d':'60 dias','1y':'1 ano',
  };

  useEffect(() => {
    if (!hostId) return;
    if (customMode) return;
    setLoading(true);
    setTrends(null);
    api.get(`/api/zabbix/host/${hostId}/trends?period=${period}`)
      .then(r => setTrends(r.data))
      .catch(() => setTrends(null))
      .finally(() => setLoading(false));
  }, [hostId, period, customMode]);

  function buscarCustom() {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setTrends(null);
    api.get(`/api/zabbix/host/${hostId}/trends?from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}`)
      .then(r => setTrends(r.data))
      .catch(() => setTrends(null))
      .finally(() => setLoading(false));
  }

  function formatTime(ts) {
    const d = new Date(ts);
    if (['5m','15m','30m','1h','3h','6h','12h'].includes(period) || customMode)
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (['1d','2d'].includes(period))
      return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function AnalysisCard({ analysis, color }) {
    if (!analysis) return null;
    return (
      <div style={{ background: 'var(--bg-hover)', borderRadius: 'var(--radius)', padding: '12px 16px', border: `1px solid ${color}33`, marginTop: '10px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
          {[['Média', `${analysis.avg}%`], ['Máximo', `${analysis.max}%`], ['Mínimo', `${analysis.min}%`]].map(([k, v]) => (
            <div key={k} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{v}</div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{k}</div>
            </div>
          ))}
        </div>
        {analysis.peakHour !== undefined && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            ⚡ Horário mais crítico: {analysis.peakHour}h
            {analysis.peakTime && ` · Pico em ${new Date(analysis.peakTime).toLocaleString('pt-BR')}`}
          </div>
        )}
      </div>
    );
  }

  function ChartCard({ title, series, color, analysis }) {
    const [zoomLeft, setZoomLeft] = useState(null);
    const [zoomRight, setZoomRight] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [zoomedData, setZoomedData] = useState(null);

    const rawData = series?.map(d => ({ time: formatTime(d.time), ts: d.time, value: parseFloat(d.value.toFixed(1)) })) || [];
    const chartData = zoomedData || rawData;

    function handleMouseDown(e) {
      if (!e?.activeLabel) return;
      setZoomLeft(e.activeLabel);
      setIsSelecting(true);
    }
    function handleMouseMove(e) {
      if (!isSelecting || !e?.activeLabel) return;
      setZoomRight(e.activeLabel);
    }
    function handleMouseUp() {
      if (!isSelecting || !zoomLeft || !zoomRight) { setIsSelecting(false); return; }
      const l = rawData.findIndex(d => d.time === zoomLeft);
      const r = rawData.findIndex(d => d.time === zoomRight);
      if (l !== -1 && r !== -1 && l !== r) {
        const [start, end] = l < r ? [l, r] : [r, l];
        setZoomedData(rawData.slice(start, end + 1));
      }
      setZoomLeft(null); setZoomRight(null); setIsSelecting(false);
    }
    function resetZoom() { setZoomedData(null); setZoomLeft(null); setZoomRight(null); }

    if (!series?.length) return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>Sem dados para o período selecionado</div>
      </div>
    );

    const gradId = `grad-${title.replace(/[^a-z0-9]/gi, '')}`;
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</div>
          {zoomedData && (
            <button onClick={resetZoom} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-muted)', cursor: 'pointer' }}>
              ↺ Reset zoom
            </button>
          )}
        </div>
        {!zoomedData && <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'var(--font-mono)' }}>Clique e arraste no gráfico para dar zoom</div>}
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}
            onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: '6px', fontSize: '11px' }} itemStyle={{ color }} formatter={v => [`${v}%`]} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} dot={false} name={title} />
            {isSelecting && zoomLeft && zoomRight && (
              <ReferenceArea x1={zoomLeft} x2={zoomRight} fill={color} fillOpacity={0.15} stroke={color} strokeOpacity={0.4} />
            )}
          </AreaChart>
        </ResponsiveContainer>
        {analysis && <AnalysisCard analysis={analysis} color={color} />}
      </div>
    );
  }

  function behaviorSummary() {
    if (!trends) return null;
    const { cpu, memory } = trends;
    const parts = [];
    if (cpu.analysis) {
      const avg = parseFloat(cpu.analysis.avg);
      if (avg > 80) parts.push(`CPU sob alta pressão (média ${avg}%)`);
      else if (avg > 50) parts.push(`CPU com uso moderado (média ${avg}%)`);
      else parts.push(`CPU estável (média ${avg}%)`);
    }
    if (memory.analysis) {
      const avg = parseFloat(memory.analysis.avg);
      if (avg > 85) parts.push(`memória crítica (média ${avg}%)`);
      else if (avg > 60) parts.push(`memória em uso moderado (média ${avg}%)`);
      else parts.push(`memória saudável (média ${avg}%)`);
    }
    if (!parts.length) return null;
    return `No período de ${customMode ? 'intervalo personalizado' : periodLabels[period]}, o host apresentou ${parts.join(' e ')}.`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Períodos rápidos */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {!customMode && periods.map(p => (
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
      </div>

      {/* Seletor customizado */}
      {customMode && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px' }}>
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
            style={{ padding: '6px 16px', borderRadius: 'var(--radius)', border: '1px solid rgba(201,168,76,0.4)', background: 'var(--gold-dim)', color: 'var(--gold)', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)', opacity: (!dateFrom || !dateTo) ? 0.5 : 1 }}>
            ◈ Buscar
          </button>
        </div>
      )}

      {!loading && trends && behaviorSummary() && (
        <div style={{ background: 'var(--blue-dim)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: 'var(--radius)', padding: '12px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--blue)', fontWeight: 600 }}>◈ Análise: </span>{behaviorSummary()}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '180px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : !trends ? (
        <div style={styles.empty}>
          {customMode ? 'Selecione o período e clique em Buscar' : 'Erro ao carregar dados de tendência'}
        </div>
      ) : (
        <>
          {trends.cpu.series.length > 0 && <ChartCard title="CPU Utilization %" series={trends.cpu.series} color="#ff9f43" analysis={trends.cpu.analysis} />}
          {trends.memory.series.length > 0 && <ChartCard title="Memory Utilization %" series={trends.memory.series} color="#4a9eff" analysis={trends.memory.analysis} />}
          {trends.disk.map((d, i) => (
            <ChartCard key={i} title={`Disco: ${d.name}`} series={d.data} color="#2ecc8f" analysis={d.analysis} />
          ))}
          {trends.db && trends.db.map((d, i) => (
            <ChartCard key={'db'+i} title={`◎ ${d.name}`} series={d.data} color="#a78bfa" analysis={d.analysis} />
          ))}
          {trends.cpu.series.length === 0 && trends.memory.series.length === 0 && trends.disk.length === 0 && (!trends.db || trends.db.length === 0) && (
            <div style={styles.empty}>Nenhum dado de tendência disponível para este host no período selecionado.</div>
          )}
        </>
      )}
    </div>
  );
}


const TECH_MAP = [
  { key: 'all',     label: 'Todos',       icon: '◈',  color: 'var(--text-accent)', keywords: [] },
  { key: 'mssql',   label: 'SQL Server',  icon: '🗄',  color: '#e74c3c', keywords: ['mssql','sqlserver','sql server'] },
  { key: 'oracle',  label: 'Oracle',      icon: '🔶',  color: '#f39c12', keywords: ['oracle'] },
  { key: 'mysql',   label: 'MySQL',       icon: '🐬',  color: '#3498db', keywords: ['mysql'] },
  { key: 'postgres',label: 'PostgreSQL',  icon: '🐘',  color: '#2980b9', keywords: ['postgres','postgresql'] },
  { key: 'linux',   label: 'Linux',       icon: '🐧',  color: '#27ae60', keywords: ['linux','ubuntu','debian','centos','rhel','zabbix agent'] },
  { key: 'windows', label: 'Windows',     icon: '🪟',  color: '#2980b9', keywords: ['windows','win'] },
  { key: 'vmware',  label: 'VMware',      icon: '☁',  color: '#8e44ad', keywords: ['vmware','vsphere','esxi'] },
  { key: 'network', label: 'Rede',        icon: '🌐',  color: '#16a085', keywords: ['cisco','network','switch','router','firewall'] },
  { key: 'aws',     label: 'AWS/RDS',     icon: '☁',  color: '#f39c12', keywords: ['aws','rds','ec2','amazon'] },
];

function detectHostTech(host) {
  const templates = host.parentTemplates || [];
  const allNames = templates.map(t => t.name.toLowerCase()).join(' ');
  for (const tech of TECH_MAP) {
    if (tech.key === 'all') continue;
    if (tech.keywords.some(k => allNames.includes(k))) return tech.key;
  }
  return 'other';
}


function AnomalyBanner({ anomalies }) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed || !anomalies || anomalies.length === 0) return null;
  return (
    <div style={{ background:'rgba(255,159,67,0.08)', border:'1px solid rgba(255,159,67,0.3)', borderRadius:'var(--radius-lg)', padding:'14px 18px', marginBottom:'16px', position:'relative' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
        <span style={{ fontSize:'16px' }}>⚡</span>
        <span style={{ fontSize:'13px', fontWeight:600, color:'#ff9f43' }}>Anomaly Detection — {anomalies.length} host{anomalies.length!==1?'s':''} com comportamento anômalo</span>
        <button onClick={()=>setDismissed(true)} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'16px' }}>✕</button>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
        {anomalies.slice(0,5).map((a,i)=>(
          <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', fontSize:'12px' }}>
            <span style={{ color:'#ff9f43' }}>▸</span>
            <span style={{ fontWeight:600, color:'var(--text-accent)' }}>{a.host}</span>
            <span style={{ color:'var(--text-muted)' }}>—</span>
            <span style={{ color:'var(--text-secondary)' }}>{a.reason}</span>
            {a.value&&<span style={{ color:'#ff9f43', fontFamily:'var(--font-mono)', fontWeight:600 }}>{a.value}</span>}
          </div>
        ))}
        {anomalies.length>5&&<div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>+{anomalies.length-5} outros</div>}
      </div>
    </div>
  );
}

export function Hosts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anomalies, setAnomalies] = useState([]);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [health, setHealth] = useState(null);
  const [detailTab, setDetailTab] = useState('health');
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedHosts, setSelectedHosts] = useState([]);
  const [multiHealth, setMultiHealth] = useState(null);
  const [multiLoading, setMultiLoading] = useState(false);
  const [hostMeta, setHostMeta] = useState(null);
  const [metaSaving, setMetaSaving] = useState(false);

  useEffect(() => {
    api.get('/api/zabbix/hosts').then(r => {
      setHosts(r.data);
      const anom = [];
      (r.data||[]).forEach(h => {
        const alertCount = h.activeAlerts || 0;
        if (alertCount >= 5) anom.push({ host: h.name||h.host, reason: 'Muitos alertas ativos', value: alertCount+' alertas' });
        else if (h.available==='2') anom.push({ host: h.name||h.host, reason: 'Host indisponível', value: 'UNAVAILABLE' });
      });
      setAnomalies(anom);
    }).finally(() => setLoading(false));
  }, []);

  async function loadHostMeta(hostid) {
    try {
      const r = await api.get(`/api/host-metadata/${hostid}`);
      setHostMeta(r.data);
    } catch { setHostMeta({}); }
  }
  async function openHost(h) {
    setSelected(h);
    setDetailTab('health');
    setDetail(null);
    setHealth(null);
    setHostMeta(null);
    setDetailLoading(true);
    loadHostMeta(h.hostid);
    try {
      const [healthRes, itemsRes, triggersRes, alertsRes] = await Promise.all([
        api.get(`/api/zabbix/host/${h.hostid}/health`),
        api.get(`/api/zabbix/host/${h.hostid}/items`),
        api.get(`/api/zabbix/host/${h.hostid}/triggers`),
        api.get(`/api/zabbix/host/${h.hostid}/alerts`),
      ]);
      setHealth(healthRes.data);
      setDetail({ items: itemsRes.data, triggers: triggersRes.data, alerts: alertsRes.data });
    } catch {
      setHealth(null);
      setDetail({ items: [], triggers: [], alerts: [] });
    }
    setDetailLoading(false);
  }

  function toggleSelectHost(e, h) {
    e.stopPropagation();
    setSelectedHosts(prev =>
      prev.find(x => x.hostid === h.hostid)
        ? prev.filter(x => x.hostid !== h.hostid)
        : [...prev, h]
    );
  }

  async function loadMultiHealth() {
    if (selectedHosts.length === 0) return;
    setMultiLoading(true);
    setMultiHealth(null);
    try {
      const results = await Promise.all(
        selectedHosts.map(h => api.get(`/api/zabbix/host/${h.hostid}/health`).then(r => r.data))
      );
      setMultiHealth(results);
    } catch {}
    setMultiLoading(false);
  }

  function downloadMultiCSV() {
    if (!multiHealth) return;
    const rows = multiHealth.map(h => [
      h.host?.name || '', h.host?.host || '',
      h.summary.itemsActive, h.summary.itemsDisabled,
      h.summary.triggersActive, h.summary.triggersDisabled,
      h.summary.activeAlerts, h.alerts.map(a => a.description).join(' | '), h.generatedAt,
    ]);
    const header = 'Nome;Hostname;Itens Ativos;Itens Desativados;Triggers Ativas;Triggers Desativadas;Alertas;Alertas Descrição;Gerado em';
    const csv = '\uFEFF' + [header, ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `saude_multiplos_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadMultiExcel() {
    if (!selectedHosts.length) return;
    const token = localStorage.getItem('token');
    const res = await fetch('/api/zabbix/hosts/health/excel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostIds: selectedHosts.map(h => h.hostid) }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saude_multiplos_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadCSV() {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/reports/hosts?format=csv', { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'hosts.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadHealthJSON() {
    if (!health) return;
    const blob = new Blob([JSON.stringify(health, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `saude_${selected?.host}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  function downloadHealthCSV() {
    if (!health) return;
    const rows = [
      ['=== RESUMO ===', ''],
      ['Host', health.host?.name || ''],
      ['Hostname', health.host?.host || ''],
      ['Itens Ativos', health.summary.itemsActive],
      ['Itens Desativados', health.summary.itemsDisabled],
      ['Triggers Ativas', health.summary.triggersActive],
      ['Triggers Desativadas', health.summary.triggersDisabled],
      ['Alertas Ativos', health.summary.activeAlerts],
      ['Gerado em', health.generatedAt],
      [],
      ['=== TEMPLATES VINCULADOS ===', ''],
      ...(health.host?.parentTemplates?.length > 0
        ? health.host.parentTemplates.map(t => ['Template', t.name])
        : [['', 'Nenhum template vinculado']]),
      [],
      ['=== ALERTAS ATIVOS ===', ''],
      ...(health.alerts?.length > 0
        ? [['Severidade', 'Descrição', 'Desde'],
           ...health.alerts.map(a => [SEV[a.priority]?.l || a.priority, a.description,
             a.lastchange && parseInt(a.lastchange) > 0 ? new Date(parseInt(a.lastchange) * 1000).toLocaleString('pt-BR') : '—'])]
        : [['', 'Nenhum alerta ativo']]),
      [],
      ['=== ITENS MONITORADOS ===', ''],
      ['Status', 'Nome', 'Chave', 'Tipo', 'Intervalo', 'Detalhes'],
      ...(detail?.items?.map(i => [i.status === '0' ? 'Ativo' : 'Desativado', i.name, i.key_, i.typeLabel, i.delayFormatted, i.params || i.description || '—']) || []),
      [],
      ['=== TRIGGERS ===', ''],
      ['Status', 'Descrição', 'Severidade', 'Última Mudança'],
      ...(detail?.triggers?.map(t => [t.status === '0' ? 'Ativa' : 'Desabilitada', t.description, SEV[t.priority]?.l || t.priority,
        t.lastchange && parseInt(t.lastchange) > 0 ? new Date(parseInt(t.lastchange) * 1000).toLocaleString('pt-BR') : '—']) || []),
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `saude_${selected?.host}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function downloadHealthExcel() {
    if (!selected) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/zabbix/host/${selected.hostid}/health/excel`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `saude_${selected.host}_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function renderTabContent() {
    if (detailLoading && !detail) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius)' }} />)}
      </div>
    );
    if (detailTab === 'health') return (
      <HealthReport health={health} onDownloadJSON={downloadHealthJSON} onDownloadCSV={downloadHealthCSV} onDownloadExcel={downloadHealthExcel}
        onTemplateClick={(tid) => { setSelected(null); navigate('/templates?highlight=' + tid); }} />
    );
    if (detailTab === 'items') return <ItemsTable items={detail?.items || []} />;
    if (detailTab === 'triggers') return <TriggersTable triggers={detail?.triggers || []} />;
    if (detailTab === 'alerts') return (detail?.alerts || []).length === 0
      ? <div style={{ ...styles.empty, color: 'var(--green)' }}>✓ Nenhum alerta ativo neste servidor</div>
      : <TriggersTable triggers={[...detail.alerts].sort((a,b)=>parseInt(b.lastchange||0)-parseInt(a.lastchange||0))} showTimeAgo />;
    if (detailTab === 'trends') return <TrendsTab hostId={selected?.hostid} />;
    if (detailTab === 'timeline') return <TimelineTab alerts={detail?.alerts || []} />;
    if (detailTab === 'meta') return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Informações adicionais sobre este host — salvas localmente no portal.</div>
        {!hostMeta ? (
          <div className="skeleton" style={{ height: '140px', borderRadius: 'var(--radius)' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsável</label>
              <input value={hostMeta.responsible || ''} onChange={e => setHostMeta(m => ({ ...m, responsible: e.target.value }))} placeholder="Nome do responsável pelo host..." style={{ width: '100%', marginTop: '4px', padding: '8px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Criticidade</label>
              <select value={hostMeta.criticality || 'medium'} onChange={e => setHostMeta(m => ({ ...m, criticality: e.target.value }))} style={{ width: '100%', marginTop: '4px', padding: '8px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}>
                <option value="low">🟢 Baixa</option>
                <option value="medium">🟡 Média</option>
                <option value="high">🟠 Alta</option>
                <option value="critical">🔴 Crítica</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notas</label>
              <textarea value={hostMeta.notes || ''} onChange={e => setHostMeta(m => ({ ...m, notes: e.target.value }))} placeholder="Observações sobre o host..." rows={4} style={{ width: '100%', marginTop: '4px', padding: '8px 10px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <button onClick={async () => { setMetaSaving(true); try { await api.put(`/api/host-metadata/${selected.hostid}`, { ...hostMeta, hostname: selected.name }); } catch(e) { console.error(e); } setMetaSaving(false); }} style={{ alignSelf: 'flex-start', padding: '8px 20px', background: 'var(--gold)', border: 'none', borderRadius: 'var(--radius)', color: '#1a1a2e', fontWeight: 600, fontSize: '13px', cursor: metaSaving ? 'not-allowed' : 'pointer', opacity: metaSaving ? 0.7 : 1 }}>{metaSaving ? 'Salvando...' : '💾 Salvar Metadados'}</button>
          </div>
        )}
      </div>
    );
    return null;
  }

  const techCounts = TECH_MAP.slice(1).reduce((acc, t) => { acc[t.key] = hosts.filter(h => detectHostTech(h) === t.key).length; return acc; }, {});
  const filtered = hosts.filter(h => {
    if (techFilter !== 'all' && detectHostTech(h) !== techFilter) return false;
    const matchText = !filter || h.name?.toLowerCase().includes(filter.toLowerCase()) || h.interfaces?.[0]?.ip?.includes(filter);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' && h.status === '0') || (statusFilter === 'disabled' && h.status === '1');
    return matchText && matchStatus;
  });

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Servidores</h1>
          <p style={styles.sub}>{hosts.length} hosts monitorados</p>
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', margin:'14px 0' }}>
        {TECH_MAP.map(tech => {
          const count = tech.key === 'all' ? hosts.length : (techCounts[tech.key] || 0);
          if (tech.key !== 'all' && count === 0) return null;
          return (
            <button key={tech.key} onClick={() => setTechFilter(tech.key)}
              style={{ display:'flex', alignItems:'center', gap:'6px', padding:'6px 12px', borderRadius:'var(--radius)', border:'1px solid', fontSize:'12px', cursor:'pointer', transition:'all 0.15s',
                background: techFilter === tech.key ? tech.color+'18' : 'var(--bg-surface)',
                color: techFilter === tech.key ? tech.color : 'var(--text-muted)',
                borderColor: techFilter === tech.key ? tech.color+'50' : 'var(--border)',
                fontWeight: techFilter === tech.key ? 600 : 400,
              }}>
              <span>{tech.icon}</span><span>{tech.label}</span>
              <span style={{ fontSize:'10px', fontFamily:'var(--font-mono)', opacity:0.8 }}>{count}</span>
            </button>
          );
        })}
      </div>
        </div>
 <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedHosts.length > 0 && (
            <>
              <button onClick={loadMultiHealth} style={{ ...styles.exportBtn, background: 'var(--blue-dim)', borderColor: 'rgba(74,158,255,0.3)', color: 'var(--blue)' }}>
                ◈ Preview de {selectedHosts.length} servidor{selectedHosts.length > 1 ? 'es' : ''}
              </button>
              <button onClick={downloadMultiExcel} style={{ ...styles.exportBtn, background: 'var(--green-dim)', borderColor: 'rgba(46,204,143,0.3)', color: 'var(--green)' }}>
                ⤓ Excel ({selectedHosts.length})
              </button>
            </>
          )}
        </div>       
      </div>

      <div style={styles.filters}>
        <input placeholder="Filtrar por nome ou IP..." value={filter} onChange={e => setFilter(e.target.value)} style={styles.searchInput} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={styles.select}>
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="disabled">Desativados</option>
        </select>
        <span style={styles.count}>{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
        <button onClick={() => {
          if (filtered.every(h => selectedHosts.find(x => x.hostid === h.hostid)) && filtered.length > 0) {
            setSelectedHosts(prev => prev.filter(h => !filtered.find(x => x.hostid === h.hostid)));
          } else {
            setSelectedHosts(prev => { const news = filtered.filter(h => !prev.find(x => x.hostid === h.hostid)); return [...prev, ...news]; });
          }
        }} style={{ ...styles.exportBtn, fontSize: '12px', whiteSpace: 'nowrap' }}>
          {filtered.every(h => selectedHosts.find(x => x.hostid === h.hostid)) && filtered.length > 0 ? '✕ Desmarcar todos' : '☑ Selecionar todos'}
        </button>
        {selectedHosts.length > 0 && (
          <button onClick={() => setSelectedHosts([])} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>
            ✕ Limpar ({selectedHosts.length})
          </button>
        )}
      </div>

      <div style={styles.table}>  
<div style={{ ...styles.row, ...styles.headerRow, gridTemplateColumns: user?.role === 'viewer' ? '32px 2fr 130px 100px 130px' : '32px 2fr 130px 100px 130px 1fr' }}>
          <span></span>
          <span>Servidor</span><span>IP</span><span>Status</span><span>Disponibilidade</span>{user?.role !== 'viewer' && <span>Grupos</span>}
        </div>
        {loading ? Array(6).fill(0).map((_, i) =>
          <div key={i} className="skeleton" style={{ height: '46px', margin: '4px 0', borderRadius: 'var(--radius)' }} />
        ) : filtered.slice(0, 300).map(h => {
          const isSelected = selectedHosts.find(x => x.hostid === h.hostid);
          return (
            <div key={h.hostid}
              style={{ ...styles.row, gridTemplateColumns: user?.role === 'viewer' ? '32px 2fr 130px 100px 130px' : '32px 2fr 130px 100px 130px 1fr', cursor: 'pointer', background: isSelected ? 'var(--blue-dim)' : 'transparent' }}
              onClick={() => openHost(h)} className="animate-in"
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
              <input type="checkbox" checked={!!isSelected} onChange={() => {}} onClick={e => toggleSelectHost(e, h)}
                style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--blue)' }} />
              <div style={{ display:'flex', alignItems:'flex-start', gap:'8px' }}>
                <div style={{ marginTop:'4px' }}>
                  <div className={h.activeAlerts > 0 ? 'dot-red' : h.available === '1' ? 'dot-green' : 'dot-gray'} title={h.activeAlerts > 0 ? h.activeAlerts + ' alerta(s) ativo(s)' : h.available === '1' ? 'Online' : 'Sem dados'} />
                </div>
                <div>
                <div style={styles.hostName}>{h.name}</div>
                <div style={styles.mono}>{h.host}</div>
                {h.parentTemplates?.length > 0 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    ◫ {h.parentTemplates.map(t => t.name).join(', ')}
                  </div>
                )}
              </div></div>
              <span style={styles.mono}>{h.interfaces?.[0]?.ip || h.interfaces?.[0]?.dns || '—'}</span>
              <span><span className={`badge ${h.status === '0' ? 'badge-ok' : 'badge-info'}`}>{h.status === '0' ? 'Ativo' : 'Desativado'}</span></span>
              <span><span className={`badge ${h.available === '1' ? 'badge-ok' : h.available === '2' ? 'badge-disaster' : 'badge-info'}`}>{h.available === '1' ? 'Online' : h.available === '2' ? 'Offline' : 'Desconhecido'}</span></span>
              {user?.role !== 'viewer' && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{h.groups?.map(g => g.name).join(', ') || '—'}</span>}
            </div>
          );
        })}
        {filtered.length === 0 && !loading && <div style={styles.empty}>Nenhum servidor encontrado</div>}
      </div>

      {multiHealth && (
        <div style={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setMultiHealth(null)}>
          <div style={styles.modal} className="animate-in">
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalTitle}>Saúde de {multiHealth.length} Servidores</div>
                <div style={styles.modalDesc}>Visão consolidada do estado de saúde</div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={() => setMultiHealth(null)} style={styles.closeBtn}>✕</button>
              </div>
            </div>
            <div style={styles.modalBody}>
              {multiLoading ? (
                Array(3).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: 'var(--radius)', marginBottom: '8px' }} />)
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {multiHealth.map((h, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', border: `1px solid ${h.summary.activeAlerts > 0 ? 'rgba(255,87,87,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-accent)' }}>{h.host?.name}</div>
                          <div style={styles.mono}>{h.host?.host}</div>
                        </div>
                        {h.summary.activeAlerts > 0 && <span className="badge badge-disaster">{h.summary.activeAlerts} alertas</span>}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {[
                          { l: 'Itens Ativos', v: h.summary.itemsActive, c: 'var(--green)' },
                          { l: 'Itens Desativ.', v: h.summary.itemsDisabled, c: 'var(--text-muted)' },
                          { l: 'Triggers Ativas', v: h.summary.triggersActive, c: 'var(--blue)' },
                          { l: 'Alertas', v: h.summary.activeAlerts, c: h.summary.activeAlerts > 0 ? 'var(--red)' : 'var(--green)' },
                        ].map(m => (
                          <div key={m.l} style={{ textAlign: 'center', padding: '8px', background: 'var(--bg-hover)', borderRadius: 'var(--radius)' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: m.c, fontFamily: 'var(--font-mono)' }}>{m.v}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{m.l}</div>
                          </div>
                        ))}
                      </div>
                      {h.alerts.length > 0 && (
                        <div style={{ marginTop: '10px', padding: '8px 10px', background: 'var(--red-dim)', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--red)' }}>
                          {h.alerts.slice(0, 2).map(a => `• ${a.description}`).join(' ')}
                          {h.alerts.length > 2 && ` +${h.alerts.length - 2} mais`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <DetailModal
          title={selected.name}
          subtitle={`${selected.host} · ${selected.interfaces?.[0]?.ip || '—'}`}
          stats={<>
            <span style={styles.tplStat}><span style={{ color: 'var(--blue)' }}>⬡</span> {selected.groups?.map(g => g.name).join(', ')}</span>
            <span className={`badge ${selected.status === '0' ? 'badge-ok' : 'badge-info'}`}>{selected.status === '0' ? 'Ativo' : 'Desativado'}</span>
            {selected.parentTemplates?.length > 0 && (
              <span style={styles.tplStat}><span style={{ color: 'var(--gold)' }}>◫</span> {selected.parentTemplates.map(t => t.name).join(', ')}</span>
            )}
          </>}
          tabs={[['health','♥ Saúde'],['items','≡ Itens'],['triggers','◉ Triggers'],['alerts','◎ Alertas'],['timeline','◌ Timeline']]}
          activeTab={detailTab}
          onTabChange={tab => setDetailTab(tab)}
          onClose={() => setSelected(null)}
        >
          {renderTabContent()}
        </DetailModal>
      )}
    </div>
  );
}
export function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailTab, setDetailTab] = useState('items');
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState([]);

  useEffect(() => {
    api.get('/api/zabbix/templates').then(r => setTemplates(r.data)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (loading || !templates.length) return;
    const params = new URLSearchParams(window.location.search);
    const highlight = params.get('highlight');
    if (highlight) {
      const found = templates.find(t => t.templateid === highlight);
      if (found) openTemplate(found);
    }
  }, [loading, templates]);

  async function openTemplate(t) {
    setSelected(t);
    setDetailTab('items');
    setDetail(null);
    setDetailLoading(true);
    try {
      const [itemsRes, triggersRes] = await Promise.all([
        api.get(`/api/zabbix/template/${t.templateid}/items`),
        api.get(`/api/zabbix/template/${t.templateid}/triggers`),
      ]);
      setDetail({ items: itemsRes.data, triggers: triggersRes.data, hosts: Array.isArray(t.hosts) ? t.hosts : [] });
    } catch {
      setDetail({ items: [], triggers: [], hosts: [] });
    }
    setDetailLoading(false);
  }

  function toggleSelect(e, t) {
    e.stopPropagation();
    setSelectedTemplates(prev =>
      prev.find(x => x.templateid === t.templateid)
        ? prev.filter(x => x.templateid !== t.templateid)
        : [...prev, t]
    );
  }

  async function downloadTemplateExcel(tpl) {
    const token = localStorage.getItem('token');
    const res = await fetch(`/api/zabbix/template/${tpl.templateid}/excel`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${tpl.host}_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function downloadMultiTemplatesExcel() {
    if (!selectedTemplates.length) return;
    const token = localStorage.getItem('token');
    const res = await fetch('/api/zabbix/templates/excel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateIds: selectedTemplates.map(t => t.templateid) }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `templates_${new Date().toISOString().slice(0,10)}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  }

  function renderTabContent() {
    if (detailLoading) return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array(4).fill(0).map((_, i) => <div key={i} className="skeleton" style={{ height: '44px', borderRadius: 'var(--radius)' }} />)}
      </div>
    );
    if (!detail) return null;
    if (detailTab === 'items') return <ItemsTable items={detail.items} />;
    if (detailTab === 'triggers') return <TriggersTable triggers={detail.triggers} />;
    if (detailTab === 'hosts') return <HostsList hosts={detail.hosts} />;
    return null;
  }

  const filtered = templates.filter(t => !filter || t.name?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Templates</h1>
          <p style={styles.sub}>{templates.length} templates em uso</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectedTemplates.length > 0 && (
            <>
              <button onClick={downloadMultiTemplatesExcel}
                style={{ ...styles.exportBtn, background: 'var(--green-dim)', borderColor: 'rgba(46,204,143,0.3)', color: 'var(--green)' }}>
                ⤓ Excel ({selectedTemplates.length} templates)
              </button>
              <button onClick={() => setSelectedTemplates([])}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}>
                ✕ Limpar
              </button>
            </>
          )}
        </div>
      </div>
      <div style={styles.filters}>
        <input placeholder="Filtrar templates..." value={filter} onChange={e => setFilter(e.target.value)} style={styles.searchInput} />
        <button onClick={() => {
          if (filtered.every(t => selectedTemplates.find(x => x.templateid === t.templateid))) {
            setSelectedTemplates(prev => prev.filter(t => !filtered.find(x => x.templateid === t.templateid)));
          } else {
            setSelectedTemplates(prev => { const news = filtered.filter(t => !prev.find(x => x.templateid === t.templateid)); return [...prev, ...news]; });
          }
        }} style={{ ...styles.exportBtn, fontSize: '12px', whiteSpace: 'nowrap' }}>
          {filtered.every(t => selectedTemplates.find(x => x.templateid === t.templateid)) && filtered.length > 0 ? '✕ Desmarcar todos' : '☑ Selecionar todos'}
        </button>
        {selectedTemplates.length > 0 && (
          <span style={styles.count}>{selectedTemplates.length} selecionado{selectedTemplates.length > 1 ? 's' : ''}</span>
        )}
      </div>
      <div style={styles.templateGrid}>
        {loading ? Array(6).fill(0).map((_, i) =>
          <div key={i} className="skeleton" style={{ height: '110px', borderRadius: 'var(--radius-lg)' }} />
        ) : filtered.map(t => {
          const isSelected = selectedTemplates.find(x => x.templateid === t.templateid);
          return (
            <div key={t.templateid}
              style={{ ...styles.tplCard, ...(selected?.templateid === t.templateid ? styles.tplCardActive : {}), ...(isSelected ? { borderColor: 'var(--green)', background: 'var(--green-dim)' } : {}) }}
              onClick={() => openTemplate(t)} className="animate-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={styles.tplName}>{t.name}</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input type="checkbox" checked={!!isSelected} onChange={() => {}}
                    onClick={e => toggleSelect(e, t)}
                    style={{ cursor: 'pointer', width: '14px', height: '14px', accentColor: 'var(--green)', flexShrink: 0 }} />
                </div>
              </div>
              {t.description && <div style={styles.tplDesc}>{t.description.slice(0, 80)}{t.description.length > 80 ? '…' : ''}</div>}
              <div style={styles.tplMeta}>
                <span style={styles.tplStat}><span style={{ color: 'var(--blue)' }}>⬡</span> {Array.isArray(t.hosts) ? t.hosts.length : t.hosts} hosts</span>
                <span style={styles.tplStat}><span style={{ color: 'var(--purple)' }}>≡</span> {t.items} itens</span>
                <span style={styles.tplStat}><span style={{ color: 'var(--orange)' }}>◉</span> {t.triggers} triggers</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={styles.tplClickHint}>clique para detalhar →</div>
                <button onClick={e => { e.stopPropagation(); downloadTemplateExcel(t); }}
                  style={{ ...styles.exportBtn, fontSize: '10px', padding: '3px 8px', background: 'var(--green-dim)', borderColor: 'rgba(46,204,143,0.3)', color: 'var(--green)' }}>
                  ⤓ Excel
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && !loading && <div style={styles.empty}>Nenhum template encontrado</div>}
      </div>
      {selected && (
        <DetailModal
          title={selected.name}
          subtitle={selected.description}
          stats={<>
            <span style={styles.tplStat}><span style={{ color: 'var(--blue)' }}>⬡</span> {Array.isArray(selected.hosts) ? selected.hosts.length : selected.hosts} hosts</span>
            <span style={styles.tplStat}><span style={{ color: 'var(--purple)' }}>≡</span> {selected.items} itens</span>
            <span style={styles.tplStat}><span style={{ color: 'var(--orange)' }}>◉</span> {selected.triggers} triggers</span>
            <button onClick={() => downloadTemplateExcel(selected)}
              style={{ ...styles.exportBtn, fontSize: '11px', padding: '4px 10px', background: 'var(--green-dim)', borderColor: 'rgba(46,204,143,0.3)', color: 'var(--green)' }}>
              ⤓ Excel
            </button>
          </>}
          tabs={[['items','≡ Itens'],['triggers','◉ Triggers'],['hosts','⬡ Hosts']]}
          activeTab={detailTab}
          onTabChange={tab => setDetailTab(tab)}
          onClose={() => setSelected(null)}
        >
          {renderTabContent()}
        </DetailModal>
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
  filters: { display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' },
  searchInput: { flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' },
  select: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '8px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', cursor: 'pointer' },
  count: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' },
  table: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
  row: { display: 'grid', gridTemplateColumns: '2fr 130px 100px 130px 1fr', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--border)', alignItems: 'center', transition: 'background 0.15s' },
  headerRow: { background: 'var(--bg-card)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  hostName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' },
  mono: { fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' },
  empty: { padding: '40px', textAlign: 'center', color: 'var(--text-muted)' },
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' },
  tplCard: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', transition: 'border-color 0.18s, background 0.18s' },
  tplCardActive: { border: '1px solid var(--gold)', background: 'var(--gold-dim)' },
  tplName: { fontSize: '13px', fontWeight: 600, color: 'var(--text-accent)' },
  tplDesc: { fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 },
  tplMeta: { display: 'flex', gap: '14px', marginTop: 'auto', paddingTop: '8px', borderTop: '1px solid var(--border)' },
  tplStat: { fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '4px', alignItems: 'center' },
  tplClickHint: { fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'var(--font-mono)' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  modal: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '960px', height: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px', borderBottom: '1px solid var(--border)' },
  modalTitle: { fontSize: '18px', fontWeight: 600, color: 'var(--text-accent)', fontFamily: 'var(--font-display)' },
  modalDesc: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px', flexShrink: 0 },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', overflowX: 'auto' },
  tab: { background: 'none', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-sans)', padding: '10px 16px', transition: 'all 0.18s', whiteSpace: 'nowrap' },
  tabActive: { color: 'var(--gold)', borderBottomColor: 'var(--gold)' },
  modalBody: { overflowY: 'auto', padding: '16px 24px', flex: 1 },
  detailTableHeader: { display: 'grid', gridTemplateColumns: '2fr 120px 80px 130px 130px', gap: '12px', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' },
  detailTableHeader2: { display: 'grid', gridTemplateColumns: '1fr 110px 100px', gap: '12px', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius)', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' },
  detailRow: { display: 'grid', gridTemplateColumns: '2fr 120px 80px 130px 130px', gap: '12px', padding: '10px 12px', borderBottom: '1px solid var(--border)', alignItems: 'start' },
  detailRow2: { display: 'grid', gridTemplateColumns: '1fr 110px 100px', gap: '12px', padding: '10px 12px', borderBottom: '1px solid var(--border)', alignItems: 'center' },
  typeBadge: { background: 'var(--bg-hover)', color: 'var(--text-muted)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', alignSelf: 'start', marginTop: '2px' },
  queryPre: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--purple)', background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '6px 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0 },
};