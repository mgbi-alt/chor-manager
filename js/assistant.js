// ========== KI ASSISTENT ==========
let astState={mode:null,pendingEvent:null,pendingMatches:[],pendingSong:null};

function openAssistant(){
  astState={mode:null,pendingEvent:null,pendingMatches:[],pendingSong:null};
  document.getElementById('ast-msgs').innerHTML='';
  document.getElementById('ast-actions').style.display='none';
  document.getElementById('ast-input').value='';
  astBot('Hallo! Ich helfe dir.\n\nMoeglichkeiten:\n- Programm eingeben (Datum, Lieder, Predigten)\n- "Neues Lied: Titel von Komponist"\n- PDF hochladen (Noten/Liedblatt) - ich lese Liedinformationen aus\n\nWie kann ich helfen?');
  openModal('m-assistant');
}

async function handleAstFiles(evt){
  const files=[...evt.target.files];evt.target.value='';
  for(const f of files){astUser('Datei: '+f.name);await processAstFile(f);}
}

async function processAstFile(file){
  astBot('Lese "'+file.name+'"...');
  let text='';
  try{
    if(file.name.toLowerCase().endsWith('.pdf')){text=await extractPdfText(file);}
    else{const buf=await file.arrayBuffer();for(const enc of['utf-8','windows-1252']){try{const t=new TextDecoder(enc,{fatal:true}).decode(buf);text=t;break;}catch(e){}}}
    if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  }catch(e){astBot('Fehler beim Lesen: '+e.message);return;}
  if(!text.trim()){astBot('Konnte keinen Text lesen. Gescannte PDFs (Bilder) werden nicht unterstuetzt.');return;}
  const lines=text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l);
  console.log('PDF lines[0..8]:',lines.slice(0,8));
  const hasSongMeta=lines.filter(l=>/komponist|textdichter|arrangeur|besetzung|satb|ttbb|copyright|ccli|lizenz/i.test(l)).length>=1;
  const hasProgram=lines.some(l=>/^\d{1,2}\.\d{1,2}\./.test(l));
  if(hasProgram&&!hasSongMeta){document.getElementById('ast-input').value=lines.join('\n');astBot('Programm erkannt. Druecke Enter um es zu verarbeiten.');}
  else{await processSongInfoPdf(lines,file.name);}
}

async function extractPdfText(file){
  const buf=await file.arrayBuffer();
  const bytes=new Uint8Array(buf);

  // Decompress deflate streams in the PDF using DecompressionStream API
  async function inflateStream(data){
    try{
      const ds=new DecompressionStream('deflate');
      const writer=ds.writable.getWriter();
      const reader=ds.readable.getReader();
      writer.write(data);writer.close();
      const chunks=[];
      while(true){const{done,value}=await reader.read();if(done)break;chunks.push(value);}
      const total=chunks.reduce((n,c)=>n+c.length,0);
      const out=new Uint8Array(total);let off=0;
      chunks.forEach(c=>{out.set(c,off);off+=c.length;});
      return out;
    }catch{return null;}
  }
  async function inflateRaw(data){
    try{
      const ds=new DecompressionStream('deflate-raw');
      const writer=ds.writable.getWriter();
      const reader=ds.readable.getReader();
      writer.write(data);writer.close();
      const chunks=[];
      while(true){const{done,value}=await reader.read();if(done)break;chunks.push(value);}
      const total=chunks.reduce((n,c)=>n+c.length,0);
      const out=new Uint8Array(total);let off=0;
      chunks.forEach(c=>{out.set(c,off);off+=c.length;});
      return out;
    }catch{return null;}
  }

  // Find all stream...endstream blocks and try to decompress them
  let allText='';
  const raw=new TextDecoder('latin1').decode(bytes);

  // Find stream positions
  let pos=0;
  const streamStarts=[];
  while((pos=raw.indexOf('stream',pos))!==-1){
    // Skip 'stream' + newline
    let start=pos+6;
    if(raw[start]==='\r')start++;
    if(raw[start]==='\n')start++;
    const end=raw.indexOf('endstream',start);
    if(end===-1){pos++;continue;}
    streamStarts.push({start,end});
    pos=end+9;
  }

  for(const{start,end} of streamStarts){
    const streamData=bytes.slice(start,end);
    // Try deflate variants
    let decoded=await inflateStream(streamData)||await inflateRaw(streamData);
    let text='';
    if(decoded){
      text=new TextDecoder('latin1',{fatal:false}).decode(decoded);
    } else {
      // Not compressed – use as-is
      text=new TextDecoder('latin1',{fatal:false}).decode(streamData);
    }
    // Extract text from BT...ET blocks
    const btEtRe=/BT\s([\s\S]*?)ET/g;
    let m;
    while((m=btEtRe.exec(text))!==null){
      const block=m[1];
      const strRe=/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let sm;let line='';
      while((sm=strRe.exec(block))!==null){
        line+=sm[1]
          .replace(/\\n/g,' ').replace(/\\r/g,' ').replace(/\\t/g,' ')
          .replace(/\\\(/g,'(').replace(/\\\)/g,')').replace(/\\\\/g,'\\')
          .replace(/\\(\d{3})/g,(_,o)=>String.fromCharCode(parseInt(o,8)));
      }
      if(line.trim())allText+=line.trim()+'\n';
    }
    // Also look for hex strings <...> in BT blocks
    const hexRe=/BT\s([\s\S]*?)ET/g;
    while((m=hexRe.exec(text))!==null){
      const hexStrRe=/<([0-9A-Fa-f\s]+)>/g;
      let hm;let hexLine='';
      while((hm=hexStrRe.exec(m[1]))!==null){
        const h=hm[1].replace(/\s/g,'');
        for(let i=0;i<h.length;i+=2){
          const code=parseInt(h.substr(i,2),16);
          if(code>31&&code<127)hexLine+=String.fromCharCode(code);
        }
      }
      if(hexLine.trim())allText+=hexLine.trim()+'\n';
    }
  }

  // Also extract /Title, /Author, /Subject from PDF metadata
  const metaRe=/\/(?:Title|Author|Subject|Keywords)\s*\(([^)]+)\)/g;
  let mm;
  while((mm=metaRe.exec(raw))!==null){
    allText+=mm[1].trim()+'\n';
  }

  console.log('PDF extracted ('+allText.length+' chars):', allText.slice(0,300));
  return allText;
}


