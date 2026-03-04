// ===== Activity One with PWA + Command Palette =====
const CFG = window.__CFG__ || { API_URL:'', API_TOKEN:'', GOOGLE_CLIENT_ID:'' };
const $ = id => document.getElementById(id);
const qa = s => Array.from(document.querySelectorAll(s));

// ---- PWA: register service worker ----
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

// ---- Drawer & navigation ----
const drawer = $('drawer'), scrim = $('scrim');
$('btnMenu').onclick = () => { drawer.classList.add('show'); scrim.classList.add('show'); };
scrim.onclick = () => { drawer.classList.remove('show'); scrim.classList.remove('show'); };
qa('.drawer-nav .nav').forEach(a=> a.onclick = ()=> switchView(a.dataset.view));
qa('.bottom-nav .bn-item').forEach(b=> b.onclick = ()=> switchView(b.dataset.view));
function switchView(name){
  qa('.drawer-nav .nav').forEach(a=> a.classList.toggle('active', a.dataset.view===name));
  qa('.bottom-nav .bn-item').forEach(b=> b.classList.toggle('active', b.dataset.view===name));
  qa('.view').forEach(v=> v.classList.toggle('show', v.id===`view-${name}`));
  if(name==='add'){ $('btnQuickAdd').classList.add('hidden'); } else $('btnQuickAdd').classList.remove('hidden');
  closePalette();
}
$('btnQuickAdd').onclick = ()=> switchView('add');

// ---- Auth (GIS) ----
let auth = { idToken:'', profile:null };
function initGoogle(){ if(!CFG.GOOGLE_CLIENT_ID) return; google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: onCred }); google.accounts.id.renderButton($('btnSignIn'), { theme:'outline', size:'large', shape:'pill' }); }
function onCred(resp){ try{ const p = JSON.parse(atob(resp.credential.split('.')[1])); auth.idToken = resp.credential; auth.profile = { email:p.email, name:p.name, picture:p.picture };
  $('btnSignIn').classList.add('hidden'); $('btnSignOut').classList.remove('hidden');
  $('userChip').classList.remove('hidden'); $('userPic').src=p.picture; $('userName').textContent=p.name;
  $('miniPic').src=p.picture; $('miniName').textContent=p.name; $('miniEmail').textContent=p.email;
  $('pfPic').src=p.picture; $('pfName').textContent=p.name; $('pfEmail').textContent=p.email;
  greet(); defaults(); buildSlots(); loadToday(); loadTrends(); loadList();
}catch(e){ alert('Sign-in failed'); console.error(e); } }
$('btnSignOut').onclick = ()=> location.reload();

function greet(){ const h=new Date().getHours(); const t = h<12? 'Good Morning' : (h<18? 'Good Afternoon' : 'Good Evening'); $('greeting').textContent = `${t}! ${auth.profile?.name?.split(' ')[0]||''}`; }

// ---- Date/Time helpers ----
function todayISO(){ return new Date().toISOString().slice(0,10); }
function defaults(){ const t=todayISO(); ['dashDate','fltDate','printDate','toDate'].forEach(id=> $(id).value=t); const d=new Date(); d.setDate(d.getDate()-6); $('fromDate').value = d.toISOString().slice(0,10); }
function buildSlots(){ const S=$('time'); S.innerHTML=''; const start=9*60,end=17*60,step=30; for(let m=start;m<=end;m+=step){ const h=Math.floor(m/60),mm=m%60; const label=new Date(0,0,0,h,mm).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); const v=`${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`; const o=document.createElement('option'); o.value=v;o.textContent=label; S.appendChild(o);} }

// ---- API helpers ----
function mustAuth(){ if(!auth.idToken) throw new Error('Please Sign in'); }
async function apiList(p={}){ mustAuth(); const url=new URL(CFG.API_URL); url.searchParams.set('action','list'); url.searchParams.set('token',CFG.API_TOKEN); if(p.date) url.searchParams.set('date',p.date); if(p.mine) url.searchParams.set('mine','true'); if(p.dateFrom) url.searchParams.set('dateFrom',p.dateFrom); if(p.dateTo) url.searchParams.set('dateTo',p.dateTo); url.searchParams.set('idToken',auth.idToken); const r=await fetch(url,{method:'GET'}); return r.json(); }
async function apiCreate(body){ mustAuth(); const r=await fetch(CFG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'create',token:CFG.API_TOKEN,idToken:auth.idToken,...body})}); return r.json(); }
async function apiUpdate(body){ mustAuth(); const r=await fetch(CFG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'update',token:CFG.API_TOKEN,idToken:auth.idToken,...body})}); return r.json(); }
async function apiDelete(ID){ mustAuth(); const r=await fetch(CFG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'delete',token:CFG.API_TOKEN,idToken:auth.idToken,ID})}); return r.json(); }

