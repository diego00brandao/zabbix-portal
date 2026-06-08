const axios = require('axios');
const { getCached, setCache } = require('../db/database');

let zabbixToken = null;
let tokenExpires = 0;

const zabbixAPI = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const { db } = require('../db/database');

let currentConnectionId = null;

function setCurrentConnection(id) {
  currentConnectionId = id ? String(id) : null;
}

function getActiveConnection() {
  try {
    if (currentConnectionId) {
      const conn = db.prepare('SELECT * FROM zabbix_connections WHERE id=?').get(currentConnectionId);
      if (conn) return conn;
    }
    const conn = db.prepare('SELECT * FROM zabbix_connections WHERE active=1').get();
    if (conn) return conn;
  } catch {}
  return null;
}
function getStaticToken() {
  const conn = getActiveConnection();
  if (conn && conn.auth_type === 'token') return conn.token;
  return process.env.ZABBIX_TOKEN || null;
}

function getZabbixURL() {
  const conn = getActiveConnection();
  if (conn) return conn.url;
  return process.env.ZABBIX_URL;
}

async function call(method, params = {}, useCache = false, cacheTTL = 60) {
  const cacheKey = useCache ? `zbx:${method}:${JSON.stringify(params)}` : null;
  if (cacheKey) {
    const cached = getCached(cacheKey);
    if (cached) return cached;
  }
  if (getStaticToken()) {
    zabbixToken = getStaticToken();
    tokenExpires = Infinity;
  } else if (!zabbixToken || Date.now() > tokenExpires) {
    await authenticate();
  }
  const payload = { jsonrpc: '2.0', method, params, auth: zabbixToken, id: 1 };
  try {
    const res = await zabbixAPI.post(getZabbixURL(), payload);
    if (res.data.error) {
      if (res.data.error.code === -32602 && !getStaticToken()) {
        zabbixToken = null;
        await authenticate();
        return call(method, params, useCache, cacheTTL);
      }
      throw new Error(`Zabbix API error: ${res.data.error.message}`);
    }
    const result = res.data.result;
    if (cacheKey) setCache(cacheKey, result, cacheTTL);
    return result;
  } catch (err) {
    if (err.code === 'ECONNREFUSED') throw new Error('Não foi possível conectar ao Zabbix.');
    throw err;
  }
}

async function authenticate() {
  if (getStaticToken()) {
    zabbixToken = getStaticToken();
    tokenExpires = Infinity;
    console.log('✅ Usando token API do Zabbix');
    return;
  }
  const res = await zabbixAPI.post(process.env.ZABBIX_URL, {
    jsonrpc: '2.0', method: 'user.login',
     params: { user: getActiveConnection()?.username || process.env.ZABBIX_USER, password: getActiveConnection()?.password || process.env.ZABBIX_PASSWORD },
    auth: null, id: 1,
  });
  if (res.data.error) throw new Error(`Falha na autenticação: ${res.data.error.message}`);
  zabbixToken = res.data.result;
  tokenExpires = Date.now() + (8 * 60 * 60 * 1000);
  console.log('✅ Autenticado no Zabbix');
}

async function getAllHosts(groupIds) {
  const params = {
    output: ['hostid', 'host', 'name', 'status', 'available', 'description'],
    selectGroups: ['name'],
    selectInterfaces: ['ip', 'dns', 'type', 'available'],
    selectParentTemplates: ['templateid', 'name'],
    selectTriggers: ['triggerid', 'priority', 'value'],
    limit: 2000,
  };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  const hosts = await call('host.get', params, true, 120);
  return hosts.map(h => ({
    ...h,
    available: h.interfaces?.[0]?.available || h.available || '0',
    activeAlerts: (h.triggers || []).filter(t => t.value === '1').length,
    maxSeverity: (h.triggers || []).filter(t => t.value === '1').reduce((max, t) => Math.max(max, parseInt(t.priority||0)), 0),
  }));
}

async function getHostsByGroups(groupIds) {
  if (groupIds !== null && groupIds.length === 0) return [];
  return getAllHosts(groupIds);
}

async function getHostsCount(groupIds) {
  const params = { output: 'count', countOutput: true };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  return call('host.get', params, true, 120);
}