async function processSongInfoPdf(lines,filename){
  const song={title:'',liedanfang:'',komponist:'',komponist_lz:'',textdichter:'',textdichter_lz:'',arrangeur:'',arrangeur_lz:'',besetzung:'',rechte:'',lizenz:'',links:[],created_by:currentUser.id};
  const patterns=[
    {f:'title',re:/^(?:titel|title):?\s*(.+)/i},
    {f:'liedanfang',re:/^(?:liedanfang|anfang):?\s*(.+)/i},
    {f:'komponist',re:/^(?:komponist|musik|music|composed?\s*by|melody):?\s*(.+)/i},
    {f:'textdichter',re:/^(?:textdichter|text|words?\s*by|lyrics?):?\s*(.+)/i},
    {f:'arrangeur',re:/^(?:arrangeur|arr\.?):?\s*(.+)/i},
    {f:'besetzung',re:/^(?:besetzung|voicing|stimmen):?\s*(.+)/i},
    {f:'rechte',re:/^(?:copyright|[\u00a9\(c\)]):?\s*(.+)/i},
    {f:'lizenz',re:/^(?:lizenz|ccli|license):?\s*(.+)/i},
  ];
  const lzRe=/(\d{4})\s*[-\u2013\u2014]\s*(\d{4}|\?)/;
  for(const line of lines){
    for(const{f,re} of patterns){
      const m=line.match(re);
      if(m&&m[1]&&!song[f]){
        song[f]=m[1].trim();
        const lzm=m[1].match(lzRe);
        if(lzm&&f+'_lz' in song){song[f+'_lz']=lzm[1]+'-'+lzm[2];song[f]=song[f].replace(lzRe,'').trim();}
        break;
      }
    }
  }
  if(!song.title&&!song.liedanfang){const fl=lines.find(l=>l.length>2&&l.length<100&&!/^[\d\.]/.test(l));if(fl){song.title=fl;song.liedanfang=fl;}}
  if(!song.title)song.title=song.liedanfang;
  if(!song.liedanfang)song.liedanfang=song.title;
  const songs=cachedSongs.length?cachedSongs:(await SB.from('songs').select('*').then(r=>r.data||[]));
  const existing=songs.find(s=>normStr(s.liedanfang||s.title||'')===normStr(song.liedanfang||song.title||''));
  let msg='Aus "'+filename+'" erkannt:\n\n';
  msg+=(song.title||song.liedanfang||'Unbekannt')+'\n';
  if(song.komponist)msg+='- Komponist: '+song.komponist+(song.komponist_lz?' ('+song.komponist_lz+')':'')+'\n';
  if(song.textdichter)msg+='- Textdichter: '+song.textdichter+(song.textdichter_lz?' ('+song.textdichter_lz+')':'')+'\n';
  if(song.arrangeur)msg+='- Arrangeur: '+song.arrangeur+'\n';
  if(song.besetzung)msg+='- Besetzung: '+song.besetzung+'\n';
  if(song.rechte)msg+='- Rechte: '+song.rechte+'\n';
  if(song.lizenz)msg+='- Lizenz: '+song.lizenz+'\n';
  if(existing){
    const canUpdate=Object.entries(song).filter(([k,v])=>v&&typeof v==='string'&&!['title','links','created_by'].includes(k)&&!existing[k]);
    if(canUpdate.length){
      msg+='\nLied bereits vorhanden. Fehlende Infos ergaenzen:\n'+canUpdate.map(([k,v])=>'- '+k+': '+v).join('\n');
      astBot(msg);astState.pendingSong={_id:existing.id,...Object.fromEntries(canUpdate)};astState.mode='update_song';
      astShowActions([{label:'Infos ergaenzen',fn:'updateExistingSong()'},{label:'Abbrechen',fn:"astState.mode=null;astClearActions();"}]);
    } else {msg+='\nAlles bereits vorhanden.';astBot(msg);}
  } else {
    msg+='\nSoll ich es ins Repertoire aufnehmen?';astBot(msg);
    astState.pendingSong=song;astState.mode='confirm_song';
    astShowActions([{label:'Aufnehmen',fn:'confirmAddSong()'},{label:'Abbrechen',fn:"astState.mode=null;astClearActions();"}]);
  }
}

