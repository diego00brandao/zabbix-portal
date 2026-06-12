import React, { useEffect, useState } from 'react';
import api from '../services/api';

const TECH_MAP = [
  { key: 'mssql',   label: 'SQL Server',  icon: '🗄',  color: '#e74c3c', keywords: ['mssql','sqlserver','sql server'] },
  { key: 'oracle',  label: 'Oracle',      icon: '🔶',  color: '#f39c12', keywords: ['oracle'] },
  { key: 'mysql',   label: 'MySQL',       icon: '🐬',  color: '#3498db', keywords: ['mysql'] },
  { key: 'postgres',label: 'PostgreSQL',  icon: '🐘',  color: '#2980b9', keywords: ['postgres','postgresql'] },
  { key: 'linux',   label: 'Linux',       icon: '🐧',  color: '#27ae60', keywords: ['linux','ubuntu','debian','centos','rhel'] },
  { key: 'windows', label: 'Windows',     icon: '🪟',  color: '#2980b9', keywords: ['windows','win'] },
  { key: 'vmware',  label: 'VMware',      icon: '☁',  color: '#8e44ad', keywords: ['vmware','vsphere','esxi'] },
  { key: 'network', label: 'Rede',        icon: '🌐',  color: '#16a085', keywords: ['cisco','network','switch','router','firewall'] },
  { key: 'aws',     label: 'AWS/RDS',     icon: '☁',  color: '#f39c12', keywords: ['aws','rds','ec2','amazon'] },
  { key: 'other',   label: 'Outros',      icon: '◈',  color: '#7f8c8d', keywords: [] },
];

function detectTech(templateName) {
  const lower = (templateName || '').toLowerCase();
  for (const tech of TECH_MAP) {
    if (tech.key === 'other') continue;
    if (tech.keywords.some(k => lower.includes(k))) return tech;
  }
  return TECH_MAP.find(t => t.key === 'other');
}

function detectSubgroup(hostName, templateName) {
  const lower = (hostName + ' ' + templateName).toLowerCase();
  if (lower.includes('rds')) return 'RDS';
  if (lower.includes('cloud') || lower.includes('aws') || lower.includes('azure') || lower.includes('oci')) return 'Cloud';
  if (lower.includes('onprem') || lower.includes('on-prem') || lower.includes('onpremises')) return 'On-Premises';
  return 'On-Premises';
}

export default function Technologies() {
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [expandedSub, setExpandedSub] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/api/zabbix/hosts-full');
      setHosts(res.data || []);
    } catch {}
    setLoading(false);
  }

  // Group hosts by technology then subgroup
  const techGroups = React.useMemo(() => {
    const groups = {};
    for (const host of hosts) {
      const templates = host.parentTemplates || [];
      if (templates.length === 0) {
        const tech = TECH_MAP.find(t => t.key === 'other');
        if (!groups[tech.key]) groups[tech.key] = { tech, subgroups: {}, hosts: [] };
        const sub = detectSubgroup(host.name || host.host, '');
        if (!groups[tech.key].subgroups[sub]) groups[tech.key].subgroups[sub] = [];
        groups[tech.key].subgroups[sub].push(host);
        continue;
      }
      // Use primary template to detect tech
      const primaryTemplate = templates[0];
      const tech = detectTech(primaryTemplate.name);
      if (!groups[tech.key]) groups[tech.key] = { tech, subgroups: {}, totalHosts: 0 };
      const sub = detectSubgroup(host.name || host.host, primaryTemplate.name);
      if (!groups[tech.key].subgroups[sub]) groups[tech.key].subgroups[sub] = [];
      if (!groups[tech.key].subgroups[sub].find(h => h.hostid === host.hostid)) {
        groups[tech.key].subgroups[sub].push(host);
      }
    }
    // Sort and count
    return Object.values(groups).map(g => ({
      ...g,
      totalHosts: Object.values(g.subgroups).reduce((a, b) => a + b.length, 0),
    })).sort((a, b) => b.totalHosts - a.totalHosts);
  }, [hosts]);

  const filtered = React.useMemo(() => {
    if (!search) return techGroups;
    const s = search.toLowerCase();
    return techGroups.map(g => ({
      ...g,
      subgroups: Object.fromEntries(
        Object.entries(g.subgroups).map(([sub, hs]) => [
          sub, hs.filter(h => (h.name || h.host || '').toLowerCase().includes(s))
        ]).filter(([, hs]) => hs.length > 0)
      ),
    })).filter(g => Object.keys(g.subgroups).length > 0 || g.tech.label.toLowerCase().includes(s));
  }, [techGroups, search]);

  function toggleTech(key) { setExpanded(e => ({ ...e, [key]: !e[key] })); }
  function toggleSub(key) { setExpandedSub(e => ({ ...e, [key]: !e[key] })); }

  const totalHosts = hosts.length;
  const totalTechs = techGroups.length;

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Tecnologias Monitoradas</h1>
          <p style={S.sub}>Visão por tecnologia · {totalHosts} hosts · {totalTechs} tecnologias</p>
        </div>
        <button onClick={load} style={S.btn}>↺ Atualizar</button>
      </div>

      <input placeholder="Buscar host ou tecnologia..." value={search} onChange={e => setSearch(e.target.value)} style={S.search} />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {Array(5).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height: '72px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtered.map(({ tech, subgroups, totalHosts: total }) => {
            const isExp = expanded[tech.key];
            const subKeys = Object.keys(subgroups);
            return (
              <div key={tech.key} style={{ ...S.card, borderLeft: `3px solid ${tech.color}` }}>
                {/* Tech header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer' }} onClick={() => toggleTech(tech.key)}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${tech.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>{tech.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-accent)' }}>{tech.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {subKeys.map(s => `${s}: ${subgroups[s].length}`).join(' · ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: tech.color }}>{total}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>hosts</div>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{isExp ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Subgroups */}
                {isExp && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {subKeys.map(sub => {
                      const subHosts = subgroups[sub];
                      const subKey = `${tech.key}-${sub}`;
                      const isSubExp = expandedSub[subKey];
                      return (
                        <div key={sub} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', cursor: 'pointer' }} onClick={() => toggleSub(subKey)}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: tech.color, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                                {sub === 'RDS' ? '☁' : sub === 'Cloud' ? '☁' : '🖥'} {sub}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-hover)', borderRadius: '4px', padding: '1px 8px', fontFamily: 'var(--font-mono)' }}>{subHosts.length} hosts</span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{isSubExp ? '▲' : '▼'}</span>
                          </div>
                          {isSubExp && (
                            <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {subHosts.map(h => {
                                const hasAlert = parseInt(h.problems_count || 0) > 0;
                                return (
                                  <div key={h.hostid} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', border: `1px solid ${hasAlert ? 'rgba(255,87,87,0.3)' : 'var(--border)'}`, borderRadius: '6px', padding: '4px 10px' }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: h.available === '1' ? 'var(--green)' : h.available === '2' ? 'var(--red)' : 'var(--text-muted)', flexShrink: 0, display: 'inline-block' }} />
                                    <span style={{ fontSize: '12px', color: hasAlert ? 'var(--red)' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{h.name || h.host}</span>
                                    {hasAlert && <span style={{ fontSize: '10px', color: 'var(--red)', fontWeight: 700 }}>⚠{h.problems_count}</span>}
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
          })}
        </div>
      )}
    </div>
  );
}

const S = {
  root: { padding: '28px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  btn: { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '7px 16px', fontSize: '13px', cursor: 'pointer' },
  search: { width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '9px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 20px' },
};
