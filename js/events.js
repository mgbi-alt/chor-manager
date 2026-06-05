// ========== EVENTS ==========
// ========== EVENTS ==========
let cachedEvents=[];
let evFilter={chor:''};

async function renderEvents(){
  const[{data},{data:placeholders}]=await Promise.all([
    SB.from('events').select('*,event_program(position,song_id,placeholder,songs(title,besetzung))').order('datum'),
    SB.from('event_program').select('placeholder,events(id,title,datum)').not('placeholder','is',null).order('events(datum)',{ascending:false})
  ]);
  cachedEvents=data||[];
  buildEvFilters();
  displayEvents(filteredEvents());
  // Show placeholder list
  const phEl=document.getElementById('ev-placeholders');
  const phBtn=document.getElementById('ev-ph-btn');
  const rawPhs=(placeholders||[]).filter(p=>p.placeholder&&!p.placeholder.startsWith('[Predigt]')&&!p.placeholder.startsWith('[Sonstiges]'));
  const phMap={};rawPhs.forEach(p=>{const k=p.placeholder.trim();if(!phMap[k])phMap[k]={placeholder:k,events:[],count:0};if(p.events)phMap[k].events.push(p.events);phMap[k].count++;});
  const phs=Object.values(phMap).sort((a,b)=>b.count-a.count);
  if(phs.length&&phEl&&phBtn){
    phBtn.style.display='';
    phBtn.textContent=`📌 ${phs.length} offene Platzhalter anzeigen`;
    window._phsHtml=`<div style="background:rgba(232,160,32,.08);border:0.5px solid rgba(232,160,32,.3);border-radius:var(--r2);padding:12px 14px">
      <div style="font-size:10px;font-weight:500;color:var(--warn);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">📌 Offene Platzhalter (${phs.length})</div>
      ${phs.map(p=>`<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:5px 0;border-bottom:0.5px solid rgba(232,160,32,.15);font-size:13px;gap:8px">
        <span style="color:var(--text2)">? ${esc(p.placeholder)}${p.count>1?` <span class="badge warn" style="font-size:9px">${p.count}×</span>`:''}</span>
        <span style="font-size:11px;color:var(--text3);text-align:right">${p.events.slice(0,2).map(e=>`<span style="cursor:pointer;display:block" onclick="openEvDetail('${e?.id||''}')">${esc(e?.title||'')} · ${fD((e?.datum||'').slice(0,10))}</span>`).join('')}${p.events.length>2?`<span style="color:var(--text3)">+${p.events.length-2}</span>`:''}</span>
      </div>`).join('')}
    </div>`;
    phEl.style.display='none';
    window._phVisible=false;
  } else if(phEl&&phBtn){
    phBtn.style.display='none';
    phEl.style.display='none';
  }
}

function togglePlaceholders(){
  const phEl=document.getElementById('ev-placeholders');
  const phBtn=document.getElementById('ev-ph-btn');
  window._phVisible=!window._phVisible;
  if(window._phVisible){
    phEl.innerHTML=window._phsHtml||'';
    phEl.style.display='';
    phBtn.textContent=phBtn.textContent.replace('anzeigen','ausblenden');
  } else {
    phEl.style.display='none';
    phBtn.textContent=phBtn.textContent.replace('ausblenden','anzeigen');
  }
}

function buildEvFilters(){
  const chors=[...new Set(cachedEvents.map(e=>e.chor).filter(Boolean))];
  const el=document.getElementById('ev-filters');
  if(!el)return;
  el.innerHTML='';
  chors.forEach(val=>{
    const c=document.createElement('div');
    c.className='fchip'+(evFilter.chor===val?' active':'');
    c.textContent=val;
    c.onclick=()=>{evFilter.chor=evFilter.chor===val?'':val;buildEvFilters();displayEvents(filteredEvents());};
    el.appendChild(c);
  });
}

