// ========== SONG ASSISTANT ==========
// ========== SONG ASSISTANT ==========
let _sastSuggestIdx=-1,_sastMode=null,_sastPendingSong=null;

function openSongAssistant(){
  _sastMode=null;_sastPendingSong=null;
  document.getElementById('sast-msgs').innerHTML='';
  document.getElementById('sast-actions').style.display='none';
  const template='Liedanfang: \nTitel: \nKomponist: \nTextdichter: \nArrangeur: \nÜbersetzer/Deutscher Text: \nOriginaltitel: \nBesetzung: \nRechte: ';
  const inp=document.getElementById('sast-input');
  inp.value=template;inp.style.minHeight='220px';
  _sastMode='new_song';
  sastBot('Fülle die Felder aus und schicke es ab.\nLeere Felder einfach leer lassen.\nOder 📄 PDF hochladen – ich lese die Infos automatisch aus.');
  openModal('m-song-assistant');
  setTimeout(()=>inp.focus(),300);
}
function sastBot(txt){const el=document.getElementById('sast-msgs');const d=document.createElement('div');d.className='ast-msg bot';d.innerHTML='<div class="ast-bbl">'+txt.replace(/\n/g,'<br>')+'</div>';el.appendChild(d);el.scrollTop=el.scrollHeight;}
function sastUser(txt){const el=document.getElementById('sast-msgs');const d=document.createElement('div');d.className='ast-msg user';d.innerHTML='<div class="ast-bbl">'+esc(txt)+'</div>';el.appendChild(d);el.scrollTop=el.scrollHeight;}
function sastShowActions(btns){const el=document.getElementById('sast-actions');el.style.display='';el.innerHTML=btns.map(b=>'<button class="btn btn-g btn-sm" style="margin:3px" onclick="'+b.fn+'">'+esc(b.label)+'</button>').join('');}
function sastClearActions(){const el=document.getElementById('sast-actions');if(el){el.style.display='none';el.innerHTML='';}}
function sastHideSuggest(){const s=document.getElementById('sast-suggest');if(s)s.style.display='none';_sastSuggestIdx=-1;}

function sastKeyDown(e){
  const sug=document.getElementById('sast-suggest');
  const items=sug?sug.querySelectorAll('.ast-sug-item'):[];
  if(sug&&sug.style.display!=='none'&&items.length){
    if(e.key==='ArrowDown'){e.preventDefault();_sastSuggestIdx=Math.min(_sastSuggestIdx+1,items.length-1);items.forEach((el,i)=>el.classList.toggle('active',i===_sastSuggestIdx));items[_sastSuggestIdx]&&items[_sastSuggestIdx].scrollIntoView({block:'nearest'});return;}
    if(e.key==='ArrowUp'){e.preventDefault();_sastSuggestIdx=Math.max(_sastSuggestIdx-1,0);items.forEach((el,i)=>el.classList.toggle('active',i===_sastSuggestIdx));return;}
    if(e.key==='Tab'||(e.key==='Enter'&&_sastSuggestIdx>=0)){e.preventDefault();(items[Math.max(_sastSuggestIdx,0)]||items[0]).click();return;}
    if(e.key==='Escape'){sastHideSuggest();return;}
  }
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sastHideSuggest();sendSast();}
}

function sastInputChanged(ta){
  const lines=ta.value.split('\n');const curLine=lines[lines.length-1];
  const fm=curLine.match(/^(\w[\w\s\.]*?):\s*(.+)$/);
  if(!fm){sastHideSuggest();return;}
  const query=fm[2].toLowerCase(),fn=fm[1].toLowerCase();
  const songs=cachedSongs;let cands=[];
  if(/komponist|komp|^k\./.test(fn))cands=[...new Set(songs.map(s=>s.komponist).filter(Boolean))];
  else if(/textdichter|^text|^t\./.test(fn))cands=[...new Set(songs.map(s=>s.textdichter).filter(Boolean))];
  else if(/arrangeur|arr/.test(fn))cands=[...new Set(songs.map(s=>s.arrangeur).filter(Boolean))];
  else if(/uebersetzer|\u00fcbersetzer|\u00fcbers/.test(fn))cands=[...new Set(songs.map(s=>s.uebersetzer).filter(Boolean))];
  else if(/liedanfang|anfang/.test(fn))cands=[...new Set(songs.map(s=>s.liedanfang).filter(Boolean))];
  else if(/^titel|^title/.test(fn))cands=[...new Set(songs.map(s=>s.title).filter(Boolean))];
  else if(/originaltitel/.test(fn))cands=[...new Set(songs.map(s=>s.originaltitel).filter(Boolean))];
  else if(/besetzung/.test(fn))cands=['SATB','TTBB','SSA','SAB','SSAA','Gemischter Chor','M\u00e4nnerchor','Frauenchor'];
  else{sastHideSuggest();return;}
  const matches=cands.filter(c=>c.toLowerCase().includes(query)).slice(0,8);
  if(!matches.length){sastHideSuggest();return;}
  const sug=document.getElementById('sast-suggest');_sastSuggestIdx=-1;
  sug.innerHTML=matches.map(m=>`<div class="ast-sug-item" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid var(--border)" onmousedown="event.preventDefault();sastSelect('${esc(fm[1]+': ')}','${esc(m)}')" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">${esc(m)}</div>`).join('');
  sug.style.display='';
}

function sastSelect(prefix,value){
  const ta=document.getElementById('sast-input');
  const lines=ta.value.split('\n');
  lines[lines.length-1]=prefix+value;
  ta.value=lines.join('\n');
  sastHideSuggest();ta.focus();
  // Show hint
  const lz=personLzMap[value.toLowerCase()];
  const isKnown=lz||cachedSongs.some(s=>[s.komponist,s.textdichter,s.arrangeur,s.uebersetzer].includes(value));
  const hint=document.createElement('div');
  hint.style.cssText='position:absolute;bottom:100%;right:0;border-radius:var(--r);padding:4px 10px;font-size:11px;margin-bottom:4px;white-space:nowrap;pointer-events:none;z-index:201;'+(isKnown?'background:rgba(76,175,130,.1);border:0.5px solid rgba(76,175,130,.3);color:var(--success)':'background:rgba(232,160,32,.1);border:0.5px solid rgba(232,160,32,.3);color:var(--warn)');
  hint.textContent=isKnown?(lz?'\u2713 '+lz:'\u2713 Bekannt'):'\u26a0 Neu im Repertoire';
  ta.parentElement.appendChild(hint);setTimeout(()=>hint.remove(),2500);
}

async function sendSast(){
  const inp=document.getElementById('sast-input');
  const text=inp.value.trim();if(!text)return;
  inp.value='';inp.style.minHeight='38px';
  sastHideSuggest();sastUser(text);sastClearActions();

  if(_sastMode==='new_song'){
    const si=parseSongInput(text);
    [['komponist','komponist_lz'],['textdichter','textdichter_lz'],['arrangeur','arrangeur_lz'],['uebersetzer','uebersetzer_lz']].forEach(([n,lz])=>{
      const nm=(si[n]||'').toLowerCase().trim();
      if(nm&&!si[lz]&&personLzMap[nm])si[lz]=personLzMap[nm];
    });
    const unk=['komponist','textdichter','arrangeur','uebersetzer'].filter(f=>si[f]&&!personLzMap[si[f].toLowerCase()]&&!cachedSongs.some(s=>s[f]===si[f]));
    const flds=[['Liedanfang',si.liedanfang],['Titel',si.title&&si.title!==si.liedanfang?si.title:''],['Originaltitel',si.originaltitel],['Komponist',si.komponist+(si.komponist_lz?' ('+si.komponist_lz+')':'')],['Textdichter',si.textdichter+(si.textdichter_lz?' ('+si.textdichter_lz+')':'')],['Arrangeur',si.arrangeur+(si.arrangeur_lz?' ('+si.arrangeur_lz+')':'')],['\u00dcbersetzer',si.uebersetzer+(si.uebersetzer_lz?' ('+si.uebersetzer_lz+')':'')],['Besetzung',si.besetzung],['Rechte',si.rechte]].filter(([,v])=>v);
    let msg=flds.length?'Lied anlegen:\n'+flds.map(([k,v])=>'- '+k+': '+v).join('\n'):'Keine Felder erkannt.';
    if(unk.length)msg+='\n\n\u26a0 Neu im Repertoire:\n'+unk.map(f=>'- '+si[f]).join('\n');
    msg+='\n\nAufnehmen?';sastBot(msg);
    if(flds.length){_sastPendingSong=si;_sastMode='confirm';sastShowActions([{label:'\u2713 Ja, aufnehmen',fn:'sastConfirmSong()'},{label:'\u2717 Abbrechen',fn:"_sastMode=null;sastClearActions();"}]);}
    return;
  }
  if(_sastMode==='confirm'){if(/^ja|ok|yes/i.test(text))await sastConfirmSong();else{sastBot('Abgebrochen.');_sastMode=null;}return;}

  if(/neues?\s+lied|lied\s+(hinzuf|anlegen)/i.test(text)){
    const template='Liedanfang: \nTitel: \nKomponist: \nTextdichter: \nArrangeur: \n\u00dcbersetzer: \nOriginaltitel: \nBesetzung: \nRechte: ';
    sastBot('F\u00fclle die Felder aus und schicke es ab:');
    const inp2=document.getElementById('sast-input');inp2.value=template;inp2.focus();inp2.style.minHeight='220px';
    _sastMode='new_song';return;
  }
  const si=parseSongInput(text);
  if(si.liedanfang||si.title){_sastPendingSong=si;_sastMode='new_song';await sendSast();}
  else sastBot('Schreibe "Neues Lied" f\u00fcr die Vorlage, oder lade eine PDF hoch.');
}

