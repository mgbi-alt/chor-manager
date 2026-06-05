// ========== MEDIA ==========
// ========== ANALYTICS ==========
function initStats(){
  const msgs=document.getElementById('chat-msgs');
  if(!msgs.children.length)addBot('Hallo! Ich helfe mit Auswertungen.\n\nBeispiele:\n• Wann haben wir [Titel] zuletzt gesungen?\n• Wie oft haben wir [Titel] gesungen?\n• Lieder die noch nie gesungen wurden\n• Liedvorschläge\n• Lieder 2024');
}
function addBot(txt){const el=document.getElementById('chat-msgs');const d=document.createElement('div');d.className='cmsg bot';d.innerHTML=`<div class="bbl">${txt.replace(/\n/g,'<br>')}</div>`;el.appendChild(d);el.scrollTop=el.scrollHeight;}
function addUser(txt){const el=document.getElementById('chat-msgs');const d=document.createElement('div');d.className='cmsg user';d.innerHTML=`<div class="bbl">${esc(txt)}</div>`;el.appendChild(d);el.scrollTop=el.scrollHeight;}
async function sendChat(){const inp=document.getElementById('chat-in');const q=inp.value.trim();if(!q)return;inp.value='';addUser(q);addBot(await queryEngine(q));}
async function queryEngine(q){
  const ql=q.toLowerCase();
  const{data:songs}=await SB.from('songs').select('id,title,thema,anlass,besetzung');
  const{data:stats}=await SB.from('song_performance_stats').select('*');
  const matched=(songs||[]).find(s=>ql.includes(s.title.toLowerCase()));
  const isLast=ql.includes('zuletzt')||ql.includes('wann');
  const isOften=ql.includes('wie oft')||ql.includes('häufig');
  const isNever=ql.includes('noch nie');
  const isSug=ql.includes('vorschlag')||ql.includes('lange nicht');
  const isRank=ql.includes('ranking')||ql.includes('häufigsten');
  const year=/\b(20\d\d)\b/.exec(ql)?.[1];
  if(matched){const st=(stats||[]).find(s=>s.song_id===matched.id);if(!st||!st.total_performances)return`"${matched.title}" wurde noch nie gesungen.`;if(isOften)return`"${matched.title}" wurde ${st.total_performances}× gesungen.\nZuletzt: ${fD(st.last_performed)}`;if(isLast)return`"${matched.title}" zuletzt am ${fD(st.last_performed)} (${st.total_performances}×).`;return`"${matched.title}": ${st.total_performances}×\nZuletzt: ${fD(st.last_performed)}`;}
  if(year){const{data:evts}=await SB.from('events').select('id,event_program(song_id,songs(title))').gte('datum',`${year}-01-01`).lte('datum',`${year}-12-31`);const cnt={};(evts||[]).forEach(e=>(e.event_program||[]).forEach(p=>{const t=p.songs?.title||'?';cnt[t]=(cnt[t]||0)+1;}));const rows=Object.entries(cnt).sort((a,b)=>b[1]-a[1]);return rows.length?`Lieder ${year}:\n`+rows.map(([t,c])=>`• ${t}: ${c}×`).join('\n'):`${year} keine Daten.`;}
  if(isNever){const si=new Set((stats||[]).filter(s=>s.total_performances>0).map(s=>s.song_id));const ns=(songs||[]).filter(s=>!si.has(s.id));return ns.length?`Noch nie gesungen:\n`+ns.map(s=>`• ${s.title}`).join('\n'):'Alle gesungen!';}
  if(isSug){const sorted=(stats||[]).filter(s=>s.last_performed).sort((a,b)=>a.last_performed.localeCompare(b.last_performed)).slice(0,5);const si=new Set((stats||[]).filter(s=>s.total_performances>0).map(s=>s.song_id));const ns=(songs||[]).filter(s=>!si.has(s.id)).slice(0,3);let r='📅 Lange nicht:\n'+sorted.map(s=>`• ${s.title} (${fD(s.last_performed)})`).join('\n');if(ns.length)r+='\n\n🆕 Noch nie:\n'+ns.map(s=>`• ${s.title}`).join('\n');return r;}
  if(isRank){const sorted=(stats||[]).sort((a,b)=>b.total_performances-a.total_performances).slice(0,10);return sorted.length?'Ranking:\n'+sorted.map((s,i)=>`${i+1}. ${s.title}: ${s.total_performances}×`).join('\n'):'Keine Daten.';}
  if(isLast){const sorted=(stats||[]).filter(s=>s.last_performed).sort((a,b)=>b.last_performed.localeCompare(a.last_performed)).slice(0,8);return sorted.length?'Zuletzt gesungen:\n'+sorted.map(s=>`• ${s.title}: ${fD(s.last_performed)}`).join('\n'):'Keine Daten.';}
  return'Nicht verstanden. Versuche z.B.:\n• "Wann haben wir [Titel] zuletzt gesungen?"\n• "Liedvorschläge"\n• "Ranking"';
}
async function runQ(type){
  const el=document.getElementById('q-result');el.innerHTML='<div class="loading"><div class="spin"></div>Wird ausgewertet…</div>';
  const{data:stats}=await SB.from('song_performance_stats').select('*');
  const{data:songs}=await SB.from('songs').select('id,title,thema,anlass,besetzung,komponist');
  let html='',csvRows=[];
  if(type==='last_sung'){const d=(stats||[]).filter(s=>s.last_performed).sort((a,b)=>b.last_performed.localeCompare(a.last_performed));csvRows=[['Titel','Komponist','Zuletzt','Anzahl'],...d.map(s=>[s.title,s.komponist||'',fD(s.last_performed),s.total_performances])];html=tbl(['Titel','Zuletzt','Anzahl'],d.map(s=>[esc(s.title),fD(s.last_performed),s.total_performances]));}
  else if(type==='never'){const si=new Set((stats||[]).filter(s=>s.total_performances>0).map(s=>s.song_id));const d=(songs||[]).filter(s=>!si.has(s.id));csvRows=[['Titel','Komponist','Besetzung'],...d.map(s=>[s.title,s.komponist||'',s.besetzung||''])];html=tbl(['Titel','Komponist','Besetzung'],d.map(s=>[esc(s.title),esc(s.komponist||'–'),esc(s.besetzung||'–')]));}
  else if(type==='ranking'){const d=(stats||[]).sort((a,b)=>b.total_performances-a.total_performances);csvRows=[['#','Titel','Anzahl','Zuletzt'],...d.map((s,i)=>[i+1,s.title,s.total_performances,fD(s.last_performed)||'–'])];html=tbl(['#','Titel','Anzahl','Zuletzt'],d.map((s,i)=>[i+1,esc(s.title),s.total_performances,fD(s.last_performed)||'–']));}
  else if(type==='suggestions'){const sorted=(stats||[]).filter(s=>s.last_performed).sort((a,b)=>a.last_performed.localeCompare(b.last_performed)).slice(0,10);const si=new Set((stats||[]).filter(s=>s.total_performances>0).map(s=>s.song_id));const ns=(songs||[]).filter(s=>!si.has(s.id)).slice(0,5);csvRows=[['Titel','Zuletzt','Anzahl'],...sorted.map(s=>[s.title,fD(s.last_performed),s.total_performances]),...ns.map(s=>[s.title,'Noch nie',0])];html='<div class="st">Lange nicht gesungen</div>'+tbl(['Titel','Zuletzt','Anzahl'],sorted.map(s=>[esc(s.title),fD(s.last_performed),s.total_performances]))+'<div class="st">Noch nie gesungen</div>'+tbl(['Titel','Besetzung'],ns.map(s=>[esc(s.title),esc(s.besetzung||'–')]));}
  else if(type==='period'){const from=document.getElementById('q-from').value,to=document.getElementById('q-to').value;if(!from||!to){el.innerHTML='<p style="color:var(--danger);font-size:12px">Bitte Von- und Bis-Datum wählen</p>';return;}const{data:evts}=await SB.from('events').select('id,event_program(song_id,songs(title,besetzung,komponist))').gte('datum',from).lte('datum',to);const cnt={};(evts||[]).forEach(e=>(e.event_program||[]).forEach(p=>{const k=p.song_id;if(!cnt[k])cnt[k]={title:p.songs?.title||'?',besetzung:p.songs?.besetzung||'',komponist:p.songs?.komponist||'',n:0};cnt[k].n++;}));const d=Object.values(cnt).sort((a,b)=>b.n-a.n);csvRows=[['Titel','Komponist','Besetzung','Anzahl'],...d.map(s=>[s.title,s.komponist,s.besetzung,s.n])];html=`<p style="font-size:12px;color:var(--text2);margin-bottom:7px">${fD(from)} – ${fD(to)}</p>`+tbl(['Titel','Besetzung','Anzahl'],d.map(s=>[esc(s.title),esc(s.besetzung||'–'),s.n]));}
  el.innerHTML=html+`<button class="btn btn-g" style="width:100%;margin-top:9px" onclick='doExportCSV(${JSON.stringify(csvRows)})'>CSV exportieren</button>`;
}
function tbl(hdr,rows){if(!rows.length)return'<p style="color:var(--text3);font-size:12px">Keine Daten</p>';return`<div style="overflow-x:auto"><table class="rtable"><thead><tr>${hdr.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function doExportCSV(rows){const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));a.download='chor-auswertung.csv';a.click();T('CSV exportiert','ok');}

// ========== MEDIA ==========
async function renderMedia(){
  const el=document.getElementById('media-list');
  el.innerHTML='<div class="loading"><div class="spin"></div>Lade…</div>';
  const isAdmin=currentProfile?.role==='admin';
  const[{data:albums},{data:media}]=await Promise.all([
    SB.from('media_albums').select('*').order('name'),
    SB.from('media').select('*,profiles(name)').order('created_at',{ascending:false})
  ]);
  const allAlbums=albums||[];
  const allMedia=media||[];
  let html='';
  // Render each album
  allAlbums.forEach(alb=>{
    const items=allMedia.filter(m=>m.album_id===alb.id);
    const imgs=items.filter(m=>m.type==='image');
    const auds=items.filter(m=>m.type==='audio');
    const delBtn=isAdmin?`<div style="display:flex;gap:5px"><button class="btn btn-g btn-sm" onclick="openMediaUpload('${alb.id}')">+ Datei</button><button class="btn btn-d btn-sm" onclick="deleteAlbum('${alb.id}')">✕</button></div>`:'';
    html+=`<div class="album-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div><div style="font-weight:500;font-size:15px">📁 ${esc(alb.name)}</div>${alb.description?`<div class="cs">${esc(alb.description)}</div>`:''}<div class="cs">${imgs.length} Bild${imgs.length!==1?'er':''} · ${auds.length} Audio</div></div>
        ${delBtn}
      </div>
      ${imgs.length?`<div class="album-grid">${imgs.map(m=>`<div class="album-thumb" onclick="openFull('${esc(m.url)}','${esc(m.title)}')">${isAdmin?`<div onclick="event.stopPropagation();deleteMedia('${m.id}','${esc(m.path||'')}')" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;z-index:1">✕</div>`:''}<img src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy"></div>`).join('')}</div>`:''}
      ${auds.map(m=>`<div style="background:rgba(0,0,0,.2);border-radius:var(--r);padding:8px;margin-bottom:6px"><div style="font-size:12px;font-weight:500;margin-bottom:4px">${esc(m.title)}</div><audio controls style="width:100%;height:32px"><source src="${esc(m.url)}"></audio>${isAdmin?`<button class="btn btn-d btn-sm" style="margin-top:4px" onclick="deleteMedia('${m.id}','${esc(m.path||'')}')">Löschen</button>`:''}</div>`).join('')}
      ${!items.length?'<p style="font-size:12px;color:var(--text3)">Noch keine Dateien in diesem Album</p>':''}
    </div>`;
  });
  // Unassigned
  const unassigned=allMedia.filter(m=>!m.album_id);
  if(unassigned.length){
    const uImgs=unassigned.filter(m=>m.type==='image');
    const uAuds=unassigned.filter(m=>m.type==='audio');
    html+=`<div class="album-card"><div style="font-weight:500;font-size:15px;margin-bottom:8px">📂 Ohne Album</div>
      ${uImgs.length?`<div class="album-grid">${uImgs.map(m=>`<div class="album-thumb" onclick="openFull('${esc(m.url)}','${esc(m.title)}')">${isAdmin?`<div onclick="event.stopPropagation();deleteMedia('${m.id}','${esc(m.path||'')}')" style="position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6);color:#fff;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:10px;z-index:1">✕</div>`:''}<img src="${esc(m.url)}" alt="${esc(m.title)}" loading="lazy"></div>`).join('')}</div>`:''}
      ${uAuds.map(m=>`<div style="background:rgba(0,0,0,.2);border-radius:var(--r);padding:8px;margin-bottom:6px"><div style="font-size:12px;font-weight:500;margin-bottom:4px">${esc(m.title)}</div><audio controls style="width:100%;height:32px"><source src="${esc(m.url)}"></audio>${isAdmin?`<button class="btn btn-d btn-sm" style="margin-top:4px" onclick="deleteMedia('${m.id}','${esc(m.path||'')}')">Löschen</button>`:''}</div>`).join('')}
    </div>`;
  }
  if(!html)html='<div class="empty"><p>Noch keine Medien</p></div>';
  el.innerHTML=html;
}
function openFull(url,title){
  const ov=document.getElementById('fs-overlay');
  document.getElementById('fs-img').src=url;
  document.getElementById('fs-caption').textContent=title||'';
  ov.style.display='flex';document.body.style.overflow='hidden';
}
function closeFull(){
  document.getElementById('fs-overlay').style.display='none';
  document.getElementById('fs-img').src='';
  document.body.style.overflow='';
}
function openAlbumForm(){
  document.getElementById('alb-name').value='';
  document.getElementById('alb-desc').value='';
  openModal('m-album-form');
}
async function saveAlbum(){
  const name=document.getElementById('alb-name').value.trim();
  if(!name){T('Bitte Album-Namen eingeben','err');return;}
  const{error}=await SB.from('media_albums').insert({name,description:document.getElementById('alb-desc').value.trim(),created_by:currentUser.id});
  if(error){T('Fehler: '+error.message,'err');return;}
  closeModal('m-album-form');renderMedia();T('Album erstellt','ok');
}
async function deleteAlbum(id){
  if(!confirm('Album löschen? Dateien bleiben erhalten.'))return;
  await SB.from('media').update({album_id:null}).eq('album_id',id);
  await SB.from('media_albums').delete().eq('id',id);
  renderMedia();T('Album gelöscht');
}
function openMediaUpload(albumId=null){
  window._uploadAlbumId=albumId;
  document.getElementById('mf-title').value='';
  document.getElementById('mf-desc').value='';
  document.getElementById('mf-file').value='';
  document.getElementById('mf-preview').innerHTML='';
  document.getElementById('mf-progress').innerHTML='';
  openModal('m-media-form');
}
function previewMedia(){
  const files=[...document.getElementById('mf-file').files];
  const prev=document.getElementById('mf-preview');
  if(!files.length){prev.innerHTML='';return;}
  prev.innerHTML=files.map(f=>{const url=URL.createObjectURL(f);return f.type.startsWith('image/')?`<img src="${url}" style="width:100%;max-height:100px;object-fit:cover;border-radius:var(--r);margin-bottom:4px">`:`<div style="font-size:12px;color:var(--text2);margin-bottom:4px">🎵 ${esc(f.name)}</div>`;}).join('');
}
async function uploadMedia(){
  const title=document.getElementById('mf-title').value.trim();
  const files=[...document.getElementById('mf-file').files];
  if(!title||!files.length){T('Titel und Datei erforderlich','err');return;}
  const btn=document.getElementById('mf-btn');const prog=document.getElementById('mf-progress');
  btn.textContent='Wird hochgeladen…';btn.disabled=true;
  let ok=0;
  for(const file of files){
    prog.innerHTML=`<div style="font-size:12px;color:var(--text2)">Lade ${esc(file.name)}…</div>`;
    const ext=file.name.split('.').pop();
    const path=`${currentUser.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const type=file.type.startsWith('image/')?'image':'audio';
    const{error:upErr}=await SB.storage.from('choir-media').upload(path,file);
    if(upErr){T('Fehler bei '+file.name+': '+upErr.message,'err');continue;}
    const{data:{publicUrl}}=SB.storage.from('choir-media').getPublicUrl(path);
    const obj={title:files.length>1?title+' – '+file.name:title,description:document.getElementById('mf-desc').value.trim(),url:publicUrl,path,type,created_by:currentUser.id};
    if(window._uploadAlbumId)obj.album_id=window._uploadAlbumId;
    await SB.from('media').insert(obj);ok++;
  }
  btn.textContent='Hochladen';btn.disabled=false;
  if(ok){closeModal('m-media-form');renderMedia();T(`${ok} Datei${ok>1?'en':''} hochgeladen`,'ok');}
}
async function deleteMedia(id,path){
  if(!confirm('Löschen?'))return;
  if(path)await SB.storage.from('choir-media').remove([path]);
  await SB.from('media').delete().eq('id',id);renderMedia();T('Gelöscht');
}