async function updateExistingSong(){
  if(!astState.pendingSong?._id)return;
  const{_id,...fields}=astState.pendingSong;
  const{error}=await SB.from('songs').update(fields).eq('id',_id);
  if(error){astBot('Fehler: '+error.message);return;}
  const{data:ns}=await SB.from('songs').select('*').order('liedanfang',{nullsFirst:false});if(ns)cachedSongs=ns;
  astBot('Lied aktualisiert!');astState.mode=null;astClearActions();T('Aktualisiert','ok');
}


function astAddMsg(role,html){
  const el=document.getElementById('ast-msgs');
  const d=document.createElement('div');
  d.className='ast-msg '+role;
  d.innerHTML='<div class="ast-bbl">'+html+'</div>';
  el.appendChild(d);el.scrollTop=el.scrollHeight;
}
function astBot(txt){astAddMsg('bot',txt.replace(/\n/g,'<br>'));}
function astUser(txt){astAddMsg('user',esc(txt));}
function astShowActions(buttons){
  const el=document.getElementById('ast-actions');
  el.style.display='';
  el.innerHTML=buttons.map(b=>'<button class="btn btn-g btn-sm" style="margin:3px" onclick="'+b.fn+'">'+esc(b.label)+'</button>').join('');
}
function astClearActions(){const el=document.getElementById('ast-actions');if(el){el.style.display='none';el.innerHTML='';}}

async function sendAssistant(){
  const inp=document.getElementById('ast-input');
  const text=inp.value.trim();if(!text)return;
  inp.value='';inp.style.minHeight='38px';
  astHideSuggest();
  astUser(text);astClearActions();
  await processAssistant(text);
}

let _astSuggestIdx=-1;

function astKeyDown(e){
  const sug=document.getElementById('ast-suggest');
  const items=sug?.querySelectorAll('.ast-sug-item')||[];
  if(sug&&sug.style.display!=='none'&&items.length){
    if(e.key==='ArrowDown'){e.preventDefault();_astSuggestIdx=Math.min(_astSuggestIdx+1,items.length-1);items.forEach((el,i)=>el.classList.toggle('active',i===_astSuggestIdx));items[_astSuggestIdx]?.scrollIntoView({block:'nearest'});return;}
    if(e.key==='ArrowUp'){e.preventDefault();_astSuggestIdx=Math.max(_astSuggestIdx-1,0);items.forEach((el,i)=>el.classList.toggle('active',i===_astSuggestIdx));items[_astSuggestIdx]?.scrollIntoView({block:'nearest'});return;}
    if(e.key==='Tab'||e.key==='Enter'&&_astSuggestIdx>=0){e.preventDefault();items[Math.max(_astSuggestIdx,0)]?.click();return;}
    if(e.key==='Escape'){astHideSuggest();return;}
  }
  if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();astHideSuggest();sendAssistant();}
}

