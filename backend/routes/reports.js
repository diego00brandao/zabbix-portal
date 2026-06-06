const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db/database');
const zabbix = require('../services/zabbix');

const router = express.Router();

function getGroupIds(req) {
  if (req.user.role === 'admin') return null;
  const area = db.prepare('SELECT zabbix_hostgroup_ids FROM areas WHERE id = ?').get(req.user.area_id);
  if (!area) return [];
  return JSON.parse(area.zabbix_hostgroup_ids || '[]');
}

function toCSV(data, columns) {
  const header = columns.map(c => c.label).join(';');
  const rows = data.map(row =>
    columns.map(c => {
      const val = c.fn ? c.fn(row) : (row[c.key] ?? '');
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(';')
  );
  return '\uFEFF' + [header, ...rows].join('\n'); // BOM para Excel
}

// GET /api/reports/hosts?format=csv|json
router.get('/hosts', authMiddleware, async (req, res) => {
  const groupIds = getGroupIds(req);
  const hosts = await zabbix.getHostsByGroups(groupIds);
  const format = req.query.format || 'json';

  const data = hosts.map(h => ({
    hostid: h.hostid,
    name: h.name,
    host: h.host,
    status: h.status === '0' ? 'Ativo' : 'Desativado',
    available: h.available === '1' ? 'Disponível' : h.available === '2' ? 'Indisponível' : 'Desconhecido',
    ip: h.interfaces?.[0]?.ip || '',
    groups: h.groups?.map(g => g.name).join(', ') || '',
    os: h.inventory?.os || '',
  }));

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hosts.csv"');
    return res.send(toCSV(data, [
      { key: 'name', label: 'Nome' },
      { key: 'host', label: 'Hostname' },
      { key: 'status', label: 'Status' },
      { key: 'available', label: 'Disponibilidade' },
      { key: 'ip', label: 'IP' },
      { key: 'groups', label: 'Grupos' },
      { key: 'os', label: 'Sistema Operacional' },
    ]));
  }
  res.json(data);
});

// GET /api/reports/triggers?format=csv|json
router.get('/triggers', authMiddleware, async (req, res) => {
  const groupIds = getGroupIds(req);
  const triggers = await zabbix.getTriggersActive(groupIds);
  const format = req.query.format || 'json';

  const severityMap = { '0': 'Não classificado', '1': 'Info', '2': 'Aviso', '3': 'Médio', '4': 'Alto', '5': 'Desastre' };

  const data = triggers.map(t => ({
    description: t.description,
    severity: severityMap[t.priority] || t.priority,
    hosts: t.hosts?.map(h => h.name).join(', ') || '',
    lastChange: t.lastchange ? new Date(parseInt(t.lastchange) * 1000).toLocaleString('pt-BR') : '',
    comments: t.comments || '',
  }));

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="alertas_ativos.csv"');
    return res.send(toCSV(data, [
      { key: 'description', label: 'Problema' },
      { key: 'severity', label: 'Severidade' },
      { key: 'hosts', label: 'Hosts afetados' },
      { key: 'lastChange', label: 'Desde' },
      { key: 'comments', label: 'Comentários' },
    ]));
  }
  res.json(data);
});

// GET /api/reports/items?format=csv|json
router.get('/items', authMiddleware, async (req, res) => {
  const groupIds = getGroupIds(req);
  const format = req.query.format || 'json';

  const tplIds = req.user.role === 'admin' ? null : (() => {
    const area = db.prepare('SELECT zabbix_template_ids FROM areas WHERE id = ?').get(req.user.area_id);
    return area ? JSON.parse(area.zabbix_template_ids || '[]') : [];
  })();

  const hostItems = await zabbix.getItems(groupIds);
  let items = hostItems;

  if (tplIds && tplIds.length > 0) {
    const allTemplates = await zabbix.getTemplates();
    const tplResults = await Promise.all(tplIds.map(id => zabbix.getTemplateItems(id).catch(() => [])));
    const tplItems = tplResults.flat().map(item => ({
      ...item,
      hosts: [{ name: allTemplates.find(t => t.templateid === item.templateid)?.name || 'Template', host: 'template' }],
    }));
    const seen = new Set(hostItems.map(i => i.itemid));
    items = [...hostItems, ...tplItems.filter(i => !seen.has(i.itemid))];
  }
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="itens.csv"');

    return res.send(toCSV(items, [
      { key: 'name', label: 'Nome' },
      { fn: row => row.hosts?.[0]?.name || '', label: 'Host/Template' },
      { key: 'delayFormatted', label: 'Intervalo' },
    ]));

  }
  res.json(items);
});

