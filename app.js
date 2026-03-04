// ==== Config storage ====
const cfg = {
  get url(){ return localStorage.getItem('API_URL')||''; },
  set url(v){ localStorage.setItem('API_URL', v||''); },
  get token(){ return localStorage.getItem('API_TOKEN')||''; },
  set token(v){ localStorage.setItem('API_TOKEN', v||''); },
  get gid(){ return localStorage.getItem('GOOGLE_CLIENT_ID')||''; },
  set gid(v){ localStorage.setItem('GOOGLE_CLIENT_ID', v||''); }
};
function byId(id){ return document.getElementById(id); }

// ==== Auth (Google Identity Services) ====
let auth = { idToken: '', profile: null };
function initGoogle() {
  const clientId = cfg.gid; if (!clientId) return;
  google.accounts.id.initialize({ client_id: clientId, callback: handleCredentialResponse, auto_select: false });
  google.accounts.id.renderButton(byId('g_id_signin'), { theme:'outline', size:'large', shape:'pill' });
}
function handleCredentialResponse(resp){
  auth.idToken = resp.credential;
  const payload = JSON.parse(atob(resp.credential.split('.')[1]));
  auth.profile = { email: payload.email, name: payload.name, picture: payload.picture, sub: payload.sub };
  byId('g_id_signin').style.display = 'none';
  const box = byId('userBox'); box.classList.remove('hide');
  byId('userName').textContent = auth.profile.name || '';
  byId('userEmail').textContent = auth.profile.email || '';
  byId('userPic').src = auth.profile.picture || '';
  loadList(); setupDashboardDefaults(); loadDashboard();
}
function signOut(){ auth = { idToken:'', profile:null }; byId('userBox').classList.add('hide'); byId('g_id_signin').style.display = ''; }

// ==== Time & Date ====
function buildTimeSlots() {
  const select = byId('time'); select.innerHTML = '';
  const start = 9*60, end = 17*60, step = 30;
  for (let m=start; m<=end; m+=step) {
    const h = Math.floor(m/60), mm = m%60;
    const dt = new Date(0,0,0,h,mm);
    const label = dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const value = `${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
    const opt = document.createElement('option'); opt.value = value; opt.textContent = label; select.appendChild(opt);
  }
  const now = new Date(); const minutes = now.getHours()*60 + now.getMinutes();
  let nearest = start;
  if (minutes < start) nearest = start; else if (minutes > end) nearest = end; else {
    const rem = (minutes - start) % step; nearest = rem < step/2 ? minutes - rem : minutes + (step - rem); nearest = Math.max(start, Math.min(end, nearest));
  }
  const h = String(Math.floor(nearest/60)).padStart(2,'0'); const mm = String(nearest%60).padStart(2,'0'); select.value = `${h}:${mm}`;
}
function setTodayDates(){ const today=new Date(); const iso=today.toISOString().slice(0,10); byId('date').value=iso; byId('filterDate').value=iso; byId('printDate').value=iso; }

// ==== API wrappers (send text/plain to avoid preflight) ====
function mustAuth(){ if (!auth.idToken){ alert('Please Sign in with Google first.'); throw new Error('No auth'); } }
async function apiList(params={}){
  mustAuth(); const url = new URL(cfg.url); url.searchParams.set('action','list'); url.searchParams.set('token',cfg.token);
  if (params.date) url.searchParams.set('date', params.date);
  if (params.mine) url.searchParams.set('mine', 'true');
  if (params.dateFrom) url.searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) url.searchParams.set('dateTo', params.dateTo);
  if (auth.idToken) url.searchParams.set('idToken', auth.idToken);
  const res = await fetch(url, { method:'GET' }); return res.json();
}
async function apiCreate(payload){ mustAuth(); const res = await fetch(cfg.url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action:'create', token:cfg.token, idToken:auth.idToken, ...payload}) }); return res.json(); }
async function apiUpdate(payload){ mustAuth(); const res = await fetch(cfg.url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action:'update', token:cfg.token, idToken:auth.idToken, ...payload}) }); return res.json(); }
async function apiDelete(id){ mustAuth(); const res = await fetch(cfg.url, { method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body: JSON.stringify({action:'delete', token:cfg.token, idToken:auth.idToken, ID:id}) }); return res.json(); }

// ==== List & Form ====
function readForm(){ return { Date:byId('date').value, Time:byId('time').value, Activity:byId('activity').value.trim(), Output:byId('output').value.trim(), FollowUp:byId('followup').value.trim(), Comment:byId('comment').value.trim(), Notes:byId('notes').value.trim(), Delivery:byId('delivery').value.trim() }; }
function fillForm(rec){ byId('recordId').value=rec.ID||''; byId('date').value=rec.Date||''; byId('time').value=(rec.Time||'').slice(0,5); byId('activity').value=rec.Activity||''; byId('output').value=rec.Output||''; byId('followup').value=rec.FollowUp||''; byId('comment').value=rec.Comment||''; byId('notes').value=rec.Notes||''; byId('delivery').value=rec.Delivery||''; window.scrollTo({top:0,behavior:'smooth'}); }
function resetForm(){ byId('recordId').value=''; ['activity','output','followup','comment','notes','delivery'].forEach(id=> byId(id).value=''); setTodayDates(); buildTimeSlots(); }
function renderTable(rows){ const tbody=byId('dataTable').querySelector('tbody'); tbody.innerHTML=''; (rows||[]).forEach(rec=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${(rec.Time||'').slice(0,5)}</td><td>${rec.Activity||''}</td><td>${rec.Output||''}</td><td>${rec.FollowUp||''}</td><td>${rec.Comment||''}</td><td>${rec.Notes||''}</td><td>${rec.Delivery||''}</td><td><button class="btn btn-soft btn-edit">Edit</button> <button class="btn btn-soft btn-del">Delete</button></td>`; tr.querySelector('.btn-edit').onclick=()=>fillForm(rec); tr.querySelector('.btn-del').onclick=async()=>{ if(!confirm('এই রেকর্ডটি ডিলিট করবেন?')) return; const r=await apiDelete(rec.ID); if(r.ok) loadList(); else alert(r.error||'Delete failed'); }; tbody.appendChild(tr); }); }
async function loadList(){ try{ const date=byId('filterDate').value; const mine=byId('mineOnly').checked; const res=await apiList({date,mine}); if(res.ok) renderTable(res.data); else alert(res.error||'Load failed'); }catch(e){ console.error(e); } }

