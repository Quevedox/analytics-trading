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

/* ================== CUENTA Y PLANES (demo, 100% local) ================== */
const USER_KEY = 'tj_user_v1';
const PLAN_KEY = 'tj_plan_v1';
const PLAN_ORDER = ['lite','basico','pro'];
const LITE_TRADE_LIMIT = 15;

const PLAN_INFO = {
  lite:   {label:'Lite',   price:'US$ 0',     priceSub:''},
  basico: {label:'Básico', price:'US$ 7',     priceSub:'/mes'},
  pro:    {label:'Pro',    price:'US$ 20',    priceSub:'/mes'},
};

function getUser(){
  try{ const raw = localStorage.getItem(USER_KEY); return raw?JSON.parse(raw):null; }catch(e){ return null; }
}
function setUser(u){ try{ localStorage.setItem(USER_KEY, JSON.stringify(u)); }catch(e){} }
function getPlan(){
  try{ return localStorage.getItem(PLAN_KEY) || 'lite'; }catch(e){ return 'lite'; }
}
function setPlan(p){ try{ localStorage.setItem(PLAN_KEY, p); }catch(e){} }
function hasPlan(required){ return PLAN_ORDER.indexOf(getPlan()) >= PLAN_ORDER.indexOf(required); }

function doLogin(name, email, method){
  setUser({ name: name || 'Trader', email: email || '', method });
  document.getElementById('login-overlay').style.display = 'none';
  refreshAccountBar();
  renderTrades();
}

document.getElementById('login-google').addEventListener('click', ()=>{
  const name = document.getElementById('login-name').value.trim() || 'Usuario de Google';
  doLogin(name, name.toLowerCase().replace(/\s+/g,'.')+'@gmail.com', 'google');
});
document.getElementById('login-apple').addEventListener('click', ()=>{
  const name = document.getElementById('login-name').value.trim() || 'Usuario de Apple';
  doLogin(name, name.toLowerCase().replace(/\s+/g,'.')+'@icloud.com', 'apple');
});
document.getElementById('login-email-btn').addEventListener('click', ()=>{
  const name = document.getElementById('login-name').value.trim() || 'Trader';
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  if(!email || !pass){ alert('Completá email y contraseña.'); return; }
  doLogin(name, email, 'email');
});

document.getElementById('link-logout').addEventListener('click', ()=>{
  try{ localStorage.removeItem(USER_KEY); }catch(e){}
  location.reload();
});
document.getElementById('link-change-plan').addEventListener('click', ()=> goToTab('planes'));

function refreshAccountBar(){
  const u = getUser();
  document.getElementById('account-name').textContent = u ? u.name : '-';
  const plan = getPlan();
  const badge = document.getElementById('account-plan-badge');
  badge.textContent = PLAN_INFO[plan].label;
  badge.className = 'plan-badge ' + plan;
}

function goToTab(tabId){
  document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tabId));
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.id===tabId));
  if(tabId==='analisis') renderAnalysis();
  if(tabId==='planes') renderPlans();
  if(tabId==='varianza') renderVariance();
  if(tabId==='calendario') renderCalendar();
  applyGating();
}

/* -------- planes -------- */
const PLAN_FEATURES = {
  lite:   ['Diario (hasta '+LITE_TRADE_LIMIT+' operaciones)','Estadísticas básicas (win rate, P/L neto)'],
  basico: ['Operaciones ilimitadas','Análisis por día de la semana','Calendario de resultados','Estadísticas de TP / SL'],
  pro:    ['Importar reportes de MetaTrader','Análisis por sesión (Asia / Londres / NY)','Varianza y simulación Monte Carlo','Todo lo de Básico'],
};