function astInputChanged(ta){
  const val=ta.value;
  // Get current line being typed
  const lines=val.split('\n');
  const curLine=lines[lines.length-1];
  // Check if we're on a field line: "Feldname: partialValue"
  const fieldMatch=curLine.match(/^(\w[\w\s\.]*?):\s*(.*)$/);
  if(!fieldMatch||fieldMatch[2].length<1){astHideSuggest();return;}
  const query=fieldMatch[2].trim().toLowerCase();
  const fieldName=fieldMatch[1].toLowerCase();
  // Determine what to search
  let candidates=[];
  const songs=cachedSongs;
  if(/komponist|komp|k\./i.test(fieldName)){candidates=[...new Set(songs.map(s=>s.komponist).filter(Boolean))];}
  else if(/textdichter|text|t\./i.test(fieldName)){candidates=[...new Set(songs.map(s=>s.textdichter).filter(Boolean))];}
  else if(/arrangeur|arr/i.test(fieldName)){candidates=[...new Set(songs.map(s=>s.arrangeur).filter(Boolean))];}
  else if(/uebersetzer|übersetzer|übers/i.test(fieldName)){candidates=[...new Set(songs.map(s=>s.uebersetzer).filter(Boolean))];}
  else if(/liedanfang|anfang/i.test(fieldName)){candidates=[...new Set(songs.map(s=>s.liedanfang).filter(Boolean))];}
  else if(/^titel|^title/i.test(fieldName)){candidates=[...new Set(songs.map(s=>s.title).filter(Boolean))];}
  else if(/originaltitel/i.test(fieldName)){candidates=[...new Set(songs.map(s=>s.originaltitel).filter(Boolean))];}
  else if(/besetzung|voicing/i.test(fieldName)){candidates=['SATB','TTBB','SSA','SAB','SSAA','Gemischter Chor','Männerchor','Frauenchor'];}
  else{astHideSuggest();return;}
  // Filter candidates
  const matches=candidates.filter(c=>c.toLowerCase().includes(query)).slice(0,8);
  if(!matches.length){astHideSuggest();return;}
  astShowSuggest(matches,fieldMatch[1]+': ',lines,val);
}

function astShowSuggest(matches,prefix,lines,fullVal){
  const sug=document.getElementById('ast-suggest');
  _astSuggestIdx=-1;
  sug.innerHTML=matches.map((m,i)=>`<div class="ast-sug-item" style="padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:0.5px solid var(--border)" onmousedown="event.preventDefault();astSelectSuggest('${esc(prefix)}','${esc(m)}')" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background=''">${esc(m)}</div>`).join('');
  sug.style.display='';
  // Store context for selection
  sug._prefix=prefix;sug._lines=lines;sug._fullVal=fullVal;
}

function astSelectSuggest(prefix,value){
  const ta=document.getElementById('ast-input');
  const lines=ta.value.split('\n');
  // Replace last line with completed value
  lines[lines.length-1]=prefix+value;
  // Auto-fill lebensdaten on the NEXT line if it's a lz field and still empty
  const lzFieldMap={
    'Komponist: ':'Komp. Lebensdaten: ',
    'Textdichter: ':'Text. Lebensdaten: ',
    'Arrangeur: ':'Arr. Lebensdaten: ',
    'Übersetzer: ':'Übers. Lebensdaten: ',
  };
  const lzPrefix=lzFieldMap[prefix];
  const lz=personLzMap[value.toLowerCase()];
  if(lz&&lzPrefix){
    // Find next lz line in template and fill it
    for(let i=lines.length;i<lines.length+5;i++){
      if(lines[i]&&lines[i].startsWith(lzPrefix)&&!lines[i].slice(lzPrefix.length).trim()){
        lines[i]=lzPrefix+lz;break;
      }
    }
  }
  ta.value=lines.join('\n');
  astHideSuggest();ta.focus();
  const pos=ta.value.length;
  ta.setSelectionRange(pos,pos);
  // Show validation hint if name is new to repertoire
  if(['Komponist: ','Textdichter: ','Arrangeur: ','Übersetzer: '].includes(prefix)){
    const isKnown=personLzMap[value.toLowerCase()]||cachedSongs.some(s=>
      [s.komponist,s.textdichter,s.arrangeur,s.uebersetzer].some(n=>n===value));
    if(!isKnown){
      // Small hint – person not yet in repertoire
      const hint=document.createElement('div');
      hint.style.cssText='position:absolute;bottom:100%;right:0;background:rgba(232,160,32,.15);border:0.5px solid rgba(232,160,32,.4);border-radius:var(--r);padding:4px 10px;font-size:11px;color:var(--warn);margin-bottom:4px;white-space:nowrap;pointer-events:none;z-index:201';
      hint.textContent='⚠ Neu im Repertoire';
      ta.parentElement.appendChild(hint);
      setTimeout(()=>hint.remove(),2500);
    } else if(lz){
      const hint=document.createElement('div');
      hint.style.cssText='position:absolute;bottom:100%;right:0;background:rgba(76,175,130,.1);border:0.5px solid rgba(76,175,130,.3);border-radius:var(--r);padding:4px 10px;font-size:11px;color:var(--success);margin-bottom:4px;white-space:nowrap;pointer-events:none;z-index:201';
      hint.textContent=`✓ ${lz}`;
      ta.parentElement.appendChild(hint);
      setTimeout(()=>hint.remove(),2500);
    }
  }
}

