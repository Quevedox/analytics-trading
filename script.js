const STORAGE_KEY = 'tj_trades_v1';
let trades = [];
let parsedPreview = [];

try{
  const raw = localStorage.getItem(STORAGE_KEY);
  trades = raw ? JSON.parse(raw) : [];
}catch(e){ trades = []; }

function save(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(trades)); }catch(e){}
}

// tabs
document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab==='analisis') renderAnalysis();
  });
});

// win/loss toggle

// default date = today
document.getElementById('f-date').value = new Date().toISOString().slice(0,10);

document.getElementById('add-trade').addEventListener('click', ()=>{
  const date = document.getElementById('f-date').value;
  if(!date){ alert('Poné una fecha.'); return; }
  const symbol = document.getElementById('f-symbol').value.trim() || '-';
  const lots = document.getElementById('f-lots').value;
  const grossProfit = parseFloat(document.getElementById('f-profit').value) || 0;
  const commission = Math.abs(parseFloat(document.getElementById('f-commission').value) || 0);
  const profit = grossProfit - commission; // P/L neto = bruto - comisión
  const notes = document.getElementById('f-notes').value.trim();
  const closeReason = document.getElementById('f-close').value;
  trades.push({date, symbol, lots, profit, commission, result: profit>=0?'win':'loss', notes, closeReason});
  save();
  document.getElementById('f-symbol').value='';
  document.getElementById('f-lots').value='';
  document.getElementById('f-profit').value='';
  document.getElementById('f-commission').value='';
  document.getElementById('f-notes').value='';
  document.getElementById('f-close').value='na';
  renderTrades();
});

function closeLabel(cr){
  if(cr==='tp') return 'TP';
  if(cr==='sl') return 'SL';
  if(cr==='manual') return 'Manual';
  return '-';
}

document.getElementById('clear-all').addEventListener('click', ()=>{
  document.getElementById('reset-overlay').style.display='flex';
});
document.getElementById('reset-cancel').addEventListener('click', ()=>{
  document.getElementById('reset-overlay').style.display='none';
});
document.getElementById('reset-confirm').addEventListener('click', ()=>{
  trades = []; save(); renderTrades();
  document.getElementById('reset-overlay').style.display='none';
});

function dayName(dateStr){
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const d = new Date(dateStr+'T00:00:00');
  if(isNaN(d)) return '-';
  return days[d.getDay()];
}

