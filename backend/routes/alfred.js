const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const zabbix = require('../services/zabbix');
const router = express.Router();

router.post('/chat', authMiddleware, async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: 'Messages required' });

  try {
    // Get current Zabbix context
    let context = '';
    try {
      const [stats, alerts] = await Promise.all([
        zabbix.getDashboardStats(null, null),
        zabbix.getTriggersActive(null),
      ]);
      context = `
CONTEXTO ATUAL DO AMBIENTE ZABBIX:
- Servidores ativos: ${stats.enabledHosts}
- Servidores desativados: ${stats.disabledHosts}
- Templates: ${stats.templates}
- Itens ativos: ${stats.totalItems}
- Triggers ativas: ${stats.activeTriggerCount}
- Alertas ativos agora: ${stats.activeTriggers}
- DISASTER: ${stats.triggersBySeverity?.disaster || 0}
- HIGH: ${stats.triggersBySeverity?.high || 0}
- AVERAGE: ${stats.triggersBySeverity?.average || 0}
- WARNING: ${stats.triggersBySeverity?.warning || 0}
- Versão Zabbix: ${stats.zabbixVersion}
- Última atualização: ${new Date().toLocaleString('pt-BR')}

TOP ALERTAS ATIVOS:
${alerts.slice(0,10).map(a => `- [${['','INFO','WARN','AVG','HIGH','DIS'][parseInt(a.priority)]||a.priority}] ${a.description} (${a.hosts?.map(h=>h.name).join(', ')||'—'})`).join('\n')}
`;
    } catch {}

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: `Você é Alfred, um assistente especializado em monitoração de infraestrutura para um banco. Você tem acesso aos dados do Zabbix em tempo real e ajuda o time de Observability a entender o ambiente, diagnosticar problemas e tomar decisões.

Seja direto, técnico e objetivo. Use emojis com moderação. Formate sua resposta de forma clara.

${context}`,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await response.json();
    const text = data.content?.map(c => c.text || '').join('') || 'Sem resposta';
    res.json({ response: text });
  } catch(e) {
    console.error('Alfred error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