function astHideSuggest(){
  const sug=document.getElementById('ast-suggest');
  if(sug)sug.style.display='none';
  _astSuggestIdx=-1;
}

function fuzzyMatch(query,target){
  const q=normStr(query),t=normStr(target);
  if(!q||!t)return false;
  if(t.includes(q)||q.includes(t))return true;
  const qw=q.split(' ').filter(w=>w.length>2);
  const tw=t.split(' ');
  const overlap=qw.filter(w=>tw.some(tw2=>tw2.includes(w)||w.includes(tw2)));
  return overlap.length>=Math.min(2,Math.max(1,qw.length-1));
}

function findSongs(query,songs){
  const q=normStr(query);
  const exact=songs.filter(s=>normStr(s.liedanfang||s.title||'')===q||normStr(s.title||'')===q);
  if(exact.length)return{type:'exact',matches:exact};
  const strong=songs.filter(s=>normStr(s.liedanfang||'').startsWith(q.split(' ')[0])||normStr(s.title||'').startsWith(q.split(' ')[0]));
  const fuzzy=songs.filter(s=>!strong.includes(s)&&(fuzzyMatch(q,s.liedanfang||'')||fuzzyMatch(q,s.title||'')));
  const all=[...strong,...fuzzy];
  if(!all.length)return{type:'notfound',matches:[]};
  if(all.length===1)return{type:'exact',matches:all};
  return{type:'ambiguous',matches:all.slice(0,4)};
}

function resolveInitials(initStr,members){
  if(!initStr)return'';
  const parts=initStr.trim().split(/[\s,]+/).filter(Boolean);
  return parts.map(init=>{
    const up=init.toUpperCase();
    const low=init.toLowerCase();
    // 1. Exact 2-letter initials: SF → Siegfried Frey
    if(/^[A-ZÜÖÄ]{2}$/.test(up)){
      const m=members.find(m=>{const np=m.name.split(' ');const ini=np.map(p=>p.charAt(0).toUpperCase()).join('');return ini===up;});
      if(m)return m.name;
    }
    // 2. First name match: "Max" → "Max Muster"
    const byFirst=members.find(m=>m.name.split(' ')[0].toLowerCase()===low);
    if(byFirst)return byFirst.name;
    // 3. Last name match: "Muster" → "Max Muster"
    const byLast=members.find(m=>m.name.split(' ').slice(-1)[0].toLowerCase()===low);
    if(byLast)return byLast.name;
    // 4. Partial name match (at least 3 chars)
    if(init.length>=3){
      const byPartial=members.find(m=>m.name.toLowerCase().includes(low));
      if(byPartial)return byPartial.name;
    }
    // Return as-is if no match
    return init;
  }).join(', ');
}

function parseProgramLine(line,members){
  const l=line.trim();
  const liedMatch=l.match(/^(?:lied|l\.?):?\s*(.+)/i);
  if(liedMatch){
    let rest=liedMatch[1].trim();
    const initialsMatch=rest.match(/^(.+?)\s+([A-ZÜÖÄ]{2,3}(?:[,\s]+[A-ZÜÖÄ]{2,3})*)\s*$/);
    let title=rest,dirigent='',klavier='';
    if(initialsMatch){
      title=initialsMatch[1].trim();
      const inits=initialsMatch[2].split(/[,\s]+/).filter(i=>i.length>=2);
      if(inits[0])dirigent=resolveInitials(inits[0],members);
      if(inits[1])klavier=resolveInitials(inits[1],members);
    }
    return{type:'lied',title,dirigent,klavier};
  }
  const predMatch=l.match(/^predigt\s*\d*:?\s*(.+)/i);
  if(predMatch){
    const parts=predMatch[1].split(/[,;]\s*/);
    return{type:'predigt',thema:parts[0]||'',bibel:parts.slice(1).join(', ')};
  }
  const sonstKeys=['einleitung','begruessung','begrü','gebet','ansage','kollekte','abendmahl','sonstiges','abkündigung'];
  if(sonstKeys.some(k=>normStr(l).includes(normStr(k)))){return{type:'sonstiges',name:l};}
  if(l.length>2&&l.length<80&&!/^\d+\./.test(l)){return{type:'lied',title:l,dirigent:'',klavier:''};}
  return null;
}

