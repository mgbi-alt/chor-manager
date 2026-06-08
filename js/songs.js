// ========== SONGS ==========
async function renderSongs(){
  const[{data},{data:allFiles},{data:perfStats}]=await Promise.all([
    SB.from('songs').select('*').order('liedanfang',{nullsFirst:false}).order('title'),
    SB.from('song_files').select('song_id,file_type,url'),
    SB.from('song_performance_stats').select('song_id,last_performed,total_performances')
  ]);
  cachedSongs=data||[];
  // Build file map: song_id -> list of file_types
  const FILE_ORDER=['chorsatz','klaviersatz','chor_klavier','orchestersatz','sibelius'];
  window._songFileMap=new Map();
  (allFiles||[]).forEach(f=>{
    if(!window._songFileMap.has(f.song_id))window._songFileMap.set(f.song_id,[]);
    window._songFileMap.get(f.song_id).push({type:f.file_type,url:f.url});
  });
  // Build performance map: song_id -> {last_performed, total_performances}
  window._songPerfMap=new Map();
  (perfStats||[]).forEach(p=>{if(p.last_performed)window._songPerfMap.set(p.song_id,p);});
  buildFilters();displaySongs(filteredSongs());updateSourceBtn();
}
function updateSourceBtn(){
  const btn=document.getElementById('song-source-btn');if(!btn)return;
  const dbCount=cachedSongs.filter(s=>!s.in_repertoire).length;
  if(!dbCount){btn.style.display='none';return;}
  btn.style.display='';
  btn.textContent=showAllSources?'Nur Repertoire':'+ Datenbank ('+dbCount+')';
  btn.style.background=showAllSources?'rgba(201,168,76,.15)':'';
  btn.style.borderColor=showAllSources?'var(--accent)':'';
  btn.style.color=showAllSources?'var(--accent2)':'var(--text2)';
}
function toggleSongSource(){showAllSources=!showAllSources;updateSourceBtn();displaySongs(filteredSongs());updateFilterCount();}
function normalizeLabel(v){
  const small=new Set(['um','zu','in','an','von','der','die','das','und','oder','für','mit','am','im','auf','bei','&','a','the','of','and','or']);
  return v.trim().split(' ').map((w,i)=>{
    if(i>0&&small.has(w.toLowerCase()))return w.toLowerCase();
    return w.charAt(0).toUpperCase()+w.slice(1);
  }).join(' ');
}
function dedupeLabels(raw){const seen=new Map();raw.filter(Boolean).forEach(v=>{const n=normalizeLabel(v);const k=n.toLowerCase();if(!seen.has(k))seen.set(k,n);});return [...seen.values()].sort((a,b)=>a.localeCompare(b,'de'));}
function buildFilters(){
  const bes=[...new Set(cachedSongs.map(s=>s.besetzung).filter(Boolean))];
  const the=dedupeLabels(cachedSongs.flatMap(s=>(s.thema||'').split(',').map(t=>t.trim())));
  const anl=dedupeLabels(cachedSongs.flatMap(s=>(s.anlass||'').split(',').map(a=>a.trim())));
  // Persons: all composer/arranger/etc names
  const persons=[...new Set(cachedSongs.flatMap(s=>[s.komponist,s.textdichter,s.arrangeur,s.uebersetzer].filter(Boolean)))];
  const el=document.getElementById('song-filters');el.innerHTML='';
  const shownLabels=new Set();
  const addGroup=(items,key)=>items.forEach(v=>{const vl=v.toLowerCase();if(key!=='besetzung'&&shownLabels.has(vl))return;shownLabels.add(vl);const c=document.createElement('div');c.className='fchip'+(songFilter[key]===v?' active':'');c.textContent=v;c.onclick=()=>{songFilter[key]=songFilter[key]===v?'':v;buildFilters();displaySongs(filteredSongs());updateFilterCount();};el.appendChild(c);});
  addGroup(bes,'besetzung');addGroup(the,'thema');addGroup(anl,'anlass');
}
function filteredSongs(){
  const q=(document.getElementById('song-search')?.value||'').toLowerCase();
  return cachedSongs.filter(s=>{
    if(!showAllSources&&!s.in_repertoire)return false;
    if(q&&!['title','liedanfang','refrain','komponist','textdichter','arrangeur','uebersetzer'].some(k=>(s[k]||'').toLowerCase().includes(q)))return false;
    if(songFilter.besetzung&&s.besetzung!==songFilter.besetzung)return false;
    if(songFilter.thema&&!(s.thema||'').split(',').map(t=>normalizeLabel(t)).includes(songFilter.thema))return false;
    if(songFilter.anlass&&!(s.anlass||'').split(',').map(a=>normalizeLabel(a)).includes(songFilter.anlass))return false;
    if(songFilter.person){const p=songFilter.person.toLowerCase();if(!['komponist','textdichter','arrangeur','uebersetzer'].some(k=>(s[k]||'').toLowerCase().includes(p)))return false;}
    return true;
  }).sort((a,b)=>{
    const ka=(a.liedanfang||a.title||'').toLowerCase();
    const kb=(b.liedanfang||b.title||'').toLowerCase();
    return ka.localeCompare(kb,'de');
  });
}
function toggleFilters(){
  const row=document.getElementById('song-filters');
  const btn=document.getElementById('filter-toggle-btn');
  const label=document.getElementById('filter-toggle-label');
  const isOpen=row.classList.toggle('visible');
  btn.classList.toggle('open',isOpen);
  label.textContent=isOpen?'ausblenden':'anzeigen';
}