function filteredEvents(){
  const q=(document.getElementById('ev-search')?.value||'').toLowerCase();
  const from=document.getElementById('ev-from')?.value||'';
  const to=document.getElementById('ev-to')?.value||'';
  return cachedEvents.filter(e=>{
    if(q&&!['title','chor','thema','ort','dirigent'].some(k=>(e[k]||'').toLowerCase().includes(q)))return false;
    if(evFilter.chor&&e.chor!==evFilter.chor)return false;
    if(from&&e.datum&&e.datum<from)return false;
    if(to&&e.datum&&e.datum>to)return false;
    return true;
  });
}

function filterEvents(){displayEvents(filteredEvents());}

function displayEvents(data){
  const el=document.getElementById('ev-list');
  if(!data?.length){el.innerHTML='<div class="empty"><p>Keine Veranstaltungen</p></div>';return;}
  const nowDate=new Date();
  const now2h=new Date(nowDate.getTime()-2*60*60*1000);
  const todayStr=now2h.toISOString().slice(0,10);
  const up=data.filter(e=>{
    if(e.datum>todayStr)return true;
    if(e.datum<todayStr)return false;
    // Same day: check time + 2h
    if(!e.uhrzeit)return false;
    const[h,m]=(e.uhrzeit||'00:00').split(':').map(Number);
    const evEnd=new Date(nowDate);
    evEnd.setHours(h+2,m,0,0);
    return nowDate<evEnd;
  });
  const pa=data.filter(e=>!up.includes(e)).reverse();
  let html='';
  if(up.length)html+='<div class="st">Bevorstehend</div>'+up.map(evCard).join('');
  if(pa.length)html+='<div class="st">Vergangen</div>'+pa.map(evCard).join('');
  el.innerHTML=html;
}
function evCard(e){
  const n=(e.event_program||[]).filter(p=>p.song_id||(p.placeholder&&!p.placeholder.startsWith('[Predigt]')&&!p.placeholder.startsWith('[Sonstiges]'))).length;
  return`<div class="card" onclick="openEvDetail('${e.id}')">
    <div class="crow"><div style="flex:1"><div class="ct">${esc(e.title)}</div><div class="cs">${fD(e.datum)}${e.uhrzeit?' · '+fT(e.uhrzeit):''} · ${esc(e.ort||'')}</div></div>
    <div>${n?`<span class="badge blue">${n} Lieder</span>`:''}</div></div>
    <div class="cmeta">
      ${e.dirigent?`<span class="badge green">Verantw.: ${esc(e.dirigent)}</span>`:''}
      ${e.chor?`<span class="badge">${esc(e.chor)}</span>`:''}
      ${e.thema?`<span class="badge blue">${esc(e.thema)}</span>`:''}
    </div>
  </div>`;
}
async function openEvDetail(id){
  const{data:e}=await SB.from('events').select('*,event_program(id,position,song_id,dirigent,klavier,instrumente,placeholder,songs(title,liedanfang,besetzung)),event_tasks(*),attendance(member_id,status,profiles(name,stimme))').eq('id',id).single();
  if(!e)return;
  const isAdmin=currentProfile?.role==='admin';
  const prog=(e.event_program||[]).sort((a,b)=>a.position-b.position);
  document.getElementById('ed-title').textContent=e.title;
  document.getElementById('ed-body').innerHTML=`
    <div class="dgrid" style="margin-bottom:12px">
      <div class="df"><div class="dl">Datum</div><div class="dv">${fD(e.datum)}</div></div>
      <div class="df"><div class="dl">Uhrzeit</div><div class="dv">${fT(e.uhrzeit)||'–'}</div></div>
      <div class="df" style="grid-column:1/-1"><div class="dl">Ort</div><div class="dv">${esc(e.ort||'–')}</div></div>
    </div>
    <div class="ddiv"></div>
    <div class="dl" style="margin-bottom:7px">Programm</div>
    ${prog.length?prog.map(p=>{
      if(p.placeholder?.startsWith('[Predigt] ')){
        const parts=p.placeholder.slice(10).split('|');
        return`<div class="pitem"><div style="display:flex;align-items:center;gap:9px"><div class="pnum">${p.position}</div><div style="flex:1"><div style="font-size:13px;font-weight:500">\ud83c\udfa4 Predigt${parts[0]?' \u2013 '+esc(parts[0]):''}</div><div style="font-size:11px;color:var(--text2)">${[parts[1],parts[2]].filter(Boolean).map(esc).join(' \u00b7 ')}</div></div></div></div>`;
      }
      if(p.placeholder?.startsWith('[Sonstiges] ')){
        const parts=p.placeholder.slice(12).split('|');
        return`<div class="pitem"><div style="display:flex;align-items:center;gap:9px"><div class="pnum">${p.position}</div><div style="flex:1"><div style="font-size:13px;font-weight:500">\u2726 ${esc(parts[0]||'Sonstiges')}</div>${parts[1]?`<div style="font-size:11px;color:var(--text2)">${esc(parts[1])}</div>`:''}</div></div></div>`;
      }
      const la=p.songs?.liedanfang,ti=p.songs?.title;
      const songLabel=p.placeholder?`<span style="color:var(--text3)">? ${esc(p.placeholder)}</span>`:(la?(ti&&ti!==la?`${esc(la)} <span style="color:var(--text3)">|</span> ${esc(ti)}`:esc(la)):esc(ti||'?'));
      return`<div class="pitem"><div style="display:flex;align-items:center;gap:9px"><div class="pnum">${p.position}</div><div style="flex:1"><div style="font-size:13px;font-weight:500">${songLabel}</div><div style="font-size:11px;color:var(--text2)">${p.placeholder?'Platzhalter':esc(p.songs?.besetzung||'')}</div></div></div>${(p.dirigent||p.klavier||p.instrumente)?`<div style="margin-top:6px;padding-top:6px;border-top:0.5px solid var(--border)">${p.dirigent?`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:var(--text3)">Dirigent</span><span>${esc(p.dirigent)}</span></div>`:''}${p.klavier?`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:var(--text3)">Klavier</span><span>${esc(p.klavier)}</span></div>`:''}${p.instrumente?`<div style="display:flex;justify-content:space-between;font-size:11px;padding:2px 0"><span style="color:var(--text3)">Instrumente</span><span>${esc(p.instrumente)}</span></div>`:''}</div>`:''}</div>`;
    }).join(''):'<p style="color:var(--text3);font-size:12px">Kein Programm</p>'}
    <div class="ddiv"></div>
    <div class="dl" style="margin-bottom:7px">Rollen</div>
    <div style="background:var(--card);border-radius:var(--r);border:0.5px solid var(--border)">${[['Verantwortlich',e.dirigent],['Chor',e.chor],['Thema',e.thema]].filter(([,v])=>v).map(([l,v])=>`<div style="display:flex;justify-content:space-between;padding:7px 11px;border-bottom:0.5px solid var(--border);font-size:13px"><span style="color:var(--text2)">${l}</span><span>${esc(v)}</span></div>`).join('')}${(e.event_tasks||[]).map(t=>`<div style="display:flex;justify-content:space-between;padding:7px 11px;border-bottom:0.5px solid var(--border);font-size:13px"><span style="color:var(--text2)">${esc(t.aufgabe)}</span><span>${esc(t.person)}</span></div>`).join('')}</div>
    <div class="ddiv"></div>
    <div class="dl" style="margin-bottom:7px">Anwesenheit</div>
    ${(()=>{
      const att=e.attendance||[];
      const yes=att.filter(m=>m.status==='yes').length;
      const no=att.filter(m=>m.status==='no').length;
      return`${yes||no?`<div style="display:flex;gap:12px;margin-bottom:10px">
        ${yes?`<div style="text-align:center"><div style="font-size:18px;font-weight:600;color:var(--success)">${yes}</div><div style="font-size:10px;color:var(--text3)">anwesend</div></div>`:''}
        ${no?`<div style="text-align:center"><div style="font-size:18px;font-weight:600;color:var(--danger)">${no}</div><div style="font-size:10px;color:var(--text3)">abwesend</div></div>`:''}
      </div>`:''}
      ${att.map(m=>`<div class="atti">
        <div><span style="font-size:13px">${esc(m.profiles?.name||'?')}</span> <span style="font-size:11px;color:var(--text3)">${esc(m.profiles?.stimme||'')}</span></div>
        ${isAdmin?`<div class="attb">
          <button class="ab ${m.status==='yes'?'yes':''}" onclick="setAtt('${e.id}','${m.member_id}','yes')">✓</button>
          <button class="ab ${m.status==='no'?'no':''}" onclick="setAtt('${e.id}','${m.member_id}','no')">✗</button>
        </div>`:`<span>${m.status==='yes'?'<span style="color:var(--success)">✓</span>':m.status==='no'?'<span style="color:var(--danger)">✗</span>':'<span style="color:var(--text3)">–</span>'}</span>`}
      </div>`).join('')}`;
    })()}
    ${e.notizen?`<div class="ddiv"></div><div class="dl">Notizen</div><div style="font-size:13px;margin-top:4px">${esc(e.notizen)}</div>`:''}`;
  const footer=document.getElementById('ed-footer');footer.innerHTML='';
  if(isAdmin){
    const eb=document.createElement('button');eb.className='btn btn-g';eb.style.flex='1';eb.textContent='Bearbeiten';eb.onclick=()=>{closeModal('m-ev-detail');openEventForm(e.id);};
    const db=document.createElement('button');db.className='btn btn-d';db.style.flex='1';db.textContent='Löschen';db.onclick=()=>{if(confirm('Löschen?'))delEvent(e.id);};
    footer.appendChild(eb);footer.appendChild(db);
  }
  openModal('m-ev-detail');
}
async function setAtt(evId,mId,val){
  await SB.from('attendance').upsert({event_id:evId,member_id:mId,status:val},{onConflict:'event_id,member_id'});openEvDetail(evId);
}
async function openEventForm(id=null){
  editEvId=id;
  const{data:songs}=await SB.from('songs').select('id,title,liedanfang').eq('in_repertoire',true).order('liedanfang',{nullsFirst:false}).order('title');
  const{data:members}=await SB.from('profiles').select('id,name').order('name');
  let e={};
  if(id){const{data}=await SB.from('events').select('*,event_program(*),event_tasks(*)').eq('id',id).single();e=data||{};}
  document.getElementById('ef-title-h').textContent=id?'Veranstaltung bearbeiten':'Veranstaltung hinzufügen';
  const prog=(e.event_program||[]).sort((a,b)=>a.position-b.position);
  const aufgRows=(e.event_tasks||[]).map(t=>`<div class="fr2 aufg-row" style="margin-bottom:7px"><input class="fi aufg-person" value="${esc(t.person)}" placeholder="Person" list="dl-members" autocomplete="off"><input class="fi aufg-task" value="${esc(t.aufgabe)}" placeholder="Aufgabe"></div>`).join('');
  const progRowsHtml=prog.map((p,i)=>{
    if(p.placeholder?.startsWith('[Predigt] ')){
      const parts=p.placeholder.slice(10).split('|');
      return buildPredigtRow(i+1,{pred_thema:parts[0]||'',pred_prediger:parts[1]||'',pred_bibel:parts[2]||''});
    }
    if(p.placeholder?.startsWith('[Sonstiges] ')){
      const parts=p.placeholder.slice(12).split('|');
      return buildSonstigesRow(i+1,{sonst_name:parts[0]||'',sonst_desc:parts[1]||''});
    }
    return buildProgRow(i+1,p,songs||[]);
  }).join('');
  document.getElementById('ef-body').innerHTML=`
    <div class="fs"><div class="fst">Allgemein</div>
      <div class="fg"><label class="fl">Titel *</label><input class="fi" id="ef-title" value="${esc(e.title||'')}"></div>
      <div class="fr2"><div class="fg"><label class="fl">Datum</label><input class="fi" type="date" id="ef-datum" value="${e.datum||''}"></div><div class="fg"><label class="fl">Uhrzeit</label><input class="fi" type="time" id="ef-uhrzeit" value="${fT(e.uhrzeit||'10:00')}"></div></div>
      <div class="fg"><label class="fl">Ort</label><input class="fi" id="ef-ort" value="${esc(e.ort||'Bielefeld')}"></div>
      <div class="fg"><label class="fl">Verantwortlich</label>
        <input class="fi" id="ef-dir" value="${esc(e.dirigent||'')}" list="dl-dirigent" autocomplete="off">
      </div>
      <div class="fr2">
        <div class="fg"><label class="fl">Chor</label><input class="fi" id="ef-chor" value="${esc(e.chor||'')}" placeholder="z.B. Erwachsenenchor"></div>
        <div class="fg"><label class="fl">Thema</label><input class="fi" id="ef-thema" value="${esc(e.thema||'')}" placeholder="z.B. Advent"></div>
      </div>
      <div class="fr2">
        <div class="fg"><label class="fl">Status</label><select class="fi" id="ef-status">
          <option value="" ${!e.status?'selected':''}>Normal</option>
          <option value="verschoben" ${e.status==='verschoben'?'selected':''}>Verschoben</option>
          <option value="abgesagt" ${e.status==='abgesagt'?'selected':''}>Abgesagt</option>
          <option value="kein_chor" ${e.status==='kein_chor'?'selected':''}>Kein Chor</option>
        </select></div>
        <div class="fg" id="ef-verschoben-wrap" style="display:${e.status==='verschoben'?'block':'none'}"><label class="fl">Verschoben auf</label><input class="fi" type="date" id="ef-verschoben-datum" value="${e.verschoben_auf||''}"></div>
      </div>
    </div>
    <div class="fs"><div class="fst">Programm</div>
      <div id="prog-rows">${progRowsHtml}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
        <button type="button" class="btn btn-g btn-sm" onclick="addProgRow()">+ Lied</button>
        <button type="button" class="btn btn-g btn-sm" onclick="addPredigtRow()">+ Predigt</button>
        <button type="button" class="btn btn-g btn-sm" onclick="addSonstigesRow()">+ Sonstiges</button>
      </div>
    </div>
    <div class="fs"><div class="fst">Aufgaben</div>
      <div id="aufg-rows">${aufgRows}</div>
      <button type="button" class="btn btn-g btn-sm" onclick="addAufgRow()">+ Aufgabe</button>
    </div>
    <div class="fs"><div class="fst">Notizen</div><textarea class="fi" id="ef-notiz">${esc(e.notizen||'')}</textarea></div>`;
  window._efSongs=songs||[];window._efMembers=members||[];
  const statusSel=document.getElementById('ef-status');
  const vWrap=document.getElementById('ef-verschoben-wrap');
  if(statusSel)statusSel.addEventListener('change',()=>{
    if(vWrap)vWrap.style.display=statusSel.value==='verschoben'?'block':'none';
  });
  openModal('m-ev-form');
}
function buildProgRow(pos,p={},songs=[]){
  const opts=songs.map(s=>{
    const label=s.liedanfang?(s.title&&s.title!==s.liedanfang?`${s.liedanfang} | ${s.title}`:s.liedanfang):s.title||'?';
    const bes=s.besetzung?` [${s.besetzung}]`:'';
    return`<option value="${s.id}" ${s.id===(p.song_id||'')&&p.song_id?'selected':''}>${esc(label)}${esc(bes)}</option>`;
  }).join('');
  const isPlaceholder=p.song_id===null&&(p.dirigent||p.klavier||p.instrumente||p.placeholder);
  return`<div class="ep-row prog-ep-row" draggable="true" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dragDrop(event)" ondragend="dragEnd(event)">
    <div class="ep-row-header">
      <span class="drag-handle" title="Ziehen zum Sortieren">⠿</span>
      <div class="pnum" style="width:22px;height:22px;font-size:11px">${pos}</div>
      <select class="fi prog-song" style="flex:1" onchange="togglePlaceholder(this)"><option value="">– Lied –</option><option value="__placeholder__" ${isPlaceholder?'selected':''}>📌 Platzhalter</option>${opts}</select>
      <button type="button" class="btn btn-d btn-sm" onclick="this.closest('.prog-ep-row').remove();renumberProgRows()" style="width:28px;height:28px;padding:0">✕</button>
    </div>
    <div class="prog-placeholder-name" style="${isPlaceholder?'':'display:none'}margin-bottom:5px">
      <input class="fi" placeholder="Beschreibung (z.B. Eingangslied)" value="${esc(p.placeholder||'')}" style="font-size:12px">
    </div>
    <div class="ep-roles">
      <input class="fi prog-dir" placeholder="Dirigent" list="dl-dirigent" autocomplete="off" value="${esc(p.dirigent||'')}">
      <input class="fi prog-klav" placeholder="Klavier" list="dl-klavier" autocomplete="off" value="${esc(p.klavier||'')}">
      <input class="fi prog-instr" placeholder="Instrumente" style="grid-column:1/-1" value="${esc(p.instrumente||'')}">
    </div>
  </div>`;
}
function togglePlaceholder(sel){
  const row=sel.closest('.prog-ep-row');
  const ph=row.querySelector('.prog-placeholder-name');
  if(sel.value==='__placeholder__'){ph.style.display='';} else {ph.style.display='none';}
}
function renumberProgRows(){document.querySelectorAll('.prog-ep-row .pnum').forEach((el,i)=>el.textContent=i+1);}
function addProgRow(){const c=document.getElementById('prog-rows');const p=c.querySelectorAll('.prog-ep-row').length+1;const d=document.createElement('div');d.innerHTML=buildProgRow(p,{},window._efSongs||[]);c.appendChild(d.firstElementChild);}

