import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const REPORTS = [
  {
    id: 'hosts',
    icon: '⬡',
    title: 'Inventário de Servidores',
    desc: 'Lista completa de todos os hosts monitorados, com status, IP, grupos e OS.',
    color: 'var(--green)',
    bg: 'var(--green-dim)',
    endpoint: '/api/reports/hosts',
  },
  {
    id: 'triggers',
    icon: '◉',
    title: 'Alertas Ativos',
    desc: 'Todos os triggers disparados no momento, ordenados por severidade.',
    color: 'var(--red)',
    bg: 'var(--red-dim)',
    endpoint: '/api/reports/triggers',
  },
  {
    id: 'items',
    icon: '≡',
    title: 'Itens e Queries',
    desc: 'Itens monitorados, incluindo queries SQL com detalhes de coleta.',
    color: 'var(--purple)',
    bg: 'var(--purple-dim)',
    endpoint: '/api/reports/items',
  },
  {
    id: 'alltriggers',
    icon: '⊡',
    title: 'Todas as Triggers',
    desc: 'Lista completa de triggers cadastradas no ambiente, com severidade e status.',
    color: 'var(--orange)',
    bg: 'var(--orange-dim)',
    endpoint: '/api/zabbix/triggers',
  },
];

async function downloadFile(endpoint, format, filename) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${endpoint}?format=${format}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadConsolidatedCSV() {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/reports/consolidated?format=csv', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio_consolidado_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadConsolidatedPDF() {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/reports/consolidated', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  const SEV = {'5':'DISASTER','4':'HIGH','3':'AVERAGE','2':'WARNING','1':'INFORMATION','0':'N/C'};
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório Consolidado</title>
<style>
  body { font-family: Arial, sans-serif; color: #222; padding: 32px; font-size: 12px; }
  h1 { color: #c9a84c; border-bottom: 2px solid #c9a84c; padding-bottom: 8px; font-size: 20px; }
  h2 { color: #1F4E79; margin-top: 28px; font-size: 14px; border-left: 4px solid #c9a84c; padding-left: 10px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
  th { background: #1F4E79; color: #fff; padding: 7px 10px; text-align: left; font-size: 11px; text-transform: uppercase; }
  td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
  tr:nth-child(even) td { background: #f5f5f5; }
  .footer { margin-top: 32px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
  .badge { padding: 2px 7px; border-radius: 3px; font-size: 10px; font-weight: bold; }
  .d{background:#ffc7ce;color:#9C0006;} .h{background:#ffe0b2;color:#833C00;}
  .a{background:#fff2cc;color:#7F6000;} .w{background:#d6e4f0;color:#1F4E79;} .i{background:#f2f2f2;color:#444;}
</style></head>
<body>
<h1>◈ Relatório Consolidado — Portal de Monitoração</h1>
<p style="color:#666;font-size:11px">Gerado em ${new Date().toLocaleString('pt-BR')}</p>

<h2>⬡ Inventário de Servidores (${data.hosts?.length||0})</h2>
<table><thead><tr><th>Nome</th><th>Hostname</th><th>Status</th><th>IP</th><th>Grupos</th></tr></thead><tbody>
${(data.hosts||[]).map(h=>`<tr><td>${h.name}</td><td>${h.host}</td><td>${h.status==='0'?'Ativo':'Desativado'}</td><td>${h.interfaces?.[0]?.ip||'—'}</td><td>${h.groups?.map(g=>g.name).join(', ')||'—'}</td></tr>`).join('')}
</tbody></table>

<h2>◉ Alertas Ativos (${data.triggers?.length||0})</h2>
<table><thead><tr><th>Trigger</th><th>Severidade</th><th>Host</th><th>Desde</th></tr></thead><tbody>
${(data.triggers||[]).map(t=>`<tr><td>${t.description}</td><td><span class="badge ${t.priority==='5'?'d':t.priority==='4'?'h':t.priority==='3'?'a':t.priority==='2'?'w':'i'}">${SEV[t.priority]||t.priority}</span></td><td>${t.hosts?.map(h=>h.name).join(', ')||'—'}</td><td>${t.lastchange&&parseInt(t.lastchange)>0?new Date(parseInt(t.lastchange)*1000).toLocaleString('pt-BR'):'—'}</td></tr>`).join('')}
${!data.triggers?.length?'<tr><td colspan="4" style="text-align:center;color:#999">Nenhum alerta ativo</td></tr>':''}
</tbody></table>

<h2>≡ Itens e Queries (${data.items?.length||0})</h2>
<table><thead><tr><th>Nome</th><th>Host/Template</th><th>Intervalo</th></tr></thead><tbody>
${(data.items||[]).slice(0,100).map(i=>`<tr><td>${i.name}</td><td>${i.hosts?.[0]?.name||'—'}</td><td>${i.delayFormatted||'—'}</td></tr>`).join('')}
${(data.items?.length||0)>100?`<tr><td colspan="3" style="text-align:center;color:#999">... e mais ${data.items.length-100} itens</td></tr>`:''}
</tbody></table>

<h2>⊡ Todas as Triggers (${data.allTriggers?.length||0})</h2>
<table><thead><tr><th>Trigger</th><th>Host</th><th>Severidade</th><th>Status</th></tr></thead><tbody>
${(data.allTriggers||[]).slice(0,100).map(t=>`<tr><td>${t.description}</td><td>${t.hosts?.map(h=>h.name).join(', ')||'—'}</td><td><span class="badge ${t.priority==='5'?'d':t.priority==='4'?'h':t.priority==='3'?'a':t.priority==='2'?'w':'i'}">${SEV[t.priority]||t.priority}</span></td><td>${t.status==='0'?'Ativa':'Desabilitada'}</td></tr>`).join('')}
${(data.allTriggers?.length||0)>100?`<tr><td colspan="4" style="text-align:center;color:#999">... e mais ${data.allTriggers.length-100} triggers</td></tr>`:''}
</tbody></table>

<div class="footer">Portal de Monitoração · ${new Date().toLocaleString('pt-BR')}</div>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  setTimeout(() => { win?.print(); URL.revokeObjectURL(url); }, 800);
}

export default function Reports() {
  const { user } = useAuth();
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [previews, setPreviews] = useState({});

  useEffect(() => {
    api.get('/api/reports/summary').then(r => setSummary(r.data)).catch(() => {});
  }, []);

  async function loadPreview(report) {
    if (previews[report.id]) return;
    setLoading(report.id);
    try {
      const res = await api.get(`${report.endpoint}?format=json`);
      setPreviews(p => ({ ...p, [report.id]: res.data }));
    } catch {}
    setLoading(false);
  }

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Relatórios</h1>
          <p style={styles.sub}>Extração de dados e diagnóstico do ambiente</p>
        </div>
        {user?.areaName && (
          <div style={styles.areaTag}>
            <span>Área:</span> <strong>{user.areaName}</strong>
          </div>
        )}
      </div>

      {summary && (
        <div style={styles.summaryCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={styles.summaryTitle}>◈ Resumo do Ambiente</div>
            <div style={{ display: 'flex', gap: '8px' }}>
           	    <button onClick={downloadConsolidatedPDF} style={styles.pdfBtn}>⎙ PDF</button>
            </div>
          </div>
          <div style={styles.summaryGrid}>
            <SummaryMetric label="Servidores ativos"  value={summary.enabledHosts}   color="var(--green)" />
            <SummaryMetric label="Desativados"         value={summary.disabledHosts}  color="var(--text-muted)" />
            <SummaryMetric label="Templates"           value={summary.templates}      color="var(--blue)" />
            <SummaryMetric label="Alertas ativos"      value={summary.activeTriggers} color={summary.activeTriggers > 0 ? 'var(--red)' : 'var(--green)'} />
            <SummaryMetric label="Itens totais"        value={summary.totalItems}     color="var(--purple)" />
            <SummaryMetric label="Queries SQL"         value={summary.queryItems}     color="var(--purple)" />
          </div>
          <div style={styles.summaryFooter}>
            Gerado em {summary.generatedAt} · por {summary.generatedBy}
          </div>
        </div>
      )}

      <div style={styles.grid}>
        {REPORTS.map(report => (
          <div key={report.id} style={styles.card}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ ...styles.icon, color: report.color, background: report.bg }}>
                {report.icon}
              </div>
              <div>
                <div style={styles.cardTitle}>{report.title}</div>
                <div style={styles.cardDesc}>{report.desc}</div>
              </div>
            </div>

            {previews[report.id] && (
              <div style={styles.preview}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {Array.isArray(previews[report.id]) ? `${previews[report.id].length} registros carregados` : 'Dados carregados'}
                </span>
              </div>
            )}

            <div style={styles.actions}>
              <button
                onClick={() => loadPreview(report)}
                disabled={loading === report.id || !!previews[report.id]}
                style={styles.previewBtn}>
                {loading === report.id ? '⟳ Carregando...' : previews[report.id] ? '✓ Pré-visualizado' : '◎ Pré-visualizar'}
              </button>
              <button onClick={() => downloadFile(report.endpoint, 'csv', `${report.id}.csv`)} style={styles.csvBtn}>⤓ CSV</button>
              <button onClick={() => downloadFile(report.endpoint, 'json', `${report.id}.json`)} style={styles.jsonBtn}>⤓ JSON</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px' }}>
      <div style={{ fontSize: '24px', fontWeight: 600, fontFamily: 'var(--font-mono)', color }}>{value ?? '—'}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{label}</div>
    </div>
  );
}

const styles = {
  root: { padding: '28px', maxWidth: '1200px', margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' },
  title: { fontFamily: 'var(--font-display)', fontSize: '26px', fontWeight: 300, color: 'var(--text-accent)' },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  areaTag: { fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '6px 14px' },
  summaryCard: { background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' },
  summaryTitle: { fontSize: '12px', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.08em', textTransform: 'uppercase' },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '10px' },
  summaryFooter: { fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  excelBtn: { background: 'var(--green-dim)', border: '1px solid rgba(46,204,143,0.3)', color: 'var(--green)', borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  pdfBtn: { background: 'var(--red-dim)', border: '1px solid rgba(255,87,87,0.3)', color: 'var(--red)', borderRadius: 'var(--radius)', padding: '5px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' },
  icon: { width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 },
  cardTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-accent)', marginBottom: '4px' },
  cardDesc: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 },
  preview: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px', marginBottom: '12px' },
  actions: { display: 'flex', gap: '8px' },
  previewBtn: { background: 'var(--bg-hover)', border: '1px solid var(--border-light)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)', flex: 1 },
  csvBtn: { background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
  jsonBtn: { background: 'var(--blue-dim)', border: '1px solid rgba(74,158,255,0.3)', color: 'var(--blue)', borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)' },
};