function renderPlans(){
  const grid = document.getElementById('plans-grid');
  const current = getPlan();
  grid.innerHTML = PLAN_ORDER.map(p=>{
    const info = PLAN_INFO[p];
    const isCurrent = p===current;
    let featuresHtml = '';
    PLAN_ORDER.forEach(tier=>{
      const locked = PLAN_ORDER.indexOf(tier) > PLAN_ORDER.indexOf(p);
      PLAN_FEATURES[tier].forEach(f=>{
        featuresHtml += `<li class="${locked?'locked':''}">${f}</li>`;
      });
    });
    return `<div class="plan-card ${isCurrent?'current':''} ${p==='pro'?'featured':''}">
      <h3>${info.label}</h3>
      <div class="price">${info.price}<span>${info.priceSub}</span></div>
      <ul>${featuresHtml}</ul>
      <button class="btn ${isCurrent?'ghost':''}" ${isCurrent?'disabled':''} data-plan="${p}" onclick="requestPlanChange('${p}')">${isCurrent?'Plan actual':'Elegir este plan'}</button>
    </div>`;
  }).join('');
}

function requestPlanChange(targetPlan){
  const current = getPlan();
  if(targetPlan===current) return;
  const info = PLAN_INFO[targetPlan];
  const modal = document.getElementById('plan-modal');
  const isUpgrade = PLAN_ORDER.indexOf(targetPlan) > PLAN_ORDER.indexOf(current);
  document.getElementById('plan-modal-icon').textContent = isUpgrade ? '💳' : '⚠️';
  document.getElementById('plan-modal-title').textContent = isUpgrade ? `Pasar a Plan ${info.label}` : `Volver a Plan ${info.label}`;
  document.getElementById('plan-modal-text').textContent = isUpgrade
    ? `Vas a cambiar al plan ${info.label} (${info.price}${info.priceSub}). Esto es una simulación: no se realiza ningún cobro real.`
    : `Vas a volver al plan ${info.label}. Podrías perder acceso a funciones que ya desbloqueaste.`;
  modal.dataset.targetPlan = targetPlan;
  modal.classList.add('show');
}
document.getElementById('plan-modal-cancel').addEventListener('click', ()=>{
  document.getElementById('plan-modal').classList.remove('show');
});
document.getElementById('plan-modal-confirm').addEventListener('click', ()=>{
  const modal = document.getElementById('plan-modal');
  const targetPlan = modal.dataset.targetPlan;
  setPlan(targetPlan);
  modal.classList.remove('show');
  refreshAccountBar();
  renderPlans();
  applyGating();
  renderAnalysis();
});
document.querySelectorAll('.unlock-btn, #unlock-importar-btn').forEach(b=>{
  b.addEventListener('click', ()=> goToTab('planes'));
});

/* -------- gating: oculta/bloquea funciones según el plan -------- */
function applyGating(){
  const okBasico = hasPlan('basico');
  const okPro = hasPlan('pro');

  document.getElementById('day-analysis-locked').style.display = okBasico ? 'none' : 'block';
  document.getElementById('day-analysis-card').style.display = okBasico ? 'block' : 'none';

  document.getElementById('session-locked').style.display = okPro ? 'none' : 'block';
  document.getElementById('session-card').style.display = okPro ? 'block' : 'none';

  document.getElementById('importar-locked').style.display = okPro ? 'none' : 'block';
  document.getElementById('importar-content').style.display = okPro ? 'block' : 'none';
  document.getElementById('varianza-locked').style.display = okPro ? 'none' : 'block';
  document.getElementById('varianza-content').style.display = okPro ? 'block' : 'none';
  document.getElementById('calendario-locked').style.display = okBasico ? 'none' : 'block';
  document.getElementById('calendario-content').style.display = okBasico ? 'block' : 'none';
}

/* ================== VARIANZA ================== */
function pctl(sorted,p){
  const i=(sorted.length-1)*p, lo=Math.floor(i), hi=Math.ceil(i);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(i-lo);
}
function money(x){ return (x>=0?'+':'-')+Math.abs(x).toFixed(2); }