async function processAssistant(text){
  const songs=cachedSongs.length?cachedSongs:(await SB.from('songs').select('*').then(r=>r.data||[]));
  const{data:members}=await SB.from('profiles').select('name,role2').eq('active',true);
  const allMembers=members||[];

  if(astState.mode==='confirm_songs'){
    if(/^ja|ok|richtig|stimmt|yes|passt/i.test(text)){await createEventFromState();}
    else if(/^nein|no|falsch|anders/i.test(text)){astBot('Was soll ich anders zuordnen? Schreib z.B. "Zeile 2: Gott ist gut"');astState.mode=null;}
    else{astBot('Bitte antworte mit "Ja" oder "Nein".');}
    return;
  }
  if(astState.mode==='new_song'||astState.mode==='add_song'){
    // User filled in the template - parse it
    const songInfo=parseSongInput(text);
    // Auto-fill lebensdaten from existing songs
    const lzFields=[['komponist','komponist_lz'],['textdichter','textdichter_lz'],['arrangeur','arrangeur_lz'],['uebersetzer','uebersetzer_lz']];
    lzFields.forEach(([nameKey,lzKey])=>{
      const name=(songInfo[nameKey]||'').toLowerCase().trim();
      if(name&&!songInfo[lzKey]&&personLzMap[name])songInfo[lzKey]=personLzMap[name];
    });
    // Validate names against known persons (warn if not found)
    const personFields=['komponist','textdichter','arrangeur','uebersetzer'];
    const unknownPersons=personFields.filter(f=>songInfo[f]&&!personLzMap[songInfo[f].toLowerCase().trim()]&&!cachedSongs.some(s=>s[f]===songInfo[f]));
    // Show preview
    const fields=[
      ['Liedanfang',songInfo.liedanfang],
      ['Titel',songInfo.title&&songInfo.title!==songInfo.liedanfang?songInfo.title:''],
      ['Originaltitel',songInfo.originaltitel],
      ['Komponist',songInfo.komponist+(songInfo.komponist_lz?' ('+songInfo.komponist_lz+')':'')],
      ['Textdichter',songInfo.textdichter+(songInfo.textdichter_lz?' ('+songInfo.textdichter_lz+')':'')],
      ['Arrangeur',songInfo.arrangeur+(songInfo.arrangeur_lz?' ('+songInfo.arrangeur_lz+')':'')],
      ['Übersetzer',songInfo.uebersetzer+(songInfo.uebersetzer_lz?' ('+songInfo.uebersetzer_lz+')':'')],
      ['Besetzung',songInfo.besetzung],
      ['Rechte',songInfo.rechte],
    ].filter(([,v])=>v);
    let preview=fields.length
      ?'Lied anlegen:\n'+fields.map(([k,v])=>`• ${k}: ${v}`).join('\n')
      :'Ich konnte keine Felder erkennen. Bitte die Vorlage ausfüllen.';
    if(unknownPersons.length)preview+=`\n\n⚠️ Unbekannte Personen (neu im Repertoire):\n${unknownPersons.map(f=>`• ${songInfo[f]}`).join('\n')}`;
    preview+='\n\nSoll ich es aufnehmen?';
    astBot(preview);
    if(fields.length){
      astState.pendingSong=songInfo;astState.mode='confirm_song';
      astShowActions([{label:'✓ Ja, aufnehmen',fn:'confirmAddSong()'},{label:'✗ Abbrechen',fn:"astState.mode=null;astClearActions();"}]);
    }
    return;
  }
  if(astState.mode==='confirm_song'){
    if(/^ja|ok|yes/i.test(text)){await confirmAddSong();}
    else{astBot('Abgebrochen.');astState.mode=null;}
    return;
  }

  if(/neues?\s+lied|lied\s+(hinzuf|anlegen)/i.test(text)){
    const template=`Liedanfang: 
Titel: 
Komponist: 
Textdichter: 
Arrangeur: 
Übersetzer: 
Originaltitel: 
Besetzung: 
Rechte: `;
    astBot('Fülle die Felder aus (leere Felder einfach leer lassen) und schicke es ab:');
    // Put template in input field so user can edit it
    const inp=document.getElementById('ast-input');
    inp.value=template;inp.focus();
    inp.style.minHeight='220px';
    astState.mode='new_song';return;
  }

  const lines=text.split(/\n/).map(l=>l.trim()).filter(l=>l);
  let eventDate=null,eventTitle='Chor';
  const dateLine=lines[0]?.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\s*(.*)/);
  if(dateLine){
    let y=dateLine[3]?parseInt(dateLine[3]):new Date().getFullYear();if(y<100)y+=2000;
    eventDate=y+'-'+dateLine[2].padStart(2,'0')+'-'+dateLine[1].padStart(2,'0');
    eventTitle=dateLine[4]||'Chor';lines.shift();
  }
  const parsed=[];
  for(const line of lines){const p=parseProgramLine(line,allMembers);if(p)parsed.push({...p,original:line});}
  if(!parsed.length){
    astBot('Kein Programm erkannt.\n\nBeispiel:\n21.05.2026 Chor\nLied: Du bist da SF LB\nPredigt: Gottes Liebe, Joh 3,16\nEinleitung');
    return;
  }
  const matchResults=[];
  for(const item of parsed){
    if(item.type==='lied'){const r=findSongs(item.title,songs);matchResults.push({...item,matchType:r.type,matches:r.matches});}
    else matchResults.push({...item,matchType:'special'});
  }
  astState.pendingMatches=matchResults;
  astState.pendingEvent={datum:eventDate,title:eventTitle,ort:'Bielefeld',uhrzeit:'10:00'};
  astState.mode='confirm_songs';

  let msg=eventDate?'Datum: '+fD(eventDate)+' – '+eventTitle+'\n\n':'';
  msg+='Habe ich alles richtig erkannt?\n\n';
  matchResults.forEach((m,i)=>{
    const pos=i+1;
    if(m.type==='lied'){
      if(m.matchType==='exact'){
        const s=m.matches[0];msg+=pos+'. ✅ "'+m.title+'" → '+(s.liedanfang||s.title);
        if(m.dirigent)msg+=' (Dir: '+m.dirigent+')';
        if(m.klavier)msg+=' (Kl: '+m.klavier+')';
        msg+='\n';
      } else if(m.matchType==='ambiguous'){
        msg+=pos+'. ❓ "'+m.title+'" – welches?\n';
        m.matches.forEach((s,j)=>{msg+='   '+(j+1)+') '+(s.liedanfang||s.title)+'\n';});
      } else {
        msg+=pos+'. ❌ "'+m.title+'" – nicht im Repertoire\n';
      }
    } else if(m.type==='predigt'){
      msg+=pos+'. 🎤 Predigt: '+m.thema+(m.bibel?' ('+m.bibel+')':'')+'\n';
    } else {
      msg+=pos+'. ✦ '+m.name+'\n';
    }
  });
  msg+='\nJa = anlegen, Nein = korrigieren';
  astBot(msg);
  const hasNotFound=matchResults.some(m=>m.matchType==='notfound');
  const btns=[{label:'✓ Ja, anlegen',fn:'sendAssistantYes()'}];
  if(hasNotFound)btns.push({label:'+ Fehlende ins Repertoire',fn:'addMissingToRepertoire()'});
  btns.push({label:'✗ Abbrechen',fn:"astState.mode=null;astClearActions();"});
  astShowActions(btns);
}