// ---- Dashboard Today ----
$('btnDashReload').onclick=loadToday; $('dashDate').onchange=loadToday; $('dashMine').onchange=loadToday;
async function loadToday(){ const date=$('dashDate').value; const mine=$('dashMine').checked; const r=await apiList({date,mine}); if(!r.ok) return alert(r.error||'Load failed'); renderToday(r.data||[]); $('kpiToday').textContent=(r.data||[]).length; }
function renderToday(rows){ const tb=$('tblToday').querySelector('tbody'); tb.innerHTML=''; let notes=[]; rows.sort((a,b)=>String(a.Time).localeCompare(String(b.Time))).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${(r.Time||'').slice(0,5)}</td><td>${r.Activity||''}</td><td>${r.Output||''}</td>`; tb.appendChild(tr); if(r.Notes) notes.push(r.Notes); }); $('notesBox').classList.remove('skeleton'); $('notesBox').textContent=notes.join('\n\n'); }

// ---- Trends ----
$('btnTrend').onclick=loadTrends; $('trendMine').onchange=loadTrends; let trendChart=null;
async function loadTrends(){ const from=$('fromDate').value; const to=$('toDate').value; const mine=$('trendMine').checked; const r=await apiList({dateFrom:from,dateTo:to,mine}); if(!r.ok) return alert(r.error||'Load failed'); const rows=r.data||[]; const map={}; rows.forEach(x=> map[x.Date]=(map[x.Date]||0)+1); const labels=Object.keys(map).sort(); const vals=labels.map(k=>map[k]); $('kpiWeek').textContent = countWithin(rows,7,to); $('kpiMonth').textContent = countWithin(rows,30,to); drawTrend(labels,vals); }
function countWithin(rows,days,toISO){ const end=new Date(toISO+'T00:00:00'); const start=new Date(end); start.setDate(end.getDate()-(days-1)); return rows.filter(x=> x.Date>=start.toISOString().slice(0,10) && x.Date<=end.toISOString().slice(0,10)).length; }
function drawTrend(labels,data){ if(trendChart) trendChart.destroy(); const ctx=$('chartDaily').getContext('2d'); trendChart=new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ label:'Entries', data, borderColor:'#6ea8ff', backgroundColor:'rgba(110,168,255,.18)', fill:true, tension:.25 }] }, options:{ plugins:{ legend:{ labels:{ color:'#e6edff' } } }, scales:{ x:{ ticks:{ color:'#98a5c0' }, grid:{ color:'rgba(152,165,192,.15)' } }, y:{ beginAtZero:true, ticks:{ color:'#98a5c0' }, grid:{ color:'rgba(152,165,192,.15)' } } } }); }

// ---- List ----
$('btnRefresh').onclick=loadList; $('fltRange').onchange=loadList; $('fltDate').onchange=loadList; $('mineOnly').onchange=loadList;
async function loadList(){ const range=$('fltRange').value; const date=$('fltDate').value; const mine=$('mineOnly').checked; let r; if(range==='today'){ r=await apiList({date,mine}); } else if(range==='week'){ const to=date; const from=new Date(date); from.setDate(from.getDate()-6); r=await apiList({dateFrom:from.toISOString().slice(0,10),dateTo:to,mine}); } else if(range==='month'){ const d=new Date(date); const from=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; const to=new Date(d.getFullYear(),d.getMonth()+1,0).toISOString().slice(0,10); r=await apiList({dateFrom:from,dateTo:to,mine}); } else { r=await apiList({dateFrom:'0001-01-01',dateTo:'9999-12-31',mine}); } if(!r.ok) return alert(r.error||'Load failed'); renderList(r.data||[]); }
function renderList(rows){ const tb=$('tblEntries').querySelector('tbody'); tb.innerHTML=''; rows.forEach(rec=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${(rec.Time||'').slice(0,5)}</td><td>${rec.Activity||''}</td><td>${rec.Output||''}</td><td>${rec.FollowUp||''}</td><td>${rec.Comment||''}</td><td>${rec.Notes||''}</td><td>${rec.Delivery||''}</td><td><button class='pill' data-act='edit'>Edit</button> <button class='pill' data-act='del'>Delete</button></td>`; tr.querySelector("[data-act='edit']").onclick=()=>fillForm(rec); tr.querySelector("[data-act='del']").onclick=async()=>{ if(!confirm('Delete this record?')) return; const r=await apiDelete(rec.ID); if(r.ok) loadList(); else alert(r.error||'Delete failed'); }; tb.appendChild(tr); }); }

