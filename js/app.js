// ========== APP START ==========
document.getElementById('app-version').textContent='v'+APP_VERSION;

function startApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='flex';
  const p=currentProfile||{};
  document.getElementById('tb-name').textContent=p.name||'';
  document.getElementById('tb-av').textContent=initials(p.name)||'?';
  const isAdmin=p.role==='admin';
  if(isAdmin){
    document.getElementById('ni-settings').style.display='flex';
    ['song-add-btn','song-ai-btn','ev-add-btn','ev-chat-btn','ev-export-btn','ev-import-btn','ann-add-btn','cal-add-btn','media-add-btn','media-album-btn'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';});
  }
  SB.channel('rt').on('postgres_changes',{event:'INSERT',schema:'public',table:'announcements'},()=>{loadUnread();if(document.getElementById('page-ann').classList.contains('active'))renderAnn();}).subscribe();
  // Track last seen
  SB.from('profiles').update({last_seen:new Date().toISOString()}).eq('id',currentUser.id).then(()=>{});
  // Setup push notifications
  setupPush();
  loadAutocompleteLists();
  showPage('dashboard');
}

function showPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+name)?.classList.add('active');
  const pages=['dashboard','songs','events','cal','stats','media','settings'];
  const navItems=document.querySelectorAll('.ni');
  const idx=pages.indexOf(name);
  if(idx>=0&&navItems[idx])navItems[idx].classList.add('active');
  // Push to browser history
  if(history.state?.page!==name){
    history.pushState({page:name},'',window.location.pathname+'#'+name);
  }
  const loaders={dashboard:renderDash,ann:renderAnn,songs:renderSongs,events:renderEvents,cal:()=>{if(window.innerWidth<=600&&calView==='3month')calView='month';renderCal();},stats:initStats,media:renderMedia,settings:renderSettings};
  if(loaders[name])loaders[name]();
}
// Handle browser back/forward
window.addEventListener('popstate',e=>{
  const page=e.state?.page||location.hash.replace('#','')||'dashboard';
  // Show page without pushing to history again
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
  const pages=['dashboard','songs','events','cal','stats','media','settings'];
  const navItems=document.querySelectorAll('.ni');
  const idx=pages.indexOf(page);
  if(idx>=0&&navItems[idx])navItems[idx].classList.add('active');
  const loaders={dashboard:renderDash,ann:renderAnn,songs:renderSongs,events:renderEvents,cal:()=>{if(window.innerWidth<=600)calView='month';renderCal();},stats:initStats,media:renderMedia,settings:renderSettings};
  if(loaders[page])loaders[page]();
});

// ========== PUSH NOTIFICATIONS ==========
const VAPID_PUBLIC='BPp1ZDfFrJXJ9dIq4H4_2or4nRdTCere6_EchSDS7hn40zUaWpiuDH1SDT1YBL7OTkkdX4ZdGIjOgq-NQu-jsfg';

async function setupPush(){
  if(!('serviceWorker' in navigator))return;
  // Register SW in background, don't await
  navigator.serviceWorker.register('/chor-manager/sw.js').catch(e=>console.log('SW:',e));
}

async function enablePush(){
  const btn=document.getElementById('push-btn');
  const log=s=>{T(s);console.log('Push:',s);if(btn)btn.textContent=s;};
  try{
    if(!('serviceWorker' in navigator)){log('\u274c Kein SW');return;}
    if(!('PushManager' in window)){log('\u274c Kein PushManager');return;}
    const perm=Notification.permission;
    log('Berechtigung: '+perm);
    if(perm==='denied'){log('\u274c Blockiert - Android Einstellungen > Chrome > Benachrichtigungen');return;}
    let finalPerm=perm;
    if(perm!=='granted'){
      log('Frage Erlaubnis...');
      finalPerm=await Notification.requestPermission();
      log('Antwort: '+finalPerm);
    }
    if(finalPerm!=='granted'){log('\u274c Abgelehnt: '+finalPerm);return;}
    log('SW holen...');
    // Get registration with 8s timeout
    let reg=null;
    const existing=await navigator.serviceWorker.getRegistrations();
    if(existing.length){reg=existing[0];log('SW vorhanden: '+reg.scope);}
    else{
      // Register with timeout
      reg=await Promise.race([
        navigator.serviceWorker.register('/chor-manager/sw.js'),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('SW Timeout - bitte App neu installieren')),8000))
      ]);
      log('SW neu: '+reg.scope);
    }
    log('Push abonnieren...');
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlB64ToUint8(VAPID_PUBLIC)
      });
    }
    log('Speichern...');
    await savePushSub(sub);
    log('\u2713 Aktiv!');
    if(btn)btn.disabled=true;
  }catch(e){log('\u274c '+e.message);}
}


