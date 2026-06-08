import React, { useState, useRef, useEffect } from 'react';
import api from '../services/api';

export default function Alfred() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o Alfred, seu assistente de monitoração. Posso consultar hosts, alertas, triggers, itens e muito mais do seu ambiente Zabbix. Como posso ajudar?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/api/alfred/chat', { messages: [...messages, userMsg] });
      setMessages(m => [...m, { role: 'assistant', content: res.data.response }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', content: '⚠ Erro ao processar sua pergunta. Tente novamente.' }]);
    }
    setLoading(false);
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div style={S.headerLeft}>
          <div style={S.avatar}>A</div>
          <div>
            <h1 style={S.title}>Alfred</h1>
            <p style={S.sub}>Assistente de Monitoração · Powered by Claude</p>
          </div>
        </div>
        <button onClick={() => setMessages([{ role: 'assistant', content: 'Conversa reiniciada. Como posso ajudar?' }])} style={S.clearBtn}>↺ Nova conversa</button>
      </div>

      <div style={S.chatArea}>
        {messages.map((m, i) => (
          <div key={i} style={{ ...S.msgRow, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {m.role === 'assistant' && <div style={S.botAvatar}>A</div>}
            <div style={{ ...S.bubble, ...(m.role === 'user' ? S.userBubble : S.botBubble) }}>
              <pre style={S.msgText}>{m.content}</pre>
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ ...S.msgRow, justifyContent: 'flex-start' }}>
            <div style={S.botAvatar}>A</div>
            <div style={{ ...S.bubble, ...S.botBubble }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>◈ Consultando o ambiente...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={S.inputArea}>
        <div style={S.suggestions}>
          {['Quantos hosts estão offline?', 'Quais alertas DISASTER estão ativos?', 'Mostre os top 5 hosts com mais problemas', 'Há manutenções ativas agora?'].map(s => (
            <button key={s} onClick={() => { setInput(s); }} style={S.suggestion}>{s}</button>
          ))}
        </div>
        <div style={S.inputRow}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Pergunte sobre seu ambiente... (Enter para enviar)"
            style={S.input}
            rows={2}
          />
          <button onClick={send} disabled={!input.trim() || loading} style={S.sendBtn}>→</button>
        </div>
      </div>
    </div>
  );
}

const S = {
  root: { height: '100%', display: 'flex', flexDirection: 'column', padding: '28px', maxWidth: '900px', margin: '0 auto', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  avatar: { width: '44px', height: '44px', borderRadius: '12px', background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-display)' },
  title: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 300, color: 'var(--text-accent)', margin: 0 },
  sub: { fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' },
  clearBtn: { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius)', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' },
  chatArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: '16px', minHeight: '300px' },
  msgRow: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  botAvatar: { width: '28px', height: '28px', borderRadius: '8px', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--gold)', flexShrink: 0 },
  bubble: { maxWidth: '75%', borderRadius: '12px', padding: '10px 14px' },
  botBubble: { background: 'var(--bg-card)', border: '1px solid var(--border)' },
  userBubble: { background: 'var(--gold-dim)', border: '1px solid rgba(201,168,76,0.3)' },
  msgText: { margin: 0, fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', whiteSpace: 'pre-wrap', lineHeight: 1.6 },
  inputArea: { flexShrink: 0 },
  suggestions: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' },
  suggestion: { background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '20px', padding: '5px 12px', fontSize: '11px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s' },
  inputRow: { display: 'flex', gap: '10px', alignItems: 'flex-end' },
  input: { flex: 1, background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius)', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', fontFamily: 'var(--font-sans)', lineHeight: 1.5 },
  sendBtn: { background: 'var(--gold)', color: '#0a0c10', border: 'none', borderRadius: 'var(--radius)', padding: '10px 20px', fontSize: '16px', cursor: 'pointer', fontWeight: 700 },
};
