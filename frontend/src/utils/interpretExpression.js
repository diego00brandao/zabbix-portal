// Função para interpretar expressões de triggers do Zabbix em português
export function interpretExpression(expression) {
  if (!expression) return null;
  const e = expression;

  // Extrai função, chave e threshold
  // Formato: func(/host/key[params],window)>threshold
  const mainMatch = e.match(/(\w+)\(\/[^/]+\/([^,)\]]+(?:\[[^\]]*\])?)[^)]*\)\s*([><=!]+)\s*([\d.]+)/);

  function timeLabel(window) {
    if (!window) return null;
    const m = window.match(/(\d+)([smhd])/i);
    if (!m) return null;
    const n = parseInt(m[1]);
    const u = m[2].toLowerCase();
    if (u === 's') return n === 1 ? '1 segundo' : `${n} segundos`;
    if (u === 'm') return n === 1 ? '1 minuto' : `${n} minutos`;
    if (u === 'h') return n === 1 ? '1 hora' : `${n} horas`;
    if (u === 'd') return n === 1 ? '1 dia' : `${n} dias`;
    return null;
  }

  function opLabel(op, val, unit = '') {
    if (op === '>') return `acima de ${val}${unit}`;
    if (op === '>=') return `igual ou acima de ${val}${unit}`;
    if (op === '<') return `abaixo de ${val}${unit}`;
    if (op === '<=') return `igual ou abaixo de ${val}${unit}`;
    if (op === '=') return `igual a ${val}${unit}`;
    if (op === '<>' || op === '!=') return `diferente de ${val}${unit}`;
    return `${op} ${val}${unit}`;
  }

  function funcLabel(fn, window) {
    const t = timeLabel(window);
    if (fn === 'min') return t ? `mínimo em ${t}` : 'mínimo';
    if (fn === 'max') return t ? `máximo em ${t}` : 'máximo';
    if (fn === 'avg') return t ? `média em ${t}` : 'média';
    if (fn === 'last') return 'valor atual';
    if (fn === 'sum') return t ? `soma em ${t}` : 'soma';
    if (fn === 'count') return t ? `contagem em ${t}` : 'contagem';
    if (fn === 'change') return 'variação';
    if (fn === 'diff') return 'diferença';
    if (fn === 'abschange') return 'variação absoluta';
    return fn;
  }

  // nodata
  if (/nodata\s*\(/i.test(e)) {
    const m = e.match(/nodata\([^,]+,\s*(\d+[smhd])/i);
    const t = m ? timeLabel(m[1]) : null;
    return t ? `Sem dados do agente há ${t}` : 'Sem dados do agente';
  }

  // agent.ping / icmp
  if (/agent\.ping|icmp\.ping/i.test(e)) {
    if (/>0|=1/.test(e)) return 'Host sem resposta ao ping';
    if (/=0|<1/.test(e)) return 'Host respondendo ao ping';
    return 'Verificação de conectividade';
  }

  // agent not available
  if (/agent\.available|not available/i.test(e)) return 'Agente Zabbix indisponível';

  // CPU
  if (/system\.cpu\.util|cpu\.util/i.test(e)) {
    if (mainMatch) {
      const [, fn, , op, val] = mainMatch;
      const window = e.match(/,(\d+[smhd])\)/i)?.[1];
      return `CPU: ${funcLabel(fn, window)} ${opLabel(op, val, '%')}`;
    }
    return 'Utilização de CPU elevada';
  }

  // Memória
  if (/vm\.memory\.util|memory\.util/i.test(e)) {
    if (mainMatch) {
      const [, fn, , op, val] = mainMatch;
      const window = e.match(/,(\d+[smhd])\)/i)?.[1];
      return `Memória: ${funcLabel(fn, window)} ${opLabel(op, val, '%')}`;
    }
    return 'Utilização de memória elevada';
  }

  // Disco - uso percentual
  if (/vfs\.fs\.(size|dependent\.size).*pused|fs\.pused/i.test(e)) {
    const disk = e.match(/vfs\.fs\.\w+\[([^\],]+)/i)?.[1] || '';
    if (mainMatch) {
      const [, fn, , op, val] = mainMatch;
      const window = e.match(/,(\d+[smhd])\)/i)?.[1];
      return `Disco${disk ? ` ${disk}` : ''}: ${funcLabel(fn, window)} ${opLabel(op, val, '%')}`;
    }
    return 'Uso de disco elevado';
  }

  // Disco - espaço livre
  if (/vfs\.fs\.size.*free/i.test(e)) {
    const disk = e.match(/vfs\.fs\.size\[([^\],]+)/i)?.[1] || '';
    return `Disco${disk ? ` ${disk}` : ''}: pouco espaço livre`;
  }

  // Rede - tráfego
  if (/net\.if\.(in|out)/i.test(e)) {
    const iface = e.match(/net\.if\.\w+\[([^\],]+)/i)?.[1] || '';
    const dir = /net\.if\.in/i.test(e) ? 'entrada' : 'saída';
    if (mainMatch) {
      const [, fn, , op, val] = mainMatch;
      const window = e.match(/,(\d+[smhd])\)/i)?.[1];
      return `Tráfego de rede ${dir}${iface ? ` (${iface})` : ''}: ${funcLabel(fn, window)} ${opLabel(op, val, ' bps')}`;
    }
    return `Tráfego de rede ${dir} elevado`;
  }

  // Rede - erros
  if (/net\.if\.errors|if\.error/i.test(e)) return 'Erros na interface de rede';

  // Processo
  if (/proc\.num/i.test(e)) {
    const proc = e.match(/proc\.num\[([^\]]+)/i)?.[1] || '';
    if (mainMatch) {
      const [, , , op, val] = mainMatch;
      return `Processo${proc ? ` "${proc}"` : ''}: número de instâncias ${opLabel(op, val)}`;
    }
    return 'Número de processos fora do esperado';
  }

  // Serviço Windows
  if (/service\.state|service_state/i.test(e)) {
    const svc = e.match(/service\.state\[([^\]]+)/i)?.[1] || '';
    return `Serviço${svc ? ` "${svc}"` : ''} parado ou com problema`;
  }

  // Log / Event log
  if (/eventlog\[|log\[/i.test(e)) return 'Evento crítico no log do sistema';

  // SNMP / trap
  if (/snmptrap|snmp\.trap/i.test(e)) return 'SNMP trap recebido';

  // SSH / Telnet
  if (/net\.tcp\.service\[ssh/i.test(e)) return 'Serviço SSH indisponível';
  if (/net\.tcp\.service\[telnet/i.test(e)) return 'Serviço Telnet indisponível';
  if (/net\.tcp\.service\[http/i.test(e)) return 'Serviço HTTP indisponível';
  if (/net\.tcp\.service\[https/i.test(e)) return 'Serviço HTTPS indisponível';
  if (/net\.tcp\.service\[ftp/i.test(e)) return 'Serviço FTP indisponível';
  if (/net\.tcp\.service/i.test(e)) {
    const svc = e.match(/net\.tcp\.service\[([^\],]+)/i)?.[1] || '';
    return `Serviço${svc ? ` ${svc.toUpperCase()}` : ''} indisponível`;
  }

  // Porta TCP
  if (/net\.tcp\.port/i.test(e)) {
    const port = e.match(/net\.tcp\.port\[,(\d+)/i)?.[1] || '';
    return `Porta TCP${port ? ` ${port}` : ''} indisponível`;
  }

  // MSSQL / DB específicos
  if (/db\.odbc|mssql|odbc/i.test(e)) {
    if (/backup/i.test(e)) return 'Falha ou atraso no backup do banco de dados';
    if (/job.*fail|fail.*job/i.test(e)) return 'Job do banco de dados com falha';
    if (/replication|replica/i.test(e)) return 'Problema na replicação do banco de dados';
    if (/identity/i.test(e)) return 'Identity quase esgotada no banco de dados';
    if (/log.*full|log.*util/i.test(e)) return 'Log do banco de dados quase cheio';
    if (/connect|port.*unavail/i.test(e)) return 'Conexão com banco de dados indisponível';
    if (/cpu/i.test(e)) return 'CPU do banco de dados elevada';
    if (/memory|mem/i.test(e)) return 'Memória do banco de dados elevada';
    if (/deadlock/i.test(e)) return 'Deadlock detectado no banco de dados';
    if (/blocking/i.test(e)) return 'Bloqueio de sessão no banco de dados';
    if (/avail.*group|ag\./i.test(e)) return 'Problema no Availability Group';
    if (mainMatch) {
      const [, , , op, val] = mainMatch;
      return `Banco de dados: valor ${opLabel(op, val)}`;
    }
    return 'Problema no banco de dados';
  }

  // Swap
  if (/system\.swap/i.test(e)) {
    if (mainMatch) {
      const [, fn, , op, val] = mainMatch;
      const window = e.match(/,(\d+[smhd])\)/i)?.[1];
      return `Swap: ${funcLabel(fn, window)} ${opLabel(op, val, '%')}`;
    }
    return 'Uso de swap elevado';
  }

  // Load average
  if (/system\.cpu\.load/i.test(e)) {
    if (mainMatch) {
      const [, fn, , op, val] = mainMatch;
      const window = e.match(/,(\d+[smhd])\)/i)?.[1];
      return `Load average: ${funcLabel(fn, window)} ${opLabel(op, val)}`;
    }
    return 'Load average elevado';
  }

  // Uptime / reboot
  if (/system\.uptime/i.test(e)) {
    if (/<\s*\d/.test(e)) return 'Sistema reiniciado recentemente';
    return 'Uptime do sistema anômalo';
  }

  // Temperature
  if (/temp|temperature/i.test(e)) {
    if (mainMatch) {
      const [, , , op, val] = mainMatch;
      return `Temperatura ${opLabel(op, val, '°C')}`;
    }
    return 'Temperatura elevada';
  }

  // Fan / Power
  if (/fan\.speed/i.test(e)) return 'Velocidade do fan anômala';
  if (/power\.supply/i.test(e)) return 'Problema na fonte de alimentação';

  // Zabbix server interno
  if (/zabbix\[/i.test(e)) {
    if (/queue/i.test(e)) return 'Fila do Zabbix server acumulada';
    if (/cache/i.test(e)) return 'Cache do Zabbix server com problema';
    if (/process/i.test(e)) return 'Processo interno do Zabbix com alta utilização';
    return 'Problema interno no Zabbix server';
  }

  // Genérico com threshold
  if (mainMatch) {
    const [, fn, key, op, val] = mainMatch;
    const window = e.match(/,(\d+[smhd])\)/i)?.[1];
    const keyClean = key.split('[')[0].replace(/\./g, ' ').replace(/_/g, ' ');
    return `${keyClean}: ${funcLabel(fn, window)} ${opLabel(op, val)}`;
  }

  return null;
}