function equitySvg(pnls){
  const W=600,H=180,pad=8;
  let eq=0; const pts=[0]; pnls.forEach(x=>{eq+=x; pts.push(eq);});
  const mn=Math.min(...pts), mx=Math.max(...pts), range=(mx-mn)||1;
  const X=i=>pad+(i/(pts.length-1))*(W-2*pad), Y=v=>H-pad-((v-mn)/range)*(H-2*pad);
  const d=pts.map((v,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(v).toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:180px;display:block;"><line x1="${pad}" x2="${W-pad}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--border)" stroke-dasharray="4 4"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>
  <div class="hint" style="display:flex;justify-content:space-between;"><span>Mín ${money(mn)}</span><span>Final ${money(eq)}</span><span>Máx ${money(mx)}</span></div>`;
}

function runMonteCarlo(pnls,sims){
  const n=pnls.length, fin=[], dd=[], st=[];
  for(let s=0;s<sims;s++){
    let eq=0,peak=0,mdd=0,cur=0,mxl=0;
    for(let i=0;i<n;i++){
      const x=pnls[Math.floor(Math.random()*n)];
      eq+=x; if(eq>peak) peak=eq; if(peak-eq>mdd) mdd=peak-eq;
      if(x<0){cur++; if(cur>mxl) mxl=cur;} else cur=0;
    }
    fin.push(eq); dd.push(mdd); st.push(mxl);
  }
  const srt=a=>a.sort((x,y)=>x-y);
  srt(fin); srt(dd); srt(st);
  return {fin,dd,st,neg:fin.filter(v=>v<0).length/sims};
}

function renderMonteCarlo(pnls){
  const SIMS=2000, r=runMonteCarlo(pnls,SIMS);
  document.getElementById('var-mc').innerHTML=`
    <p class="hint" style="margin-top:-4px;">Se repiten tus ${pnls.length} operaciones ${SIMS} veces sacándolas al azar de tu historial. Muestra cuánto puede variar el resultado solo por el orden de la suerte, con la misma estrategia.</p>
    <div class="tablewrap"><table>
      <thead><tr><th>Métrica</th><th>Mejor caso (5%)</th><th>Típico (mediana)</th><th>Peor caso (5%)</th></tr></thead>
      <tbody>
        <tr><td><strong>Resultado final</strong></td><td class="pos">${money(pctl(r.fin,.95))}</td><td>${money(pctl(r.fin,.5))}</td><td class="${pctl(r.fin,.05)>=0?'pos':'neg'}">${money(pctl(r.fin,.05))}</td></tr>
        <tr><td><strong>Drawdown máximo</strong></td><td>-${pctl(r.dd,.05).toFixed(2)}</td><td>-${pctl(r.dd,.5).toFixed(2)}</td><td class="neg">-${pctl(r.dd,.95).toFixed(2)}</td></tr>
        <tr><td><strong>Racha de pérdidas</strong></td><td>${pctl(r.st,.05).toFixed(0)}</td><td>${pctl(r.st,.5).toFixed(0)}</td><td class="neg">${pctl(r.st,.95).toFixed(0)}</td></tr>
      </tbody></table></div>
    <p class="hint" style="margin-top:10px;">Probabilidad de terminar en negativo con este mismo número de operaciones: <strong>${(r.neg*100).toFixed(1)}%</strong>. Asume que los trades son independientes entre sí.</p>`;
}

function renderVariance(){
  const stats=document.getElementById('var-stats');
  const ordered=[...trades].map((t,i)=>({t,i})).sort((a,b)=>{
    const d=new Date(a.t.date)-new Date(b.t.date); if(d) return d;
    const h=(a.t.hour??0)-(b.t.hour??0); return h||a.i-b.i;
  }).map(o=>o.t);
  const pnls=ordered.map(t=>t.profit), n=pnls.length;
  if(n<10){
    stats.innerHTML='';
    ['var-equity','var-edge','var-days','var-mc'].forEach(id=>document.getElementById(id).innerHTML='');
    document.getElementById('var-edge').innerHTML='Necesitás al menos 10 operaciones cargadas para calcular la varianza (importá tu reporte de MetaTrader en la pestaña Importar MT).';
    return;
  }
  const sum=pnls.reduce((a,b)=>a+b,0), mean=sum/n;
  const variance=pnls.reduce((a,x)=>a+(x-mean)**2,0)/(n-1), sd=Math.sqrt(variance);
  const wins=pnls.filter(x=>x>=0), losses=pnls.filter(x=>x<0);
  const grossW=wins.reduce((a,b)=>a+b,0), grossL=Math.abs(losses.reduce((a,b)=>a+b,0));
  const avgW=wins.length?grossW/wins.length:0, avgL=losses.length?grossL/losses.length:0;
  const payoff=avgL?avgW/avgL:0, pf=grossL?grossW/grossL:0, be=payoff?100/(1+payoff):0;
  let mw=0,ml=0,cw=0,cl=0,eq=0,peak=0,mdd=0;
  pnls.forEach(x=>{
    if(x>=0){cw++;cl=0;} else {cl++;cw=0;}
    mw=Math.max(mw,cw); ml=Math.max(ml,cl);
    eq+=x; peak=Math.max(peak,eq); mdd=Math.max(mdd,peak-eq);
  });
  const tstat=sd?mean/(sd/Math.sqrt(n)):0;
  const card=(v,l,c='')=>`<div class="stat"><div class="n ${c}">${v}</div><div class="l">${l}</div></div>`;
  stats.innerHTML=
    card(money(mean),'Expectativa por trade',mean>=0?'pos':'neg')+
    card(variance.toFixed(0),'Varianza (P/L)')+
    card(sd.toFixed(2),'Desvío estándar')+
    card(pf.toFixed(2),'Profit factor',pf>=1?'pos':'neg')+
    card(payoff.toFixed(2),'Payoff (ganancia/pérdida prom.)')+
    card(be.toFixed(0)+'%','Win rate de equilibrio')+
    card(ml,'Racha máx. de pérdidas','neg')+
    card(mw,'Racha máx. de ganancias','pos')+
    card('-'+mdd.toFixed(2),'Drawdown máximo','neg');

  document.getElementById('var-equity').innerHTML=equitySvg(pnls);

  const need=mean>0?Math.ceil((2*sd/mean)**2):null;
  let verdict;
  if(tstat>=2) verdict='Tu promedio es lo bastante alto frente a la variabilidad como para que <strong>sea poco probable que sea solo suerte</strong> (≈95% de confianza).';
  else if(tstat>0) verdict='Tu promedio es positivo, pero con esta cantidad de operaciones <strong>todavía no se puede descartar que sea suerte</strong>.';
  else verdict='Tu promedio por trade es negativo o nulo: <strong>hoy los datos no muestran ventaja</strong>.';
  document.getElementById('var-edge').innerHTML=`Estadístico t: <strong>${tstat.toFixed(2)}</strong> (con ${n} operaciones). ${verdict}`+
    (need?`<br>Para llegar a t≈2 con tu media y desvío actuales harían falta unas <strong>${need}</strong> operaciones${need>n?` (te faltan ~${need-n})`:''}.`:'')+
    `<br><span class="hint">Aproximación estadística que asume operaciones independientes; sirve como referencia, no como garantía.</span>`;

  const byDate={}; ordered.forEach(t=>byDate[t.date]=(byDate[t.date]||0)+t.profit);
  const dv=Object.values(byDate), dn=dv.length, dm=dv.reduce((a,b)=>a+b,0)/dn;
  const dsd=dn>1?Math.sqrt(dv.reduce((a,x)=>a+(x-dm)**2,0)/(dn-1)):0;
  const best=Math.max(...dv), worst=Math.min(...dv), posDays=dv.filter(x=>x>0).length;
  document.getElementById('var-days').innerHTML=
    `${dn} días operados · promedio diario <strong>${money(dm)}</strong> · desvío diario <strong>${dsd.toFixed(2)}</strong><br>`+
    `Mejor día <span class="pos">${money(best)}</span> · peor día <span class="neg">${money(worst)}</span> · días positivos <strong>${(posDays/dn*100).toFixed(0)}%</strong>`+
    (sum>0?`<br>Tu mejor día representa el <strong>${(best/sum*100).toFixed(0)}%</strong> de tu ganancia total. Muchos fondeos limitan ese porcentaje (regla de consistencia): revisá la de tu cuenta.`:'');

  renderMonteCarlo(pnls);
}
document.getElementById('var-resim').addEventListener('click',()=>renderVariance());

/* ================== CALENDARIO ================== */
const MONTH_NAMES=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
let calY=new Date().getFullYear(), calM=new Date().getMonth(), calSel=null, calNav=false;

function renderCalendar(){
  if(!calNav){
    const dates=trades.map(t=>t.date).filter(Boolean).sort();
    if(dates.length){ const r=new Date(dates[dates.length-1]+'T00:00:00'); calY=r.getFullYear(); calM=r.getMonth(); }
  }
  const byDate={};
  trades.forEach(t=>{ const d=byDate[t.date]||(byDate[t.date]={n:0,pnl:0,list:[]}); d.n++; d.pnl+=t.profit; d.list.push(t); });
  const pad=n=>String(n).padStart(2,'0');
  const first=(new Date(calY,calM,1).getDay()+6)%7;
  const dim=new Date(calY,calM+1,0).getDate();
  let cells='', mPnl=0, mN=0, green=0, red=0, best=null, worst=null;
  for(let i=0;i<first;i++) cells+='<div class="cal-cell empty"></div>';
  for(let d=1;d<=dim;d++){
    const key=calY+'-'+pad(calM+1)+'-'+pad(d), info=byDate[key];
    if(info){
      mPnl+=info.pnl; mN+=info.n;
      if(info.pnl>0) green++; else if(info.pnl<0) red++;
      if(best===null||info.pnl>best) best=info.pnl;
      if(worst===null||info.pnl<worst) worst=info.pnl;
    }
    const cls=info?(info.pnl>0?'win':(info.pnl<0?'loss':'')):'';
    cells+=`<div class="cal-cell ${cls} ${key===calSel?'sel':''}" ${info?`data-date="${key}"`:''}><div class="d">${d}</div>${info?`<div class="p">${info.pnl>=0?'+':'-'}${Math.abs(info.pnl).toFixed(0)}</div><div class="n">${info.n} op.</div>`:''}</div>`;
  }
  document.getElementById('cal-title').textContent=MONTH_NAMES[calM]+' '+calY;
  const grid=document.getElementById('cal-grid');
  grid.innerHTML=cells;
  grid.querySelectorAll('.cal-cell[data-date]').forEach(c=>c.addEventListener('click',()=>{ calSel=c.dataset.date; renderCalendar(); }));

  const card=(v,l,c='')=>`<div class="stat"><div class="n ${c}">${v}</div><div class="l">${l}</div></div>`;
  const sg=v=>(v>=0?'+':'-')+Math.abs(v).toFixed(2);
  document.getElementById('cal-stats').innerHTML = mN===0 ? '' :
    card(sg(mPnl),'P/L del mes',mPnl>=0?'pos':'neg')+card(mN,'Trades del mes')+
    card(green,'Días verdes','pos')+card(red,'Días rojos','neg')+
    card(sg(best),'Mejor día','pos')+card(sg(worst),'Peor día','neg');

  const det=document.getElementById('cal-detail');
  if(calSel && byDate[calSel]){
    const info=byDate[calSel];
    det.style.display='block';
    det.innerHTML=`<h2>${calSel} · ${info.n} trades · <span class="${info.pnl>=0?'pos':'neg'}">${sg(info.pnl)}</span></h2>
      <div class="tablewrap"><table><thead><tr><th>Hora (bróker)</th><th>Símbolo</th><th>Cierre</th><th>P/L neto</th></tr></thead><tbody>`+
      [...info.list].sort((a,b)=>(a.hour??0)-(b.hour??0)).map(t=>`<tr><td>${t.hour!=null?t.hour+'h':'-'}</td><td>${t.symbol}</td><td>${closeLabel(t.closeReason)}</td><td class="${t.profit>=0?'pos':'neg'}">${sg(t.profit)}</td></tr>`).join('')+
      '</tbody></table></div>';
  } else det.style.display='none';
}
function calShift(delta){
  calNav=true; calSel=null; calM+=delta;
  if(calM<0){calM=11;calY--;} else if(calM>11){calM=0;calY++;}
  renderCalendar();
}
document.getElementById('cal-prev').addEventListener('click',()=>calShift(-1));
document.getElementById('cal-next').addEventListener('click',()=>calShift(1));

/* ================== INICIO ================== */
const existingUser = getUser();
if(existingUser){
  document.getElementById('login-overlay').style.display = 'none';
} else {
  document.getElementById('login-overlay').style.display = 'flex';
}
refreshAccountBar();
applyGating();

// tabs
document.querySelectorAll('nav button').forEach(btn=>{
  btn.addEventListener('click', ()=> goToTab(btn.dataset.tab));
});

// win/loss toggle

// default date = today
document.getElementById('f-date').value = new Date().toISOString().slice(0,10);

document.getElementById('add-trade').addEventListener('click', ()=>{
  if(!hasPlan('basico') && trades.length>=LITE_TRADE_LIMIT){
    document.getElementById('limit-banner').style.display = 'block';
    document.getElementById('limit-banner').scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }
  const date = document.getElementById('f-date').value;
  if(!date){ alert('Poné una fecha.'); return; }
  const symbol = document.getElementById('f-symbol').value.trim() || '-';
  const lots = document.getElementById('f-lots').value;
  const grossProfit = parseFloat(document.getElementById('f-profit').value) || 0;
  const commission = Math.abs(parseFloat(document.getElementById('f-commission').value) || 0);
  const profit = grossProfit - commission; // P/L neto = bruto - comisión
  const timeVal = document.getElementById('f-time').value;
  const hour = timeVal ? parseInt(timeVal.split(':')[0],10) : null;
  const notes = document.getElementById('f-notes').value.trim();
  const closeReason = document.getElementById('f-close').value;
  trades.push({date, symbol, lots, profit, commission, hour, result: profit>=0?'win':'loss', notes, closeReason});
  save();
  document.getElementById('f-symbol').value='';
  document.getElementById('f-lots').value='';
  document.getElementById('f-profit').value='';
  document.getElementById('f-commission').value='';
  document.getElementById('f-time').value='';
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
  const limitHit = typeof hasPlan==='function' && !hasPlan('basico') && trades.length>=LITE_TRADE_LIMIT;
  const banner = document.getElementById('limit-banner');
  if(banner) banner.style.display = limitHit ? 'block' : 'none';
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
    applyGating();
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

  const tpSlCards = hasPlan('basico')
    ? `<div class="stat"><div class="n pos">${tpCount}/${wins} (${tpPct}%)</div><div class="l">Ganadoras que tocaron TP</div></div>
       <div class="stat"><div class="n neg">${slCount}/${losses} (${slPct}%)</div><div class="l">Perdedoras que tocaron SL</div></div>`
    : `<div class="stat" style="opacity:.6;cursor:pointer;" onclick="goToTab('planes')"><div class="n">🔒</div><div class="l">TP / SL — Plan Básico</div></div>`;

  statsEl.innerHTML = `
    <div class="stat"><div class="n">${total}</div><div class="l">Operaciones</div></div>
    <div class="stat"><div class="n pos">${wins}</div><div class="l">Ganadoras</div></div>
    <div class="stat"><div class="n neg">${losses}</div><div class="l">Perdedoras</div></div>
    <div class="stat"><div class="n">${winRate}%</div><div class="l">Win rate</div></div>
    <div class="stat"><div class="n ${netProfit>=0?'pos':'neg'}">${netProfit>=0?'+':''}${netProfit.toFixed(2)}</div><div class="l">P/L neto</div></div>
    ${tpSlCards}
  `;
  applyGating();

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

  renderSessions();
}

// Londres 04:00–14:00, Nueva York 09:00–18:00, Asia 19:00–06:00 (cruza medianoche).
// Como se superponen, cada hora puede caer en una sesión sola o en el solapamiento de dos.
const SESSIONS = [
  {name:'Asia', range:'19:00–06:00'},
  {name:'Asia / Londres (solapamiento)', range:'04:00–06:00'},
  {name:'Londres', range:'06:00–09:00'},
  {name:'Londres / NY (solapamiento)', range:'09:00–14:00'},
  {name:'Nueva York', range:'14:00–18:00'},
  {name:'Fuera de sesión', range:'18:00–19:00'},
];

function sessionForHour(h){
  const inAsia = (h>=19) || (h<6);
  const inLondon = (h>=4 && h<14);
  const inNY = (h>=9 && h<18);
  let name;
  if(inAsia && inLondon) name='Asia / Londres (solapamiento)';
  else if(inLondon && inNY) name='Londres / NY (solapamiento)';
  else if(inAsia) name='Asia';
  else if(inLondon) name='Londres';
  else if(inNY) name='Nueva York';
  else name='Fuera de sesión';
  return SESSIONS.find(s=>s.name===name);
}

function renderSessions(){
  const tbody = document.querySelector('#session-table tbody');
  const noteEl = document.getElementById('session-note');
  const offsetInput = document.getElementById('session-offset');
  const offset = parseInt(offsetInput.value,10) || 0;

  const withHour = trades.filter(t=> t.hour!==null && t.hour!==undefined && !isNaN(t.hour));
  const withoutHour = trades.length - withHour.length;

  if(withHour.length===0){
    tbody.innerHTML = '';
    noteEl.textContent = 'Ninguna operación tiene horario registrado todavía. Al importar un reporte de MetaTrader se captura automáticamente; en la carga manual es un campo opcional.';
    return;
  }

  const byS = {};
  SESSIONS.forEach(s=> byS[s.name] = {win:0, loss:0, profit:0, count:0});
  withHour.forEach(t=>{
    const adjHour = ((t.hour + offset) % 24 + 24) % 24;
    const s = sessionForHour(adjHour);
    byS[s.name].count++;
    if(t.result==='win') byS[s.name].win++; else byS[s.name].loss++;
    byS[s.name].profit += t.profit;
  });

  let bestSession = null, bestProfit = -Infinity;
  tbody.innerHTML = SESSIONS.map(s=>{
    const info = byS[s.name];
    const wr = info.count? ((info.win/info.count)*100).toFixed(0) : '-';
    const avg = info.count? (info.profit/info.count) : 0;
    if(info.count>0 && info.profit>bestProfit){ bestProfit=info.profit; bestSession=s.name; }
    return `<tr>
      <td><strong>${s.name}</strong></td>
      <td>${s.range}</td>
      <td>${info.count}</td>
      <td>${info.count? wr+'%':'-'}</td>
      <td class="${info.profit>=0?'pos':'neg'}">${info.count? (info.profit>=0?'+':'')+info.profit.toFixed(2) : '-'}</td>
      <td class="${avg>=0?'pos':'neg'}">${info.count? (avg>=0?'+':'')+avg.toFixed(2) : '-'}</td>
    </tr>`;
  }).join('');

  let note = '';
  if(bestSession) note += `Tu sesión más rentable es <strong>${bestSession}</strong>. `;
  if(withoutHour>0) note += `${withoutHour} operación(es) sin horario registrado no se incluyen en esta tabla.`;
  noteEl.innerHTML = note;
}

document.getElementById('session-offset').addEventListener('input', renderSessions);

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
    const hour = extractHour(rawDate);
    const symbol = iSymbol>=0 ? (cols[iSymbol]||'-') : '-';
    const closeReason = iComment>=0 ? detectCloseReason(cols[iComment]) : 'na';
    results.push({date, symbol, profit, commission, closeReason, hour});
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
    const hour = extractHour(c[9]);
    const symbol = c[2] || '-';
    const sl = parseNumber(c[7]);
    const tp = parseNumber(c[8]);
    const closePrice = parseNumber(c[10]);
    const closeReason = classifyClose(closePrice, isNaN(sl)?0:sl, isNaN(tp)?0:tp);
    results.push({date, symbol, profit, commission, closeReason, hour});
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
      const hour = iTime>=0 ? extractHour(cells[iTime]) : null;
      const symbol = iSymbol>=0 ? (cells[iSymbol]||'-') : '-';
      const closeReason = iComment>=0 ? detectCloseReason(cells[iComment]) : 'na';
      results.push({date, symbol, profit, commission, closeReason, hour});
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

function extractHour(raw){
  if(!raw) return null;
  const m = String(raw).match(/(\d{1,2}):(\d{2})/);
  if(!m) return null;
  const h = parseInt(m[1],10);
  return (h>=0 && h<24) ? h : null;
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
    trades.push({date:r.date, symbol:r.symbol, lots:'', profit:r.profit, commission:r.commission||0, hour:(r.hour===undefined?null:r.hour), result: r.profit>=0?'win':'loss', notes:'Importado de MetaTrader', closeReason:r.closeReason||'na'});
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
