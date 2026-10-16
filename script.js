const PAGE=document.body.dataset.page||"spa";
(function(){const g=document.getElementById.bind(document),q=document.querySelector.bind(document);
 document.getElementById=id=>g(id)||document.createElement("div");
 document.querySelector=sel=>q(sel)||document.createElement("div");})();
function navTo(page){ if(PAGE==="spa") location.hash="#"+page; else location.href=(page==="home"?"index":page)+".html"; }

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
  if(!email || !pass){ alert(T('Completá email y contraseña.')); return; }
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
  if(tabId==='planes'){ navTo('planes'); return; }
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
  document.getElementById('cal-title').textContent=T(MONTH_NAMES[calM])+' '+calY;
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

/* ================== IDIOMAS (ES / EN / PT) ================== */
const LANG_KEY='tj_lang_v1';
const DOW={es:'LMMJVSD',en:'MTWTFSS',pt:'STQQSSD'};
const I18N=Object.assign(Object.create(null),{
"Iniciá sesión para llevar tu diario":["Sign in to keep your journal","Entre para manter seu diário"],
"Tu nombre":["Your name","Seu nome"],
"Continuar con Google":["Continue with Google","Continuar com Google"],
"Continuar con Apple":["Continue with Apple","Continuar com Apple"],
"o con email":["or with email","ou com email"],
"Contraseña":["Password","Senha"],
"Continuar con email":["Continue with email","Continuar com email"],
"Demo: el login no usa autenticación real de Google/Apple ni verifica contraseñas. Tus datos quedan guardados solo en este navegador.":["Demo: login does not use real Google/Apple authentication or verify passwords. Your data stays only in this browser.","Demo: o login não usa autenticação real do Google/Apple nem verifica senhas. Seus dados ficam salvos apenas neste navegador."],
"Idioma":["Language","Idioma"],
"Diario":["Journal","Diário"],"Análisis":["Analysis","Análise"],"Importar MT":["Import MT","Importar MT"],"Calendario":["Calendar","Calendário"],"Varianza":["Variance","Variância"],"Planes":["Plans","Planos"],
"Cambiar plan":["Change plan","Mudar plano"],"Cerrar sesión":["Log out","Sair"],
"Llegaste al límite de":["You reached the limit of","Você atingiu o limite de"],
"15 operaciones":["15 trades","15 operações"],
"del plan Lite. Pasá a Básico o Pro para cargar sin límite.":["of the Lite plan. Upgrade to Basic or Pro to log without limits.","do plano Lite. Mude para Básico ou Pro para registrar sem limite."],
"Ver planes":["See plans","Ver planos"],
"Nueva operación":["New trade","Nova operação"],"Fecha":["Date","Data"],"Símbolo":["Symbol","Símbolo"],"Lotes":["Lots","Lotes"],
"Resultado bruto ($)":["Gross result ($)","Resultado bruto ($)"],"Comisión ($)":["Commission ($)","Comissão ($)"],
"Hora de cierre (opcional)":["Close time (optional)","Hora de fechamento (opcional)"],"Cierre":["Close","Fechamento"],
"No especificado":["Not specified","Não especificado"],
"El resultado (ganador/perdedor) se calcula solo, según el P/L neto (bruto − comisión).":["The result (winner/loser) is calculated automatically from net P/L (gross − commission).","O resultado (ganhador/perdedor) é calculado automaticamente pelo P/L líquido (bruto − comissão)."],
"Notas (opcional)":["Notes (optional)","Notas (opcional)"],"Agregar operación":["Add trade","Adicionar operação"],"Restablecer":["Reset","Redefinir"],
"p.ej. 25 o -12":["e.g. 25 or -12","ex.: 25 ou -12"],"Setup, emociones, error cometido...":["Setup, emotions, mistake made...","Setup, emoções, erro cometido..."],
"Historial":["History","Histórico"],"Día":["Day","Dia"],"Resultado":["Result","Resultado"],"Comisión":["Commission","Comissão"],"P/L neto":["Net P/L","P/L líquido"],"Notas":["Notes","Notas"],
"Ganador":["Winner","Ganhador"],"Perdedor":["Loser","Perdedor"],
"Todavía no cargaste operaciones.":["You haven't logged any trades yet.","Você ainda não registrou operações."],
"Lunes":["Monday","Segunda"],"Martes":["Tuesday","Terça"],"Miércoles":["Wednesday","Quarta"],"Jueves":["Thursday","Quinta"],"Viernes":["Friday","Sexta"],"Sábado":["Saturday","Sábado"],"Domingo":["Sunday","Domingo"],
"Enero":["January","Janeiro"],"Febrero":["February","Fevereiro"],"Marzo":["March","Março"],"Abril":["April","Abril"],"Mayo":["May","Maio"],"Junio":["June","Junho"],"Julio":["July","Julho"],"Agosto":["August","Agosto"],"Septiembre":["September","Setembro"],"Octubre":["October","Outubro"],"Noviembre":["November","Novembro"],"Diciembre":["December","Dezembro"],
"Análisis por día — Plan Básico":["Weekday analysis — Basic plan","Análise por dia — Plano Básico"],
"Descubrí qué día de la semana ganás y perdés más.":["Find out which weekday you win and lose the most.","Descubra em qual dia da semana você mais ganha e perde."],
"Rendimiento por día de la semana":["Performance by weekday","Desempenho por dia da semana"],
"Análisis por sesión — Plan Pro":["Session analysis — Pro plan","Análise por sessão — Plano Pro"],
"Mirá tu rendimiento por sesión: Asia, Londres y Nueva York.":["See your performance by session: Asia, London and New York.","Veja seu desempenho por sessão: Ásia, Londres e Nova York."],
"Rendimiento por sesión de trading":["Performance by trading session","Desempenho por sessão de trading"],
"Ajuste horario del bróker (hs)":["Broker time offset (hrs)","Ajuste de horário da corretora (h)"],
"Los horarios de MetaTrader suelen venir adelantados respecto a tu zona horaria real. Ajustá este número (positivo o negativo) hasta que las sesiones te queden alineadas; se recalcula al toque.":["MetaTrader times are usually ahead of your real time zone. Adjust this number (positive or negative) until the sessions line up; it recalculates instantly.","Os horários do MetaTrader costumam estar adiantados em relação ao seu fuso real. Ajuste este número (positivo ou negativo) até as sessões alinharem; recalcula na hora."],
"Sesión":["Session","Sessão"],"Horario aprox.":["Approx. hours","Horário aprox."],"PnL neto":["Net PnL","PnL líquido"],"PnL promedio":["Average PnL","PnL médio"],"Conclusiones":["Conclusions","Conclusões"],
"Asia / Londres (solapamiento)":["Asia / London (overlap)","Ásia / Londres (sobreposição)"],"Londres":["London","Londres"],"Londres / NY (solapamiento)":["London / NY (overlap)","Londres / NY (sobreposição)"],"Nueva York":["New York","Nova York"],"Fuera de sesión":["Off-session","Fora de sessão"],
"Importar MetaTrader es una función Pro":["MetaTrader import is a Pro feature","Importar MetaTrader é um recurso Pro"],
"Subí directamente tu reporte de MT4/MT5 y la app carga, limpia y calcula todo sola. Disponible en el plan Pro.":["Upload your MT4/MT5 report directly and the app loads, cleans and calculates everything. Available on the Pro plan.","Envie seu relatório do MT4/MT5 e o app carrega, limpa e calcula tudo sozinho. Disponível no plano Pro."],
"Ver plan Pro":["See Pro plan","Ver plano Pro"],"Importar reporte de MetaTrader":["Import MetaTrader report","Importar relatório do MetaTrader"],
"Subí el archivo exportado desde MT4/MT5 (Historial → Guardar como Reporte, en formato .csv o .html). La app intenta detectar automáticamente las columnas de fecha, símbolo y ganancia.":["Upload the file exported from MT4/MT5 (History → Save as Report, in .csv or .html format). The app tries to detect the date, symbol and profit columns automatically.","Envie o arquivo exportado do MT4/MT5 (Histórico → Salvar como Relatório, em .csv ou .html). O app tenta detectar automaticamente as colunas de data, símbolo e lucro."],
"Arrastrá el archivo acá":["Drag the file here","Arraste o arquivo aqui"],"o hacé clic para seleccionar":["or click to select","ou clique para selecionar"],
"Vista previa":["Preview","Pré-visualização"],"Agregar al diario":["Add to journal","Adicionar ao diário"],"Cancelar":["Cancel","Cancelar"],
"Calendario de resultados — Plan Básico":["Results calendar — Basic plan","Calendário de resultados — Plano Básico"],
"Mirá día por día cuántos trades hiciste y si cerraste en verde o en rojo.":["See day by day how many trades you made and whether you closed green or red.","Veja dia a dia quantos trades você fez e se fechou no verde ou no vermelho."],
"Análisis de varianza — Plan Pro":["Variance analysis — Pro plan","Análise de variância — Plano Pro"],
"Medí cuánto de tu resultado es ventaja y cuánto es suerte, con simulaciones sobre tus propios datos.":["Measure how much of your result is edge and how much is luck, with simulations on your own data.","Meça quanto do seu resultado é vantagem e quanto é sorte, com simulações sobre seus próprios dados."],
"Curva de equity":["Equity curve","Curva de patrimônio"],"¿Ventaja o suerte?":["Edge or luck?","Vantagem ou sorte?"],"Variabilidad por día":["Daily variability","Variabilidade por dia"],
"Simulación de escenarios (Monte Carlo)":["Scenario simulation (Monte Carlo)","Simulação de cenários (Monte Carlo)"],"Volver a simular":["Simulate again","Simular novamente"],
"Elegí tu plan":["Choose your plan","Escolha seu plano"],
"Los precios y el cobro son una simulación — no se procesa ningún pago real.":["Prices and billing are a simulation — no real payment is processed.","Os preços e a cobrança são uma simulação — nenhum pagamento real é processado."],
"Cambiar de plan":["Change plan","Mudar de plano"],"Confirmar":["Confirm","Confirmar"],
"¿Restablecer todo?":["Reset everything?","Redefinir tudo?"],"Esto va a borrar":["This will delete","Isso vai apagar"],"todas":["all","todas"],
"las operaciones guardadas en el diario de forma permanente. Esta acción no se puede deshacer.":["the trades saved in the journal permanently. This action cannot be undone.","as operações salvas no diário permanentemente. Esta ação não pode ser desfeita."],
"Sí, borrar todo":["Yes, delete everything","Sim, apagar tudo"],
"Operaciones":["Trades","Operações"],"Ganadoras":["Winners","Ganhadoras"],"Perdedoras":["Losers","Perdedoras"],
"Ganadoras que tocaron TP":["Winners that hit TP","Ganhadoras que bateram TP"],"Perdedoras que tocaron SL":["Losers that hit SL","Perdedoras que bateram SL"],
"Tu sesión más rentable es":["Your most profitable session is","Sua sessão mais rentável é"],
"• Tu mejor día en resultado neto es":["• Your best day by net result is","• Seu melhor dia em resultado líquido é"],
"• Tu peor día en resultado neto es":["• Your worst day by net result is","• Seu pior dia em resultado líquido é"],
"• El día con mejor win rate es":["• The day with the best win rate is","• O dia com melhor win rate é"],
"• Win rate general: {a} sobre {b} operaciones.":["• Overall win rate: {a} over {b} trades.","• Win rate geral: {a} em {b} operações."],
"{n} op ·":["{n} trades ·","{n} op ·"],"{n} op.":["{n} tr.","{n} op."],
"P/L del mes":["Month P/L","P/L do mês"],"Trades del mes":["Trades this month","Trades do mês"],"Días verdes":["Green days","Dias verdes"],"Días rojos":["Red days","Dias vermelhos"],"Mejor día":["Best day","Melhor dia"],"Peor día":["Worst day","Pior dia"],
"Expectativa por trade":["Expectancy per trade","Expectativa por trade"],"Varianza (P/L)":["Variance (P/L)","Variância (P/L)"],"Desvío estándar":["Standard deviation","Desvio padrão"],
"Payoff (ganancia/pérdida prom.)":["Payoff (avg win/avg loss)","Payoff (ganho/perda médios)"],"Win rate de equilibrio":["Break-even win rate","Win rate de equilíbrio"],
"Racha máx. de pérdidas":["Max losing streak","Maior sequência de perdas"],"Racha máx. de ganancias":["Max winning streak","Maior sequência de ganhos"],"Drawdown máximo":["Maximum drawdown","Drawdown máximo"],
"Estadístico t:":["t-statistic:","Estatística t:"],
"(con {n} operaciones). Tu promedio es positivo, pero con esta cantidad de operaciones":["(with {n} trades). Your average is positive, but with this number of trades","(com {n} operações). Sua média é positiva, mas com essa quantidade de operações"],
"todavía no se puede descartar que sea suerte":["it is still not possible to rule out luck","ainda não dá para descartar que seja sorte"],
"(con {n} operaciones). Tu promedio es lo bastante alto frente a la variabilidad como para que":["(with {n} trades). Your average is high enough relative to the variability that","(com {n} operações). Sua média é alta o bastante frente à variabilidade para que"],
"sea poco probable que sea solo suerte":["it is unlikely to be just luck","seja improvável que seja só sorte"],
"(≈95% de confianza).":["(≈95% confidence).","(≈95% de confiança)."],
"(con {n} operaciones). Tu promedio por trade es negativo o nulo:":["(with {n} trades). Your average per trade is negative or zero:","(com {n} operações). Sua média por trade é negativa ou nula:"],
"hoy los datos no muestran ventaja":["today the data shows no edge","hoje os dados não mostram vantagem"],
"Para llegar a t≈2 con tu media y desvío actuales harían falta unas":["To reach t≈2 with your current mean and deviation you would need about","Para chegar a t≈2 com sua média e desvio atuais seriam necessárias cerca de"],
"operaciones (te faltan ~{n}).":["trades (~{n} to go).","operações (faltam ~{n})."],"operaciones.":["trades.","operações."],
"Aproximación estadística que asume operaciones independientes; sirve como referencia, no como garantía.":["Statistical approximation assuming independent trades; a reference, not a guarantee.","Aproximação estatística que assume operações independentes; serve como referência, não como garantia."],
"{n} días operados · promedio diario":["{n} days traded · daily average","{n} dias operados · média diária"],
"· desvío diario":["· daily deviation","· desvio diário"],"· peor día":["· worst day","· pior dia"],"· días positivos":["· positive days","· dias positivos"],
"Tu mejor día representa el":["Your best day accounts for","Seu melhor dia representa"],
"de tu ganancia total. Muchos fondeos limitan ese porcentaje (regla de consistencia): revisá la de tu cuenta.":["of your total profit. Many funded programs cap this percentage (consistency rule): check your account's.","do seu lucro total. Muitas mesas proprietárias limitam essa porcentagem (regra de consistência): confira a da sua conta."],
"Se repiten tus {n} operaciones {s} veces sacándolas al azar de tu historial. Muestra cuánto puede variar el resultado solo por el orden de la suerte, con la misma estrategia.":["Your {n} trades are repeated {s} times, drawn at random from your history. It shows how much the result can vary from luck alone, with the same strategy.","Suas {n} operações são repetidas {s} vezes, sorteadas do seu histórico. Mostra quanto o resultado pode variar só pela sorte, com a mesma estratégia."],
"Métrica":["Metric","Métrica"],"Mejor caso (5%)":["Best case (5%)","Melhor caso (5%)"],"Típico (mediana)":["Typical (median)","Típico (mediana)"],"Peor caso (5%)":["Worst case (5%)","Pior caso (5%)"],
"Resultado final":["Final result","Resultado final"],"Racha de pérdidas":["Losing streak","Sequência de perdas"],
"Probabilidad de terminar en negativo con este mismo número de operaciones:":["Probability of ending negative with this same number of trades:","Probabilidade de terminar no negativo com este mesmo número de operações:"],
". Asume que los trades son independientes entre sí.":[". Assumes trades are independent of each other.",". Assume que os trades são independentes entre si."],
"Básico":["Basic","Básico"],
"Diario (hasta 15 operaciones)":["Journal (up to 15 trades)","Diário (até 15 operações)"],
"Estadísticas básicas (win rate, P/L neto)":["Basic stats (win rate, net P/L)","Estatísticas básicas (win rate, P/L líquido)"],
"Operaciones ilimitadas":["Unlimited trades","Operações ilimitadas"],"Análisis por día de la semana":["Weekday analysis","Análise por dia da semana"],
"Calendario de resultados":["Results calendar","Calendário de resultados"],"Estadísticas de TP / SL":["TP / SL statistics","Estatísticas de TP / SL"],
"Importar reportes de MetaTrader":["Import MetaTrader reports","Importar relatórios do MetaTrader"],
"Análisis por sesión (Asia / Londres / NY)":["Session analysis (Asia / London / NY)","Análise por sessão (Ásia / Londres / NY)"],
"Varianza y simulación Monte Carlo":["Variance and Monte Carlo simulation","Variância e simulação Monte Carlo"],"Todo lo de Básico":["Everything in Basic","Tudo do Básico"],
"Elegir este plan":["Choose this plan","Escolher este plano"],"/mes":["/mo","/mês"],"Plan actual":["Current plan","Plano atual"],
"Pasar a Plan {p}":["Switch to {p} plan","Mudar para o plano {p}"],"Volver a Plan {p}":["Back to {p} plan","Voltar ao plano {p}"],
"Vas a cambiar al plan {p} ({q}). Esto es una simulación: no se realiza ningún cobro real.":["You are switching to the {p} plan ({q}). This is a simulation: no real charge is made.","Você vai mudar para o plano {p} ({q}). Isto é uma simulação: nenhuma cobrança real é feita."],
"Vas a volver al plan {p}. Podrías perder acceso a funciones que ya desbloqueaste.":["You are going back to the {p} plan. You could lose access to features you already unlocked.","Você vai voltar ao plano {p}. Pode perder acesso a recursos que já desbloqueou."],
"Poné una fecha.":["Pick a date.","Informe uma data."],"Completá email y contraseña.":["Enter email and password.","Preencha email e senha."],
"Inicio":["Home","Início"],
"Tu diario de trading, con datos que importan":["Your trading journal, with data that matters","Seu diário de trading, com dados que importam"],
"Importá tu reporte de MetaTrader y descubrí qué días, sesiones y hábitos te hacen ganar o perder.":["Import your MetaTrader report and find out which days, sessions and habits make you win or lose.","Importe seu relatório do MetaTrader e descubra quais dias, sessões e hábitos fazem você ganhar ou perder."],
"Entrar al dashboard":["Go to dashboard","Entrar no dashboard"],
"Qué podés hacer":["What you can do","O que você pode fazer"],
"Importación de MetaTrader":["MetaTrader import","Importação do MetaTrader"],
"Subí tu reporte de MT4/MT5 y se carga solo, con comisiones incluidas.":["Upload your MT4/MT5 report and it loads automatically, commissions included.","Envie seu relatório do MT4/MT5 e ele carrega sozinho, com comissões incluídas."],
"Análisis por día y sesión":["Analysis by day and session","Análise por dia e sessão"],
"Descubrí cuándo rendís mejor: Asia, Londres o Nueva York.":["Find out when you perform best: Asia, London or New York.","Descubra quando você rende mais: Ásia, Londres ou Nova York."],
"Mirá cada día en verde o en rojo, con sus trades y su P/L.":["See every day in green or red, with its trades and P/L.","Veja cada dia no verde ou no vermelho, com seus trades e P/L."],
"Medí cuánto es ventaja y cuánto es suerte, con simulaciones Monte Carlo.":["Measure how much is edge and how much is luck, with Monte Carlo simulations.","Meça quanto é vantagem e quanto é sorte, com simulações Monte Carlo."],
"Cuántas ganadoras tocaron TP y cuántas perdedoras SL.":["How many winners hit TP and how many losers hit SL.","Quantas ganhadoras bateram TP e quantas perdedoras bateram SL."],
"En tu idioma":["In your language","No seu idioma"],
"Disponible en español, inglés y portugués.":["Available in Spanish, English and Portuguese.","Disponível em espanhol, inglês e português."],
"Empezá gratis":["Start for free","Comece grátis"],
"El plan Lite no tiene costo. Sin tarjeta, sin vueltas.":["The Lite plan is free. No card, no hassle.","O plano Lite é gratuito. Sem cartão, sem complicação."],
"El trading implica riesgo de pérdida. Esta herramienta es solo de análisis y no constituye asesoramiento financiero.":["Trading involves risk of loss. This tool is for analysis only and is not financial advice.","O trading envolve risco de perda. Esta ferramenta é apenas de análise e não constitui aconselhamento financeiro."]
});
const PATTERNS=[];
Object.keys(I18N).forEach(k=>{
  if(!k.includes('{')) return;
  const names=[];
  const rx=new RegExp('^'+k.replace(/[.*+?^$()|[\]\\]/g,'\\$&').replace(/\{(\w+)\}/g,(m,n)=>{names.push(n);return '(.+?)';})+'$');
  PATTERNS.push({rx,names,k});
});
let LANG='es';
function xlate(key,lang){
  if(lang==='es') return key;
  const i=lang==='en'?0:1, e=I18N[key];
  if(e) return e[i];
  for(const p of PATTERNS){
    const m=key.match(p.rx);
    if(m){ let out=I18N[p.k][i]; p.names.forEach((n,j)=>{ const v=m[j+1]; out=out.split('{'+n+'}').join(I18N[v]?I18N[v][i]:v); }); return out; }
  }
  return null;
}
function T(es){ const r=xlate(es,LANG); return r===null?es:r; }