function buildPredigtRow(pos,p={}){
  return`<div class="ep-row prog-ep-row" data-type="predigt" draggable="true" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dragDrop(event)" ondragend="dragEnd(event)">
    <div class="ep-row-header">
      <span class="drag-handle">⠿</span>
      <div class="pnum" style="width:22px;height:22px;font-size:11px">${pos}</div>
      <span style="font-size:12px;font-weight:500;color:var(--text2);flex:1;padding-left:6px">🎤 Predigt</span>
      <button type="button" class="btn btn-d btn-sm" onclick="this.closest('.prog-ep-row').remove();renumberProgRows()" style="width:28px;height:28px;padding:0">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px">
      <input class="fi pred-thema" placeholder="Thema" value="${esc(p.pred_thema||'')}" style="grid-column:1/-1">
      <input class="fi pred-prediger" placeholder="Prediger" value="${esc(p.pred_prediger||'')}">
      <input class="fi pred-bibel" placeholder="Bibelstelle" value="${esc(p.pred_bibel||'')}">
    </div>
  </div>`;
}

function buildSonstigesRow(pos,p={}){
  return`<div class="ep-row prog-ep-row" data-type="sonstiges" draggable="true" ondragstart="dragStart(event)" ondragover="dragOver(event)" ondrop="dragDrop(event)" ondragend="dragEnd(event)">
    <div class="ep-row-header">
      <span class="drag-handle">⠿</span>
      <div class="pnum" style="width:22px;height:22px;font-size:11px">${pos}</div>
      <span style="font-size:12px;font-weight:500;color:var(--text2);flex:1;padding-left:6px">✦ Sonstiges</span>
      <button type="button" class="btn btn-d btn-sm" onclick="this.closest('.prog-ep-row').remove();renumberProgRows()" style="width:28px;height:28px;padding:0">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px">
      <input class="fi sonst-name" placeholder="Name/Bezeichnung" value="${esc(p.sonst_name||'')}">
      <input class="fi sonst-desc" placeholder="Beschreibung" value="${esc(p.sonst_desc||'')}">
    </div>
  </div>`;
}