// GET /api/reports/summary - relatório executivo resumido
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const groupIds = getGroupIds(req);
    const templateIds = req.user.role === 'admin' ? null : (() => {
      const area = db.prepare('SELECT zabbix_template_ids FROM areas WHERE id = ?').get(req.user.area_id);
      return area ? JSON.parse(area.zabbix_template_ids || '[]') : [];
    })();

    const stats = await zabbix.getDashboardStats(groupIds, templateIds);

    const areaInfo = req.user.area_id
      ? db.prepare('SELECT name FROM areas WHERE id = ?').get(req.user.area_id)
      : { name: 'Todas as Áreas' };

    res.json({
      area: areaInfo?.name,
      generatedAt: new Date().toLocaleString('pt-BR'),
      generatedBy: req.user.username,
      ...stats,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/consolidated', authMiddleware, async (req, res) => {
  try {
    const groupIds = getGroupIds(req);
    const tplIds = req.user.role === 'admin' ? null : (() => {
      const area = db.prepare('SELECT zabbix_template_ids FROM areas WHERE id = ?').get(req.user.area_id);
      return area ? JSON.parse(area.zabbix_template_ids || '[]') : [];
    })();

    const [hosts, triggers, allTemplates] = await Promise.all([
      zabbix.getHostsByGroups(groupIds),
      zabbix.getTriggersActive(groupIds),
      zabbix.getTemplates(),
    ]);

    const hostItems = await zabbix.getItems(groupIds);
    let items = hostItems;
    if (tplIds && tplIds.length > 0) {
      const tplResults = await Promise.all(tplIds.map(id => zabbix.getTemplateItems(id).catch(() => [])));
      const tplItems = tplResults.flat().map(item => ({
        ...item,
        hosts: [{ name: allTemplates.find(t => t.templateid === item.templateid)?.name || 'Template' }],
      }));
      const seen = new Set(hostItems.map(i => i.itemid));
      items = [...hostItems, ...tplItems.filter(i => !seen.has(i.itemid))];
    }

    const hostTriggers = await zabbix.getAllTriggers(groupIds);
    const idsToFetch = tplIds === null ? allTemplates.map(t => t.templateid) : (tplIds || []);
    let allTriggers = hostTriggers;
    if (idsToFetch.length > 0) {
      const tplResults = await Promise.all(idsToFetch.map(id => zabbix.getTemplateTriggers(id).catch(() => [])));
      const tplTriggers = tplResults.flat().map(t => ({
        ...t,
        hosts: [{ name: allTemplates.find(tpl => tpl.templateid === t.templateid)?.name || 'Template' }],
      }));
      const seen = new Set(hostTriggers.map(t => t.triggerid));
      allTriggers = [...hostTriggers, ...tplTriggers.filter(t => !seen.has(t.triggerid))];
    }

    const SEV = {'5':'DISASTER','4':'HIGH','3':'AVERAGE','2':'WARNING','1':'INFORMATION','0':'N/C'};
    const date = new Date().toISOString().slice(0,10);

    if (req.query.format === 'csv') {
      let csv = '\uFEFF';
      csv += 'INVENTÁRIO DE SERVIDORES\n';
      csv += '"Nome";"Hostname";"Status";"IP";"Grupos"\n';
      hosts.forEach(h => {
        csv += [h.name, h.host, h.status==='0'?'Ativo':'Desativado', h.interfaces?.[0]?.ip||'', h.groups?.map(g=>g.name).join(', ')||'']
          .map(v => `"${String(v).replace(/"/g,'""')}"`).join(';') + '\n';
      });
      csv += '\nALERTAS ATIVOS\n';
      csv += '"Trigger";"Severidade";"Host";"Desde"\n';
      triggers.forEach(t => {
        csv += [t.description, SEV[t.priority]||t.priority, t.hosts?.map(h=>h.name).join(', ')||'', t.lastchange&&parseInt(t.lastchange)>0?new Date(parseInt(t.lastchange)*1000).toLocaleString('pt-BR'):'—']
          .map(v => `"${String(v).replace(/"/g,'""')}"`).join(';') + '\n';
      });
      csv += '\nITENS E QUERIES\n';
      csv += '"Nome";"Host/Template";"Intervalo"\n';
      items.forEach(i => {
        csv += [i.name, i.hosts?.[0]?.name||'', i.delayFormatted||'']
          .map(v => `"${String(v).replace(/"/g,'""')}"`).join(';') + '\n';
      });
      csv += '\nTODAS AS TRIGGERS\n';
      csv += '"Trigger";"Host";"Severidade";"Status"\n';
      allTriggers.forEach(t => {
        csv += [t.description, t.hosts?.map(h=>h.name).join(', ')||'', SEV[t.priority]||t.priority, t.status==='0'?'Ativa':'Desabilitada']
          .map(v => `"${String(v).replace(/"/g,'""')}"`).join(';') + '\n';
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="relatorio_consolidado_${date}.csv"`);
      return res.send(csv);
    }

    res.json({ hosts, triggers, items, allTriggers });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