async function getDisabledHosts(groupIds) {
  const params = { output: ['hostid', 'host', 'name', 'status'], filter: { status: 1 } };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  return call('host.get', params, true, 120);
}

async function getTemplates(groupIds) {
  return call('template.get', {
    output: ['templateid', 'host', 'name', 'description', 'status'],
    selectHosts: ['hostid', 'name'],
    selectItems: 'count',
    selectTriggers: 'count',
  }, true, 300);
}

async function getTemplateItems(templateId) {
  const items = await call('item.get', {
    output: ['itemid', 'name', 'key_', 'type', 'delay', 'history', 'trends', 'units', 'params', 'status', 'description', 'error'],
    templateids: [templateId],
    limit: 500,
  }, true, 180);
 return items.map(item => ({
    ...item,
    templateid: templateId,
    isQuery: item.type === '11' || item.key_?.startsWith('db.odbc') || item.key_?.startsWith('db.query'),
    typeLabel: getItemTypeLabel(item.type),
    delayFormatted: formatDelay(item.delay),
  }));
}

async function getTemplateTriggers(templateId) {
  const triggers = await call('trigger.get', {
    output: ['triggerid', 'description', 'priority', 'status', 'expression', 'comments'],
    templateids: [templateId],
    sortfield: 'priority', sortorder: 'DESC',
    expandExpression: true,
  }, true, 180);
  return triggers.map(t => ({ ...t, templateid: templateId }));
}

async function getHostItems(hostId) {
  const items = await call('item.get', {
    output: ['itemid', 'name', 'key_', 'type', 'delay', 'history', 'trends',
             'units', 'params', 'lastvalue', 'lastclock', 'status', 'description', 'error'],
    hostids: [hostId],
    webitems: true,
    limit: 500,
  }, true, 60);
  return items.map(item => ({
    ...item,
    isQuery: item.type === '11' || item.key_?.startsWith('db.odbc') || item.key_?.startsWith('db.query'),
    typeLabel: getItemTypeLabel(item.type),
    delayFormatted: formatDelay(item.delay),
  }));
}

async function getHostTriggers(hostId) {
  return call('trigger.get', {
    output: ['triggerid', 'description', 'priority', 'status', 'expression', 'lastchange'],
    hostids: [hostId],
    sortfield: 'priority', sortorder: 'DESC',
  }, true, 120);
}

async function getHostAlerts(hostId) {
  return call('trigger.get', {
    output: ['triggerid', 'description', 'priority', 'status', 'expression', 'lastchange'],
    hostids: [hostId],
    only_true: 1,
    filter: { value: 1 },
    monitored: true,
    active: true,
    sortfield: 'priority', sortorder: 'DESC',
  }, false);
}

async function getHostHealth(hostId) {
  const [host, items, triggers, alerts] = await Promise.all([
    call('host.get', {
      output: ['hostid', 'host', 'name', 'status', 'available', 'description'],
      selectGroups: ['name'],
      selectInterfaces: ['ip', 'dns', 'type'],
      selectParentTemplates: ['templateid', 'name'],
      hostids: [hostId],
    }, true, 60),
    getHostItems(hostId),
    getHostTriggers(hostId),
    getHostAlerts(hostId),
  ]);
  const hostInfo = host[0] || {};
  const itemsActive = items.filter(i => i.status === '0');
  const itemsDisabled = items.filter(i => i.status === '1');
  const itemsQuery = items.filter(i => i.isQuery);
  const triggersActive = triggers.filter(t => t.status === '0');
  const triggersDisabled = triggers.filter(t => t.status === '1');
  return {
    host: hostInfo,
    summary: {
      totalItems: items.length,
      itemsActive: itemsActive.length,
      itemsDisabled: itemsDisabled.length,
      itemsQuery: itemsQuery.length,
      totalTriggers: triggers.length,
      triggersActive: triggersActive.length,
      triggersDisabled: triggersDisabled.length,
      activeAlerts: alerts.length,
    },
    items, triggers, alerts,
    queryItems: itemsQuery,
    generatedAt: new Date().toLocaleString('pt-BR'),
  };
}

