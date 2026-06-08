// ========== PROFILE ==========
function openProfile(){
  const p=currentProfile||{};const parts=(p.name||'').split(' ');const vname=parts[0]||'';const nname=parts.slice(1).join(' ')||'';
  document.getElementById('prof-body').innerHTML=`
    <div class="fs"><div class="fst">Persönliche Daten</div>
      <div class="fr2"><div class="fg"><label class="fl">Vorname</label><input class="fi" id="pm-vname" value="${esc(vname)}"></div><div class="fg"><label class="fl">Nachname</label><input class="fi" id="pm-nname" value="${esc(nname)}"></div></div>
      <div class="fr2"><div class="fg"><label class="fl">E-Mail</label><input class="fi" id="pm-email" value="${esc(p.email||'')}" type="email"></div><div class="fg"><label class="fl">Telefon</label><input class="fi" id="pm-phone" value="${esc(p.phone||'')}" type="tel"></div></div>
      <div class="fg"><label class="fl">Adresse</label><input class="fi" id="pm-addr" value="${esc(p.address||'')}"></div>
      <div class="fg"><label class="fl">Stimmgruppe</label><select class="fi" id="pm-stimme">${['','Sopran','Alt','Tenor','Bass'].map(s=>`<option value="${s}" ${p.stimme===s?'selected':''}>${s||'– wählen –'}</option>`).join('')}</select></div>
    </div>
    <div class="fs"><div class="fst">Konto</div>
      <div class="df"><div class="dl">Rolle</div><div class="dv"><span class="badge ${p.role==='admin'?'warn':''}">${p.role==='admin'?'Admin':'Mitglied'}</span>${p.role2?` <span class="badge blue">${esc(p.role2.split(',').map(r=>r==='dirigent'?'Dirigent':'Klavier').join(' & '))}</span>`:''}</div></div>
      <div class="fg" style="margin-top:10px"><label class="fl">Neues Passwort</label><input class="fi" id="pm-pass" type="password" placeholder="Leer lassen = nicht ändern"></div>
      <div class="fg"><label class="fl">Passwort bestätigen</label><input class="fi" id="pm-pass2" type="password" placeholder="Passwort wiederholen"></div>
      <button class="btn btn-i" style="width:100%;margin-top:8px" id="push-btn" onclick="enablePush()">🔔 Push-Benachrichtigungen aktivieren</button>
      <button class="btn btn-d" style="width:100%;margin-top:8px" onclick="doLogout()">Abmelden</button>
    </div>`;
  openModal('m-profile');
}
async function saveProfile(){
  const vname=document.getElementById('pm-vname').value.trim(),nname=document.getElementById('pm-nname').value.trim();
  const name=(vname+' '+nname).trim();
  const u={name,phone:document.getElementById('pm-phone').value.trim(),address:document.getElementById('pm-addr').value.trim(),stimme:document.getElementById('pm-stimme').value};
  await SB.from('profiles').update(u).eq('id',currentUser.id);
  // Password change
  const pass=document.getElementById('pm-pass')?.value;
  const pass2=document.getElementById('pm-pass2')?.value;
  if(pass){
    if(pass!==pass2){T('Passwörter stimmen nicht überein','err');return;}
    if(pass.length<6){T('Passwort muss mindestens 6 Zeichen haben','err');return;}
    const{error}=await SB.auth.updateUser({password:pass});
    if(error){T('Passwort-Fehler: '+error.message,'err');return;}
    T('Profil & Passwort gespeichert','ok');
  } else {
    T('Profil gespeichert','ok');
  }
  currentProfile={...currentProfile,...u};
  document.getElementById('tb-name').textContent=name;
  document.getElementById('tb-av').textContent=initials(name)||'?';
  closeModal('m-profile');
}