const NODE_REC=new WeakMap();
function trNode(n){
  const t=n.nodeValue.trim(); if(!t) return;
  let rec=NODE_REC.get(n);
  if(rec && t!==rec.shown){ rec=null; NODE_REC.delete(n); }
  const key=rec?rec.key:t;
  const out=LANG==='es'?key:xlate(key,LANG);
  if(out===null || (!rec && LANG==='es')) return;
  if(!rec){ rec={key,shown:key}; NODE_REC.set(n,rec); }
  if(out!==rec.shown){ n.nodeValue=n.nodeValue.replace(rec.shown,()=>out); rec.shown=out; }
}
function trAttr(el){
  el.__i18n=el.__i18n||{};
  ['placeholder','title','aria-label'].forEach(a=>{
    const v=el.getAttribute(a); if(v===null) return;
    let rec=el.__i18n[a];
    if(rec && v!==rec.shown) rec=null;
    const key=rec?rec.key:v;
    const out=LANG==='es'?key:xlate(key,LANG);
    if(out===null || (!rec && LANG==='es')) return;
    if(!rec) rec=el.__i18n[a]={key,shown:key};
    if(out!==rec.shown){ el.setAttribute(a,out); rec.shown=out; }
  });
}
function walkI18n(root){
  const tw=document.createTreeWalker(root,4); let n;
  while((n=tw.nextNode())){ const pn=n.parentNode&&n.parentNode.nodeName; if(pn!=='SCRIPT'&&pn!=='STYLE') trNode(n); }
  if(root.nodeType===1){
    if(root.matches('[placeholder],[title],[aria-label]')) trAttr(root);
    root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(trAttr);
  }
}
function applyLang(l,initial){
  LANG=l;
  try{ localStorage.setItem(LANG_KEY,l); }catch(e){}
  document.documentElement.lang=l;
  document.querySelectorAll('.lang-select').forEach(sel=>sel.value=l);
  document.querySelectorAll('[data-dow]').forEach((e,i)=>e.textContent=DOW[l][i]);
  walkI18n(document.body);
  if(!initial) renderCalendar();
}
function initLang(){
  let l=null; try{ l=localStorage.getItem(LANG_KEY); }catch(e){}
  if(!l){ const nl=(navigator.language||'es').slice(0,2); l=(nl==='en'||nl==='pt')?nl:'es'; }
  new MutationObserver(muts=>muts.forEach(m=>{
    if(m.type==='characterData') trNode(m.target);
    m.addedNodes.forEach(nd=>{ if(nd.nodeType===3) trNode(nd); else if(nd.nodeType===1) walkI18n(nd); });
  })).observe(document.body,{childList:true,subtree:true,characterData:true});
  document.querySelectorAll('.lang-select').forEach(sel=>sel.addEventListener('change',()=>applyLang(sel.value)));
  applyLang(l,true);
}

/* ================== INICIO ================== */
function currentView(){ const h=(location.hash||'#home').slice(1); return ['home','dashboard','planes'].includes(h)?h:'home'; }
function gate(){
  const need = PAGE==='home' ? false : (PAGE==='spa' ? currentView()!=='home' : true);
  document.getElementById('login-overlay').style.display = (!getUser() && need) ? 'flex' : 'none';
}
gate();
refreshAccountBar();
applyGating();
initLang();
function spaRoute(){
  const v=currentView();
  document.querySelectorAll('.spa-view').forEach(e=>e.style.display=e.dataset.view===v?'block':'none');
  window.scrollTo(0,0); gate();
  if(v==='planes') renderPlans();
}
if(PAGE==='spa'){ window.addEventListener('hashchange',spaRoute); spaRoute(); }
if(PAGE==='planes') renderPlans();

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
  if(!date){ alert(T('Poné una fecha.')); return; }
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