async function getZabbixAuditLog(limit = 100) {
  try {
    const result = await call('auditlog.get', {
      output: 'extend', sortfield: 'clock', sortorder: 'DESC', limit,
    }, false);
    console.log('✅ auditlog.get retornou:', result?.length, 'registros');
    return result;
  } catch (err) {
    console.error('❌ auditlog.get falhou:', err.message);
    return [];
  }
}

async function getTriggersActive(groupIds, severity = null) {
  const params = {
    output: ['triggerid', 'description', 'priority', 'lastchange', 'comments', 'url'],
    selectHosts: ['host', 'name'],
    selectItems: ['name', 'key_', 'lastvalue'],
    only_true: 1, filter: { value: 1 }, monitored: true, active: true,
    sortfield: 'priority', sortorder: 'DESC',
  };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  if (severity !== null) params.filter.priority = severity;
  return call('trigger.get', params, true, 60);
}

async function getAllTriggers(groupIds) {
  const params = {
    output: ['triggerid', 'description', 'priority', 'status', 'expression', 'lastchange'],
    selectHosts: ['host', 'name'],
    expandExpression: true,
  };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  return call('trigger.get', params, true, 300);
}

async function getItems(groupIds, searchQuery = '') {
  const params = {
    output: ['itemid', 'name', 'key_', 'type', 'value_type', 'delay', 'history',
             'trends', 'units', 'params', 'lastvalue', 'lastclock', 'status', 'description', 'error'],
    selectHosts: ['host', 'name'],
    webitems: true, filter: {}, limit: 5000,
  };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  if (searchQuery) params.search = { name: searchQuery, key_: searchQuery };
  const items = await call('item.get', params, true, 300);
  return items.map(item => ({
    ...item,
    isQuery: item.type === '11' || item.key_?.startsWith('db.odbc') || item.key_?.startsWith('db.query'),
    typeLabel: getItemTypeLabel(item.type),
    delayFormatted: formatDelay(item.delay),
  }));
}

async function getDashboardStats(groupIds, templateIds) {
  const allTemplates = await getTemplates(groupIds);
  const filteredTemplates = templateIds === null
    ? allTemplates
    : allTemplates.filter(t => templateIds.includes(t.templateid));

  const [totalHosts, disabledHosts, activeTriggers, allTriggers, items, disabledItemsCount, allHosts, zabbixVersion] = await Promise.all([
    getHostsCount(groupIds), getDisabledHosts(groupIds),

    getTriggersActive(groupIds), getAllTriggers(groupIds), getItems(groupIds),
    call('item.get', { countOutput: true, filter: { status: 1 }, ...(groupIds && groupIds.length > 0 ? { groupids: groupIds } : {}) }, true, 120),
    getAllHosts(groupIds), getZabbixVersion(),
  ]);
  const triggersBySeverity = {
    disaster: activeTriggers.filter(t => t.priority === '5').length,
    high:     activeTriggers.filter(t => t.priority === '4').length,
    average:  activeTriggers.filter(t => t.priority === '3').length,
    warning:  activeTriggers.filter(t => t.priority === '2').length,
    info:     activeTriggers.filter(t => t.priority === '1').length,
  };
  const triggersActive = allTriggers.filter(t => t.status === '0').length;
  const triggersDisabled = allTriggers.filter(t => t.status === '1').length;

 return {
    totalHosts: parseInt(totalHosts),
    disabledHosts: disabledHosts.length,
    enabledHosts: parseInt(totalHosts) - disabledHosts.length,
    offlineHosts: allHosts.filter(h => h.available === '2').length,
    templates: filteredTemplates.length,
    activeTriggers: activeTriggers.length,
    activeTriggerCount: triggersActive,
    disabledTriggers: triggersDisabled,
    totalItems: items.filter(i => i.status === '0').length,
    disabledItems: parseInt(disabledItemsCount) || 0,
    queryItems: items.filter(i => i.isQuery).length,
    triggersBySeverity, zabbixVersion,
    lastUpdated: new Date().toISOString(),
  };
}