// ---- Add / Save ----
$('btnSave').onclick=save; $('btnReset').onclick=()=>{ $('recordId').value=''; ['activity','output','followup','comment','notes','delivery'].forEach(i=> $(i).value=''); defaults(); buildSlots(); };
async function save(){ try{ if(!auth.idToken) return alert('Please Sign in'); const f=readForm(); if(!f.Date||!f.Time) return alert('তারিখ ও সময় দিন'); const id=$('recordId').value; let r; if(id) r=await apiUpdate({ID:id,...f}); else r=await apiCreate(f); if(r.ok){ showSaved(); defaults(); buildSlots(); loadToday(); loadList(); } else alert(r.error||'Operation failed'); }catch(e){ console.error(e); alert('Network error'); } }
function readForm(){ return { Date:$('date').value, Time:$('time').value, Activity:$('activity').value.trim(), Output:$('output').value.trim(), FollowUp:$('followup').value.trim(), Comment:$('comment').value.trim(), Notes:$('notes').value.trim(), Delivery:$('delivery').value.trim() }; }
function fillForm(r){ switchView('add'); $('recordId').value=r.ID||''; $('date').value=r.Date||todayISO(); $('time').value=(r.Time||'').slice(0,5); $('activity').value=r.Activity||''; $('output').value=r.Output||''; $('followup').value=r.FollowUp||''; $('comment').value=r.Comment||''; $('notes').value=r.Notes||''; $('delivery').value=r.Delivery||''; window.scrollTo({top:0,behavior:'smooth'}); }