function renderTrades(){
  const tbody = document.querySelector('#trades-table tbody');
  tbody.innerHTML='';
  const sorted = [...trades].sort((a,b)=> new Date(b.date)-new Date(a.date));
  sorted.forEach((t)=>{
    const idx = trades.indexOf(t);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.date}</td><td>${dayName(t.date)}</td><td>${t.symbol}</td><td>${t.lots||'-'}</td>
      <td><span class="pill ${t.result}">${t.result==='win'?'Ganador':'Perdedor'}</span></td>
      <td>${closeLabel(t.closeReason)}</td>
      <td class="neg">${t.commission? '-'+Math.abs(t.commission).toFixed(2) : '0.00'}</td>
      <td class="${t.profit>=0?'pos':'neg'}">${t.profit>=0?'+':''}${t.profit.toFixed(2)}</td>
      <td>${t.notes||''}</td>
      <td><button class="del" data-idx="${idx}">✕</button></td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('empty-msg').style.display = trades.length? 'none':'block';
  document.querySelectorAll('.del').forEach(b=>{
    b.addEventListener('click', ()=>{
      trades.splice(parseInt(b.dataset.idx),1);
      save(); renderTrades();
    });
  });
}

function renderAnalysis(){
  const statsEl = document.getElementById('stats-cards');
  const dayEl = document.getElementById('day-analysis');
  const conclEl = document.getElementById('conclusions');
  if(trades.length===0){
    statsEl.innerHTML='';
    dayEl.innerHTML='<div class="empty">Cargá operaciones para ver el análisis.</div>';
    conclEl.innerHTML='';
    return;
  }
  const total = trades.length;
  const wins = trades.filter(t=>t.result==='win').length;
  const losses = total-wins;
  const winRate = ((wins/total)*100).toFixed(1);
  const netProfit = trades.reduce((s,t)=>s+t.profit,0);
  const tpCount = trades.filter(t=>t.result==='win' && t.closeReason==='tp').length;
  const slCount = trades.filter(t=>t.result==='loss' && t.closeReason==='sl').length;
  const tpPct = wins? ((tpCount/wins)*100).toFixed(0) : 0;
  const slPct = losses? ((slCount/losses)*100).toFixed(0) : 0;

  statsEl.innerHTML = `
    <div class="stat"><div class="n">${total}</div><div class="l">Operaciones</div></div>
    <div class="stat"><div class="n pos">${wins}</div><div class="l">Ganadoras</div></div>
    <div class="stat"><div class="n neg">${losses}</div><div class="l">Perdedoras</div></div>
    <div class="stat"><div class="n">${winRate}%</div><div class="l">Win rate</div></div>
    <div class="stat"><div class="n ${netProfit>=0?'pos':'neg'}">${netProfit>=0?'+':''}${netProfit.toFixed(2)}</div><div class="l">P/L neto</div></div>
    <div class="stat"><div class="n pos">${tpCount}/${wins} (${tpPct}%)</div><div class="l">Ganadoras que tocaron TP</div></div>
    <div class="stat"><div class="n neg">${slCount}/${losses} (${slPct}%)</div><div class="l">Perdedoras que tocaron SL</div></div>
  `;

  const order = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const byDay = {};
  order.forEach(d=> byDay[d] = {win:0, loss:0, profit:0});
  trades.forEach(t=>{
    const d = dayName(t.date);
    if(!byDay[d]) byDay[d] = {win:0, loss:0, profit:0};
    if(t.result==='win') byDay[d].win++; else byDay[d].loss++;
    byDay[d].profit += t.profit;
  });
  const maxCount = Math.max(...order.map(d=>byDay[d].win+byDay[d].loss), 1);

  dayEl.innerHTML = order.map(d=>{
    const info = byDay[d];
    const totalD = info.win+info.loss;
    const winPct = totalD? (info.win/maxCount*100):0;
    const lossPct = totalD? (info.loss/maxCount*100):0;
    return `<div class="daybar">
      <div class="lbl">${d}</div>
      <div class="bartrack"><div class="barwin" style="width:${winPct}%"></div><div class="barloss" style="width:${lossPct}%"></div></div>
      <div class="dayval">${totalD} op · <span class="${info.profit>=0?'pos':'neg'}">${info.profit>=0?'+':''}${info.profit.toFixed(2)}</span></div>
    </div>`;
  }).join('');

  // conclusiones
  const withTrades = order.filter(d=> (byDay[d].win+byDay[d].loss)>0);
  if(withTrades.length){
    const bestByProfit = withTrades.reduce((a,b)=> byDay[a].profit>=byDay[b].profit? a:b);
    const worstByProfit = withTrades.reduce((a,b)=> byDay[a].profit<=byDay[b].profit? a:b);
    const bestByRate = withTrades.reduce((a,b)=>{
      const ra = byDay[a].win/(byDay[a].win+byDay[a].loss);
      const rb = byDay[b].win/(byDay[b].win+byDay[b].loss);
      return ra>=rb? a:b;
    });
    conclEl.innerHTML = `
      • Tu mejor día en resultado neto es <strong>${bestByProfit}</strong> (${byDay[bestByProfit].profit>=0?'+':''}${byDay[bestByProfit].profit.toFixed(2)}).<br>
      • Tu peor día en resultado neto es <strong>${worstByProfit}</strong> (${byDay[worstByProfit].profit.toFixed(2)}).<br>
      • El día con mejor win rate es <strong>${bestByRate}</strong>.<br>
      • Win rate general: ${winRate}% sobre ${total} operaciones.
    `;
  } else {
    conclEl.innerHTML='';
  }
}

// ---------- IMPORTAR MT ----------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
dropzone.addEventListener('click', ()=> fileInput.click());
dropzone.addEventListener('dragover', e=>{ e.preventDefault(); dropzone.classList.add('drag'); });
dropzone.addEventListener('dragleave', ()=> dropzone.classList.remove('drag'));
dropzone.addEventListener('drop', e=>{
  e.preventDefault(); dropzone.classList.remove('drag');
  if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e=>{
  if(e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file){
  const status = document.getElementById('import-status');
  status.textContent = 'Leyendo archivo...';
  const reader = new FileReader();
  reader.onload = ev=>{
    const buf = ev.target.result;
    const bytes = new Uint8Array(buf);
    // Los reportes de MetaTrader en Windows suelen venir en UTF-16 con BOM; detectamos y decodificamos bien.
    let encoding = 'utf-8';
    if(bytes.length>=2){
      if(bytes[0]===0xFF && bytes[1]===0xFE) encoding='utf-16le';
      else if(bytes[0]===0xFE && bytes[1]===0xFF) encoding='utf-16be';
    }
    let content;
    try{
      content = new TextDecoder(encoding).decode(buf);
    }catch(e){
      content = new TextDecoder('utf-8').decode(buf);
    }
    let rows = [];
    try{
      if(/\.html?$/i.test(file.name) || content.trim().startsWith('<')){
        rows = parseHtmlReport(content);
      } else {
        rows = parseCsvReport(content);
      }
    }catch(e){
      status.textContent = 'No se pudo interpretar el archivo. Probá exportarlo como CSV desde MetaTrader.';
      return;
    }
    if(!rows.length){
      status.textContent = 'No se encontraron operaciones reconocibles en el archivo. Revisá el formato exportado.';
      return;
    }
    parsedPreview = rows;
    status.textContent = `Se encontraron ${rows.length} operaciones. Revisá la vista previa abajo.`;
    showPreview(rows);
  };
  reader.readAsArrayBuffer(file);
}

function detectDelimiter(line){
  const candidates = [',',';','\t'];
  let best=',', bestCount=-1;
  candidates.forEach(c=>{
    const count = line.split(c).length;
    if(count>bestCount){ bestCount=count; best=c; }
  });
  return best;
}

const NON_TRADE_RX = /balance|dep[oó]sito|deposit|retiro|withdrawal|cr[eé]dito|credit|correcci[oó]n|correction|ajuste/i;

function detectCloseReason(commentRaw){
  if(!commentRaw) return 'na';
  if(/\btp\b/i.test(commentRaw)) return 'tp';
  if(/\bsl\b/i.test(commentRaw)) return 'sl';
  return 'manual';
}

// Parsea números en distintos formatos: "1,234.56" / "1.234,56" / "$ 45.00" / "(12.30)" (negativo) / "-12,30"
function parseNumber(raw){
  if(raw===null || raw===undefined) return NaN;
  let s = String(raw).trim();
  if(!s) return NaN;
  let neg = false;
  if(/^\(.*\)$/.test(s)){ neg = true; s = s.slice(1,-1); }
  if(/^-/.test(s)) neg = true;
  s = s.replace(/[^0-9.,-]/g,''); // saca símbolos de moneda, espacios, letras
  s = s.replace(/-/g,''); // el signo ya lo guardamos en neg
  if(s.includes(',') && s.includes('.')){
    if(s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g,'').replace(',', '.');
    else s = s.replace(/,/g,'');
  } else if(s.includes(',')){
    const decimals = s.length - s.lastIndexOf(',') - 1;
    s = decimals<=2 ? s.replace(',', '.') : s.replace(/,/g,'');
  }
  const n = parseFloat(s);
  if(isNaN(n)) return NaN;
  return neg ? -Math.abs(n) : n;
}

function parseCsvReport(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length>0);
  if(!lines.length) return [];
  const delim = detectDelimiter(lines[0]);
  let headerIdx = -1, headers = [];
  for(let i=0;i<Math.min(lines.length,15);i++){
    const cols = lines[i].split(delim).map(c=>c.trim().toLowerCase().replace(/"/g,''));
    if(cols.some(c=>c.includes('profit')||c.includes('ganancia')||c.includes('beneficio'))){
      headerIdx = i; headers = cols; break;
    }
  }
  if(headerIdx===-1) return [];
  const idxOf = names => headers.findIndex(h=> names.some(n=>h.includes(n)));
  const iTime = idxOf(['open time','time','fecha']);
  const iSymbol = idxOf(['symbol','símbolo','simbolo','item']);
  const iProfit = idxOf(['profit','ganancia','beneficio']);
  const iType = idxOf(['type','tipo']);
  const iDirection = idxOf(['direction','entry','entrada']);
  const iComment = idxOf(['comment','comentario','reason','razón','razon']);
  const iCommission = idxOf(['commission','comisión','comision']);
  if(iProfit===-1) return [];
  const results = [];
  for(let i=headerIdx+1;i<lines.length;i++){
    const cols = lines[i].split(delim).map(c=>c.trim().replace(/"/g,''));
    if(cols.length<2) continue;

    const typeVal = iType>=0 ? cols[iType] : '';
    if(NON_TRADE_RX.test(typeVal)) continue; // balance / depósito / retiro / crédito

    const dirVal = iDirection>=0 ? cols[iDirection].trim().toLowerCase() : '';
    if(dirVal==='in') continue; // fila de apertura duplicada (MT5), el profit real está en la de cierre ("out")

    const profitRaw = cols[iProfit];
    if(profitRaw===undefined || profitRaw==='') continue;
    const grossProfit = parseNumber(profitRaw);
    if(isNaN(grossProfit)) continue;
    const commissionRaw = iCommission>=0 ? parseNumber(cols[iCommission]) : NaN;
    const commission = isNaN(commissionRaw) ? 0 : Math.abs(commissionRaw);
    const profit = grossProfit - commission; // P/L neto = bruto - comisión
    if(profit===0) continue; // se descartan las de P/L neto exactamente 0
    const rawDate = iTime>=0 ? cols[iTime] : '';
    const date = normalizeDate(rawDate);
    if(!date) continue;
    const symbol = iSymbol>=0 ? (cols[iSymbol]||'-') : '-';
    const closeReason = iComment>=0 ? detectCloseReason(cols[iComment]) : 'na';
    results.push({date, symbol, profit, commission, closeReason});
  }
  return results;
}

// MT5 exporta el reporte como UNA tabla grande con secciones "Positions" / "Orders" / "Deals"
// marcadas por filas <th colspan="14">. "Positions" trae una fila limpia por operación cerrada
// (con Profit ya neto y los precios de S/L y T/P), así que la usamos como fuente principal.
// "Deals" duplica cada trade en fila de entrada (profit 0) + salida, y además mezcla depósitos/
// retiros/balance — por eso los "+0" si se combinaban ambas tablas.
function findSection(doc, titleRegex){
  const ths = Array.from(doc.querySelectorAll('th'));
  const startTh = ths.find(th => titleRegex.test(th.textContent.trim()));
  if(!startTh) return null;
  const startRow = startTh.closest('tr');
  if(!startRow) return null;
  const headerRow = startRow.nextElementSibling;
  if(!headerRow) return null;
  const rows = [];
  let r = headerRow.nextElementSibling;
  while(r){
    if(r.querySelector('th')) break; // llegamos a la siguiente sección
    if(r.children && r.children.length>0) rows.push(r);
    r = r.nextElementSibling;
  }
  return rows;
}

function classifyClose(closePrice, sl, tp){
  const candidates = [];
  if(sl) candidates.push({type:'sl', diff:Math.abs(closePrice-sl)});
  if(tp) candidates.push({type:'tp', diff:Math.abs(closePrice-tp)});
  if(!candidates.length) return 'manual';
  candidates.sort((a,b)=>a.diff-b.diff);
  const tolerance = Math.max(closePrice*0.001, 0.0005);
  return candidates[0].diff <= tolerance ? candidates[0].type : 'manual';
}

function parsePositionsSection(doc){
  const rows = findSection(doc, /^positions$/i);
  if(!rows) return null;
  const results = [];
  rows.forEach(row=>{
    const c = Array.from(row.children).map(td=>td.textContent.trim());
    // 0 open time, 1 position id, 2 symbol, 3 type, 4 hidden, 5 volume, 6 open price,
    // 7 S/L, 8 T/P, 9 close time, 10 close price, 11 commission, 12 swap, 13 profit (bruto)
    if(c.length<14) return;
    const grossProfit = parseNumber(c[13]);
    if(isNaN(grossProfit)) return;
    const commissionRaw = parseNumber(c[11]);
    const commission = isNaN(commissionRaw) ? 0 : Math.abs(commissionRaw); // costo, siempre positivo
    const profit = grossProfit - commission; // P/L neto = bruto - comisión
    if(profit===0) return; // descarta P/L neto exactamente 0
    const date = normalizeDate(c[9] || c[0]);
    if(!date) return;
    const symbol = c[2] || '-';
    const sl = parseNumber(c[7]);
    const tp = parseNumber(c[8]);
    const closePrice = parseNumber(c[10]);
    const closeReason = classifyClose(closePrice, isNaN(sl)?0:sl, isNaN(tp)?0:tp);
    results.push({date, symbol, profit, commission, closeReason});
  });
  return results;
}

function parseHtmlReportGeneric(doc){
  const tables = Array.from(doc.querySelectorAll('table'));
  let results = [];
  tables.forEach(table=>{
    const rows = Array.from(table.querySelectorAll('tr'));
    if(!rows.length) return;
    let headerRow=-1, headers=[];
    for(let i=0;i<rows.length;i++){
      const cells = Array.from(rows[i].children).map(c=>c.textContent.trim().toLowerCase());
      if(cells.some(c=>c.includes('profit')||c.includes('ganancia'))){
        headerRow=i; headers=cells; break;
      }
    }
    if(headerRow===-1) return;
    const idxOf = names => headers.findIndex(h=> names.some(n=>h.includes(n)));
    const iTime = idxOf(['time','fecha']);
    const iSymbol = idxOf(['symbol','símbolo','item']);
    const iProfit = idxOf(['profit','ganancia']);
    const iType = idxOf(['type','tipo']);
    const iDirection = idxOf(['direction','entry','entrada']);
    const iComment = idxOf(['comment','comentario','reason','razón','razon']);
    const iCommission = idxOf(['commission','comisión','comision']);
    if(iProfit===-1) return;
    for(let i=headerRow+1;i<rows.length;i++){
      const cells = Array.from(rows[i].children).map(c=>c.textContent.trim());
      if(cells.length<=iProfit) continue;

      const typeVal = iType>=0 ? cells[iType] : '';
      if(NON_TRADE_RX.test(typeVal)) continue;

      const dirVal = iDirection>=0 ? cells[iDirection].trim().toLowerCase() : '';
      if(dirVal==='in') continue;

      const grossProfit = parseNumber(cells[iProfit]);
      if(isNaN(grossProfit)) continue;
      const commissionRaw = iCommission>=0 ? parseNumber(cells[iCommission]) : NaN;
      const commission = isNaN(commissionRaw) ? 0 : Math.abs(commissionRaw);
      const profit = grossProfit - commission; // P/L neto = bruto - comisión
      if(profit===0) continue; // descarta P/L neto exactamente 0
      const date = normalizeDate(iTime>=0? cells[iTime]:'');
      if(!date) continue;
      const symbol = iSymbol>=0 ? (cells[iSymbol]||'-') : '-';
      const closeReason = iComment>=0 ? detectCloseReason(cells[iComment]) : 'na';
      results.push({date, symbol, profit, commission, closeReason});
    }
  });
  return results;
}

function parseHtmlReport(html){
  const doc = new DOMParser().parseFromString(html,'text/html');
  const positions = parsePositionsSection(doc);
  if(positions && positions.length) return positions;
  return parseHtmlReportGeneric(doc);
}

function normalizeDate(raw){
  if(!raw) return null;
  raw = raw.trim();
  // formatos comunes: 2024.05.03 10:22:00 | 2024-05-03 | 03/05/2024
  let m = raw.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})/);
  if(m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = raw.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
  if(m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

function showPreview(rows){
  document.getElementById('preview-card').style.display='block';
  const tbody = document.querySelector('#preview-table tbody');
  tbody.innerHTML = rows.slice(0,200).map(r=>`<tr>
    <td>${r.date}</td><td>${r.symbol}</td>
    <td class="neg">${r.commission? '-'+Math.abs(r.commission).toFixed(2) : '0.00'}</td>
    <td class="${r.profit>=0?'pos':'neg'}">${r.profit>=0?'+':''}${r.profit.toFixed(2)}</td>
    <td><span class="pill ${r.profit>=0?'win':'loss'}">${r.profit>=0?'Ganador':'Perdedor'}</span></td>
    <td>${closeLabel(r.closeReason)}</td>
  </tr>`).join('');
}

document.getElementById('confirm-import').addEventListener('click', ()=>{
  parsedPreview.forEach(r=>{
    trades.push({date:r.date, symbol:r.symbol, lots:'', profit:r.profit, commission:r.commission||0, result: r.profit>=0?'win':'loss', notes:'Importado de MetaTrader', closeReason:r.closeReason||'na'});
  });
  save();
  document.getElementById('import-status').textContent = `Se agregaron ${parsedPreview.length} operaciones al diario.`;
  document.getElementById('preview-card').style.display='none';
  parsedPreview=[];
  renderTrades();
});
document.getElementById('cancel-import').addEventListener('click', ()=>{
  document.getElementById('preview-card').style.display='none';
  parsedPreview=[];
  document.getElementById('import-status').textContent='';
});

renderTrades();
