// ========== GLOBALS ==========
const SB_URL='https://nzgmznxwtvmjatbhbmcp.supabase.co';
const SB_KEY='sb_publishable_rTWG_fw_Us_yA4ZayeR9sw_glQ-rrP-';
let SB=null, currentUser=null, currentProfile=null;
let cachedSongs=[], cachedCategories=[], calView='3month', calDate=new Date();
let editSongId=null, editEvId=null, editCalId=null;
let songFilter={search:'',besetzung:'',thema:'',anlass:'',person:''};
let showAllSources=false;
let mediaFilter='all';

// ========== UTILS ==========
function T(msg,type=''){const t=document.getElementById('toast');t.textContent=msg;t.style.borderColor=type==='err'?'rgba(224,85,85,.4)':type==='ok'?'rgba(76,175,130,.4)':'';t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800);}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fD(d){if(!d)return'';const p=String(d).split('-');return p.length===3?`${p[2]}.${p[1]}.${p[0]}`:d;}
function fT(t){if(!t)return'';return String(t).substring(0,5);}
function today(){return new Date().toISOString().slice(0,10);}
function initials(name){const p=(name||'').split(' ');return((p[0]?.charAt(0)||'')+(p[1]?.charAt(0)||p[0]?.charAt(1)||'')).toUpperCase();}
function firstName(name){return(name||'').split(' ')[0]||name||'';}

// ========== NRW HOLIDAYS ==========
function getNRWHolidays(year){
  // Fixed holidays
  const fixed=[['01-01','Neujahr'],['05-01','Tag der Arbeit'],['10-03','Tag der Deutschen Einheit'],['11-01','Allerheiligen'],['12-25','1. Weihnachtstag'],['12-26','2. Weihnachtstag']];
  // Easter calculation (Gauss)
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),easter=new Date(year,Math.floor((h+l-7*m+114)/31)-1,(h+l-7*m+114)%31+1);
  function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r;}
  function fmt(d){return`${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  const movable=[[addDays(easter,-2),'Karfreitag'],[addDays(easter,0),'Ostersonntag'],[addDays(easter,1),'Ostermontag'],[addDays(easter,39),'Christi Himmelfahrt'],[addDays(easter,49),'Pfingstsonntag'],[addDays(easter,50),'Pfingstmontag'],[addDays(easter,60),'Fronleichnam']];
  const result={};
  fixed.forEach(([d,n])=>result[`${year}-${d}`]=n);
  movable.forEach(([d,n])=>result[`${year}-${fmt(d)}`]=n);
  return result;
}

function getNRWSchoolHolidays(year){
  const h=[];
  if(year===2025){
    h.push({from:'2025-01-01',to:'2025-01-03',name:'🏫 Weihnachtsferien'});
    h.push({from:'2025-03-24',to:'2025-04-05',name:'🐣 Osterferien'});
    h.push({from:'2025-06-23',to:'2025-07-04',name:'☀️ Sommerferien'});
    h.push({from:'2025-10-06',to:'2025-10-17',name:'🍂 Herbstferien'});
    h.push({from:'2025-12-22',to:'2026-01-05',name:'🎄 Weihnachtsferien'});
  } else if(year===2026){
    h.push({from:'2026-01-01',to:'2026-01-05',name:'🎄 Weihnachtsferien'});
    h.push({from:'2026-03-30',to:'2026-04-11',name:'🐣 Osterferien'});
    h.push({from:'2026-06-22',to:'2026-08-04',name:'☀️ Sommerferien'});
    h.push({from:'2026-10-05',to:'2026-10-17',name:'🍂 Herbstferien'});
    h.push({from:'2026-12-23',to:'2027-01-06',name:'🎄 Weihnachtsferien'});
  }
  return h;
}

// Returns map of date->ferienname for all days within school holiday ranges
function getSchoolHolidayDays(year){
  const result={};
  // Include holidays that might overlap from prev/next year
  const holidays=[...getNRWSchoolHolidays(year-1),...getNRWSchoolHolidays(year),...getNRWSchoolHolidays(year+1)];
  holidays.forEach(({from,to,name})=>{
    let d=new Date(from);const end=new Date(to);
    while(d<=end){
      const ds=d.toISOString().slice(0,10);
      if(ds.startsWith(String(year)))result[ds]=name;
      d.setDate(d.getDate()+1);
    }
  });
  return result;
}

// ========== AUTH ==========
async function doLogin(){
  const e=document.getElementById('l-email').value.trim();
  const p=document.getElementById('l-pass').value;
  const err=document.getElementById('l-err');err.style.display='none';
  const{data,error}=await SB.auth.signInWithPassword({email:e,password:p});
  if(error){err.textContent=error.message;err.style.display='block';return;}
  await loadProfile(data.user);
  if(currentProfile?.active===false){await SB.auth.signOut();currentUser=null;currentProfile=null;err.textContent='Konto deaktiviert. Bitte Admin kontaktieren.';err.style.display='block';return;}
  startApp();
}
async function doLogout(){await SB.auth.signOut();currentUser=null;currentProfile=null;document.getElementById('app').style.display='none';document.getElementById('login-screen').style.display='flex';}
async function loadProfile(user){currentUser=user;const{data}=await SB.from('profiles').select('*').eq('id',user.id).single();currentProfile=data;}