// ==== Export ====
function exportCSV(rows){ const headers=['Date','Time','Activity','Output','FollowUp','Comment','Notes','Delivery','CreatedBy','CreatedAt','UpdatedAt','ID']; const csv=[headers.join(',')].concat((rows||[]).map(r=>headers.map(h=>{ const v=(r[h]||'').toString().replaceAll('"','""'); return '"'+v+'"'; }).join(','))).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='daily-activity.csv'; a.click(); }
function exportXLSX(rows){ const ws = XLSX.utils.json_to_sheet(rows||[]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Activities'); XLSX.writeFile(wb, 'daily-activity.xlsx'); }

// ==== Dashboard ====
let charts = {};
function setupDashboardDefaults(){ const today=new Date(); const first=new Date(today); first.setDate(today.getDate()-6); byId('fromDate').value=first.toISOString().slice(0,10); byId('toDate').value=today.toISOString().slice(0,10); }
function groupByDate(rows){ const m=new Map(); rows.forEach(r=>{ const d=r.Date; m.set(d,(m.get(d)||0)+1); }); const dates=Array.from(m.keys()).sort(); const vals=dates.map(d=>m.get(d)); return {dates, vals}; }
function groupByWeek(rows){ const m=new Map(); rows.forEach(r=>{ const d=new Date(r.Date+'T00:00:00'); const onejan=new Date(d.getFullYear(),0,1); const week=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7); const key=`${d.getFullYear()}-W${String(week).padStart(2,'0')}`; m.set(key,(m.get(key)||0)+1); }); const keys=Array.from(m.keys()).sort(); return {labels:keys, vals:keys.map(k=>m.get(k))}; }
function groupByMonth(rows){ const m=new Map(); rows.forEach(r=>{ const key=r.Date.slice(0,7); m.set(key,(m.get(key)||0)+1); }); const keys=Array.from(m.keys()).sort(); return {labels:keys, vals:keys.map(k=>m.get(k))}; }
function drawChart(id, labels, data){ if(charts[id]) charts[id].destroy(); const ctx=byId(id).getContext('2d'); charts[id]=new Chart(ctx,{ type:'line', data:{ labels, datasets:[{ label:'এন্ট্রি সংখ্যা', data, borderColor:'#7c5cff', backgroundColor:'rgba(124,92,255,.18)', fill:true, tension:.25 }] }, options:{ plugins:{ legend:{ display:true, labels:{ color:'#e6eef8' } } }, scales:{ x:{ ticks:{ color:'#cfe3ff' }, grid:{ color:'rgba(255,255,255,.08)' } }, y:{ beginAtZero:true, ticks:{ color:'#cfe3ff' }, grid:{ color:'rgba(255,255,255,.08)' } } } }}); }
async function loadDashboard(){ try{ const dateFrom=byId('fromDate').value; const dateTo=byId('toDate').value; const mine=byId('dashMine').checked; const res=await apiList({dateFrom,dateTo,mine}); if(!res.ok) return alert(res.error||'Load failed'); const rows=res.data; const total=rows.length; const withOutput=rows.filter(r=> (r.Output||'').trim()!=='').length; const ul=byId('summary'); ul.innerHTML=''; [ `মোট এন্ট্রি: ${total}`, `আউটপুট দেওয়া হয়েছে: ${withOutput}`, `তারিখ পরিসর: ${dateFrom} → ${dateTo}` ].forEach(t=>{ const li=document.createElement('li'); li.textContent=t; ul.appendChild(li); }); const d=groupByDate(rows); drawChart('chartDaily', d.dates, d.vals); const w=groupByWeek(rows); drawChart('chartWeekly', w.labels, w.vals); const m=groupByMonth(rows); drawChart('chartMonthly', m.labels, m.vals); }catch(e){ console.error(e); } }

// ==== Print ====
function renderPrint(rows, date){ byId('printDateText').textContent = date; const tbody=byId('printRows'); tbody.innerHTML=''; let notes=[], deliveries=[]; (rows||[]).forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${(r.Time||'').slice(0,5)}</td><td>${r.Activity||''}</td><td>${r.Output||''}</td>`; tbody.appendChild(tr); if (r.Notes) notes.push(r.Notes); if (r.Delivery) deliveries.push(r.Delivery); }); byId('printNotes').textContent = notes.join('\n\n'); byId('printDelivery').textContent = deliveries.join('\n\n'); }

// ==== Tabs ====
function setActiveTab(tabId){ document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tabId)); document.querySelectorAll('.tabpanel').forEach(p=>p.classList.toggle('show', p.id===tabId)); }

// ==== Save celebration ====
function showSaveCelebration(){ const overlay=byId('saveOverlay'); const confetti = byId('confetti'); confetti.innerHTML=''; const colors=['#7c5cff','#00e5a8','#ffbe0b','#ff7ab6','#cfe3ff']; const count=120; const w=window.innerWidth; const h=window.innerHeight; for(let i=0;i<count;i++){ const s=document.createElement('span'); s.className='confetti'; const size = 6 + Math.random()*8; s.style.width = size+'px'; s.style.height = (size*1.2)+'px'; s.style.left = Math.random()*w + 'px'; s.style.top = (-Math.random()*h*0.25) + 'px'; s.style.background = colors[Math.floor(Math.random()*colors.length)]; const dur = 1.2 + Math.random()*1.2; s.style.animationDuration = dur+'s'; s.style.animationDelay = (Math.random()*0.2)+'s'; s.style.transform = `translateY(-20vh) rotate(${Math.random()*360}deg)`; confetti.appendChild(s); } overlay.classList.remove('hidden'); setTimeout(()=> overlay.classList.add('hidden'), 1800); }

// ==== Boot ====
window.addEventListener('DOMContentLoaded', ()=>{
  // load cfg UI
  byId('apiUrl').value = cfg.url; byId('apiToken').value = cfg.token; byId('googleClientId').value = cfg.gid;
  byId('saveCfg').onclick = ()=>{ cfg.url = byId('apiUrl').value.trim(); cfg.token = byId('apiToken').value.trim(); cfg.gid = byId('googleClientId').value.trim(); alert('Saved configuration'); initGoogle(); };

  // tabs
  document.querySelectorAll('.tab').forEach(btn=> btn.onclick = ()=> setActiveTab(btn.dataset.tab));

  // signout
  byId('signOut').onclick = ()=>{ signOut(); };

  // dates & time
  setTodayDates(); buildTimeSlots();

  // list
  byId('refreshBtn').onclick = loadList; byId('mineOnly').onchange = loadList;

  // save/reset
  byId('resetBtn').onclick = resetForm;
  byId('saveBtn').onclick = async ()=>{
    if (!cfg.url || !cfg.token) return alert('Please set API URL & TOKEN');
    if (!auth.idToken) return alert('Please Sign in with Google');
    const form = readForm(); if (!form.Date) return alert('তারিখ দিন'); if (!form.Time) return alert('সময় বাছাই করুন');
    const id = byId('recordId').value; let res;
    if (id) res = await apiUpdate({ ID:id, ...form }); else res = await apiCreate(form);
    if (res.ok){ resetForm(); loadList(); showSaveCelebration(); } else alert(res.error||'Operation failed');
  };

  // Export
  byId('exportCsv').onclick = async ()=>{ const res = await apiList({ date: byId('filterDate').value, mine: byId('mineOnly').checked }); if (res.ok) exportCSV(res.data); };
  byId('exportXlsx').onclick = async ()=>{ const res = await apiList({ date: byId('filterDate').value, mine: byId('mineOnly').checked }); if (res.ok) exportXLSX(res.data); };

  // Dashboard
  setupDashboardDefaults(); byId('dashLoad').onclick = loadDashboard; byId('dashMine').onchange = loadDashboard;

  // Print
  byId('prepPrint').onclick = async ()=>{ const res = await apiList({ date: byId('printDate').value, mine: byId('printMine').checked }); if (res.ok) renderPrint(res.data, byId('printDate').value); };
  byId('doPrint').onclick = ()=> window.print();

  // init Google button
  if (cfg.gid) initGoogle();
});
