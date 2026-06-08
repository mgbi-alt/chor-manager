// ========== CALENDAR ==========
async function loadCategories(){
  const{data}=await SB.from('cal_categories').select('*').order('name');
  cachedCategories=data||[
    {id:'chorprobe',name:'Chorprobe',color:'#5b8dee'},
    {id:'gottesdienst',name:'Gottesdienst',color:'#e05555'},
    {id:'konzert',name:'Konzert',color:'#4caf82'},
    {id:'kein_chor',name:'Kein Chor',color:'#5b8dee'},
    {id:'sonstiges',name:'Sonstiges',color:'#a8a4b0'}
  ];
}

function catColor(cat){
  const c=cachedCategories.find(x=>x.name===cat||x.id===cat);
  return c?.color||'#5b8dee';
}

function buildMiniCal(y,m,allEvts,holidays,schoolDays){
  const fd=(new Date(y,m,1).getDay()+6)%7;
  const dim=new Date(y,m+1,0).getDate();
  const now=new Date();const itm=now.getFullYear()===y&&now.getMonth()===m;
  const mn=['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  // Parse date string as LOCAL date (avoid UTC offset shifting day)
  function parseLocal(ds){const[y,m,d]=ds.split('-').map(Number);return new Date(y,m-1,d);}
  // Build day->events map including multi-day events
  const ebd={};
  (allEvts||[]).forEach(e=>{
    const start=parseLocal(e.datum);
    const end=parseLocal(e.bis_datum||e.datum);
    let d=new Date(start);
    while(d<=end){
      if(d.getFullYear()===y&&d.getMonth()===m){
        const day=d.getDate();
        if(!ebd[day])ebd[day]=[];
        ebd[day].push(e);
      }
      d.setDate(d.getDate()+1);
    }
  });
  let cells='';
  for(let i=0;i<fd;i++)cells+='<div class="cday-wrap"><div class="cday other-month"></div></div>';
  for(let d=1;d<=dim;d++){
    const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isHol=!!holidays?.[ds];
    const isFer=!!schoolDays?.[ds];
    const evs=ebd[d]||[];
    const bgStyle=isFer?'background:rgba(91,141,238,.08)':'';
    cells+=`<div class="cday-wrap"><div class="cday ${itm&&d===now.getDate()?'today':''} ${isHol?'holiday':''}" style="${bgStyle}" onclick="openCalForm(null,'${ds}')">
      <div class="cdnum">${d}</div>
      ${isHol?`<div style="font-size:6px;color:var(--danger);line-height:1.1;text-align:center;overflow:hidden;max-height:14px;word-break:break-word">${esc(holidays[ds])}</div>`:isFer?`<div style="font-size:6px;color:#8fb3f5;line-height:1.1;text-align:center">Ferien</div>`:''}
      ${evs.slice(0,2).map(e=>{
  const kc=(e.category||'').toLowerCase().replace(/\s+/g,'')==='keinchor'||e.status==='kein_chor';
  const vs=e.status==='verschoben';
  return`<div class="cal-event-block${kc?' kein-chor':''}" style="background:${esc(e.color||catColor(e.category))};${kc?'text-decoration:line-through':''}">${esc(e.title)}${vs?' ↗':''}</div>`;
}).join('')}
      ${evs.length>2?`<div style="font-size:6px;color:var(--text3);text-align:center">+${evs.length-2}</div>`:""}
    </div></div>`;
  }
  return`<div class="cal-mini"><div style="font-weight:600;font-size:10px;color:var(--text2);text-align:center;margin-bottom:5px">${mn[m]} ${y}</div><div class="cgrid">${['M','D','M','D','F','S','S'].map(d=>`<div class="cdow">${d}</div>`).join('')}${cells}</div></div>`;
}

async function renderCal(){
  const el=document.getElementById('cal-wrap');
  await loadCategories();
  const isAdmin=currentProfile?.role==='admin';
  const isMobile=window.innerWidth<=600;
  if(isMobile&&calView!=="month")calView="month";
  if(!isMobile&&calView==="month")calView="3month";
  const viewTabs=`<div class="view-tabs">
    ${isMobile?`<div class="vtab active">Monat</div>`:`
    <div class="vtab ${calView==="3month"?"active":""}" onclick="calView='3month';renderCal()">3 Monate</div>
    <div class="vtab ${calView==="year"?"active":""}" onclick="calView='year';renderCal()">Jahr</div>`}
  </div>`;
  const y=calDate.getFullYear(),m=calDate.getMonth();
  const mn=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  if(calView==='month'){
    const fd=(new Date(y,m,1).getDay()+6)%7,dim=new Date(y,m+1,0).getDate();
    const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const to=`${y}-${String(m+1).padStart(2,'0')}-${String(dim).padStart(2,'0')}`;
    const[{data:evts},{data:veranst}]=await Promise.all([
      SB.from('calendar_events').select('*').lte('datum',to).gte('bis_datum',from).order('datum'),
      SB.from('events').select('id,title,datum').gte('datum',from).lte('datum',to).order('datum')
    ]);
    // Merge Veranstaltungen as calendar items (red)
    const allEvts=[...(evts||[]),...(veranst||[]).map(v=>({...v,bis_datum:v.datum,color:'#e05555',category:'Veranstaltung',_isVeranst:true}))];
    const holidays=getNRWHolidays(y);
    const schoolDays=getSchoolHolidayDays(y);
    // Single-day events per day
    const ebd={};
    allEvts.forEach(e=>{
      const start=new Date(Math.max(new Date(e.datum),new Date(from)));
      const end=new Date(Math.min(new Date(e.bis_datum||e.datum),new Date(to)));
      let d=new Date(start);
      while(d<=end){
        const day=d.getDate();
        if(!ebd[day])ebd[day]=[];
        const ds=d.toISOString().slice(0,10);
        ebd[day].push({...e,_isFirst:ds===e.datum,_isLast:ds===(e.bis_datum||e.datum)});
        d.setDate(d.getDate()+1);
      }
    });
    const now=new Date();const itm=now.getFullYear()===y&&now.getMonth()===m;
    // Build grid cells
    let cells='';
    for(let i=0;i<fd;i++)cells+=`<div class="cday-wrap" data-day="0"><div class="cday other-month"></div></div>`;
    for(let d=1;d<=dim;d++){
      const ds=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isHol=!!holidays[ds];
      const fer=schoolDays[ds];
      const evs=ebd[d]||[];
      const singleEvs=evs.filter(e=>e.datum===(e.bis_datum||e.datum));
      const multiEvs=evs.filter(e=>e.datum!==(e.bis_datum||e.datum));
      cells+=`<div class="cday-wrap" data-day="${d}" data-date="${ds}">
        <div class="cday ${itm&&d===now.getDate()?'today':''} ${isHol?'holiday':''}" style="${fer?'background:rgba(91,141,238,.08)':''}" onclick="openCalForm(null,'${ds}')">
          <div class="cdnum">${d}</div>
          ${isHol?`<div style="font-size:6px;color:var(--danger);line-height:1.1;text-align:center;overflow:hidden;max-height:14px">${esc(holidays[ds])}</div>`:''}
          ${!isHol&&fer?`<div style="font-size:6px;color:#8fb3f5;line-height:1.1;text-align:center">Ferien</div>`:''}
          ${singleEvs.slice(0,isHol||fer?0:2).map(e=>`<div class="cal-event-block${(e.category||'').toLowerCase().replace(/\s+/g,'')==='keinchor'?' kein-chor':''}" style="background:${esc(e.color||catColor(e.category))};${(e.category||'').toLowerCase().replace(/\s+/g,'')==='keinchor'?'text-decoration:line-through':''}" onclick="event.stopPropagation();highlightCalEvt('${e.id}')">${esc(e.title)}</div>`).join('')}
          ${evs.length>2?`<div style="font-size:6px;color:var(--text3)">+${evs.length-2}…</div>`:''}
        </div>
      </div>`;
    }
    // Build multi-day event bars as overlay rows
    const multiEvts=allEvts.filter(e=>e.datum!==(e.bis_datum||e.datum));
    multiEvts.sort((a,b)=>a.datum.localeCompare(b.datum));
    const multiRows=multiEvts.map(e=>{
      const eStart=new Date(Math.max(new Date(e.datum),new Date(from)));
      const eEnd=new Date(Math.min(new Date(e.bis_datum),new Date(to)));
      const startDay=eStart.getDate();
      const endDay=eEnd.getDate();
      const colStart=startDay+fd;
      const colEnd=endDay+fd+1;
      const color=e.color||catColor(e.category);
      return`<div style="grid-column:${colStart}/${colEnd};background:${esc(color)};border-radius:3px;padding:1px 4px;font-size:8px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;margin:1px 1px 0;line-height:1.5" onclick="${e._isVeranst?`openEvDetail('${e.id}')`:`highlightCalEvt('${e.id}')`}" title="${esc(e.title)}">${esc(e.title)}</div>`;
    }).join('');
    const upEvts=allEvts.sort((a,b)=>a.datum.localeCompare(b.datum));
    const holList=Object.entries(holidays).filter(([d])=>d.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).sort(([a],[b])=>a.localeCompare(b));
    const ferList=getNRWSchoolHolidays(y).filter(f=>{const fm=new Date(f.from).getMonth()+1,tm=new Date(f.to).getMonth()+1,my=m+1;return fm<=my&&tm>=my;});
    el.innerHTML=viewTabs+
      `<div class="chead"><button class="btn btn-g btn-sm" onclick="calNav(-1)">‹</button><div class="cmonth">${mn[m]} ${y}</div><button class="btn btn-g btn-sm" onclick="calNav(1)">›</button></div>
      <div style="position:relative">
        <div class="cgrid">${['Mo','Di','Mi','Do','Fr','Sa','So'].map(d=>`<div class="cdow">${d}</div>`).join('')}${cells}</div>
        ${multiEvts.length?`<div style="display:grid;grid-template-columns:repeat(7,1fr);position:absolute;top:22px;left:0;right:0;pointer-events:none"><div style="grid-column:1/8;display:grid;grid-template-columns:repeat(${fd+dim},1fr);pointer-events:all">${multiRows}</div></div>`:''}
      </div>
      ${holList.length||ferList.length?`<div class="st">Feiertage & Ferien</div>
        ${holList.map(([d,n])=>`<div class="cevt-holiday" style="cursor:pointer" onclick="highlightCalEvtByDate('${d}')"><span>🔴 <b>${esc(n)}</b></span><span style="font-size:11px;color:var(--text3);float:right">${fD(d)}</span></div>`).join('')}
        ${ferList.map(f=>`<div style="background:rgba(91,141,238,.08);border:0.5px solid rgba(91,141,238,.2);border-radius:var(--r);padding:6px 10px;margin-bottom:5px"><span>📚 <b>${esc(f.name)}</b></span><span style="font-size:11px;color:var(--text3);float:right">${fD(f.from)} – ${fD(f.to)}</span></div>`).join('')}`:''}
      <div class="st">Termine</div>
      <div id="cal-evt-list">${upEvts.length?upEvts.map(e=>evtListItem(e,isAdmin)).join(''):'<p style="color:var(--text3);font-size:12px">Keine Termine</p>'}</div>`;

  } else if(calView==='3month'){
    const from=`${y}-${String(m+1).padStart(2,'0')}-01`;
    const m3end=new Date(y,m+3,0);
    const to=`${m3end.getFullYear()}-${String(m3end.getMonth()+1).padStart(2,'0')}-${String(m3end.getDate()).padStart(2,'0')}`;
    const[{data:evts},{data:veranst}]=await Promise.all([
      SB.from('calendar_events').select('*').lte('datum',to).gte('bis_datum',from).order('datum'),
      SB.from('events').select('id,title,datum').gte('datum',from).lte('datum',to).order('datum')
    ]);
    const allEvts3=[...(evts||[]),...(veranst||[]).map(v=>({...v,bis_datum:v.datum,color:'#e05555',category:'Veranstaltung',_isVeranst:true}))];
    const holidays={...getNRWHolidays(y),...getNRWHolidays(y+1)};
    const schoolDays={...getSchoolHolidayDays(y),...getSchoolHolidayDays(y+1)};
    let minis='';
    for(let i=0;i<3;i++){const mm=(m+i)%12;const yy=y+Math.floor((m+i)/12);minis+=buildMiniCal(yy,mm,allEvts3,holidays,schoolDays);}
    const upEvts=allEvts3.sort((a,b)=>a.datum.localeCompare(b.datum));
    el.innerHTML=viewTabs+
      `<div class="chead"><button class="btn btn-g btn-sm" onclick="calNav(-3)">‹</button><div class="cmonth">${mn[m]} – ${mn[(m+2)%12]} ${y}</div><button class="btn btn-g btn-sm" onclick="calNav(3)">›</button></div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">${minis}</div>
      <div id="cal-evt-list">${upEvts.length?upEvts.map(e=>evtListItem(e,isAdmin)).join(''):'<p style="color:var(--text3);font-size:12px">Keine Termine</p>'}</div>`;

  } else {
    const[{data:evts},{data:veranst}]=await Promise.all([
      SB.from('calendar_events').select('*').gte('datum',`${y}-01-01`).lte('datum',`${y}-12-31`).order('datum'),
      SB.from('events').select('id,title,datum').gte('datum',`${y}-01-01`).lte('datum',`${y}-12-31`).order('datum')
    ]);
    const allEvtsY=[...(evts||[]),...(veranst||[]).map(v=>({...v,bis_datum:v.datum,color:'#e05555',category:'Veranstaltung',_isVeranst:true}))];
    const holidays=getNRWHolidays(y);
    const schoolDays=getSchoolHolidayDays(y);
    let minis='';
    for(let i=0;i<12;i++)minis+=buildMiniCal(y,i,allEvtsY,holidays,schoolDays);
    el.innerHTML=viewTabs+
      `<div class="chead"><button class="btn btn-g btn-sm" onclick="calNav(-12)">‹</button><div class="cmonth">Jahr ${y}</div><button class="btn btn-g btn-sm" onclick="calNav(12)">›</button></div>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px">${minis}</div>
      <div id="cal-evt-list">${allEvtsY.length?allEvtsY.sort((a,b)=>a.datum.localeCompare(b.datum)).map(e=>evtListItem(e,isAdmin)).join(''):'<p style="color:var(--text3);font-size:12px">Keine Termine</p>'}</div>`;
  }
  // Init touch swipe after render
  setTimeout(initCalSwipe,100);
}

function evtListItem(e,isAdmin){
  const color=e.color||catColor(e.category);
  const isMultiDay=e.bis_datum&&e.bis_datum!==e.datum;
  const isKeinChor=(e.category||'').toLowerCase().replace(/\s+/g,'')===('Kein Chor').toLowerCase().replace(/\s+/g,'');
  const isVeranst=!!e._isVeranst;
  return`<div class="cevt" id="evtli-${e.id}" data-evtid="${e.id}" data-evtdate="${e.datum}" style="border-left-color:${esc(color)};${isKeinChor?'opacity:.8':''}transition:background .3s" ${isVeranst?`onclick="openEvDetail('${e.id}')" style="border-left-color:${esc(color)};cursor:pointer"`:''}>
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="flex:1">
        <div style="font-weight:500;font-size:13px;${isKeinChor?'text-decoration:line-through;color:var(--text3)':''}">${esc(e.title)}</div>
        <div style="font-size:11px;color:var(--text2)">${fD(e.datum)}${isMultiDay?' – '+fD(e.bis_datum):''} ${e.uhrzeit?'· '+fT(e.uhrzeit):''} ${e.bis_uhrzeit?'– '+fT(e.bis_uhrzeit):''}</div>
        ${e.ort?`<div style="font-size:11px;color:var(--text3)">📍 ${esc(e.ort)}</div>`:''}
        ${e.beschreibung?`<div style="font-size:11px;color:var(--text2);margin-top:3px">${esc(e.beschreibung)}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="badge" style="background:${esc(color)}22;color:${esc(color)};border-color:${esc(color)}55;font-size:9px">${esc(e.category||'Termin')}</span>
        ${e.series_id?'<span class="badge gray" style="font-size:9px">🔁 Serie</span>':''}
        ${isMultiDay?'<span class="badge blue" style="font-size:9px">Mehrtägig</span>':''}
      </div>
    </div>
    ${!isVeranst&&isAdmin?`<div style="display:flex;gap:5px;margin-top:6px"><button class="btn btn-g btn-sm" style="font-size:11px" onclick="openCalForm('${e.id}',null)">Bearbeiten</button><button class="btn btn-d btn-sm" style="font-size:11px" onclick="delCalEvt('${e.id}',${!!e.series_id})">Löschen</button></div>`:''}
  </div>`;
}

function highlightCalEvt(id){
  document.querySelectorAll('.cevt.highlighted').forEach(el=>{el.classList.remove('highlighted');el.style.background='';});
  const target=document.getElementById('evtli-'+id);
  if(target){
    target.style.background='rgba(201,168,76,.12)';
    target.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>{if(target)target.style.background='';},2500);
  }
}
function highlightCalEvtByDate(date){
  const targets=document.querySelectorAll(`[data-evtdate="${date}"]`);
  targets.forEach(t=>{
    t.style.background='rgba(201,168,76,.12)';
    t.scrollIntoView({behavior:'smooth',block:'center'});
    setTimeout(()=>{if(t)t.style.background='';},2500);
  });
}

function calNav(d){
  if(calView==='year')calDate=new Date(calDate.getFullYear()+d,calDate.getMonth(),1);
  else calDate=new Date(calDate.getFullYear(),calDate.getMonth()+d,1);
  renderCal();
}

// ========== CALENDAR TOUCH SWIPE ==========
let _calTouchX=0;
function initCalSwipe(){
  const el=document.getElementById('cal-wrap');
  if(!el||el._swipe)return;
  el._swipe=true;
  el.addEventListener('touchstart',e=>{_calTouchX=e.touches[0].clientX;},{passive:true});
  el.addEventListener('touchend',e=>{
    const dx=e.changedTouches[0].clientX-_calTouchX;
    if(Math.abs(dx)>55){
      if(calView==='month')calNav(dx<0?1:-1);
      else if(calView==='3month')calNav(dx<0?3:-3);
      else calNav(dx<0?12:-12);
    }
  },{passive:true});
}

async function openCalForm(id=null, prefilledDate=null){
  editCalId=id;
  document.getElementById('cf-title-h').textContent=id?'Termin bearbeiten':'Termin hinzufügen';
  await loadCategories();
  const catOpts=cachedCategories.map(c=>`<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');
  let e={datum:prefilledDate||'',uhrzeit:'19:00',bis_uhrzeit:'21:00',ort:'Bielefeld',category:'Chorprobe'};
  if(id){const{data}=await SB.from('calendar_events').select('*').eq('id',id).single();if(data)e=data;}
  document.getElementById('cf-body').innerHTML=`
    <div class="fg"><label class="fl">Titel *</label><input class="fi" id="cf-title" value="${esc(e.title||'')}"></div>
    <div class="fr2">
      <div class="fg"><label class="fl">Datum *</label><input class="fi" type="date" id="cf-datum" value="${e.datum||''}"></div>
      <div class="fg"><label class="fl">Kategorie</label><select class="fi" id="cf-cat">${catOpts}</select></div>
    </div>
    <div class="fr2">
      <div class="fg"><label class="fl">Von</label><input class="fi" type="time" id="cf-time" value="${fT(e.uhrzeit||'19:00')}"></div>
      <div class="fg"><label class="fl">Bis</label><input class="fi" type="time" id="cf-bis-t" value="${fT(e.bis_uhrzeit||'21:00')}"></div>
    </div>
    <div class="fr2">
      <div class="fg"><label class="fl">Bis Datum</label><input class="fi" type="date" id="cf-bis-d" value="${e.bis_datum||''}"></div>
      <div class="fg"><label class="fl">Ort</label><input class="fi" id="cf-ort" value="${esc(e.ort||'Bielefeld')}"></div>
    </div>
    ${!id?`<div class="fs"><div class="fst">Serientermin</div>
      <div class="fg"><label class="fl">Wiederholung</label><select class="fi" id="cf-repeat"><option value="">Kein</option><option value="weekly">Wöchentlich</option><option value="biweekly">Zweiwöchentlich</option><option value="monthly">Monatlich</option></select></div>
      <div class="fg"><label class="fl">Serienende (bei Serientermin)</label><input class="fi" type="date" id="cf-repeat-end"></div>
    </div>`:`<div class="fg" style="background:rgba(232,160,32,.08);border:0.5px solid rgba(232,160,32,.3);border-radius:var(--r);padding:8px 10px;font-size:12px;color:var(--text2)">${e.series_id?'🔁 Dies ist ein Serientermin. Änderungen gelten nur für diesen einzelnen Termin.':''}</div>`}
    <div class="fg"><label class="fl">Beschreibung</label><textarea class="fi" id="cf-desc">${esc(e.beschreibung||'')}</textarea></div>`;
  // Set category value after render
  setTimeout(()=>{const sel=document.getElementById('cf-cat');if(sel&&e.category)sel.value=e.category;},50);
  const footer=document.getElementById('cf-footer');footer.innerHTML='';
  const cb=document.createElement('button');cb.className='btn btn-g';cb.style.flex='1';cb.textContent='Abbrechen';cb.onclick=()=>closeModal('m-cal-form');
  const sb=document.createElement('button');sb.className='btn btn-p';sb.style.flex='2';sb.textContent='Speichern';sb.onclick=saveCalEvt;
  footer.appendChild(cb);footer.appendChild(sb);
  openModal('m-cal-form');
}

async function saveCalEvt(){
  const title=document.getElementById('cf-title').value.trim();
  const datum=document.getElementById('cf-datum').value;
  if(!title||!datum){T('Titel und Datum erforderlich','err');return;}
  const category=document.getElementById('cf-cat')?.value||'Chorprobe';
  const color=catColor(category);
  const bisD=document.getElementById('cf-bis-d').value||datum;
  const payload={title,datum,uhrzeit:document.getElementById('cf-time').value||null,bis_datum:bisD,bis_uhrzeit:document.getElementById('cf-bis-t').value||null,ort:document.getElementById('cf-ort').value.trim(),category,color,beschreibung:document.getElementById('cf-desc').value.trim()};
  if(editCalId){
    await SB.from('calendar_events').update(payload).eq('id',editCalId);
    closeModal('m-cal-form');renderCal();T('Termin aktualisiert','ok');return;
  }
  const repeat=document.getElementById('cf-repeat')?.value;
  const repeatEnd=document.getElementById('cf-repeat-end')?.value;
  if(repeat&&!repeatEnd){T('Bitte Serienende eingeben','err');return;}
  if(repeat&&repeatEnd){
    const seriesId=crypto.randomUUID();
    const dates=[];
    // Use local date parsing to avoid UTC offset issues
    const[sy,sm,sd]=datum.split('-').map(Number);
    const[ey,em,ed]=repeatEnd.split('-').map(Number);
    let cur=new Date(sy,sm-1,sd);
    const end=new Date(ey,em-1,ed);
    if(cur>end){T('Serienende muss nach Startdatum liegen','err');return;}
    let safety=0;
    while(cur<=end&&safety<500){
      const ds=`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      dates.push(ds);
      if(repeat==='weekly')cur.setDate(cur.getDate()+7);
      else if(repeat==='biweekly')cur.setDate(cur.getDate()+14);
      else cur.setMonth(cur.getMonth()+1);
      safety++;
    }
    if(!dates.length){T('Keine Termine im gewählten Zeitraum','err');return;}
    const inserts=dates.map(dt=>({...payload,datum:dt,bis_datum:dt,series_id:seriesId,created_by:currentUser.id}));
    // Insert in batches
    for(let i=0;i<inserts.length;i+=50)await SB.from('calendar_events').insert(inserts.slice(i,i+50));
    T(`${dates.length} Termine erstellt`,'ok');
  } else {
    const{error}=await SB.from('calendar_events').insert({...payload,created_by:currentUser.id});
    if(error){T('Fehler: '+error.message,'err');return;}
    T('Termin hinzugefügt','ok');
  }
  closeModal('m-cal-form');renderCal();
}

async function delCalEvt(id,hasSeries){
  if(hasSeries){
    const choice=confirm('Nur diesen Termin löschen?\n(OK = nur dieser, Abbrechen = alle aus der Serie)');
    if(choice){
      await SB.from('calendar_events').delete().eq('id',id);
    } else {
      if(!confirm('Alle Termine dieser Serie löschen?'))return;
      const{data}=await SB.from('calendar_events').select('series_id').eq('id',id).single();
      if(data?.series_id)await SB.from('calendar_events').delete().eq('series_id',data.series_id);
    }
  } else {
    if(!confirm('Termin löschen?'))return;
    await SB.from('calendar_events').delete().eq('id',id);
  }
  renderCal();T('Termin gelöscht');
}