async function savePushSub(sub){
  const json=sub.toJSON();
  await SB.from('push_subscriptions').upsert({
    user_id:currentUser.id,
    endpoint:json.endpoint,
    p256dh:json.keys.p256dh,
    auth:json.keys.auth
  },{onConflict:'endpoint',ignoreDuplicates:false});
}

function urlB64ToUint8(b64){
  const padding='='.repeat((4-b64.length%4)%4);
  const base64=(b64+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}

async function sendPushToAll(title,body){
  try{
    const res=await fetch(SB_URL+'/functions/v1/send-push',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY},
      body:JSON.stringify({title,body,url:'/chor-manager/',badgeCount:1})
    });
    if(!res.ok){
      const txt=await res.text().catch(()=>'');
      console.error('Push Fehler',res.status,txt);
      T('Push-Fehler '+res.status+': '+txt.slice(0,80),'err');
    } else {
      console.log('Push gesendet');
    }
  }catch(e){
    console.error('Push send error:',e);
    T('Push konnte nicht gesendet werden: '+e.message,'err');
  }
}

// ========== UNREAD ==========
async function loadUnread(){
  const{data}=await SB.from('announcements').select('id,announcement_reads(user_id)').order('created_at',{ascending:false});
  if(!data)return;
  const n=data.filter(a=>!(a.announcement_reads||[]).some(r=>r.user_id===currentUser.id)).length;
  document.getElementById('ann-badge').textContent=n;
  document.getElementById('ann-badge').style.display=n?'flex':'none';
  document.getElementById('ndot').style.display=n?'block':'none';
}