async function getHostGroups() {
  return call('hostgroup.get', { output: ['groupid', 'name'], real_hosts: true, sortfield: 'name' }, true, 300);
}

function getItemTypeLabel(type) {
  const types = {
    '0': 'Zabbix Agent', '1': 'SNMPv1', '2': 'Zabbix Trapper',
    '3': 'Simple Check', '4': 'SNMPv2', '5': 'Zabbix Internal',
    '6': 'SNMPv3', '7': 'Zabbix Active', '8': 'Zabbix Aggregate',
    '9': 'Web Item', '10': 'External Check', '11': 'Database Monitor',
    '12': 'IPMI', '13': 'SSH', '14': 'Telnet', '15': 'Calculated',
    '16': 'JMX', '17': 'SNMP Trap', '18': 'Dependent', '19': 'HTTP Agent',
    '20': 'SNMP Agent', '21': 'Script',
  };
  return types[String(type)] || `Type ${type}`;
}

function formatDelay(delay) {
  if (!delay) return 'N/A';
  const match = String(delay).match(/^(\d+)([smhd]?)$/);
  if (!match) return delay;
  const [, val, unit] = match;
  const units = { s: 'seg', m: 'min', h: 'hora(s)', d: 'dia(s)', '': 'seg' };
  return `${val} ${units[unit] || unit}`;
}

async function getZabbixVersion() {
  try {
    const res = await zabbixAPI.post(getZabbixURL(), {
      jsonrpc: '2.0', method: 'apiinfo.version', params: {}, id: 1,
    });
    return res.data.result || '—';
  } catch { return '—'; }
}

async function getZabbixStatus() {
  try {
    await call('apiinfo.version', {}, false);
    return { online: true };
  } catch { return { online: false }; }
}

async function getRecentAlerts(groupIds, limit = 5) {
  const params = {
    output: ['triggerid', 'description', 'priority', 'lastchange'],
    selectHosts: ['host', 'name'],
    only_true: 1, filter: { value: 1 }, monitored: true, active: true,
    sortfield: 'lastchange', sortorder: 'DESC', limit,
  };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  return call('trigger.get', params, false);
}

async function getTopHostsWithProblems(groupIds, limit = 5) {
  const alerts = await getTriggersActive(groupIds);
  const hostCount = {};
  const hostNames = {};
  alerts.forEach(t => {
    t.hosts?.forEach(h => {
      hostCount[h.hostid] = (hostCount[h.hostid] || 0) + 1;
      hostNames[h.hostid] = h.name;
    });
  });
  return Object.entries(hostCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([hostid, count]) => ({ hostid, name: hostNames[hostid], alerts: count }));
}

async function getItemsWithError(groupIds) {
  const params = {
    output: ['itemid', 'name', 'key_', 'error', 'lastclock'],
    selectHosts: ['host', 'name'],
    monitored: true, webitems: true, filter: {},
    search: { error: ' ' }, searchWildcardsEnabled: false, limit: 50,
  };
  if (groupIds && groupIds.length > 0) params.groupids = groupIds;
  try {
    const items = await call('item.get', params, false);
    return items.filter(i => i.error && i.error.trim() !== '');
  } catch { return []; }
}

async function getAlertHistory(groupIds, days = 7) {
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({ date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), count: 0 });
  }
  try {
    const timeTill = Math.floor(Date.now() / 1000);
    const timeFrom = timeTill - (days * 86400);
    const params = { output: ['clock', 'objectid'], source: 0, object: 0, value: 1, time_from: timeFrom, time_till: timeTill };
    if (groupIds && groupIds.length > 0) params.groupids = groupIds;
    const events = await call('event.get', params, false);
    events.forEach(e => {
      const d = new Date(parseInt(e.clock) * 1000);
      const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const found = result.find(r => r.date === label);
      if (found) found.count++;
    });
  } catch {}
  return result;
}

