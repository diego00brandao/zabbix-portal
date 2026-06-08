import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function ConnectionSelector() {
  const { selectConnection, user } = useAuth();
  const navigate = useNavigate();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState(null);

  useEffect(() => {
    api.get('/api/connections').then(r => {
      setConnections(r.data);
    }).finally(() => setLoading(false));
  }, []);

  async function handleSelect(conn) {
    setSelecting(conn.id);
    selectConnection(conn);
    navigate('/');
  }

  return (
    <div style={styles.root}>
      <div style={styles.grid} />
      <div style={styles.card} className="animate-in">
        <div style={styles.header}>
          <div style={styles.logoMark}><span style={styles.logoIcon}>◈</span></div>
          <h1 style={styles.title}>Selecionar Ambiente</h1>
          <p style={styles.subtitle}>Olá, {user?.fullName || user?.username}. Escolha o Zabbix que deseja monitorar.</p>
        </div>
        <div style={styles.list}>
          {loading ? (
            Array(3).fill(0).map((_,i) => <div key={i} className="skeleton" style={{ height:'72px', borderRadius:'var(--radius)' }} />)
          ) : connections.map(conn => (
            <button key={conn.id} onClick={() => handleSelect(conn)} disabled={!!selecting}
              style={{ ...styles.connBtn, ...(selecting===conn.id ? styles.connBtnActive : {}) }}>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <div style={styles.connIcon}>⇌</div>
                <div style={{ textAlign:'left' }}>
                  <div style={{ fontSize:'14px', fontWeight:600, color:'var(--text-accent)' }}>{conn.name}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'var(--font-mono)' }}>{conn.url}</div>
                </div>
              </div>
              <span style={{ fontSize:'12px', color:'var(--green)', fontFamily:'var(--font-mono)' }}>
                {selecting===conn.id ? '⟳' : '→'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg-base)', position:'relative', overflow:'hidden' },
  grid: { position:'absolute', inset:0, backgroundImage:'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)', backgroundSize:'48px 48px', opacity:0.4, maskImage:'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)' },
  card: { position:'relative', zIndex:1, width:'100%', maxWidth:'460px', background:'var(--bg-surface)', border:'1px solid var(--border-light)', borderRadius:'var(--radius-lg)', padding:'40px 36px', boxShadow:'0 0 0 1px rgba(201,168,76,0.05), var(--shadow)' },
  header: { textAlign:'center', marginBottom:'28px' },
  logoMark: { display:'inline-flex', alignItems:'center', justifyContent:'center', width:'48px', height:'48px', background:'var(--gold-dim)', border:'1px solid rgba(201,168,76,0.3)', borderRadius:'12px', marginBottom:'16px' },
  logoIcon: { fontSize:'22px', color:'var(--gold)', fontFamily:'var(--font-display)' },
  title: { fontFamily:'var(--font-display)', fontSize:'22px', fontWeight:300, color:'var(--text-accent)', letterSpacing:'0.02em', marginBottom:'8px' },
  subtitle: { fontSize:'13px', color:'var(--text-muted)' },
  list: { display:'flex', flexDirection:'column', gap:'10px' },
  connBtn: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', background:'var(--bg-card)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', cursor:'pointer', transition:'all 0.15s', width:'100%' },
  connBtnActive: { background:'var(--gold-dim)', borderColor:'rgba(201,168,76,0.4)' },
  connIcon: { width:'36px', height:'36px', borderRadius:'8px', background:'var(--bg-hover)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', color:'var(--blue)', flexShrink:0 },
};
