const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { db } = require('../db/database');
const zabbix = require('../services/zabbix');
const ExcelJS = require('exceljs');
const router = express.Router();

function getGroupIds(req) {
  if (req.user.role === 'admin') return null;
  const area = db.prepare('SELECT zabbix_hostgroup_ids FROM areas WHERE id = ?').get(req.user.area_id);
  if (!area) return [];
  return JSON.parse(area.zabbix_hostgroup_ids || '[]');
}

function getTemplateIds(req) {
  if (req.user.role === 'admin') return null;
  const area = db.prepare('SELECT zabbix_template_ids FROM areas WHERE id = ?').get(req.user.area_id);
  if (!area) return [];
  return JSON.parse(area.zabbix_template_ids || '[]');
}

function applyAreaConnection(req) {
  // Check for explicit connection selection via header
  const headerConnId = req.headers['x-connection-id'];
  if (headerConnId) {
    zabbix.setCurrentConnection(headerConnId);
    return;
  }
  if (req.user.role === 'admin') { zabbix.setCurrentConnection(null); return; }
  const area = db.prepare('SELECT zabbix_connection_ids FROM areas WHERE id = ?').get(req.user.area_id);
  if (!area) { zabbix.setCurrentConnection(null); return; }
  const ids = JSON.parse(area.zabbix_connection_ids || '[]');
  zabbix.setCurrentConnection(ids.length > 0 ? ids[0] : null);
}

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getDashboardStats(getGroupIds(req), getTemplateIds(req)));
  } catch (err) { console.error('Dashboard error:', err.message); res.status(500).json({ error: err.message }); }
});