async function getHostTrends(hostId, period = '1d', fromDate = null, toDate = null) {
  const now = Math.floor(Date.now() / 1000);
  let timeFrom, timeTill;
  if (fromDate && toDate) {
    timeFrom = Math.floor(new Date(fromDate).getTime() / 1000);
    timeTill = Math.floor(new Date(toDate).getTime() / 1000);
  } else {
    const periods = {
      '5m': 300, '15m': 900, '30m': 1800, '1h': 3600,
      '3h': 10800, '6h': 21600, '12h': 43200, '1d': 86400,
      '2d': 172800, '7d': 604800, '30d': 2592000,
      '60d': 5184000, '1y': 31536000,
    };
    const seconds = periods[period] || 86400;
    timeFrom = now - seconds;
    timeTill = now;
  }
  const useHistory = (timeTill - timeFrom) <= 604800;

  const [items, memItems, diskItems, dbItems] = await Promise.all([
    call('item.get', { output: ['itemid', 'name', 'key_', 'units', 'value_type'], hostids: [hostId], filter: { status: 0 }, search: { key_: 'system.cpu.util' } }, false),
    call('item.get', { output: ['itemid', 'name', 'key_', 'units', 'value_type'], hostids: [hostId], filter: { status: 0 }, search: { key_: 'vm.memory.util' } }, false),
    call('item.get', { output: ['itemid', 'name', 'key_', 'units', 'value_type'], hostids: [hostId], filter: { status: 0 }, searchWildcardsEnabled: true, search: { key_: 'vfs.fs.dependent.size*pused*' } }, false),
    call('item.get', { output: ['itemid', 'name', 'key_', 'units', 'value_type'], hostids: [hostId], filter: { status: 0, type: 11 }, value_type: [0,3] }, false),
  ]);

  async function fetchData(itemIds) {
    if (!itemIds.length) return [];
    if (useHistory) {
      return call('history.get', { output: 'extend', history: 0, itemids: itemIds, time_from: timeFrom, time_till: timeTill, sortfield: 'clock', sortorder: 'ASC', limit: 1000 }, false);
    } else {
      return call('trend.get', { output: 'extend', itemids: itemIds, time_from: timeFrom, time_till: timeTill, sortfield: 'clock', sortorder: 'ASC', limit: 1000 }, false);
    }
  }

  function buildSeries(data, itemId, isTrend) {
    return data
      .filter(d => d.itemid === String(itemId))
      .map(d => ({ time: parseInt(d.clock) * 1000, value: parseFloat(isTrend ? d.value_avg : d.value) }))
      .filter(d => !isNaN(d.value));
  }

  function analyzePattern(series) {
    if (!series.length) return null;
    const values = series.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const maxPoint = series[values.indexOf(max)];
    const hourCounts = {};
    series.forEach(d => { const h = new Date(d.time).getHours(); hourCounts[h] = (hourCounts[h] || 0) + 1; });
    const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return { avg: avg.toFixed(1), max: max.toFixed(1), min: min.toFixed(1), peakHour, peakTime: maxPoint?.time };
  }

  const cpuIds = items.map(i => i.itemid);
  const memIds = memItems.map(i => i.itemid);
  const diskIds = diskItems.map(i => i.itemid);
  const dbIds = dbItems.map(i => i.itemid);

  const [cpuData, memData, diskData, dbData] = await Promise.all([fetchData(cpuIds), fetchData(memIds), fetchData(diskIds), fetchData(dbIds)]);

  const cpuSeries = cpuIds.length ? buildSeries(cpuData, cpuIds[0], !useHistory) : [];
  const memSeries = memIds.length ? buildSeries(memData, memIds[0], !useHistory) : [];
  const diskSeries = diskItems.map(item => {
    const data = buildSeries(diskData, item.itemid, !useHistory);
    return {
      name: item.name.replace('FS [', '').replace(']: Space usage graph, in % (relative to max available)', '').replace(']: Percentage of used space', '') || item.key_,
      key: item.key_, data, analysis: analyzePattern(data),
    };
  }).filter(s => s.data.length > 0);

  const dbSeries = dbItems.map(item => {
    const data = buildSeries(dbData, item.itemid, !useHistory);
    return { name: item.name, key: item.key_, data, analysis: analyzePattern(data) };
  }).filter(s => s.data.length > 0);

  return {
    period, cpu: { series: cpuSeries, analysis: analyzePattern(cpuSeries) },
    memory: { series: memSeries, analysis: analyzePattern(memSeries) },
    disk: diskSeries, db: dbSeries, generatedAt: new Date().toLocaleString('pt-BR'),
  };
}