function addPredigtRow(){
  const c=document.getElementById('prog-rows');
  const pos=c.querySelectorAll('.prog-ep-row').length+1;
  const d=document.createElement('div');
  d.innerHTML=buildPredigtRow(pos);
  c.appendChild(d.firstElementChild);
}
function addSonstigesRow(){
  const c=document.getElementById('prog-rows');
  const pos=c.querySelectorAll('.prog-ep-row').length+1;
  const d=document.createElement('div');
  d.innerHTML=buildSonstigesRow(pos);
  c.appendChild(d.firstElementChild);
}

// ===== DRAG & DROP for program rows =====
let dragSrc=null;
function dragStart(e){
  dragSrc=e.currentTarget;
  dragSrc.classList.add('dragging');
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain','');
}
function dragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  const row=e.currentTarget;
  if(row!==dragSrc){
    document.querySelectorAll('.prog-ep-row').forEach(r=>r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  }
}
function dragDrop(e){
  e.preventDefault();
  const target=e.currentTarget;
  if(dragSrc&&target!==dragSrc){
    const container=document.getElementById('prog-rows');
    const rows=[...container.querySelectorAll('.prog-ep-row')];
    const fromIdx=rows.indexOf(dragSrc);
    const toIdx=rows.indexOf(target);
    if(fromIdx>-1&&toIdx>-1){
      if(fromIdx<toIdx)container.insertBefore(dragSrc,target.nextSibling);
      else container.insertBefore(dragSrc,target);
      renumberProgRows();
    }
  }
  document.querySelectorAll('.prog-ep-row').forEach(r=>r.classList.remove('drag-over'));
}
function dragEnd(e){
  document.querySelectorAll('.prog-ep-row').forEach(r=>{r.classList.remove('dragging');r.classList.remove('drag-over');});
  dragSrc=null;
}
function addAufgRow(){const d=document.createElement('div');d.className='fr2 aufg-row';d.style.marginBottom='7px';d.innerHTML=`<input class="fi aufg-person" placeholder="Person" list="dl-members" autocomplete="off"><input class="fi aufg-task" placeholder="Aufgabe">`;document.getElementById('aufg-rows').appendChild(d);}
async function saveEvent(){
  const evStatus=document.getElementById('ef-status')?.value||'';
  const verschobenAuf=document.getElementById('ef-verschoben-datum')?.value||'';
  const title=document.getElementById('ef-title').value.trim();
  if(!title){T('Bitte Titel eingeben','err');return;}
  const payload={title,status:evStatus,verschoben_auf:verschobenAuf||null,datum:document.getElementById('ef-datum').value||null,uhrzeit:document.getElementById('ef-uhrzeit').value||null,ort:document.getElementById('ef-ort').value.trim(),dirigent:document.getElementById('ef-dir').value.trim(),chor:document.getElementById('ef-chor').value.trim(),thema:document.getElementById('ef-thema').value.trim(),notizen:document.getElementById('ef-notiz').value.trim(),updated_at:new Date().toISOString()};
  let evId=editEvId;
  if(editEvId){await SB.from('events').update(payload).eq('id',editEvId);}
  else{const{data,error}=await SB.from('events').insert({...payload,created_by:currentUser.id}).select().single();if(error){T('Fehler: '+error.message,'err');return;}evId=data?.id;}
  if(!evId){T('Fehler beim Speichern','err');return;}
  await SB.from('event_program').delete().eq('event_id',evId);
  const progInsert=[...document.querySelectorAll('.prog-ep-row')].map((row,i)=>{
    const type=row.dataset.type||'lied';
    const songVal=row.querySelector('.prog-song')?.value||'';
    const isPlaceholder=songVal==='__placeholder__';
    if(type==='predigt'){
      const thema=row.querySelector('.pred-thema')?.value.trim()||'';
      const prediger=row.querySelector('.pred-prediger')?.value.trim()||'';
      const bibel=row.querySelector('.pred-bibel')?.value.trim()||'';
      const label=['Predigt',thema,prediger,bibel].filter(Boolean).join(' · ');
      return{event_id:evId,song_id:null,position:i+1,placeholder:`[Predigt] ${thema}|${prediger}|${bibel}`};
    }
    if(type==='sonstiges'){
      const name=row.querySelector('.sonst-name')?.value.trim()||'Sonstiges';
      const desc=row.querySelector('.sonst-desc')?.value.trim()||'';
      return{event_id:evId,song_id:null,position:i+1,placeholder:`[Sonstiges] ${name}|${desc}`};
    }
    const phName=row.querySelector('.prog-placeholder-name input')?.value.trim()||'';
    return{event_id:evId,song_id:isPlaceholder?null:songVal||null,position:i+1,dirigent:row.querySelector('.prog-dir')?.value.trim()||'',klavier:row.querySelector('.prog-klav')?.value.trim()||'',instrumente:row.querySelector('.prog-instr')?.value.trim()||'',placeholder:isPlaceholder?phName||'Platzhalter':null};
  }).filter(p=>p.song_id||p.placeholder);
  if(progInsert.length)await SB.from('event_program').insert(progInsert);
  await SB.from('event_tasks').delete().eq('event_id',evId);
  const pEls=[...document.querySelectorAll('.aufg-person')],tEls=[...document.querySelectorAll('.aufg-task')];
  const taskInsert=pEls.map((el,i)=>({event_id:evId,person:el.value.trim(),aufgabe:tEls[i]?.value.trim()||''})).filter(t=>t.person&&t.aufgabe);
  if(taskInsert.length)await SB.from('event_tasks').insert(taskInsert);
  if((window._efMembers||[]).length&&!editEvId)await SB.from('attendance').upsert((window._efMembers).map(m=>({event_id:evId,member_id:m.id,status:''})),{onConflict:'event_id,member_id',ignoreDuplicates:true});
  closeModal('m-ev-form');renderEvents();T(editEvId?'Veranstaltung aktualisiert':'Veranstaltung hinzugefügt','ok');
}
async function delEvent(id){await SB.from('events').delete().eq('id',id);closeModal('m-ev-detail');renderEvents();T('Veranstaltung gelöscht');}