function sendAssistantYes(){astClearActions();astUser('Ja');createEventFromState();}

async function confirmAddSong(){
  if(!astState.pendingSong)return;
  const{error}=await SB.from('songs').insert({...astState.pendingSong,created_by:currentUser.id});
  if(error){astBot('Fehler: '+error.message);return;}
  const{data:ns}=await SB.from('songs').select('*').order('liedanfang',{nullsFirst:false});
  if(ns)cachedSongs=ns;
  astBot('✓ Lied wurde ins Repertoire aufgenommen!');
  astState.mode=null;astClearActions();T('Lied hinzugefügt','ok');
}

async function addMissingToRepertoire(){
  astClearActions();
  const missing=astState.pendingMatches.filter(m=>m.matchType==='notfound');
  astBot('Fehlende Lieder:\n'+missing.map(m=>'• "'+m.title+'"').join('\n')+'\n\nGib zuerst für "'+missing[0].title+'" die Infos ein (oder schreib "überspringen"):');
  astState._missingQueue=[...missing];astState._missingIdx=0;astState.mode='fill_missing';
}

async function createEventFromState(){
  astClearActions();
  const ev=astState.pendingEvent;const matches=astState.pendingMatches;
  let evId=null;
  const{data:newEv,error}=await SB.from('events').insert({title:ev.title||'Chor',datum:ev.datum,uhrzeit:ev.uhrzeit,ort:ev.ort,created_by:currentUser.id}).select().single();
  if(error){astBot('Fehler: '+error.message);return;}
  evId=newEv.id;
  const prog=matches.map((m,i)=>{
    if(m.type==='predigt')return{event_id:evId,position:i+1,song_id:null,placeholder:'[Predigt] '+m.thema+'|'+m.prediger+'|'+m.bibel};
    if(m.type==='sonstiges')return{event_id:evId,position:i+1,song_id:null,placeholder:'[Sonstiges] '+m.name+'|'};
    if(m.matchType==='exact'||m.matchType==='ambiguous'){const s=m.matches[0];return{event_id:evId,position:i+1,song_id:s.id,dirigent:m.dirigent||'',klavier:m.klavier||'',placeholder:null};}
    return{event_id:evId,position:i+1,song_id:null,placeholder:m.title};
  });
  if(prog.length)await SB.from('event_program').insert(prog);
  astBot('✅ Veranstaltung'+(ev.datum?' vom '+fD(ev.datum):'')+' angelegt!\n'+prog.length+' Programmpunkte eingetragen.');
  astState={mode:null,pendingEvent:null,pendingMatches:[],pendingSong:null};
  renderEvents();
  astShowActions([{label:'Fertig',fn:"closeModal('m-assistant')"},{label:'Weiteres anlegen',fn:"document.getElementById('ast-input').focus();astClearActions();"}]);
}

