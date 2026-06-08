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

