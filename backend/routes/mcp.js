const express = require('express');
const zabbix = require('../services/zabbix');
const router = express.Router();

// MCP Server - Anthropic Model Context Protocol
// Tools exposed to Alfred/Claude

const MCP_TOOLS = [
  {
    name: 'get_dashboard_stats',
    description: 'Retorna estatísticas gerais do ambiente Zabbix: total de hosts, templates, itens, triggers e alertas ativos',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_active_alerts',
    description: 'Retorna todos os alertas/triggers ativos no momento, com severidade e host',
    input_schema: { type: 'object', properties: { severity: { type: 'number', description: 'Filtrar por severidade mínima (1-5)' } }, required: [] }
  },
  {
    name: 'get_hosts',
    description: 'Lista todos os hosts monitorados com status e disponibilidade',
    input_schema: { type: 'object', properties: { group: { type: 'string', description: 'Filtrar por grupo' } }, required: [] }
  },
  {
    name: 'get_host_health',
    description: 'Retorna saúde completa de um host específico: itens, triggers, alertas',
    input_schema: { type: 'object', properties: { hostid: { type: 'string', description: 'ID do host' } }, required: ['hostid'] }
  },
  {
    name: 'get_maintenances',
    description: 'Lista manutenções cadastradas no Zabbix',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_groups',
    description: 'Lista grupos de hosts',
    input_schema: { type: 'object', properties: {}, required: [] }
  },
];

// MCP Discovery endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Zabbix Portal MCP',
    version: '1.0.0',
    description: 'MCP Server para integração com Zabbix via Portal de Monitoração',
    tools: MCP_TOOLS,
  });
});

// MCP Tool execution
router.post('/tools/:tool', async (req, res) => {
  const { tool } = req.params;
  const params = req.body || {};

  // Auth via Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token required' });

  try {
    let result;
    switch (tool) {
      case 'get_dashboard_stats':
        result = await zabbix.getDashboardStats(null, null);
        break;
      case 'get_active_alerts':
        const alerts = await zabbix.getTriggersActive(null, params.severity || null);
        result = alerts.map(a => ({
          id: a.triggerid,
          description: a.description,
          severity: a.priority,
          severityLabel: ['N/C','INFO','WARNING','AVERAGE','HIGH','DISASTER'][parseInt(a.priority)] || a.priority,
          hosts: a.hosts?.map(h => h.name),
          since: a.lastchange ? new Date(parseInt(a.lastchange)*1000).toLocaleString('pt-BR') : null,
        }));
        break;
      case 'get_hosts':
        result = await zabbix.getAllHosts(null);
        break;
      case 'get_host_health':
        result = await zabbix.getHostHealth(params.hostid);
        break;
      case 'get_maintenances':
        result = await zabbix.call('maintenance.get', { output: ['maintenanceid','name','active_since','active_till'], selectHosts: ['name'], sortfield: 'name' }, false);
        break;
      case 'get_groups':
        result = await zabbix.getHostGroups();
        break;
      default:
        return res.status(404).json({ error: `Tool '${tool}' not found` });
    }
    res.json({ tool, result });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