async function sastConfirmSong(){
  if(!_sastPendingSong)return;
  const{_id,_file,_fileType,links,created_by,...fields}=_sastPendingSong;
  let songId=_id;
  if(_id){
    const{error}=await SB.from('songs').update(fields).eq('id',_id);
    if(error){sastBot('Fehler: '+error.message);return;}
    sastBot('\u2705 Lied aktualisiert!');
  } else {
    const{data:newSong,error}=await SB.from('songs').insert({...fields,created_by:currentUser.id}).select().single();
    if(error){sastBot('Fehler: '+error.message);return;}
    songId=newSong.id;
    sastBot('\u2705 Lied aufgenommen!');
  }
  // Upload PDF
  if(_file&&songId){
    try{
      const ext=_file.name.split('.').pop().toLowerCase();
      const ft=_fileType||'chorsatz';
      const path=`${songId}/${ft}.${ext}`;
      const{error:upErr}=await SB.storage.from('choir-media').upload(path,_file,{upsert:true});
      if(!upErr){
        const{data:{publicUrl}}=SB.storage.from('choir-media').getPublicUrl(path);
        await SB.from('song_files').upsert({song_id:songId,file_type:ft,url:publicUrl,path},{onConflict:'song_id,file_type'});
        const lbl={chorsatz:'Chorsatz',klaviersatz:'Klaviersatz',chor_klavier:'Chor+Klavier',orchestersatz:'Orchestersatz',sonstiges:'Sonstiges'};
        sastBot('\ud83d\udcc4 PDF als '+(lbl[ft]||ft)+' gespeichert!');
      } else sastBot('\u26a0\ufe0f PDF-Upload: '+upErr.message);
    }catch(e){sastBot('\u26a0\ufe0f PDF-Fehler: '+e.message);}
  }
  const{data:ns}=await SB.from('songs').select('*').order('liedanfang',{nullsFirst:false});if(ns)cachedSongs=ns;
  _sastMode=null;_sastPendingSong=null;sastClearActions();T('Gespeichert','ok');renderSongs();
  sastShowActions([{label:'Weiteres Lied',fn:"_sastMode='new_song';const i=document.getElementById('sast-input');i.value='Liedanfang: \\nTitel: \\nKomponist: \\nTextdichter: \\nArrangeur: \\n\u00dcbersetzer/Deutscher Text: \\nOriginaltitel: \\nBesetzung: \\nRechte: ';i.style.minHeight='220px';i.focus();"},{label:'Fertig',fn:"closeModal('m-song-assistant')"}]);
}