async function getAuditLogEnriched(timeFrom, timeTill) {
  try {
    const logs = await call('auditlog.get', {
      output: 'extend',
      sortfield: 'clock', sortorder: 'DESC',
      limit: 5000,
    }, false, 0);
    // Filtra pelo período já que o Zabbix 6 não suporta time_from/time_till no auditlog
    const filtered = logs.filter(l => {
      const clock = parseInt(l.clock);
      return clock >= timeFrom && clock <= timeTill;
    });

    const itemLogs    = filtered.filter(l => String(l.resourcetype) === '15');
    const triggerLogs = filtered.filter(l => String(l.resourcetype) === '13');
    const itemIds     = itemLogs.map(l => l.resourceid).filter(Boolean);
    const triggerIds  = triggerLogs.map(l => l.resourceid).filter(Boolean);

    let itemsMap = {}, triggersMap = {};

    if (itemIds.length) {
      try {
        const items = await call('item.get', {
          output: ['itemid', 'name', 'hostid'],
          selectHosts: ['hostid', 'name', 'host'],
          itemids: itemIds,
        }, false);
        items.forEach(i => {
          if (i.hosts?.[0]) itemsMap[i.itemid] = { ...i.hosts[0], isTemplate: false };
        });

        // Busca também em templates
        const missing = itemIds.filter(id => !itemsMap[id]);
        if (missing.length) {
          const titems = await call('item.get', {
            output: ['itemid', 'name', 'hostid'],
            selectHosts: ['hostid', 'name', 'host'],
            itemids: missing,
            webitems: true,
          }, false);
          titems.forEach(i => {
            if (i.hosts?.[0]) itemsMap[i.itemid] = { ...i.hosts[0], isTemplate: false };
          });
        }
      } catch {}
    }

    if (triggerIds.length) {
      try {
        const triggers = await call('trigger.get', {
          output: ['triggerid', 'description', 'templateid'],
          selectHosts: ['hostid', 'name', 'host'],
          triggerids: triggerIds,
        }, false);

        const tplIds = [];
        triggers.forEach(t => {
          if (t.hosts?.[0]) {
            triggersMap[t.triggerid] = { ...t.hosts[0], isTemplate: false };
          } else if (t.templateid && t.templateid !== '0') {
            tplIds.push(t.templateid);
          }
        });

        if (tplIds.length) {
          const tpls = await call('template.get', {
            output: ['templateid', 'name', 'host'],
            templateids: [...new Set(tplIds)],
          }, false);
          const tplMap = {};
          tpls.forEach(t => { tplMap[t.templateid] = t; });
          triggers.forEach(t => {
            if (!triggersMap[t.triggerid] && t.templateid && tplMap[t.templateid]) {
              triggersMap[t.triggerid] = { name: tplMap[t.templateid].name, host: tplMap[t.templateid].host, isTemplate: true };
            }
          });
        }
      } catch {}
    }

    return filtered.map(l => {
      let parentHost = null;
      if (String(l.resourcetype) === '15' && l.resourceid) parentHost = itemsMap[l.resourceid] || null;
      if (String(l.resourcetype) === '13' && l.resourceid) parentHost = triggersMap[l.resourceid] || null;
      return { ...l, parentHost };
    });
  } catch (err) {
    console.error('❌ auditlog enrich falhou:', err.message);
    return [];
  }
}


module.exports = {
  getAllHosts, getHostsByGroups, getHostsCount, getDisabledHosts,
  getTemplates, getTemplateItems, getTemplateTriggers,
  getHostItems, getHostTriggers, getHostAlerts, getHostHealth,
  getZabbixAuditLog, getZabbixVersion, getZabbixStatus,
  getRecentAlerts, getTopHostsWithProblems, getItemsWithError, getAlertHistory,
  getTriggersActive, getAllTriggers, getHostTrends,
  getItems, getDashboardStats, getHostGroups, authenticate, call, getAuditLogEnriched, setCurrentConnection,
  getAuditLogEnriched, setCurrentConnection,
};