// ========== AUTOCOMPLETE ==========
let personLzMap={}; // name -> lebensdaten

async function loadAutocompleteLists(){
  const[{data:members},{data:songs}]=await Promise.all([
    SB.from('profiles').select('name,role2').eq('active',true).order('name'),
    SB.from('songs').select('komponist,komponist_lz,textdichter,textdichter_lz,arrangeur,arrangeur_lz,uebersetzer,uebersetzer_lz')
  ]);
  // Member lists
  const allMembers=members||[];
  const dirigenten=allMembers.filter(m=>(m.role2||'').includes('dirigent')).map(m=>m.name);
  const klavieristen=allMembers.filter(m=>(m.role2||'').includes('klavier')).map(m=>m.name);
  const allNames=allMembers.map(m=>m.name);
  const fill=(id,names)=>{const dl=document.getElementById(id);if(!dl)return;dl.innerHTML=names.map(n=>`<option value="${esc(n)}">`).join('');};
  fill('dl-dirigent',dirigenten.length?dirigenten:allNames);
  fill('dl-klavier',klavieristen.length?klavieristen:allNames);
  fill('dl-members',allNames);
  // Build person->lebensdaten map from songs
  personLzMap={};
  const roles=[['komponist','komponist_lz'],['textdichter','textdichter_lz'],['arrangeur','arrangeur_lz'],['uebersetzer','uebersetzer_lz']];
  const personSets={komp:new Set(),text:new Set(),arr:new Set(),ueb:new Set()};
  const dlMap={komp:'dl-komp',text:'dl-text',arr:'dl-arr',ueb:'dl-ueb'};
  const roleKeys=['komp','text','arr','ueb'];
  (songs||[]).forEach(s=>{
    roles.forEach(([nameKey,lzKey],i)=>{
      const name=(s[nameKey]||'').trim();
      const lz=(s[lzKey]||'').trim();
      if(name){
        personSets[roleKeys[i]].add(name);
        if(lz&&!personLzMap[name.toLowerCase()])personLzMap[name.toLowerCase()]=lz;
      }
    });
  });
  // Also cross-reference: same person different roles
  Object.values(personSets).forEach(set=>set.forEach(name=>{
    // already in map from above
  }));
  // Fill datalists
  Object.entries(dlMap).forEach(([key,dlId])=>{
    fill(dlId,[...personSets[key]].sort());
  });
}

function fillPersonLz(inputEl, lzFieldId, role){
  const name=inputEl.value.trim().toLowerCase();
  if(!name)return;
  const lzField=document.getElementById(lzFieldId);
  if(!lzField||lzField.value.trim())return; // don't overwrite existing
  const lz=personLzMap[name];
  if(lz)lzField.value=lz;
}