// ========== DASHBOARD ==========
async function renderDash(){
  const h=new Date().getHours();
  document.getElementById('d-greet').textContent=`${h<12?'Guten Morgen':h<18?'Guten Tag':'Guten Abend'}, ${firstName((currentProfile||{}).name)}!`;
  const[{count:sc},{count:ec}]=await Promise.all([SB.from('songs').select('*',{count:'exact',head:true}),SB.from('events').select('*',{count:'exact',head:true})]);
  document.getElementById('ds-songs').textContent=sc||0;document.getElementById('ds-events').textContent=ec||0;
  const{data:anns}=await SB.from('announcements').select('*').order('created_at',{ascending:false});
  const unread=(anns||[]).filter(a=>!(a.announcement_reads||[]).some(r=>r.user_id===currentUser.id));
  // Clear app badge when dashboard is viewed
  try{if(navigator.clearAppBadge)navigator.clearAppBadge();}catch(e){}
  // Show active announcements on dashboard (not expired)
  const{data:activeAnns}=await SB.from('announcements').select('*').order('created_at',{ascending:false});
  document.getElementById('d-anns').innerHTML=(activeAnns||[]).filter(a=>!a.expires_at||new Date(a.expires_at)>new Date()).map(a=>`<div style="background:rgba(224,85,85,.08);border:0.5px solid rgba(224,85,85,.35);border-radius:var(--r2);padding:12px 14px;margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="font-size:14px">📢</span>
      <span style="font-size:13px;font-weight:600;color:#f5a0a0">${esc(a.title)}</span>
    </div>
    <div style="font-size:12px;color:var(--text2);line-height:1.5;white-space:pre-wrap">${esc(a.body||'')}</div>
  </div>`).join('');
  const{data:cevts}=await SB.from('calendar_events').select('*').gte('bis_datum',today()).order('datum').limit(4);
  document.getElementById('d-cal').innerHTML=(cevts||[]).length?cevts.map(e=>{
    const isMulti=e.bis_datum&&e.bis_datum!==e.datum;
    const color=e.color||'var(--accent)';
    const isKeinChor=e.status==='kein_chor';
    const isVerschoben=e.status==='verschoben';
    const isAbgesagt=e.status==='abgesagt';
    let statusBadge='';
    if(isKeinChor)statusBadge='<div style="color:#e87070;font-size:11px;font-weight:600;margin-bottom:2px">⚠ Chorprobe fällt aus</div>';
    else if(isVerschoben)statusBadge='<div style="color:#e87070;font-size:11px;font-weight:600;margin-bottom:2px">⚠ Verschoben'+(e.verschoben_auf?' → '+fD(e.verschoben_auf):'')+' </div>';
    else if(isAbgesagt)statusBadge='<div style="color:#e87070;font-size:11px;font-weight:600;margin-bottom:2px">⚠ Abgesagt</div>';
    return`<div class="cevt" style="border-left-color:${esc(color)}${isKeinChor||isVerschoben||isAbgesagt?';border-color:rgba(224,85,85,.3)':''}">
      ${statusBadge}
      <div style="font-weight:500;font-size:13px;${isKeinChor||isAbgesagt?'text-decoration:line-through;opacity:.6':''}">${esc(e.title)}</div>
      <div style="font-size:11px;color:var(--text2)">${fD(e.datum)}${isMulti?' – '+fD(e.bis_datum):''} ${e.uhrzeit?'· '+fT(e.uhrzeit):''} ${e.ort?'· '+esc(e.ort):''}</div>
      ${isMulti?'<span class="badge blue" style="font-size:9px;margin-top:3px">Mehrtägig</span>':''}
    </div>`;
  }).join(''):'<p style="color:var(--text3);font-size:12px">Keine Termine</p>';
  const{data:evts}=await SB.from('events').select('*').gte('datum',today()).order('datum').limit(10);
  const nowD=new Date();
  const upEvts=(evts||[]).filter(e=>{
    if(e.datum>today())return true;
    if(e.datum<today())return false;
    if(!e.uhrzeit)return false;
    const[h,m]=(e.uhrzeit||'00:00').split(':').map(Number);
    const evEnd=new Date(nowD);evEnd.setHours(h+2,m,0,0);
    return nowD<evEnd;
  }).slice(0,3);
  document.getElementById('d-events').innerHTML=upEvts.length?upEvts.map(e=>`<div class="card" onclick="openEvDetail('${e.id}')"><div class="ct">${esc(e.title)}</div><div class="cs">${fD(e.datum)} ${e.uhrzeit?'· '+fT(e.uhrzeit):''} · ${esc(e.ort||'')}</div>${(e.chor||e.thema)?`<div class="cmeta">${e.chor?`<span class="badge">${esc(e.chor)}</span>`:''} ${e.thema?`<span class="badge blue">${esc(e.thema)}</span>`:''}</div>`:''}</div>`).join(''):'<p style="color:var(--text3);font-size:12px">Keine Veranstaltungen</p>';
  loadUnread();
}