function updateFilterCount(){
  const active=[songFilter.besetzung,songFilter.thema,songFilter.anlass,songFilter.person].filter(Boolean).length;
  const countEl=document.getElementById('filter-active-count');
  if(countEl){countEl.textContent=active;countEl.style.display=active?'':'none';}
}
function filterSongs(){displaySongs(filteredSongs());updateFilterCount();}
function clearSongSearch(){
  document.getElementById('song-search').value='';
  songFilter={search:'',besetzung:'',thema:'',anlass:'',person:''};
  buildFilters();displaySongs(filteredSongs());updateFilterCount();
}
function clearEvSearch(){
  document.getElementById('ev-search').value='';
  evFilter={chor:''};
  buildEvFilters();displayEvents(filteredEvents());
}
function clearEvDateFilter(){
  document.getElementById('ev-from').value='';
  document.getElementById('ev-to').value='';
  filterEvents();
}
function displaySongs(songs){
  const el=document.getElementById('song-list');
  const countEl=document.getElementById('song-count');
  const repCount=cachedSongs.filter(s=>s.in_repertoire!==false).length;
  if(countEl)countEl.textContent=songs.length+' / '+repCount+(showAllSources?' (inkl. Datenbank)':'');
  if(!songs.length){el.innerHTML='<div class="empty"><p>Keine Lieder gefunden</p></div>';return;}
  el.innerHTML=songs.map(s=>{
    const fixTitle=t=>{if(!t)return t;const u=t.replace(/[ÄÖÜäöüA-Z]/g,'');return(t===t.toUpperCase()||t.replace(/\s/g,'')===t.replace(/\s/g,'').toUpperCase())?t.charAt(0).toUpperCase()+t.slice(1).toLowerCase():t;};
    const haupttext=s.liedanfang?`${esc(s.liedanfang)}${s.title&&s.title!==s.liedanfang?` <span style="color:var(--text3)">|</span> ${esc(fixTitle(s.title))}`:''}`:esc(fixTitle(s.title));
    const themen=(s.thema||'').split(',').map(t=>t.trim()).filter(Boolean);
    const anlaesse=(s.anlass||'').split(',').map(a=>a.trim()).filter(Boolean);
    const allTags=[...themen.map(t=>`<span class="badge blue" style="font-size:9px">${esc(t)}</span>`), ...anlaesse.map(a=>`<span class="badge green" style="font-size:9px">${esc(a)}</span>`)].join('');
    const isDbOnly=s.in_repertoire===false;
    const fileEntries=window._songFileMap?.get(s.id)||[];
    const FILE_ORDER=['chorsatz','klaviersatz','chor_klavier','orchestersatz','sibelius'];
    const FILE_ICONS={chorsatz:'📄',klaviersatz:'🎹',chor_klavier:'📄🎹',orchestersatz:'🎻',sibelius:'🎼'};
    const FILE_LABELS={chorsatz:'Chorsatz',klaviersatz:'Klaviersatz',chor_klavier:'Chor+Klavier',orchestersatz:'Orchestersatz',sibelius:'Sibelius-Datei'};
    const fileBadges=FILE_ORDER.filter(t=>fileEntries.some(e=>e.type===t)).map(t=>{const entry=fileEntries.find(e=>e.type===t);const isSib=t==='sibelius';return`<a href="${esc(entry?.url||'#')}" ${isSib?'download':'target="_blank"'} rel="noopener" title="${FILE_LABELS[t]} ${isSib?'herunterladen':'öffnen'}" onclick="event.stopPropagation()" style="font-size:12px;opacity:.85;text-decoration:none;cursor:pointer">${FILE_ICONS[t]}</a>`;}).join('');
    const perfBadge=(()=>{const p=window._songPerfMap?.get(s.id);if(!p)return'<span style="font-size:9px;color:var(--text3)">Noch nie</span>';const d=new Date(p.last_performed);const months=Math.round((Date.now()-d)/2628e6);const ago=months===0?'diesen Monat':months===1?'vor 1 Monat':months<12?`vor ${months} M.`:months<24?'vor 1 Jahr':`vor ${Math.floor(months/12)} J.`;return`<span style="font-size:9px;color:var(--text3)" title="${fD(p.last_performed)} · ${p.total_performances}×">${ago}</span>`;})();
    return`<div class="card" onclick="openSongDetail('${s.id}')" style="${isDbOnly?'border-color:rgba(91,141,238,.2);background:rgba(91,141,238,.04)':''}">
      <div class="crow">
        <div style="flex:1"><div class="ct">${haupttext}${isDbOnly?' <span style="font-size:9px;color:#8fb3f5;vertical-align:middle">DB</span>':''}${fileBadges?` <span style="margin-left:4px">${fileBadges}</span>`:''} ${perfBadge}</div><div class="cs">${esc(s.komponist)||'Unbekannt'}${s.arrangeur?' · Arr. '+esc(s.arrangeur):''}</div></div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
          ${s.besetzung?`<span class="badge">${esc(s.besetzung)}</span>`:''}

          ${isDbOnly?`<span class="badge blue" style="font-size:9px;cursor:pointer" onclick="event.stopPropagation();addToRepertoire('${s.id}')">+ Ins Repertoire</span>`:''}
          ${allTags?`<div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:flex-end;max-width:120px">${allTags}</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

async function openSongDetail(id){
  const s=cachedSongs.find(x=>x.id===id)||{};
  document.getElementById('sd-title').textContent=s.title||'Lied';
  const isAdmin=currentProfile?.role==='admin';
  function df(label,val,opts){
    if(!val)return`<div class="df"><div class="dl">${label}</div><div class="dv" style="color:var(--text3)">–</div></div>`;
    return`<div class="df ${opts==='full'?'style="grid-column:1/-1"':''}"><div class="dl">${label}</div><div class="dv">${opts==='badge'?`<span class="badge">${esc(val)}</span>`:esc(val)}</div></div>`;
  }
  // Song files - display only
  const{data:files}=await SB.from('song_files').select('*').eq('song_id',id);
  const fileLabels={'chorsatz':'PDF Chorsatz','klaviersatz':'PDF Klaviersatz','chor_klavier':'PDF Chor+Klavier','orchestersatz':'PDF Orchestersatz','sibelius':'Sibelius-Datei'};
  const filesHtml=(files||[]).length?`<div class="ddiv"></div><div class="dl">Dateien</div><div style="margin-top:6px">${(files||[]).map(f=>`<a href="${esc(f.url)}" target="_blank" class="ffile">📄 ${esc(fileLabels[f.file_type]||f.file_type)}</a>`).join('')}</div>`:'';  document.getElementById('sd-body').innerHTML=`
    <div class="dgrid" style="margin-bottom:12px">${df('Liedanfang',s.liedanfang)}${df('Refrainanfang',s.refrain)}${df('Besetzung',s.besetzung,'badge')}${df('Thema',s.thema)}${df('Anlass',s.anlass)}${df('Bibelstelle',s.bibelstelle)}${df('Schrank',s.schrank)}</div>
    <div class="ddiv"></div>
    <div class="dgrid" style="margin-bottom:12px">
      ${df('Komponist',s.komponist)}${s.komponist_lz?df('Lebensdaten',s.komponist_lz):''}
      ${df('Textdichter',s.textdichter)}${s.textdichter_lz?df('Lebensdaten',s.textdichter_lz):''}
      ${df('Arrangeur',s.arrangeur)}${s.arrangeur_lz?df('Lebensdaten',s.arrangeur_lz):''}
      ${df('Übersetzer / Deutscher Text',s.uebersetzer)}${s.uebersetzer_lz?df('Lebensdaten',s.uebersetzer_lz):''}
    </div>
    <div class="ddiv"></div>
    <div class="dgrid" style="margin-bottom:12px">
      ${df('Originaltitel',s.originaltitel)}
      <div class="df"><div class="dl">Quelle / Nr.</div><div class="dv">${s.quelle||s.quelle_nr?[s.quelle,s.quelle_nr].filter(Boolean).join(' · '):''}</div></div>
      <div class="df"><div class="dl">Rechte / Lizenz</div><div class="dv">${s.rechte||s.lizenz?[s.rechte,s.lizenz].filter(Boolean).join(' · '):''}</div></div>
    </div>
    ${s.created_at?`<div style="font-size:10px;color:var(--text3);margin-bottom:10px">Eingetragen: ${fD(s.created_at?.slice(0,10))}</div>`:''}
    ${(s.links||[]).length?`<div class="ddiv"></div><div class="dl">Links</div><div style="margin-top:5px">${s.links.map(l=>`<a href="${esc(l)}" target="_blank" class="ffile">${esc(l.replace(/https?:\/\//,'').substring(0,30))}</a>`).join('')}</div>`:''}
    ${filesHtml}
    ${s.notizen?`<div class="ddiv"></div><div class="df" style="grid-column:1/-1"><div class="dl">Notizen</div><div class="dv">${esc(s.notizen)}</div></div>`:''}`;
  const footer=document.getElementById('sd-footer');footer.innerHTML='';
  if(s.in_repertoire===false){
    const rb=document.createElement('button');rb.className='btn btn-p';rb.style.flex='2';
    rb.textContent='+ Ins Repertoire aufnehmen';
    rb.onclick=()=>addToRepertoire(id);
    footer.appendChild(rb);
  }
  if(isAdmin){
    const eb=document.createElement('button');eb.className='btn btn-g';eb.style.flex='2';eb.textContent='Bearbeiten';eb.onclick=()=>{closeModal('m-song-detail');openSongForm(id);};
    const db=document.createElement('button');db.className='btn btn-d btn-sm';db.style.flex='1';db.textContent='Löschen';db.onclick=()=>{if(confirm('Löschen?'))delSong(id);};
    footer.insertBefore(eb,footer.firstChild);footer.appendChild(db);
    // Remove from repertoire button (only for repertoire songs)
    if(s.in_repertoire!==false){
      const rrb=document.createElement('button');
      rrb.className='btn btn-sm';
      rrb.style.cssText='flex:1;background:rgba(232,160,32,.1);color:#f5c06a;border:0.5px solid rgba(232,160,32,.25)';
      rrb.textContent='↩ Aus Repertoire';
      rrb.onclick=()=>{if(confirm('Lied "'+esc(s.liedanfang||s.title)+'" aus dem Repertoire entfernen? Es bleibt in der Datenbank.'))removeFromRepertoire(id);};
      footer.insertBefore(rrb,db);
    }
  }
  // Make "+ Ins Repertoire" smaller too
  const rb2=footer.querySelector('.btn-p');if(rb2){rb2.style.flex='1';rb2.classList.add('btn-sm');}
  openModal('m-song-detail');
}

async function changeSongFileType(fileId,songId,newType,oldPath){
  // Move file in storage to new path
  const ext=(oldPath||'').split('.').pop()||'pdf';
  const newPath=`${songId}/${newType}.${ext}`;
  if(oldPath&&oldPath!==newPath){
    // Copy: download and re-upload
    try{
      const{data:dlData}=await SB.storage.from('choir-media').download(oldPath);
      if(dlData){
        await SB.storage.from('choir-media').upload(newPath,dlData,{upsert:true});
        await SB.storage.from('choir-media').remove([oldPath]);
        const{data:{publicUrl}}=SB.storage.from('choir-media').getPublicUrl(newPath);
        await SB.from('song_files').update({file_type:newType,path:newPath,url:publicUrl}).eq('id',fileId);
      }
    }catch(e){
      // Just update type in DB if move fails
      await SB.from('song_files').update({file_type:newType}).eq('id',fileId);
    }
  } else {
    await SB.from('song_files').update({file_type:newType}).eq('id',fileId);
  }
  T('Dateityp geändert','ok');
}

async function deleteSongFile(fileId,path,songId){
  if(!confirm('Datei löschen?'))return;
  if(path)await SB.storage.from('choir-media').remove([path]);
  await SB.from('song_files').delete().eq('id',fileId);
  T('Datei gelöscht');
  openSongDetail(songId);
}

async function uploadSongFile(songId, fileType, inputEl){
  const input=inputEl||document.getElementById(`sf-${fileType}`);
  if(!input?.files[0]){T('Keine Datei ausgewählt','err');return;}
  const file=input.files[0];
  const ext=file.name.split('.').pop().toLowerCase();
  const path=`${songId}/${fileType}.${ext}`;
  T('Wird hochgeladen…');
  const{error:upErr}=await SB.storage.from('choir-media').upload(path,file,{upsert:true,cacheControl:'3600'});
  if(upErr){
    const{error:upErr2}=await SB.storage.from('choir-media').upload(path,file);
    if(upErr2){T('Storage-Fehler: '+upErr2.message,'err');return;}
  }
  const{data:{publicUrl}}=SB.storage.from('choir-media').getPublicUrl(path);
  const{error:dbErr}=await SB.from('song_files').upsert({song_id:songId,file_type:fileType,url:publicUrl,path},{onConflict:'song_id,file_type'});
  if(dbErr){T('DB-Fehler: '+dbErr.message,'err');return;}
  input.value='';
  // Log file upload
  const s=cachedSongs.find(x=>x.id===songId);
  const typeLabels={chorsatz:'Chorsatz',klaviersatz:'Klaviersatz',chor_klavier:'Chor+Klavier',orchestersatz:'Orchestersatz',sibelius:'Sibelius-Datei'};
  await logActivity('update','song',songId,(s?.liedanfang||s?.title||songId),{datei:{von:null,nach:typeLabels[fileType]||fileType}});
  T('✓ Datei hochgeladen','ok');
}

function openSongForm(id=null,prefill={}){
  editSongId=id;
  const s=id?cachedSongs.find(x=>x.id===id)||{}:prefill;
  const headerLiedanfang=id?(s.liedanfang||s.title||''):'';
  document.getElementById('sf-title-h').innerHTML=id?`Lied bearbeiten<span style="font-family:var(--fb);font-weight:300;color:var(--text3);font-size:13px;margin-left:10px;padding-left:10px;border-left:1px solid var(--border2)">${esc(headerLiedanfang)}</span>`:'Lied hinzufügen';
  document.getElementById('sf-body').innerHTML=buildSongFormHTML(s,id);
  openModal('m-song-form');
  // Load existing files if editing
  if(id){
    SB.from('song_files').select('*').eq('song_id',id).then(({data:files})=>{
      const el=document.getElementById('sff-existing-'+id);
      if(!el||!files?.length)return;
      const labels={'chorsatz':'PDF Chorsatz','klaviersatz':'PDF Klaviersatz','chor_klavier':'PDF Chor+Klavier','orchestersatz':'PDF Orchestersatz','sibelius':'Sibelius-Datei'};
      const ftOptions=Object.keys(labels).map(ft=>`<option value="${ft}">${labels[ft]}</option>`).join('');
      el.innerHTML='<div class="dl" style="margin-bottom:6px">Vorhandene Dateien</div>'+
        files.map(f=>`<div style="display:flex;align-items:center;gap:7px;margin-bottom:7px;background:rgba(0,0,0,.15);border-radius:var(--r);padding:7px 10px">
          <span style="font-size:12px;flex:1">📄 ${esc(labels[f.file_type]||f.file_type)}</span>
          <select class="fi" style="font-size:11px;padding:4px 6px;width:140px" onchange="changeSongFileType('${f.id}','${f.song_id}',this.value,'${esc(f.path||'')}')">
            ${Object.keys(labels).map(ft=>`<option value="${ft}" ${ft===f.file_type?'selected':''}>${labels[ft]}</option>`).join('')}
          </select>
          <a href="${esc(f.url)}" target="_blank" class="btn btn-g btn-sm">↗</a>
          <button class="btn btn-d btn-sm" onclick="deleteSongFile('${f.id}','${esc(f.path||'')}',null)">✕</button>
        </div>`).join('');
    });
  }
}
function buildSongFormHTML(s,id=null){
  return`<div class="fs"><div class="fst">Allgemein</div>
    <div class="fr2"><div class="fg"><label class="fl">Titel (optional)</label><input class="fi" id="sf-title" value="${esc(s.title||'')}"></div><div class="fg"><label class="fl">Originaltitel</label><input class="fi" id="sf-orig" value="${esc(s.originaltitel||'')}"></div></div>
    <div class="fr2"><div class="fg"><label class="fl">Liedanfang</label><input class="fi" id="sf-anf" value="${esc(s.liedanfang||'')}"></div><div class="fg"><label class="fl">Refrainanfang</label><input class="fi" id="sf-ref" value="${esc(s.refrain||'')}"></div></div>
    <div class="fr2">
      <div class="fg"><label class="fl">Besetzung</label><select class="fi" id="sf-bes">${['','SATB','TTBB','SSAA','SSA','SAB','SSATBB','Gemischter Chor','Männerchor','Frauenchor'].map(b=>`<option value="${b}" ${(s.besetzung||'')==b?'selected':''}>${b||'– wählen –'}</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">Thema (Komma-getrennt)</label><input class="fi" id="sf-thema" value="${esc(s.thema||'')}" placeholder="z.B. Worship, Advent"></div>
    </div>
    <div class="fr2">
      <div class="fg"><label class="fl">Bibelstelle</label><input class="fi" id="sf-bibel" value="${esc(s.bibelstelle||'')}" placeholder="z.B. Joh 3,16 · Ps 23"></div>
      <div class="fg"><label class="fl">Schrank</label><select class="fi" id="sf-schrank"><option value="">–</option><option value="Haupt" ${s.schrank==='Haupt'?'selected':''}>Haupt</option><option value="Neben" ${s.schrank==='Neben'?'selected':''}>Neben</option></select></div>
    </div>
  </div>
  <div class="fs"><div class="fst">Personen & Lebensdaten</div>
    <div class="fr2"><div class="fg"><label class="fl">Komponist</label><input class="fi" id="sf-komp" value="${esc(s.komponist||'')}" list="dl-komp" autocomplete="off" oninput="fillPersonLz(this,'sf-komp-lz','komponist')"></div><div class="fg"><label class="fl">Lebensdaten</label><input class="fi" id="sf-komp-lz" value="${esc(s.komponist_lz||'')}" placeholder="z.B. 1685–1750"></div></div>
    <div class="fr2"><div class="fg"><label class="fl">Textdichter</label><input class="fi" id="sf-text" value="${esc(s.textdichter||'')}" list="dl-text" autocomplete="off" oninput="fillPersonLz(this,'sf-text-lz','textdichter')"></div><div class="fg"><label class="fl">Lebensdaten</label><input class="fi" id="sf-text-lz" value="${esc(s.textdichter_lz||'')}"></div></div>
    <div class="fr2"><div class="fg"><label class="fl">Arrangeur</label><input class="fi" id="sf-arr" value="${esc(s.arrangeur||'')}" list="dl-arr" autocomplete="off" oninput="fillPersonLz(this,'sf-arr-lz','arrangeur')"></div><div class="fg"><label class="fl">Lebensdaten</label><input class="fi" id="sf-arr-lz" value="${esc(s.arrangeur_lz||'')}"></div></div>
    <div class="fr2"><div class="fg"><label class="fl">Übersetzer / Deutscher Text</label><input class="fi" id="sf-ueb" value="${esc(s.uebersetzer||'')}" list="dl-ueb" autocomplete="off" oninput="fillPersonLz(this,'sf-ueb-lz','uebersetzer')"></div><div class="fg"><label class="fl">Lebensdaten</label><input class="fi" id="sf-ueb-lz" value="${esc(s.uebersetzer_lz||'')}"></div></div>
  </div>
  <div class="fs"><div class="fst">Rechtliches</div>
    <div class="fr2"><div class="fg"><label class="fl">Rechte</label><input class="fi" id="sf-recht" value="${esc(s.rechte||'')}"></div><div class="fg"><label class="fl">Lizenz</label><input class="fi" id="sf-liz" value="${esc(s.lizenz||'')}"></div></div>
    <div class="fr2"><div class="fg"><label class="fl">Quelle</label><input class="fi" id="sf-quelle" value="${esc(s.quelle||'')}"></div><div class="fg"><label class="fl">Quellen-Nr.</label><input class="fi" id="sf-quelle-nr" value="${esc(s.quelle_nr||'')}" placeholder="z.B. 42"></div></div>
  </div>
  <div class="fs"><div class="fst">Links & Notizen</div>
    <div class="fg"><label class="fl">YouTube / Spotify</label><input class="fi" id="sf-link" value="${esc((s.links||[])[0]||'')}" placeholder="https://…"></div>
    <div class="fg"><label class="fl">Notizen</label><textarea class="fi" id="sf-notiz">${esc(s.notizen||'')}</textarea></div>
  </div>
  ${id?`<div class="fs"><div class="fst">Dateien</div>
    <div id="sff-existing-${id}"></div>
    ${['chorsatz','klaviersatz','chor_klavier','orchestersatz','sibelius'].map(ft=>{
      const labels={'chorsatz':'PDF Chorsatz','klaviersatz':'PDF Klaviersatz','chor_klavier':'PDF Chor+Klavier','orchestersatz':'PDF Orchestersatz','sibelius':'Sibelius-Datei'};
      return`<div style="display:flex;align-items:center;gap:7px;margin-bottom:8px">
        <span style="font-size:12px;color:var(--text2);min-width:110px">${labels[ft]}</span>
        <input type="file" accept=".pdf,.sib,.sibelius" id="sff-${ft}" style="flex:1;font-size:11px;color:var(--text2)">
        <button class="btn btn-g btn-sm" onclick="uploadSongFile('${id}','${ft}',document.getElementById('sff-${ft}'))">↑</button>
      </div>`;
    }).join('')}
  </div>`:'<p style="font-size:11px;color:var(--text3);margin-top:4px">Dateien können nach dem ersten Speichern hochgeladen werden.</p>'}`;
}
async function saveSong(){
  const liedanfang=document.getElementById('sf-anf').value.trim();
  const title=document.getElementById('sf-title').value.trim()||liedanfang;
  if(!title){T('Bitte Liedanfang oder Titel eingeben','err');return;}
  const lv=document.getElementById('sf-link').value.trim();
  const payload={title,liedanfang:document.getElementById('sf-anf').value.trim(),refrain:document.getElementById('sf-ref').value.trim(),besetzung:document.getElementById('sf-bes').value,thema:document.getElementById('sf-thema').value.trim(),anlass:'',bibelstelle:document.getElementById('sf-bibel').value.trim(),schrank:document.getElementById('sf-schrank').value,komponist:document.getElementById('sf-komp').value.trim(),komponist_lz:document.getElementById('sf-komp-lz').value.trim(),textdichter:document.getElementById('sf-text').value.trim(),textdichter_lz:document.getElementById('sf-text-lz').value.trim(),arrangeur:document.getElementById('sf-arr').value.trim(),arrangeur_lz:document.getElementById('sf-arr-lz').value.trim(),uebersetzer:document.getElementById('sf-ueb').value.trim(),uebersetzer_lz:document.getElementById('sf-ueb-lz').value.trim(),rechte:document.getElementById('sf-recht').value.trim(),lizenz:document.getElementById('sf-liz').value.trim(),originaltitel:document.getElementById('sf-orig').value.trim(),quelle:document.getElementById('sf-quelle').value.trim(),quelle_nr:document.getElementById('sf-quelle-nr').value.trim(),links:lv?[lv]:[],notizen:document.getElementById('sf-notiz').value.trim(),updated_at:new Date().toISOString()};
  let error;
  if(editSongId){({error}=await SB.from('songs').update(payload).eq('id',editSongId));}
  else{({error}=await SB.from('songs').insert({...payload,in_repertoire:true,created_by:currentUser.id}));}
  if(error){T('Fehler: '+error.message,'err');return;}
  // Log activity
  if(editSongId){
    const before=cachedSongs.find(s=>s.id===editSongId)||{};
    const changes=diffObjects(before,payload,['title','liedanfang','besetzung','thema','komponist','textdichter','arrangeur','uebersetzer','rechte','lizenz','originaltitel','quelle','quelle_nr','bibelstelle','schrank','notizen']);
    if(changes)await logActivity('update','song',editSongId,payload.liedanfang||payload.title,changes);
    // If no field changes, nothing to log (e.g. only PDF was changed)
  } else {
    await logActivity('create','song','new',payload.liedanfang||payload.title);
  }
  closeModal('m-song-form');renderSongs();T(editSongId?'Lied aktualisiert':'Lied hinzugefügt','ok');
}
async function delSong(id){
  const s=cachedSongs.find(x=>x.id===id);
  await SB.from('songs').delete().eq('id',id);
  await logActivity('delete','song',id,s?.liedanfang||s?.title||id);
  closeModal('m-song-detail');renderSongs();T('Lied gelöscht');
}
async function removeFromRepertoire(id){
  const{error}=await SB.from('songs').update({in_repertoire:false}).eq('id',id);
  if(error){T('Fehler: '+error.message,'err');return;}
  const s=cachedSongs.find(x=>x.id===id);if(s)s.in_repertoire=false;
  closeModal('m-song-detail');
  displaySongs(filteredSongs());updateFilterCount();
  const sr=cachedSongs.find(x=>x.id===id);
  await logActivity('update','song',id,(sr?.liedanfang||sr?.title||id),{in_repertoire:{von:true,nach:false}});
  T('✓ Aus Repertoire entfernt','ok');
}
async function addToRepertoire(id){
  const{error}=await SB.from('songs').update({in_repertoire:true}).eq('id',id);
  if(error){T('Fehler: '+error.message,'err');return;}
  const s=cachedSongs.find(x=>x.id===id);if(s)s.in_repertoire=true;
  const sa=cachedSongs.find(x=>x.id===id);
  await logActivity('update','song',id,(sa?.liedanfang||sa?.title||id),{in_repertoire:{von:false,nach:true}});
  T('✅ Ins Repertoire aufgenommen','ok');
  closeModal('m-song-detail');
  displaySongs(filteredSongs());updateSourceBtn();
}

// ========== CSV IMPORT/EXPORT ==========
async function importCSV(event){
  const file=event.target.files[0];if(!file)return;
  // Try multiple encodings in order of likelihood
  let text='';
  const buf=await file.arrayBuffer();
  const tryEncodings=['utf-8','windows-1252','iso-8859-1','iso-8859-15'];
  for(const enc of tryEncodings){
    try{
      const dec=new TextDecoder(enc,{fatal:true});
      const t=dec.decode(buf);
      // Count replacement/control chars to judge quality
      const bad=(t.match(/[\uFFFD\x00-\x08\x0E-\x1F]/g)||[]).length;
      if(bad<5){text=t;console.log('CSV encoding detected:',enc);break;}
    }catch(e){continue;}
  }
  if(!text){text=new TextDecoder('windows-1252').decode(buf);}
  // Remove BOM
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  // Quote-aware line splitting (handles newlines inside quoted fields)
  const lines=[];let curLine='';let inQLn=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"')inQLn=!inQLn;
    if((c==='\n'||c==='\r')&&!inQLn){
      if(curLine.trim())lines.push(curLine);
      curLine='';if(c==='\r'&&text[i+1]==='\n')i++;
    }else curLine+=c;
  }
  if(curLine.trim())lines.push(curLine);
  if(lines.length<2){T('CSV leer oder ungültig','err');return;}
  // Quote-aware delimiter detection
  const firstLine=lines[0];
  let commaCount=0,semiCount=0,inQ=false;
  for(const c of firstLine){if(c==='"')inQ=!inQ;else if(!inQ){if(c===',')commaCount++;else if(c===';')semiCount++;}}
  const sep=semiCount>=commaCount?';':',';
  const headers=parseCSVLine(firstLine,sep).map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase().trim());
  console.log(`CSV: delimiter="${sep}" rows=${lines.length-1}`);
  if(!headers.includes('title')&&!headers.includes('titel')){
    T(`Spalte "title" nicht gefunden. Erkannte Spalten: ${headers.slice(0,5).join(', ')}…`,'err');
    event.target.value='';return;
  }
  const getVal=(vals,name)=>{
    const aliases={'title':['titel'],'liedanfang':['anfang'],'komponist':['composer'],'textdichter':['dichter','lyricist']};
    let idx=headers.indexOf(name);
    if(idx<0&&aliases[name])for(const a of aliases[name]){idx=headers.indexOf(a);if(idx>=0)break;}
    if(idx<0||idx>=vals.length)return'';
    return vals[idx].replace(/^"|"$/g,'').trim();
  };
  
  const songs=[];
  let skipped=0;
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim())continue;
    const vals=parseCSVLine(lines[i],sep);
    const liedanfang=getVal(vals,'liedanfang');
    const title=getVal(vals,'title'); // Keep empty if not in CSV - do NOT fall back to liedanfang
    if(!liedanfang&&!title){skipped++;continue;} // Skip only if both empty
    songs.push({
      title:title||liedanfang, // DB needs a title, use liedanfang only as internal key
      liedanfang,refrain:getVal(vals,'refrain'),
      besetzung:getVal(vals,'besetzung'),thema:getVal(vals,'thema'),anlass:getVal(vals,'anlass'),
      textdichter:getVal(vals,'textdichter'),textdichter_lz:getVal(vals,'textdichter_lz'),
      komponist:getVal(vals,'komponist'),komponist_lz:getVal(vals,'komponist_lz'),
      arrangeur:getVal(vals,'arrangeur'),arrangeur_lz:getVal(vals,'arrangeur_lz'),
      uebersetzer:getVal(vals,'uebersetzer'),uebersetzer_lz:getVal(vals,'uebersetzer_lz'),
      rechte:getVal(vals,'rechte'),originaltitel:getVal(vals,'originaltitel'),
      quelle:getVal(vals,'quelle'),quelle_nr:getVal(vals,'quelle_nr'),lizenz:getVal(vals,'lizenz'),
      schrank:getVal(vals,'schrank'),notizen:getVal(vals,'notizen'),
      links:[],created_by:currentUser.id
    });
  }
  console.log(`CSV: ${songs.length} valid, ${skipped} skipped, total ${lines.length-1}`);
  if(!songs.length){T('Keine gültigen Zeilen gefunden','err');event.target.value='';return;}
  T(`${songs.length} Lieder gefunden, vergleiche mit Datenbank…`);
  // Load existing songs for comparison
  const{data:existing}=await SB.from('songs').select('id,title,liedanfang');
  const existingMap={};
  (existing||[]).forEach(s=>{
    // Index by liedanfang (primary) and title (fallback)
    if(s.liedanfang)existingMap[s.liedanfang.toLowerCase().trim()]=s.id;
    existingMap['t:'+s.title.toLowerCase().trim()]=s.id;
  });
  const toInsert=[];const toUpdate=[];
  songs.forEach(s=>{
    const keyLied=(s.liedanfang||'').toLowerCase().trim();
    const keyTitle='t:'+s.title.toLowerCase().trim();
    const existId=keyLied&&existingMap[keyLied]?existingMap[keyLied]:existingMap[keyTitle];
    if(existId){
      const{created_by,...upd}=s;
      toUpdate.push({id:existId,...upd});
    } else {
      toInsert.push(s);
    }
  });
  T(`${toInsert.length} neu · ${toUpdate.length} aktualisieren…`);
  let imported=0,updated=0,errors=0;
  // Insert new songs in batches
  for(let i=0;i<toInsert.length;i+=50){
    const{error}=await SB.from('songs').insert(toInsert.slice(i,i+50));
    if(error){
      for(const s of toInsert.slice(i,i+50)){
        const{error:e2}=await SB.from('songs').insert(s);
        if(!e2)imported++;else{console.warn('Skip "'+s.title+'":',e2.message);errors++;}
      }
    } else imported+=Math.min(50,toInsert.length-i);
    T(`Neu: ${imported}/${toInsert.length} · Aktualisiert: ${updated}/${toUpdate.length}…`);
  }
  // Update existing songs one by one (upsert by id)
  for(let i=0;i<toUpdate.length;i++){
    const{id,...fields}=toUpdate[i];
    const{error}=await SB.from('songs').update(fields).eq('id',id);
    if(!error)updated++;else{console.warn('Update error:',error.message);errors++;}
    if(i%20===0)T(`Neu: ${imported}/${toInsert.length} · Aktualisiert: ${updated}/${toUpdate.length}…`);
  }
  event.target.value='';
  renderSongs();
  T(`✅ ${imported} neu importiert · ${updated} aktualisiert${errors?` · ${errors} Fehler`:''}`,'ok');
}
function parseCSVLine(line,sep=','){
  const result=[];let cur='';let inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(inQ&&line[i+1]==='"'){cur+='"';i++;}
      else inQ=!inQ;
    } else if(c===sep&&!inQ){result.push(cur.trim());cur='';}
    else cur+=c;
  }
  result.push(cur.trim());
  return result;
}
async function exportCSV(){
  const{data:songs}=await SB.from('songs').select('*').order('title');
  if(!songs?.length){T('Keine Lieder zum Exportieren','err');return;}
  const headers=['liedanfang','title','refrain','besetzung','thema','anlass','textdichter','textdichter_lz','komponist','komponist_lz','arrangeur','arrangeur_lz','uebersetzer','uebersetzer_lz','rechte','originaltitel','quelle','quelle_nr','lizenz','schrank','notizen'];
  const rows=[headers,...songs.map(s=>headers.map(h=>s[h]||''))];
  const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));a.download='repertoire.csv';a.click();
  T('CSV exportiert','ok');
}