// ---- Print ----
$('btnPrepPrint').onclick=prepPrint; $('btnDoPrint').onclick=()=>window.print();
async function prepPrint(){ const r=await apiList({ date:$('printDate').value, mine:$('printMine').checked }); if(!r.ok) return alert(r.error||'Load failed'); const rows=r.data||[]; $('pDate').textContent=$('printDate').value; const tb=$('pRows'); tb.innerHTML=''; let notes=[],del=[]; rows.forEach(x=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${(x.Time||'').slice(0,5)}</td><td>${x.Activity||''}</td><td>${x.Output||''}</td>`; tb.appendChild(tr); if(x.Notes) notes.push(x.Notes); if(x.Delivery) del.push(x.Delivery); }); $('pNotes').textContent=notes.join('\n\n'); $('pDelivery').textContent=del.join('\n\n'); }

// ---- Save celebration ----
function showSaved(){ const ov=$('saveOverlay'); const cf=$('confetti'); cf.innerHTML=''; const colors=['#6ea8ff','#10b981','#ef4444','#f59e0b','#a78bfa']; const W=innerWidth,H=innerHeight; for(let i=0;i<120;i++){ const s=document.createElement('span'); s.className='confetti'; s.style.width=(6+Math.random()*8)+'px'; s.style.height=(8+Math.random()*12)+'px'; s.style.left=(Math.random()*W)+'px'; s.style.top=(-Math.random()*H*0.2)+'px'; s.style.background=colors[Math.floor(Math.random()*colors.length)]; s.style.animationDuration=(1+Math.random()*1.4)+'s'; s.style.animationDelay=(Math.random()*0.2)+'s'; s.style.transform=`translateY(-20vh) rotate(${Math.random()*360}deg)`; cf.appendChild(s); }
  ov.classList.add('show'); setTimeout(()=> ov.classList.remove('show'), 1600);
}

// ===== Command Palette =====
const cmd = $('cmd'), cmdInput = $('cmdInput'), cmdList = $('cmdList');
const PALETTE_HINTS = [
  { id:'go:home', label:'Go to Dashboard',   action:()=>switchView('home'), kbd:'G' },
  { id:'go:add',  label:'Go to Add Entry',   action:()=>{ switchView('add'); $('activity').focus(); }, kbd:'A' },
  { id:'go:list', label:'Go to Entries',     action:()=>switchView('list'), kbd:'L' },
  { id:'go:print',label:'Go to Print',       action:()=>switchView('print'), kbd:'P' },
  { id:'quick:add', label:'Quick Add — create a minimal entry with typed text', action:quickAdd, kbd:'Enter' },
  { id:'help',   label:'Help — palette commands (add, home, list, print, profile, today 10:30 Do something)', action:()=>{}, kbd:'?' }
];

function openPalette(){ cmd.classList.remove('hidden'); cmdInput.value=''; renderCmd([]); cmdInput.focus(); }
function closePalette(){ cmd.classList.add('hidden'); }

// Keyboard: ⌘/Ctrl + K  (and Escape to close)
window.addEventListener('keydown', (e)=>{
  const isOpen=!cmd.classList.contains('hidden');
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openPalette(); }
  if(isOpen && e.key==='Escape'){ e.preventDefault(); closePalette(); }
});

cmdInput.addEventListener('input', ()=> searchCommands(cmdInput.value.trim()));
cmdInput.addEventListener('keydown', (e)=>{
  if(e.key==='Enter'){ executeSelected(); }
  if(e.key==='ArrowDown'){ moveSel(1); e.preventDefault(); }
  if(e.key==='ArrowUp'){ moveSel(-1); e.preventDefault(); }
});

let selIdx=-1, currentItems=[];
function renderCmd(items){ currentItems = items.length? items : PALETTE_HINTS; cmdList.innerHTML=''; selIdx=0; currentItems.forEach((it,i)=>{ const li=document.createElement('li'); li.className = i===selIdx? 'active':''; li.innerHTML = `<span>${it.label}</span><span class="kbd">${it.kbd||''}</span>`; li.onclick = ()=>{ selIdx=i; executeSelected(); }; cmdList.appendChild(li); }); }
function moveSel(dir){ if(!currentItems.length) return; selIdx=(selIdx+dir+currentItems.length)%currentItems.length; [...cmdList.children].forEach((li,i)=> li.classList.toggle('active', i===selIdx)); }
function executeSelected(){ if(!currentItems.length) return; const item=currentItems[selIdx]; if(item){ item.action(); closePalette(); } }

function searchCommands(q){
  if(!q){ renderCmd([]); return; }
  const L=q.toLowerCase();
  // Pattern: "today 10:30 Some activity" -> quick create
  const quickPattern = /^(today|tomorrow)?\s*(\d{1,2}:\d{2})?\s*(.*)$/i;
  const m = L.match(quickPattern);
  const items = [];
  if(['home','dashboard'].some(x=>L.startsWith(x))) items.push(PALETTE_HINTS[0]);
  if(['add','new','create'].some(x=>L.startsWith(x))) items.push(PALETTE_HINTS[1], PALETTE_HINTS[4]);
  if(['list','entries'].some(x=>L.startsWith(x))) items.push(PALETTE_HINTS[2]);
  if(['print','preview'].some(x=>L.startsWith(x))) items.push(PALETTE_HINTS[3]);
  if(m && m[3]){ items.push({ id:'quick:typed', label:`Quick Add: ${q}`, action:()=> quickAddFromText(q), kbd:'Enter' }); }
  // If none matched, fallback to hints
  renderCmd(items.length? items : PALETTE_HINTS);
}

async function quickAdd(){
  // Use Activity text from input as payload
  const text = cmdInput.value.trim();
  if(!text) return;
  const now=new Date(); const date=todayISO();
  const HH = String(now.getHours()).padStart(2,'0'); const MM=String(Math.round(now.getMinutes()/5)*5).padStart(2,'0');
  const payload = { Date:date, Time:`${HH}:${MM}`, Activity:text, Output:'', FollowUp:'', Comment:'', Notes:'', Delivery:'' };
  const r=await apiCreate(payload); if(r.ok){ showSaved(); loadToday(); loadList(); } else alert(r.error||'Create failed');
}
function parseQuick(text){
  // patterns: "today 10:30 meeting with team" or "10:30 standup" or just text
  const re=/^(today|tomorrow)?\s*(\d{1,2}:\d{2})?\s*(.*)$/i; const m=text.match(re); const now=new Date();
  let date=todayISO(); if(m && m[1]==='tomorrow'){ const t=new Date(); t.setDate(t.getDate()+1); date=t.toISOString().slice(0,10); }
  let time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`; if(m && m[2]) time=m[2];
  const activity = (m && m[3])? m[3] : text; return {date,time,activity};
}
async function quickAddFromText(text){ const p=parseQuick(text); const payload={ Date:p.date, Time:p.time, Activity:p.activity, Output:'', FollowUp:'', Comment:'', Notes:'', Delivery:'' }; const r=await apiCreate(payload); if(r.ok){ showSaved(); loadToday(); loadList(); } else alert(r.error||'Create failed'); }

// Global shortcuts for direct jumps
window.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey) && !e.shiftKey){ const k=e.key.toLowerCase(); if(k==='1') switchView('home'); if(k==='2') switchView('add'); if(k==='3') switchView('list'); } });

// ---- Boot ----
window.addEventListener('DOMContentLoaded', ()=>{ initGoogle(); defaults(); buildSlots(); });