async function handleSastFiles(evt){
  const files=[...evt.target.files];evt.target.value='';
  for(const f of files){sastUser('\ud83d\udcc4 '+f.name);await processSastFile(f);}
}
async function processSastFile(file){
  sastBot('Analysiere "'+file.name+'" mit KI…');
  try{
    const buf=await file.arrayBuffer();
    const bytes=new Uint8Array(buf);
    let binary='';
    // Convert to base64 in chunks to avoid stack overflow
    const chunk=8192;
    for(let i=0;i<bytes.length;i+=chunk){
      binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
    }
    const base64=btoa(binary);
    const isPdf=file.name.toLowerCase().endsWith('.pdf');

    // Call via Supabase Edge Function proxy (avoids CORS)
    const proxyUrl=SB_URL+'/functions/v1/claude-proxy';
    // Build list of existing themen and anlässe for context
    const existingThemen=[...new Set(cachedSongs.map(s=>s.thema).filter(Boolean).flatMap(t=>t.split(',').map(x=>x.trim())))].join(', ');
    const existingAnlaesse=[...new Set(cachedSongs.map(s=>s.anlass).filter(Boolean).flatMap(a=>a.split(',').map(x=>x.trim())))].join(', ');

    const resp=await fetch(proxyUrl,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+SB_KEY,
      },
      body:JSON.stringify({
        model:'claude-opus-4-5',
        max_tokens:800,
        messages:[{
          role:'user',
          content:[
            isPdf
              ?{type:'document',source:{type:'base64',media_type:'application/pdf',data:base64}}
              :{type:'text',text:new TextDecoder().decode(bytes)},
            {type:'text',text:`Extrahiere die Lied-Metadaten. Antworte NUR mit JSON, kein Markdown:\n{"liedanfang":"","titel":"","komponist":"","textdichter":"","uebersetzer":"","arrangeur":"","originaltitel":"","besetzung":"","rechte":"","thema":"","anlass":"","datei_typ":""}\n\nRegeln:\n- liedanfang = erster Satz/Vers des Liedes auf Deutsch\n- textdichter = Autor des Originaltexts (Text: ...)\n- uebersetzer = Deutscher Text / Uebersetzung (Deutscher Text: ...)\n- komponist = Musik (Musik: ...)\n- arrangeur = Chorsatz / Arrangement\n- rechte = Copyright-Zeile\n- thema = passendes Thema aus dieser Liste (kommagetrennt wenn mehrere passen): ${existingThemen||'Worship, Advent, Weihnachten, Ostern, Lob, Glaube, Trost, Gebet'}\n- anlass = passender Anlass aus dieser Liste (kommagetrennt wenn mehrere passen): ${existingAnlaesse||'Gottesdienst, Taufe, Abendmahl, Konzert, Hochzeit, Beerdigung'}\n- besetzung = Stimmbesetzung des Chors. Erkenne aus Notenbild, Bezeichnungen oder Text: "SATB" (Sopran/Alt/Tenor/Bass gemischt), "TTBB" (Männerchor), "SSAA" (Frauenchor), "SSA", "SAB", "SSATB", "Unisono" usw. Wenn nur eine Chorstimme sichtbar ist = "Unisono". Wenn explizit angegeben (z.B. "für gemischten Chor") auch das verwenden.\n- datei_typ = "chorsatz" wenn Chor-Noten (SATB, mehrstimmig, Chorpartitur ohne vollständigen Klaviersatz), "klaviersatz" wenn nur Klavier, "chor_klavier" wenn Chor UND Klavier vollständig zusammen auf einer Partitur, "orchestersatz" wenn Orchester\n- Felder nicht gefunden = leer lassen`}          ]
        }]
      })
    });

    if(!resp.ok){
      const err=await resp.json().catch(()=>({}));
      throw new Error(err.error?.message||'HTTP '+resp.status);
    }

    const data=await resp.json();
    const raw=data.content?.map(c=>c.text||'').join('')||'';
    let info={};
    try{
      const clean=raw.replace(/```json|```/g,'').trim();
      info=JSON.parse(clean);
    }catch{
      const m=raw.match(/\{[\s\S]+\}/);
      if(m)try{info=JSON.parse(m[0]);}catch{}
    }

    if(!info||!Object.values(info).some(v=>v?.trim())){
      throw new Error('Keine Informationen erkannt');
    }

    // Show result
    let msg='Erkannt:\n\n';
    if(info.liedanfang)msg+='📖 '+info.liedanfang+'\n';
    if(info.originaltitel)msg+='- Originaltitel: '+info.originaltitel+'\n';
    if(info.komponist)msg+='- Musik: '+info.komponist+'\n';
    if(info.textdichter)msg+='- Text: '+info.textdichter+'\n';
    if(info.uebersetzer)msg+='- Deutscher Text: '+info.uebersetzer+'\n';
    if(info.arrangeur)msg+='- Chorsatz: '+info.arrangeur+'\n';
    const fileTypeLabels={chorsatz:'Chorsatz',klaviersatz:'Klaviersatz',chor_klavier:'Chor+Klavier',orchestersatz:'Orchestersatz',sonstiges:'Sonstiges'};
    if(info.datei_typ)msg+='- Dateityp: '+(fileTypeLabels[info.datei_typ]||info.datei_typ)+'\n';
    if(info.besetzung)msg+='- Besetzung: '+info.besetzung+'\n';
    if(info.rechte)msg+='- Rechte: '+info.rechte+'\n';

    const song={
      title:info.titel||info.liedanfang||'',
      liedanfang:info.liedanfang||info.titel||'',
      originaltitel:info.originaltitel||'',
      komponist:info.komponist||'',
      komponist_lz:'',
      textdichter:info.textdichter||'',
      textdichter_lz:'',
      arrangeur:info.arrangeur||'',
      arrangeur_lz:'',
      uebersetzer:info.uebersetzer||'',
      uebersetzer_lz:'',
      besetzung:info.besetzung||'',
      rechte:info.rechte||'',
      thema:info.thema||'',
      anlass:info.anlass||'',
      lizenz:info.lizenz||'',
      links:[],created_by:currentUser.id,
      _file:file,
      _fileType:info.datei_typ||'chorsatz'
    };
    // Auto-fill lebensdaten from existing songs
    [['komponist','komponist_lz'],['textdichter','textdichter_lz'],['arrangeur','arrangeur_lz'],['uebersetzer','uebersetzer_lz']].forEach(([n,lz])=>{
      const name=(song[n]||'').toLowerCase().trim();
      if(name&&personLzMap[name])song[lz]=personLzMap[name];
    });
    if(song.komponist_lz)msg+='- Komp. Lebensdaten: '+song.komponist_lz+'\n';
    if(song.textdichter_lz)msg+='- Text. Lebensdaten: '+song.textdichter_lz+'\n';
    if(info.thema)msg+='- Thema: '+info.thema+'\n';
    if(info.anlass)msg+='- Anlass: '+info.anlass+'\n';

    const songs=cachedSongs.length?cachedSongs:(await SB.from('songs').select('*').then(r=>r.data||[]));
    const _norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
    const existing=songs.find(s=>_norm(s.liedanfang||s.title||'')===_norm(song.liedanfang||song.title||''));

    if(existing){
      const upd=Object.entries(song).filter(([k,v])=>v&&typeof v==='string'&&!['title','links','created_by'].includes(k)&&!existing[k]);
      if(upd.length){
        msg+='\n✓ Bereits vorhanden. Fehlende Infos ergänzen:\n'+upd.map(([k,v])=>'+ '+k+': '+v).join('\n');
        sastBot(msg);_sastPendingSong={_id:existing.id,...Object.fromEntries(upd)};_sastMode='confirm';
        sastShowActions([{label:'✓ Ergänzen',fn:'sastConfirmSong()'},{label:'✏ Bearbeiten',fn:'_preloadTemplate('+JSON.stringify(song)+')'},{label:'✗ Abbrechen',fn:"_sastMode=null;sastClearActions();"}]);
      } else {msg+='\n✓ Bereits vollständig vorhanden.';sastBot(msg);}
    } else {
      msg+='\nAufnehmen?';sastBot(msg);_sastPendingSong=song;_sastMode='confirm';
      sastShowActions([{label:'✓ Aufnehmen',fn:'sastConfirmSong()'},{label:'✏ Bearbeiten',fn:'_preloadTemplate('+JSON.stringify(song)+')'},{label:'✗ Abbrechen',fn:"_sastMode=null;sastClearActions();"}]);
    }

  }catch(e){
    console.error('PDF AI error:',e);
    sastBot('KI konnte PDF nicht lesen ('+e.message+').\nBitte Felder manuell ausfüllen:');
    const inp=document.getElementById('sast-input');
    inp.value='Liedanfang: \nTitel: \nKomponist: \nTextdichter: \nArrangeur: \nÜbersetzer/Deutscher Text: \nOriginaltitel: \nBesetzung: \nRechte: ';
    inp.style.minHeight='220px';inp.focus();_sastMode='new_song';
  }
}

function _preloadTemplate(song){
  _sastMode='new_song';
  const inp=document.getElementById('sast-input');
  inp.value=
    'Liedanfang: '+(song.liedanfang||'')+'\n'+
    'Titel: '+(song.title&&song.title!==song.liedanfang?song.title:'')+'\n'+
    'Komponist: '+(song.komponist||'')+'\n'+
    'Textdichter: '+(song.textdichter||'')+'\n'+
    'Arrangeur: '+(song.arrangeur||'')+'\n'+
    'Übersetzer/Deutscher Text: '+(song.uebersetzer||'')+'\n'+
    'Originaltitel: '+(song.originaltitel||'')+'\n'+
    'Besetzung: '+(song.besetzung||'')+'\n'+
    'Rechte: '+(song.rechte||'');
  inp.style.minHeight='220px';inp.focus();sastClearActions();
}