function parseSongInput(text){
  const song={title:'',liedanfang:'',originaltitel:'',komponist:'',komponist_lz:'',textdichter:'',textdichter_lz:'',arrangeur:'',arrangeur_lz:'',uebersetzer:'',uebersetzer_lz:'',besetzung:'',rechte:'',lizenz:'',links:[],created_by:currentUser.id};
  const fieldMap=[
    {re:/^(?:liedanfang|anfang|la\.?)/i,        field:'liedanfang'},
    {re:/^(?:titel|title)$/i,                     field:'title'},
    {re:/^(?:originaltitel|orig\.?)/i,           field:'originaltitel'},
    {re:/^(?:komp(?:onist)?\.?\s*lebensdaten|kl\.?)/i, field:'komponist_lz'},
    {re:/^(?:komponist|komp\.?|k\.?|musik|composer)/i,  field:'komponist'},
    {re:/^(?:text(?:dichter)?\.?\s*lebensdaten|tl\.?)/i,field:'textdichter_lz'},
    {re:/^(?:textdichter|text\.?|t\.?(?!itel)|dichter|lyricist)/i, field:'textdichter'},
    {re:/^(?:arr(?:angeur)?\.?\s*lebensdaten|al\.?)/i, field:'arrangeur_lz'},
    {re:/^(?:arrangeur|arr\.?)/i,                field:'arrangeur'},
    {re:/^(?:[üÜ]bers\.?\s*lebensdaten|ul\.?)/i, field:'uebersetzer_lz'},
    {re:/^(?:[üÜ]bersetzer|uebersetzer|[üÜ]bers\.?|transl\.?|[üÜ]bersetzer\/Deutscher\s+Text|deutscher\s+text)/i, field:'uebersetzer'},
    {re:/^(?:besetzung|voicing|stimmen)/i,        field:'besetzung'},
    {re:/^(?:rechte|copyright)/i,                 field:'rechte'},
    {re:/^(?:lizenz|ccli|license)/i,              field:'lizenz'},
  ];
  // Split on newlines only - commas inside values are allowed
  const inputLines=text.split(/\n/).map(l=>l.trim()).filter(l=>l);
  const unmatched=[];
  for(const line of inputLines){
    const colon=line.indexOf(':');
    if(colon<0){unmatched.push(line);continue;}
    const label=line.slice(0,colon).trim();
    const value=line.slice(colon+1).trim();
    if(!value)continue;
    let matched=false;
    for(const{re,field} of fieldMap){
      if(re.test(label)){if(!song[field])song[field]=value;matched=true;break;}
    }
    if(!matched)unmatched.push(line);
  }
  // Free-text fallback: "Titel von Komponist"
  if(!song.title&&!song.liedanfang&&unmatched.length){
    const first=unmatched[0].replace(/^neues?\s+lied:?\s*/i,'').trim();
    const vonM=first.match(/^(.+?)\s+von\s+(.+)/i);
    if(vonM&&!song.komponist){song.title=vonM[1].trim();song.liedanfang=song.title;song.komponist=vonM[2].trim();}
    else{song.title=first;song.liedanfang=first;}
  }
  if(!song.title)song.title=song.liedanfang;
  if(!song.liedanfang)song.liedanfang=song.title;
  return song;
}