router.get('/dashboard/extras', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    const groupIds = getGroupIds(req);
    const [status, recentAlerts, topHosts, itemsWithError, alertHistory] = await Promise.all([
      zabbix.getZabbixStatus(),
      zabbix.getRecentAlerts(groupIds, 5),
      zabbix.getTopHostsWithProblems(groupIds, 5),
      zabbix.getItemsWithError(groupIds),
      zabbix.getAlertHistory(groupIds, 7),
    ]);
    res.json({ status, recentAlerts, topHosts, itemsWithError, alertHistory });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/hosts', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getAllHosts(getGroupIds(req)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/hosts/disabled', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getDisabledHosts(getGroupIds(req)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/templates', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    const templates = await zabbix.getTemplates(getGroupIds(req));
    const templateIds = getTemplateIds(req);
    if (templateIds === null) return res.json(templates);
    if (templateIds.length === 0) return res.json([]);
    res.json(templates.filter(t => templateIds.includes(t.templateid)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/template/:id/items', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getTemplateItems(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/template/:id/triggers', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getTemplateTriggers(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/host/:id/items', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getHostItems(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/host/:id/triggers', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getHostTriggers(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/host/:id/alerts', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getHostAlerts(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/host/:id/health', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    res.json(await zabbix.getHostHealth(req.params.id));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/host/:id/health/excel', authMiddleware, async (req, res) => {
  try {
    const health = await zabbix.getHostHealth(req.params.id);
    const { host, summary, items, triggers, alerts } = health;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Portal de Monitoração';

    const BLUE='FF1F4E79',LBLUE='FFD6E4F0',WHITE='FFFFFFFF',GRAY='FFF2F2F2';
    const GREEN='FF375623',LGREEN='FFE2EFDA',RED='FF9C0006',LRED='FFFFC7CE';
    const ORANGE='FF833C00',LORANGE='FFFFEB9C',BLACK='FF000000';
    const SEV_MAP={'5':'DISASTER','4':'HIGH','3':'AVERAGE','2':'WARNING','1':'INFORMATION','0':'N/C'};
    const SEV_COLOR={'5':[LRED,RED],'4':[LORANGE,ORANGE],'3':['FFFFF2CC','FF7F6000'],'2':[LBLUE,BLUE],'1':[GRAY,BLACK]};

    const hFill=a=>({type:'pattern',pattern:'solid',fgColor:{argb:a}});
    const hFont=(a,b=false,s=10)=>({name:'Arial',color:{argb:a},bold:b,size:s});
    const hBorder=()=>{const s={style:'thin',color:{argb:'FFD0D0D0'}};return{top:s,left:s,bottom:s,right:s};};

    function addTitleRow(ws,text,cols){
      ws.mergeCells(`A1:${String.fromCharCode(64+cols)}1`);
      const r=ws.getRow(1);r.height=28;
      const c=r.getCell(1);c.value=text;
      c.fill=hFill(BLUE);c.font=hFont(WHITE,true,13);
      c.alignment={horizontal:'left',vertical:'middle',indent:1};
    }
    function addSubtitle(ws,text,cols,row=2){
      ws.mergeCells(`A${row}:${String.fromCharCode(64+cols)}${row}`);
      const r=ws.getRow(row);r.height=18;
      const c=r.getCell(1);c.value=text;
      c.fill=hFill(LBLUE);c.font=hFont(BLUE,false,9);
      c.alignment={horizontal:'left',vertical:'middle',indent:1};
    }
    function addSectionHeader(ws,text,cols,rowNum){
      ws.mergeCells(`A${rowNum}:${String.fromCharCode(64+cols)}${rowNum}`);
      const r=ws.getRow(rowNum);r.height=16;
      const c=r.getCell(1);c.value=text;
      c.fill=hFill('FFE9EDF2');c.font=hFont(BLUE,true,10);
      c.alignment={horizontal:'left',vertical:'middle',indent:1};
    }
    function addTableHeader(ws,headers,rowNum,fillArgb=BLUE){
      const r=ws.getRow(rowNum);r.height=18;
      headers.forEach((h,i)=>{
        const c=r.getCell(i+1);c.value=h;
        c.fill=hFill(fillArgb);c.font=hFont(WHITE,true,10);
        c.alignment={horizontal:'center',vertical:'middle',wrapText:true};
        c.border=hBorder();
      });
    }
    function styleRow(r,alt,cells){
      cells.forEach((val,i)=>{
        const c=r.getCell(i+1);c.value=val??'—';
        c.fill=hFill(alt?GRAY:WHITE);c.font=hFont(BLACK,false,10);
        c.alignment={vertical:'middle',wrapText:true};c.border=hBorder();
      });
    }

    const ws1=wb.addWorksheet('Resumo');
    ws1.columns=[{width:28},{width:30}];
    addTitleRow(ws1,`Relatório de Saúde — ${host.name}`,2);
    addSubtitle(ws1,`Gerado em ${health.generatedAt}`,2);
    ws1.addRow([]);
    addSectionHeader(ws1,'INFORMAÇÕES DO HOST',2,4);
    addTableHeader(ws1,['Campo','Valor'],5,'FF2E75B6');
    [['Host',host.name],['Hostname',host.host],['IP',host.interfaces?.[0]?.ip||'—'],['Status',host.status==='0'?'Ativo':'Desativado'],['Templates',host.parentTemplates?.map(t=>t.name).join(', ')||'—']].forEach((row,i)=>{
      const r=ws1.addRow(row);r.height=16;styleRow(r,i%2===1,row);r.getCell(1).font=hFont(BLACK,true,10);
    });
    ws1.addRow([]);
    const mn=ws1.lastRow.number+1;
    addSectionHeader(ws1,'MÉTRICAS',2,mn);
    addTableHeader(ws1,['Métrica','Quantidade'],mn+1,'FF2E75B6');
    [['Itens Ativos',summary.itemsActive],['Itens Desativados',summary.itemsDisabled],['Triggers Ativas',summary.triggersActive],['Triggers Desativadas',summary.triggersDisabled],['Alertas Ativos Agora',summary.activeAlerts]].forEach((row,i)=>{
      const r=ws1.addRow(row);r.height=16;styleRow(r,i%2===1,row);r.getCell(1).font=hFont(BLACK,true,10);
      if(row[0]==='Alertas Ativos Agora'&&summary.activeAlerts>0){r.getCell(2).fill=hFill(LRED);r.getCell(2).font=hFont(RED,true,10);}
    });

    const ws2=wb.addWorksheet('Alertas Ativos');
    ws2.columns=[{width:14},{width:55},{width:22}];
    addTitleRow(ws2,`Alertas Ativos — ${host.name}`,3);
    addSubtitle(ws2,`${alerts.length} alerta(s) ativo(s) no momento`,3);
    ws2.addRow([]);
    addTableHeader(ws2,['Severidade','Descrição','Desde'],4);
    if(alerts.length===0){
      const r=ws2.addRow(['✓ Nenhum alerta ativo','','']);
      ws2.mergeCells(`A5:C5`);
      r.getCell(1).fill=hFill(LGREEN);r.getCell(1).font=hFont(GREEN,true,10);
      r.getCell(1).alignment={horizontal:'center',vertical:'middle'};
    } else {
      alerts.forEach((a,i)=>{
        const [bg,fg]=SEV_COLOR[a.priority]||[GRAY,BLACK];
        const since=a.lastchange&&parseInt(a.lastchange)>0?new Date(parseInt(a.lastchange)*1000).toLocaleString('pt-BR'):'—';
        const r=ws2.addRow([SEV_MAP[a.priority]||'—',a.description,since]);
        r.height=16;
        r.eachCell(c=>{c.fill=hFill(i%2===0?WHITE:GRAY);c.font=hFont(BLACK,false,10);c.border=hBorder();c.alignment={vertical:'middle'};});
        r.getCell(1).fill=hFill(bg);r.getCell(1).font=hFont(fg,true,10);
        r.getCell(1).alignment={horizontal:'center',vertical:'middle'};
      });
    }

    const ws3=wb.addWorksheet('Itens');
    ws3.columns=[{width:42},{width:38},{width:12},{width:18},{width:14},{width:40}];
    addTitleRow(ws3,`Itens Monitorados — ${host.name}`,6);
    addSubtitle(ws3,`${items.length} itens`,6);
    ws3.addRow([]);
    addTableHeader(ws3,['Nome','Chave','Status','Tipo','Intervalo','Detalhes'],4);
    items.forEach((item,i)=>{
      const vals=[item.name,item.key_,item.status==='0'?'Ativo':'Desativado',item.typeLabel,item.delayFormatted,item.params||item.description||'—'];
      const r=ws3.addRow(vals);r.height=16;styleRow(r,i%2===1,vals);
      r.getCell(3).fill=hFill(item.status==='0'?LGREEN:GRAY);
      r.getCell(3).font=hFont(item.status==='0'?GREEN:'FF666666',true,10);
      r.getCell(3).alignment={horizontal:'center',vertical:'middle'};
    });

    const ws4=wb.addWorksheet('Triggers');
    ws4.columns=[{width:50},{width:14},{width:14},{width:22}];
    addTitleRow(ws4,`Triggers — ${host.name}`,4);
    addSubtitle(ws4,`${triggers.length} triggers`,4);
    ws4.addRow([]);
    addTableHeader(ws4,['Descrição','Severidade','Status','Última Mudança'],4);
    triggers.forEach((t,i)=>{
      const [bg,fg]=SEV_COLOR[t.priority]||[GRAY,BLACK];
      const since=t.lastchange&&parseInt(t.lastchange)>0?new Date(parseInt(t.lastchange)*1000).toLocaleString('pt-BR'):'—';
      const vals=[t.description,SEV_MAP[t.priority]||'—',t.status==='0'?'Ativa':'Desabilitada',since];
      const r=ws4.addRow(vals);r.height=16;styleRow(r,i%2===1,vals);
      r.getCell(2).fill=hFill(bg);r.getCell(2).font=hFont(fg,true,10);r.getCell(2).alignment={horizontal:'center',vertical:'middle'};
      r.getCell(3).fill=hFill(t.status==='0'?LGREEN:GRAY);r.getCell(3).font=hFont(t.status==='0'?GREEN:'FF666666',true,10);r.getCell(3).alignment={horizontal:'center',vertical:'middle'};
    });

    const ws5=wb.addWorksheet('Templates');
    ws5.columns=[{width:50}];
    addTitleRow(ws5,`Templates Vinculados — ${host.name}`,1);
    ws5.addRow([]);
    addTableHeader(ws5,['Nome do Template'],3,'FF2E75B6');
    if(!host.parentTemplates?.length){ws5.addRow(['Nenhum template vinculado']);}
    else{host.parentTemplates.forEach((t,i)=>{const r=ws5.addRow([t.name]);r.height=16;r.getCell(1).fill=hFill(i%2===0?WHITE:GRAY);r.getCell(1).font=hFont(BLACK,false,10);r.getCell(1).border=hBorder();});}

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="saude_${host.host}_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(err){console.error('Excel error:',err.message);res.status(500).json({error:err.message});}
});

router.post('/hosts/health/excel', authMiddleware, async (req, res) => {
  try {
    const { hostIds } = req.body;
    if (!hostIds?.length) return res.status(400).json({ error: 'Nenhum host selecionado' });
    const healths = await Promise.all(hostIds.map(id => zabbix.getHostHealth(id)));
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Portal de Monitoração';

    const BLUE='FF1F4E79',LBLUE='FFD6E4F0',WHITE='FFFFFFFF',GRAY='FFF2F2F2';
    const GREEN='FF375623',LGREEN='FFE2EFDA',RED='FF9C0006',LRED='FFFFC7CE';
    const ORANGE='FF833C00',LORANGE='FFFFEB9C',BLACK='FF000000';
    const SEV_MAP={'5':'DISASTER','4':'HIGH','3':'AVERAGE','2':'WARNING','1':'INFORMATION','0':'N/C'};
    const SEV_COLOR={'5':[LRED,RED],'4':[LORANGE,ORANGE],'3':['FFFFF2CC','FF7F6000'],'2':[LBLUE,BLUE],'1':[GRAY,BLACK]};
    const hFill=a=>({type:'pattern',pattern:'solid',fgColor:{argb:a}});
    const hFont=(a,b=false,s=10)=>({name:'Arial',color:{argb:a},bold:b,size:s});
    const hBorder=()=>{const s={style:'thin',color:{argb:'FFD0D0D0'}};return{top:s,left:s,bottom:s,right:s};};
    function addTitleRow(ws,text,cols){ws.mergeCells(`A1:${String.fromCharCode(64+cols)}1`);const r=ws.getRow(1);r.height=28;const c=r.getCell(1);c.value=text;c.fill=hFill(BLUE);c.font=hFont(WHITE,true,13);c.alignment={horizontal:'left',vertical:'middle',indent:1};}
    function addSubtitle(ws,text,cols,row=2){ws.mergeCells(`A${row}:${String.fromCharCode(64+cols)}${row}`);const r=ws.getRow(row);r.height=16;const c=r.getCell(1);c.value=text;c.fill=hFill(LBLUE);c.font=hFont(BLUE,false,9);c.alignment={horizontal:'left',vertical:'middle',indent:1};}
    function addSectionHeader(ws,text,cols,rowNum){ws.mergeCells(`A${rowNum}:${String.fromCharCode(64+cols)}${rowNum}`);const r=ws.getRow(rowNum);r.height=16;const c=r.getCell(1);c.value=text;c.fill=hFill('FFE9EDF2');c.font=hFont(BLUE,true,10);c.alignment={horizontal:'left',vertical:'middle',indent:1};}
    function addTableHeader(ws,headers,rowNum,fillArgb=BLUE){const r=ws.getRow(rowNum);r.height=18;headers.forEach((h,i)=>{const c=r.getCell(i+1);c.value=h;c.fill=hFill(fillArgb);c.font=hFont(WHITE,true,10);c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=hBorder();});}
    function styleDataRow(r,alt,vals){vals.forEach((val,i)=>{const c=r.getCell(i+1);c.value=val??'—';c.fill=hFill(alt?GRAY:WHITE);c.font=hFont(BLACK,false,10);c.alignment={vertical:'middle',wrapText:true};c.border=hBorder();});}

    const wsRes=wb.addWorksheet('Resumo Consolidado');
    wsRes.columns=[{width:30},{width:14},{width:14},{width:16},{width:16},{width:14},{width:35}];
    addTitleRow(wsRes,`Saúde Consolidada — ${healths.length} Servidores`,7);
    addSubtitle(wsRes,`Gerado em ${new Date().toLocaleString('pt-BR')}`,7);
    wsRes.addRow([]);
    addTableHeader(wsRes,['Host','Itens Ativos','Itens Desativ.','Triggers Ativas','Triggers Desativ.','Alertas','Templates'],4,'FF2E75B6');
    healths.forEach((h,i)=>{
      const r=wsRes.addRow([h.host?.name,h.summary.itemsActive,h.summary.itemsDisabled,h.summary.triggersActive,h.summary.triggersDisabled,h.summary.activeAlerts,h.host?.parentTemplates?.map(t=>t.name).join(', ')||'—']);
      r.height=16;
      styleDataRow(r,i%2===1,[h.host?.name,h.summary.itemsActive,h.summary.itemsDisabled,h.summary.triggersActive,h.summary.triggersDisabled,h.summary.activeAlerts,h.host?.parentTemplates?.map(t=>t.name).join(', ')||'—']);
      r.getCell(1).font=hFont(BLACK,true,10);
      r.getCell(2).fill=hFill(LGREEN);r.getCell(2).font=hFont(GREEN,true,10);
      if(h.summary.activeAlerts>0){r.getCell(6).fill=hFill(LRED);r.getCell(6).font=hFont(RED,true,10);}
      [2,3,4,5,6].forEach(n=>r.getCell(n).alignment={horizontal:'center',vertical:'middle'});
    });

    for(const h of healths){
      const {host,summary,items,triggers,alerts}=h;
      const sheetName=((host?.name||host?.host||'Host').slice(0,20) + '_' + (host?.hostid||i)).slice(0,31);
      const ws1=wb.addWorksheet(`${sheetName} - Resumo`);
      ws1.columns=[{width:28},{width:32}];
      addTitleRow(ws1,`Resumo — ${host.name}`,2);
      addSubtitle(ws1,`Gerado em ${h.generatedAt}`,2);
      ws1.addRow([]);
      addSectionHeader(ws1,'INFORMAÇÕES DO HOST',2,4);
      addTableHeader(ws1,['Campo','Valor'],5,'FF2E75B6');
      [['Host',host.name],['Hostname',host.host],['IP',host.interfaces?.[0]?.ip||'—'],['Status',host.status==='0'?'Ativo':'Desativado'],['Templates',host.parentTemplates?.map(t=>t.name).join(', ')||'—']].forEach((row,i)=>{const r=ws1.addRow(row);r.height=16;styleDataRow(r,i%2===1,row);r.getCell(1).font=hFont(BLACK,true,10);});
      ws1.addRow([]);
      const mn=ws1.lastRow.number+1;
      addSectionHeader(ws1,'MÉTRICAS',2,mn);
      addTableHeader(ws1,['Métrica','Quantidade'],mn+1,'FF2E75B6');
      [['Itens Ativos',summary.itemsActive],['Itens Desativados',summary.itemsDisabled],['Triggers Ativas',summary.triggersActive],['Triggers Desativadas',summary.triggersDisabled],['Alertas Ativos Agora',summary.activeAlerts]].forEach((row,i)=>{const r=ws1.addRow(row);r.height=16;styleDataRow(r,i%2===1,row);r.getCell(1).font=hFont(BLACK,true,10);if(row[0]==='Alertas Ativos Agora'&&summary.activeAlerts>0){r.getCell(2).fill=hFill(LRED);r.getCell(2).font=hFont(RED,true,10);}});

      const ws2=wb.addWorksheet(`${sheetName} - Alertas`);
      ws2.columns=[{width:14},{width:55},{width:22}];
      addTitleRow(ws2,`Alertas — ${host.name}`,3);
      addSubtitle(ws2,`${alerts.length} alerta(s)`,3);
      ws2.addRow([]);
      addTableHeader(ws2,['Severidade','Descrição','Desde'],4);
      if(alerts.length===0){const r=ws2.addRow(['✓ Nenhum alerta','','']);ws2.mergeCells(`A5:C5`);r.getCell(1).fill=hFill(LGREEN);r.getCell(1).font=hFont(GREEN,true,10);r.getCell(1).alignment={horizontal:'center',vertical:'middle'};}
      else{alerts.forEach((a,i)=>{const [bg,fg]=SEV_COLOR[a.priority]||[GRAY,BLACK];const since=a.lastchange&&parseInt(a.lastchange)>0?new Date(parseInt(a.lastchange)*1000).toLocaleString('pt-BR'):'—';const r=ws2.addRow([SEV_MAP[a.priority]||'—',a.description,since]);r.height=16;styleDataRow(r,i%2===1,[SEV_MAP[a.priority]||'—',a.description,since]);r.getCell(1).fill=hFill(bg);r.getCell(1).font=hFont(fg,true,10);r.getCell(1).alignment={horizontal:'center',vertical:'middle'};});}

      const ws3=wb.addWorksheet(`${sheetName} - Itens`);
      ws3.columns=[{width:42},{width:38},{width:12},{width:18},{width:14},{width:40}];
      addTitleRow(ws3,`Itens — ${host.name}`,6);
      addSubtitle(ws3,`${items.length} itens`,6);
      ws3.addRow([]);
      addTableHeader(ws3,['Nome','Chave','Status','Tipo','Intervalo','Detalhes'],4);
      items.forEach((item,i)=>{const vals=[item.name,item.key_,item.status==='0'?'Ativo':'Desativado',item.typeLabel,item.delayFormatted,item.params||item.description||'—'];const r=ws3.addRow(vals);r.height=16;styleDataRow(r,i%2===1,vals);r.getCell(3).fill=hFill(item.status==='0'?LGREEN:GRAY);r.getCell(3).font=hFont(item.status==='0'?GREEN:'FF666666',true,10);r.getCell(3).alignment={horizontal:'center',vertical:'middle'};});

      const ws4=wb.addWorksheet(`${sheetName} - Triggers`);
      ws4.columns=[{width:50},{width:14},{width:14},{width:22}];
      addTitleRow(ws4,`Triggers — ${host.name}`,4);
      addSubtitle(ws4,`${triggers.length} triggers`,4);
      ws4.addRow([]);
      addTableHeader(ws4,['Descrição','Severidade','Status','Última Mudança'],4);
      triggers.forEach((t,i)=>{const [bg,fg]=SEV_COLOR[t.priority]||[GRAY,BLACK];const since=t.lastchange&&parseInt(t.lastchange)>0?new Date(parseInt(t.lastchange)*1000).toLocaleString('pt-BR'):'—';const vals=[t.description,SEV_MAP[t.priority]||'—',t.status==='0'?'Ativa':'Desabilitada',since];const r=ws4.addRow(vals);r.height=16;styleDataRow(r,i%2===1,vals);r.getCell(2).fill=hFill(bg);r.getCell(2).font=hFont(fg,true,10);r.getCell(2).alignment={horizontal:'center',vertical:'middle'};r.getCell(3).fill=hFill(t.status==='0'?LGREEN:GRAY);r.getCell(3).font=hFont(t.status==='0'?GREEN:'FF666666',true,10);r.getCell(3).alignment={horizontal:'center',vertical:'middle'};});

      const ws5=wb.addWorksheet(`${sheetName} - Templates`);
      ws5.columns=[{width:50}];
      addTitleRow(ws5,`Templates — ${host.name}`,1);
      ws5.addRow([]);
      addTableHeader(ws5,['Nome do Template'],3,'FF2E75B6');
      if(!host.parentTemplates?.length){ws5.addRow(['Nenhum template vinculado']);}
      else{host.parentTemplates.forEach((t,i)=>{const r=ws5.addRow([t.name]);r.height=16;r.getCell(1).fill=hFill(i%2===0?WHITE:GRAY);r.getCell(1).font=hFont(BLACK,false,10);r.getCell(1).border=hBorder();});}
    }

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="saude_multiplos_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(err){console.error('Excel multi error:',err.message);res.status(500).json({error:err.message});}
});

router.get('/triggers/active', authMiddleware, async (req, res) => {
  try {
    const severity = req.query.severity ? parseInt(req.query.severity) : null;
    res.json(await zabbix.getTriggersActive(getGroupIds(req), severity));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/triggers', authMiddleware, async (req, res) => {
  try {
    const groupIds     = getGroupIds(req);
    const tplIds       = getTemplateIds(req);
    const hostTriggers = await zabbix.getAllTriggers(groupIds);

    // Para admin (tplIds === null), busca todos os templates
    // Para usuário com área, busca só os templates da área
    const allTemplates = await zabbix.getTemplates();
    const idsToFetch   = tplIds === null
      ? allTemplates.map(t => t.templateid)
      : tplIds;

    if (!idsToFetch || idsToFetch.length === 0) return res.json(hostTriggers);

    const tplResults  = await Promise.all(idsToFetch.map(id => zabbix.getTemplateTriggers(id).catch(() => [])));
    const tplTriggers = tplResults.flat().map(t => ({
      ...t,
      hosts: [{ name: allTemplates.find(tpl => tpl.templateid === t.templateid)?.name || 'Template', host: 'template' }],
    }));

    const seen = new Set(hostTriggers.map(t => t.triggerid));
    const result = [...hostTriggers, ...tplTriggers.filter(t => !seen.has(t.triggerid))];

    if (req.query.format === 'csv') {
      const SEV = {'5':'DISASTER','4':'HIGH','3':'AVERAGE','2':'WARNING','1':'INFORMATION','0':'N/C'};
      const header = 'Host;Trigger;Severidade;Status';
      const rows = result.map(t => [
        t.hosts?.map(h => h.name).join(', ') || '—',
        t.description,
        SEV[t.priority] || t.priority,
        t.status === '0' ? 'Ativa' : 'Desabilitada',
      ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(';'));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="triggers.csv"');
      return res.send('\uFEFF' + [header, ...rows].join('\n'));
    }

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


router.get('/items', authMiddleware, async (req, res) => {
  try {
    const groupIds  = getGroupIds(req);
    const tplIds    = getTemplateIds(req);
    const hostItems = await zabbix.getItems(groupIds, req.query.search || '');

    if (!tplIds || tplIds.length === 0) return res.json(hostItems);

    const allTemplates = await zabbix.getTemplates();
    const tplResults   = await Promise.all(tplIds.map(id => zabbix.getTemplateItems(id).catch(() => [])));
    const tplItems     = tplResults.flat().map(item => ({
      ...item,
      hosts: [{ name: allTemplates.find(t => t.templateid === item.templateid)?.name || 'Template', host: 'template' }],
    }));

    const seen = new Set(hostItems.map(i => i.itemid));
    res.json([...hostItems, ...tplItems.filter(i => !seen.has(i.itemid))]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/items/queries', authMiddleware, async (req, res) => {
  try {
    const items = await zabbix.getItems(getGroupIds(req));
    res.json(items.filter(i => i.isQuery));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/audit', authMiddleware, (req, res, next) => {
  if (!['admin','manager'].includes(req.user.role)) return res.status(403).json({ error: 'Acesso negado' });
  next();
}, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const now = Math.floor(Date.now() / 1000);
    const periods = {
      '5m':300,'15m':900,'30m':1800,'1h':3600,'3h':10800,'6h':21600,
      '12h':43200,'1d':86400,'2d':172800,'7d':604800,'30d':2592000,
      '60d':5184000,'1y':31536000,
    };
    let timeFrom, timeTill;
    if (from && to) {
      timeFrom = Math.floor(new Date(from).getTime() / 1000);
      timeTill = Math.floor(new Date(to).getTime() / 1000);
    } else {
      const seconds = periods[period] || 86400;
      timeFrom = now - seconds;
      timeTill = now;
    }
    res.json(await zabbix.getAuditLogEnriched(timeFrom, timeTill));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/hostgroups', authMiddleware, adminOnly, async (req, res) => {
  try { res.json(await zabbix.getHostGroups()); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.get('/host/:id/trends', authMiddleware, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    res.json(await zabbix.getHostTrends(req.params.id, period || '1d', from, to));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Excel individual de template
router.get('/template/:id/excel', authMiddleware, async (req, res) => {
  try {
    const [items, triggers] = await Promise.all([
      zabbix.getTemplateItems(req.params.id),
      zabbix.getTemplateTriggers(req.params.id),
    ]);
    const templates = await zabbix.getTemplates();
    const tpl = templates.find(t => t.templateid === req.params.id) || { name: req.params.id, host: req.params.id };

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Portal de Monitoração';

    const BLUE='FF1F4E79',LBLUE='FFD6E4F0',WHITE='FFFFFFFF',GRAY='FFF2F2F2';
    const GREEN='FF375623',LGREEN='FFE2EFDA',RED='FF9C0006',LRED='FFFFC7CE';
    const ORANGE='FF833C00',LORANGE='FFFFEB9C',BLACK='FF000000';
    const SEV_MAP={'5':'DISASTER','4':'HIGH','3':'AVERAGE','2':'WARNING','1':'INFORMATION','0':'N/C'};
    const SEV_COLOR={'5':[LRED,RED],'4':[LORANGE,ORANGE],'3':['FFFFF2CC','FF7F6000'],'2':[LBLUE,BLUE],'1':[GRAY,BLACK]};

    const hFill=a=>({type:'pattern',pattern:'solid',fgColor:{argb:a}});
    const hFont=(a,b=false,s=10)=>({name:'Arial',color:{argb:a},bold:b,size:s});
    const hBorder=()=>{const s={style:'thin',color:{argb:'FFD0D0D0'}};return{top:s,left:s,bottom:s,right:s};};

    function addTitleRow(ws,text,cols){
      ws.mergeCells(`A1:${String.fromCharCode(64+cols)}1`);
      const r=ws.getRow(1);r.height=28;
      const c=r.getCell(1);c.value=text;
      c.fill=hFill(BLUE);c.font=hFont(WHITE,true,13);
      c.alignment={horizontal:'left',vertical:'middle',indent:1};
    }
    function addSubtitle(ws,text,cols,row=2){
      ws.mergeCells(`A${row}:${String.fromCharCode(64+cols)}${row}`);
      const r=ws.getRow(row);r.height=16;
      const c=r.getCell(1);c.value=text;
      c.fill=hFill(LBLUE);c.font=hFont(BLUE,false,9);
      c.alignment={horizontal:'left',vertical:'middle',indent:1};
    }
    function addTableHeader(ws,headers,rowNum,fillArgb=BLUE){
      const r=ws.getRow(rowNum);r.height=18;
      headers.forEach((h,i)=>{
        const c=r.getCell(i+1);c.value=h;
        c.fill=hFill(fillArgb);c.font=hFont(WHITE,true,10);
        c.alignment={horizontal:'center',vertical:'middle',wrapText:true};
        c.border=hBorder();
      });
    }
    function styleDataRow(r,alt,vals){
      vals.forEach((val,i)=>{
        const c=r.getCell(i+1);c.value=val??'—';
        c.fill=hFill(alt?GRAY:WHITE);c.font=hFont(BLACK,false,10);
        c.alignment={vertical:'middle',wrapText:true};c.border=hBorder();
      });
    }

    // Aba Resumo
    const ws1=wb.addWorksheet('Resumo');
    ws1.columns=[{width:28},{width:30}];
    addTitleRow(ws1,`Template — ${tpl.name}`,2);
    addSubtitle(ws1,`Gerado em ${new Date().toLocaleString('pt-BR')}`,2);
    ws1.addRow([]);
    addTableHeader(ws1,['Campo','Valor'],4,'FF2E75B6');
    [['Template',tpl.name],['Total de Itens',items.length],['Itens Ativos',items.filter(i=>i.status==='0').length],['Itens Desativados',items.filter(i=>i.status==='1').length],['Total de Triggers',triggers.length],['Triggers Ativas',triggers.filter(t=>t.status==='0').length],['Triggers Desabilitadas',triggers.filter(t=>t.status==='1').length]].forEach((row,i)=>{
      const r=ws1.addRow(row);r.height=16;styleDataRow(r,i%2===1,row);r.getCell(1).font=hFont(BLACK,true,10);
    });

    // Aba Itens
    const ws2=wb.addWorksheet('Itens');
    ws2.columns=[{width:42},{width:38},{width:12},{width:18},{width:14},{width:40}];
    addTitleRow(ws2,`Itens — ${tpl.name}`,6);
    addSubtitle(ws2,`${items.length} itens · ${items.filter(i=>i.status==='0').length} ativos · ${items.filter(i=>i.status==='1').length} desativados`,6);
    ws2.addRow([]);
    addTableHeader(ws2,['Nome','Chave','Status','Tipo','Intervalo','Detalhes'],4);
    items.forEach((item,i)=>{
      const vals=[item.name,item.key_,item.status==='0'?'Ativo':'Desativado',item.typeLabel,item.delayFormatted,item.params||item.description||'—'];
      const r=ws2.addRow(vals);r.height=16;styleDataRow(r,i%2===1,vals);
      r.getCell(3).fill=hFill(item.status==='0'?LGREEN:GRAY);
      r.getCell(3).font=hFont(item.status==='0'?GREEN:'FF666666',true,10);
      r.getCell(3).alignment={horizontal:'center',vertical:'middle'};
    });

    // Aba Triggers
    const ws3=wb.addWorksheet('Triggers');
    ws3.columns=[{width:50},{width:14},{width:14},{width:14}];
    addTitleRow(ws3,`Triggers — ${tpl.name}`,4);
    addSubtitle(ws3,`${triggers.length} triggers · ${triggers.filter(t=>t.status==='0').length} ativas · ${triggers.filter(t=>t.status==='1').length} desabilitadas`,4);
    ws3.addRow([]);
    addTableHeader(ws3,['Descrição','Severidade','Status','Comentários'],4);
    triggers.forEach((t,i)=>{
      const [bg,fg]=SEV_COLOR[t.priority]||[GRAY,BLACK];
      const vals=[t.description,SEV_MAP[t.priority]||'—',t.status==='0'?'Ativa':'Desabilitada',t.comments||'—'];
      const r=ws3.addRow(vals);r.height=16;styleDataRow(r,i%2===1,vals);
      r.getCell(2).fill=hFill(bg);r.getCell(2).font=hFont(fg,true,10);r.getCell(2).alignment={horizontal:'center',vertical:'middle'};
      r.getCell(3).fill=hFill(t.status==='0'?LGREEN:GRAY);r.getCell(3).font=hFont(t.status==='0'?GREEN:'FF666666',true,10);r.getCell(3).alignment={horizontal:'center',vertical:'middle'};
    });

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="template_${tpl.host}_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(err){console.error('Template Excel error:',err.message);res.status(500).json({error:err.message});}
});

// Excel múltiplos templates
router.post('/templates/excel', authMiddleware, async (req, res) => {
  try {
    const { templateIds } = req.body;
    if (!templateIds?.length) return res.status(400).json({ error: 'Nenhum template selecionado' });

    const allTemplates = await zabbix.getTemplates();
    const data = await Promise.all(templateIds.map(async id => {
      const tpl = allTemplates.find(t => t.templateid === id) || { name: id, host: id };
      const [items, triggers] = await Promise.all([zabbix.getTemplateItems(id), zabbix.getTemplateTriggers(id)]);
      return { tpl, items, triggers };
    }));

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Portal de Monitoração';

    const BLUE='FF1F4E79',LBLUE='FFD6E4F0',WHITE='FFFFFFFF',GRAY='FFF2F2F2';
    const GREEN='FF375623',LGREEN='FFE2EFDA',BLACK='FF000000';
    const ORANGE='FF833C00',LORANGE='FFFFEB9C',RED='FF9C0006',LRED='FFFFC7CE';
    const SEV_MAP={'5':'DISASTER','4':'HIGH','3':'AVERAGE','2':'WARNING','1':'INFORMATION','0':'N/C'};
    const SEV_COLOR={'5':[LRED,RED],'4':[LORANGE,ORANGE],'3':['FFFFF2CC','FF7F6000'],'2':[LBLUE,BLUE],'1':[GRAY,BLACK]};

    const hFill=a=>({type:'pattern',pattern:'solid',fgColor:{argb:a}});
    const hFont=(a,b=false,s=10)=>({name:'Arial',color:{argb:a},bold:b,size:s});
    const hBorder=()=>{const s={style:'thin',color:{argb:'FFD0D0D0'}};return{top:s,left:s,bottom:s,right:s};};
    function addTitleRow(ws,text,cols){ws.mergeCells(`A1:${String.fromCharCode(64+cols)}1`);const r=ws.getRow(1);r.height=28;const c=r.getCell(1);c.value=text;c.fill=hFill(BLUE);c.font=hFont(WHITE,true,13);c.alignment={horizontal:'left',vertical:'middle',indent:1};}
    function addSubtitle(ws,text,cols,row=2){ws.mergeCells(`A${row}:${String.fromCharCode(64+cols)}${row}`);const r=ws.getRow(row);r.height=16;const c=r.getCell(1);c.value=text;c.fill=hFill(LBLUE);c.font=hFont(BLUE,false,9);c.alignment={horizontal:'left',vertical:'middle',indent:1};}
    function addTableHeader(ws,headers,rowNum,fillArgb=BLUE){const r=ws.getRow(rowNum);r.height=18;headers.forEach((h,i)=>{const c=r.getCell(i+1);c.value=h;c.fill=hFill(fillArgb);c.font=hFont(WHITE,true,10);c.alignment={horizontal:'center',vertical:'middle',wrapText:true};c.border=hBorder();});}
    function styleDataRow(r,alt,vals){vals.forEach((val,i)=>{const c=r.getCell(i+1);c.value=val??'—';c.fill=hFill(alt?GRAY:WHITE);c.font=hFont(BLACK,false,10);c.alignment={vertical:'middle',wrapText:true};c.border=hBorder();});}

    // Aba consolidada
    const wsRes=wb.addWorksheet('Resumo Consolidado');
    wsRes.columns=[{width:35},{width:14},{width:14},{width:14},{width:14}];
    addTitleRow(wsRes,`Templates Consolidado — ${data.length} templates`,5);
    addSubtitle(wsRes,`Gerado em ${new Date().toLocaleString('pt-BR')}`,5);
    wsRes.addRow([]);
    addTableHeader(wsRes,['Template','Itens Ativos','Itens Desativ.','Triggers Ativas','Triggers Desab.'],4,'FF2E75B6');
    data.forEach(({tpl,items,triggers},i)=>{
      const r=wsRes.addRow([tpl.name,items.filter(x=>x.status==='0').length,items.filter(x=>x.status==='1').length,triggers.filter(x=>x.status==='0').length,triggers.filter(x=>x.status==='1').length]);
      r.height=16;
      styleDataRow(r,i%2===1,[tpl.name,items.filter(x=>x.status==='0').length,items.filter(x=>x.status==='1').length,triggers.filter(x=>x.status==='0').length,triggers.filter(x=>x.status==='1').length]);
      r.getCell(1).font=hFont(BLACK,true,10);
      [2,3,4,5].forEach(n=>r.getCell(n).alignment={horizontal:'center',vertical:'middle'});
    });

    // Uma aba de itens e uma de triggers por template
    for(const {tpl,items,triggers} of data){
      const sheetName=tpl.name.slice(0,25);

      const wsI=wb.addWorksheet(`${sheetName} - Itens`);
      wsI.columns=[{width:42},{width:38},{width:12},{width:18},{width:14},{width:40}];
      addTitleRow(wsI,`Itens — ${tpl.name}`,6);
      addSubtitle(wsI,`${items.length} itens · ${items.filter(i=>i.status==='0').length} ativos · ${items.filter(i=>i.status==='1').length} desativados`,6);
      wsI.addRow([]);
      addTableHeader(wsI,['Nome','Chave','Status','Tipo','Intervalo','Detalhes'],4);
      items.forEach((item,i)=>{
        const vals=[item.name,item.key_,item.status==='0'?'Ativo':'Desativado',item.typeLabel,item.delayFormatted,item.params||item.description||'—'];
        const r=wsI.addRow(vals);r.height=16;styleDataRow(r,i%2===1,vals);
        r.getCell(3).fill=hFill(item.status==='0'?LGREEN:GRAY);r.getCell(3).font=hFont(item.status==='0'?GREEN:'FF666666',true,10);r.getCell(3).alignment={horizontal:'center',vertical:'middle'};
      });

      const wsT=wb.addWorksheet(`${sheetName} - Triggers`);
      wsT.columns=[{width:50},{width:14},{width:14},{width:14}];
      addTitleRow(wsT,`Triggers — ${tpl.name}`,4);
      addSubtitle(wsT,`${triggers.length} triggers · ${triggers.filter(t=>t.status==='0').length} ativas · ${triggers.filter(t=>t.status==='1').length} desabilitadas`,4);
      wsT.addRow([]);
      addTableHeader(wsT,['Descrição','Severidade','Status','Comentários'],4);
      triggers.forEach((t,i)=>{
        const [bg,fg]=SEV_COLOR[t.priority]||[GRAY,BLACK];
        const vals=[t.description,SEV_MAP[t.priority]||'—',t.status==='0'?'Ativa':'Desabilitada',t.comments||'—'];
        const r=wsT.addRow(vals);r.height=16;styleDataRow(r,i%2===1,vals);
        r.getCell(2).fill=hFill(bg);r.getCell(2).font=hFont(fg,true,10);r.getCell(2).alignment={horizontal:'center',vertical:'middle'};
        r.getCell(3).fill=hFill(t.status==='0'?LGREEN:GRAY);r.getCell(3).font=hFont(t.status==='0'?GREEN:'FF666666',true,10);r.getCell(3).alignment={horizontal:'center',vertical:'middle'};
      });
    }

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="templates_${new Date().toISOString().slice(0,10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(err){console.error('Templates Excel error:',err.message);res.status(500).json({error:err.message});}
});
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const { period, from, to } = req.query;
    const groupIds = getGroupIds(req);
    const now = Math.floor(Date.now() / 1000);
    const periods = {
      '5m': 300, '15m': 900, '30m': 1800, '1h': 3600,
      '3h': 10800, '6h': 21600, '12h': 43200, '1d': 86400,
      '2d': 172800, '7d': 604800, '30d': 2592000,
      '60d': 5184000, '1y': 31536000,
    };
    let timeFrom, timeTill;
    if (from && to) {
      timeFrom = Math.floor(new Date(from).getTime() / 1000);
      timeTill = Math.floor(new Date(to).getTime() / 1000);
    } else {
      const seconds = periods[period] || 3600;
      timeFrom = now - seconds;
      timeTill = now;
    }
    const params = {
      output: ['eventid', 'clock', 'value', 'severity', 'name'],
      selectHosts: ['host', 'name'],
      selectRelatedObject: ['description', 'priority'],
      source: 0, object: 0, value: 1,
      time_from: timeFrom, time_till: timeTill,
      sortfield: 'clock', sortorder: 'DESC',
      limit: 500,
    };
    if (groupIds && groupIds.length > 0) params.groupids = groupIds;
    const events = await zabbix.call('event.get', params, false);
    res.json(events);
  } catch (err) { res.status(500).json({ error: err.message }); }
});



router.get('/maintenances', authMiddleware, async (req, res) => {
  try {
    applyAreaConnection(req);
    const groupIds = getGroupIds(req);
    const params = {
      output: ['maintenanceid', 'name', 'description', 'active_since', 'active_till', 'maintenance_type'],
      selectHosts: ['hostid', 'host', 'name'],
      selectGroups: ['groupid', 'name'],
      selectTimeperiods: 'extend',
      sortfield: 'name',
    };
    if (groupIds && groupIds.length > 0) params.groupids = groupIds;
    const maintenances = await zabbix.call('maintenance.get', params, false);
    res.json(maintenances);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;