async function processSastInfoPdf(lines,filename){
  const song={title:'',liedanfang:'',originaltitel:'',komponist:'',komponist_lz:'',textdichter:'',textdichter_lz:'',arrangeur:'',arrangeur_lz:'',uebersetzer:'',besetzung:'',rechte:'',lizenz:'',links:[],created_by:currentUser.id};
  const fullText=lines.join(' ');

  // Search both full text and individual lines
  const labeled=[
    {f:'title',        re:/(?:^|\s)(?:Titel|Title):\s*([^\n,]+)/i},
    {f:'liedanfang',   re:/(?:^|\s)(?:Liedanfang|Anfang):\s*([^\n,]+)/i},
    {f:'originaltitel',re:/(?:Originaltitel|Original[- ]?title):\s*([^\n]+?)(?:\s{2,}|$)/i},
    {f:'komponist',    re:/(?:Musik|Music|Komponist|Composer):\s*([^\n]+?)(?:\s{2,}|$)/i},
    {f:'textdichter',  re:/(?:^|\s)(?:Text|Words|Lyrics|Textdichter):\s*([^\n]+?)(?:\s{2,}|$)/i},
    {f:'uebersetzer',  re:/(?:Deutscher Text|\u00dcbersetzung|\u00dcbersetzer|German[- ]?Text):\s*([^\n]+?)(?:\s{2,}|$)/i},
    {f:'arrangeur',    re:/(?:Chorsatz|Arr(?:angement|angeur)?|Satz):\s*([^\n]+?)(?:\s{2,}|$)/i},
    {f:'besetzung',    re:/(?:Besetzung|Voicing|Stimmen):\s*([^\n]+?)(?:\s{2,}|$)/i},
    {f:'rechte',       re:/(\u00a9\s*\d{4}[^\n]*?)(?:\s{2,}|$)/},
    {f:'lizenz',       re:/(?:CCLI|Lizenz(?:nummer)?)\s*[:#]?\s*([^\n]+?)(?:\s{2,}|$)/i},
  ];
  for(const{f,re} of labeled){
    if(!song[f]){const m=fullText.match(re);if(m&&m[1])song[f]=m[1].trim().replace(/\s+/g,' ');}
    if(!song[f]){for(const l of lines){const m=l.match(re);if(m&&m[1]){song[f]=m[1].trim().replace(/\s+/g,' ');break;}}}
  }

  // Title fallback: first line that looks like a real title
  if(!song.title&&!song.liedanfang){
    const t=lines.find(l=>{
      const s=l.trim();
      return s.length>2&&s.length<80
        &&!/^(?:Text|Musik|Chorsatz|Piano|Originaltitel|\u00a9|L\d|Lizenz|CCLI)/i.test(s)
        &&!/^\d/.test(s)&&!/^[A-G][#b]?(?:m|maj|sus|add|dim|aug|\d)/.test(s)
        &&(s.match(/[a-z\u00e4\u00f6\u00fc\u00df]/)||[]).length>2;
    });
    if(t){song.title=t.trim();song.liedanfang=song.title;}
  }
  if(!song.title)song.title=song.liedanfang;
  if(!song.liedanfang)song.liedanfang=song.title;

  const songs=cachedSongs.length?cachedSongs:(await SB.from('songs').select('*').then(r=>r.data||[]));
  const existing=songs.find(s=>normStr(s.liedanfang||s.title||'')===normStr(song.liedanfang||song.title||''));
  const foundCount=[song.komponist,song.textdichter,song.arrangeur,song.rechte,song.uebersetzer].filter(Boolean).length;

  if(!existing&&foundCount<1){
    sastBot('Wenig erkannt. Bitte erg\u00e4nze die Felder:');
    const inp=document.getElementById('sast-input');
    inp.value='Liedanfang: '+(song.liedanfang||'')+'\nTitel: '+(song.title&&song.title!==song.liedanfang?song.title:'')+'\nKomponist: '+(song.komponist||'')+'\nTextdichter: '+(song.textdichter||'')+'\nArrangeur: '+(song.arrangeur||'')+'\n\u00dcbersetzer: '+(song.uebersetzer||'')+'\nOriginaltitel: '+(song.originaltitel||'')+'\nBesetzung: '+(song.besetzung||'')+'\nRechte: '+(song.rechte||'');
    inp.style.minHeight='220px';inp.focus();_sastMode='new_song';return;
  }

  let msg='Aus "'+filename+'" erkannt:\n\n\ud83d\udcd6 '+(song.title||song.liedanfang||'?')+'\n';
  if(song.originaltitel)msg+='- Originaltitel: '+song.originaltitel+'\n';
  if(song.komponist)msg+='- Musik: '+song.komponist+'\n';
  if(song.textdichter)msg+='- Text: '+song.textdichter+'\n';
  if(song.uebersetzer)msg+='- Deutscher Text: '+song.uebersetzer+'\n';
  if(song.arrangeur)msg+='- Chorsatz/Arr.: '+song.arrangeur+'\n';
  if(song.rechte)msg+='- Rechte: '+song.rechte+'\n';

  if(existing){
    const upd=Object.entries(song).filter(([k,v])=>v&&typeof v==='string'&&!['title','links','created_by'].includes(k)&&!existing[k]);
    if(upd.length){msg+='\n\u2713 Bereits vorhanden. Fehlende Infos erg\u00e4nzen:\n'+upd.map(([k,v])=>'+ '+k+': '+v).join('\n');sastBot(msg);_sastPendingSong={_id:existing.id,...Object.fromEntries(upd)};_sastMode='confirm';sastShowActions([{label:'\u2713 Infos erg\u00e4nzen',fn:'sastConfirmSong()'},{label:'\u2717 Abbrechen',fn:"_sastMode=null;sastClearActions();"}]);}
    else{msg+='\n\u2713 Bereits vollst\u00e4ndig vorhanden.';sastBot(msg);}
  } else {
    msg+='\nAufnehmen?';sastBot(msg);_sastPendingSong=song;_sastMode='confirm';
    sastShowActions([{label:'\u2713 Aufnehmen',fn:'sastConfirmSong()'},{label:'\u270f Bearbeiten',fn:"_sastMode='new_song';const i=document.getElementById('sast-input');i.value='Liedanfang: '+(song.liedanfang||'')+'\\nKomponist: '+(song.komponist||'')+'\\nTextdichter: '+(song.textdichter||'')+'\\nArrangeur: '+(song.arrangeur||'')+'\\n\u00dcbersetzer: '+(song.uebersetzer||'')+'\\nOriginaltitel: '+(song.originaltitel||'')+'\\nBesetzung: '+(song.besetzung||'')+'\\nRechte: '+(song.rechte||'');i.style.minHeight='220px';i.focus();sastClearActions();"},{label:'\u2717 Abbrechen',fn:"_sastMode=null;sastClearActions();"}]);
  }
}


// pdf-lib helper – load on demand
async function loadPdfLib(){
  if(window.PDFLib)return window.PDFLib;
  return new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
    s.onload=()=>res(window.PDFLib);
    s.onerror=()=>rej(new Error('pdf-lib konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

async function callClaude(base64,prompt,retries=3){
  for(let attempt=0;attempt<retries;attempt++){
    try{
      const resp=await fetch(SB_URL+'/functions/v1/claude-proxy',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY},
        body:JSON.stringify({model:'claude-opus-4-5',max_tokens:2000,messages:[{role:'user',content:[
          {type:'document',source:{type:'base64',media_type:'application/pdf',data:base64}},
          {type:'text',text:prompt}
        ]}]})
      });
      if(!resp.ok){
        const e=await resp.json().catch(()=>({}));
        const msg=e.error?.message||'HTTP '+resp.status;
        // Rate limit: wait and retry
        if(msg.includes('rate limit')||msg.includes('529')||resp.status===429){
          const waitSec=65*(attempt+1);
          const el=document.getElementById('db-pdf-status');
          if(el){const d=document.createElement('div');d.style.cssText='font-size:12px;color:var(--warn)';el.appendChild(d);
            for(let s=waitSec;s>0;s--){d.textContent='Rate-Limit – warte '+s+'s (Versuch '+(attempt+2)+'/'+retries+')...';await new Promise(r=>setTimeout(r,1000));}
          } else await new Promise(r=>setTimeout(r,waitSec*1000));
          continue;
        }
        throw new Error(msg);
      }
      const data=await resp.json();
      return(data.content||[]).map(c=>c.text||'').join('');
    }catch(e){
      if(attempt===retries-1)throw e;
      await new Promise(r=>setTimeout(r,5000));
    }
  }
  throw new Error('Max retries reached');
}

function parseJsonSongs(raw){
  let songs=[];
  try{songs=JSON.parse(raw.replace(/```json|```/g,'').trim());}
  catch{const m=raw.match(/\[[\s\S]+\]/);if(m)try{songs=JSON.parse(m[0]);}catch{}}
  return Array.isArray(songs)?songs:[];
}

async function toBase64(bytes){
  let binary='';const chunk=8192;
  for(let i=0;i<bytes.length;i+=chunk)
    binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunk,bytes.length)));
  return btoa(binary);
}

async function importDbPdf(evt){
  const file=evt.target.files[0];evt.target.value='';
  if(!file)return;
  const status=document.getElementById('db-pdf-status');
  const log=(msg,type)=>{
    const d=document.createElement('div');
    d.style.cssText='font-size:12px;padding:3px 0;color:'+(type==='err'?'var(--danger)':type==='ok'?'var(--success)':'var(--text2)');
    d.textContent=msg;status.appendChild(d);status.scrollTop=status.scrollHeight;
  };
  const setProgress=(pct,label)=>{
    let bar=document.getElementById('db-progress');
    if(!bar){bar=document.createElement('div');bar.id='db-progress';bar.style.cssText='margin:8px 0;background:rgba(255,255,255,.08);border-radius:4px;height:8px;overflow:hidden';bar.innerHTML='<div id="db-progress-inner" style="height:100%;background:var(--accent);border-radius:4px;transition:width .3s;width:0%"></div>';status.appendChild(bar);}
    document.getElementById('db-progress-inner').style.width=pct+'%';
    if(label)log(label);
  };
  status.innerHTML='';
  log('Lese "'+file.name+'" ('+Math.round(file.size/1024/1024*10)/10+' MB)...');

  try{
    // Load pdf-lib
    log('Lade PDF-Bibliothek...');
    const PDFLib=await loadPdfLib();
    const buf=await file.arrayBuffer();
    const fullBase64=await toBase64(new Uint8Array(buf));

    // Step 1: Get total page count
    const srcPdf=await PDFLib.PDFDocument.load(buf);
    const totalPages=srcPdf.getPageCount();
    const manualQuelle=(document.getElementById('db-manual-quelle')?.value||'').trim();
    const manualLizenz=(document.getElementById('db-manual-lizenz')?.value||'').trim();
    log('PDF hat '+totalPages+' Seiten.'+(manualQuelle?' | Quelle: '+manualQuelle:'')+(manualLizenz?' | Lizenz: '+manualLizenz:''));

    // Step 2: Analyse in chunks of 50 pages with 5-page overlap
    const CHUNK=10;
    const OVERLAP=1;
    const allSongs=[];
    const numChunks=Math.ceil(totalPages/CHUNK);

    for(let ci=0;ci<numChunks;ci++){
      const pageFrom=ci*CHUNK+1;
      const pageTo=Math.min(ci*CHUNK+CHUNK+OVERLAP,totalPages);
      const isLast=pageTo>=totalPages;
      setProgress(Math.round(ci/numChunks*40),'KI analysiert Seiten '+pageFrom+'-'+pageTo+' (Teil '+(ci+1)+'/'+numChunks+')...');

      // Extract chunk pages into new PDF
      const chunkDoc=await PDFLib.PDFDocument.create();
      const pageIdxs=Array.from({length:pageTo-pageFrom+1},(_,i)=>pageFrom-1+i);
      const copiedPages=await chunkDoc.copyPages(srcPdf,pageIdxs);
      copiedPages.forEach(p=>chunkDoc.addPage(p));
      const chunkBytes=await chunkDoc.save();
      const chunkBase64=await toBase64(chunkBytes);


      const prompt='Diese PDF enthaelt Seiten '+pageFrom+'-'+pageTo+' aus einem Chorliederbuch (Gesamtseiten: '+totalPages+').'
        +' Extrahiere ALLE Lieder die auf diesen Seiten beginnen - auch wenn die Liednummer nicht mit der Seitennummer uebereinstimmt.'
        +' Die Lieder haben oben eine grosse Nummer und einen Titel. Jedes Lied beginnt auf einer neuen Seite.'
        +(ci>0?' Die ersten '+OVERLAP+' Seiten ueberlappen mit dem vorherigen Abschnitt - nur Lieder aufnehmen die auf Seite '+pageFrom+' oder spaeter BEGINNEN.':'')
        +'\nExtrahiere alle vollstaendigen Lieder. Ueberspringe: Titelblatt, Inhaltsverzeichnis, Abschnittsseiten, Trennseiten, leere Seiten.'
        +(isLast?'':'\nLieder die am Ende dieses Abschnitts noch nicht abgeschlossen sind NICHT aufnehmen.')
        +'\nFeldregeln:\n'
        +'- liedanfang: Erste vollstaendige Textzeile des 1. Verses (oft identisch mit dem Titel). Beispiel: Titel "Der Du das All regierst" -> liedanfang "Der Du das All regierst" oder "Der Du das All regierst voll Herrlichkeit". Nimm die erste gesungene Zeile des ersten Verses.\n'
        +'- titel: Ueberschrift/Titel des Liedes (oft gross geschrieben oben auf der Seite)\n'
        +'- komponist: NUR wenn explizit als Komponist/Musik/Melodie bezeichnet - NICHT den Arrangeur/Satz\n'
        +'- arrangeur: Person bei Satz/Arr./Chorsatz/Arrangement\n'
        +'- textdichter: Person bei Text/Words/Dichter\n'
        +'- uebersetzer: Person bei Uebersetz./Uebertragung/Deutscher Text\n'
        +'- besetzung: Stimmbesetzung aus Notenbild erkennen (SATB=4 Stimmen gemischt, TTBB=Maennerchor, SSA=Frauenchor) oder aus Text\n'
        +'- bibelstelle: Bibelvers der angegeben ist (z.B. Psalm 23, Joh 3,16)\n'
        +'- quelle: Liederbuch-Angabe am Ende der Seite (z.B. Jesu Name nie verklinget IV - 919)\n'
        +'- quelle_nr: Zuerst die Liednummer oben auf der Seite suchen (grosse Zahl oben links/rechts, z.B. "1", "42"). Falls nicht gefunden, Nummer aus der Quellenangabe am Seitenende (z.B. 919 aus "Jesu Name nie verklinget IV - 919").\n'
        +'- rechte: Copyright-Zeile\n'
        +'- thema: Thema des Liedes (z.B. Lob, Advent, Ostern, Trost)\n'
        +'- anlass: Kirchlicher Anlass (z.B. Gottesdienst, Weihnachten, Abendmahl)\n'
        +'\nAntworte NUR mit JSON-Array, kein Markdown:\n'
        +'[{"liedanfang":"","titel":"","originaltitel":"","komponist":"","textdichter":"","uebersetzer":"","arrangeur":"","besetzung":"","rechte":"","bibelstelle":"","quelle":"","quelle_nr":"","thema":"","anlass":"","seite_von":'+pageFrom+',"seite_bis":'+pageFrom+'}]'
        +'\nseite_von/seite_bis = GLOBALE Seitennummern im Gesamtdokument. Felder nicht gefunden = leer lassen.';
      let raw='';
      try{raw=await callClaude(chunkBase64,prompt);}
      catch(e){log('Chunk '+(ci+1)+' Fehler: '+e.message+' - weiter...');continue;}
      const chunk_songs=parseJsonSongs(raw);
      log('  -> '+chunk_songs.length+' Lieder in diesem Abschnitt erkannt');
      allSongs.push(...chunk_songs);
      if(ci<numChunks-1){
        const wait=65;
        const d=document.createElement('div');
        d.style.cssText='font-size:12px;padding:3px 0;color:var(--text2)';
        status.appendChild(d);
        for(let s=wait;s>0;s--){
          d.textContent='Warte '+s+'s (Rate-Limit)...';
          await new Promise(r=>setTimeout(r,1000));
        }
      }
    }

    log('Gesamt: '+allSongs.length+' Lieder erkannt');
    setProgress(45,'Speichere Lieder in Datenbank...');

    // Step 3: Insert songs into DB
    const{data:existing}=await SB.from('songs').select('id,liedanfang,title,komponist,textdichter,arrangeur,uebersetzer,besetzung,thema,rechte,lizenz,originaltitel,quelle,quelle_nr,bibelstelle,notizen,schrank,in_repertoire');
    const existMap=new Map();
    (existing||[]).forEach(s=>{
      if(s.liedanfang)existMap.set(s.liedanfang.toLowerCase().trim(),s);
      if(s.title)existMap.set(s.title.toLowerCase().trim(),s);
    });
    const toInsert=[];
    const toMerge=[]; // {existing: dbSong, incoming: pdfSong}
    for(const s of allSongs){
      if(!s.liedanfang&&!s.titel)continue;
      const la=(s.liedanfang||s.titel||'').toLowerCase().trim();
      const ti=(s.titel||s.liedanfang||'').toLowerCase().trim();
      const existingSong=existMap.get(la)||existMap.get(ti);
      if(existingSong){
        toMerge.push({
          existing:existingSong,
          incoming:{
            title:s.titel||s.liedanfang||'',liedanfang:s.liedanfang||s.titel||'',
            originaltitel:s.originaltitel||'',komponist:s.komponist||'',
            textdichter:s.textdichter||'',uebersetzer:s.uebersetzer||'',
            arrangeur:s.arrangeur||'',besetzung:s.besetzung||'',
            rechte:s.rechte||'',bibelstelle:s.bibelstelle||'',
            thema:s.thema||'',anlass:s.anlass||'',
            quelle:manualQuelle||s.quelle||'',quelle_nr:s.quelle_nr||'',
            lizenz:manualLizenz||s.lizenz||'',
            _seite_von:s.seite_von,_seite_bis:s.seite_bis,
          }
        });
        continue;
      }
      toInsert.push({
        title:s.titel||s.liedanfang||'',liedanfang:s.liedanfang||s.titel||'',
        originaltitel:s.originaltitel||'',komponist:s.komponist||'',
        textdichter:s.textdichter||'',uebersetzer:s.uebersetzer||'',
        arrangeur:s.arrangeur||'',besetzung:s.besetzung||'',
        rechte:s.rechte||'',bibelstelle:s.bibelstelle||'',
        thema:s.thema||'',anlass:s.anlass||'',
        quelle:manualQuelle||s.quelle||'',quelle_nr:s.quelle_nr||'',
        lizenz:manualLizenz||s.lizenz||'',
        _seite_von:s.seite_von,_seite_bis:s.seite_bis,
        in_repertoire:false,created_by:currentUser.id
      });
      existMap.set(la,{id:'pending'});existMap.set(ti,{id:'pending'});
    }

    let inserted=0,errors=0;
    const insertedIds=[];
    for(let i=0;i<toInsert.length;i+=50){
      const batch=toInsert.slice(i,i+50).map(({_seite_von,_seite_bis,...s})=>s);
      const{data:newRows,error}=await SB.from('songs').insert(batch).select('id,liedanfang');
      if(error){
        for(let j=0;j<toInsert.slice(i,i+50).length;j++){
          const{_seite_von,_seite_bis,...s}=toInsert[i+j];
          const{data:nr,error:e2}=await SB.from('songs').insert(s).select('id').single();
          if(e2)errors++;
          else{inserted++;insertedIds.push({id:nr.id,seite_von:_seite_von,seite_bis:_seite_bis});}
        }
      } else {
        inserted+=batch.length;
        // Match returned rows by liedanfang, NOT by index (Supabase doesn't guarantee order)
        const batchMap=new Map();
        toInsert.slice(i,i+50).forEach(s=>{
          const key=(s.liedanfang||s.title||'').toLowerCase().trim();
          batchMap.set(key,{seite_von:s._seite_von,seite_bis:s._seite_bis});
        });
        (newRows||[]).forEach(r=>{
          const key=(r.liedanfang||'').toLowerCase().trim();
          const orig=batchMap.get(key);
          if(orig)insertedIds.push({id:r.id,seite_von:orig.seite_von,seite_bis:orig.seite_bis});
          else insertedIds.push({id:r.id,seite_von:null,seite_bis:null});
        });
      }
      setProgress(45+Math.round(inserted/toInsert.length*25),'Gespeichert: '+inserted+'/'+toInsert.length+'...');
    }

    const skipped=allSongs.length-toInsert.length-toMerge.length;
    log(inserted+' neue Lieder gespeichert, '+skipped+' übersprungen'+(toMerge.length?', '+toMerge.length+' bereits vorhanden → Merge-Assistent':'')+(errors?', '+errors+' Fehler':''));
    if(toMerge.length)openPdfMergeQueue(toMerge);
    setProgress(70,'Teile PDF auf und haenge an Lieder an...');

    // Step 4: Split PDF and attach to songs
    const withPages=insertedIds.filter(r=>r.seite_von&&r.seite_bis);
    let attached=0,attachErrors=0;

    for(let i=0;i<withPages.length;i++){
      const{id,seite_von,seite_bis}=withPages[i];
      try{
        // Extract pages for this song
        const songDoc=await PDFLib.PDFDocument.create();
        const from=Math.max(1,Number(seite_von))-1;
        const to=Math.min(totalPages,Number(seite_bis))-1;
        if(from>to||from>=totalPages)continue;
        const idxs=Array.from({length:to-from+1},(_,k)=>from+k);
        const pages=await songDoc.copyPages(srcPdf,idxs);
        pages.forEach(p=>songDoc.addPage(p));
        const pdfBytes=await songDoc.save();

        // Upload to storage
        const path=id+'/chorsatz.pdf';
        const blob=new Blob([pdfBytes],{type:'application/pdf'});
        const{error:upErr}=await SB.storage.from('choir-media').upload(path,blob,{upsert:true});
        if(!upErr){
          const{data:{publicUrl}}=SB.storage.from('choir-media').getPublicUrl(path);
          await SB.from('song_files').upsert({song_id:id,file_type:'chorsatz',url:publicUrl,path},{onConflict:'song_id,file_type'});
          attached++;
        }
      }catch(e){attachErrors++;console.warn('Split error song '+id+':',e);}

      if(i%10===0)setProgress(70+Math.round(i/withPages.length*29),'PDFs angehaengt: '+attached+'/'+(i+1)+'...');
    }

    // Refresh cache
    const{data:ns}=await SB.from('songs').select('*').order('liedanfang',{nullsFirst:false});
    if(ns)cachedSongs=ns;
    setProgress(100);
    log('Fertig! '+inserted+' Lieder importiert, '+attached+' PDFs angehaengt'+(attachErrors?' ('+attachErrors+' Fehler)':''),'ok');
    updateSourceBtn();

  }catch(e){log('Fehler: '+e.message,'err');console.error(e);}
}

async function reanalyzePdf(evt){
  const file=evt.target.files[0];evt.target.value='';
  if(!file)return;
  const status=document.getElementById('db-pdf-status');
  const log=(msg,type)=>{const d=document.createElement('div');d.style.cssText='font-size:12px;padding:3px 0;color:'+(type==='err'?'var(--danger)':type==='ok'?'var(--success)':'var(--text2)');d.textContent=msg;status.appendChild(d);status.scrollTop=status.scrollHeight;};
  const setProgress=(pct)=>{let bar=document.getElementById('db-progress');if(!bar){bar=document.createElement('div');bar.id='db-progress';bar.style.cssText='margin:8px 0;background:rgba(255,255,255,.08);border-radius:4px;height:8px;overflow:hidden';bar.innerHTML='<div id="db-progress-inner" style="height:100%;background:var(--accent);border-radius:4px;transition:width .3s;width:0%"></div>';status.appendChild(bar);}document.getElementById('db-progress-inner').style.width=pct+'%';};
  status.innerHTML='';
  log('Lade PDF und DB-Lieder...');
  try{
    const PDFLib=await loadPdfLib();
    const buf=await file.arrayBuffer();
    const srcPdf=await PDFLib.PDFDocument.load(buf);
    const totalPages=srcPdf.getPageCount();
    log('PDF: '+totalPages+' Seiten');

    // Load all DB songs that have page info stored in song_files or need correction
    const{data:dbSongs}=await SB.from('songs').select('id,liedanfang,titel:title,komponist,textdichter,uebersetzer,arrangeur,besetzung,bibelstelle,quelle,thema,anlass,rechte').eq('in_repertoire',false).order('created_at');
    if(!dbSongs?.length){log('Keine Datenbank-Lieder gefunden.','err');return;}
    log(dbSongs.length+' DB-Lieder gefunden. Starte Nachkorrektur...');

    // Process in chunks of 20 pages, match songs by liedanfang/titel
    const CHUNK=20;const OVERLAP=2;
    const numChunks=Math.ceil(totalPages/CHUNK);
    const updates={};// id -> updated fields

    for(let ci=0;ci<numChunks;ci++){
      const pageFrom=ci*CHUNK+1;
      const pageTo=Math.min(ci*CHUNK+CHUNK+OVERLAP,totalPages);
      setProgress(Math.round(ci/numChunks*80));
      log('Analysiere Seiten '+pageFrom+'-'+pageTo+' ('+( ci+1)+'/'+numChunks+')...');

      const chunkDoc=await PDFLib.PDFDocument.create();
      const idxs=Array.from({length:pageTo-pageFrom+1},(_,i)=>pageFrom-1+i);
      const pages=await chunkDoc.copyPages(srcPdf,idxs);
      pages.forEach(p=>chunkDoc.addPage(p));
      const chunkBytes=await chunkDoc.save();
      const chunkBase64=await toBase64(chunkBytes);

      const prompt='Diese PDF enthaelt Seiten '+pageFrom+'-'+pageTo+' eines Chorliederbuchs.\n'
        +'Extrahiere alle Lieder mit moeglichst vollstaendigen Daten. Ueberspringe Titelblatt, Inhaltsverzeichnis, Abschnittsseiten.\n'
        +'Feldregeln:\n'
        +'- titel: Ueberschrift/Titel des Liedes wie er oben auf der Seite steht\n'
        +'- liedanfang: Die erste gesungene Textzeile des 1. Verses (kann gleich dem Titel sein oder abweichen). Beispiel: Titel = "Großer Gott", Liedanfang = "Großer Gott wir loben dich"\n'
        +'- titel: Ueberschrift oben auf der Seite\n'
        +'- komponist: NUR bei expliziter Angabe Melodie/Musik/Komponist (nicht Arrangeur/Satz)\n'
        +'- arrangeur: Person bei Satz/Arr./Chorsatz\n'
        +'- textdichter: Person bei Text/Words\n'
        +'- uebersetzer: Person bei Uebersetz./Deutscher Text\n'
        +'- besetzung: Aus Notenbild (SATB=4 Stimmen gemischt, TTBB=Maennerchor, SSA=Frauenchor)\n'
        +'- bibelstelle: Bibelvers auf der Seite\n'
        +'- quelle: Liederbuch-Angabe am Seitenende\n'
        +'- quelle_nr: Zuerst die Liednummer oben auf der Seite suchen (grosse Zahl oben links/rechts, z.B. "1", "42"). Falls nicht gefunden, die Nummer am Ende der Seite aus der Quellenangabe nehmen (z.B. 919 aus "Jesu Name nie verklinget IV - 919").\n'
        +'- rechte: Copyright-Zeile\n'
        +'- thema: Thema des Liedes\n'
        +'- anlass: Kirchlicher Anlass\n'
        +'Antworte NUR mit JSON-Array:\n'
        +'[{"liedanfang":"","titel":"","originaltitel":"","komponist":"","textdichter":"","uebersetzer":"","arrangeur":"","besetzung":"","rechte":"","bibelstelle":"","quelle":"","quelle_nr":"","thema":"","anlass":"","seite_von":'+pageFrom+',"seite_bis":'+pageFrom+'}]\n'
        +'seite_von/seite_bis = globale Seitennummern. Felder nicht gefunden = leer lassen.';

      let raw='';
      try{raw=await callClaude(chunkBase64,prompt);}
      catch(e){log('Chunk '+(ci+1)+' Fehler: '+e.message+' - weiter...');continue;}
      const chunkSongs=parseJsonSongs(raw);
      log('  -> '+chunkSongs.length+' Lieder erkannt');
      if(ci<numChunks-1){
        const wait2=65;
        const d2=document.createElement('div');
        d2.style.cssText='font-size:12px;padding:3px 0;color:var(--text2)';
        status.appendChild(d2);
        for(let s=wait2;s>0;s--){
          d2.textContent='Warte '+s+'s (Rate-Limit)...';
          await new Promise(r=>setTimeout(r,1000));
        }
      }

      // Match each found song to existing DB songs
      for(const cs of chunkSongs){
        const csTitel=(cs.titel||'').toLowerCase().trim();
        const csAnfang=(cs.liedanfang||'').toLowerCase().trim();
        const match=dbSongs.find(s=>{
          const st=(s.titel||s.liedanfang||'').toLowerCase().trim();
          const sa=(s.liedanfang||'').toLowerCase().trim();
          // Match by titel or liedanfang
          return st===csTitel||st===csAnfang||sa===csAnfang||sa===csTitel
            ||(csTitel.length>4&&(st.includes(csTitel)||csTitel.includes(st)))
            ||(csAnfang.length>4&&(sa.includes(csAnfang)||csAnfang.includes(sa)));
        });
        if(!match)continue;
        // Build update with improved/missing fields
        const upd={};
        const fields=['liedanfang','titel','komponist','textdichter','uebersetzer','arrangeur','besetzung','bibelstelle','quelle','quelle_nr','rechte','thema','anlass','originaltitel'];
        fields.forEach(f=>{
          const dbField=f==='titel'?'title':f;
          const newVal=(cs[f]||'').trim();
          const oldVal=(match[dbField]||match[f]||'').trim();
          if(!newVal)return;
          if(!oldVal){upd[dbField]=newVal;return;}
          if(f==='komponist'&&match.komponist===match.arrangeur&&newVal!==match.arrangeur){upd[dbField]=newVal;return;}
          if(newVal.length>oldVal.length+3)upd[dbField]=newVal;
        });
        if(Object.keys(upd).length>0)updates[match.id]=upd;
      }
    }

    log('Aktualisiere '+Object.keys(updates).length+' Lieder...');
    setProgress(85);
    let updated=0;
    for(const[id,upd] of Object.entries(updates)){
      const{error}=await SB.from('songs').update(upd).eq('id',id);
      if(!error)updated++;
    }

    const{data:ns}=await SB.from('songs').select('*').order('liedanfang',{nullsFirst:false});
    if(ns)cachedSongs=ns;
    setProgress(100);
    log('Fertig! '+updated+' Lieder aktualisiert.','ok');
    updateSourceBtn();
  }catch(e){log('Fehler: '+e.message,'err');console.error(e);}
}

async function renderSettings(tab='members'){
  if(currentProfile?.role!=='admin'){document.getElementById('settings-body').innerHTML='<p style="color:var(--text2)">Nur für Admins.</p>';return;}
  const tabs=`<div class="view-tabs" style="margin-bottom:16px">
    <div class="vtab ${tab==='members'?'active':''}" onclick="renderSettings('members')">Mitglieder</div>
    <div class="vtab ${tab==='settings'?'active':''}" onclick="renderSettings('settings')">Einstellungen</div>
  </div>`;
  if(tab==='settings'){
    await loadCategories();
    document.getElementById('settings-body').innerHTML=tabs+`
      <div class="st">Kalender-Kategorien</div>
      ${cachedCategories.map(c=>`<div class="card" style="cursor:default">
        <div style="display:flex;align-items:center;gap:10px">
          <input type="color" value="${esc(c.color)}" style="width:32px;height:32px;border-radius:50%;border:2px solid var(--border2);cursor:pointer;padding:2px" oninput="updateCatColor('${c.id}',this.value)" onchange="updateCatColor('${c.id}',this.value)">
          <input class="fi" value="${esc(c.name)}" style="flex:1;padding:6px 10px" onchange="updateCatName('${c.id}',this.value)" placeholder="Kategoriename">
          <button class="btn btn-d btn-sm" onclick="deleteCat('${c.id}')">✕</button>
        </div>
      </div>`).join('')}
      <div style="display:flex;gap:7px;margin-top:8px;align-items:center">
        <input class="fi" id="new-cat-name" placeholder="Neue Kategorie" style="flex:2">
        <input type="color" id="new-cat-color" value="#5b8dee" style="width:40px;height:38px;border-radius:var(--r);border:0.5px solid var(--border);background:var(--card);cursor:pointer;padding:3px">
        <button class="btn btn-p btn-sm" onclick="addCat()">+</button>
      </div>
      <div class="st" style="margin-top:16px">Veranstaltungen importieren</div>
      <div class="card" style="cursor:default">
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Word-Dokument (.docx) oder Textdatei (.txt) mit Veranstaltungen importieren.</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:10px">Format: <code style="background:rgba(255,255,255,.06);padding:2px 5px;border-radius:4px">21.05.2023 Chor (Taufe)</code> gefolgt von Liedtiteln als Aufzählung.</div>
        <input type="file" id="ev-import-file" accept=".txt,.docx" style="display:none" onchange="importEventsFile(event)">
        <button class="btn btn-g" style="width:100%" onclick="document.getElementById('ev-import-file').click()">📄 Datei auswählen & importieren</button>
        <div id="ev-import-status" style="margin-top:8px;font-size:12px"></div>
      </div>
      <div class="st" style="margin-top:16px">Liederdatenbank – PDF importieren</div>
      <div class="card" style="cursor:default">
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Grosse PDF mit mehreren Liedern hochladen. Die KI erkennt alle Lieder und speichert sie in der Datenbank (nicht im Repertoire).</div>
        <div class="fr2" style="margin-bottom:8px">
          <div><label class="fl">Quelle (optional – überschreibt PDF-Quelle)</label><input class="fi" id="db-manual-quelle" placeholder="z.B. Jesu Name nie verklinget IV" style="margin-top:4px"></div>
          <div><label class="fl">Lizenz (optional – überschreibt PDF-Lizenz)</label><input class="fi" id="db-manual-lizenz" placeholder="z.B. CCLI 123456" style="margin-top:4px"></div>
        </div>
        <input type="file" id="db-pdf-input" accept=".pdf" style="display:none" onchange="importDbPdf(event)">
        <button class="btn btn-p" style="width:100%;margin-bottom:8px" onclick="document.getElementById('db-pdf-input').click()">📄 PDF hochladen &amp; analysieren</button>
        <div style="height:0.5px;background:var(--border);margin-bottom:8px"></div>
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Bereits importierte Lieder nachkorrigieren: Die gleiche PDF hochladen, Claude liest jede PDF-Seite erneut und aktualisiert fehlende/falsche Felder.</div>
        <input type="file" id="db-pdf-reanalyze" accept=".pdf" style="display:none" onchange="reanalyzePdf(event)">
        <button class="btn btn-g" style="width:100%" onclick="document.getElementById('db-pdf-reanalyze').click()">🔄 Bestehende Daten nachkorrigieren</button>
        <div id="db-pdf-status" style="margin-top:10px;max-height:300px;overflow-y:auto"></div>
      </div>
      <div class="st" style="margin-top:16px">Datenbank-Pflege</div>
      <div class="card" style="cursor:default">
        <div style="font-size:12px;color:var(--text2);margin-bottom:8px">Themen & Anlässe vereinheitlichen: Zusammenführt doppelte Labels, normalisiert Schreibweisen und überführt alle Anlass-Werte in das Thema-Feld.</div>
        <button class="btn btn-warn" style="width:100%;background:rgba(232,160,32,.15);color:#f5c06a;border:0.5px solid rgba(232,160,32,.3)" onclick="if(confirm('Labels in der Datenbank jetzt bereinigen? Das kann nicht rückgängig gemacht werden.'))runDbCleanup()">🧹 Labels bereinigen & vereinheitlichen</button>
        <button class="btn btn-i" style="width:100%;margin-top:8px" onclick="openMergeTool()">🔍 Duplikate finden & zusammenführen</button>
        <button class="btn btn-i" style="width:100%;margin-top:8px" onclick="openQuelleBrowser()">📖 Quellenübersicht / fehlende Nummern</button>
        <button class="btn btn-i" style="width:100%;margin-top:8px" onclick="openBackup()">💾 Backup erstellen</button>
        <button class="btn btn-i" style="width:100%;margin-top:8px" onclick="openPdfReassign()">🔧 PDF-Zuordnung korrigieren</button>
      </div>
      <div class="st" style="margin-top:16px">Repertoire CSV</div>
      <div class="card" style="cursor:default">
        <div class="fr2">
          <div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:7px">CSV importieren</div>
            <input type="file" id="csv-import" accept=".csv" style="display:none" onchange="importCSV(event)">
            <button class="btn btn-g" style="width:100%" onclick="document.getElementById('csv-import').click()">CSV importieren</button>
          </div>
          <div>
            <div style="font-size:12px;color:var(--text2);margin-bottom:7px">CSV exportieren</div>
            <button class="btn btn-g" style="width:100%" onclick="exportCSV()">CSV exportieren</button>
          </div>
        </div>
        <p style="font-size:10px;color:var(--text3);margin-top:8px">Spalten: liedanfang, title, refrain, besetzung, thema, anlass, textdichter, textdichter_lz, komponist, komponist_lz, arrangeur, arrangeur_lz, uebersetzer, uebersetzer_lz, rechte, originaltitel, quelle, quelle_nr, lizenz, schrank, notizen</p>
      </div>`;
    return;
  }
  // Members tab
  const{data:members}=await SB.from('profiles').select('*').order('name');
  function fLastSeen(ts){
    if(!ts)return'Nie';
    const d=new Date(ts),now=new Date();
    const diff=Math.floor((now-d)/1000);
    if(diff<60)return'Gerade eben';
    if(diff<3600)return`vor ${Math.floor(diff/60)} Min.`;
    if(diff<86400)return`vor ${Math.floor(diff/3600)} Std.`;
    if(diff<604800)return`vor ${Math.floor(diff/86400)} Tagen`;
    return fD(ts.slice(0,10));
  }
  document.getElementById('settings-body').innerHTML=tabs+`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="st" style="margin:0">Mitglieder (${(members||[]).length})</div>
      <button class="btn btn-p btn-sm" onclick="openAddMember()">+ Mitglied</button>
    </div>
    ${(members||[]).map(m=>{const isMe=m.id===currentUser.id;const isActive=m.active!==false;
      return`<div class="card" style="cursor:default;${!isActive?'opacity:.5':''}">
        <div class="crow">
          <div><div style="font-weight:500">${esc(m.name)}</div>
            <div class="cs">${esc(m.stimme||'')} ${m.email?'· '+esc(m.email):''}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px">🕐 ${fLastSeen(m.last_seen)}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <span class="badge ${m.role==='admin'?'warn':''}">${m.role==='admin'?'Admin':'Mitglied'}</span>
            ${m.role2?`<span class="badge blue">${esc(m.role2.split(',').map(r=>r==='dirigent'?'Dirigent':'Klavier').join(' & '))}</span>`:''}
            ${!isActive?'<span class="badge red">Deaktiviert</span>':''}
          </div>
        </div>
        <div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap">
          ${!isMe?`<button class="btn btn-g btn-sm" onclick="toggleMemberRole('${m.id}','${m.role}')">${m.role==='admin'?'Zu Mitglied':'Zu Admin'}</button>`:''}
          <button class="btn btn-g btn-sm" onclick="toggleRole2('${m.id}','${m.role2||''}')">Zusatzrolle</button>
          ${!isMe?`<button class="btn ${isActive?'btn-d':'btn-i'} btn-sm" onclick="toggleActive('${m.id}',${isActive})">${isActive?'Deaktivieren':'Aktivieren'}</button>`:''}
        </div>
      </div>`;}).join('')}`;
}

async function addCat(){
  const name=document.getElementById('new-cat-name').value.trim();
  const color=document.getElementById('new-cat-color').value;
  if(!name){T('Bitte Kategoriename eingeben','err');return;}
  const{error}=await SB.from('cal_categories').insert({name,color});
  if(error){T('Fehler: '+error.message,'err');return;}
  document.getElementById('new-cat-name').value='';
  await loadCategories();
  renderSettings('settings');
  T('Kategorie hinzugefügt','ok');
}
async function updateCatColor(id,color){
  await SB.from('cal_categories').update({color}).eq('id',id);
  await loadCategories();
  // Update color picker border to match new color
}
async function updateCatName(id,name){
  if(!name.trim())return;
  await SB.from('cal_categories').update({name:name.trim()}).eq('id',id);
  await loadCategories();
  T('Name gespeichert','ok');
}
async function deleteCat(id){if(!confirm('Kategorie löschen?'))return;await SB.from('cal_categories').delete().eq('id',id);renderSettings('settings');}
async function toggleMemberRole(id,role){const nr=role==='admin'?'member':'admin';if(!confirm(`Rolle zu "${nr==='admin'?'Admin':'Mitglied'}" wechseln?`))return;await SB.from('profiles').update({role:nr}).eq('id',id);renderSettings('members');T('Rolle geändert','ok');}
async function toggleRole2(id,current){const opts=['','dirigent','klavier','dirigent,klavier'];const labels=['Keine','Dirigent','Klavier','Dirigent & Klavier'];const cur=opts.indexOf(current);const next=(cur+1)%opts.length;await SB.from('profiles').update({role2:opts[next]||null}).eq('id',id);renderSettings('members');T(`Zusatzrolle: ${labels[next]}`,'ok');}
async function toggleActive(id,isActive){if(!confirm(isActive?'Mitglied deaktivieren?':'Mitglied aktivieren?'))return;await SB.from('profiles').update({active:!isActive}).eq('id',id);renderSettings('members');T(isActive?'Deaktiviert':'Aktiviert','ok');}

async function openAddMember(){['am-vname','am-nname','am-email','am-pass','am-phone'].forEach(id=>document.getElementById(id).value='');document.getElementById('am-stimme').value='';document.getElementById('am-role2').value='';openModal('m-add-member');}
async function addMember(){
  const vname=document.getElementById('am-vname').value.trim(),nname=document.getElementById('am-nname').value.trim(),email=document.getElementById('am-email').value.trim(),pass=document.getElementById('am-pass').value;
  if(!vname||!email||!pass){T('Vorname, E-Mail und Passwort erforderlich','err');return;}
  const name=(vname+' '+nname).trim();
  const stimme=document.getElementById('am-stimme').value,role2=document.getElementById('am-role2').value,phone=document.getElementById('am-phone').value.trim();
  const{data,error}=await SB.auth.signUp({email,password:pass,options:{data:{name,stimme,phone,role2}}});
  if(error){T('Fehler: '+error.message,'err');return;}
  if(data?.user)await SB.from('profiles').upsert({id:data.user.id,name,email,phone,stimme,role2,role:'member',active:true});
  closeModal('m-add-member');renderSettings('members');T('Mitglied hinzugefügt','ok');
}

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