// ========== MODAL CLOSE ==========
document.querySelectorAll('.mo').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));
document.getElementById('l-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

// ========== DB CLEANUP ==========
async function runDbCleanup(){
  // Merge map: old value (lowercase) -> canonical value
  const THEMA_MERGE={
    'dank':'Dankbarkeit',
    'jesu auferstehung':'Auferstehung',
    'fürbitte':'Gebet',
    'gemeinschaftlicher lobpreis':'Lobpreis',
    'wiederkunft':'Wiederkunft Christi',
    'gottes herrschaft':'Gottes Herrschaft',
    'königsherrschaft gottes':'Gottes Herrschaft',
    'jesus':'Jesus Christus',
    'wort gottes':'Gottes Wort',
  };
  // Anlass values to move into thema (canonical forms)
  const ANLASS_TO_THEMA=['Abendmahl','Advent','Erntedank','Gottesdienst','Ostern','Passion','Taufe','Weihnachten','Himmelfahrt','Hochzeit','Karfreitag','Neujahr','Pfingsten','Evangelisation','Jahreswechsel'];

  const{data:songs,error}=await SB.from('songs').select('id,thema,anlass');
  if(error){alert('Fehler beim Laden: '+error.message);return;}

  let updated=0;
  for(const s of songs){
    // Collect all thema tags
    let themen=(s.thema||'').split(',').map(t=>t.trim()).filter(Boolean);
    // Collect anlass tags and merge into thema
    const anlaesse=(s.anlass||'').split(',').map(a=>a.trim()).filter(Boolean);
    for(const a of anlaesse){
      const canon=ANLASS_TO_THEMA.find(x=>x.toLowerCase()===a.toLowerCase());
      if(canon&&!themen.some(t=>t.toLowerCase()===canon.toLowerCase()))themen.push(canon);
    }
    // Apply merge map to all thema tags
    themen=themen.map(t=>{
      const merged=THEMA_MERGE[t.toLowerCase()];
      return merged||t;
    });
    // Apply Title Case normalization
    themen=themen.map(t=>normalizeLabel(t));
    // Deduplicate (case-insensitive)
    const seen=new Map();
    themen.forEach(t=>{const k=t.toLowerCase();if(!seen.has(k))seen.set(k,t);});
    themen=[...seen.values()];

    const newThema=themen.sort((a,b)=>a.localeCompare(b,'de')).join(', ');
    const oldThema=s.thema||'';
    const oldAnlass=s.anlass||'';
    if(newThema!==oldThema||oldAnlass!==''){
      await SB.from('songs').update({thema:newThema,anlass:''}).eq('id',s.id);
      updated++;
    }
  }
  alert(`Bereinigung abgeschlossen. ${updated} Songs aktualisiert.`);
  await loadSongs();
}


// ========== MERGE DUPLICATES ==========
function mergePickVal(f,val){
  window._mergedState[f]=val;
  const inp=document.getElementById('merge-result-'+f);
  if(inp){
    inp.value=val;
    inp.style.borderColor='var(--success)';
    inp.style.background='rgba(76,175,130,.08)';
    setTimeout(()=>{inp.style.borderColor='';inp.style.background='';},900);
  }
}

function levenshtein(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function strSim(a,b){
  if(!a||!b)return 0;
  const al=a.toLowerCase().trim(),bl=b.toLowerCase().trim();
  if(al===bl)return 1;
  const maxLen=Math.max(al.length,bl.length);
  return maxLen===0?1:1-levenshtein(al,bl)/maxLen;
}

let mergeGroups=[];
let mergeIdx=0;

async function openMergeTool(){
  document.getElementById('merge-body').innerHTML='<p style="color:var(--text2);font-size:13px">Suche Duplikate…</p>';
  document.getElementById('merge-footer').innerHTML='';
  openModal('m-merge');
  // Load all songs (incl. DB)
  const{data:allSongs}=await SB.from('songs').select('id,liedanfang,title,komponist,textdichter,arrangeur,uebersetzer,besetzung,thema,rechte,lizenz,originaltitel,quelle,quelle_nr,bibelstelle,notizen,in_repertoire,schrank,created_at');
  if(!allSongs||!allSongs.length){document.getElementById('merge-body').innerHTML='<p style="color:var(--text2)">Keine Songs gefunden.</p>';return;}

  // Find duplicate groups by liedanfang similarity >= 0.85
  const used=new Set();
  mergeGroups=[];
  for(let i=0;i<allSongs.length;i++){
    if(used.has(allSongs[i].id))continue;
    const group=[allSongs[i]];
    const key=allSongs[i].liedanfang||allSongs[i].title||'';
    for(let j=i+1;j<allSongs.length;j++){
      if(used.has(allSongs[j].id))continue;
      const key2=allSongs[j].liedanfang||allSongs[j].title||'';
      if(strSim(key,key2)>=0.85){group.push(allSongs[j]);used.add(allSongs[j].id);}
    }
    if(group.length>1){used.add(allSongs[i].id);mergeGroups.push(group);}
  }

  // Sort each group so in_repertoire=true comes first
  mergeGroups=mergeGroups.map(g=>[...g].sort((a,b)=>(b.in_repertoire?1:0)-(a.in_repertoire?1:0)));
  if(!mergeGroups.length){
    document.getElementById('merge-body').innerHTML='<p style="color:var(--success);font-size:13px">✓ Keine Duplikate gefunden!</p>';
    return;
  }
  mergeIdx=0;
  showMergeGroup();
}

function showMergeGroup(){
  const body=document.getElementById('merge-body');
  const footer=document.getElementById('merge-footer');
  if(mergeIdx>=mergeGroups.length){
    if(window._pdfMergeMode){window._pdfMergeMode=false;window._pdfMergeQueue=null;document.querySelector('#m-merge .mh h3').textContent='🔍 Duplikate zusammenführen';}
    body.innerHTML='<p style="color:var(--success);font-size:14px">✓ Alle Einträge bearbeitet!</p>';
    footer.innerHTML=`<button class="btn btn-g" style="flex:1" onclick="closeModal('m-merge');loadSongs()">Schließen</button>`;
    return;
  }
  const group=mergeGroups[mergeIdx];
  const primary=group[0]; // always merge INTO first
  const dupes=group.slice(1);

  // Build merged preview: primary fields + fill from dupes where empty
  const merged={...primary};
  const fields=['komponist','textdichter','arrangeur','uebersetzer','besetzung','thema','rechte','lizenz','originaltitel','quelle','quelle_nr','bibelstelle','notizen','schrank'];
  for(const f of fields){if(!merged[f])for(const d of dupes){if(d[f]){merged[f]=d[f];break;}}}
  if(!merged.in_repertoire&&dupes.some(d=>d.in_repertoire))merged.in_repertoire=true;

  const fieldLabel={'liedanfang':'Liedanfang','title':'Titel','komponist':'Komponist','textdichter':'Textdichter','arrangeur':'Arrangeur','uebersetzer':'Übersetzer','thema':'Thema','besetzung':'Besetzung','rechte':'Rechte','lizenz':'Lizenz','originaltitel':'Originaltitel','quelle':'Quelle','quelle_nr':'Quellen-Nr.','bibelstelle':'Bibelstelle','notizen':'Notizen'};

  const diffFields=Object.keys(fieldLabel).filter(f=>{
    const vals=group.map(s=>(s[f]||'').toString().trim().toLowerCase());
    return vals.some(v=>v!==vals[0]&&v!=='');
  });

  // mutable result state
  const resultState={...merged};

  // --- Build DOM directly (no innerHTML for interactive parts) ---
  body.innerHTML='';

  // Progress
  const prog=document.createElement('div');
  prog.style.cssText='font-size:11px;color:var(--text3);margin-bottom:8px';
  prog.textContent='Duplikat '+(mergeIdx+1)+' von '+mergeGroups.length;
  body.appendChild(prog);

  const bar=document.createElement('div');
  bar.style.cssText='display:flex;gap:8px;margin-bottom:12px;align-items:center';
  bar.innerHTML='<div style="height:3px;background:var(--accent);border-radius:2px;flex:'+mergeIdx+'"></div><div style="height:3px;background:var(--border);border-radius:2px;flex:'+(mergeGroups.length-mergeIdx)+'"></div>';
  body.appendChild(bar);

  // Entry cards
  const entryLabel=document.createElement('div');
  entryLabel.style.cssText='font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px';
  entryLabel.textContent='Einträge';
  body.appendChild(entryLabel);

  group.forEach((s,i)=>{
    const card=document.createElement('div');
    card.style.cssText='background:'+(i===0?'rgba(201,168,76,.08)':'rgba(91,141,238,.06)')+';border:0.5px solid '+(i===0?'rgba(201,168,76,.25)':'rgba(91,141,238,.2)')+';border-radius:var(--r);padding:9px 11px;margin-bottom:6px';
    const badge=i===0?'<span style="font-size:9px;background:var(--accent);color:var(--bg);border-radius:8px;padding:1px 6px;font-weight:600">ZIEL</span>':'<span style="font-size:9px;background:rgba(91,141,238,.3);color:#8fb3f5;border-radius:8px;padding:1px 6px">DUPLIKAT</span>';
    const repBadge=s.in_repertoire?'<span class="badge green" style="font-size:9px">Repertoire</span>':'<span class="badge gray" style="font-size:9px">Datenbank</span>';
    card.innerHTML='<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+badge+repBadge+'</div>'
      +'<div style="font-size:13px;font-weight:500">'+esc(s.liedanfang||s.title||'–')+'</div>'
      +(s.title&&s.title!==s.liedanfang?'<div style="font-size:11px;color:var(--text3)">'+esc(s.title)+'</div>':'')
      +'<div style="font-size:11px;color:var(--text2);margin-top:3px">'+([s.komponist,s.arrangeur].filter(Boolean).join(' · ')||'–')+'</div>';
    body.appendChild(card);
  });

  // Diff section
  if(diffFields.length){
    const diffTitle=document.createElement('div');
    diffTitle.style.cssText='font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 8px';
    diffTitle.textContent='Unterschiede ('+diffFields.length+' Felder) — Wert anklicken zum Übernehmen';
    body.appendChild(diffTitle);

    const diffBox=document.createElement('div');
    diffBox.style.cssText='background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);padding:10px 12px';
    body.appendChild(diffBox);

    diffFields.forEach((f,fi)=>{
      const row=document.createElement('div');
      row.style.cssText='margin-bottom:10px;padding-bottom:10px'+(fi<diffFields.length-1?';border-bottom:0.5px solid var(--border)':'');

      const lbl=document.createElement('div');
      lbl.style.cssText='font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px';
      lbl.textContent=fieldLabel[f];
      row.appendChild(lbl);

      const grid=document.createElement('div');
      grid.style.cssText='display:grid;grid-template-columns:repeat('+group.length+',1fr);gap:5px;margin-bottom:6px';

      group.forEach((s,i)=>{
        const v=s[f]||'';
        const chip=document.createElement('div');
        chip.style.cssText='cursor:pointer;background:'+(i===0?'rgba(201,168,76,.08)':'rgba(91,141,238,.06)')+';border:0.5px solid '+(i===0?'rgba(201,168,76,.2)':'rgba(91,141,238,.15)')+';border-radius:6px;padding:5px 8px;font-size:11px;transition:border-color .15s,opacity .15s';
        chip.title='Klicken zum Übernehmen';
        const chipLabel=document.createElement('div');
        chipLabel.style.cssText='font-size:9px;color:'+(i===0?'var(--accent2)':'#8fb3f5')+';margin-bottom:2px';
        chipLabel.textContent=(i===0?'ZIEL':'DUPLIKAT')+' ↙';
        chip.appendChild(chipLabel);
        const chipVal=document.createElement('span');
        chipVal.textContent=v||'(leer)';
        chipVal.style.color=v?'var(--text)':'var(--text3)';
        chip.appendChild(chipVal);

        chip.addEventListener('click',()=>{
          resultState[f]=v;
          const inp=document.getElementById('mri-'+f);
          if(inp){
            inp.value=v;
            inp.style.borderColor='var(--success)';
            inp.style.background='rgba(76,175,130,.08)';
            setTimeout(()=>{inp.style.borderColor='';inp.style.background='';},900);
          }
          // highlight selected chip
          grid.querySelectorAll('div').forEach(c=>c.style.opacity='0.5');
          chip.style.opacity='1';
          chip.style.borderColor=i===0?'var(--accent)':'#5b8dee';
        });
        grid.appendChild(chip);
      });
      row.appendChild(grid);

      const resLabel=document.createElement('div');
      resLabel.style.cssText='font-size:10px;color:var(--text3);margin-bottom:3px';
      resLabel.textContent='→ Ergebnis';
      row.appendChild(resLabel);

      const inp=document.createElement('input');
      inp.className='fi';
      inp.id='mri-'+f;
      inp.value=resultState[f]||'';
      inp.placeholder='leer lassen = Feld leeren';
      inp.style.cssText='font-size:12px;padding:6px 9px';
      inp.addEventListener('input',()=>{resultState[f]=inp.value;});
      row.appendChild(inp);

      diffBox.appendChild(row);
    });
  } else {
    const noDiff=document.createElement('div');
    noDiff.style.cssText='font-size:12px;color:var(--text2);margin:10px 0;padding:8px 12px;background:var(--card);border-radius:var(--r)';
    noDiff.textContent='✓ Keine inhaltlichen Unterschiede.';
    body.appendChild(noDiff);
  }

  footer.innerHTML='';
  const skipBtn=document.createElement('button');skipBtn.className='btn btn-g';skipBtn.style.flex='1';skipBtn.textContent='Überspringen';
  skipBtn.onclick=()=>{mergeIdx++;showMergeGroup();};

  const mergeBtn=document.createElement('button');mergeBtn.className='btn btn-p';mergeBtn.style.flex='2';mergeBtn.textContent='✓ Zusammenführen ('+group.length+' → 1)';
  mergeBtn.onclick=()=>{
    diffFields.forEach(f=>{const el=document.getElementById('mri-'+f);if(el)resultState[f]=el.value.trim();});
    executeMerge(group,resultState);
  };

  footer.appendChild(skipBtn);footer.appendChild(mergeBtn);
}

async function executeMerge(group,merged){
  const primary=group[0];
  const mergeBtn=document.getElementById('merge-footer').querySelector('.btn-p');
  if(mergeBtn){mergeBtn.disabled=true;mergeBtn.textContent='Speichere…';}

  const updateFields={};
  const fields=['komponist','textdichter','arrangeur','uebersetzer','besetzung','thema','rechte','lizenz','originaltitel','quelle','quelle_nr','bibelstelle','notizen','schrank','in_repertoire'];
  for(const f of fields)updateFields[f]=merged[f]??primary[f]??null;
  await SB.from('songs').update(updateFields).eq('id',primary.id);

  if(window._pdfMergeMode){
    // PDF mode: no delete, just update. Also attach PDF pages if available.
    const pdfEntry=window._pdfMergeQueue?.[mergeIdx-1]||window._pdfMergeQueue?.[mergeIdx];
    const inc=pdfEntry?.incoming;
    if(inc?._seite_von&&inc?._seite_bis){
      // Will be picked up by PDF file attachment step (already ran), just log
    }
    T('✓ Daten ergänzt: '+(primary.liedanfang||primary.title),'ok');
  } else {
    // Normal duplicate merge: re-link and delete dupes
    const dupeIds=group.slice(1).map(s=>s.id).filter(id=>id&&id!=='__pdf_incoming__');
    for(const did of dupeIds){
      await SB.from('event_songs').update({song_id:primary.id}).eq('song_id',did);
      await SB.from('song_files').update({song_id:primary.id}).eq('song_id',did);
      await SB.from('songs').delete().eq('id',did);
    }
    T('✓ '+group.length+' Einträge zusammengeführt','ok');
  }

  mergeIdx++;
  showMergeGroup();
}


// ========== QUELLE BROWSER ==========
async function renderQuelleTab(container){
  await _quelleInit(container, false);
}
async function openQuelleBrowser(){
  const body=document.getElementById('quelle-browser-body');
  body.innerHTML='<p style="color:var(--text2);font-size:13px">Lade Daten…</p>';
  openModal('m-quelle-browser');
  await _quelleInit(body, true);
}
async function _quelleInit(body, inModal){
  body.innerHTML='<p style="color:var(--text2);font-size:13px">Lade Daten…</p>';

  const[{data:songs},{data:songFiles}]=await Promise.all([SB.from('songs').select('id,liedanfang,title,quelle,quelle_nr,in_repertoire,komponist'),SB.from('song_files').select('song_id').eq('file_type','chorsatz')]);
  const fileMap=new Set((songFiles||[]).map(f=>f.song_id));
  if(!songs){body.innerHTML='<p style="color:var(--err)">Fehler beim Laden.</p>';return;}

  // Group by normalized quelle
  const quellen=new Map();
  songs.forEach(s=>{
    if(!s.quelle)return;
    const q=s.quelle.trim();
    if(!quellen.has(q))quellen.set(q,[]);
    quellen.get(q).push(s);
  });

  if(!quellen.size){body.innerHTML='<p style="color:var(--text2)">Keine Quellenangaben gefunden.</p>';return;}

  body.innerHTML='';

  // Quelle selector
  const selWrap=document.createElement('div');
  selWrap.style.cssText='margin-bottom:14px';
  const selLabel=document.createElement('div');
  selLabel.style.cssText='font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px';
  selLabel.textContent='Quelle auswählen';
  selWrap.appendChild(selLabel);
  const sel=document.createElement('select');
  sel.className='fi';
  sel.style.cssText='width:100%';
  [...quellen.keys()].sort().forEach(q=>{
    const opt=document.createElement('option');
    opt.value=q;opt.textContent=q+' ('+quellen.get(q).length+' Lieder)';
    sel.appendChild(opt);
  });
  selWrap.appendChild(sel);
  body.appendChild(selWrap);

  // Max number input
  const maxWrap=document.createElement('div');
  maxWrap.style.cssText='display:flex;gap:8px;align-items:flex-end;margin-bottom:14px';
  const maxLabel=document.createElement('div');
  maxLabel.style.cssText='font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px';
  maxLabel.textContent='Letzter bekannter Eintrag (Nr.)';
  const maxInpWrap=document.createElement('div');maxInpWrap.style.flex='1';
  maxInpWrap.appendChild(maxLabel);
  const maxInp=document.createElement('input');
  maxInp.className='fi';maxInp.type='number';maxInp.placeholder='z.B. 300';maxInp.style.width='100%';
  maxInpWrap.appendChild(maxInp);
  maxWrap.appendChild(maxInpWrap);
  const showBtn=document.createElement('button');
  showBtn.className='btn btn-p';showBtn.textContent='Anzeigen';showBtn.style.cssText='flex:0 0 auto;padding:0 18px';
  maxWrap.appendChild(showBtn);
  body.appendChild(maxWrap);

  const resultArea=document.createElement('div');
  body.appendChild(resultArea);

  function renderQuelle(){
    const q=sel.value;
    const maxNr=parseInt(maxInp.value)||0;
    const list=quellen.get(q)||[];

    // Build nr→song map
    const nrMap=new Map();
    list.forEach(s=>{
      const nr=parseInt(s.quelle_nr);
      if(!isNaN(nr))nrMap.set(nr,s);
    });
    const withNr=[...nrMap.keys()].sort((a,b)=>a-b);
    const noNr=list.filter(s=>!s.quelle_nr||isNaN(parseInt(s.quelle_nr)));

    // Find missing numbers
    const maxFound=withNr.length?withNr[withNr.length-1]:0;
    const rangeEnd=Math.max(maxFound,maxNr);
    const missing=[];
    for(let i=1;i<=rangeEnd;i++){if(!nrMap.has(i))missing.push(i);}

    resultArea.innerHTML='';

    // Stats bar
    const stats=document.createElement('div');
    stats.style.cssText='display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap';
    [{label:'Vorhanden',val:withNr.length,color:'var(--success)'},{label:'Ohne Nr.',val:noNr.length,color:'var(--text2)'},{label:'Fehlend',val:missing.length,color:'#e87070'}].forEach(({label,val,color})=>{
      const chip=document.createElement('div');
      chip.style.cssText='background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);padding:6px 12px;font-size:12px';
      chip.innerHTML='<span style="color:'+color+';font-weight:600;font-size:16px">'+val+'</span><span style="color:var(--text3);margin-left:5px">'+label+'</span>';
      stats.appendChild(chip);
    });
    resultArea.appendChild(stats);

    // Missing numbers block
    if(missing.length){
      const missTitle=document.createElement('div');
      missTitle.style.cssText='font-size:11px;color:#e87070;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px';
      missTitle.textContent='Fehlende Nummern';
      resultArea.appendChild(missTitle);
      const missBox=document.createElement('div');
      missBox.style.cssText='background:rgba(232,112,112,.06);border:0.5px solid rgba(232,112,112,.2);border-radius:var(--r);padding:10px 12px;margin-bottom:14px;display:flex;flex-wrap:wrap;gap:5px';
      // Group consecutive into ranges
      const ranges=[];let start=missing[0],prev=missing[0];
      for(let i=1;i<=missing.length;i++){
        if(i<missing.length&&missing[i]===prev+1){prev=missing[i];}
        else{ranges.push(start===prev?String(start):start+'–'+prev);start=missing[i];prev=missing[i];}
      }
      ranges.forEach(r=>{
        const chip=document.createElement('span');
        chip.style.cssText='background:rgba(232,112,112,.12);border:0.5px solid rgba(232,112,112,.3);border-radius:4px;padding:2px 7px;font-size:11px;color:#e87070';
        chip.textContent=r;missBox.appendChild(chip);
      });
      resultArea.appendChild(missBox);
    }

    // Song list
    const listTitle=document.createElement('div');
    listTitle.style.cssText='font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px';
    listTitle.textContent='Lieder ('+list.length+')';
    resultArea.appendChild(listTitle);

    const table=document.createElement('div');
    table.style.cssText='background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);overflow:hidden';

    [...withNr,...noNr.map(s=>({_noNr:true,...s}))].forEach((item,idx)=>{
      const nr=item._noNr?null:withNr.indexOf(parseInt(item.quelle_nr||item))>=0?parseInt(item.quelle_nr||item):null;
      const s=item._noNr?item:nrMap.get(withNr[idx])||item;
      const row=document.createElement('div');
      row.style.cssText='display:flex;align-items:center;gap:10px;padding:7px 12px;border-bottom:0.5px solid var(--border);cursor:pointer';
      row.onmouseenter=()=>row.style.background='var(--hover)';
      row.onmouseleave=()=>row.style.background='';

      const nrCell=document.createElement('div');
      nrCell.style.cssText='min-width:36px;font-size:12px;font-weight:600;color:var(--accent2);text-align:right';
      nrCell.textContent=s.quelle_nr||'–';

      const nameCell=document.createElement('div');
      nameCell.style.cssText='flex:1;font-size:12px';
      nameCell.textContent=s.liedanfang||s.title||'–';

      const repBadge=document.createElement('span');
      repBadge.className='badge '+(s.in_repertoire?'green':'gray');
      repBadge.style.fontSize='9px';
      repBadge.textContent=s.in_repertoire?'Repertoire':'DB';
      const pdfBadge=document.createElement('span');
      pdfBadge.style.cssText='font-size:12px;opacity:'+(fileMap.has(s.id)?'1':'0.2');
      pdfBadge.title=fileMap.has(s.id)?'PDF vorhanden':'Keine PDF';
      pdfBadge.textContent='📄';

      row.appendChild(nrCell);row.appendChild(nameCell);row.appendChild(pdfBadge);row.appendChild(repBadge);
      row.onclick=()=>{
        if(inModal)closeModal('m-quelle-browser');
        else showPage('songs');
        // Wait for cachedSongs to be ready then open detail
        const tryOpen=()=>{
          const found=cachedSongs.find(x=>x.id===s.id);
          if(found){openSongDetail(s.id);}
          else{renderSongs().then(()=>openSongDetail(s.id));}
        };
        setTimeout(tryOpen,inModal?0:300);
      };
      table.appendChild(row);
    });
    resultArea.appendChild(table);

    // Ohne Nummer
    if(noNr.length){
      const noNrTitle=document.createElement('div');
      noNrTitle.style.cssText='font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin:12px 0 6px';
      noNrTitle.textContent='Ohne Nummer ('+noNr.length+')';
      resultArea.appendChild(noNrTitle);
    }
  }

  showBtn.onclick=renderQuelle;
  sel.onchange=renderQuelle;
  // Auto-render if Chorbuch is available
  const chorbuch=[...quellen.keys()].find(q=>q.toLowerCase().includes('chorbuch'));
  if(chorbuch){sel.value=chorbuch;renderQuelle();}
}


// ========== PDF MERGE QUEUE ==========
async function openPdfMergeQueue(queue){
  // Reuse m-merge modal but with PDF-specific flow
  mergeGroups=queue.map(({existing,incoming})=>{
    // Build two fake "song" objects for the merge UI
    const ex={...existing};
    const inc={...incoming,id:'__pdf_incoming__',in_repertoire:false,liedanfang:incoming.liedanfang||incoming.title||''};
    return[ex,inc]; // existing always first = ZIEL
  });
  mergeIdx=0;

  // Override executeMerge behaviour: just update existing, don't delete anything
  window._pdfMergeMode=true;
  window._pdfMergeQueue=queue;

  document.querySelector('#m-merge .mh h3').textContent='📄 PDF – bereits vorhandene Lieder';
  openModal('m-merge');
  showMergeGroup();
}


// ========== BACKUP ==========
const BACKUP_TABLES=['songs','song_files','events','event_songs','event_program','event_tasks','announcements','announcement_reads','attendance','profiles','cal_categories','calendar_events','media','media_albums','song_performance_stats'];

function openBackup(){
  const body=document.getElementById('backup-body');
  const ts=new Date().toISOString().slice(0,10);
  body.innerHTML=`
    <div style="font-size:13px;color:var(--text2);margin-bottom:16px">Erstellt ein vollständiges Backup aller Datenbank-Tabellen als JSON sowie eine Liste aller Dateien im Storage.</div>

    <div style="background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:12px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Datenbank (JSON)</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Alle ${BACKUP_TABLES.length} Tabellen werden exportiert und als <code>backup-${ts}.json</code> heruntergeladen.</div>
      <button class="btn btn-p" style="width:100%" onclick="runDbBackup('${ts}')">⬇ Datenbank-Backup herunterladen</button>
    </div>

    <div style="background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:12px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">HTML-Seite</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Aktuelle Version dieser App als <code>index-${ts}.html</code> herunterladen.</div>
      <button class="btn btn-g" style="width:100%" onclick="runPageBackup('${ts}')">⬇ Seite herunterladen</button>
    </div>

    <div style="background:var(--card);border:0.5px solid var(--border);border-radius:var(--r);padding:12px">
      <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Dateien (Storage)</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:10px">Alle Datei-URLs aus dem Storage als <code>files-${ts}.json</code> exportieren. Die Dateien selbst können dann manuell heruntergeladen werden.</div>
      <button class="btn btn-i" style="width:100%" onclick="runFilesBackup('${ts}')">⬇ Datei-Liste exportieren</button>
    </div>

    <div id="backup-log" style="margin-top:14px;font-size:12px;color:var(--text2)"></div>
  `;
  openModal('m-backup');
}

function backupLog(msg,type=''){
  const el=document.getElementById('backup-log');
  if(!el)return;
  const line=document.createElement('div');
  line.style.cssText='padding:3px 0;color:'+(type==='err'?'var(--err)':type==='ok'?'var(--success)':'var(--text2)');
  line.textContent=msg;
  el.appendChild(line);
}

async function runDbBackup(ts){
  backupLog('Starte Datenbank-Backup…');
  const backup={_created:new Date().toISOString(),_version:1,tables:{}};
  for(const table of BACKUP_TABLES){
    backupLog('Lade '+table+'…');
    let allRows=[];
    let from=0;
    const pageSize=1000;
    while(true){
      const{data,error}=await SB.from(table).select('*').range(from,from+pageSize-1);
      if(error){backupLog('Fehler bei '+table+': '+error.message,'err');break;}
      if(!data||!data.length)break;
      allRows=allRows.concat(data);
      if(data.length<pageSize)break;
      from+=pageSize;
    }
    backup.tables[table]=allRows;
    backupLog('  ✓ '+table+': '+allRows.length+' Einträge','ok');
  }
  const blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='backup-'+ts+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  backupLog('✓ Datenbank-Backup heruntergeladen.','ok');
}

function runPageBackup(ts){
  const html=document.documentElement.outerHTML;
  const blob=new Blob([html],{type:'text/html'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='index-'+ts+'.html';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  backupLog('✓ Seite heruntergeladen.','ok');
}

async function runFilesBackup(ts){
  backupLog('Lade Datei-Liste aus Storage…');
  const{data:files,error}=await SB.from('song_files').select('id,song_id,file_type,url,path,created_at');
  if(error){backupLog('Fehler: '+error.message,'err');return;}
  const{data:media}=await SB.from('media').select('id,url,path,title,created_at');
  const export_={_created:new Date().toISOString(),song_files:files||[],media:media||[]};
  const blob=new Blob([JSON.stringify(export_,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='files-'+ts+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
  backupLog('✓ '+(files?.length||0)+' Dateien + '+(media?.length||0)+' Medien exportiert.','ok');
}


// ========== PDF REASSIGN ==========
let _reassignData=[];

async function openPdfReassign(){
  const body=document.getElementById('pdf-reassign-body');
  const footer=document.getElementById('pdf-reassign-footer');
  body.innerHTML='<p style="color:var(--text2);font-size:13px">Lade Daten…</p>';
  footer.innerHTML='';
  openModal('m-pdf-reassign');

  // Load ALL songs and ALL chorsatz files
  const{data:files}=await SB.from('song_files').select('id,song_id,url,path,file_type').eq('file_type','chorsatz');
  const{data:songs}=await SB.from('songs').select('id,liedanfang,title,quelle_nr,quelle').order('quelle_nr',{ascending:true,nullsFirst:false});
  if(!files||!songs){body.innerHTML='<p style="color:var(--err)">Fehler beim Laden.</p>';return;}

  const songMap=new Map(songs.map(s=>[s.id,s]));
  const fileMap=new Map(files.map(f=>[f.song_id,f]));

  // Get unique sources
  const quellen=[...new Set(songs.map(s=>s.quelle).filter(Boolean))].sort();

  // Restore saved state
  const STORAGE_KEY='pdf_reassign_state_v1';
  let savedState=null;
  try{const raw=localStorage.getItem(STORAGE_KEY);if(raw)savedState=JSON.parse(raw);}catch(e){}

  // Show source picker
  body.innerHTML='';
  const wrap=document.createElement('div');
  wrap.style.cssText='padding:20px;max-width:480px;margin:0 auto';

  const title=document.createElement('div');
  title.style.cssText='font-size:13px;color:var(--text2);margin-bottom:16px';
  title.textContent='Welche Quelle möchtest du prüfen?';
  wrap.appendChild(title);

  // Saved state banner
  if(savedState&&savedState.length){
    const reviewed=savedState.filter(x=>x.status!=='pending').length;
    if(reviewed>0){
      const banner=document.createElement('div');
      banner.style.cssText='padding:10px 12px;background:rgba(91,141,238,.1);border:0.5px solid rgba(91,141,238,.3);border-radius:var(--r);font-size:12px;color:var(--text2);margin-bottom:14px;display:flex;align-items:center;gap:8px';
      banner.innerHTML='💾 Gespeicherter Stand: '+reviewed+' Lieder markiert.';
      const rst=document.createElement('button');rst.className='btn btn-sm btn-g';rst.textContent='↺ Löschen';
      rst.onclick=()=>{try{localStorage.removeItem(STORAGE_KEY);}catch(e){}savedState=null;banner.remove();};
      banner.appendChild(rst);
      wrap.appendChild(banner);
    }
  }

  const sel=document.createElement('select');
  sel.className='fi';sel.style.cssText='width:100%;margin-bottom:12px';
  quellen.forEach(q=>{
    const opt=document.createElement('option');opt.value=q;
    // Count songs with/without PDF for this source
    const total=songs.filter(s=>s.quelle===q).length;
    const withPdf=songs.filter(s=>s.quelle===q&&fileMap.has(s.id)).length;
    opt.textContent=q+' ('+withPdf+'/'+total+' mit PDF)';
    sel.appendChild(opt);
  });
  // Auto-select Chorbuch if present
  const chorbuch=quellen.find(q=>q.toLowerCase().includes('chorbuch'));
  if(chorbuch)sel.value=chorbuch;
  wrap.appendChild(sel);

  const startBtn=document.createElement('button');
  startBtn.className='btn btn-p';startBtn.style.width='100%';
  startBtn.textContent='Prüfen starten';
  startBtn.onclick=()=>{
    const q=sel.value;
    // Include ALL songs from this source (with and without PDF)
    const filtered=songs.filter(s=>s.quelle===q).sort((a,b)=>(parseInt(a.quelle_nr)||99999)-(parseInt(b.quelle_nr)||99999));
    _reassignData=filtered.map(s=>{
      const saved=savedState?.find(x=>x.songId===s.id);
      return{
        song:s,
        file:fileMap.get(s.id)||null,
        assignedTo:saved?.assignedTo||s.id,
        status:saved?.status||'pending',
      };
    });
    renderReassign(songMap,fileMap);
  };
  wrap.appendChild(startBtn);
  body.appendChild(wrap);
}

const _REASSIGN_KEY='pdf_reassign_state_v1';
function saveReassignState(){
  try{
    localStorage.setItem(_REASSIGN_KEY,JSON.stringify(
      _reassignData.map(r=>({songId:r.song.id,assignedTo:r.assignedTo,status:r.status}))
    ));
  }catch(e){}
}

function renderReassign(songMap,fileMap){
  const body=document.getElementById('pdf-reassign-body');
  const footer=document.getElementById('pdf-reassign-footer');
  const md=document.querySelector('#m-pdf-reassign .md');
  if(md)md.style.cssText='max-width:1100px;max-height:96vh;width:95vw';
  body.style.cssText='padding:0;display:flex;flex-direction:column;height:calc(96vh - 110px)';
  body.innerHTML='';footer.innerHTML='';

  const style=document.getElementById('rr-style')||document.createElement('style');
  style.id='rr-style';
  style.textContent=`
    .rr-row{display:grid;grid-template-columns:28px 1fr auto auto;gap:0;padding:5px 10px;border-bottom:0.5px solid var(--border);align-items:center;cursor:pointer;transition:background .1s}
    .rr-row:hover{background:var(--hover)}
    .rr-row.rr-sel{background:rgba(201,168,76,.1);border-left:2px solid var(--accent)}
    .rr-row.rr-ok{opacity:.45}
    .rr-row.rr-bad{background:rgba(232,112,112,.07)}
    .rr-thumb{border-radius:3px;box-shadow:0 1px 6px rgba(0,0,0,.4);background:#fff;display:block}
  `;
  document.head.appendChild(style);

  // Phase tracking per row
  if(!_reassignData[0].hasOwnProperty('status')){
    _reassignData.forEach(r=>r.status='pending'); // pending | ok | bad
  }

  let selectedIdx=0;
  let phase=_reassignData.some(r=>r.status==='bad')?'gallery':'review';

  function buildUI(){
    body.innerHTML='';footer.innerHTML='';
    if(phase==='review') buildReviewUI();
    else buildGalleryUI();
  }

  // ===== PHASE 1: REVIEW =====
  function buildReviewUI(){
    // Toolbar
    const tb=document.createElement('div');
    tb.style.cssText='display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:0.5px solid var(--border);flex-shrink:0;flex-wrap:wrap';
    tb.innerHTML='<span style="font-size:11px;color:var(--text2);flex:1">Klicke auf ein Lied → PDF prüfen → ✓ Passt / ✗ Falsch markieren</span>';

    const shiftLabel=document.createElement('span');shiftLabel.style.cssText='font-size:11px;color:var(--text3)';shiftLabel.textContent='Alle verschieben:';
    tb.appendChild(shiftLabel);
    [-2,-1,1,2].forEach(n=>{
      const btn=document.createElement('button');btn.className='btn btn-g btn-sm';btn.textContent=(n>0?'+':'')+n;
      btn.onclick=()=>{shiftAllPdfs(n);_reassignData.forEach(r=>r.status='pending');buildUI();};tb.appendChild(btn);
    });
    const rst=document.createElement('button');rst.className='btn btn-sm';rst.textContent='↺ Reset';
    rst.style.cssText='background:rgba(232,112,112,.1);color:#e87070;border:0.5px solid rgba(232,112,112,.3)';
    rst.onclick=()=>{_reassignData.forEach(r=>{r.assignedTo=r.song.id;r.status='pending';});buildUI();};
    tb.appendChild(rst);
    body.appendChild(tb);

    // Split
    const split=document.createElement('div');
    split.style.cssText='display:flex;flex:1;overflow:hidden;min-height:0';
    body.appendChild(split);

    // Left list
    const listPane=document.createElement('div');
    listPane.id='rr-list';
    listPane.style.cssText='width:280px;flex-shrink:0;overflow-y:auto;border-right:0.5px solid var(--border)';
    split.appendChild(listPane);

    // Right preview
    const prevPane=document.createElement('div');
    prevPane.id='rr-prev';
    prevPane.style.cssText='flex:1;overflow:hidden;display:flex;flex-direction:column;align-items:center;padding:12px;gap:10px';
    split.appendChild(prevPane);

    function renderList(){
      listPane.innerHTML='';
      _reassignData.forEach((row,idx)=>{
        const changed=row.assignedTo!==row.song.id;
        const tr=document.createElement('div');
        tr.className='rr-row'+(idx===selectedIdx?' rr-sel':'')+(row.status==='ok'?' rr-ok':row.status==='bad'?' rr-bad':'');
        const assignedRow=_reassignData.find(r=>r.song.id===row.assignedTo);
        const pdfSong=assignedRow?.song;

        const nr=document.createElement('div');nr.style.cssText='font-size:11px;color:var(--accent2);font-weight:600';nr.textContent=row.song.quelle_nr||'–';
        const name=document.createElement('div');name.style.cssText='font-size:12px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis';name.textContent=row.song.liedanfang||row.song.title||'–';
        const pdfNr=document.createElement('div');pdfNr.style.cssText='font-size:10px;color:'+(changed?'#8fb3f5':'var(--text3)')+';min-width:20px;text-align:right';pdfNr.textContent=pdfSong?.quelle_nr||'–';
        const badge=document.createElement('div');badge.style.cssText='font-size:11px;min-width:16px;text-align:right';
        badge.textContent=row.status==='ok'?'✓':row.status==='bad'?'✗':'';
        badge.style.color=row.status==='ok'?'var(--success)':row.status==='bad'?'#e87070':'';

        tr.appendChild(nr);tr.appendChild(name);tr.appendChild(pdfNr);tr.appendChild(badge);
        tr.onclick=()=>{selectedIdx=idx;renderList();loadPreview(idx);};
        listPane.appendChild(tr);
      });
      // Scroll selected into view
      const sel=listPane.querySelector('.rr-sel');
      if(sel)sel.scrollIntoView({block:'nearest'});
    }

    async function loadPreview(idx){
      const pane=document.getElementById('rr-prev');if(!pane)return;
      const row=_reassignData[idx];
      const assignedRow=_reassignData.find(r=>r.song.id===row.assignedTo);
      const pdfSong=assignedRow?.song;
      pane.innerHTML='';

      // Header with song info + mark buttons
      const ph=document.createElement('div');
      ph.style.cssText='width:100%;display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap';

      const lbl=document.createElement('div');
      lbl.style.cssText='flex:1;font-size:12px';
      lbl.innerHTML='<b>'+esc(row.song.liedanfang||row.song.title||'–')+'</b>'
        +'<span style="color:var(--text3)"> → PDF: </span>'
        +(pdfSong?((pdfSong.quelle_nr?'<b style="color:var(--accent2)">Nr.'+pdfSong.quelle_nr+' </b>':'')+esc(pdfSong.liedanfang||pdfSong.title||'?')):'<i style="color:#e87070">keine</i>');
      ph.appendChild(lbl);

      const okBtn=document.createElement('button');okBtn.className='btn btn-sm';
      okBtn.style.cssText='background:rgba(76,175,130,.15);color:var(--success);border:0.5px solid rgba(76,175,130,.3);font-size:13px;padding:4px 14px';
      okBtn.textContent='✓ Passt';
      okBtn.onclick=()=>{row.status='ok';advanceToNext(idx);};

      const badBtn=document.createElement('button');badBtn.className='btn btn-sm';
      badBtn.style.cssText='background:rgba(232,112,112,.15);color:#e87070;border:0.5px solid rgba(232,112,112,.3);font-size:13px;padding:4px 14px';
      badBtn.textContent='✗ Falsch';
      badBtn.onclick=()=>{row.status='bad';advanceToNext(idx);};

      ph.appendChild(okBtn);ph.appendChild(badBtn);
      pane.appendChild(ph);

      // Nav arrows
      const nav=document.createElement('div');
      nav.style.cssText='width:100%;display:flex;justify-content:space-between';
      const prevBtn=document.createElement('button');prevBtn.className='btn btn-g btn-sm';prevBtn.textContent='↑ voriges';prevBtn.disabled=idx===0;
      prevBtn.onclick=()=>{selectedIdx=idx-1;renderList();loadPreview(idx-1);};
      const nextBtn=document.createElement('button');nextBtn.className='btn btn-g btn-sm';nextBtn.textContent='nächstes ↓';nextBtn.disabled=idx===_reassignData.length-1;
      nextBtn.onclick=()=>{selectedIdx=idx+1;renderList();loadPreview(idx+1);};
      nav.appendChild(prevBtn);nav.appendChild(nextBtn);
      pane.appendChild(nav);

      if(!assignedRow?.file?.url){
        pane.innerHTML+='<div style="color:var(--text3);font-size:12px">Keine PDF</div>';return;
      }

      const loadMsg=document.createElement('div');loadMsg.style.cssText='color:var(--text2);font-size:12px';loadMsg.textContent='Lade…';
      pane.appendChild(loadMsg);

      try{
        if(!window.pdfjsLib){
          await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';res();};s.onerror=rej;document.head.appendChild(s);});
        }
        const resp=await fetch(assignedRow.file.url);
        const buf=await resp.arrayBuffer();
        const pdf=await pdfjsLib.getDocument({data:buf}).promise;
        const page=await pdf.getPage(1);
        // Render top 10% at ~400px wide
        const naturalVp=page.getViewport({scale:1});
        const scale=400/naturalVp.width;
        const fullVp=page.getViewport({scale});
        const cropH=Math.round(fullVp.height*0.12); // top 12%
        const canvas=document.createElement('canvas');
        canvas.width=fullVp.width;canvas.height=cropH;
        canvas.className='rr-thumb';canvas.style.width='100%';
        pane.replaceChild(canvas,loadMsg);
        await page.render({canvasContext:canvas.getContext('2d'),viewport:fullVp}).promise;
      }catch(err){loadMsg.textContent='Fehler: '+err.message;}
    }

    function advanceToNext(fromIdx){
      saveReassignState();
      renderList();
      // Move to next pending
      const next=_reassignData.findIndex((r,i)=>i>fromIdx&&r.status==='pending');
      const nextIdx=next>=0?next:_reassignData.findIndex((r,i)=>i<fromIdx&&r.status==='pending');
      if(nextIdx>=0){selectedIdx=nextIdx;renderList();loadPreview(nextIdx);}
      else{
        // All reviewed - update footer
        const badCount=_reassignData.filter(r=>r.status==='bad').length;
        const okCount=_reassignData.filter(r=>r.status==='ok').length;
        buildFooter(badCount,okCount);
        loadPreview(fromIdx);
      }
    }

    renderList();
    loadPreview(selectedIdx);

    function buildFooter(badCount,okCount,pending){
      footer.innerHTML='';
      const info=document.createElement('div');info.style.cssText='font-size:11px;color:var(--text2);flex:1;align-self:center';
      const parts=[];
      if(okCount)parts.push(okCount+' ✓');
      if(badCount)parts.push(badCount+' ✗');
      if(pending)parts.push(pending+' offen');
      info.textContent=parts.join(' · ');
      footer.appendChild(info);
      if(badCount>0){
        const gallBtn=document.createElement('button');gallBtn.className='btn btn-p';gallBtn.style.flex='2';
        gallBtn.textContent='🖼 Richtige PDFs auswählen ('+badCount+')';
        gallBtn.onclick=()=>{phase='gallery';buildUI();};
        footer.appendChild(gallBtn);
      }
      const saveBtn=document.createElement('button');saveBtn.className='btn btn-g';saveBtn.style.flex='1';
      saveBtn.textContent='💾 Speichern';saveBtn.onclick=()=>savePdfReassign();
      footer.appendChild(saveBtn);
    }

    const initBad=_reassignData.filter(r=>r.status==='bad').length;
    const initOk=_reassignData.filter(r=>r.status==='ok').length;
    function refreshFooter(){
      const badCount=_reassignData.filter(r=>r.status==='bad').length;
      const okCount=_reassignData.filter(r=>r.status==='ok').length;
      const pending=_reassignData.filter(r=>r.status==='pending').length;
      buildFooter(badCount,okCount,pending);
    }
    // Patch advanceToNext to also refresh footer
    const _origAdvance=advanceToNext;
    advanceToNext=(idx)=>{_origAdvance(idx);refreshFooter();};
    refreshFooter();
  }

  // ===== PHASE 2: GALLERY =====
  async function buildGalleryUI(){
    const badRows=_reassignData.filter(r=>r.status==='bad');
    const allRows=_reassignData;
    let gallerySelectedBad=0;

    body.innerHTML='';footer.innerHTML='';

    const tb=document.createElement('div');
    tb.style.cssText='display:flex;gap:8px;align-items:center;padding:8px 12px;border-bottom:0.5px solid var(--border);flex-shrink:0';
    tb.innerHTML='<span style="font-size:11px;color:var(--text2);flex:1">Links: falsche Lieder. Rechts: alle PDFs zur Auswahl. Klick auf die richtige PDF.</span>';
    const backBtn=document.createElement('button');backBtn.className='btn btn-g btn-sm';backBtn.textContent='← Zurück zur Prüfung';
    backBtn.onclick=()=>{phase='review';buildUI();};
    tb.appendChild(backBtn);body.appendChild(tb);

    const split=document.createElement('div');
    split.style.cssText='display:flex;flex:1;overflow:hidden;min-height:0';
    body.appendChild(split);

    // Left: bad songs list
    const leftPane=document.createElement('div');
    leftPane.style.cssText='width:220px;flex-shrink:0;border-right:0.5px solid var(--border);overflow-y:auto';
    split.appendChild(leftPane);

    // Right: PDF gallery
    const rightPane=document.createElement('div');
    rightPane.id='gallery-pane';
    rightPane.style.cssText='flex:1;overflow-y:auto;padding:10px;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start';
    split.appendChild(rightPane);

    let gallerySelIdx=0;

    function renderBadList(){
      leftPane.innerHTML='';
      const title=document.createElement('div');title.style.cssText='font-size:10px;color:var(--text3);text-transform:uppercase;padding:8px 10px 4px;letter-spacing:.06em';
      title.textContent='Falsche PDFs ('+badRows.length+')';leftPane.appendChild(title);
      badRows.forEach((row,i)=>{
        const tr=document.createElement('div');
        tr.style.cssText='padding:6px 10px;border-bottom:0.5px solid var(--border);cursor:pointer;font-size:12px;transition:background .1s;background:'+(i===gallerySelIdx?'rgba(201,168,76,.1)':'');
        tr.onmouseenter=()=>{if(i!==gallerySelIdx)tr.style.background='var(--hover)';};
        tr.onmouseleave=()=>{tr.style.background=i===gallerySelIdx?'rgba(201,168,76,.1)':'';};
        tr.innerHTML=(row.song.quelle_nr?'<b style="color:var(--accent2)">'+row.song.quelle_nr+'</b> ':'')
          +'<span>'+esc(row.song.liedanfang||row.song.title||'–')+'</span>'
          +(row.assignedTo!==row.song.id?'<div style="font-size:10px;color:#8fb3f5">→ umgeleitet</div>':'');
        tr.onclick=()=>{gallerySelIdx=i;renderBadList();};
        leftPane.appendChild(tr);
      });
    }

    // Load all PDF thumbnails
    async function loadGallery(){
      const pane=document.getElementById('gallery-pane');if(!pane)return;
      pane.innerHTML='<div style="font-size:12px;color:var(--text2);padding:8px">Lade PDFs…</div>';

      if(!window.pdfjsLib){
        await new Promise((res,rej)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';res();};s.onerror=rej;document.head.appendChild(s);});
      }
      pane.innerHTML='';

      for(const row of allRows){
        const assignedRow=_reassignData.find(r=>r.song.id===row.assignedTo);
        const fileUrl=assignedRow?.file?.url;
        if(!fileUrl)continue;

        const card=document.createElement('div');
        card.style.cssText='border:1.5px solid var(--border);border-radius:6px;overflow:hidden;cursor:pointer;transition:border-color .15s,transform .15s;width:240px;flex-shrink:0';
        card.title='Nr. '+(row.song.quelle_nr||'?')+' · '+esc(row.song.liedanfang||'');

        const label=document.createElement('div');
        label.style.cssText='font-size:10px;color:var(--accent2);padding:3px 6px;background:var(--card);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
        label.textContent=(row.song.quelle_nr?'Nr.'+row.song.quelle_nr+' ':'')+esc(row.song.liedanfang||row.song.title||'–').substring(0,20);

        const canvasWrap=document.createElement('div');
        canvasWrap.style.cssText='background:#fff;height:160px;overflow:hidden;display:flex;align-items:flex-start';
        const loadingEl=document.createElement('div');
        loadingEl.style.cssText='font-size:10px;color:#999;padding:6px;width:100%';loadingEl.textContent='…';
        canvasWrap.appendChild(loadingEl);

        card.appendChild(label);card.appendChild(canvasWrap);
        card.onclick=()=>{
          // Assign this PDF to currently selected bad song
          const targetRow=badRows[gallerySelIdx];
          if(!targetRow)return;
          targetRow.assignedTo=row.song.id;
          targetRow.status='ok';
          saveReassignState();
          // Highlight selected card
          pane.querySelectorAll('[data-song-id]').forEach(c=>{c.style.borderColor='var(--border)';c.style.transform='';});
          card.style.borderColor='var(--success)';card.style.transform='scale(1.04)';
          renderBadList();
          // Auto-advance to next bad
          const nextBadIdx=badRows.findIndex((r,i)=>i>gallerySelIdx&&r.status==='bad');
          if(nextBadIdx>=0){gallerySelIdx=nextBadIdx;renderBadList();}
          buildGalleryFooter();
        };
        card.dataset.songId=row.song.id;
        pane.appendChild(card);

        // Async render thumbnail
        (async()=>{
          try{
            const resp=await fetch(fileUrl);const buf=await resp.arrayBuffer();
            const pdf=await pdfjsLib.getDocument({data:buf}).promise;
            const page=await pdf.getPage(1);
            const naturalVp=page.getViewport({scale:1});
            const scale=240/naturalVp.width;
            const fullVp=page.getViewport({scale});
            const cropH=Math.round(fullVp.height*0.18);
            const canvas=document.createElement('canvas');canvas.width=fullVp.width;canvas.height=cropH;
            canvas.style.cssText='width:100%;display:block';
            canvasWrap.replaceChild(canvas,loadingEl);
            await page.render({canvasContext:canvas.getContext('2d'),viewport:fullVp}).promise;
          }catch(e){loadingEl.textContent='!';}
        })();
      }
    }

    function buildGalleryFooter(){
      footer.innerHTML='';
      const stillBad=badRows.filter(r=>r.status==='bad').length;
      const info=document.createElement('div');info.style.cssText='font-size:11px;color:var(--text2);flex:1;align-self:center';
      info.textContent=stillBad>0?(stillBad+' noch offen'):'Alle korrigiert ✓';info.style.color=stillBad?'var(--text2)':'var(--success)';
      footer.appendChild(info);
      const saveBtn=document.createElement('button');saveBtn.className='btn btn-p';saveBtn.style.flex='2';
      saveBtn.textContent='💾 Speichern';saveBtn.onclick=()=>savePdfReassign();footer.appendChild(saveBtn);
    }

    renderBadList();
    await loadGallery();
    buildGalleryFooter();
  }

  buildUI();
}

function shiftAllPdfs(n){
  // Shift which file is assigned to each song by n positions
  const ids=_reassignData.map(r=>r.song.id);
  const assignments=_reassignData.map(r=>r.assignedTo);
  const len=ids.length;
  _reassignData.forEach((r,i)=>{
    const newIdx=((i-n)%len+len)%len;
    r.assignedTo=assignments[newIdx];
  });
}

function swapPdfs(a,b){
  if(b<0||b>=_reassignData.length)return;
  const tmp=_reassignData[a].assignedTo;
  _reassignData[a].assignedTo=_reassignData[b].assignedTo;
  _reassignData[b].assignedTo=tmp;
}

async function savePdfReassign(){
  const footer=document.getElementById('pdf-reassign-footer');
  const saveBtn=footer.querySelector('.btn-p');
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Speichere…';}

  const toUpdate=_reassignData.filter(r=>r.assignedTo!==r.song.id);
  let ok=0,errs=0;

  for(const row of toUpdate){
    // The file that should belong to this song is currently assigned to row.assignedTo
    const sourceRow=_reassignData.find(r=>r.song.id===row.assignedTo);
    if(!sourceRow?.file)continue;
    const f=sourceRow.file;
    // Update song_files: change song_id to row.song.id, update path
    const newPath=row.song.id+'/chorsatz.pdf';
    // Copy in storage
    const{data:dl}=await SB.storage.from('choir-media').download(f.path);
    if(!dl){errs++;continue;}
    await SB.storage.from('choir-media').upload(newPath,dl,{upsert:true});
    const{data:{publicUrl}}=SB.storage.from('choir-media').getPublicUrl(newPath);
    await SB.from('song_files').update({song_id:row.song.id,path:newPath,url:publicUrl}).eq('id',f.id);
    ok++;
  }

  T('✓ '+ok+' PDF-Zuordnungen korrigiert'+(errs?' ('+errs+' Fehler)':''),'ok');
  try{localStorage.removeItem(_REASSIGN_KEY);}catch(e){}
  await loadSongs();
  closeModal('m-pdf-reassign');
}


// ========== ACTIVITY LOG ==========
async function logActivity(action, entity, entityId, entityTitle, changes=null){
  try{
    await SB.from('activity_log').insert({
      user_id: currentUser?.id||null,
      user_name: currentProfile?.name||currentUser?.email||'Unbekannt',
      action,        // 'create' | 'update' | 'delete'
      entity,        // 'song' | 'event' | 'calendar_event' etc.
      entity_id: String(entityId||''),
      entity_title: entityTitle||'',
      changes: changes?JSON.stringify(changes):null,
    });
  }catch(e){console.warn('Log failed:',e);}
}

function diffObjects(before, after, fields){
  const changes={};
  for(const f of fields){
    const v1=String(before[f]??'');
    const v2=String(after[f]??'');
    if(v1!==v2)changes[f]={von:before[f]??null,nach:after[f]??null};
  }
  return Object.keys(changes).length?changes:null;
}


// ========== ACTIVITY LOG VIEW ==========
async function openActivityLog(){
  const body=document.getElementById('activity-log-body');
  body.innerHTML='<p style="color:var(--text2);font-size:13px">Lade…</p>';
  openModal('m-activity-log');

  const{data:logs}=await SB.from('activity_log').select('*').order('created_at',{ascending:false}).limit(200);
  if(!logs||!logs.length){body.innerHTML='<p style="color:var(--text2)">Noch keine Einträge.</p>';return;}

  const actionLabel={create:'➕ Erstellt',update:'✏️ Geändert',delete:'🗑 Gelöscht'};
  const entityLabel={song:'Lied',event:'Veranstaltung',calendar_event:'Termin',member:'Mitglied'};
  const actionColor={create:'var(--success)',update:'#8fb3f5',delete:'#e87070'};

  // Filter controls
  const filterBar=document.createElement('div');
  filterBar.style.cssText='display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center';

  const filterEntity=document.createElement('select');
  filterEntity.className='fi';filterEntity.style.cssText='flex:1;min-width:120px';
  [['','Alle Typen'],['song','Lieder'],['event','Veranstaltungen']].forEach(([v,l])=>{
    const o=document.createElement('option');o.value=v;o.textContent=l;filterEntity.appendChild(o);
  });

  const filterAction=document.createElement('select');
  filterAction.className='fi';filterAction.style.cssText='flex:1;min-width:120px';
  [['','Alle Aktionen'],['create','Erstellt'],['update','Geändert'],['delete','Gelöscht']].forEach(([v,l])=>{
    const o=document.createElement('option');o.value=v;o.textContent=l;filterAction.appendChild(o);
  });

  filterBar.appendChild(filterEntity);filterBar.appendChild(filterAction);
  body.innerHTML='';body.appendChild(filterBar);

  const listEl=document.createElement('div');
  body.appendChild(listEl);

  function renderLog(){
    const fe=filterEntity.value;
    const fa=filterAction.value;
    const filtered=logs.filter(l=>(!fe||l.entity===fe)&&(!fa||l.action===fa));

    listEl.innerHTML='';
    if(!filtered.length){listEl.innerHTML='<p style="color:var(--text2);font-size:12px">Keine Einträge.</p>';return;}

    filtered.forEach(log=>{
      const row=document.createElement('div');
      row.style.cssText='padding:9px 12px;border-bottom:0.5px solid var(--border);display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:start';

      // Action badge
      const badge=document.createElement('div');
      badge.style.cssText='font-size:10px;color:'+actionColor[log.action]+';white-space:nowrap;padding-top:1px';
      badge.textContent=actionLabel[log.action]||log.action;

      // Main info
      const info=document.createElement('div');
      const title=document.createElement('div');
      title.style.cssText='font-size:12px;font-weight:500';
      title.textContent=(entityLabel[log.entity]||log.entity)+': '+(log.entity_title||log.entity_id||'–');
      info.appendChild(title);

      // Changes
      if(log.changes){
        try{
          const ch=typeof log.changes==='string'?JSON.parse(log.changes):log.changes;
          const fields=Object.keys(ch);
          if(fields.length){
            const chEl=document.createElement('div');
            chEl.style.cssText='font-size:10px;color:var(--text3);margin-top:3px';
            chEl.textContent=fields.map(f=>{
              const v=ch[f];
              const von=v.von!=null&&v.von!==''?String(v.von):'leer';
              const nach=v.nach!=null&&v.nach!==''?String(v.nach):'leer';
              return f+': '+von+' → '+nach;
            }).join(' · ');
            info.appendChild(chEl);
          }
        }catch(e){}
      }

      // Meta: user + time
      const meta=document.createElement('div');
      meta.style.cssText='font-size:10px;color:var(--text3);text-align:right;white-space:nowrap';
      const d=new Date(log.created_at);
      meta.innerHTML=esc(log.user_name||'?')+'<br>'+d.toLocaleDateString('de-DE')+' '+d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});

      row.appendChild(badge);row.appendChild(info);row.appendChild(meta);
      listEl.appendChild(row);
    });
  }

  filterEntity.onchange=renderLog;filterAction.onchange=renderLog;
  renderLog();
}

// ========== INIT ==========
(async function init(){
  SB=window.supabase.createClient(SB_URL,SB_KEY);
  const{data:{session}}=await SB.auth.getSession();
  if(session?.user){await loadProfile(session.user);if(currentProfile?.active===false){document.getElementById('login-screen').style.display='flex';return;}startApp();}
  else document.getElementById('login-screen').style.display='flex';
})();