// ========== ANNOUNCEMENTS ==========
async function renderAnn(){
  const{data}=await SB.from('announcements').select('*,announcement_reads(user_id),profiles(name)').order('created_at',{ascending:false});
  const el=document.getElementById('ann-list');
  if(!data?.length){el.innerHTML='<div class="empty"><p>Keine Mitteilungen</p></div>';loadUnread();return;}
  const now=new Date();
  const visible=data.filter(a=>{
    if(!a.expires_at)return true;
    const exp=new Date(a.expires_at);
    exp.setHours(23,59,59,999); // end of expiry day
    return exp>now;
  });
  if(!visible.length){el.innerHTML='<div class="empty"><p>Keine Mitteilungen</p></div>';loadUnread();return;}
  el.innerHTML=visible.map(a=>{
    const read=(a.announcement_reads||[]).some(r=>r.user_id===currentUser.id);
    return`<div class="acard ${a.priority} ${read?'':'unread'}" onclick="markRead('${a.id}')">
      <b style="font-size:14px">${esc(a.title)}</b>
      <div style="font-size:13px;color:var(--text2);margin-top:5px;line-height:1.5">${esc(a.body)}</div>
      <div style="font-size:10px;color:var(--text3);margin-top:7px">${fD(a.created_at?.slice(0,10))} · ${esc((a.profiles||{}).name||'Admin')} · <span class="badge ${a.priority==='urgent'?'red':a.priority==='high'?'warn':''}">${a.priority==='urgent'?'Dringend':a.priority==='high'?'Wichtig':'Normal'}</span></div>
      ${currentProfile?.role==='admin'?`<button class="btn btn-d btn-sm" style="margin-top:7px" onclick="event.stopPropagation();delAnn('${a.id}')">Löschen</button>`:''}
    </div>`;
  }).join('');loadUnread();
}
async function markRead(id){await SB.from('announcement_reads').upsert({announcement_id:id,user_id:currentUser.id},{onConflict:'announcement_id,user_id'});loadUnread();}
function openAnnForm(){
  document.getElementById('af-title').value='';
  document.getElementById('af-body').value='';
  document.getElementById('af-exp').value='';
  openModal('m-ann-form');
  renderAnnAdminList();
}
async function renderAnnAdminList(){
  const el=document.getElementById('af-ann-list');if(!el)return;
  const{data}=await SB.from('announcements').select('*').order('created_at',{ascending:false});
  if(!data||!data.length){el.innerHTML='<p style="font-size:12px;color:var(--text3)">Keine aktiven Infos.</p>';return;}
  el.innerHTML='';
  const now=new Date();
  data.forEach(a=>{
    const expired=a.expires_at&&new Date(a.expires_at)<now;
    const row=document.createElement('div');
    row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);margin-bottom:6px;opacity:'+(expired?'.5':'1');
    const info=document.createElement('div');info.style.flex='1';
    info.innerHTML='<div style="font-size:12px;font-weight:500">'+esc(a.title)+'</div>'
      +'<div style="font-size:10px;color:var(--text3)">'+(expired?'⏱ Abgelaufen':'✓ Aktiv')+(a.expires_at?' · bis '+fD(a.expires_at):'')+'</div>';
    const del=document.createElement('button');del.className='btn btn-sm';del.textContent='🗑';
    del.style.cssText='background:rgba(232,112,112,.1);color:#e87070;border:0.5px solid rgba(232,112,112,.3)';
    del.onclick=()=>delAnn(a.id);
    const editBtn=document.createElement('button');editBtn.className='btn btn-sm btn-g';editBtn.textContent='✏️';editBtn.style.marginRight='4px';editBtn.onclick=()=>editAnn(a,false);row.appendChild(info);row.appendChild(editBtn);row.appendChild(del);
    el.appendChild(row);
  });
}
let _editAnnId=null;
async function saveAnn(inSettings=false){
  const title=document.getElementById('af-title').value.trim(),body=document.getElementById('af-body').value.trim();
  if(!title||!body){T('Titel und Text erforderlich','err');return;}
  const exp=document.getElementById('af-exp').value||null;
  if(_editAnnId){
    await SB.from('announcements').update({title,body,expires_at:exp}).eq('id',_editAnnId);
    _editAnnId=null;
    T('Info aktualisiert','ok');
  } else {
    await SB.from('announcements').insert({title,body,priority:'urgent',expires_at:exp,created_by:currentUser.id});
    sendPushToAll('📢 '+title,body.substring(0,100));
    // Set app badge count for all active announcements
    try{const{data:ac}=await SB.from('announcements').select('id').is('expires_at',null);if(navigator.setAppBadge)navigator.setAppBadge(ac?.length||1);}catch(e){}
    T('Info veröffentlicht','ok');
  }
  document.getElementById('af-title').value='';document.getElementById('af-body').value='';document.getElementById('af-exp').value='';
  const pubBtn=document.getElementById('af-pub-btn');if(pubBtn)pubBtn.textContent='📢 Info veröffentlichen';
  if(inSettings)renderSettings('infos');else renderAnnAdminList();
  renderAnn();
}
function editAnn(a,inSettings=false){
  _editAnnId=a.id;
  const t=document.getElementById('af-title');const b=document.getElementById('af-body');const e=document.getElementById('af-exp');
  if(t)t.value=a.title||'';if(b)b.value=a.body||'';if(e)e.value=a.expires_at?a.expires_at.substring(0,10):'';
  const pubBtn=document.getElementById('af-pub-btn');if(pubBtn)pubBtn.textContent='💾 Änderungen speichern';
  t?.scrollIntoView({behavior:'smooth',block:'center'});t?.focus();
}
async function delAnn(id,inSettings=false){if(!confirm('Löschen?'))return;await SB.from('announcements').delete().eq('id',id);if(inSettings)renderSettings('infos');else renderAnnAdminList();renderAnn();T('Info gelöscht');}

