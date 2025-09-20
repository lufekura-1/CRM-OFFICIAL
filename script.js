const PERFIL_KEY = 'activePerfil';
function getPerfil(){ return localStorage.getItem(PERFIL_KEY) || 'Usuario Teste'; }
function activeProfile(){ const sel=document.getElementById('profileSelect'); return sel?sel.value:getPerfil(); }
function setActivePerfil(p){ localStorage.setItem(PERFIL_KEY, p); }
const prefix = () => `perfil:${activeProfile()}:`;
const getJSON = (k,d) => { try{ return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d }};
const setJSON = (k,v) => localStorage.setItem(k, JSON.stringify(v));
function getJSONForPerfil(perfil,key,fallback){
  const raw = localStorage.getItem(`perfil:${perfil}:${key}`);
  try { return raw ? JSON.parse(raw) : structuredClone(fallback); }
  catch { return structuredClone(fallback); }
}
function setJSONForPerfil(perfil,key,val){ localStorage.setItem(`perfil:${perfil}:${key}`, JSON.stringify(val)); }

const calKey = () => `${prefix()}calendar`;

const PROFILES = ['Exótica','Jorel Chicuta','Jorel Avenida','Administrador','Usuario Teste'];

const ALL_PROFILES = ['Exótica','Jorel Chicuta','Jorel Avenida','Administrador','Usuario Teste'];

const CLIENTES_REMOVIDOS = ['José','Joana do Carmo Pederal','Josélito Adams'];

// remove dados antigos do perfil "Teste"
(function purgeOldTestProfile(){
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith('perfil:Teste:') || k.startsWith('Teste:')) localStorage.removeItem(k);
  });
})();

(function hardResetOnce(){
  const k = 'RESET_2025_08_16_DONE';
  if(localStorage.getItem(k)) return;
  for(const p of ALL_PROFILES){
    localStorage.removeItem(`${p}:clients`);
    localStorage.removeItem(`${p}:calendar`);
  }
  localStorage.setItem(k,'1');
})();

function seedProfile(profile='Usuario Teste'){
  setJSONForPerfil(profile,'clientes',[]);
  setJSONForPerfil(profile,'calendar',[]);
  setJSONForPerfil(profile,'dashboard',{slots:Array(8).fill(null)});
}

function ensureProfileBoot(profile=currentProfile()){
  profile = profile || 'Usuario Teste';
  if(!ALL_PROFILES.includes(profile)) profile='Usuario Teste';
  const clientes=getJSONForPerfil(profile,'clientes',null);
  const calendario=getJSONForPerfil(profile,'calendar',null);
  const dashboard=getJSONForPerfil(profile,'dashboard',null);
  if(!Array.isArray(clientes) || !Array.isArray(calendario) || !dashboard || !Array.isArray(dashboard.slots)){
    seedProfile(profile);
  }
}

function currentProfile(){ return activeProfile(); }
function getClients(profile=currentProfile()){ return getJSON(`${profile}:clients`, getJSON(`perfil:${profile}:clientes`, [])); }
function setClients(arr, profile=currentProfile()){ setJSON(`${profile}:clients`, arr); setJSON(`perfil:${profile}:clientes`, arr); }
function getCalendar(profile=currentProfile()){ return getJSON(`${profile}:calendar`, getJSON(`perfil:${profile}:calendar`, [])); }
function setCalendar(arr, profile=currentProfile()){ setJSON(`${profile}:calendar`, arr); setJSON(`perfil:${profile}:calendar`, arr); }

function getProfileInfo(profile=currentProfile()){
  return getJSON(`perfil:${profile}:info`, { nome:'', telefone:'', endereco:'', instagram:'', logo:'' });
}

function getUserPhoto(profile=currentProfile()){
  return getJSON(`perfil:${profile}:userPhoto`, { src:'', x:50, y:50 });
}
function setUserPhoto(data, profile=currentProfile()){
  setJSON(`perfil:${profile}:userPhoto`, data);
}

// remove eventos cujo meta.clientId não existe mais
function purgeOrphanEvents(profile=currentProfile()){
  const cliIdx = new Set(getClients(profile).map(c=>c.id));
  const cal = getCalendar(profile);
  const filtered = cal.filter(ev => {
    const cid = ev.meta?.clientId ?? ev.meta?.clienteId;
    return !cid || cliIdx.has(cid);
  });
  if(filtered.length !== cal.length) setCalendar(filtered, profile);
}

function deleteClient(clientId, profile=currentProfile()){
  const list = getClients(profile).filter(c=>c.id!==clientId);
  setClients(list, profile);
  const cal = getCalendar(profile).filter(ev => {
    const cid = ev.meta?.clientId ?? ev.meta?.clienteId;
    return cid !== clientId;
  });
  setCalendar(cal, profile);
  window.renderClientsTable?.(); renderCalendarMonth?.(); renderDashboard?.();
}

function deletePurchase(purchaseId, clientId, profile=currentProfile()){
  const clients = getClients(profile);
  const idx = clients.findIndex(c=>c.id===clientId);
  if(idx<0) return;
  const compras = clients[idx].compras||[];
  clients[idx].compras = compras.filter(p=>p.id!==purchaseId);
  setClients(clients, profile);
  const cal = getCalendar(profile).filter(ev => ev.meta?.purchaseId !== purchaseId);
  setCalendar(cal, profile);
  window.renderClientsTable?.();
  renderCalendarMonth?.();
  renderDashboard?.();
  renderSelectedPurchaseDetails?.();
}

(function purgeSpecificClients(){
  for(const profile of ALL_PROFILES){
    const clients = getClients(profile);
    const toRemove = clients.filter(c => CLIENTES_REMOVIDOS.includes(c.nome));
    if(!toRemove.length) continue;
    const remaining = clients.filter(c => !CLIENTES_REMOVIDOS.includes(c.nome));
    setClients(remaining, profile);
    const removedIds = new Set(toRemove.map(c=>c.id));
    const cal = getCalendar(profile).filter(ev => {
      const cid = ev.meta?.clientId ?? ev.meta?.clienteId;
      return !removedIds.has(cid);
    });
    setCalendar(cal, profile);
    const stateKey = `app:${profile}`;
    const state = getJSON(stateKey, {});
    if(Array.isArray(state.lembretes)){
      state.lembretes = state.lembretes.filter(l => !removedIds.has(l.clienteId));
      localStorage.setItem(stateKey, JSON.stringify(state));
    }
  }
})();

function on(el, ev, fn){ el && (el._h?.[ev] && el.removeEventListener(ev, el._h[ev]), (el._h=el._h||{}, el._h[ev]=fn), el.addEventListener(ev, fn)); }

function bindOnce(el, ev, fn){
  if(!el) return;
  if(el.__b && el.__b[ev]) el.removeEventListener(ev, el.__b[ev]);
  el.__b = el.__b||{}; el.__b[ev]=fn; el.addEventListener(ev, fn);
}

function safeAttr(el, name, value){ if(el) el.setAttribute(name, value); }
function qs(base, sel){ return (base||document).querySelector(sel); }

function toast(msg){ ui?.toast ? ui.toast(msg) : console.log(msg); }

on(document.getElementById('btnNovoContato'), 'click', e => { e.preventDefault(); openContactModalForSelected?.(); });

let calendarMonthRenderer = null;

function renderCalendarMonth(date){
  purgeOrphanEvents();
  if (typeof calendarMonthRenderer === 'function') {
    calendarMonthRenderer(date);
  }
}

const DASHBOARD_SLOT_LIMIT = 4; // Ajuste: limita a quantidade de slots visíveis no dashboard
const DEFAULT_DASHBOARD_SLOTS = [
  { id:'widget.clientsCount', size:'1x1' },
  { id:'widget.followupsToday', size:'1x1' },
  { id:'widget.followupsLate', size:'1x1' },
  { id:'widget.followupsDone', size:'1x1' }
];

let addGuard = false;
function defaultDashLayout(){ // Ajuste: layout base com os 4 cartões principais
  return { slots: DEFAULT_DASHBOARD_SLOTS.map(slot => ({ ...slot })), version:2 };
}

function normalizeDashSlots(slots){ // Ajuste: garante apenas 4 slots válidos
  const normalized = [];
  const seen = new Set();
  if(Array.isArray(slots)){
    slots.forEach(slot => {
      if(!slot || seen.has(slot.id)) return;
      normalized.push({ ...slot });
      seen.add(slot.id);
    });
  }
  if(normalized.length === 0){
    return DEFAULT_DASHBOARD_SLOTS.map(slot => ({ ...slot }));
  }
  return normalized.slice(0, DASHBOARD_SLOT_LIMIT);
}

bindOnce(document.getElementById('dashAddMenu'),'click', e=>{
  const btn = e.target.closest('[data-widget]'); if(!btn || addGuard) return;
  addGuard = true;
  const type = btn.dataset.widget;
  insertWidgetOnce(type);
  closeDashMenu?.();
  setTimeout(()=> addGuard=false, 250);
});

function insertWidgetOnce(type){
  const layout = loadDashLayout();
  if(layout.slots.some(slot => slot?.id === type)){
    return toast('Já adicionado');
  }
  if(layout.slots.length >= DASHBOARD_SLOT_LIMIT){
    return toast('Sem espaço');
  }
  layout.slots.push({ id:type, size: type==='widget.clientsContactsChart' ? '2x1' : '1x1' });
  saveDashLayout(layout);
  renderDashboard?.();
}

function dashKey(profile = getPerfil()){ return `perfil:${profile}:dashboard.layout`; }
function ensureSeed(profile = getPerfil()){
  const cur = getJSON(dashKey(profile), null);
  const slots = normalizeDashSlots(cur?.slots);
  const next = cur && typeof cur === 'object' ? { ...cur, slots, version:2 } : defaultDashLayout();
  setJSON(dashKey(profile), next);
}
function seedAllDash(){ PROFILES.forEach(ensureSeed); }

function onProfileChanged(){
  ensureSeed(getPerfil());
  renderDashboard();
  window.renderClientsTable?.();
  renderCalendarMonth?.();
}

function addDaysUTC(date, days){ const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); d.setUTCDate(d.getUTCDate()+days); return d; }
function parseDDMMYYYY(s){
  if(!s) return new Date(NaN);
  if(s.includes('-')) return new Date(s);
  const [dd,mm,yy] = s.split('/').map(Number);
  return new Date(Date.UTC(yy, mm-1, dd));
}
function fmtYMD(d){ return isNaN(d) ? '' : d.toISOString().slice(0,10); }

function upsertEvent(list, ev){
  const idx = list.findIndex(e => e.id === ev.id);
  if(idx >= 0) list[idx] = ev; else list.push(ev);
}

function scheduleFollowUpsForPurchase(cliente, compra){
  if(!cliente || !compra) return;
  if(cliente.naoContate){
    removeFollowUpEvents(cliente.id, compra.id);
    return;
  }
  let cal=getCalendar();
  // Remove quaisquer eventos de compra existentes desta compra (independente de cor)
  cal=cal.filter(ev => !(
    (ev.meta?.purchaseId===compra.id || ev.meta?.compraId===compra.id) &&
    ev.meta?.kind==='purchase'
  ));

  // ID base para novos eventos desta compra
  const baseId=`${currentProfile()}:${cliente.id}:${compra.id}:0`;

  const baseDate=parseDDMMYYYY(compra.dataCompra);
  if(isNaN(baseDate)) return;

  for (const d of [90,180,365]){
    const stage=d===90?'3m':d===180?'6m':'12m';
    const id=`${currentProfile()}:${cliente.id}:${compra.id}:${d}`;
    const dt=addDaysUTC(baseDate, d);
    const done=!!compra.followUps?.[stage]?.done;
    upsertEvent(cal, {
      id,
      date: fmtYMD(dt),
      title: `${cliente.nome} (${d===90?'3 meses':d===180?'6 meses':'12 meses'})`,
      color: 'followup',
      meta: {
        clientId: cliente.id,
        clienteId: cliente.id,
        purchaseId: compra.id,
        compraId: compra.id,
        followupOffsetDays: d,
        kind:'followup',
        type:'followup',
        stage,
        done
      }
    });
  }
  setCalendar(cal); renderCalendarMonth?.();
}

// MIGRAÇÃO – remover eventos de compra e ajustar follow-ups antigos
(function migrateCalendarEvents(){
  const cal = getCalendar();
  let changed = false;
  const filtered = cal.filter(ev => {
    if(ev.meta?.kind === 'purchase'){ changed = true; return false; }
    if(ev.color === 'blue'){
      ev.color = 'followup';
      ev.meta = { ...ev.meta, kind:'followup', type:'followup' };
      changed = true;
    }
    if(ev.color === 'followup'){
      const map = {90:'3m',180:'6m',365:'12m'};
      const offset = ev.meta?.followupOffsetDays;
      const stage = ev.meta?.stage || map[offset];
      ev.meta = { ...ev.meta, kind:'followup', type:'followup', stage };
      changed = true;
    }
    return true;
  });
  if(changed) setCalendar(filtered);
})();

function scheduleFollowUpsOnClientSave(cliente){
  if(!cliente) return;
  if(cliente.naoContate){
    removeFollowUpEvents(cliente.id);
    return;
  }
  (cliente.compras||[]).forEach(c=>scheduleFollowUpsForPurchase(cliente, c));
}

function migrateToProfiles(){
  if(!localStorage.getItem('migrated_to_profiles_v1')){
    const legacy=['clientes','calendario','calendar','lembretes','contato','usuarios'];
    legacy.forEach(k=> localStorage.removeItem(k));
    // remove resquícios do perfil antigo "Teste"
    Object.keys(localStorage).forEach(k=>{
      if(k.startsWith('perfil:Teste:') || k.startsWith('Teste:')) localStorage.removeItem(k);
    });
    localStorage.setItem('migrated_to_profiles_v1','1');
  }
}

function ensurePerfilSeeds(){
    if(getPerfil()==='Administrador'){
      const usuarios=getJSON(prefix()+'usuarios', []);
      if(usuarios.length===0){
        const seeds=["Jorel Chicuta","Jorel Avenida","Exótica","Usuario Teste"].map(n=>({id:uuid(), nome:n, email:'', perfil:''}));
        setJSON(prefix()+'usuarios', seeds);
      }
    }
}

function cleanupDesfalques(){
  if(localStorage.getItem('cleanup_desfalques_v1')) return;
  Object.keys(localStorage).forEach(k=>{
    if(k.startsWith('perfil:') && (k.endsWith(':calendario') || k.endsWith(':calendar'))){
      try{
        const arr=JSON.parse(localStorage.getItem(k)||'[]').filter(e=>e.tipo!=='desfalque');
        localStorage.setItem(k,JSON.stringify(arr));
      }catch{}
    }
  });
  localStorage.setItem('cleanup_desfalques_v1','1');
}

function cleanupOrphanEventos(){
  const clientesIds=new Set(getJSON(prefix()+'clientes', []).map(c=>c.id));
  let eventos=getJSON(calKey(),[]);
  const filtered=eventos.filter(ev=>!ev.meta?.clienteId || clientesIds.has(ev.meta.clienteId));
  if(filtered.length!==eventos.length){
    setJSON(calKey(),filtered);
  }
}

function nsKey(key){ return prefix()+key; }



function normalizeDigits(s){ return (s||'').toString().replace(/\D+/g,''); }

function filterClientsBySearchAndTags(list, term){
  const t = term.trim().toLowerCase();
  const digits = normalizeDigits(term);
  const tags = new Set(ui.clients.filters.interesses||[]);
  return list.filter(c=>{
    const byText = c.nome?.toLowerCase().includes(t)
      || (c.telefone||'').toLowerCase().includes(t)
      || (c.nfe||'').toLowerCase().includes(t);
    const byCPF  = digits && normalizeDigits(c.cpf).includes(digits);
    const byTags = tags.size===0 || (Array.isArray(c.interesses||c.usos) && (c.interesses||c.usos).some(tg=>tags.has(tg)));
    return (byText || byCPF) && byTags;
  });
}

function disablePhotoEdit(badge){
  if(!badge) return;
  if(badge._onMouseMove){ badge.removeEventListener('mousemove', badge._onMouseMove); badge._onMouseMove=null; }
  if(badge._onMouseDown){ badge.removeEventListener('mousedown', badge._onMouseDown); badge._onMouseDown=null; }
  if(badge._onClick){ badge.removeEventListener('click', badge._onClick); badge._onClick=null; }
  if(badge._onMouseUp){ document.removeEventListener('mouseup', badge._onMouseUp); badge._onMouseUp=null; }
  if(badge._input){ badge._input.remove(); badge._input=null; }
  badge.classList.remove('editable');
}

function enablePhotoEdit(badge, img){
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.style.display='none';
  badge.appendChild(input);
  const onClick=()=>input.click();
  badge.addEventListener('click', onClick);
  badge._onClick=onClick;
  input.addEventListener('change', e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ setUserPhoto({src:reader.result, x:50, y:50}); updateProfileUI(); };
    reader.readAsDataURL(file);
  });
  let dragging=false,startX,startY,startPosX,startPosY;
  const onMouseDown=e=>{
    dragging=true; startX=e.clientX; startY=e.clientY;
    startPosX=parseFloat(img.dataset.x)||50; startPosY=parseFloat(img.dataset.y)||50;
    e.preventDefault();
  };
  const onMouseMove=e=>{
    if(!dragging) return;
    const rect=badge.getBoundingClientRect();
    const dx=(e.clientX-startX)/rect.width*100;
    const dy=(e.clientY-startY)/rect.height*100;
    let x=Math.max(0,Math.min(100,startPosX+dx));
    let y=Math.max(0,Math.min(100,startPosY+dy));
    img.style.objectPosition=`${x}% ${y}%`;
    img.dataset.x=x; img.dataset.y=y;
  };
  const onMouseUp=()=>{
    if(!dragging) return; dragging=false;
    const p=getUserPhoto();
    p.x=parseFloat(img.dataset.x)||50;
    p.y=parseFloat(img.dataset.y)||50;
    setUserPhoto(p);
  };
  img.addEventListener('mousedown', onMouseDown);
  badge.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  badge._onMouseDown=onMouseDown;
  badge._onMouseMove=onMouseMove;
  badge._onMouseUp=onMouseUp;
  badge._input=input;
  badge.classList.add('editable');
}

const DEFAULT_PHOTO='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI3MiIgaGVpZ2h0PSI3MiI+PHJlY3Qgd2lkdGg9IjcyIiBoZWlnaHQ9IjcyIiBmaWxsPSIjY2NjIi8+PC9zdmc+';

function updateProfileUI(){
  const badge=document.getElementById('profileBadge');
  if(!badge) return;
  disablePhotoEdit(badge);
  const p=activeProfile();
  const photo=getUserPhoto(p);
  const src=photo.src||DEFAULT_PHOTO;
  const imgHtml=`<img src="${src}" class="profile-pic" style="object-position:${photo.x}% ${photo.y}%" data-x="${photo.x}" data-y="${photo.y}">`;
  badge.innerHTML=imgHtml+`<div class="profile-name">${p}</div>`;
  badge.classList.remove('profile-admin','profile-other');
  badge.classList.add(p==='Administrador'?'profile-admin':'profile-other');
  if(currentRoute==='gerencia'){
    const img=badge.querySelector('.profile-pic');
    if(img) enablePhotoEdit(badge,img);
  }
}

let selectedPurchaseId = null;
let currentClientId = null;
let currentClientPurchases = [];
let renderSelectedPurchaseDetails = null;

function openPurchaseModalForSelected(){
  const id = state.getClienteSelecionadoId();
  if(!id) return toast('Selecione um cliente');
  openCompraModal(id, null, () => { refreshClientsTable?.(); window.renderClientDetail?.(); });
}
window.openPurchaseModalForSelected = openPurchaseModalForSelected;

function setActivePurchaseChip(id){
  document.querySelectorAll('#purchaseTabs [data-purchase-id]').forEach(el=>{
    el.classList.toggle('active', el.dataset.purchaseId===id);
  });
}

let tagMenuOpen=false;
function openTagMenu(){ if(tagMenuOpen) return; tagMenuOpen=true; renderTagMenu(); positionTagMenu(); bindTagMenuHandlers(); }
function closeTagMenu(){ tagMenuOpen=false; const p=document.getElementById('tagMenuPortal'); if(p) p.innerHTML=''; unbindTagMenuHandlers(); }
function toggleTagMenu(anchor){ tagMenuOpen ? closeTagMenu() : openTagMenu(anchor); }

function renderTagMenu(){
  const portal=document.getElementById('tagMenuPortal');
  if(!portal) return;
  const map={re:'Relógios', jo:'Jóias Ouro', jp:'Jóias Prata', op:'Óptica', vs:'V.S', mf:'M.F', bi:'BIFOCAL', so:'SOLAR'};
  portal.innerHTML=`<div id="tagMenuContent" class="tag-menu">${Object.entries(map).map(([k,v])=>`<div class=\"tag-row\"><label class=\"tag-switch\"><input type=\"checkbox\" data-tag=\"${k}\" ${ui.clients.filters.interesses.includes(v)?'checked':''}><span>${v}</span></label></div>`).join('')}</div>`;
  document.getElementById('tagMenuContent')?.addEventListener('change',e=>{
    const cb=e.target.closest('input[type="checkbox"][data-tag]'); if(!cb) return;
    toggleTagFilter(cb.dataset.tag, cb.checked);
    window.renderClientsTable?.();
  });
}

function positionTagMenu(){
  const btn=document.getElementById('tagMenuBtn');
  const menu=document.getElementById('tagMenuContent');
  if(!btn||!menu) return;
  const rect=btn.getBoundingClientRect();
  const mw=menu.offsetWidth;
  let left=rect.left;
  if(left+mw>window.innerWidth) left=rect.right-mw;
  menu.style.left=`${left+window.scrollX}px`;
  menu.style.top=`${rect.bottom+window.scrollY}px`;
}

function escTag(e){ if(e.key==='Escape') closeTagMenu(); }
function clickOutsideTag(e){ const menu=document.getElementById('tagMenuContent'); const btn=document.getElementById('tagMenuBtn'); if(menu && !menu.contains(e.target) && (!btn || !btn.contains(e.target))) closeTagMenu(); }
function bindTagMenuHandlers(){
  document.addEventListener('keydown', escTag);
  document.addEventListener('click', clickOutsideTag);
  window.addEventListener('scroll', closeTagMenu);
  window.addEventListener('resize', closeTagMenu);
  window.addEventListener('hashchange', closeTagMenu);
}
function unbindTagMenuHandlers(){
  document.removeEventListener('keydown', escTag);
  document.removeEventListener('click', clickOutsideTag);
  window.removeEventListener('scroll', closeTagMenu);
  window.removeEventListener('resize', closeTagMenu);
  window.removeEventListener('hashchange', closeTagMenu);
}

function toggleTagFilter(code, on){
  const map={re:'Relógios', jo:'Jóias Ouro', jp:'Jóias Prata', op:'Óptica', vs:'V.S', mf:'M.F', bi:'BIFOCAL', so:'SOLAR'};
  const val=map[code]||code;
  const set=new Set(ui.clients.filters.interesses||[]);
  if(on) set.add(val); else set.delete(val);
  ui.clients.filters.interesses=Array.from(set);
  setJSON(prefix()+'clients.filters.interesses', ui.clients.filters.interesses);
}

// ===== State =====
const PERFIS = ['Exótica','Jorel Chicuta','Jorel Avenida','Administrador','Usuario Teste'];

const state = {
  getRoute() {
    return localStorage.getItem('route') || 'calendario';
  },
  setRoute(r) {
    localStorage.setItem('route', r);
  },
  getTheme() {
    return localStorage.getItem('theme') || 'light';
  },
  setTheme(t) {
    localStorage.setItem('theme', t);
  },
  getClienteSelecionadoId() {
    return localStorage.getItem(nsKey('clienteSelecionadoId')) || '';
  },
  setClienteSelecionado(id) {
    const key=nsKey('clienteSelecionadoId');
    if (id) localStorage.setItem(key, id);
    else localStorage.removeItem(key);
  },
  getActivePerfil() { return activeProfile(); },
  setActivePerfil(p) { window.setActivePerfil(p); }
};

function navigateToClientPage(clienteId){
  if(!clienteId) return;
  state.setClienteSelecionado(clienteId);
  location.hash = '#/clientes-pagina';
}
window.navigateToClientPage = navigateToClientPage;

function applyPerfilGates(){
  const isAdmin = getPerfil()==='Administrador';
  const navConfig=document.querySelector('.nav-config');
  if(navConfig) navConfig.style.display = isAdmin ? '' : 'none';
  const calendarioItem=document.querySelector('.nav-item[data-root="calendario"]');
  const calendarioGroup=calendarioItem?.closest('.nav-group');
  const calendarioSubmenu=calendarioGroup?.querySelector('.nav-submenu');
  if(calendarioItem){
    calendarioItem.dataset.submenuEnabled = isAdmin ? 'true' : 'false';
    calendarioItem.setAttribute('aria-haspopup', isAdmin ? 'true' : 'false');
    if(!isAdmin) setNavSubmenuState(calendarioItem, false);
  }
  if(calendarioSubmenu){
    const shouldShow = isAdmin && calendarioItem?.dataset.expanded === 'true';
    calendarioSubmenu.hidden = !shouldShow;
  }
}

// ===== API Stub =====
const api = {
  listarClientes() {
    // TODO: conectar com API real
  },
  listarEventosCalendario() {
    // TODO: conectar com API real
  },
  listarLembretes() {
    // TODO: conectar com API real
  }
};

// ===== Database (localStorage) =====
const DENYLIST = { nomes: [/^jo[aã]o\s+claro$/i] };
function normalizar(str){
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function isNomeBloqueado(n){
  return DENYLIST.nomes.some(rx=>rx.test(normalizar(n)));
}


function removeFollowUpEvents(clienteId,compraId){
  if(!clienteId && !compraId) return;
  let eventos=getJSON(calKey(),[]);
  eventos=eventos.filter(e=>{
    if(e.meta?.type!=='followup') return true;
    const matchesCliente=!clienteId || e.meta?.clienteId===clienteId || e.meta?.clientId===clienteId;
    const matchesCompra=!compraId || e.meta?.compraId===compraId || e.meta?.purchaseId===compraId;
    if(matchesCliente && matchesCompra) return false;
    return true;
  });
  setJSON(calKey(),eventos);
  renderCalendarMonth && renderCalendarMonth();
  reloadCalendario();
}

  const db = {
    _get() {
      const data = getJSON(prefix()+'clientes', []);
    const filtered = data.filter(c => !CLIENTES_REMOVIDOS.includes(c.nome) && !isNomeBloqueado(c.nome));
      if (filtered.length !== data.length) setJSON(prefix()+'clientes', filtered);
      return filtered;
    },
    _set(data) {
      setJSON(prefix()+'clientes', data);
    },
    initComSeeds() {
      // seeds removidos
    },
  listarClientes({ search = '', sortBy = 'nome', sortDir = 'asc' } = {}) {
    let data = this._get();
    if (search) {
      const s = search.toLowerCase();
      data = data.filter(c => {
        const compra = getUltimaCompra(c.compras);
        const oq = compra ? `armação ${compra.armacao} + lente ${compra.lente}`.toLowerCase() : '';
        return c.nome.toLowerCase().includes(s) ||
               formatTelefone(c.telefone).toLowerCase().includes(s) ||
               oq.includes(s);
      });
    }
    data.sort((a, b) => {
      if (sortBy === 'nome') {
        return sortDir === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
      }
      const da = getUltimaCompra(a.compras)?.dataCompra || '';
      const dbb = getUltimaCompra(b.compras)?.dataCompra || '';
      if (da === dbb) return 0;
      return sortDir === 'asc' ? (da > dbb ? 1 : -1) : (da < dbb ? 1 : -1);
    });
    return data;
  },
  criarCliente(payload) {
    if (isNomeBloqueado(payload.nome)) {
      throw new Error('Nome de cliente bloqueado');
    }
    const data = this._get();
    const id = uuid();
    const now = new Date().toISOString();
    const cliente = {
      id,
      nome: payload.nome,
      telefone: payload.telefone,
      dataNascimento: payload.dataNascimento || '',
      cpf: payload.cpf || '',
      genero: payload.genero || '',
      observacoes: payload.observacoes || '',
      interesses: payload.interesses || [],
      naoContate: Boolean(payload.naoContate),
      compras: [],
      criadoEm: now,
      atualizadoEm: now
    };
    if (payload.compra) {
      const cp = { ...payload.compra, id: uuid(), followUps:{} };
      cp.dataISO = cp.dataCompra;
      cliente.compras.push(cp);
      scheduleFollowUpsForPurchase(cliente, cp);
    }
    scheduleFollowUpsOnClientSave(cliente);
    data.push(cliente);
    this._set(data);
    renderDashboard();
    return id;
  },
  atualizarCliente(id, patch) {
    const data = this._get();
    const idx = data.findIndex(c => c.id === id);
    if (idx === -1) return;
    const cliente = data[idx];
    Object.assign(cliente, patch);
    cliente.atualizadoEm = new Date().toISOString();
    if (patch.compra) {
      const cp = { ...patch.compra, id: uuid(), followUps:{} };
      cp.dataISO = cp.dataCompra;
      cliente.compras.unshift(cp);
      cliente.compras.sort((a, b) => b.dataCompra.localeCompare(a.dataCompra));
      scheduleFollowUpsForPurchase(cliente, cp);
    }
    scheduleFollowUpsOnClientSave(cliente);
    data[idx] = cliente;
    this._set(data);
    renderDashboard();
  },
  deletarCliente(id) {
    const data = this._get();
    const idx = data.findIndex(c => c.id === id);
    if (idx === -1) return;
    removeFollowUpEvents(id);
    data.splice(idx, 1);
    this._set(data);
    reloadCalendario();
    renderDashboard();
  },
  atualizarCompra(clienteId, compraId, patch, opts = {}) {
    const data = this._get();
    const cIdx = data.findIndex(c => c.id === clienteId);
    if (cIdx === -1) return;
    const compras = data[cIdx].compras;
    const compIdx = compras.findIndex(cp => cp.id === compraId);
    if (compIdx === -1) return;
    Object.assign(compras[compIdx], patch);
    compras[compIdx].dataISO = compras[compIdx].dataCompra;
    scheduleFollowUpsForPurchase(data[cIdx], compras[compIdx]);
    data[cIdx].atualizadoEm = new Date().toISOString();
    this._set(data);
    if (!opts.skipReload) reloadCalendario();
    if (!opts.skipDashboard) renderDashboard();
  },
  adicionarCompra(clienteId, compra) {
    const data = this._get();
    const cIdx = data.findIndex(c => c.id === clienteId);
    if (cIdx === -1) return;
    const cp = { ...compra, id: uuid(), followUps:{} };
    data[cIdx].compras.unshift(cp);
    cp.dataISO = cp.dataCompra;
    scheduleFollowUpsForPurchase(data[cIdx], cp);
    data[cIdx].atualizadoEm = new Date().toISOString();
    this._set(data);
    reloadCalendario();
    renderDashboard();
    return cp.id;
  },
  deletarCompra(clienteId, compraId) {
    const data = this._get();
    const cIdx = data.findIndex(c => c.id === clienteId);
    if (cIdx === -1) return;
    const compras = data[cIdx].compras;
    const idx = compras.findIndex(cp => cp.id === compraId);
    if (idx === -1) return;
    compras.splice(idx, 1);
    removeFollowUpEvents(clienteId, compraId);
    data[cIdx].atualizadoEm = new Date().toISOString();
    this._set(data);
    renderDashboard();
  },
  buscarPorId(id) {
    return this._get().find(c => c.id === id);
  }
};

const PROTECTED_USERS = ['Jorel Chicuta','Jorel Avenida','Exótica'];
const dbUsuarios = {
  _key(){ return nsKey('usuarios'); },
  listar(){ return getJSON(prefix()+'usuarios', []); },
  salvar(arr){ setJSON(prefix()+'usuarios', arr); },
  adicionar(u){ const arr=this.listar(); arr.push(u); this.salvar(arr); },
  atualizar(id,patch){ const arr=this.listar(); const idx=arr.findIndex(u=>u.id===id); if(idx>-1){ arr[idx]={...arr[idx],...patch}; this.salvar(arr);} },
  remover(id){ const arr=this.listar().filter(u=>u.id!==id); this.salvar(arr); },
    initSeeds(){
      if(this.listar().length) return;
      const seeds=[...PROTECTED_USERS,'Usuario Teste'].map(n=>({id:uuid(), nome:n, email:'', perfil:''}));
      this.salvar(seeds);
    }
};

// ===== Cards =====
const cards = {
  apply(container) {
    container.querySelectorAll('.card').forEach(card => {
      const col = card.dataset.colspan;
      const row = card.dataset.rowspan;
      if (col) card.classList.add(`col-span-${col}`);
      if (row) card.classList.add(`row-span-${row}`);
    });
  },
  loading(container) {
    container.querySelectorAll('.card').forEach(card => card.classList.add('loading'));
    setTimeout(() => {
      container.querySelectorAll('.card').forEach(card => card.classList.remove('loading'));
    }, 500);
  }
};

// ===== UI =====
const ui = {
  clients: { filters: { interesses: [] }, search: '' },
  dashboard: { layout: null },
  os: {
    filters: { text:'', types:['reloj','joia','optica'] },
    pages:{loja:1,oficina:1,aguardando:1},
    counts:{loja:0,oficina:0,aguardando:0,completo:0},
    completed:{ text:'', type:'', page:1 }
  },
  initDropdowns() {
    document.querySelectorAll('.ui-dropdown').forEach(dd => {
      const btn = dd.querySelector('.dropdown-toggle');
      btn.addEventListener('click', () => {
        const expanded = dd.classList.toggle('open');
        btn.setAttribute('aria-expanded', expanded);
      });
    });
    document.addEventListener('click', e => {
      document.querySelectorAll('.ui-dropdown.open').forEach(dd => {
        if (!dd.contains(e.target)) {
          dd.classList.remove('open');
          dd.querySelector('.dropdown-toggle').setAttribute('aria-expanded', 'false');
        }
      });
    });
  },
  initModal() {
    const modal = document.getElementById('app-modal');
    modal.open = () => {
      closeTagMenu();
      modal._trigger = document.activeElement;
      modal.hidden = false;
      modal.classList.add('is-open');
      document.body.classList.add('modal-open');
      const first = modal.querySelector('.modal-body input, .modal-body select, .modal-body textarea, .modal-body button');
      if (first) first.focus();
    };
    modal.close = () => {
      modal.hidden = true;
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      if (modal._trigger && modal._trigger.focus) modal._trigger.focus();
    };
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !modal.hidden) {
        modal.close();
      }
    });
    modal.addEventListener('click', e => {
      if (e.target.hasAttribute('data-modal-close')) modal.close();
    });
  },
  toast(message) {
    const stack = document.querySelector('.toast-stack');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    stack.appendChild(t);
    setTimeout(() => stack.removeChild(t), 2000);
  }
};

// ===== Router =====
const routes = {
  dashboard: dashboardPage,
  calendario: renderCalendario,
  'calendario-folgas': renderCalendarioFolgas,
  'calendario-visualizador': renderCalendarioVisualizador,
  clientes: renderClientesVisaoGeral,
  'clientes-visao-geral': renderClientesVisaoGeral,
  'clientes-cadastro': renderClientesCadastro,
  'clientes-tabela': renderClientesTabela,
  'clientes-pagina': renderClientePagina,
  os: renderOS,
  'contatos-executar': renderContatosExecutar,
  'contatos-listas': renderContatosListas,
  'contatos-pos-venda': renderContatosPosVenda,
  'contatos-ofertas': renderContatosOfertas,
  'contatos-historico': renderContatosHistorico,
  'gerencia-config': renderGerenciaConfig,
  'gerencia-mensagens': renderGerenciaMensagens,
  configuracoes: renderConfig
};
const CLIENTES_SUBROUTES = new Set(['clientes-visao-geral','clientes-cadastro','clientes-tabela','clientes-pagina']);
const CALENDARIO_SUBROUTES = new Set(['calendario','calendario-folgas','calendario-visualizador']);
const CONTATOS_SUBROUTES = new Set(['contatos-executar','contatos-listas','contatos-pos-venda','contatos-ofertas','contatos-historico']);
const GERENCIA_SUBROUTES = new Set(['gerencia-config','gerencia-mensagens']);
const SUBMENU_ROUTES = { clientes: CLIENTES_SUBROUTES, calendario: CALENDARIO_SUBROUTES, contatos: CONTATOS_SUBROUTES, gerencia: GERENCIA_SUBROUTES };

function routeMatchesRoot(root, route){
  const set = SUBMENU_ROUTES[root];
  return set ? set.has(route) : route === root;
}

function isSubmenuEnabled(item){
  return item?.classList.contains('has-submenu') && item.dataset.submenuEnabled !== 'false';
}

let activeNavPopover = null;
let navTooltipEl = null;

function ensureNavTooltip(){
  if(!navTooltipEl){
    navTooltipEl = document.createElement('div');
    navTooltipEl.className = 'nav-tooltip';
    document.body.appendChild(navTooltipEl);
  }
  return navTooltipEl;
}

function showNavTooltipForItem(item){
  const tooltip = ensureNavTooltip();
  const label = item?.querySelector('.label');
  const text = label ? label.textContent.trim() : '';
  if(!text) return;
  const rect = item.getBoundingClientRect();
  tooltip.textContent = text;
  tooltip.style.top = `${rect.top + rect.height / 2}px`;
  tooltip.style.left = `${rect.right + 12}px`;
  tooltip.classList.add('is-visible');
}

function hideNavTooltip(){
  if(navTooltipEl) navTooltipEl.classList.remove('is-visible');
}

function positionSubmenu(item, submenu){
  if(!item || !submenu) return;
  const rect = item.getBoundingClientRect();
  const submenuRect = submenu.getBoundingClientRect();
  const margin = 16;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  let top = rect.top + rect.height / 2 - submenuRect.height / 2;
  const maxTop = viewportHeight - submenuRect.height - margin;
  const minTop = margin;
  if(maxTop >= minTop){
    top = Math.min(Math.max(top, minTop), Math.max(minTop, maxTop));
  } else {
    top = Math.max(0, viewportHeight - submenuRect.height);
  }
  submenu.style.top = `${top}px`;
  const horizontalGap = 12;
  let left = rect.right + horizontalGap;
  const maxLeft = viewportWidth - submenuRect.width - margin;
  const minLeft = margin;
  left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));
  submenu.style.left = `${left}px`;
  const updatedRect = submenu.getBoundingClientRect();
  const anchorCenter = rect.top + rect.height / 2;
  let arrowOffset = anchorCenter - updatedRect.top - 6;
  const arrowMin = 8;
  const arrowMax = Math.max(arrowMin, updatedRect.height - 20);
  arrowOffset = Math.min(Math.max(arrowOffset, arrowMin), arrowMax);
  submenu.style.setProperty('--submenu-anchor-offset', `${arrowOffset}px`);
}

function setNavSubmenuState(item, expanded){
  if(!item) return;
  const group = item.closest('.nav-group');
  const submenu = group?.querySelector('.nav-submenu');
  item.classList.toggle('is-expanded', expanded);
  item.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  item.dataset.expanded = expanded ? 'true' : 'false';
  if(!group || !submenu){
    if(activeNavPopover && activeNavPopover.item === item) activeNavPopover = null;
    return;
  }
  if(expanded && isSubmenuEnabled(item)){
    hideNavTooltip();
    submenu.hidden = false;
    group.classList.add('is-popover-open');
    activeNavPopover = { item, submenu };
    requestAnimationFrame(() => positionSubmenu(item, submenu));
  } else {
    group.classList.remove('is-popover-open');
    submenu.hidden = true;
    submenu.style.top = '';
    submenu.style.left = '';
    submenu.style.removeProperty('--submenu-anchor-offset');
    if(activeNavPopover && activeNavPopover.item === item) activeNavPopover = null;
  }
}

function repositionActiveNavPopover(){
  if(activeNavPopover && activeNavPopover.submenu && !activeNavPopover.submenu.hidden){
    positionSubmenu(activeNavPopover.item, activeNavPopover.submenu);
  }
}

function collapseAllSubmenus(exceptRoot){
  document.querySelectorAll('.nav-item.has-submenu').forEach(nav => {
    if(nav.dataset.root !== exceptRoot){
      setNavSubmenuState(nav, false);
    }
  });
  hideNavTooltip();
}
const routeAliases = { clientes: 'clientes-visao-geral', contatos: 'contatos-executar', contato: 'contatos-executar', gerencia: 'gerencia-config' };
let currentRoute = 'dashboard';

function resolveRoute(name){
  const target = routeAliases[name] || name;
  return target in routes ? target : 'dashboard';
}

function renderRoute(name){
  currentRoute = resolveRoute(name);
  const main = document.querySelector('#app-main');
  if(currentRoute !== 'calendario') calendarMonthRenderer = null;
  if(currentRoute==='gerencia') main.innerHTML='';
  else main.innerHTML = routes[currentRoute]() || '';
  cards.apply(main);
  cards.loading(main);
  const titles = {
    dashboard: 'Dashboard',
    calendario: 'Calendário',
    'calendario-folgas': 'Calendário · Folgas',
    'calendario-visualizador': 'Calendário · Visualizador de calendários',
    'clientes-visao-geral': 'Clientes · Visão Geral',
    'clientes-cadastro': 'Clientes · Cadastro',
    'clientes-tabela': 'Clientes · Tabela de Clientes',
    'clientes-pagina': 'Clientes · Página do Cliente',
    os: 'Ordem de Serviço',
    'contatos-executar': 'Contatos · Contatos a Executar',
    'contatos-listas': 'Contatos · Listas de Contatos',
    'contatos-pos-venda': 'Contatos · Pós Venda',
    'contatos-ofertas': 'Contatos · Ofertas',
    'contatos-historico': 'Contatos · Histórico',
    'gerencia-config': 'Gerencia · Configurações',
    'gerencia-mensagens': 'Gerencia · Mensagens',
    configuracoes: 'Configurações'
  };
  const pageTitle = titles[currentRoute] || titles[routeAliases[currentRoute]] || currentRoute;
  document.getElementById('page-title').textContent = pageTitle;
  document.querySelectorAll('.nav-item').forEach(item => {
    const root=item.dataset.root;
    if(item.classList.contains('has-submenu')){
      const activeRoot = routeMatchesRoot(root, currentRoute);
      const shouldRemainOpen = activeRoot && item.dataset.expanded === 'true';
      setNavSubmenuState(item, shouldRemainOpen);
      item.classList.toggle('is-active', activeRoot);
      const group=item.closest('.nav-group');
      if(group){
        group.classList.toggle('is-highlighted', activeRoot);
      }
    }else{
      item.classList.toggle('is-active', item.dataset.route === currentRoute);
    }
  });
  document.querySelectorAll('.nav-subitem').forEach(sub => {
    sub.classList.toggle('is-active', sub.dataset.route === currentRoute);
  });
  if(currentRoute === 'dashboard') initDashboardPage();
  if(currentRoute === 'clientes-visao-geral') initClientesVisaoGeral();
  if(currentRoute === 'clientes-cadastro') initClientesCadastro();
  if(currentRoute === 'clientes-tabela') initClientesTabela();
  if(currentRoute === 'clientes-pagina') initClientePagina();
  if(currentRoute === 'calendario') initCalendarioPage();
  if(currentRoute === 'os') initOSPage();
  if(currentRoute === 'contatos-historico') initContatosHistoricoPage();
  if(currentRoute === 'gerencia-config') initGerenciaConfigPage();
  if(currentRoute === 'gerencia-mensagens') initGerenciaMensagensPage();
  if(currentRoute === 'configuracoes') initConfiguracoesPage();
  updateProfileUI();
}

function renderCardGrid(prefix) {
  let html = '<div class="card-grid">';
  for (let i = 1; i <= 8; i++) {
    const attrs = i === 3 ? 'data-colspan="6" data-rowspan="2"' : '';
    html += `<div class="card empty-state" data-card-id="${i}" ${attrs}>`+
            `<div class="card-head">Métrica ${i}</div>`+
            `<div class="card-metric">—</div>`+
            `<div class="card-body">${prefix} ${i}</div>`+
            `</div>`;
  }
  html += '</div>';
  return html;
}

// ===== Calendar Menu Bar =====
function renderCalendarMenuBar(){
  return `
    <div class="calendar-menu-bar">
      <div class="menu-actions">
        <button class="btn btn-cal-desfalques" style="display:none">Desfalques</button>
      </div>
      <div class="menu-widgets">
        <div class="mini-widget mini-blue">
          <div class="mini-title">Contatos</div>
          <div class="mini-split">
            <div class="mini-stat">
              <div class="mini-value" data-stat="contatos-hoje">0</div>
              <div class="mini-label">Hoje</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value" data-stat="contatos-semana">0</div>
              <div class="mini-label">Semana</div>
            </div>
          </div>
        </div>
        <div class="mini-widget mini-yellow">
          <div class="mini-title">Aguardando Serviços</div>
          <div class="mini-triple">
            <div class="mini-stat">
              <div class="mini-value" data-stat="os-aguardando-o">0</div>
              <div class="mini-label">Óptica</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value" data-stat="os-aguardando-r">0</div>
              <div class="mini-label">Relógio</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value" data-stat="os-aguardando-j">0</div>
              <div class="mini-label">Jóias</div>
            </div>
          </div>
        </div>
        <div class="mini-widget mini-yellow">
          <div class="mini-title">Aguardando Retirada</div>
          <div class="mini-triple">
            <div class="mini-stat">
              <div class="mini-value" data-stat="os-retirada-o">0</div>
              <div class="mini-label">Óptica</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value" data-stat="os-retirada-r">0</div>
              <div class="mini-label">Relógio</div>
            </div>
            <div class="mini-stat">
              <div class="mini-value" data-stat="os-retirada-j">0</div>
              <div class="mini-label">Jóias</div>
            </div>
          </div>
        </div>
        <div class="mini-widget mini-compact">
          <div class="mini-title">O.S para Hoje</div>
          <div class="mini-stat mini-single">
            <div class="mini-value" data-stat="os-hoje">0</div>
            <div class="mini-label">Hoje</div>
          </div>
        </div>
        <div class="mini-widget mini-actions-only">
          <div class="mini-actions-inline">
            <button class="btn-eventos" type="button">Eventos</button>
            <button class="btn-folgas" type="button">Folgas</button>
          </div>
        </div>
      </div>
    </div>`;
}

function updateCalendarMenuBar(){
  const bar=document.querySelector('.calendar-menu-bar');
  if(!bar) return;

  // Contatos: hoje e semana
  const events=getJSON(calKey(), []).filter(e=>e.meta?.type==='followup');
  const today=new Date();
  const startWeek=new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay()+6)%7)));
  const endWeek=new Date(startWeek); endWeek.setUTCDate(startWeek.getUTCDate()+7);
  const isSameDay=(a,b)=>a.getUTCFullYear()===b.getUTCFullYear()&&a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()===b.getUTCDate();
  let todayCount=0, weekCount=0;
  events.forEach(ev=>{
    const d=new Date(ev.date);
    if(isSameDay(d,today)) todayCount++;
    if(d>=startWeek && d<endWeek) weekCount++;
  });
  bar.querySelector('[data-stat="contatos-hoje"]').textContent=todayCount;
  bar.querySelector('[data-stat="contatos-semana"]').textContent=weekCount;

  // O.S Aguardando e O.S para Hoje
  const list=loadOSList();
  const todayISO=formatDateYYYYMMDD(new Date());
  const aguardando={reloj:0, joia:0, optica:0};
  const aguardandoRetirada={reloj:0, joia:0, optica:0};
  let osHoje=0;
  list.forEach(os=>{
    const tipo=os.tipo||'reloj';
    if(os.status==='oficina'){
      aguardando[tipo]=(aguardando[tipo]||0)+1;
      if(os.campos?.dataOficina===todayISO) osHoje++;
    }
    if(os.status==='aguardando'){
      aguardandoRetirada[tipo]=(aguardandoRetirada[tipo]||0)+1;
    }
  });
  bar.querySelector('[data-stat="os-aguardando-o"]').textContent=aguardando.optica||0;
  bar.querySelector('[data-stat="os-aguardando-r"]').textContent=aguardando.reloj||0;
  bar.querySelector('[data-stat="os-aguardando-j"]').textContent=aguardando.joia||0;
  bar.querySelector('[data-stat="os-retirada-o"]').textContent=aguardandoRetirada.optica||0;
  bar.querySelector('[data-stat="os-retirada-r"]').textContent=aguardandoRetirada.reloj||0;
  bar.querySelector('[data-stat="os-retirada-j"]').textContent=aguardandoRetirada.joia||0;
  bar.querySelector('[data-stat="os-hoje"]').textContent=osHoje;
}

function renderCalendario() {
  return `
  <div class="calendar-page">
    ${renderCalendarMenuBar()}
    <div class="card-grid">
      <div class="card" data-card-id="calendario" data-colspan="12">
        <div class="card-body calendario-wrapper">
          <div id="calendar" class="calendar">
            <div class="cal-toolbar">
              <div class="cal-actions">
                <button class="btn btn-cal-eventos">Adicionar Evento</button>
              </div>
              <div class="cal-nav">
                <button class="btn cal-prev" aria-label="Mês anterior">&#8249;</button>
                <h2 class="cal-mes monthTitle"></h2>
                <button class="btn cal-next" aria-label="Próximo mês">&#8250;</button>
              </div>
              <div class="cal-controls">
                <div class="cal-selects">
                  <select class="cal-mes-select" aria-label="Mês"></select>
                  <select class="cal-ano" aria-label="Ano"></select>
                </div>
                <button class="btn cal-hoje">Hoje</button>
                <div class="segmented" role="group" aria-label="Modo de visualização">
                  <button class="seg-btn" data-modo="mes" aria-pressed="true">Mês</button>
                  <button class="seg-btn" data-modo="semana" aria-pressed="false">Semana</button>
                </div>
              </div>
            </div>
            <div class="cal-weekdays"></div>
            <div class="cal-week-nav">
              <button class="btn cal-prev-week">&#8249; Semana</button>
              <button class="btn cal-next-week">Semana &#8250;</button>
            </div>
            <div class="cal-grid"></div>
            <div id="calPopoverLayer" class="cal-popover-layer"></div>
            <div class="cal-empty empty-state" style="display:none">Nada por aqui ainda</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>`;
}

function renderCalendarioFolgas(){
  return `
  <div class="card-grid">
    <div class="card" data-card-id="calendario-folgas" data-colspan="12">
      <div class="card-header">
        <div class="card-head">Folgas</div>
        <div class="card-subtitle">Área reservada para gerenciamento de folgas.</div>
      </div>
      <div class="card-body">
        <div class="empty-state">Conteúdo em preparação.</div>
      </div>
    </div>
  </div>`;
}

function renderCalendarioVisualizador(){
  return `
  <div class="card-grid">
    <div class="card" data-card-id="calendario-visualizador" data-colspan="12">
      <div class="card-header">
        <div class="card-head">Visualizador de calendários</div>
        <div class="card-subtitle">Ferramentas de visualização serão adicionadas em breve.</div>
      </div>
      <div class="card-body">
        <div class="empty-state">Nenhum conteúdo disponível no momento.</div>
      </div>
    </div>
  </div>`;
}
function clientesStatsBar(totalClientes, doneMonth){
  return `
  <div class="balloon balloon--menu-bar clientes-menu">
    <div class="mini-card stats-card clientes-cadastrados"><div class="stats-title">Clientes Cadastrados:</div><div class="stats-value" data-stat="clientes-total">${totalClientes}</div></div>
    <div class="mini-card stats-card"><div class="stats-title">Contatos esse Mês:</div><div class="stats-value" data-stat="contatos-mes">${doneMonth}</div></div>
    <div class="mini-card"><small>Reservado</small></div>
    <div class="mini-card"><small>Reservado</small></div>
  </div>`;
}

function updateClientesStats(){
  const bar=document.querySelector('.clientes-menu');
  if(!bar) return;
  const total=db.listarClientes().length;
  const {doneMonth}=getFollowupsStats();
  const totalEl=bar.querySelector('[data-stat="clientes-total"]');
  if(totalEl) totalEl.textContent=total;
  const doneEl=bar.querySelector('[data-stat="contatos-mes"]');
  if(doneEl) doneEl.textContent=doneMonth;
}
function renderClientesVisaoGeral() {
  const totalClientes=db.listarClientes().length;
  const {doneMonth}=getFollowupsStats();
  return `
  ${clientesStatsBar(totalClientes, doneMonth)}
  <div class="card-grid">
    <div class="card" data-card-id="lista-clientes" data-colspan="6">
      <div class="card-header">
        <div class="card-head">Lista de Clientes</div>
        <div class="list-toolbar clients-toolbar">
          <div class="search-wrap">
            <span class="icon">${iconSearch}</span>
            <input id="clientSearch" class="search-input" type="search" placeholder="Pesquisar clientes…" aria-label="Pesquisar clientes" />
          </div>
          <div class="filters-wrap">
            <button id="tagMenuBtn" type="button" class="btn-dropdown">Etiquetas ▾</button>
          </div>
          <button id="addClientBtn" class="btn-icon btn-plus add-cliente" data-action="client:new" aria-label="Adicionar" title="Adicionar">${iconPlus}</button>
        </div>
      </div>
      <div class="card-body table-wrapper">
        <table class="table table-clients">
          <thead>
            <tr>
              <th data-field="nome" class="sortable" tabindex="0" role="button" aria-sort="none">NOME<span class="sort-indicator"></span></th>
              <th>TELEFONE</th>
              <th data-field="data" class="sortable" tabindex="0" role="button" aria-sort="none">ULTIMA COMPRA<span class="sort-indicator"></span></th>
            </tr>
          </thead>
          <tbody id="clientsTbody"></tbody>
        </table>
      </div>
      <div class="card-footer clients-pagination">
        <button class="btn prev-page" aria-label="Página anterior">Anterior</button>
        <span class="page-info"></span>
        <select class="page-size">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
        <button class="btn next-page" aria-label="Próxima página">Próxima</button>
      </div>
    </div>
    <div class="card" data-card-id="detalhe-cliente" data-colspan="6">
      <div class="card-header">
        <div class="card-head">Detalhe do Cliente</div>
      </div>
      <div class="card-body detalhe-body">
        <div class="empty-state">Selecione um cliente à esquerda</div>
      </div>
    </div>
  </div>`;
}

function renderClientesCadastro(){
  return `
  <div class="card-grid">
    <div class="card" data-card-id="cadastro-clientes" data-colspan="12">
      <div class="card-header">
        <div class="card-head">Cadastro de Clientes</div>
        <div class="card-subtitle">Utilize o formulário completo abaixo para registrar novos clientes com todos os detalhes.</div>
      </div>
      <div class="card-body">
        ${clienteFormTemplate({ includeObservacoes:false, includePurchaseSection:true, includeActions:true, actionLabel:'Salvar Cliente' })}
      </div>
    </div>
  </div>`;
}

function renderClientesTabela(){
  return `
  <div class="card-grid">
    <div class="card" data-card-id="tabela-clientes" data-colspan="12">
      <div class="card-header">
        <div class="card-head">Tabela de Clientes</div>
        <div class="list-toolbar clients-toolbar">
          <div class="search-wrap">
            <span class="icon">${iconSearch}</span>
            <input id="clientTableSearch" class="search-input" type="search" placeholder="Pesquisar clientes…" aria-label="Pesquisar clientes" />
          </div>
          <div class="filters-wrap">
            <button id="tagMenuBtn" type="button" class="btn-dropdown">Etiquetas ▾</button>
          </div>
          <button class="btn-icon btn-plus add-cliente" data-action="client:new" aria-label="Adicionar" title="Adicionar">${iconPlus}</button>
        </div>
      </div>
      <div class="card-body table-wrapper">
        <table class="table table-clients table-clients-full">
          <thead>
            <tr>
              <th class="select-col select-toggle" scope="col"><input type="checkbox" id="clientSelectAll" aria-label="Selecionar todos os clientes da página"></th>
              <th data-field="nome" class="sortable" tabindex="0" role="button" aria-sort="none">NOME<span class="sort-indicator"></span></th>
              <th data-field="telefone">TELEFONE</th>
              <th data-field="cpf">CPF</th>
              <th data-field="genero">GÊNERO</th>
              <th data-field="interesses">INTERESSES</th>
              <th data-field="data" class="sortable" tabindex="0" role="button" aria-sort="none">ÚLTIMA COMPRA<span class="sort-indicator"></span></th>
              <th data-field="valor" class="sortable" tabindex="0" role="button" aria-sort="none">VALOR ÚLTIMA COMPRA<span class="sort-indicator"></span></th>
              <th class="contacts-col" scope="col">CONTATOS</th>
              <th data-field="quantidade" class="sortable" tabindex="0" role="button" aria-sort="none">COMPRAS<span class="sort-indicator"></span></th>
            </tr>
          </thead>
          <tbody id="clientsFullTbody"></tbody>
        </table>
      </div>
      <div class="card-footer clients-pagination clients-table-pagination">
        <button class="btn prev-page" aria-label="Página anterior">Anterior</button>
        <span class="page-info"></span>
        <select class="page-size">
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
        <button class="btn next-page" aria-label="Próxima página">Próxima</button>
      </div>
    </div>
  </div>`;
}

function renderClientePagina(){
  return `
  <section id="clientePage" class="cliente-page">
    <div class="cliente-page-topbar">
      <button type="button" class="cliente-back-button" data-action="cliente-voltar" aria-label="Voltar para Tabela de Clientes">${iconArrowLeft}</button>
      <div class="cliente-page-topbar-info">
        <h2 id="clientePageTitle">Página do Cliente</h2>
        <p id="clientePageSubtitle" class="cliente-page-subtitle"></p>
      </div>
      <div class="cliente-page-topbar-actions">
        <label class="contact-pref" aria-label="Marcar cliente como não contatável">
          <input type="checkbox" class="switch" data-action="cliente-toggle-nao-contate" disabled>
          <span>Não contate</span>
        </label>
        <button type="button" class="btn btn-primary" data-action="cliente-editar" disabled>Editar cliente</button>
      </div>
    </div>
    <div class="cliente-page-empty">
      <div class="empty-state">Selecione um cliente na Tabela de Clientes para visualizar os detalhes.</div>
    </div>
    <div class="cliente-page-sections" hidden>
      <section class="cliente-section cliente-section--dados">
        <header class="cliente-section-header"><h3>Dados Pessoais</h3></header>
        <div class="cliente-section-body" id="clienteDadosPessoais"></div>
      </section>
      <section class="cliente-section cliente-section--compras">
        <header class="cliente-section-header">
          <h3>Histórico de Compras</h3>
          <div class="cliente-section-actions">
            <button type="button" class="btn btn-primary" data-action="cliente-nova-compra" disabled>Adicionar nova compra</button>
          </div>
        </header>
        <div class="cliente-section-body" id="clienteHistoricoCompras"></div>
      </section>
      <section class="cliente-section cliente-section--contatos">
        <header class="cliente-section-header"><h3>Contatos</h3></header>
        <div class="cliente-section-body" id="clienteHistoricoContatos"></div>
      </section>
    </div>
  </section>`;
}

const GARANTIA_KEYS = {
  optica: 'garantia.optica',
  joia: 'garantia.joalheria',
  reloj: 'garantia.relojoaria'
};
function loadGarantias(){
  const notas={};
  for(const k in GARANTIA_KEYS){
    notas[k]=localStorage.getItem(GARANTIA_KEYS[k])||'';
  }
  return notas;
}
function saveGarantias(data){
  for(const k in GARANTIA_KEYS){
    if(k in data){
      localStorage.setItem(GARANTIA_KEYS[k], data[k]||'');
    }
  }
}
function getGarantiaTexto(tipo){
  const key=GARANTIA_KEYS[tipo];
  return key ? (localStorage.getItem(key)||'') : '';
}
function renderOS() {
  if(currentProfile()==='Administrador'){
    const notas = loadGarantias();
    const block = (label,key)=>`
      <div class="garantia-block">
        <h3>Garantia ${label}</h3>
        <textarea id="garantia-${key}" rows="4">${notas[key]||''}</textarea>
        <button class="btn btn-primary" data-save="${key}">Salvar</button>
      </div>`;
    return `
    <section id="osAdminNotes" class="garantia-page">
      ${block('Óptica','optica')}
      ${block('Joalheria','joia')}
      ${block('Relojoaria','reloj')}
    </section>`;
  }
  return `
  <section id="osPage">
    ${OSMenuBar()}
    <div id="osEmpty" class="os-empty" hidden>
      <p>Nenhuma OS encontrada</p>
      <button id="btnNovaOSEmpty" class="btn btn-primary">Criar sua primeira OS</button>
    </div>
    ${OSKanbanHolder()}
    ${OSCompletedTable()}
  </section>`;
}

function dashboardPage() {
  return `<section id="dashboard">`+
    `<div class="dash-toolbar">`+
      `<div class="dash-heading">Dashboard</div>`+
      `<button id="dashAddBtn" class="dash-add">Adicionar widget</button>`+
    `</div>`+
    `<div id="dashboardGrid" class="dashboard-grid"></div>`+
  `</section>`;
}

function renderContatosPlaceholder(title, slug){
  return `
  <section class="contatos-page contatos-${slug}">
    <div class="card-grid">
      <div class="card" data-card-id="contatos-${slug}" data-colspan="12">
        <div class="card-header"><div class="card-head">${title}</div></div>
        <div class="card-body"><div class="empty-state">Conteúdo em preparação.</div></div>
      </div>
    </div>
  </section>`;
}

function renderContatosExecutar(){
  return renderContatosPlaceholder('Contatos a Executar','executar');
}

function renderContatosListas(){
  return renderContatosPlaceholder('Listas de Contatos','listas');
}

function renderContatosPosVenda(){
  return renderContatosPlaceholder('Pós Venda','pos-venda');
}

function renderContatosOfertas(){
  return renderContatosPlaceholder('Ofertas','ofertas');
}

const CONTATOS_HISTORICO_DATA={
  'pos-venda':[
    { cliente:'Ana Souza', ultimaCompra:'12/01/2024', ultimoContato:'15/02/2024', responsavel:'Carla Mendes', status:'Concluído' },
    { cliente:'Bruno Lima', ultimaCompra:'28/02/2024', ultimoContato:'05/03/2024', responsavel:'Paulo Sérgio', status:'Em acompanhamento' },
    { cliente:'Camila Rocha', ultimaCompra:'09/03/2024', ultimoContato:'20/03/2024', responsavel:'Lívia Prado', status:'Pendente' }
  ],
  ofertas:[
    { cliente:'Daniel Alves', ultimaCompra:'18/01/2024', ultimoContato:'10/02/2024', responsavel:'Roberta Dias', status:'Oferta enviada' },
    { cliente:'Eduarda Nunes', ultimaCompra:'22/02/2024', ultimoContato:'02/03/2024', responsavel:'Marcos Paulo', status:'Aguardando retorno' },
    { cliente:'Felipe Barbosa', ultimaCompra:'30/03/2024', ultimoContato:'08/04/2024', responsavel:'Sofia Martins', status:'Oferta convertida' }
  ]
};

function renderHistoricoTable(rows){
  if(!rows?.length){
    return '<div class="empty-state">Nenhum registro disponível.</div>';
  }
  return `<table class="historico-table">`
    +'<thead><tr><th>Cliente</th><th>Última compra</th><th>Último contato</th><th>Responsável</th><th>Status</th></tr></thead>'
    +'<tbody>'
    +rows.map(row=>`<tr><td>${escapeHtml(row.cliente)}</td><td>${escapeHtml(row.ultimaCompra)}</td><td>${escapeHtml(row.ultimoContato)}</td><td>${escapeHtml(row.responsavel)}</td><td>${escapeHtml(row.status)}</td></tr>`).join('')
    +'</tbody></table>';
}

function renderContatosHistorico(){
  const posVendaTable=renderHistoricoTable(CONTATOS_HISTORICO_DATA['pos-venda']);
  const ofertasTable=renderHistoricoTable(CONTATOS_HISTORICO_DATA.ofertas);
  return `
  <section id="contatosHistorico" class="contatos-historico">
    <div class="historico-tabs" role="tablist">
      <button type="button" class="historico-tab is-active" data-tab="pos-venda">Pós Venda</button>
      <button type="button" class="historico-tab" data-tab="ofertas">Ofertas</button>
    </div>
    <div class="card-grid historico-grid">
      <div class="card historico-card" data-colspan="12" data-tab-content="pos-venda">
        <div class="card-header"><div class="card-head">Histórico de Pós Venda</div></div>
        <div class="card-body">${posVendaTable}</div>
      </div>
      <div class="card historico-card" data-colspan="12" data-tab-content="ofertas" hidden>
        <div class="card-header"><div class="card-head">Histórico de Ofertas</div></div>
        <div class="card-body">${ofertasTable}</div>
      </div>
    </div>
  </section>`;
}

function renderGerenciaConfig() {
  return `
  <div class="card-grid">
    <div class="card" data-card-id="loja" data-colspan="6" data-rowspan="2">
      <div class="card-header"><div class="card-head">Loja</div></div>
      <div class="card-body">
        <form id="loja-form" class="form-grid">
          <div class="form-field col-span-12">
            <label>Logo da empresa</label>
            <div class="loja-logo-field">
              <img id="loja-logo-preview" class="loja-logo-preview" alt="Logo">
              <button type="button" id="loja-logo-btn" class="btn">Selecionar</button>
              <input type="file" id="loja-logo" accept="image/*" hidden>
            </div>
          </div>
          <div class="form-field col-span-6"><label for="loja-nome">Nome da loja</label><input id="loja-nome" class="text-input"></div>
          <div class="form-field col-span-6"><label for="loja-telefone">Telefone</label><input id="loja-telefone" class="text-input"></div>
          <div class="form-field col-span-12"><label for="loja-endereco">Endereço</label><input id="loja-endereco" class="text-input"></div>
          <div class="form-field col-span-12"><label for="loja-instagram">Instagram</label><input id="loja-instagram" class="text-input" placeholder="@usuario"></div>
          <div class="form-field col-span-12"><button type="submit" class="btn btn-primary">Salvar</button></div>
        </form>
      </div>
    </div>
    <div class="card" data-card-id="usuarios" data-colspan="4" data-rowspan="2">
      <div class="card-header">
        <div class="card-head">Usuários</div>
        <button class="btn-icon btn-plus add-usuario" aria-label="Adicionar" title="Adicionar">${iconPlus}</button>
      </div>
      <div class="card-body">
        <table class="table table-usuarios">
          <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ações</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    <div class="card empty-state" data-card-id="ph1"></div>
    <div class="card empty-state" data-card-id="ph2"></div>
  </div>`;
}

function renderConfig() {
  if (getPerfil() !== 'Administrador') { location.hash = '#/dashboard'; return ''; }
  return `
  <div class="card-grid">
    <div class="card" data-card-id="usuarios" data-colspan="4" data-rowspan="2">
      <div class="card-header">
        <div class="card-head">Usuários</div>
        <button class="btn-icon btn-plus add-usuario" aria-label="Adicionar" title="Adicionar">${iconPlus}</button>
      </div>
      <div class="card-body">
        <table class="table table-usuarios">
          <thead><tr><th>Nome</th><th>Email</th><th>Perfil</th><th>Ações</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
    <div class="card empty-state" data-card-id="ph1"></div>
    <div class="card empty-state" data-card-id="ph2"></div>
    <div class="card empty-state" data-card-id="ph3"></div>
    <div class="card empty-state" data-card-id="ph4"></div>
  </div>`;
}

function renderGerenciaMensagens(){
  return `
  <section id="gerenciaMensagens" class="gerencia-mensagens">
    <div class="mensagens-tabs" role="tablist">
      <button type="button" class="mensagem-tab is-active" data-tab="pos-venda">Pós Venda</button>
      <button type="button" class="mensagem-tab" data-tab="ofertas">Ofertas</button>
    </div>
    <div class="card-grid mensagens-grid">
      <div class="card mensagens-card" data-colspan="12" data-tab-content="pos-venda">
        <div class="card-header"><div class="card-head">Pós Venda</div></div>
        <div class="card-body"><div class="empty-state">Conteúdo em preparação.</div></div>
      </div>
      <div class="card mensagens-card" data-colspan="12" data-tab-content="ofertas" hidden>
        <div class="card-header"><div class="card-head">Ofertas</div></div>
        <div class="card-body"><div class="empty-state">Conteúdo em preparação.</div></div>
      </div>
    </div>
  </section>`;
}

// ===== Helpers =====
function uuid() {
  return Math.random().toString(36).slice(2, 11);
}

function formatTelefone(t) {
  return t.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
}

function formatDateDDMMYYYY(dateLike) {
  if(!dateLike) return '';
  let d;
  if(typeof dateLike === 'string'){
    const parts=dateLike.split('/');
    if(parts.length===3){
      const [dd,mm,yy]=parts.map(Number);
      d=new Date(yy,mm-1,dd);
    } else {
      d=new Date(dateLike);
    }
  } else {
    d=new Date(dateLike);
  }
  if(isNaN(d.getTime())) return '';
  const day=String(d.getDate()).padStart(2,'0');
  const month=String(d.getMonth()+1).padStart(2,'0');
  const year=d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateYYYYMMDD(dateLike){
  if(!dateLike) return '';
  let d;
  if(typeof dateLike === 'string'){
    const parts=dateLike.split('/');
    if(parts.length===3){
      const [dd,mm,yy]=parts.map(Number);
      d=new Date(yy,mm-1,dd);
    } else {
      d=new Date(dateLike);
    }
  } else {
    d=new Date(dateLike);
  }
  if(isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function formatCurrency(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatCpf(c) {
  return c ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';
}

function getUltimaCompra(compras = []) {
  return compras.reduce((latest, cp) =>
    (!latest || cp.dataCompra.localeCompare(latest.dataCompra) > 0) ? cp : latest, null);
}

const iconSearch='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
const iconPlus='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
const iconEdit='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
const iconTrash='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const iconArrowLeft='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="12" x2="21" y2="12"/></svg>';

const FOLLOWUP_PERIODS=['3m','6m','12m'];
const FOLLOWUP_OFFSETS={ '3m':90, '6m':180, '12m':365 };
const FOLLOWUP_LABELS={ '3m':'3 meses','6m':'6 meses','12m':'12 meses' };

function escapeHtml(str=''){
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

const CLIENT_STATUS={
  POS_VENDA:{ key:'pos-venda', label:'P.V', ariaLabel:'Pós Venda' },
  LISTA_OFERTAS:{ key:'lista-ofertas', label:'O.F', ariaLabel:'Lista de Ofertas' },
  NAO_CONTATE:{ key:'nao-contate', label:'N.C', ariaLabel:'Não Contate' }
};

const DAY_IN_MS=24*60*60*1000;

function toSafeDate(value){
  if(!value) return null;
  if(value instanceof Date){
    return isNaN(value.getTime())?null:value;
  }
  if(typeof value==='string' && value.includes('/')){
    const parsed=parseDDMMYYYY(value);
    return isNaN(parsed.getTime())?null:parsed;
  }
  const date=new Date(value);
  return isNaN(date.getTime())?null:date;
}

function compraTemFollowupPendente(compra){
  if(!compra) return false;
  const followUps=compra.followUps || {};
  return FOLLOWUP_PERIODS.some(period=>!followUps[period]?.done);
}

function getClientStatus(cliente){
  if(!cliente) return CLIENT_STATUS.LISTA_OFERTAS;
  if(cliente.naoContate) return CLIENT_STATUS.NAO_CONTATE;
  const compras=cliente.compras || [];
  if(!compras.length) return CLIENT_STATUS.LISTA_OFERTAS;
  const now=Date.now();
  const hasPending=compras.some(compra=>{
    const date=toSafeDate(compra?.dataCompra || compra?.dataISO);
    if(!date) return false;
    const diff=(now-date.getTime())/DAY_IN_MS;
    if(diff>365) return false;
    return compraTemFollowupPendente(compra);
  });
  return hasPending ? CLIENT_STATUS.POS_VENDA : CLIENT_STATUS.LISTA_OFERTAS;
}

function renderClientStatusBadge(cliente){
  const status=getClientStatus(cliente);
  if(!status) return '';
  const aria=status.ariaLabel || status.label;
  return `<span class="client-status-badge client-status-${status.key}" aria-label="${aria}">${status.label}</span>`;
}

function renderClientNameInline(cliente){
  const rawName=cliente?.nome;
  const name=escapeHtml(rawName || 'Cliente');
  const badge=renderClientStatusBadge(cliente);
  return `<span class="client-name-with-status"><span class="client-name-text">${name}</span>${badge}</span>`;
}

function buildFollowupBadges(cp){
  const followUps=cp?.followUps || {};
  const badges=FOLLOWUP_PERIODS.map(period=>{
    const info=followUps[period];
    const done=!!info?.done;
    const doneDate=done && info?.doneAt ? formatDateDDMMYYYY(info.doneAt) : '';
    const tooltip=done ? (doneDate ? `Realizado em ${doneDate}` : 'Realizado') : 'Pendente';
    return `<span class="followup-badge ${done?'is-done':'is-pending'}" title="${tooltip}">${FOLLOWUP_LABELS[period]||period}</span>`;
  }).join('');
  return `<div class="followup-badges">${badges}</div>`;
}

function buildRxTable(cp){
  const rx=cp?.receituario;
  if(!rx) return '';
  const fields=['esferico','cilindrico','eixo','dnp','adicao'];
  const hasData=fields.some(key=>{
    const oe=rx.oe?.[key];
    const od=rx.od?.[key];
    return (oe && String(oe).trim()!=='') || (od && String(od).trim()!=='');
  });
  if(!hasData) return '';
  const makeRow=side=>fields.map(key=>rx[side]?.[key]||'').map(val=>`<td>${val||''}</td>`).join('');
  return `
      <div class="rx-table-wrapper">
        <table class="rx-table">
          <thead><tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>DNP</th><th>Adição</th></tr></thead>
          <tbody>
            <tr><td>OE</td>${makeRow('oe')}</tr>
            <tr><td>OD</td>${makeRow('od')}</tr>
          </tbody>
        </table>
      </div>`;
}

function clienteFormTemplate({ includeObservacoes=false, includePurchaseSection=true, includeActions=false, actionLabel='Salvar Cliente' }={}){
  return `
        <form id="cliente-form">
        <input type="hidden" id="cliente-id">
        <div class="modal-section">
          <h3>Dados Pessoais</h3>
          <div class="form-grid">
            <div class="form-field col-span-12"><label for="cliente-nome">Nome *</label><input id="cliente-nome" name="nome" class="text-input" maxlength="80" required></div>
            <div class="form-field col-span-4"><label for="cliente-telefone">Telefone *</label><input id="cliente-telefone" name="telefone" class="text-input" required placeholder="(00) 00000-0000"></div>
            <div class="form-field col-span-4"><label for="cliente-dataNascimento">Data de Nascimento</label><input id="cliente-dataNascimento" type="date" name="dataNascimento" class="date-input"></div>
            <div class="form-field col-span-4"><label for="cliente-cpf">CPF</label><input id="cliente-cpf" name="cpf" class="text-input" placeholder="000.000.000-00"></div>
            <div class="form-field col-span-4"><span class="field-label">Gênero</span>
              <div class="segmented" id="cliente-genero" role="group">
                <button type="button" class="seg-btn" data-value="M" aria-pressed="false">M</button>
                <button type="button" class="seg-btn" data-value="F" aria-pressed="false">F</button>
              </div>
            </div>
            <div class="form-field col-span-12"><span class="field-label">Interesses:</span>
              <div class="chips" id="cliente-interesses" role="group">
                <button type="button" class="chip" data-value="Relógios" aria-pressed="false">Relógios</button>
                <button type="button" class="chip" data-value="Jóias Ouro" aria-pressed="false">Jóias Ouro</button>
                <button type="button" class="chip" data-value="Jóias Prata" aria-pressed="false">Jóias Prata</button>
                <button type="button" class="chip" data-value="Óptica" aria-pressed="false">Óptica</button>
                <button type="button" class="chip" data-value="V.S" aria-pressed="false">V.S</button>
                <button type="button" class="chip" data-value="M.F" aria-pressed="false">M.F</button>
                <button type="button" class="chip" data-value="BIFOCAL" aria-pressed="false">BIFOCAL</button>
                <button type="button" class="chip" data-value="SOLAR" aria-pressed="false">SOLAR</button>
              </div>
            </div>
            <div class="form-field col-span-4">
              <span class="field-label">Preferência de contato</span>
              <label class="contact-pref">
                <input type="checkbox" id="cliente-nao-contate" class="switch">
                <span>Não contatar</span>
              </label>
              <small class="field-hint">Marque quando o cliente optar por não receber contato.</small>
            </div>
            ${includeObservacoes ? '<div class="form-field col-span-12"><label for="cliente-observacoes">Observações</label><textarea id="cliente-observacoes" name="observacoes" class="textarea" rows="4"></textarea></div>' : ''}
          </div>
        </div>
        ${includePurchaseSection ? `
        <div class="modal-section">
          <h3>Dados da Compra</h3>
          <div class="form-grid">
            <div class="form-field col-span-4"><label for="compra-data">Data da Compra *</label><input id="compra-data" type="date" name="dataCompra" class="date-input" required></div>
            <div class="form-field col-span-4"><label for="compra-valor">Valor da Lente (R$)</label><input id="compra-valor" name="valorLente" class="text-input" placeholder="0,00" inputmode="decimal"></div>
            <div class="form-field col-span-4"><label for="compra-nfe">NFE/NFC-e</label><input id="compra-nfe" name="nfe" class="text-input"></div>
            <div class="form-field col-span-12"><label for="compra-armacao">Armação</label><input id="compra-armacao" name="armacao" class="text-input"></div>
              <div class="form-field col-span-12"><span class="field-label">Material da armação</span>
              <div class="segmented" id="compra-material" role="group">
                <button type="button" class="seg-btn" data-value="ACETATO" aria-pressed="false">ACETATO</button>
                <button type="button" class="seg-btn" data-value="METAL" aria-pressed="false">METAL</button>
                <button type="button" class="seg-btn" data-value="TITANIUM" aria-pressed="false">TITANIUM</button>
                <button type="button" class="seg-btn" data-value="OUTRO" aria-pressed="false">OUTRO</button>
              </div>
            </div>
            <div class="form-field col-span-12"><label for="compra-lente">Lente</label><input id="compra-lente" name="lente" class="text-input"></div>
              <div class="form-field col-span-12"><span class="field-label">Tipos de compra</span>
              <div class="segmented" id="compra-tipos" role="group">
                <button type="button" class="seg-btn" data-value="V.S" aria-pressed="false">V.S</button>
                <button type="button" class="seg-btn" data-value="M.F" aria-pressed="false">M.F</button>
                <button type="button" class="seg-btn" data-value="SOLAR" aria-pressed="false">SOLAR</button>
              </div>
            </div>
            <div class="form-field col-span-12"><label for="compra-observacoes">Observações</label><textarea id="compra-observacoes" name="observacoes" class="textarea" rows="3"></textarea></div>
            <fieldset class="col-span-12">
              <legend class="field-label">Receituário</legend>
              <div class="receituario">
                <div class="rx-table-wrapper">
                  <table class="rx-table">
                    <thead>
                      <tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>DNP</th><th>Adição</th></tr>
                    </thead>
                    <tbody>
                      <tr><td>OE</td><td><input name="oe_esferico"></td><td><input name="oe_cilindrico"></td><td><input name="oe_eixo"></td><td><input name="oe_dnp"></td><td><input name="oe_adicao"></td></tr>
                      <tr><td>OD</td><td><input name="od_esferico"></td><td><input name="od_cilindrico"></td><td><input name="od_eixo"></td><td><input name="od_dnp"></td><td><input name="od_adicao"></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </fieldset>
          </div>
        </div>
        ` : ''}
        ${includeActions ? `
        <div class="form-actions">
          <button type="reset" class="btn btn-outline">Limpar</button>
          <button type="button" class="btn btn-primary" data-action="client:save">${actionLabel}</button>
        </div>
        ` : ''}
        </form>`;
}

function initClienteForm(form, { cliente=null, includePurchaseSection=true }={}){
  if(!form) return;
  form.dataset.id = cliente?.id || '';
  const idInput=form.querySelector('#cliente-id');
  if(idInput) idInput.value=cliente?.id || '';

  const nomeInput=form.querySelector('#cliente-nome');
  if(nomeInput) nomeInput.value=cliente?.nome || '';

  const telInput=form.querySelector('#cliente-telefone');
  if(telInput){
    const maskTelefone=()=>{
      let digits=telInput.value.replace(/\D/g,'').slice(0,11);
      telInput.value=digits?formatTelefone(digits):'';
    };
    telInput.addEventListener('input', maskTelefone);
    if(cliente?.telefone) telInput.value=formatTelefone(cliente.telefone);
  }

  const dataNascimento=form.querySelector('#cliente-dataNascimento');
  if(dataNascimento) dataNascimento.value=cliente?.dataNascimento || '';

  const cpfInput=form.querySelector('#cliente-cpf');
  if(cpfInput) cpfInput.value=cliente?.cpf || '';

  const interessesDiv=form.querySelector('#cliente-interesses');
  if(interessesDiv){
    const interesseButtons=Array.from(interessesDiv.querySelectorAll('button'));
    interesseButtons.forEach(btn=>{
      btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click',()=>{
        const pressed=btn.getAttribute('aria-pressed')==='true';
        btn.setAttribute('aria-pressed',(!pressed).toString());
      });
    });
    const interesses=(cliente?.interesses||cliente?.usos)||[];
    interesses.forEach(val=>{
      interessesDiv.querySelector(`button[data-value="${val}"]`)?.setAttribute('aria-pressed','true');
    });
  }

  const naoContateInput=form.querySelector('#cliente-nao-contate');
  if(naoContateInput){
    naoContateInput.checked=!!cliente?.naoContate;
  }

  const generoDiv=form.querySelector('#cliente-genero');
  if(generoDiv){
    const generoButtons=Array.from(generoDiv.querySelectorAll('button'));
    generoButtons.forEach(btn=>{
      btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click',()=>{
        generoButtons.forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
      });
    });
    if(cliente?.genero){
      generoDiv.querySelector(`button[data-value="${cliente.genero}"]`)?.setAttribute('aria-pressed','true');
    }
  }

  const obsInput=form.querySelector('#cliente-observacoes');
  if(obsInput) obsInput.value=cliente?.observacoes || '';

  const valorInput=form.querySelector('#compra-valor');
  if(valorInput){
    valorInput.addEventListener('input',()=>{
      let digits=valorInput.value.replace(/\D/g,'');
      valorInput.value=digits? (Number(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'';
    });
  }

  if(includePurchaseSection){
    const dataInput=form.querySelector('#compra-data');
    if(dataInput && !dataInput.value){
      dataInput.value=new Date().toISOString().slice(0,10);
    }
    const materialDiv=form.querySelector('#compra-material');
    materialDiv?.querySelectorAll('button').forEach(btn=>{
      btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click',()=>{
        materialDiv.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
      });
    });
    const tiposDiv=form.querySelector('#compra-tipos');
    tiposDiv?.querySelectorAll('button').forEach(btn=>{
      btn.setAttribute('aria-pressed','false');
      btn.addEventListener('click',()=>{
        const pressed=btn.getAttribute('aria-pressed')==='true';
        btn.setAttribute('aria-pressed',(!pressed).toString());
      });
    });
  }

  form.addEventListener('reset',()=>{
    setTimeout(()=>{
      form.dataset.id='';
      if(idInput) idInput.value='';
      if(nomeInput) nomeInput.value='';
      if(telInput) telInput.value='';
      if(dataNascimento) dataNascimento.value='';
      if(cpfInput) cpfInput.value='';
      if(obsInput) obsInput.value='';
      const naoContate=form.querySelector('#cliente-nao-contate');
      if(naoContate) naoContate.checked=false;
      form.querySelectorAll('#cliente-interesses button').forEach(btn=>btn.setAttribute('aria-pressed','false'));
      form.querySelectorAll('#cliente-genero .seg-btn').forEach(btn=>btn.setAttribute('aria-pressed','false'));
      if(includePurchaseSection){
        const dataInput=form.querySelector('#compra-data');
        if(dataInput) dataInput.value=new Date().toISOString().slice(0,10);
        form.querySelectorAll('#compra-material .seg-btn, #compra-tipos .seg-btn').forEach(btn=>btn.setAttribute('aria-pressed','false'));
        form.querySelectorAll('#compra-armacao, #compra-lente, #compra-nfe, #compra-valor, #compra-observacoes').forEach(el=>{ if(el) el.value=''; });
        form.querySelectorAll('.rx-table input').forEach(input=>{ input.value=''; });
      }
    },0);
  });

  if(cliente){
    if(obsInput) obsInput.value=cliente.observacoes || '';
  }
}

function openClienteModal(id, onSave) {
  const modal = document.getElementById('app-modal');
  const pageBtn = modal.querySelector('.modal-header .modal-client-page-btn');
  if(pageBtn){
    pageBtn.hidden = true;
    pageBtn.onclick = null;
  }
  const saveBtn = modal.querySelector('#modal-save');
  saveBtn.removeAttribute('data-action');
  saveBtn.setAttribute('type','submit');
  const title = document.getElementById('modal-title');
  const body = modal.querySelector('.modal-body');
  const content = modal.querySelector('.modal-dialog');
  content.classList.remove('modal-novo-cliente','modal-editar-cliente','modal-nova-compra');
  content.classList.add(id ? 'modal-editar-cliente' : 'modal-novo-cliente');
  const cliente = id ? db.buscarPorId(id) : null;
  title.textContent = id ? 'Editar Cliente' : 'Novo Cliente';
  body.replaceChildren();
  body.insertAdjacentHTML('afterbegin', clienteFormTemplate({ includeObservacoes: Boolean(id), includePurchaseSection: !id, includeActions: false }));
  saveBtn.setAttribute('form','cliente-form');
  saveBtn.setAttribute('data-action','client:save');
  saveBtn.setAttribute('type','button');
  const cancelBtn = modal.querySelector('[data-modal-close]');
  cancelBtn.setAttribute('data-action','client:cancel');
  const form = body.querySelector('#cliente-form');
  initClienteForm(form, { cliente, includePurchaseSection: !id });
  clientModalOnSave = onSave;
  modal.open();
}

function openCompraModal(clienteId, compraId, onSave) {
  const modal = document.getElementById('app-modal');
  const pageBtn = modal.querySelector('.modal-header .modal-client-page-btn');
  if(pageBtn){
    pageBtn.hidden = true;
    pageBtn.onclick = null;
  }
  const saveBtn = modal.querySelector('#modal-save');
  saveBtn.removeAttribute('data-action');
  saveBtn.setAttribute('type','submit');
  const title = document.getElementById('modal-title');
  const body = modal.querySelector('.modal-body');
  const content = modal.querySelector('.modal-dialog');
  content.classList.remove('modal-novo-cliente','modal-editar-cliente','modal-nova-compra');
  content.classList.add('modal-nova-compra');
  const cliente = db.buscarPorId(clienteId);
  const compra = compraId ? cliente.compras.find(cp => cp.id === compraId) : null;
  title.textContent = compra ? 'Editar Compra' : 'Nova Compra';
  body.replaceChildren();
  body.insertAdjacentHTML('afterbegin', `
    <form id="compra-form">
      <input type="hidden" id="purchaseClientId">
      <input type="hidden" id="purchaseId">
      <div class="modal-section">
        <h3>Dados da Compra</h3>
        <div class="form-grid">
          <div class="form-field col-span-4"><label for="compra-data">Data da Compra *</label><input id="compra-data" type="date" name="dataCompra" class="date-input" required></div>
          <div class="form-field col-span-4"><label for="compra-valor">Valor da Lente (R$)</label><input id="compra-valor" name="valorLente" class="text-input" placeholder="0,00" inputmode="decimal"></div>
          <div class="form-field col-span-4"><label for="compra-nfe">NFE/NFC-e</label><input id="compra-nfe" name="nfe" class="text-input"></div>
          <div class="form-field col-span-12"><label for="compra-armacao">Armação</label><input id="compra-armacao" name="armacao" class="text-input"></div>
            <div class="form-field col-span-12"><span class="field-label">Material da armação</span>
            <div class="segmented" id="compra-material" role="group">
              <button type="button" class="seg-btn" data-value="ACETATO" aria-pressed="false">ACETATO</button>
              <button type="button" class="seg-btn" data-value="METAL" aria-pressed="false">METAL</button>
              <button type="button" class="seg-btn" data-value="TITANIUM" aria-pressed="false">TITANIUM</button>
              <button type="button" class="seg-btn" data-value="OUTRO" aria-pressed="false">OUTRO</button>
            </div>
          </div>
          <div class="form-field col-span-12"><label for="compra-lente">Lente</label><input id="compra-lente" name="lente" class="text-input"></div>
            <div class="form-field col-span-12"><span class="field-label">Tipos de compra</span>
            <div class="segmented" id="compra-tipos" role="group">
              <button type="button" class="seg-btn" data-value="V.S" aria-pressed="false">V.S</button>
              <button type="button" class="seg-btn" data-value="M.F" aria-pressed="false">M.F</button>
              <button type="button" class="seg-btn" data-value="SOLAR" aria-pressed="false">SOLAR</button>
            </div>
          </div>
          <fieldset class="col-span-12">
            <legend>Receituário</legend>
            <div class="rx-table-wrapper">
              <table class="rx-table">
                <thead>
                  <tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>DNP</th><th>Adição</th></tr>
                </thead>
                <tbody>
                  <tr><td>OE</td><td><input name="oe_esferico"></td><td><input name="oe_cilindrico"></td><td><input name="oe_eixo"></td><td><input name="oe_dnp"></td><td><input name="oe_adicao"></td></tr>
                  <tr><td>OD</td><td><input name="od_esferico"></td><td><input name="od_cilindrico"></td><td><input name="od_eixo"></td><td><input name="od_dnp"></td><td><input name="od_adicao"></td></tr>
                </tbody>
              </table>
            </div>
          </fieldset>
        </div>
      </div>
    </form>`);
  saveBtn.setAttribute('form','compra-form');
  saveBtn.setAttribute('data-action','purchase:save');
  saveBtn.setAttribute('type','button');
  const cancelBtn = modal.querySelector('[data-modal-close]');
  cancelBtn.setAttribute('data-action','purchase:cancel');
  const form = body.querySelector('#compra-form');
  form.dataset.clienteId = clienteId;
  form.dataset.compraId = compraId || '';
  form.querySelector('#purchaseClientId').value = clienteId;
  form.querySelector('#purchaseId').value = compraId || '';
  purchaseModalOnSave = onSave;
  const today = new Date().toISOString().slice(0,10);
  form.dataCompra.value = compra ? compra.dataCompra : today;
  form.armacao.value = compra ? compra.armacao : '';
  form.lente.value = compra ? compra.lente : '';
  form.valorLente.value = compra ? formatCurrency(compra.valorLente) : '';
  form.valorLente.addEventListener('input', () => {
    let digits = form.valorLente.value.replace(/\D/g,'');
    form.valorLente.value = (Number(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  });
  form.nfe.value = compra ? (compra.nfe || '') : '';
  const tiposDiv = form.querySelector('#compra-tipos');
  tiposDiv.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const pressed=btn.getAttribute('aria-pressed')==='true';
      btn.setAttribute('aria-pressed',(!pressed).toString());
    });
  });
  const materialDiv = form.querySelector('#compra-material');
  materialDiv.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      materialDiv.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
      btn.setAttribute('aria-pressed','true');
    });
  });
  if(compra){
    tiposDiv.querySelectorAll('button').forEach(btn=>{ if((compra.tiposCompra||[]).includes(btn.dataset.value)) btn.setAttribute('aria-pressed','true'); });
    if(compra.armacaoMaterial) materialDiv.querySelector(`button[data-value="${compra.armacaoMaterial}"]`)?.setAttribute('aria-pressed','true');
  }
  const oe = compra?.receituario?.oe || {};
  const od = compra?.receituario?.od || {};
  form.oe_esferico.value = oe.esferico || '';
  form.oe_cilindrico.value = oe.cilindrico || '';
  form.oe_eixo.value = oe.eixo || '';
  form.oe_dnp.value = oe.dnp || '';
  form.oe_adicao.value = oe.adicao || '';
  form.od_esferico.value = od.esferico || '';
  form.od_cilindrico.value = od.cilindrico || '';
  form.od_eixo.value = od.eixo || '';
  form.od_dnp.value = od.dnp || '';
  form.od_adicao.value = od.adicao || '';
  modal.open();
}

function initCalendarioPage() {
  db.initComSeeds();
  const wrapper = document.querySelector('.calendario-wrapper');
  if(!wrapper) return;
  const calendarPage = document.querySelector('.calendar-page');
  const grid = wrapper.querySelector('.cal-grid');
  const emptyEl = wrapper.querySelector('.cal-empty');
  const monthEl = wrapper.querySelector('.cal-mes');
  const monthSelect = wrapper.querySelector('.cal-mes-select');
  const yearSelect = wrapper.querySelector('.cal-ano');
  const btnHoje = wrapper.querySelector('.cal-hoje');
  const btnEventos = calendarPage?.querySelector('.btn-cal-eventos');
  const btnDesf = calendarPage?.querySelector('.btn-cal-desfalques');
  const btnPrev = wrapper.querySelector('.cal-prev');
  const btnNext = wrapper.querySelector('.cal-next');
  const segBtns = wrapper.querySelectorAll('.seg-btn');
  const weekNav = wrapper.querySelector('.cal-week-nav');
  const btnPrevWeek = wrapper.querySelector('.cal-prev-week');
  const btnNextWeek = wrapper.querySelector('.cal-next-week');
  const weekdaysEl = wrapper.querySelector('.cal-weekdays');
  const dias = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  dias.forEach(d => { const div = document.createElement('div'); div.textContent = d; weekdaysEl.appendChild(div); });
  let currentDate = new Date();
  window.currentDate = currentDate;
  let modo = 'mes';
  const eventosKey = calKey();
  let eventos = getJSON(calKey(), []).filter(e=>!isNomeBloqueado(e.titulo));
  setJSON(calKey(), eventos);
  function saveEventos(){ setJSON(calKey(), eventos); }
  function eventPriority(ev){
    if(ev.origem==='admin' && ev.tipo==='desfalque') return 0;
    if(ev.meta?.type==='followup') return 1;
    return 2;
  }
  btnEventos?.addEventListener('click',()=>openEventoModal());
  if(getPerfil()==='Administrador' && btnDesf){
    btnDesf.style.display='inline-block';
    btnDesf.addEventListener('click',()=>openDesfalqueModal());
  }
  function onDeleteEvento(id){
    if(!confirm('Excluir evento?')) return;
    const ev = eventos.find(e=>e.id===id);
    if(ev){
      if(ev.tipo==='desfalque' && ev.origem==='admin'){
        PERFIS.forEach(p=>{
          let arr=getJSONForPerfil(p,'calendar',[]);
          arr=arr.filter(e=>!(e.tipo==='desfalque' && e.nome===ev.nome && e.dataISO===ev.dataISO));
          setJSONForPerfil(p,'calendar',arr);
        });
        eventos=getJSON(calKey(),[]).filter(e=>!(e.tipo==='desfalque' && e.nome===ev.nome && e.dataISO===ev.dataISO));
      } else if(ev.origem==='admin' && ev.adminGroupId){
        PERFIS.forEach(p=>{
          let arr=getJSONForPerfil(p,'calendar',[]);
          arr=arr.filter(e=>!(e.origem==='admin' && e.adminGroupId===ev.adminGroupId));
          setJSONForPerfil(p,'calendar',arr);
        });
        eventos=getJSON(calKey(),[]).filter(e=>!(e.origem==='admin' && e.adminGroupId===ev.adminGroupId));
      } else {
        eventos = eventos.filter(e=>e.id!==id);
        saveEventos();
      }
    }
    closePopover();
    render();
  }
  function onEditEvento(id){
    const ev = eventos.find(e=>e.id===id);
    if(ev){ closePopover(); openEventoModal(null, ev); }
  }
  function formatClientShortName(nome=''){
    if(!nome || typeof nome!=='string') return '';
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    if(!parts.length) return '';
    const [first, ...rest] = parts;
    const firstFormatted = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    if(!rest.length) return firstFormatted;
    const initials = rest.map(p=>p.charAt(0).toUpperCase()).filter(Boolean).join('.');
    return initials ? `${firstFormatted} ${initials}.` : firstFormatted;
  }

  const FOLLOWUP_STAGE_LABELS={
    '3m':'3M',
    '6m':'6M',
    '12m':'12M'
  };
  const FOLLOWUP_STAGE_TEXT={
    '3m':'3 meses',
    '6m':'6 meses',
    '12m':'12 meses'
  };
  function resolveFollowupStage(ev){
    const offset=ev.meta?.followupOffsetDays;
    const map={90:'3m',180:'6m',365:'12m'};
    return ev.meta?.stage || map[offset] || null;
  }
  function getFollowupContext(ev){
    const stage=resolveFollowupStage(ev);
    const clienteId=ev.meta?.clienteId ?? ev.meta?.clientId;
    const compraId=ev.meta?.compraId ?? ev.meta?.purchaseId;
    const cliente=clienteId ? db.buscarPorId(clienteId) : null;
    const comprasDoCliente=cliente?.compras || [];
    const compra=comprasDoCliente.find(c=>c.id===compraId);
    const titleSource=(ev.title || ev.titulo || '').split('(')[0];
    const rawName=cliente?.nome || titleSource;
    const shortCandidate=formatClientShortName(rawName||'');
    const fallbackName=(rawName||'').trim() || (ev.title || ev.titulo || '');
    const shortName=shortCandidate || fallbackName;
    const stageLabel=stage ? (FOLLOWUP_STAGE_LABELS[stage] || stage.toUpperCase()) : '';
    const stageLong=stage ? (FOLLOWUP_STAGE_TEXT[stage] || stageLabel) : '';
    return { cliente, compra, shortName, stage, stageLabel, stageLong };
  }

  function buildCompras(){
    const arr=[];
    db.listarClientes().forEach(c=>{
      (c.compras||[]).forEach(cp=>{
        arr.push({
          dataISO: cp.dataCompra,
          clienteNome: formatClientShortName(c.nome),
          clienteDados:{ telefone: c.telefone, email: c.email },
          armacao: cp.armacao,
          lente: cp.lente || '',
          nfe: cp.nfe || '',
          tiposCompra: cp.tiposCompra || [],
          armacaoMaterial: cp.armacaoMaterial || '',
          valor: cp.valor ?? cp.valorLente ?? null,
          observacoes: cp.observacoes || ''
        });
      });
    });
    return arr;
  }
  const compras = buildCompras();
  function onToggleEfetuado(id,value){ const ev=eventos.find(x=>x.id===id); if(ev){ ev.efetuado=value; saveEventos(); render(); } }
  function onToggleFollowUp(ev,value){
    const idx=eventos.findIndex(e=>e.id===ev.id);
    if(idx>-1){
      eventos[idx].meta={...eventos[idx].meta, done:value};
      saveEventos();
      document.querySelectorAll(`[data-event-id="${ev.id}"]`).forEach(el=>{
        el.setAttribute('data-efetuado', value);
        const sw=el.querySelector('.switch');
        if(sw) sw.checked=value;
      });
    }
    const cliente=db.buscarPorId(ev.meta?.clienteId);
    if(cliente){
      const compra=(cliente.compras||[]).find(c=>c.id===ev.meta?.compraId);
      if(compra){
        compra.followUps=compra.followUps||{};
        const map={90:'3m',180:'6m',365:'12m'};
        const stage=ev.meta?.stage || map[ev.meta?.followupOffsetDays];
        if(stage && idx>-1 && !eventos[idx].meta.stage){ eventos[idx].meta.stage=stage; saveEventos(); }
        const fu=compra.followUps[stage]||{};
        fu.done=value;
        fu.doneAt=value?new Date().toISOString():null;
        fu.eventId=ev.id;
        fu.dueDateISO=fu.dueDateISO||ev.date;
        if(stage) compra.followUps[stage]=fu;
        db.atualizarCompra(cliente.id, compra.id, {followUps: compra.followUps}, {skipReload:true, skipDashboard:true});
      }
    }
    renderDashboard();
  }
  function onToggleOSEvent(ev,value){
    const idx=eventos.findIndex(e=>e.id===ev.id);
    if(idx>-1){
      eventos[idx].meta={...eventos[idx].meta, done:value};
      saveEventos();
    }
    const list=loadOSList();
    const os=list.find(o=>o.id==ev.meta?.osId);
    if(os){
      os.status=value?'aguardando':'oficina';
      os.updatedAt=new Date().toISOString();
      saveOSList(list);
      renderOSKanban();
      renderOSCompleted();
    }
    render();
  }
  function onChangeMonth(step){ currentDate.setMonth(currentDate.getMonth()+step); render(); }
  function onChangeWeek(step){ currentDate.setDate(currentDate.getDate()+step*7); render(); }
  function setupCalendarChipEvents(chip, open){
    chip.addEventListener('click',e=>{ e.preventDefault(); e.stopPropagation(); open(); });
    chip.addEventListener('keydown',e=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); open(); } });
  }
  let quickBtn=null;
  let selectedCell=null;
  function removeAddBtn(){ if(quickBtn&&quickBtn.parentElement){ quickBtn.parentElement.removeChild(quickBtn); } quickBtn=null; selectedCell=null; }
  document.addEventListener('click',e=>{ if(selectedCell && !selectedCell.contains(e.target)) removeAddBtn(); });
  function setupDayCell(cell,dateISO){
      function showBtn(){
        if(cell.querySelector('.calendar-item')) return;
        if(selectedCell!==cell) removeAddBtn();
        if(!quickBtn){
          quickBtn=document.createElement('button');
          quickBtn.type='button';
          quickBtn.className='day-add';
          quickBtn.textContent='+';
          quickBtn.setAttribute('aria-label','Adicionar evento');
          quickBtn.addEventListener('click',e=>{ e.stopPropagation(); openEventoModal(dateISO); });
        }
        cell.appendChild(quickBtn);
        selectedCell=cell;
      }
      cell.addEventListener('click',e=>{ e.stopPropagation(); showBtn(); });
      cell.addEventListener('keydown',e=>{ if(e.key==='Enter') showBtn(); });
    }
  function render(){
    eventos = getJSON(calKey(), []).filter(e=>!isNomeBloqueado(e.titulo));
    setJSON(calKey(), eventos);
    const mes=currentDate.getMonth();
    const ano=currentDate.getFullYear();
    monthEl.textContent=currentDate.toLocaleString('pt-BR',{month:'long'});
    monthSelect.innerHTML='';
    for(let m=0;m<12;m++){ const opt=document.createElement('option'); opt.value=m; opt.textContent=new Date(0,m).toLocaleString('pt-BR',{month:'long'}); if(m===mes) opt.selected=true; monthSelect.appendChild(opt); }
    yearSelect.innerHTML='';
    for(let y=ano-5;y<=ano+5;y++){ const opt=document.createElement('option'); opt.value=y; opt.textContent=y; if(y===ano) opt.selected=true; yearSelect.appendChild(opt); }
    removeAddBtn();
    grid.innerHTML='';
    emptyEl.style.display = eventos.length===0 ? '' : 'none';
    if(modo==='mes'){ renderMonth(); weekNav.style.display='none'; }
    else { renderWeek(); weekNav.style.display='flex'; }
  }

  calendarMonthRenderer = render;
  window.renderCalendarMonth = renderCalendarMonth;

  function renderMonth(){
    const mes=currentDate.getMonth();
    const ano=currentDate.getFullYear();
    const first=new Date(ano,mes,1);
    const start=first.getDay();
    const daysIn=new Date(ano,mes+1,0).getDate();
    const prevLast=new Date(ano,mes,0).getDate();
    const total=Math.ceil((start+daysIn)/7)*7;
    const todayISO=new Date().toISOString().slice(0,10);
    for(let i=0;i<total;i++){
      const cell=document.createElement('div');
      cell.className='calendar-day cal-day';
      cell.tabIndex=0;
      const dayNum=i-start+1;
      if(i<start){
        const head=document.createElement('div');
        head.className='day-head';
        const num=document.createElement('span');
        num.className='day-num cal-date';
        num.textContent=prevLast - (start - i) + 1;
        head.appendChild(num);
        cell.classList.add('day--outside','is-out-month');
        cell.appendChild(head);
      }else if(dayNum<=daysIn){
        const head=document.createElement('div');
        head.className='day-head';
        const num=document.createElement('span');
        num.className='day-num cal-date';
        num.textContent=dayNum;
        head.appendChild(num);
        const dateISO=`${ano}-${String(mes+1).padStart(2,'0')}-${String(dayNum).padStart(2,'0')}`;
        if(dateISO===todayISO){
          cell.classList.add('today','is-today');
          const badge=document.createElement('span');
          badge.className='today-badge';
          badge.textContent='HOJE';
          head.appendChild(badge);
        }
        cell.appendChild(head);
        compras.filter(c=>c.dataISO===dateISO).forEach(cmp=>{
          const item=document.createElement('div');
          item.className='calendar-item';
          const chip=document.createElement('div');
          chip.className='calendar-chip compra';
          const nameSpan=document.createElement('span');
          nameSpan.className='chip-name';
          nameSpan.textContent=cmp.clienteNome;
          chip.appendChild(nameSpan);
          chip.tabIndex=0;
          setupCalendarChipEvents(chip,()=>showCompraPopover(chip,cmp));
          item.appendChild(chip);
          cell.appendChild(item);
        });
        eventos.filter(e=> (e.date ? e.date.slice(0,10) : e.dataISO) === dateISO)
               .sort((a,b)=>eventPriority(a)-eventPriority(b))
               .forEach(ev=>{
          const item=document.createElement('div');
          item.className='calendar-item';
          if(ev.tipo==='desfalque'){
            const chip=document.createElement('div');
            chip.className='calendar-chip desfalque';
            chip.dataset.eventId=ev.id;
            chip.textContent=`${ev.nome} ${ev.periodo==='dia_todo'?'Dia todo':'Manhã'}`;
            chip.tabIndex=0;
            setupCalendarChipEvents(chip,()=>showEventoPopover(chip,ev));
            item.appendChild(chip);
          }else{
            const chip=document.createElement('div');
            chip.className='calendar-chip evento'+(ev.origem==='admin'?' admin':'');
            chip.dataset.eventId=ev.id;
            const color=ev.color;
            if(color) chip.classList.add(`event-color-${color}`);
            if(ev.meta?.type==='followup' || color==='followup') chip.classList.add('followup');
            if(ev.meta?.type==='followup' || color==='followup'){
              const ctx=getFollowupContext(ev);
              const name=document.createElement('span');
              name.className='chip-name';
              name.textContent=ctx.shortName;
              chip.appendChild(name);
              if(ctx.stageLabel){
                const stage=document.createElement('span');
                stage.className='chip-stage';
                stage.textContent=ctx.stageLabel;
                if(ctx.stageLong) stage.title=ctx.stageLong;
                chip.appendChild(stage);
              }
            }else{
              chip.textContent=ev.title || ev.titulo;
            }
            const done = ev.meta?.done ?? ev.efetuado ?? false;
            const hasToggle = ev.meta?.type==='followup' || ev.efetuado!==undefined || ev.meta?.kind==='os';
            if(hasToggle) chip.setAttribute('data-efetuado', done);
            chip.tabIndex=0;
            setupCalendarChipEvents(chip,()=>showEventoPopover(chip,ev));
            item.appendChild(chip);
          }
          cell.appendChild(item);
        });
        setupDayCell(cell,dateISO);
      }else{
        const head=document.createElement('div');
        head.className='day-head';
        const num=document.createElement('span');
        num.className='day-num cal-date';
        num.textContent=dayNum - daysIn;
        head.appendChild(num);
        cell.classList.add('day--outside','is-out-month');
        cell.appendChild(head);
      }
      grid.appendChild(cell);
    }
  }

  function renderWeek(){
    const start=new Date(currentDate);
    start.setDate(currentDate.getDate()-currentDate.getDay());
    const todayISO=new Date().toISOString().slice(0,10);
    for(let i=0;i<7;i++){
      const day=new Date(start);
      day.setDate(start.getDate()+i);
      const cell=document.createElement('div');
      cell.className='calendar-day cal-day';
      cell.tabIndex=0;
      const head=document.createElement('div');
      head.className='day-head';
      const num=document.createElement('span');
      num.className='day-num cal-date';
      num.textContent=day.getDate();
      head.appendChild(num);
      const dateISO=day.toISOString().slice(0,10);
      if(day.getMonth()!==currentDate.getMonth()) cell.classList.add('day--outside','is-out-month');
      if(dateISO===todayISO){
        cell.classList.add('today','is-today');
        const badge=document.createElement('span');
        badge.className='today-badge';
        badge.textContent='HOJE';
        head.appendChild(badge);
      }
      cell.appendChild(head);
      compras.filter(c=>c.dataISO===dateISO).forEach(cmp=>{
        const card=document.createElement('div');
        card.className='calendar-card compra';
        card.innerHTML=`<strong>${cmp.clienteNome}</strong>${cmp.clienteDados?.telefone?`<p>${formatTelefone(cmp.clienteDados.telefone)}</p>`:''}`;
        card.tabIndex=0;
        setupCalendarChipEvents(card,()=>showCompraPopover(card,cmp));
        cell.appendChild(card);
      });
      eventos.filter(e=> (e.date ? e.date.slice(0,10) : e.dataISO) === dateISO)
             .sort((a,b)=>eventPriority(a)-eventPriority(b))
             .forEach(ev=>{
        const card=document.createElement('div');
        if(ev.tipo==='desfalque'){
          card.className='calendar-card desfalque';
          card.dataset.eventId=ev.id;
          card.innerHTML=`<strong>${ev.nome}</strong><span class="tag">${ev.periodo==='dia_todo'?'Dia todo':'Manhã'}</span>`;
          card.tabIndex=0;
          setupCalendarChipEvents(card,()=>showEventoPopover(card,ev));
        }else{
          card.className='calendar-card evento'+(ev.origem==='admin'?' admin':'');
          card.dataset.eventId=ev.id;
          const color=ev.color;
          if(color) card.classList.add(`event-color-${color}`);
          if(ev.meta?.type==='followup' || color==='followup') card.classList.add('followup');
          if(ev.meta?.type==='followup' || color==='followup'){
            const ctx=getFollowupContext(ev);
            card.innerHTML='';
            const title=document.createElement('strong');
            title.appendChild(document.createTextNode(ctx.shortName));
            if(ctx.stageLabel){
              const badge=document.createElement('span');
              badge.className='tag stage-tag';
              badge.textContent=ctx.stageLabel;
              if(ctx.stageLong) badge.title=ctx.stageLong;
              title.appendChild(badge);
            }
            card.appendChild(title);
            if(ev.observacao){
              const obs=document.createElement('p');
              obs.textContent=ev.observacao;
              card.appendChild(obs);
            }
          }else{
            card.innerHTML=`<strong>${ev.title || ev.titulo}</strong>${ev.observacao?`<p>${ev.observacao}</p>`:''}`;
          }
          const done = ev.meta?.done ?? ev.efetuado ?? false;
          const hasToggle = ev.meta?.type==='followup' || ev.efetuado!==undefined || ev.meta?.kind==='os';
          if(hasToggle){
            card.setAttribute('data-efetuado', done);
            if(ev.meta?.kind==='os'){
              card.innerHTML += `<label>Em loja <input type="checkbox" class="switch" ${done?'checked':''}></label>`;
            } else {
              card.innerHTML += `<label>Efetuado <input type="checkbox" class="switch" ${done?'checked':''}></label>`;
            }
            const sw=card.querySelector('.switch');
            if(sw){
              sw.addEventListener('click',e=>e.stopPropagation());
              if(ev.meta?.kind==='os') sw.addEventListener('change',()=>onToggleOSEvent(ev, sw.checked));
              else if(ev.meta?.type==='followup' || color==='followup') sw.addEventListener('change',()=>onToggleFollowUp(ev, sw.checked));
              else sw.addEventListener('change',()=>onToggleEfetuado(ev.id, sw.checked));
            }
          }
          card.tabIndex=0;
          setupCalendarChipEvents(card,()=>showEventoPopover(card,ev));
        }
        cell.appendChild(card);
      });
      setupDayCell(cell,dateISO);
      grid.appendChild(cell);
    }
  }
  yearSelect.addEventListener('change',()=>{ currentDate.setFullYear(parseInt(yearSelect.value,10)); render(); });
  monthSelect.addEventListener('change',()=>{ currentDate.setMonth(parseInt(monthSelect.value,10)); render(); });
  btnHoje.addEventListener('click',()=>{ currentDate=new Date(); window.currentDate=currentDate; modo='mes'; segBtns.forEach(b=>b.setAttribute('aria-pressed', b.dataset.modo===modo?'true':'false')); render(); });
  btnPrev.addEventListener('click',()=>onChangeMonth(-1));
  btnNext.addEventListener('click',()=>onChangeMonth(1));
  btnPrevWeek.addEventListener('click',()=>onChangeWeek(-1));
  btnNextWeek.addEventListener('click',()=>onChangeWeek(1));
  segBtns.forEach(btn=>{ btn.addEventListener('click',()=>{ modo=btn.dataset.modo; segBtns.forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false')); render(); }); });
  function openEventoModal(dataISO, ev){
    const modal=document.getElementById('app-modal');
    const saveBtn = modal.querySelector('#modal-save');
    saveBtn.removeAttribute('data-action');
    saveBtn.setAttribute('type','submit');
    const title=document.getElementById('modal-title');
    const body=modal.querySelector('.modal-body');
    const content = modal.querySelector('.modal-dialog');
    content.classList.remove('modal-novo-cliente','modal-editar-cliente','modal-nova-compra');
    const isEdit=!!ev;
    const isAdmin=getPerfil()==='Administrador';
    title.textContent=isEdit?'Editar evento':'Criar evento';
    const destHtml=isAdmin&&!isEdit?`<div class="form-field col-span-12"><label>Destinos</label><table class="destinos-table"><thead><tr><th>Perfil</th><th>Enviar</th></tr></thead><tbody>${PERFIS.map(p=>`<tr><td>${p}</td><td><input type='checkbox' value='${p}' class='switch'></td></tr>`).join('')}</tbody></table></div>`:'';
    body.innerHTML=`<form id="evento-form"><div class="form-grid"><div class="form-field col-span-4"><label for="evento-data">Data *</label><input id="evento-data" type="date" name="data" class="date-input" required></div><div class="form-field col-span-8"><label for="evento-titulo">Título *</label><input id="evento-titulo" name="titulo" class="text-input" required></div><div class="form-field col-span-12"><label for="evento-obs">Observação</label><textarea id="evento-obs" name="obs" class="textarea" rows="3"></textarea></div>${destHtml}</div></form>`;
    saveBtn.setAttribute('form','evento-form');
    const form=body.querySelector('#evento-form');
    const destChecks=form.querySelectorAll('.destinos-table input');
    form.data.value=ev?.dataISO||dataISO||'';
    form.titulo.value=ev?.titulo||'';
    form.obs.value=ev?.observacao||'';
    modal.open();
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const data=form.data.value;
      const titulo=form.titulo.value.trim();
      if(!data||!titulo){ form.reportValidity(); return; }
      if(isNomeBloqueado(titulo)){ ui.toast('Nome bloqueado'); return; }
      if(isEdit){
        ev.dataISO=data;
        ev.titulo=titulo;
        ev.observacao=form.obs.value;
      } else {
        const destinos=Array.from(destChecks||[]).filter(c=>c.checked).map(c=>c.value);
        const payload={id:uuid(), dataISO:data, titulo, observacao:form.obs.value, efetuado:false};
        if(isAdmin){
          payload.origem='admin';
          payload.adminGroupId=uuid();
          if(destinos.length) payload.destinos=destinos;
        }
        eventos.push(payload);
        if(isAdmin && destinos.length){
          destinos.filter(p=>p!=='Administrador').forEach(p=>{
            const arr=getJSONForPerfil(p,'calendar',[]);
            arr.push({...payload,id:uuid()});
            setJSONForPerfil(p,'calendar',arr);
          });
        }
      }
      saveEventos();
      modal.close();
      render();
    });
  }

  function openDesfalqueModal(){
    const modal=document.getElementById('app-modal');
    const saveBtn = modal.querySelector('#modal-save');
    saveBtn.removeAttribute('data-action');
    saveBtn.setAttribute('type','submit');
    const title=document.getElementById('modal-title');
    const body=modal.querySelector('.modal-body');
    title.textContent='Novo desfalque';
    body.innerHTML=`<form id="desfalque-form"><div class="form-grid"><div class="form-field col-span-12"><label for="d-nome">Nome *</label><input id="d-nome" class="text-input" required></div><div class="form-field col-span-12"><label for="d-data">Data *</label><input id="d-data" type="date" class="date-input" required></div><div class="form-field col-span-12"><label>Manhã ⇄ Dia todo <input type="checkbox" id="d-periodo" class="switch"></label></div></div></form>`;
    saveBtn.setAttribute('form','desfalque-form');
    const form=body.querySelector('#desfalque-form');
    modal.open();
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const nome=form['d-nome'].value.trim();
      const dataISO=form['d-data'].value;
      if(!nome||!dataISO){ form.reportValidity(); return; }
      const periodo=form['d-periodo'].checked?'dia_todo':'manha';
      const ev={id:uuid(),tipo:'desfalque',origem:'admin',nome,periodo,dataISO,criadoPor:'Administrador',criadoEm:new Date().toISOString(),titulo:nome,observacao:periodo==='dia_todo'?'Dia todo':'Manhã'};
      PERFIS.forEach(p=>{
        const arr=getJSONForPerfil(p,'calendar',[]);
        if(!arr.some(e=>e.dataISO===dataISO && e.nome===nome && e.tipo==='desfalque')){ arr.push({...ev,id:uuid()}); setJSONForPerfil(p,'calendar',arr); }
      });
      eventos=getJSON(calKey(),[]);
      modal.close();
      render();
    });
  }
  function showEventoPopover(target,ev){
    closePopover();
    const pop=document.createElement('div');
    pop.className='popover popover-event';
    if(ev.tipo==='desfalque'){
      const admin = getPerfil()==='Administrador';
      pop.innerHTML=`<div class="pop-head"><span class="pop-date">${formatDateDDMMYYYY(ev.dataISO)}</span>${admin?`<div class="popover-actions"><button class="btn-icon delete" aria-label="Apagar" title="Apagar">${iconTrash}</button></div>`:''}</div><div class="pop-title">${ev.nome} <span class="tag">${ev.periodo==='dia_todo'?'Dia todo':'Manhã'}</span></div>`;
      const layer=document.getElementById('calPopoverLayer');
      if(!layer) return;
      layer.appendChild(pop);
      positionPopover(target,pop);
      if(admin) pop.querySelector('.btn-icon.delete').addEventListener('click',()=>onDeleteEvento(ev.id));
      setupPopoverDismiss(pop,target);
      return;
    }
    if(ev.meta?.type==='followup' || ev.color==='followup'){
      const ctx=getFollowupContext(ev);
      const {cliente, compra, stageLabel, stageLong, shortName}=ctx;
      const telefone = cliente?.telefone ? formatTelefone(cliente.telefone) : '';
      const email = cliente?.email || '';
      const valorBruto = compra ? (compra.valor ?? compra.valorLente ?? null) : null;
      const valorNumero = typeof valorBruto === 'number' ? valorBruto : Number(valorBruto);
      const hasValor = valorBruto != null && Number.isFinite(valorNumero) && valorNumero > 0;
      const valorHtml = hasValor ? formatCurrency(valorNumero) : '';
      const tiposHtml = compra?.tiposCompra?.length ? compra.tiposCompra.map(t=>`<span class="tag">${t}</span>`).join(' ') : '';
      const observacoesTexto = (compra?.observacoes || '').trim();
      const observacoesHtml = observacoesTexto ? observacoesTexto.replace(/\n/g,'<br>') : '';
      const armacaoHtml = compra && (compra.armacao || compra.armacaoMaterial)
        ? `${compra.armacao || ''}${compra.armacaoMaterial ? ` <span class="tag">${compra.armacaoMaterial}</span>` : ''}`
        : '';
      const followupDate = formatDateDDMMYYYY(ev.date || ev.dataISO);
      const rows=[];
      if(cliente) rows.push(`<div class="popover-row"><span class="label">Cliente</span><span class="value">${cliente.nome}</span></div>`);
      if(telefone) rows.push(`<div class="popover-row"><span class="label">Telefone</span><span class="value">${telefone}</span></div>`);
      if(email) rows.push(`<div class="popover-row"><span class="label">Email</span><span class="value">${email}</span></div>`);
      if(compra?.dataCompra) rows.push(`<div class="popover-row"><span class="label">Compra</span><span class="value">${formatDateDDMMYYYY(compra.dataCompra)}</span></div>`);
      rows.push(`<div class="popover-row"><span class="label">NFE/NFC-e</span><span class="value">${compra?.nfe || '-'}</span></div>`);
      rows.push(`<div class="popover-row"><span class="label">Armação</span><span class="value">${armacaoHtml || '-'}</span></div>`);
      rows.push(`<div class="popover-row"><span class="label">Lente</span><span class="value">${compra?.lente || '-'}</span></div>`);
      rows.push(`<div class="popover-row"><span class="label">Tipos</span><span class="value">${tiposHtml || '-'}</span></div>`);
      rows.push(`<div class="popover-row"><span class="label">Valor</span><span class="value">${valorHtml || '-'}</span></div>`);
      if(observacoesHtml) rows.push(`<div class="popover-row"><span class="label">Observações</span><span class="value">${observacoesHtml}</span></div>`);
      const bodyHtml = rows.join('');
      const doneAttr = ev.meta?.done ? 'checked' : '';
      const bodySection = bodyHtml ? `<div class="popover-body">${bodyHtml}</div>` : '';
      const stageTag = stageLabel ? ` <span class="tag">${stageLong || stageLabel}</span>` : '';
      pop.innerHTML=`<div class="pop-head"><span class="pop-date">${followupDate}</span></div>`
        +`<div class="pop-title">${shortName || (ev.title || '')}${stageTag}</div>`
        +`${bodySection}`
        +`<div class="pop-footer"><label>Contato efetuado <input type="checkbox" class="switch" ${doneAttr}></label></div>`;
      const layer=document.getElementById('calPopoverLayer');
      if(!layer) return;
      layer.appendChild(pop);
      positionPopover(target,pop);
      const lbl=pop.querySelector('.pop-footer label');
      if(lbl){
        lbl.addEventListener('click',e=>e.stopPropagation());
        const chk=lbl.querySelector('.switch');
        if(chk) chk.addEventListener('change',()=>onToggleFollowUp(ev,chk.checked));
      }
      setupPopoverDismiss(pop,target);
      return;
    }
    if(ev.meta?.kind==='os'){
      pop.innerHTML=`<div class="pop-head"><span class="pop-date">${formatDateDDMMYYYY(ev.date||ev.dataISO)}</span></div><div class="pop-title">${ev.title||ev.titulo}</div><div class="pop-footer"><label>Em loja <input type="checkbox" class="switch" ${ev.meta?.done?'checked':''}></label></div>`;
      const layer=document.getElementById('calPopoverLayer');
      if(!layer) return;
      layer.appendChild(pop);
      positionPopover(target,pop);
      const lbl=pop.querySelector('.pop-footer label');
      if(lbl){ lbl.addEventListener('click',e=>e.stopPropagation()); const chk=lbl.querySelector('.switch'); if(chk) chk.addEventListener('change',()=>onToggleOSEvent(ev,chk.checked)); }
      setupPopoverDismiss(pop,target);
      return;
    }
    pop.innerHTML=`<div class="pop-head"><span class="pop-date">${formatDateDDMMYYYY(ev.date||ev.dataISO)}</span><div class="popover-actions"><button class="btn-icon delete" aria-label="Apagar" title="Apagar">${iconTrash}</button><button class="btn-icon adjust" aria-label="Ajustar" title="Ajustar">${iconEdit}</button></div></div><div class="pop-title">${ev.title||ev.titulo}</div><div class="pop-divider"></div>${ev.observacao?`<div class="pop-obs">${ev.observacao}</div>`:''}<div class="pop-footer"><input type="checkbox" class="switch" aria-label="Concluído" ${(ev.meta?.done ?? ev.efetuado)?'checked':''}></div>`;
    const layer=document.getElementById('calPopoverLayer');
    if(!layer) return;
    layer.appendChild(pop);
    positionPopover(target,pop);
    pop.querySelector('.btn-icon.delete').addEventListener('click',()=>onDeleteEvento(ev.id));
    pop.querySelector('.btn-icon.adjust').addEventListener('click',()=>onEditEvento(ev.id));
    const chk=pop.querySelector('.switch');
    if(chk) chk.addEventListener('change',e=>onToggleEfetuado(ev.id,e.target.checked));
    setupPopoverDismiss(pop,target);
  }
  function showCompraPopover(target,cp){
    closePopover();
    const pop=document.createElement('div');
    pop.className='popover';
    const telefone = cp.clienteDados?.telefone ? formatTelefone(cp.clienteDados.telefone) : '';
    const email = cp.clienteDados?.email || '';
    const valorBruto = cp.valor;
    const valorNumero = typeof valorBruto === 'number' ? valorBruto : Number(valorBruto);
    const hasValor = valorBruto != null && Number.isFinite(valorNumero) && valorNumero > 0;
    const valorHtml = hasValor ? formatCurrency(valorNumero) : '';
    const tiposHtml = cp.tiposCompra?.length ? cp.tiposCompra.map(t=>`<span class="tag">${t}</span>`).join(' ') : '';
    const observacoesTexto = (cp.observacoes || '').trim();
    const observacoesHtml = observacoesTexto ? observacoesTexto.replace(/\n/g,'<br>') : '';
    const armacaoHtml = (cp.armacao || cp.armacaoMaterial)
      ? `${cp.armacao || ''}${cp.armacaoMaterial ? ` <span class="tag">${cp.armacaoMaterial}</span>` : ''}`
      : '';
    const rows = [
      `<div class="popover-row"><span class="label">Data</span><span class="value">${formatDateDDMMYYYY(cp.dataISO)}</span></div>`,
      `<div class="popover-row"><span class="label">Cliente</span><span class="value">${cp.clienteNome}</span></div>`
    ];
    if(telefone) rows.push(`<div class="popover-row"><span class="label">Telefone</span><span class="value">${telefone}</span></div>`);
    if(email) rows.push(`<div class="popover-row"><span class="label">Email</span><span class="value">${email}</span></div>`);
    if(cp.nfe) rows.push(`<div class="popover-row"><span class="label">NFE/NFC-e</span><span class="value">${cp.nfe}</span></div>`);
    if(armacaoHtml) rows.push(`<div class="popover-row"><span class="label">Armação</span><span class="value">${armacaoHtml}</span></div>`);
    if(cp.lente) rows.push(`<div class="popover-row"><span class="label">Lente</span><span class="value">${cp.lente}</span></div>`);
    if(tiposHtml) rows.push(`<div class="popover-row"><span class="label">Tipos</span><span class="value">${tiposHtml}</span></div>`);
    if(valorHtml) rows.push(`<div class="popover-row"><span class="label">Valor</span><span class="value">${valorHtml}</span></div>`);
    if(observacoesHtml) rows.push(`<div class="popover-row"><span class="label">Observações</span><span class="value">${observacoesHtml}</span></div>`);
    pop.innerHTML=`<div class="popover-body">${rows.join('')}</div>`;
    const layer=document.getElementById('calPopoverLayer');
    if(!layer) return;
    layer.appendChild(pop);
    positionPopover(target,pop);
    setupPopoverDismiss(pop,target);
  }
  function positionPopover(target,pop){
    const layer=document.getElementById('calPopoverLayer');
    if(!layer) return;
    const r=target.getBoundingClientRect();
    const lr=layer.getBoundingClientRect();
    let left=r.left - lr.left;
    let top=r.bottom - lr.top + 4;
    layer.style.pointerEvents='auto';
    pop.style.top=`${top}px`;
    pop.style.left=`${left}px`;
    const pw=pop.offsetWidth;
    const ph=pop.offsetHeight;
    if(left + pw > lr.width) left = lr.width - pw;
    if(left < 0) left = 0;
    if(top + ph > lr.height){ top = r.top - lr.top - ph - 4; if(top < 0) top = 0; }
    pop.style.left=`${left}px`;
    pop.style.top=`${top}px`;
  }
  let currentPopover=null;
  let currentAnchor=null;
  let popBackdrop=null;
  let hideTimer=null;
  function closePopover(){
    if(currentPopover){
      currentPopover.removeEventListener('mouseenter', cancelClose);
      currentPopover.removeEventListener('mouseleave', scheduleClose);
      currentPopover.remove();
    }
    if(currentAnchor){
      currentAnchor.removeEventListener('mouseenter', cancelClose);
      currentAnchor.removeEventListener('mouseleave', scheduleClose);
    }
    if(popBackdrop){ popBackdrop.remove(); popBackdrop=null; }
    const layer=document.getElementById('calPopoverLayer');
    if(layer) layer.style.pointerEvents='none';
    clearTimeout(hideTimer);
    currentPopover=null;
    currentAnchor=null;
    document.removeEventListener('keydown',esc);
    document.removeEventListener('click',clk);
  }
  function esc(e){ if(e.key==='Escape') closePopover(); }
  function clk(e){ if(currentPopover && !currentPopover.contains(e.target) && (!currentAnchor || !currentAnchor.contains(e.target))) closePopover(); }
  function cancelClose(){ clearTimeout(hideTimer); }
  function scheduleClose(){ hideTimer=setTimeout(closePopover,3000); }
  function setupPopoverDismiss(pop,anchor){
    currentPopover=pop;
    currentAnchor=anchor;
    popBackdrop=document.createElement('div');
    popBackdrop.className='popover-backdrop';
    const layer=document.getElementById('calPopoverLayer');
    (layer||document.body).appendChild(popBackdrop);
    document.addEventListener('keydown',esc);
    document.addEventListener('click',clk);
    pop.addEventListener('mouseenter',cancelClose);
    pop.addEventListener('mouseleave',scheduleClose);
    if(anchor){
      anchor.addEventListener('mouseenter',cancelClose);
      anchor.addEventListener('mouseleave',scheduleClose);
    }
  }
  render();
  updateCalendarMenuBar();
}
function initClientesVisaoGeral() {
  db.initComSeeds();
  const tbody = document.getElementById('clientsTbody');
  const searchInput = document.getElementById('clientSearch');
  const tagBtn = document.getElementById('tagMenuBtn');
  const detail = document.querySelector('.detalhe-body');
  const headers = document.querySelectorAll('.table-clients th.sortable');
  const pag = document.querySelector('.clients-pagination');
  const prevBtn = pag.querySelector('.prev-page');
  const nextBtn = pag.querySelector('.next-page');
  const pageInfo = pag.querySelector('.page-info');
  const pageSizeSel = pag.querySelector('.page-size');
  let uiState = getJSON(prefix()+'clients.ui', { page:1, pageSize:10, sort:{key:'nome',dir:'asc'} });
  ui.clients.filters.interesses = getJSON(prefix()+'clients.filters.interesses', []);
  ui.clients.search = '';
  let sortBy = uiState.sort.key;
  let sortDir = uiState.sort.dir;
  let page = uiState.page;
  let pageSize = uiState.pageSize;

  pageSizeSel.value = String(pageSize);

  function persist(){ setJSON(prefix()+'clients.ui',{ page, pageSize, sort:{key:sortBy,dir:sortDir} }); setJSON(prefix()+'clients.filters.interesses', ui.clients.filters.interesses); }

  function updateTable() {
    purgeOrphanEvents();
    const source = getClients();
    let clientes = filterClientsBySearchAndTags(source, ui.clients.search);
    clientes.sort((a,b)=>{
      if(sortBy==='nome') return sortDir==='asc'? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
      const da = getUltimaCompra(a.compras)?.dataCompra || '';
      const dbb = getUltimaCompra(b.compras)?.dataCompra || '';
      if(da===dbb) return 0;
      return sortDir==='asc' ? (da>dbb?1:-1) : (da<dbb?1:-1);
    });
    const totalPages = Math.max(1, Math.ceil(clientes.length / pageSize));
    if(page>totalPages) page=totalPages;
    const slice = clientes.slice((page-1)*pageSize, page*pageSize);
    const selecionado = state.getClienteSelecionadoId();
    let found = false;
    tbody.innerHTML = '';
    if(slice.length===0){
      if(source.length>0){
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nenhum cliente encontrado com os filtros atuais</td></tr>';
      } else {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">Nada por aqui ainda</td></tr>';
      }
    } else {
      slice.forEach(c => {
        const tr = document.createElement('tr');
        tr.tabIndex = 0;
        tr.dataset.id = c.id;
        const compra = getUltimaCompra(c.compras);
        tr.innerHTML = `
            <td>${renderClientNameInline(c)}</td>
            <td>${formatTelefone(c.telefone)}</td>
            <td>${compra ? formatDateDDMMYYYY(compra.dataCompra) : '-'}</td>`;
        if (selecionado === c.id) {
          tr.classList.add('row-selected');
          found = true;
        }
        tr.addEventListener('click', () => selectCliente(c.id, tr));
        tr.addEventListener('keydown', e => { if (e.key === 'Enter') selectCliente(c.id, tr); });
        tbody.appendChild(tr);
      });
    }
    if (selecionado && !found) state.setClienteSelecionado('');
    pageInfo.textContent = `Página ${totalPages?page:0} de ${totalPages}`;
    prevBtn.disabled = page<=1;
    nextBtn.disabled = page>=totalPages;
    persist();
    updateClientesStats();
  }

    function renderDetail() {
      const id = state.getClienteSelecionadoId();
      if (!id) {
        detail.innerHTML = '<div class="empty-state">Selecione um cliente à esquerda</div>';
        return;
      }
      const c = db.buscarPorId(id);
      if (!c) {
        detail.innerHTML = '<div class="empty-state">Selecione um cliente à esquerda</div>';
        return;
      }
      const compras = [...c.compras].sort((a, b) => b.dataCompra.localeCompare(a.dataCompra));
      currentClientId = c.id;
      currentClientPurchases = compras;
      const pills = compras.map(cp => `<button class="pill-date" data-purchase-id="${cp.id}">${formatDateDDMMYYYY(cp.dataCompra)}</button>`).join('');
      detail.innerHTML = `
        <div class="mini-card client-overview">
          <div class="overview-header">
            <h2>${renderClientNameInline(c)}</h2>
            <div class="actions">
              <button class="btn btn-outline btn-cliente-page" type="button">Página do Cliente</button>
              <button class="btn-icon adjust btn-edit-detalhe" aria-label="Editar Cliente" title="Editar Cliente">${iconEdit}</button>
              <button class="btn-icon delete btn-delete-detalhe" aria-label="Excluir Cliente" title="Excluir Cliente">${iconTrash}</button>
            </div>
          </div>
          <div class="dados-pessoais info-grid">
          <div class="cli-field"><span class="phone-ico" aria-hidden="true"></span><span class="cli-label">Telefone:</span><strong class="cli-phone" id="cliPhoneValue">${formatTelefone(c.telefone)}</strong></div>
          <div class="info-label">Nascimento</div><div class="info-value">${c.dataNascimento ? formatDateDDMMYYYY(c.dataNascimento) : '-'}</div>
          <div class="info-label">CPF</div><div class="info-value">${c.cpf ? formatCpf(c.cpf) : '-'}</div>
          <div class="info-label">Gênero</div><div class="info-value">${c.genero || '-'}</div>
          <div class="info-label">Interesses</div><div class="info-value">${((c.interesses||c.usos) && (c.interesses||c.usos).length)?(c.interesses||c.usos).join(', '):'-'}</div>
          <div class="info-label">Preferência de contato</div><div class="info-value">${c.naoContate ? 'Não contatar' : 'Aceita contato'}</div>
        </div>
      </div>
        <div class="mini-card">
          <div class="detalhe-head">
            <h3>Histórico de Compras</h3>
              <div class="detalhe-actions">
                <button id="btnNovaCompra" class="btn btn-primary btn-nova-compra" data-action="purchase:add">Nova Compra</button>
              </div>
          </div>
          ${compras.length ? `<div id="purchaseTabs" class="purchase-pills">${pills}</div><div class="purchase-detail"></div>` : '<p>Sem compras registradas</p>'}
        </div>`;
      const purchaseDetail = detail.querySelector('.purchase-detail');

      function renderCompra(cpId) {
        const cp = compras.find(c => c.id === cpId);
        if (!cp) return;
        purchaseDetail.innerHTML = `
          <div class="purchase-card">
            <div class="card-body">
            <div class="purchase-date-badge">${formatDateDDMMYYYY(cp.dataCompra)}</div>
            <div class="info-grid">
              <div class="info-label">Armação</div><div class="info-value">${cp.armacao || ''} ${cp.armacaoMaterial?`<span class='tag'>${cp.armacaoMaterial}</span>`:''}</div>
              <div class="info-label">Lente</div><div class="info-value">${cp.lente || ''}</div>
              <div class="info-label">Valor</div><div class="info-value">${formatCurrency(cp.valor ?? cp.valorLente)}</div>
              ${cp.nfe?`<div class="info-label">NFE/NFC-e</div><div class="info-value">${cp.nfe}</div>`:''}
              ${cp.tiposCompra?.length?`<div class="info-label">Tipos</div><div class="info-value">${cp.tiposCompra.map(t=>`<span class='tag'>${t}</span>`).join(' ')}</div>`:''}
            </div>
            <div class="receituario">${buildRxTable(cp)}</div>
            <div class="opcoes">
              <h4>Contato efetuado</h4>
              <label><input type="checkbox" class="switch" data-period="3m" ${cp.followUps?.['3m']?.done ? 'checked' : ''}> 3 meses</label>
              <label><input type="checkbox" class="switch" data-period="6m" ${cp.followUps?.['6m']?.done ? 'checked' : ''}> 6 meses</label>
              <label><input type="checkbox" class="switch" data-period="12m" ${cp.followUps?.['12m']?.done ? 'checked' : ''}> 12 meses</label>
            </div>
            <div class="compra-buttons">
              <button class="btn-icon adjust btn-edit-compra" aria-label="Editar Compra" title="Editar Compra">${iconEdit}</button>
              <button class="btn-icon delete btn-delete-compra" aria-label="Excluir Compra" title="Excluir Compra">${iconTrash}</button>
            </div>
            </div>
          </div>`;

        purchaseDetail.querySelectorAll('input[type="checkbox"]').forEach(input => {
          input.addEventListener('change', () => {
            const period=input.dataset.period;
            cp.followUps=cp.followUps||{};
            const fu=cp.followUps[period]||{};
            fu.done=input.checked;
            fu.doneAt=fu.done?new Date().toISOString():null;
            cp.followUps[period]=fu;
            db.atualizarCompra(id, cpId, { followUps: cp.followUps }, { skipReload: true, skipDashboard: true });
            renderCalendarMonth();
            renderDashboard();
          });
        });
        purchaseDetail.querySelector('.btn-edit-compra').addEventListener('click', e => {
          e.stopPropagation();
          openCompraModal(id, cpId, () => { updateTable(); renderDetail(); });
        });
        purchaseDetail.querySelector('.btn-delete-compra').addEventListener('click', e => {
          e.stopPropagation();
          if (!confirm('Excluir compra?')) return;
          db.deletarCompra(id, cpId);
          updateTable();
          renderDetail();
          renderDashboard();
          ui.toast('Compra excluída');
        });
      }

      bindOnce(detail.querySelector('#purchaseTabs'),'click', (e)=>{
        const btn = e.target.closest('[data-purchase-id]');
        if(!btn) return;
        selectedPurchaseId = btn.dataset.purchaseId;
        setActivePurchaseChip(selectedPurchaseId);
        renderSelectedPurchaseDetails();
      });
      if (compras.length){
        selectedPurchaseId = compras[0].id;
        setActivePurchaseChip(selectedPurchaseId);
        renderSelectedPurchaseDetails = ()=>renderCompra(selectedPurchaseId);
        renderSelectedPurchaseDetails();
      }

      detail.querySelector('.btn-edit-detalhe').addEventListener('click', () => openClienteModal(c.id, sid => { state.setClienteSelecionado(sid); updateTable(); renderDetail(); }));
      detail.querySelector('.btn-cliente-page').addEventListener('click', () => navigateToClientPage(c.id));
      detail.querySelector('.btn-delete-detalhe').addEventListener('click', () => {
        if (!confirm('Excluir cliente?')) return;
        const currentRow = tbody.querySelector(`tr[data-id="${c.id}"]`);
        const nextRow = currentRow ? (currentRow.nextElementSibling || currentRow.previousElementSibling) : null;
        deleteClient(c.id);
        state.setClienteSelecionado(nextRow ? nextRow.dataset.id : '');
        renderDetail();
        ui.toast('Cliente excluído');
      });
    }

    function selectCliente(id, tr) {
      state.setClienteSelecionado(id);
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('row-selected'));
      if (tr) tr.classList.add('row-selected');
      renderDetail();
    }



    searchInput.addEventListener("input",()=>{ ui.clients.search=searchInput.value; page=1; updateTable(); });
    searchInput.addEventListener("keydown",e=>{ if(e.key=="Enter"){ e.preventDefault(); ui.clients.search=searchInput.value; page=1; updateTable(); }});
    tagBtn.onclick = (e)=>{
      e.stopPropagation();
      if(tagMenuOpen){ closeTagMenu(); } else { openTagMenu(); }
    };
  prevBtn.addEventListener('click',()=>{ if(page>1){ page--; updateTable(); }});
  nextBtn.addEventListener('click',()=>{ page++; updateTable(); });
  pageSizeSel.addEventListener('change',()=>{ pageSize=parseInt(pageSizeSel.value,10); page=1; updateTable(); });
  window.openNovoCliente = () => openClienteModal(null, id => { state.setClienteSelecionado(id); updateTable(); renderDetail(); });
  window.refreshClientsTable = updateTable;
  window.renderClientsTable = updateTable;
  window.renderClientDetail = renderDetail;

  headers.forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.field;
      if (sortBy === field) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortBy = field;
        sortDir = field === 'data' ? 'desc' : 'asc';
      }
      page = 1;
      updateSortIndicators();
      updateTable();
    });
    th.addEventListener('keydown', e => {
      if (e.key === 'Enter') th.click();
    });
  });

  function updateSortIndicators() {
    headers.forEach(h => {
      const field = h.dataset.field;
      if (field === sortBy) {
        h.setAttribute('aria-sort', sortDir === 'asc' ? 'ascending' : 'descending');
        h.querySelector('.sort-indicator').textContent = sortDir === 'asc' ? '↑' : '↓';
      } else {
        h.setAttribute('aria-sort', 'none');
        h.querySelector('.sort-indicator').textContent = '';
      }
    });
  }

  updateSortIndicators();
  updateTable();
  renderDetail();
}

function initClientesCadastro(){
  db.initComSeeds();
  clientModalOnSave=null;
  const form=document.getElementById('cliente-form');
  if(form){
    initClienteForm(form,{ includePurchaseSection:true });
    clientModalOnSave=()=>{
      toast('Cliente cadastrado');
      form.reset();
      form.querySelector('#cliente-nome')?.focus();
      updateClientesStats();
    };
  }
  window.openNovoCliente=()=>{
    if(form){
      form.scrollIntoView({ behavior:'smooth', block:'start' });
      form.querySelector('#cliente-nome')?.focus();
    }
  };
  window.refreshClientsTable=undefined;
  window.renderClientsTable=undefined;
  window.renderClientDetail=undefined;
  updateClientesStats();
}

function initClientesTabela(){
  db.initComSeeds();
  const tbody=document.getElementById('clientsFullTbody');
  const searchInput=document.getElementById('clientTableSearch');
  const tagBtn=document.getElementById('tagMenuBtn');
  const pag=document.querySelector('.clients-table-pagination');
  const prevBtn=pag?.querySelector('.prev-page');
  const nextBtn=pag?.querySelector('.next-page');
  const pageInfo=pag?.querySelector('.page-info');
  const pageSizeSel=pag?.querySelector('.page-size');
  const headers=document.querySelectorAll('.table-clients-full th.sortable');
  if(!tbody) return;

  const selectedIds=new Set();
  let currentPageIds=[];
  const selectAllCheckbox=document.getElementById('clientSelectAll');
  function buildPurchaseCard(cp){
    const data=cp.dataCompra ? formatDateDDMMYYYY(cp.dataCompra) : '';
    const valor=cp.valor!=null || cp.valorLente!=null ? formatCurrency(cp.valor ?? cp.valorLente) : '-';
    const material=cp.armacaoMaterial ? `<span class="tag">${cp.armacaoMaterial}</span>` : '';
    const tipos=cp.tiposCompra?.length ? cp.tiposCompra.map(t=>`<span class="tag">${t}</span>`).join(' ') : '';
    const nfe=cp.nfe ? `<div class="info-label">NFE/NFC-e</div><div class="info-value">${cp.nfe}</div>` : '';
    const observacoes=cp.observacoes ? `<div><strong>Observações:</strong> ${cp.observacoes}</div>` : '';
    return `
      <article class="purchase-card" data-id="${cp.id}">
        <h4>Compra${data ? ` · ${data}` : ''}</h4>
        <div class="info-grid">
          <div class="info-label">Armação</div><div class="info-value">${cp.armacao||'-'}${material?` ${material}`:''}</div>
          <div class="info-label">Lente</div><div class="info-value">${cp.lente||'-'}</div>
          <div class="info-label">Valor</div><div class="info-value">${valor}</div>
          ${nfe}
          ${tipos?`<div class="info-label">Tipos</div><div class="info-value">${tipos}</div>`:''}
        </div>
        ${buildFollowupBadges(cp)}
        ${buildRxTable(cp)}
        ${observacoes}
      </article>`;
  }

  function buildClientDetailModalHTML(cliente){
    const telefone=cliente.telefone ? formatTelefone(cliente.telefone) : '-';
    const nascimento=cliente.dataNascimento ? formatDateDDMMYYYY(cliente.dataNascimento) : '-';
    const cpf=cliente.cpf ? formatCpf(cliente.cpf) : '-';
    const genero=cliente.genero || '-';
    const interesses=((cliente.interesses||cliente.usos)||[]).join(', ') || '-';
    const compras=[...(cliente.compras||[])].sort((a,b)=>(b.dataCompra||'').localeCompare(a.dataCompra||''));
    const comprasHtml=compras.length ? `<div class="purchase-history-list">${compras.map(buildPurchaseCard).join('')}</div>` : '<p>Sem compras registradas</p>';
    return `
      <div class="client-detail-modal">
        <div class="mini-card client-overview">
          <h2>${renderClientNameInline(cliente)}</h2>
          <div class="dados-pessoais info-grid">
            <div class="info-label">Telefone</div><div class="info-value">${telefone}</div>
            <div class="info-label">Nascimento</div><div class="info-value">${nascimento||'-'}</div>
            <div class="info-label">CPF</div><div class="info-value">${cpf}</div>
            <div class="info-label">Gênero</div><div class="info-value">${genero}</div>
            <div class="info-label">Interesses</div><div class="info-value">${interesses}</div>
            <div class="info-label">Preferência de contato</div><div class="info-value">${cliente.naoContate ? 'Não contatar' : 'Aceita contato'}</div>
          </div>
        </div>
        <div class="mini-card">
          <div class="detalhe-head"><h3>Histórico de Compras</h3></div>
          ${comprasHtml}
        </div>
      </div>`;
  }

  function openClienteDetailModal(clienteId){
    const cliente=db.buscarPorId(clienteId);
    if(!cliente) return;
    const modal=document.getElementById('app-modal');
    const title=document.getElementById('modal-title');
    const body=modal.querySelector('.modal-body');
    const saveBtn=modal.querySelector('#modal-save');
    const cancelBtn=modal.querySelector('[data-modal-close]');
    const dialog=modal.querySelector('.modal-dialog');
    const header=modal.querySelector('.modal-header');
    let pageBtn=header?.querySelector('.modal-client-page-btn');
    if(!pageBtn && header){
      pageBtn=document.createElement('button');
      pageBtn.type='button';
      pageBtn.className='btn btn-outline modal-client-page-btn';
      pageBtn.textContent='PÁGINA DO CLIENTE';
      header.insertBefore(pageBtn, header.firstChild);
    }
    if(pageBtn){
      pageBtn.hidden=false;
      pageBtn.onclick=()=>{ modal.close(); navigateToClientPage(cliente.id); };
    }
    const prev={
      saveDisplay: saveBtn.style.display,
      saveForm: saveBtn.getAttribute('form'),
      saveAction: saveBtn.getAttribute('data-action'),
      saveType: saveBtn.getAttribute('type'),
      cancelText: cancelBtn.textContent,
      cancelAction: cancelBtn.getAttribute('data-action'),
      cancelType: cancelBtn.getAttribute('type'),
      pageBtnHidden: pageBtn?.hidden ?? true
    };
    saveBtn.style.display='none';
    if(saveBtn.getAttribute('form')) saveBtn.removeAttribute('form');
    if(saveBtn.getAttribute('data-action')) saveBtn.removeAttribute('data-action');
    saveBtn.setAttribute('type','button');
    cancelBtn.textContent='Fechar';
    if(cancelBtn.getAttribute('data-action')) cancelBtn.removeAttribute('data-action');
    cancelBtn.setAttribute('type','button');
    dialog.classList.add('modal-cliente-detalhe');
    title.innerHTML=renderClientNameInline(cliente);
    body.innerHTML=buildClientDetailModalHTML(cliente);
    const originalClose=modal.close.bind(modal);
    modal.close=()=>{
      saveBtn.style.display=prev.saveDisplay;
      if(prev.saveForm) saveBtn.setAttribute('form', prev.saveForm); else saveBtn.removeAttribute('form');
      if(prev.saveAction) saveBtn.setAttribute('data-action', prev.saveAction); else saveBtn.removeAttribute('data-action');
      if(prev.saveType) saveBtn.setAttribute('type', prev.saveType); else saveBtn.setAttribute('type','button');
      cancelBtn.textContent=prev.cancelText;
      if(prev.cancelAction) cancelBtn.setAttribute('data-action', prev.cancelAction); else cancelBtn.removeAttribute('data-action');
      if(prev.cancelType) cancelBtn.setAttribute('type', prev.cancelType); else cancelBtn.setAttribute('type','button');
      dialog.classList.remove('modal-cliente-detalhe');
      if(pageBtn){
        pageBtn.hidden=prev.pageBtnHidden;
        pageBtn.onclick=null;
      }
      modal.close=originalClose;
      originalClose();
    };
    modal.open();
  }

  ui.clients.filters.interesses=getJSON(prefix()+'clients.filters.interesses', []);
  ui.clients.search='';
  let uiState=getJSON(prefix()+'clients.table.ui', { page:1, pageSize:25, sort:{key:'nome',dir:'asc'} });
  let sortBy=uiState.sort.key;
  let sortDir=uiState.sort.dir;
  let page=uiState.page;
  let pageSize=uiState.pageSize;
  if(pageSizeSel) pageSizeSel.value=String(pageSize);

  function syncSelectAll(){
    if(!selectAllCheckbox) return;
    const total=currentPageIds.length;
    let selectedCount=0;
    currentPageIds.forEach(id=>{ if(selectedIds.has(id)) selectedCount++; });
    selectAllCheckbox.checked=total>0 && selectedCount===total;
    selectAllCheckbox.indeterminate=selectedCount>0 && selectedCount<total;
  }

  if(selectAllCheckbox){
    selectAllCheckbox.addEventListener('change',()=>{
      if(selectAllCheckbox.checked){
        currentPageIds.forEach(id=>selectedIds.add(id));
      }else{
        currentPageIds.forEach(id=>selectedIds.delete(id));
      }
      updateTable();
    });
  }

  function persist(){
    setJSON(prefix()+'clients.table.ui',{ page, pageSize, sort:{key:sortBy, dir:sortDir} });
    setJSON(prefix()+'clients.filters.interesses', ui.clients.filters.interesses);
  }

  function buildFollowupLookup(){
    const events=getJSON(calKey(), []).filter(e=>e.meta?.type==='followup');
    const map=new Map();
    events.forEach(ev=>{
      const stage=ev.meta?.stage;
      const clientId=ev.meta?.clienteId || ev.meta?.clientId;
      if(!stage || !clientId) return;
      const key=`${clientId}:${stage}`;
      const due=ev.date || ev.meta?.dueDateISO || '';
      const existing=map.get(key);
      if(!existing || due > existing.dueDate){
        map.set(key,{ dueDate: due, done: !!ev.meta?.done });
      }
    });
    return map;
  }

  function deriveFollowupFromPurchases(cliente, stage){
    let record=null;
    (cliente.compras||[]).forEach(cp=>{
      const fu=cp.followUps?.[stage];
      if(!fu) return;
      const due=fu.dueDateISO || cp.dataCompra || '';
      if(!record || due > record.dueDate){
        record={ dueDate: due, done: !!fu.done };
      }
    });
    return record;
  }

  function getContactStageInfo(cliente, stage, lookup){
    const key=`${cliente.id}:${stage}`;
    return lookup.get(key) || deriveFollowupFromPurchases(cliente, stage) || null;
  }

  function getContactDotClass(info, todayISO){
    if(info?.done) return 'is-green';
    if(info?.dueDate && todayISO && info.dueDate < todayISO) return 'is-orange';
    return 'is-gray';
  }

  function getDerived(c){
    const ultimaCompra=getUltimaCompra(c.compras);
    const valorUltima=ultimaCompra ? Number(ultimaCompra.valor ?? ultimaCompra.valorLente ?? 0) : 0;
    const dataUltima=ultimaCompra?.dataCompra || '';
    const comprasCount=(c.compras||[]).length;
    return { ultimaCompra, valorUltima, dataUltima, comprasCount };
  }

  function updateTable(){
    const source=getClients();
    let clientes=filterClientsBySearchAndTags(source, ui.clients.search);
    const compareNome=(a,b)=> sortDir==='asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome);
    clientes.sort((a,b)=>{
      const da=getDerived(a);
      const db=getDerived(b);
      if(sortBy==='data'){
        if(da.dataUltima===db.dataUltima) return compareNome(a,b);
        return sortDir==='asc' ? da.dataUltima.localeCompare(db.dataUltima) : db.dataUltima.localeCompare(da.dataUltima);
      }
      if(sortBy==='valor'){
        if(da.valorUltima===db.valorUltima) return compareNome(a,b);
        return sortDir==='asc' ? da.valorUltima - db.valorUltima : db.valorUltima - da.valorUltima;
      }
      if(sortBy==='quantidade'){
        if(da.comprasCount===db.comprasCount) return compareNome(a,b);
        return sortDir==='asc' ? da.comprasCount - db.comprasCount : db.comprasCount - da.comprasCount;
      }
      return compareNome(a,b);
    });

    const totalPages=Math.max(1, Math.ceil(clientes.length / pageSize));
    if(page>totalPages) page=totalPages;
    const start=(page-1)*pageSize;
    const slice=clientes.slice(start, start+pageSize);
    currentPageIds=slice.map(c=>c.id);
    const followupLookup=buildFollowupLookup();
    const todayISO=formatDateYYYYMMDD(new Date());
    if(slice.length===0){
      const msg=source.length? 'Nenhum cliente encontrado com os filtros atuais' : 'Nada por aqui ainda';
      tbody.innerHTML=`<tr><td colspan="10" class="empty-state">${msg}</td></tr>`;
    }else{
      tbody.innerHTML=slice.map(c=>{
        const derived=getDerived(c);
        const ultimaCompra=derived.ultimaCompra;
        const telefone=c.telefone ? formatTelefone(c.telefone) : '-';
        const cpf=c.cpf ? formatCpf(c.cpf) : '-';
        const genero=c.genero || '-';
        const interesses=((c.interesses||c.usos)||[]).join(', ') || '-';
        const ultimaData=derived.dataUltima ? formatDateDDMMYYYY(derived.dataUltima) : '-';
        const valorExibicao=ultimaCompra ? formatCurrency(derived.valorUltima) : '-';
        const comprasCount=derived.comprasCount;
        const isSelected=selectedIds.has(c.id);
        const contactDots=FOLLOWUP_PERIODS.map(stage=>{
          const info=getContactStageInfo(c, stage, followupLookup);
          const dotClass=getContactDotClass(info, todayISO);
          return `<span class="contact-dot ${dotClass}"></span>`;
        }).join('');
        return `<tr data-id="${c.id}"${isSelected?' class="row-selected"':''} tabindex="0">`
          +`<td class="select-cell select-col"><input type="checkbox" class="client-select-row" data-id="${c.id}" ${isSelected?'checked':''} aria-label="Selecionar cliente"></td>`
          +`<td data-field="nome">${renderClientNameInline(c)}</td>`
          +`<td data-field="telefone">${telefone}</td>`
          +`<td data-field="cpf">${cpf}</td>`
          +`<td data-field="genero">${genero}</td>`
          +`<td data-field="interesses">${interesses}</td>`
          +`<td data-field="data">${ultimaData || '-'}</td>`
          +`<td data-field="valor">${valorExibicao}</td>`
          +`<td class="contacts-col"><div class="contact-dots">${contactDots}</div></td>`
          +`<td data-field="quantidade">${comprasCount}</td>`
          +`</tr>`;
      }).join('');
      tbody.querySelectorAll('.client-select-row').forEach(cb=>{
        cb.addEventListener('change',()=>{
          const id=cb.dataset.id;
          if(!id) return;
          if(cb.checked){ selectedIds.add(id); } else { selectedIds.delete(id); }
          cb.closest('tr')?.classList.toggle('row-selected', cb.checked);
          syncSelectAll();
        });
      });
      tbody.querySelectorAll('tr[data-id]').forEach(row=>{
        row.addEventListener('click',e=>{
          if(e.target.closest('.client-select-row')) return;
          if(e.target.closest('button')) return;
          const id=row.dataset.id;
          if(id) openClienteDetailModal(id);
        });
        row.addEventListener('keydown',e=>{
          if(e.key==='Enter' || e.key===' '){
            e.preventDefault();
            const id=row.dataset.id;
            if(id) openClienteDetailModal(id);
          }
        });
      });
    }
    syncSelectAll();
    if(pageInfo) pageInfo.textContent=`Página ${clientes.length ? page : 0} de ${totalPages}`;
    if(prevBtn) prevBtn.disabled=page<=1;
    if(nextBtn) nextBtn.disabled=page>=totalPages;
    persist();
    updateClientesStats();
  }

  function updateSortIndicators(){
    headers.forEach(h=>{
      const field=h.dataset.field;
      if(field===sortBy){
        h.setAttribute('aria-sort', sortDir==='asc'?'ascending':'descending');
        h.querySelector('.sort-indicator').textContent=sortDir==='asc'?'↑':'↓';
      }else{
        h.setAttribute('aria-sort','none');
        h.querySelector('.sort-indicator').textContent='';
      }
    });
  }

  if(searchInput){
    searchInput.addEventListener('input',()=>{ ui.clients.search=searchInput.value; page=1; updateTable(); });
    searchInput.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); ui.clients.search=searchInput.value; page=1; updateTable(); }});
  }
  if(tagBtn){
    tagBtn.onclick=e=>{
      e.stopPropagation();
      if(tagMenuOpen){ closeTagMenu(); } else { openTagMenu(); }
    };
  }
  if(prevBtn) prevBtn.addEventListener('click',()=>{ if(page>1){ page--; updateTable(); } });
  if(nextBtn) nextBtn.addEventListener('click',()=>{ page++; updateTable(); });
  if(pageSizeSel) pageSizeSel.addEventListener('change',()=>{ pageSize=parseInt(pageSizeSel.value,10); page=1; updateTable(); });

  headers.forEach(th=>{
    th.addEventListener('click',()=>{
      const field=th.dataset.field;
      if(sortBy===field){
        sortDir=sortDir==='asc'?'desc':'asc';
      }else{
        sortBy=field;
        sortDir=(field==='data'||field==='valor'||field==='quantidade')?'desc':'asc';
      }
      page=1;
      updateSortIndicators();
      updateTable();
    });
    th.addEventListener('keydown',e=>{ if(e.key==='Enter') th.click(); });
  });

  window.openNovoCliente=()=>{ location.hash='#/clientes-cadastro'; };
  window.refreshClientsTable=updateTable;
  window.renderClientsTable=updateTable;
  window.renderClientDetail=undefined;

  updateSortIndicators();
  updateTable();
}

function initClientePagina(){
  db.initComSeeds();
  const container=document.getElementById('clientePage');
  if(!container) return;

  const backBtn=container.querySelector('[data-action="cliente-voltar"]');
  if(backBtn && !backBtn.dataset.bound){
    backBtn.addEventListener('click',()=>{ location.hash='#/clientes-tabela'; });
    backBtn.dataset.bound='true';
  }

  const emptyState=container.querySelector('.cliente-page-empty');
  const sections=container.querySelector('.cliente-page-sections');
  const titleEl=container.querySelector('#clientePageTitle');
  const subtitleEl=container.querySelector('#clientePageSubtitle');
  const editBtn=container.querySelector('[data-action="cliente-editar"]');
  const novaCompraBtn=container.querySelector('[data-action="cliente-nova-compra"]');
  const dadosBody=container.querySelector('#clienteDadosPessoais');
  const comprasBody=container.querySelector('#clienteHistoricoCompras');
  const contatosBody=container.querySelector('#clienteHistoricoContatos');
  const naoContateToggle=container.querySelector('[data-action="cliente-toggle-nao-contate"]');

  const setEmpty=()=>{
    if(titleEl) titleEl.textContent='Página do Cliente';
    if(subtitleEl) subtitleEl.textContent='Selecione um cliente na Tabela de Clientes.';
    if(emptyState) emptyState.hidden=false;
    if(sections) sections.hidden=true;
    if(editBtn){ editBtn.disabled=true; editBtn.onclick=null; }
    if(novaCompraBtn){ novaCompraBtn.disabled=true; novaCompraBtn.onclick=null; }
    if(naoContateToggle){
      naoContateToggle.checked=false;
      naoContateToggle.disabled=true;
      naoContateToggle.onchange=null;
    }
    if(dadosBody) dadosBody.innerHTML='';
    if(comprasBody) comprasBody.innerHTML='';
    if(contatosBody) contatosBody.innerHTML='';
  };

  let clienteId=state.getClienteSelecionadoId();
  if(!clienteId){ setEmpty(); return; }
  let cliente=db.buscarPorId(clienteId);
  if(!cliente){ setEmpty(); return; }
  state.setClienteSelecionado(cliente.id);

  function ensureActions(){
    if(editBtn){
      editBtn.disabled=false;
      editBtn.onclick=()=>openClienteModal(cliente.id, id=>{
        state.setClienteSelecionado(id);
        refreshCliente();
        window.renderClientsTable?.();
        window.renderClientDetail?.();
      });
    }
    if(novaCompraBtn){
      novaCompraBtn.disabled=false;
      novaCompraBtn.onclick=()=>openCompraModal(cliente.id, null, ()=>{
        refreshCliente();
        window.renderClientsTable?.();
        window.renderClientDetail?.();
      });
    }
    if(naoContateToggle){
      naoContateToggle.disabled=false;
      naoContateToggle.checked=!!cliente.naoContate;
      naoContateToggle.onchange=null;
      naoContateToggle.onchange=()=>{
        const marcado=naoContateToggle.checked;
        db.atualizarCliente(cliente.id,{ naoContate:marcado });
        cliente={ ...cliente, naoContate:marcado };
        refreshCliente();
        window.renderClientsTable?.();
        window.renderClientDetail?.();
      };
    }
  }

  function updateHeader(){
    if(titleEl) titleEl.innerHTML=renderClientNameInline(cliente);
    if(subtitleEl){
      const parts=[];
      const compras=cliente.compras||[];
      if(compras.length){
        const sorted=[...compras].sort((a,b)=>(b.dataCompra||'').localeCompare(a.dataCompra||''));
        const ultima=sorted[0];
        const ultimaData=ultima?.dataCompra ? formatDateDDMMYYYY(ultima.dataCompra) : '';
        parts.push(`${compras.length} ${compras.length===1?'compra':'compras'}`);
        if(ultimaData) parts.push(`Última compra ${ultimaData}`);
      }
      if(cliente.atualizadoEm){
        const atualizado=formatDateDDMMYYYY(cliente.atualizadoEm);
        if(atualizado) parts.push(`Atualizado em ${atualizado}`);
      }
      subtitleEl.textContent=parts.join(' · ');
    }
    if(emptyState) emptyState.hidden=true;
    if(sections) sections.hidden=false;
  }

  function renderDados(){
    if(!dadosBody) return;
    const telefone=cliente.telefone ? formatTelefone(cliente.telefone) : '-';
    const nascimento=cliente.dataNascimento ? formatDateDDMMYYYY(cliente.dataNascimento) : '-';
    const cpf=cliente.cpf ? formatCpf(cliente.cpf) : '-';
    const genero=cliente.genero || '-';
    const email=cliente.email || '-';
    const endereco=cliente.endereco || '-';
    const interesses=((cliente.interesses||cliente.usos)||[]).join(', ') || '-';
    const observacoes=cliente.observacoes ? `<div class="cliente-data-observacoes"><span>Observações</span><p>${cliente.observacoes}</p></div>` : '';
    dadosBody.innerHTML=`
      <dl class="cliente-data-grid">
        <div><dt>Telefone</dt><dd>${telefone}</dd></div>
        <div><dt>Data de nascimento</dt><dd>${nascimento}</dd></div>
        <div><dt>CPF</dt><dd>${cpf}</dd></div>
        <div><dt>Gênero</dt><dd>${genero}</dd></div>
        <div><dt>Email</dt><dd>${email}</dd></div>
        <div><dt>Endereço</dt><dd>${endereco}</dd></div>
        <div><dt>Interesses</dt><dd>${interesses}</dd></div>
        <div><dt>Preferência de contato</dt><dd>${cliente.naoContate ? 'Não contatar' : 'Aceita contato'}</dd></div>
      </dl>
      ${observacoes}`;
  }

  function renderCompras(){
    if(!comprasBody) return;
    const compras=[...(cliente.compras||[])].sort((a,b)=>(b.dataCompra||'').localeCompare(a.dataCompra||''));
    if(!compras.length){
      comprasBody.innerHTML='<div class="empty-state">Sem compras registradas.</div>';
      return;
    }
    comprasBody.innerHTML=compras.map((cp,idx)=>{
      const dataCompra=cp.dataCompra ? formatDateDDMMYYYY(cp.dataCompra) : 'Compra';
      const valor=cp.valor!=null || cp.valorLente!=null ? formatCurrency(cp.valor ?? cp.valorLente) : '-';
      const material=cp.armacaoMaterial ? `<span class="tag">${cp.armacaoMaterial}</span>` : '';
      const tipos=cp.tiposCompra?.length ? cp.tiposCompra.map(t=>`<span class="tag">${t}</span>`).join(' ') : '';
      const observacoes=cp.observacoes ? `<div class="cliente-compra-observacoes"><span>Observações</span><p>${cp.observacoes}</p></div>` : '';
      return `<details class="cliente-compra" data-purchase-id="${cp.id}"${idx===0?' open':''}>
        <summary>
          <span class="compra-summary-title">${dataCompra}</span>
          <span class="compra-summary-meta">${valor}</span>
        </summary>
        <div class="cliente-compra-body">
          <div class="cliente-compra-info">
            <div class="info-line"><span class="info-label">Armação</span><span class="info-value">${cp.armacao || '-'}${material?` ${material}`:''}</span></div>
            <div class="info-line"><span class="info-label">Lente</span><span class="info-value">${cp.lente || '-'}</span></div>
            <div class="info-line"><span class="info-label">Valor</span><span class="info-value">${valor}</span></div>
            ${cp.nfe?`<div class="info-line"><span class="info-label">NFE/NFC-e</span><span class="info-value">${cp.nfe}</span></div>`:''}
            ${tipos?`<div class="info-line"><span class="info-label">Tipos</span><span class="info-value">${tipos}</span></div>`:''}
          </div>
          <div class="cliente-compra-followups">${buildFollowupBadges(cp)}</div>
          ${buildRxTable(cp)}
          ${observacoes}
          <div class="cliente-compra-actions">
            <button type="button" class="btn btn-outline" data-action="cliente-editar-compra" data-purchase-id="${cp.id}">Editar</button>
          </div>
        </div>
      </details>`;
    }).join('');
    comprasBody.querySelectorAll('[data-action="cliente-editar-compra"]').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.preventDefault();
        const purchaseId=btn.dataset.purchaseId;
        if(!purchaseId) return;
        openCompraModal(cliente.id, purchaseId, ()=>{
          refreshCliente();
          window.renderClientsTable?.();
          window.renderClientDetail?.();
        });
      });
    });
  }

  function renderContatos(){
    if(!contatosBody) return;
    const rows=[];
    (cliente.compras||[]).forEach(compra=>{
      const compraData=compra.dataCompra ? formatDateDDMMYYYY(compra.dataCompra) : '-';
      const baseDate=parseDDMMYYYY(compra.dataCompra);
      FOLLOWUP_PERIODS.forEach(period=>{
        const offset=FOLLOWUP_OFFSETS[period];
        let due=null;
        if(baseDate && !isNaN(baseDate.getTime())) due=addDaysUTC(baseDate, offset);
        const dueISO=due ? due.toISOString().split('T')[0] : '';
        const dueLabel=due ? formatDateDDMMYYYY(due) : '-';
        const done=!!compra.followUps?.[period]?.done;
        rows.push({ compraId: compra.id, period, compraData, dueLabel, dueISO, done });
      });
    });
    rows.sort((a,b)=>{
      if(a.dueISO && b.dueISO) return a.dueISO.localeCompare(b.dueISO);
      if(a.dueISO) return -1;
      if(b.dueISO) return 1;
      return 0;
    });
    if(!rows.length){
      contatosBody.innerHTML='<div class="empty-state">Nenhum contato programado.</div>';
      return;
    }
    contatosBody.innerHTML=`
      <table class="table cliente-contatos-table">
        <thead><tr><th>Data da compra</th><th>Data do contato</th><th>Executado</th></tr></thead>
        <tbody>
          ${rows.map(row=>{
            const label=FOLLOWUP_LABELS[row.period]||row.period;
            return `<tr data-purchase-id="${row.compraId}" data-period="${row.period}">
              <td>${row.compraData}</td>
              <td><div class="contato-date">${row.dueLabel}</div><small>${label}</small></td>
              <td class="contato-status"><label class="contato-switch"><input type="checkbox" ${row.done?'checked':''} aria-label="Contato ${label} realizado"><span></span></label></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    contatosBody.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
      cb.addEventListener('change',()=>{
        const tr=cb.closest('tr');
        const purchaseId=tr?.dataset.purchaseId;
        const period=tr?.dataset.period;
        if(!purchaseId || !period) return;
        const latest=db.buscarPorId(cliente.id);
        if(!latest) return;
        const target=latest.compras?.find(c=>c.id===purchaseId);
        if(!target) return;
        const followUps={ ...target.followUps, [period]: { ...(target.followUps?.[period]||{}), done: cb.checked, doneAt: cb.checked ? new Date().toISOString() : null } };
        db.atualizarCompra(cliente.id, purchaseId, { followUps }, { skipReload:true, skipDashboard:true });
        renderCalendarMonth?.();
        renderDashboard?.();
        refreshCliente();
      });
    });
  }

  function refreshCliente(){
    cliente=db.buscarPorId(cliente.id) || cliente;
    if(!cliente){ setEmpty(); return; }
    state.setClienteSelecionado(cliente.id);
    ensureActions();
    updateHeader();
    renderDados();
    renderCompras();
    renderContatos();
  }

  ensureActions();
  refreshCliente();
}


function loadDashLayout(){
  ensureSeed(getPerfil());
  const layout = getJSON(dashKey(), defaultDashLayout());
  layout.slots = normalizeDashSlots(layout?.slots);
  return layout;
}

function saveDashLayout(layout){ setJSON(dashKey(), layout); }

function getFollowupsStats(){
  const events = getJSON(calKey(), []).filter(e=>e.meta && e.meta.type==='followup');
  const today = new Date(); const tz = today.getTimezoneOffset();
  const isSameDay = (a,b)=> a.getUTCFullYear()===b.getUTCFullYear() && a.getUTCMonth()===b.getUTCMonth() && a.getUTCDate()===b.getUTCDate();
  const startOfWeek = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - ((today.getUTCDay()+6)%7)));
  const startOfMonth= new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  let todayCount=0, late=0, doneWeek=0, doneMonth=0;
  events.forEach(ev=>{
    const d = new Date(ev.date);
    const done = !!ev.meta?.done;
    if(isSameDay(d, today)) todayCount++;
    if(d < today && !done) late++;
    if(done && d >= startOfWeek) doneWeek++;
    if(done && d >= startOfMonth) doneMonth++;
  });
  return { todayCount, late, doneWeek, doneMonth };
}

function getClientsContactsStats(year){
  const clients = getClients();
  const events = getJSON(calKey(), []).filter(e => e.meta?.type === 'followup');
  const cCounts = Array(12).fill(0);
  const fCounts = Array(12).fill(0);
  clients.forEach(c => {
    const ts = parseInt((c.id || '').split('_')[1]);
    if(!isNaN(ts)){
      const d = new Date(ts);
      if(d.getFullYear() === year) cCounts[d.getMonth()]++;
    }
  });
  events.forEach(ev => {
    const d = new Date(ev.date);
    if(d.getFullYear() === year) fCounts[d.getMonth()]++;
  });
  return { clientes: cCounts, contatos: fCounts };
}

function renderWidgetContent(card, cardInner, slot){
  if(slot.id === 'widget.clientsContactsChart'){
    const title=document.createElement('div'); title.className='dash-card-title'; title.textContent='Clientes x Contatos';
    const select=document.createElement('select'); select.className='year-select';
    const year=new Date().getFullYear();
    for(let y=year; y>=year-4; y--){ const opt=document.createElement('option'); opt.value=String(y); opt.textContent=String(y); select.appendChild(opt); }
    const chart=document.createElement('div'); chart.className='bar-chart';
    const groups=[]; for(let m=0;m<12;m++){ const g=document.createElement('div'); g.className='bar-group'; const b1=document.createElement('div'); b1.className='bar green'; const b2=document.createElement('div'); b2.className='bar orange'; g.append(b1,b2); groups.push({b1,b2}); chart.appendChild(g); }
    const labels=document.createElement('div'); labels.className='bar-chart-labels';
    ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].forEach(m=>{ const s=document.createElement('span'); s.textContent=m; labels.appendChild(s); });
    cardInner.appendChild(title); cardInner.appendChild(select); cardInner.appendChild(chart); cardInner.appendChild(labels);
    card.style.background='#fff';
    function render(){
      const stats=getClientsContactsStats(parseInt(select.value,10));
      const max=Math.max(...stats.clientes,...stats.contatos,1);
      groups.forEach((g,i)=>{
        g.b1.style.height=`${stats.clientes[i]/max*100}%`;
        g.b2.style.height=`${stats.contatos[i]/max*100}%`;
      });
    }
    select.addEventListener('change',render); select.value=String(year); render();
    return;
  }
  const title = document.createElement('div'); title.className='dash-card-title';
  const value = document.createElement('div'); value.className='dash-card-value';

  if(slot.id === 'widget.clientsCount'){
    title.textContent = 'Quantidade de clientes';
    value.textContent = String(getClients().length);
// Adiciona o status de sucesso no container do card.
// Preferimos o elemento 'card' se existir; senão, caímos no pai do 'cardInner'.
const cardContainer = card || cardInner?.parentElement;
if (cardContainer) {
  cardContainer.classList.add('card-success');
}
  } else if(slot.id === 'widget.followupsToday'){
    title.textContent = 'Contatos para Hoje';
    value.textContent = String(getFollowupsStats().todayCount);
    card.classList.add('card-info');
  } else if(slot.id === 'widget.followupsLate'){
    title.textContent = 'Contatos Atrasados';
    value.textContent = String(getFollowupsStats().late);
    card.classList.add('card-danger');
  } else if(slot.id === 'widget.followupsDone'){
    title.textContent = 'Contatos Efetuados';
    const s = getFollowupsStats();
    value.innerHTML = `<div class="subline">Semana: ${s.doneWeek}</div><div class="subline">Mês: ${s.doneMonth}</div>`;
    card.classList.add('card-success','card-compact');
  }

  cardInner.appendChild(title); cardInner.appendChild(value);
}

function renderDashboard(){
  purgeOrphanEvents();
  const grid = document.getElementById('dashboardGrid');
  if(!grid) return;
  const layout = loadDashLayout();
  grid.innerHTML = '';
  layout.slots.forEach((slot, i)=>{
    if(!slot) return;
    const slotEl = document.createElement('div');
    slotEl.className = 'dash-slot';
    slotEl.dataset.slot = i;
    if(slot?.size==='2x1') slotEl.style.gridColumn='span 2';
    slotEl.addEventListener('dragover', e=>{e.preventDefault(); slotEl.classList.add('dropping');});
    slotEl.addEventListener('dragleave', ()=>slotEl.classList.remove('dropping'));
    slotEl.addEventListener('drop', e=>{
      e.preventDefault(); slotEl.classList.remove('dropping');
      const from = +e.dataTransfer.getData('text/plain');
      if(from===i) return;
      const lay = loadDashLayout();
      [lay.slots[from], lay.slots[i]] = [lay.slots[i], lay.slots[from]];
      saveDashLayout(lay); renderDashboard();
    });

    const card = document.createElement('div');
    card.className = 'dash-card';
    card.draggable = true;
    card.addEventListener('dragstart', e=>e.dataTransfer.setData('text/plain', i));

    const close = document.createElement('button');
    close.className = 'card-close';
    close.title = 'Remover';
    close.textContent = '×';
    close.onclick = ()=>{
      const lay = loadDashLayout();
      lay.slots = lay.slots.filter((_, idx)=>idx !== i);
      saveDashLayout(lay);
      renderDashboard();
    };

    const wrap = document.createElement('div'); wrap.className = 'dash-card-inner';
    renderWidgetContent(card, wrap, slot);
    card.appendChild(close);
    card.appendChild(wrap);
    slotEl.appendChild(card);

    grid.appendChild(slotEl);
  });

}

let dashMenu, dashBtn;

function openDashMenu(anchor){
  const r = anchor.getBoundingClientRect();
  dashMenu.style.left = `${r.left}px`;
  dashMenu.style.top  = `${r.bottom + 6}px`;
  dashMenu.hidden = false;
}
function closeDashMenu(){ if(dashMenu) dashMenu.hidden = true; }

function initDashboardPage(){
  renderDashboard();
  dashMenu = document.getElementById('dashAddMenu');
  dashBtn  = document.getElementById('dashAddBtn');
  bindOnce(dashBtn,'click', (e)=>{
    e.stopPropagation();
    dashMenu.hidden ? openDashMenu(e.currentTarget) : closeDashMenu();
  });
}
document.addEventListener('click', (e)=>{
  if(dashMenu && !dashMenu.hidden && !dashMenu.contains(e.target) && e.target !== dashBtn) closeDashMenu();
});

function initContatosHistoricoPage(){
  const container=document.getElementById('contatosHistorico');
  if(!container) return;
  const tabs=Array.from(container.querySelectorAll('.historico-tab'));
  const panels=new Map(Array.from(container.querySelectorAll('[data-tab-content]')).map(panel=>[panel.dataset.tabContent,panel]));
  function activate(tab){
    const target=tab || tabs[0]?.dataset.tab;
    tabs.forEach(btn=>{
      btn.classList.toggle('is-active', btn.dataset.tab===target);
    });
    panels.forEach((panel,key)=>{
      panel.hidden=key!==target;
    });
  }
  tabs.forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.tab)));
  activate(container.querySelector('.historico-tab.is-active')?.dataset.tab);
}

function initGerenciaConfigPage(){
  initLojaConfig();
  initConfiguracoesPage();
}

function initGerenciaMensagensPage(){
  const container=document.getElementById('gerenciaMensagens');
  if(!container) return;
  const tabs=Array.from(container.querySelectorAll('.mensagem-tab'));
  const panels=new Map(Array.from(container.querySelectorAll('[data-tab-content]')).map(panel=>[panel.dataset.tabContent,panel]));
  function activate(tab){
    const target=tab || tabs[0]?.dataset.tab;
    tabs.forEach(btn=>{
      btn.classList.toggle('is-active', btn.dataset.tab===target);
    });
    panels.forEach((panel,key)=>{
      panel.hidden=key!==target;
    });
  }
  tabs.forEach(btn=>btn.addEventListener('click',()=>activate(btn.dataset.tab)));
  activate(container.querySelector('.mensagem-tab.is-active')?.dataset.tab);
}

function initConfiguracoesPage(){
  if(getPerfil()!=='Administrador') return;
  dbUsuarios.initSeeds();
  const tbody=document.querySelector('.table-usuarios tbody');
  const addBtn=document.querySelector('.add-usuario');
  function render(){
    const data=dbUsuarios.listar();
    tbody.innerHTML='';
    data.forEach(u=>{
      const tr=document.createElement('tr');
      const disabled=PROTECTED_USERS.includes(u.nome);
      tr.innerHTML=`<td>${u.nome}</td><td>${u.email||''}</td><td>${u.perfil||''}</td><td class="acoes"><button class="btn-icon edit" data-id="${u.id}" aria-label="Editar">${iconEdit}</button><button class="btn-icon remove" data-id="${u.id}" aria-label="Remover" ${disabled?'disabled title="Usuário protegido"':''}>${iconTrash}</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('.edit').forEach(btn=>btn.addEventListener('click',()=>openUsuarioModal(btn.dataset.id)));
    tbody.querySelectorAll('.remove').forEach(btn=>btn.addEventListener('click',()=>{ if(btn.disabled) return; if(confirm('Remover usuário?')){ dbUsuarios.remover(btn.dataset.id); render(); }}));
  }
  function openUsuarioModal(id){
    const modal=document.getElementById('app-modal');
    const saveBtn = modal.querySelector('#modal-save');
    saveBtn.removeAttribute('data-action');
    saveBtn.setAttribute('type','submit');
    const title=document.getElementById('modal-title');
    const body=modal.querySelector('.modal-body');
    title.textContent=id?'Editar usuário':'Novo usuário';
    body.innerHTML=`<form id="usuario-form"><div class="form-grid"><div class="form-field col-span-12"><label for="u-nome">Nome *</label><input id="u-nome" name="nome" class="text-input" required></div><div class="form-field col-span-12"><label for="u-email">Email</label><input id="u-email" name="email" class="text-input"></div><div class="form-field col-span-12"><label for="u-perfil">Perfil</label><input id="u-perfil" name="perfil" class="text-input"></div></div></form>`;
    saveBtn.setAttribute('form','usuario-form');
    const form=body.querySelector('#usuario-form');
    if(id){ const u=dbUsuarios.listar().find(x=>x.id===id); form['u-nome'].value=u.nome; form['u-email'].value=u.email||''; form['u-perfil'].value=u.perfil||''; }
    modal.open();
    form.addEventListener('submit',e=>{
      e.preventDefault();
      const payload={ nome:form['u-nome'].value.trim(), email:form['u-email'].value, perfil:form['u-perfil'].value };
      if(!payload.nome){ form.reportValidity(); return; }
      if(id) dbUsuarios.atualizar(id,payload); else dbUsuarios.adicionar({id:uuid(),...payload});
      modal.close();
      render();
    });
  }
  addBtn.addEventListener('click',()=>openUsuarioModal());
  render();
}

function initLojaConfig(){
  const form=document.getElementById('loja-form');
  if(!form) return;
  const info=getProfileInfo();
  const logoInput=form.querySelector('#loja-logo');
  const logoBtn=form.querySelector('#loja-logo-btn');
  const logoPreview=form.querySelector('#loja-logo-preview');
  form['loja-nome'].value=info.nome||'';
  form['loja-telefone'].value=info.telefone||'';
  form['loja-endereco'].value=info.endereco||'';
  form['loja-instagram'].value=info.instagram||'';
  if(info.logo){ logoPreview.src=info.logo; }
  else { logoPreview.style.display='none'; }
  logoBtn.addEventListener('click',()=>logoInput.click());
  logoInput.addEventListener('change',e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{ logoPreview.src=reader.result; logoPreview.style.display='block'; };
    reader.readAsDataURL(file);
  });
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const payload={
      nome:form['loja-nome'].value.trim(),
      telefone:form['loja-telefone'].value.trim(),
      endereco:form['loja-endereco'].value.trim(),
      instagram:form['loja-instagram'].value.trim(),
      logo:logoPreview.src||''
    };
    setJSON(`perfil:${currentProfile()}:info`,payload);
    toast('Dados da loja salvos');
  });
}

// ===== Limpeza de caches =====
async function limparCachesJoaoClaro(){
  function cleanse(storage){
    for(let i=storage.length-1;i>=0;i--){
      const key=storage.key(i);
      const value=storage.getItem(key);
      if(!value) continue;
      if(value.includes && isNomeBloqueado(value)){ storage.removeItem(key); continue; }
      try{
        const parsed=JSON.parse(value);
        if(Array.isArray(parsed)){
          const filtered=parsed.filter(item=>{
            if(typeof item==='string') return !isNomeBloqueado(item);
            if(item && typeof item==='object') return !isNomeBloqueado(item.nomeCliente) && !isNomeBloqueado(item.nome);
            return true;
          });
          if(filtered.length!==parsed.length) storage.setItem(key,JSON.stringify(filtered));
        }else if(parsed && typeof parsed==='object'){
          if(isNomeBloqueado(parsed.nomeCliente) || isNomeBloqueado(parsed.nome)) storage.removeItem(key);
        }
      }catch(e){
        // valor não JSON
      }
    }
  }
  cleanse(localStorage);
  cleanse(sessionStorage);
  if(window.indexedDB && indexedDB.databases){
    const dbs=await indexedDB.databases();
    for(const info of dbs){
      const req=indexedDB.open(info.name);
      req.onsuccess=()=>{
        const db=req.result;
        const tx=db.transaction(db.objectStoreNames,'readwrite');
        tx.objectStoreNames.forEach(storeName=>{
          const store=tx.objectStore(storeName);
          const getAll=store.getAll();
          getAll.onsuccess=()=>{
            getAll.result.forEach(item=>{
              if(isNomeBloqueado(item?.nomeCliente) || isNomeBloqueado(item?.nome)){
                if('id' in item) store.delete(item.id);
              }
            });
          };
        });
      };
    }
  }
}

function reloadCalendario(currentDate){
  purgeOrphanEvents();
  const date = currentDate ?? window.currentDate ?? new Date();
  if(currentRoute==='calendario'){
    if(typeof renderCalendarMonth === 'function'){
      renderCalendarMonth(date);
    }else{
      renderRoute('calendario');
    }
    updateCalendarMenuBar();
  }
}

let clientModalOnSave=null;
let purchaseModalOnSave=null;

function parseCurrency(str){
  const n = parseFloat((str||'').toString().replace(/[^\d,-]/g,'').replace(',','.'));
  return isNaN(n)?0:n;
}

function readPrescriptionTable(){
  const get = name => document.querySelector(`[name="${name}"]`)?.value.trim() || '';
  return {
    oe:{ esferico:get('oe_esferico'), cilindrico:get('oe_cilindrico'), eixo:get('oe_eixo'), dnp:get('oe_dnp'), adicao:get('oe_adicao') },
    od:{ esferico:get('od_esferico'), cilindrico:get('od_cilindrico'), eixo:get('od_eixo'), dnp:get('od_dnp'), adicao:get('od_adicao') }
  };
}

function getSelectedInteressesFromForm(){
  return Array.from(document.querySelectorAll('#cliente-interesses button[aria-pressed="true"]'))
              .map(btn => btn.dataset.value);
}

function readClientForm(){
  const formData = {
    id: document.getElementById('cliente-id')?.value || null,
    nome: document.getElementById('cliente-nome').value.trim(),
    telefone: document.getElementById('cliente-telefone').value.trim(),
    dataNascimento: document.getElementById('cliente-dataNascimento').value.trim(),
    cpf: document.getElementById('cliente-cpf').value.trim(),
    genero: document.querySelector('#cliente-genero .seg-btn[aria-pressed="true"]')?.dataset.value || '',
    interesses: getSelectedInteressesFromForm()
  };

  const naoContateEl=document.getElementById('cliente-nao-contate');
  if(naoContateEl) formData.naoContate=naoContateEl.checked;

  const obsEl = document.getElementById('cliente-observacoes');
  if(obsEl) formData.observacoes = obsEl.value.trim();

  const dataCompraEl = document.getElementById('compra-data');
  if(dataCompraEl){
    const compra = {
      id: `cmp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      dataCompra: dataCompraEl.value,
      valorLente: parseCurrency(document.getElementById('compra-valor')?.value),
      nfe: document.getElementById('compra-nfe')?.value.trim() || '',
      armacao: document.getElementById('compra-armacao')?.value.trim() || '',
      armacaoMaterial: document.querySelector('#compra-material .seg-btn[aria-pressed="true"]')?.dataset.value || '',
      lente: document.getElementById('compra-lente')?.value.trim() || '',
      tiposCompra: Array.from(document.querySelectorAll('#compra-tipos .seg-btn[aria-pressed="true"]')).map(b=>b.dataset.value),
      observacoes: document.getElementById('compra-observacoes')?.value.trim() || '',
      receituario: {
        oe: {
          esferico: document.querySelector('[name="oe_esferico"]')?.value.trim() || '',
          cilindrico: document.querySelector('[name="oe_cilindrico"]')?.value.trim() || '',
          eixo: document.querySelector('[name="oe_eixo"]')?.value.trim() || '',
          dnp: document.querySelector('[name="oe_dnp"]')?.value.trim() || '',
          adicao: document.querySelector('[name="oe_adicao"]')?.value.trim() || ''
        },
        od: {
          esferico: document.querySelector('[name="od_esferico"]')?.value.trim() || '',
          cilindrico: document.querySelector('[name="od_cilindrico"]')?.value.trim() || '',
          eixo: document.querySelector('[name="od_eixo"]')?.value.trim() || '',
          dnp: document.querySelector('[name="od_dnp"]')?.value.trim() || '',
          adicao: document.querySelector('[name="od_adicao"]')?.value.trim() || ''
        }
      }
    };
    const hasCompraData = compra.dataCompra || compra.valorLente || compra.nfe || compra.armacao ||
      compra.armacaoMaterial || compra.lente || compra.tiposCompra.length || compra.observacoes ||
      Object.values(compra.receituario.oe).some(v=>v) || Object.values(compra.receituario.od).some(v=>v);
    if(hasCompraData) formData.compras = [compra];
  }

  return formData;
}

function readPurchaseForm(){
  const materialBtn = document.querySelector('#compra-material .seg-btn[aria-pressed="true"]');
  const clientIdEl = document.getElementById('purchaseClientId');
  if(!clientIdEl) return { clienteId: null, compra: {} };
  return {
    clienteId: clientIdEl.value,
    compra: {
      id: document.getElementById('purchaseId').value || null,
      dataCompra: document.getElementById('compra-data').value,
      nfe: document.getElementById('compra-nfe').value.trim(),
      armacao: document.getElementById('compra-armacao').value.trim(),
      material: materialBtn?.dataset.value || '',
      lente: document.getElementById('compra-lente').value.trim(),
      valor: parseCurrency(document.getElementById('compra-valor').value),
      tiposCompra: Array.from(document.querySelectorAll('#compra-tipos .seg-btn[aria-pressed="true"]')).map(b=>b.dataset.value),
      grau: readPrescriptionTable()
    }
  };
}

function openModal(id){
  const m=document.getElementById(id); if(!m) return;
  closeTagMenu?.();
  if(!document.querySelector('[data-overlay]')){
    const o=document.createElement('div');
    o.dataset.overlay='';
    document.body.appendChild(o);
  }
  // store the element that triggered the modal to restore focus later
  m.__opener=document.activeElement;
  m.classList.add('is-open');
  m.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeModal(id){
  const m=document.getElementById(id) || document.getElementById('app-modal');
  const finalize=()=>{
    if(m){
      m.hidden = true;
      m.classList.remove('is-open');
      m.setAttribute('aria-hidden','true');
    }
    document.body.classList.remove('modal-open');
    document.querySelectorAll('.modal-backdrop, .veil, [data-overlay]').forEach(n=>n.remove());
  };
  if(m){
    const opener=m.__opener;
    if(opener && typeof opener.focus==='function') opener.focus();
    else if(document.activeElement && typeof document.activeElement.blur==='function') document.activeElement.blur();
    // ensure the modal is hidden only after focus leaves it
    setTimeout(finalize,0);
  }else{
    finalize();
  }
}

function closeClientModal(){
  closeModal();
  refreshUI();
}

function closePurchaseModal(){
  closeModal();
  refreshUI();
}

function refreshUI(){
  updateClientesStats();
  window.renderClientsTable?.();
  window.renderClientDetail?.();
  renderSelectedPurchaseDetails?.();
  renderCalendarMonth?.();
  renderDashboard?.();
  bindUI();
}

function bindUI(){
  if(window.__BINDMAP){
    window.__BINDMAP();
  }
  const handler=e=>{
    const btn=e.target.closest('[data-action]');
    if(!btn) return;
    const act=btn.dataset.action;
      switch(act){
        case 'client:add': openContactModalForSelected?.(); break;
        case 'client:new': window.openNovoCliente?.(); break;
        case 'client:save': handleClientSave(); break;
        case 'client:cancel': closeClientModal(); break;
        case 'purchase:add': openPurchaseModalForSelected?.(); break;
      case 'purchase:save': handlePurchaseSave(); break;
      case 'purchase:cancel': closePurchaseModal(); break;
      case 'purchase:delete': deletePurchase?.(btn.dataset.purchaseId, currentClientId); break;
      case 'client:delete': deleteClient?.(btn.dataset.clientId); break;
      case 'tagmenu:toggle': toggleTagMenu(btn); break;
      case 'widget:add': insertWidgetOnce?.(btn.dataset.widget); break;
      case 'widget:remove': removeWidget?.(btn.dataset.widgetId); break;
    }
  };
  document.body.addEventListener('click', handler);
  window.__BINDMAP=()=>document.body.removeEventListener('click', handler);
}

function handleClientSave(){
  // Lê os dados do formulário
  const f = readClientForm();
  if(!f.nome?.trim()) return toast('Informe o Nome');

  // Garante que novas compras venham como array (ou vazio)
  const incoming = Array.isArray(f.compras)
    ? f.compras
    : (f.compras ? [f.compras] : []);

  let list = getClients(); // persiste via localStorage (ajuste se usar outro backend)
  let finalId = f.id;

  if (f.id) {
    // UPDATE: mescla com o cliente existente
    const existing = list.find(c => c.id === f.id) || {};
    const mergedPurchases = [...(existing.compras || [])];

    // Anexa somente as compras novas (por id, se houver)
    incoming.forEach(p => {
      if (!p) return;
      const pid = p.id || null;
      const already = pid
        ? mergedPurchases.some(x => x && x.id === pid)
        : false;
      if (!already) mergedPurchases.push(p);
    });

    const updated = { ...existing, ...f, compras: mergedPurchases };
    const idx = list.findIndex(c => c.id === f.id);
    if (idx > -1) list[idx] = updated; else list.push(updated);
  } else {
    // CREATE: gera id e guarda as compras que vieram
    finalId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    list.push({ ...f, id: finalId, compras: incoming });
  }

  setClients(list);

  // Agenda follow-ups somente para as compras recém-adicionadas
  incoming.forEach(p => scheduleFollowUpsForPurchase({ ...f, id: finalId }, p));

  if (typeof clientModalOnSave === 'function') clientModalOnSave(finalId);

  closeClientModal();
}

function handlePurchaseSave(){
  const {clienteId, compra} = readPurchaseForm();
  if(clienteId == null) { toast('Cliente inválido'); return; }
  const list = getClients();
  const idx = list.findIndex(c=>c.id===clienteId);
  if(idx<0) return toast('Cliente não encontrado');
  list[idx].compras = list[idx].compras || [];
  if(!compra.id) compra.id = `cmp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const pIdx = list[idx].compras.findIndex(x=>x.id===compra.id);
  if(pIdx>=0) list[idx].compras[pIdx]=compra; else list[idx].compras.push(compra);
    setClients(list);
    scheduleFollowUpsForPurchase(list[idx], compra);
    if(typeof purchaseModalOnSave === 'function') purchaseModalOnSave();
    closePurchaseModal();
  }

// ===== Ordem de Serviço =====
const OS_SIGLAS = { 'Jorel Chicuta':'JC', 'Jorel Avenida':'AV', 'Exótica':'EX', 'Usuario Teste':'UT', 'Administrador':'AD' };
const OS_STATUS_LABELS = { loja:'Em loja', oficina:'Oficina/Laboratório', aguardando:'Aguardando Retirada', completo:'Completo' };
const KANBAN_STATUSES = ['loja','oficina','aguardando'];
const OS_TIPO_LABELS = { reloj:'Relojoaria', joia:'Joalheria', optica:'Óptica' };
const ICON_PRINTER = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>`;
const ICON_EDIT = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>`;
const ICON_TRASH = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4h6v2"></path></svg>`;
const ICON_SEARCH = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
const ICON_EXPAND = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
const OS_PAGE_SIZE=12;

function OSMenuBar(){
  return `<div class="os-menu-bar balloon">`+
    `<button id=\"btnNovaOS\" class=\"btn btn-primary\">Nova O.S</button>`+
    `<div class=\"os-search\"><input id=\"osSearch\" type=\"search\" placeholder=\"Buscar...\" aria-label=\"Buscar O.S\"><span class=\"icon\">${ICON_SEARCH}</span></div>`+
    `<div class=\"os-right\">`+
      `<div class=\"os-type-filter\" id=\"osTypeButtons\">`+
        `<button class=\"filter-btn active\" data-type=\"all\">Todos</button>`+
        `<button class=\"filter-btn\" data-type=\"reloj\">Relojoaria</button>`+
        `<button class=\"filter-btn\" data-type=\"joia\">Joalheria</button>`+
        `<button class=\"filter-btn\" data-type=\"optica\">Óptica</button>`+
      `</div>`+
      `<div class=\"mini-card\"></div>`+
      `<div class=\"mini-card\"></div>`+
    `</div>`+
  `</div>`;
}

function OSKanbanHolder(){
  const cols=KANBAN_STATUSES.map(k=>{
    const label=OS_STATUS_LABELS[k];
    const cls={loja:'col-kanban--loja',oficina:'col-kanban--oficina',aguardando:'col-kanban--aguardo'}[k];
    return `<div class=\"kanban-col ${cls}\" data-status=\"${k}\"><div class=\"kanban-header\"><h3>${label}</h3><span class=\"count\">0</span></div><div class=\"cards\"></div><div class=\"kanban-footer\"><button class=\"kanban-prev\" disabled>Anterior</button><span class=\"sep\">|</span><span class=\"page-info\">1 / 1</span><span class=\"sep\">|</span><button class=\"kanban-next\" disabled>Próxima</button></div></div>`;
  }).join('');
  return `<div class=\"os-kanban-holder balloon\"><div class=\"os-kanban\" id=\"osKanban\">${cols}</div></div>`;
}

function OSCompletedTable(){
  return `<div class="os-completed balloon" id="osCompleted">`+
    `<div class="os-completed-controls">`+
      `<div class="os-type-filter" id="osCompletedTypeButtons">`+
        `<button class="filter-btn active" data-type="">Todos</button>`+
        `<button class="filter-btn" data-type="reloj">Relojoaria</button>`+
        `<button class="filter-btn" data-type="joia">Joalheria</button>`+
        `<button class="filter-btn" data-type="optica">Óptica</button>`+
      `</div>`+
    `</div>`+
    `<table><thead><tr><th>Código</th><th>Tipo</th><th>Cliente</th><th>Telefone</th><th>Datas</th><th>Ações</th></tr></thead><tbody></tbody></table>`+
    `<div class="os-completed-pagination"><button class="completed-prev" disabled>Anterior</button><span class="page-info">1 / 1</span><button class="completed-next" disabled>Próxima</button></div>`+
  `</div>`;
}

const OS_COMPLETED_PAGE_SIZE=10;

function renderOSCompleted(){
  const wrap=document.getElementById('osCompleted');
  if(!wrap) return;
  const tbody=wrap.querySelector('tbody');
  if(!tbody) return;
  const f=ui.os.completed;
  let list=loadOSList().filter(o=>o.status==='completo');
  if(f.type) list=list.filter(o=>o.tipo===f.type);
  const total=list.length;
  const perPage=OS_COMPLETED_PAGE_SIZE;
  const totalPages=Math.max(1,Math.ceil(total/perPage));
  const page=Math.min(f.page,totalPages);
  f.page=page;
  const slice=list.slice((page-1)*perPage, page*perPage);
  const formatDetail=campos=>{
    return Object.entries(campos).map(([k,v])=>{
      if(v&&typeof v==='object'){
        return `<div><strong>${k}:</strong> ${Object.entries(v).map(([k2,v2])=>`${k2}: ${v2}`).join(', ')}</div>`;
      }
      return `<div><strong>${k}:</strong> ${v}</div>`;
    }).join('');
  };
  tbody.innerHTML=slice.map(os=>{
    const tipoAbbr={reloj:'R',joia:'J',optica:'O'}[os.tipo]||'';
    const nome=os.campos.nome||os.campos.cliente||'';
    const tel=os.campos.telefone||'';
    const dComp=os.completedAt;
    const datas=dComp?`Finalizada: ${formatDateDDMMYYYY(dComp)}`:'';
    const info=`Código: ${os.codigo} - Telefone: ${tel}`;
    const row=`<tr data-id="${os.id}"><td>${os.codigo}</td><td>${tipoAbbr}</td><td class="os-complete-client" data-info="${info}">${nome}</td><td>${tel}</td><td>${datas}</td>`+
      `<td class="actions"><button class="os-action btn-os-expand" data-id="${os.id}" title="Expandir" aria-label="Expandir">${ICON_EXPAND}</button>`+
      `<button class="os-action btn-os-imprimir" data-id="${os.id}" title="Imprimir" aria-label="Imprimir">${ICON_PRINTER}</button></td></tr>`;
    const detail=`<tr class="os-details" data-id="${os.id}"><td colspan="6"><div class="os-detail-grid">${formatDetail(os.campos)}</div></td></tr>`;
    return row+detail;
  }).join('');
  const info=wrap.querySelector('.page-info');
  const prevBtn=wrap.querySelector('.completed-prev');
  const nextBtn=wrap.querySelector('.completed-next');
  if(info) info.textContent=`${page} / ${totalPages}`;
  if(prevBtn) prevBtn.disabled=page<=1;
  if(nextBtn) nextBtn.disabled=page>=totalPages;
}
function osListKey(profile=currentProfile()){ return `os:${profile}`; }
function osSeqKey(profile=currentProfile(), tipo='reloj'){ return `os:${profile}:seq:${tipo}`; }
function loadOSList(profile=currentProfile()){ return getJSON(osListKey(profile), []); }
function saveOSList(list, profile=currentProfile()){ setJSON(osListKey(profile), list); }
function reserveOSCode(profile=currentProfile(), tipo='reloj'){
  const k=osSeqKey(profile, tipo);
  const seq=parseInt(localStorage.getItem(k)||'0',10)+1;
  localStorage.setItem(k, seq);
  const sig=OS_SIGLAS[profile]||'UT';
  const prefix={ reloj:'RE', optica:'OT', joia:'JO' }[tipo]||'RE';
  return { code:`${prefix}${String(seq).padStart(4,'0')}${sig}`, seq };
}
function releaseOSCode(seq, profile=currentProfile(), tipo='reloj'){
  const k=osSeqKey(profile, tipo);
  const cur=parseInt(localStorage.getItem(k)||'0',10);
  if(cur===seq) localStorage.setItem(k, cur-1);
}
function nextOSCode(profile=currentProfile(), tipo='reloj'){
  return reserveOSCode(profile, tipo).code;
}
function upsertOS(os, profile=currentProfile()){
  const list=loadOSList(profile);
  const idx=list.findIndex(o=>o.id===os.id);
  if(idx>=0) list[idx]=os; else list.push(os);
  saveOSList(list, profile);
}
function deleteOS(id, profile=currentProfile()){
  const list=loadOSList(profile).filter(o=>o.id!==id);
  saveOSList(list, profile);
}
function osEventDate(os){
  const str=os.tipo==='optica'?os.campos.previsaoEntrega:os.campos.dataOficina;
  if(!str) return null;
  const d=parseDDMMYYYY(str);
  if(isNaN(d)) return null;
  return d.toISOString().slice(0,10);
}
function ensureOSEvent(os){
  const cal=getCalendar();
  const idx=cal.findIndex(e=>e.meta?.kind==='os' && e.meta.osId===os.id);
  const dateISO=osEventDate(os);
  if(!dateISO){
    if(idx>=0){ cal.splice(idx,1); setCalendar(cal); }
    if(typeof renderCalendarMonth==='function') renderCalendarMonth();
    return;
  }
  if(idx>=0){
    cal[idx].dataISO=dateISO;
    cal[idx].title=os.codigo;
    cal[idx].meta.done=os.status==='aguardando';
  } else {
    cal.push({id:uuid(),dataISO:dateISO,title:os.codigo,color:'os',meta:{kind:'os',osId:os.id,done:os.status==='aguardando'}});
  }
  setCalendar(cal);
  if(typeof renderCalendarMonth==='function') renderCalendarMonth();
}
function updateOSEventStatus(os){
  const cal=getCalendar();
  const ev=cal.find(e=>e.meta?.kind==='os' && e.meta.osId===os.id);
  if(ev){
    ev.meta.done=os.status==='aguardando';
    setCalendar(cal);
    if(typeof renderCalendarMonth==='function') renderCalendarMonth();
  }
}
function removeOSEvent(osId){
  const cal=getCalendar();
  const filtered=cal.filter(e=>!(e.meta?.kind==='os' && e.meta.osId===osId));
  if(filtered.length!==cal.length){
    setCalendar(filtered);
    if(typeof renderCalendarMonth==='function') renderCalendarMonth();
  }
}
function renderOSKanban(){
  const board=document.getElementById('osKanban');
  if(!board) return;
  const empty=document.getElementById('osEmpty');
  const colEls={};
  KANBAN_STATUSES.forEach(k=>{
    const col=board.querySelector(`[data-status="${k}"]`);
    if(col){
      colEls[k]=col;
      const cards=col.querySelector('.cards');
      if(cards) cards.innerHTML='';
    }
  });
  const f=ui.os.filters;
  const list=loadOSList();
  const grouped={loja:[],oficina:[],aguardando:[],completo:[]};
  list.forEach(os=>{
    const tipo=os.tipo||'reloj';
    if(!f.types.includes(tipo)) return;
    if(f.text){
      const t=f.text;
      const nome=(os.campos.nome||os.campos.cliente||'').toLowerCase();
      const marca=(os.campos.marca||'').toLowerCase();
      const hay=(os.codigo?.toLowerCase().includes(t)||nome.includes(t)||marca.includes(t));
      if(!hay) return;
    }
    const st=os.status||'loja';
    grouped[st].push(os);
  });
  const perPage=OS_PAGE_SIZE;
  const counts={loja:0,oficina:0,aguardando:0,completo:0};
  KANBAN_STATUSES.forEach(st=>{
    const arr=grouped[st];
    arr.sort((a,b)=>{
      if(a.pinnedAt && b.pinnedAt) return b.pinnedAt - a.pinnedAt;
      if(a.pinnedAt) return -1;
      if(b.pinnedAt) return 1;
      let da, db;
      if(st==='loja'){
        da=parseDDMMYYYY(a.campos.dataAtual||a.campos.dataHoje).getTime();
        db=parseDDMMYYYY(b.campos.dataAtual||b.campos.dataHoje).getTime();
      } else {
        const fa=a.tipo==='optica'?a.campos.previsaoEntrega:a.campos.dataOficina;
        const fb=b.tipo==='optica'?b.campos.previsaoEntrega:b.campos.dataOficina;
        da=parseDDMMYYYY(fa).getTime();
        db=parseDDMMYYYY(fb).getTime();
      }
      if(isNaN(da)) da=Infinity;
      if(isNaN(db)) db=Infinity;
      return da-db;
    });
    counts[st]=arr.length;
    const col=colEls[st];
    if(!col) return;
    const page=ui.os.pages[st]||1;
    const totalPages=Math.max(1,Math.ceil(arr.length/perPage));
    const curPage=page>totalPages?1:page;
    ui.os.pages[st]=curPage;
    const slice=arr.slice((curPage-1)*perPage, curPage*perPage);
    const container=col.querySelector('.cards');
    slice.forEach(os=>{
      const card=document.createElement('div');
      const tipo=os.tipo||'reloj';
      card.className=`os-card ${tipo}`;
      if(!os.expanded) card.classList.add('collapsed');
      card.draggable=true;
      card.dataset.id=os.id;
      card.tabIndex=0;
      const dates=[];
      const oficinaDate=os.campos.dataOficina;
      const prevDate=os.campos.previsaoEntrega||os.campos.dataEntrega;
      if(tipo!=='optica' && oficinaDate) {
        dates.push(`<div>Data de Oficina: ${formatDateDDMMYYYY(oficinaDate)}</div>`);
      }
      if(prevDate) {
        dates.push(`<div class="previsao">Previsão de Entrega: ${formatDateDDMMYYYY(prevDate)}</div>`);
      }
      const nome=os.campos.nome||os.campos.cliente;
      const tel=os.campos.telefone||'';
      const pinCls=os.status==='aguardando'
        ? 'pin-green'
        : (os.pinnedAt ? 'pin-orange' : 'pin-blue');
      const emLoja=os.status==='oficina' ? `<label class="os-em-loja-label">Em loja <input type="checkbox" class="switch os-em-loja" data-id="${os.id}"></label>` : '';
      card.innerHTML=`<div class="os-card-top"><div class="os-card-title"><div class="os-code">${os.codigo}</div><div class="os-name">${nome}</div></div>`+
        `<div class="os-card-actions">`+
        `<button class="os-action btn-os-imprimir" title="Imprimir" aria-label="Imprimir" data-id="${os.id}">${ICON_PRINTER}</button>`+
        `<button class="os-action btn-os-editar" title="Editar" aria-label="Editar" data-id="${os.id}">${ICON_EDIT}</button>`+
        `<button class="os-action btn-os-excluir" title="Excluir" aria-label="Excluir" data-id="${os.id}">${ICON_TRASH}</button>`+
        `<div class="pin-group"><button class="os-action btn-os-pin ${pinCls}" title="Pin" aria-label="Pin" data-id="${os.id}"></button><button class="os-action btn-os-toggle" title="${os.expanded?'Minimizar':'Expandir'}" aria-label="${os.expanded?'Minimizar':'Expandir'}" data-id="${os.id}">${os.expanded?'-':'+'}</button></div>`+
        `</div></div>`+
        `<div class="os-card-body">`+
        `<div class="os-card-phone">${tel}</div>`+
        `${tipo==='optica' ? `<div>Armação: ${os.campos.armacao||''}</div><div>Lente: ${os.campos.lente||''}</div>` : `<div>Marca: ${os.campos.marca||''}</div>${os.campos.marcasUso?'<div class=\"badge\">Marcas de uso</div>':''}`}`+
        `${dates.length?`<div class="os-card-dates">${dates.join('')}</div>`:''}`+
        `${emLoja}`+
        `</div>`;
      container.appendChild(card);
    });
    const cnt=col.querySelector('.count');
    if(cnt) cnt.textContent=`${counts[st]}`;
    const footer=col.querySelector('.kanban-footer');
    if(footer){
      const info=footer.querySelector('.page-info');
      const prev=footer.querySelector('.kanban-prev');
      const next=footer.querySelector('.kanban-next');
      if(info) info.textContent=`${curPage} / ${totalPages}`;
      if(prev) prev.disabled=curPage<=1;
      if(next) next.disabled=curPage>=totalPages;
    }
  });
  ui.os.counts=counts;
  const total=KANBAN_STATUSES.reduce((a,st)=>a+counts[st],0);
  if(empty){ empty.hidden=total>0; }
  board.hidden=total===0;
}

function printOSOptica(os){
  const campos=os.campos;
  const dataAtual=campos.dataAtual||campos.dataHoje||formatDateDDMMYYYY(new Date());
  const tipo='optica';
  const perfilInfo=getProfileInfo();
  const garantiaTexto=getGarantiaTexto(tipo);
  function via(titulo,opts,watermark){
    const showContacts=opts.showContacts!==false;
    const logo=perfilInfo.logo?
      `<img src="${perfilInfo.logo}" alt="Logo" class="logo-img">`:
      `<div class="logo-placeholder">Logo</div>`;
    const contato=showContacts?
      `<div class="os-print-contact">${perfilInfo.telefone?`<div>${perfilInfo.telefone}</div>`:''}${perfilInfo.endereco?`<div>${perfilInfo.endereco}</div>`:''}${perfilInfo.instagram?`<div><a href="https://instagram.com/${perfilInfo.instagram.replace(/^@/,'')}" target="_blank">${perfilInfo.instagram}</a></div>`:''}</div>`:'';
    const g=campos.grau||{};
    const identificacao=`<div class="os-block os-identificacao"><div><strong>Cliente:</strong> ${campos.nome||''}</div><div><strong>Nº OS:</strong> ${os.codigo}</div></div>`;
    const contatoCliente=`<div class="os-block grid2 contato"><div><strong>Telefone:</strong> ${campos.telefone||''}</div>${campos.cpf?`<div><strong>CPF:</strong> ${campos.cpf}</div>`:''}</div>`;
    const valores=campos.valores||{};
    const va=valores.armacao||0;
    const vl=valores.lente||0;
    const vt=valores.total||va+vl;
    let opticaFields='';
    if(campos.armacao){
      opticaFields+=`<div><strong>Armação:</strong> ${campos.armacao}</div>`;
      opticaFields+=opts.valor?`<div><strong>Valor Armação:</strong> ${formatCurrency(va)}</div>`:'<div></div>';
    }
    if(campos.lente){
      opticaFields+=`<div><strong>Lente:</strong> ${campos.lente}</div>`;
      opticaFields+=opts.valor?`<div><strong>Valor Lente:</strong> ${formatCurrency(vl)}</div>`:'<div></div>';
    }
    if(opts.valor){
      opticaFields+=`<div class="total"><strong>Total:</strong> <strong>${formatCurrency(vt)}</strong></div>`;
    }
    const opticaBlock=`<div class="os-block grid2 optica">${opticaFields}</div>`;
    const grauBlock=`<table class="grau-table"><thead><tr><th></th><th>ESF</th><th>CIL</th><th>EIXO</th><th>DNP</th><th>ADIÇÃO</th></tr></thead><tbody><tr><th>OE</th><td>${g.OE?.esf||''}</td><td>${g.OE?.cil||''}</td><td>${g.OE?.eixo||''}</td><td>${g.OE?.dnp||''}</td><td>${g.OE?.adicao||''}</td></tr><tr><th>OD</th><td>${g.OD?.esf||''}</td><td>${g.OD?.cil||''}</td><td>${g.OD?.eixo||''}</td><td>${g.OD?.dnp||''}</td><td>${g.OD?.adicao||''}</td></tr></tbody></table>`;
    const observacao=campos.observacao?`<div class="os-block"><strong>Observação:</strong> ${campos.observacao}</div>`:'';
    const datasLine=`<div class="os-block datas-line"><div><strong>Data Atual:</strong> ${formatDateDDMMYYYY(dataAtual)}</div>${opts.previsaoEntrega && campos.previsaoEntrega?`<div><strong>Previsão de Entrega:</strong> ${formatDateDDMMYYYY(campos.previsaoEntrega)}</div>`:''}</div>`;
    const garantia=opts.garantia&&garantiaTexto?`<div class="os-block garantia"><div class="os-garantia">${garantiaTexto}</div></div>`:'';
    const header=`<div class="os-print-header">${logo}${contato}</div><h2 class="os-print-title">${titulo.toUpperCase()}</h2><hr>`;
    const assinatura=opts.assinatura?'<div class="assinatura"></div>':'';
    const body=`<div class="os-print-body">${identificacao}${contatoCliente}${opticaBlock}${grauBlock}${observacao}${datasLine}${garantia}${assinatura}</div>`;
    return `<section class="os-print-via"><div class="os-print-watermark">${watermark}</div>${header}${body}</section>`;
  }
  const content=
    `<div class="os-print-container">`+
    via('Via do Cliente',{previsaoEntrega:true,garantia:true,valor:true,showContacts:true,assinatura:true},(campos.nome||'').toUpperCase())+
    `<hr>`+
    via('Via da Loja',{previsaoEntrega:true,garantia:true,valor:true,showContacts:false,assinatura:true},'LOJA')+
    `<hr>`+
    via('Via do Laboratório',{previsaoEntrega:true,garantia:false,valor:false,showContacts:true,assinatura:false},'SERVIÇO')+
    `</div>`;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${os.codigo}</title><style>
  @page{size:A4 portrait;margin:3mm;}
  html,body{height:100%;background:#fff;font-family:sans-serif;font-size:11pt;margin:0;}
  button{display:none;}
  .os-print-container{display:flex;flex-direction:column;height:100%;}
  hr{border:0;border-top:1px solid #000;margin:0;}
  .os-print-via{flex:1;background:#fff;border:1px solid #ccc;padding:2mm;display:flex;flex-direction:column;position:relative;overflow:hidden;}
  .os-print-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80pt;font-weight:bold;color:#000;opacity:0.05;pointer-events:none;white-space:nowrap;}
  .os-print-body{flex:1;display:flex;flex-direction:column;justify-content:space-between;}
  .os-print-header{display:flex;justify-content:space-between;align-items:flex-start;min-height:10mm;}
  .os-print-header .logo-img{max-height:10mm;object-fit:contain;}
  .os-print-header .logo-placeholder{width:30mm;height:10mm;background:#eee;display:flex;align-items:center;justify-content:center;color:#666;font-size:8pt;}
  .os-print-contact{text-align:right;font-size:7pt;}
  .os-print-title{text-align:center;font-weight:bold;font-size:15pt;margin-top:0;}
  .os-block{margin-top:1mm;font-size:10pt;}
  .os-block strong{font-size:10.5pt;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;column-gap:4mm;row-gap:1mm;}
  .os-identificacao{display:flex;justify-content:space-between;font-size:13pt;font-weight:bold;margin-top:1mm;}
  .os-identificacao div:last-child{text-align:right;}
  .datas-line{display:flex;justify-content:space-between;font-size:11pt;font-weight:bold;}
  .optica .total{grid-column:1/-1;margin-top:1mm;font-weight:bold;}
  .grau-table{width:100%;border-collapse:collapse;margin-top:1mm;}
  .grau-table th,.grau-table td{border:1px solid #000;padding:0.5mm;font-size:7pt;text-align:center;}
  .grau-table th:first-child{text-align:left;}
  .assinatura{border-bottom:1px solid #000;width:100mm;text-align:center;margin-left:auto;margin-top:8mm;height:25mm;position:relative;}
  .assinatura:after{content:"Assinatura";position:absolute;bottom:-4mm;left:0;right:0;font-size:10pt;}
  .os-garantia{margin-top:1mm;font-size:8pt;}
  </style></head><body>${content}</body></html>`);
  w.document.close();
  w.addEventListener('load',()=>w.print());
}


function printOS(os){
  const campos=os.campos;
  const dataAtual=campos.dataAtual||campos.dataHoje||formatDateDDMMYYYY(new Date());
  const tipo=os.tipo||'reloj';
  const tipoLabel=OS_TIPO_LABELS[tipo]||'';
  const perfilInfo=getProfileInfo();
  const garantiaTexto=getGarantiaTexto(tipo);
  if(tipo==='optica') { return printOSOptica(os); }
  function via(titulo,opts,watermark){
    const showContacts = opts.showContacts!==false;
    const logo = perfilInfo.logo ?
      `<img src="${perfilInfo.logo}" alt="Logo" class="logo-img">` :
      `<div class="logo-placeholder">Logo</div>`;
    const contato = showContacts ?
      `<div class="os-print-contact">${perfilInfo.telefone?`<div>${perfilInfo.telefone}</div>`:''}${perfilInfo.endereco?`<div>${perfilInfo.endereco}</div>`:''}${perfilInfo.instagram?`<div><a href="https://instagram.com/${perfilInfo.instagram.replace(/^@/,'')}" target="_blank">${perfilInfo.instagram}</a></div>`:''}</div>` : '';
    const oficinaDate=campos.dataOficina;
    const prevDate=campos.previsaoEntrega||campos.dataEntrega;
    const identificacao=`<div class="os-block os-identificacao"><div><strong>Cliente:</strong> ${campos.cliente}</div><div><strong>Nº OS:</strong> ${os.codigo}</div></div>`;
    const contatoCliente=`<div class="os-block grid2 contato"><div><strong>Telefone:</strong> ${campos.telefone}</div>${campos.cpf?`<div><strong>CPF:</strong> ${campos.cpf}</div>`:''}</div>`;
    const relogio=`<div class="os-block grid2 relogio">${campos.marca?`<div><strong>Marca:</strong> ${campos.marca}</div>`:''}${campos.pulseira?`<div><strong>Pulseira:</strong> ${campos.pulseira}</div>`:''}${campos.mostrador?`<div><strong>Mostrador:</strong> ${campos.mostrador}</div>`:''}</div>`;
    const servico=`<div class="os-block"><strong>Serviço:</strong> ${campos.servico}</div>`;
    const datasLine=`<div class="os-block datas-line"><div><strong>Data Atual:</strong> ${formatDateDDMMYYYY(dataAtual)}</div>${opts.previsaoEntrega && prevDate?`<div><strong>Previsão de Entrega:</strong> ${formatDateDDMMYYYY(prevDate)}</div>`:''}</div>`;
    const dataOficinaBlock=(opts.dataOficina && oficinaDate)?`<div class="os-block ${opts.oficina?'data-oficina-highlight':''}"><strong>Data da Oficina:</strong> ${formatDateDDMMYYYY(oficinaDate)}</div>`:'';
    const valorBlock=(opts.valor && campos.valor)?`<div class="os-block valor"><strong>Valor a Pagar:</strong> <strong>${formatCurrency(campos.valor)}</strong></div>`:'';
    const garantia=opts.garantia&&garantiaTexto?`<div class="os-block garantia"><div class="os-garantia">${garantiaTexto}</div></div>`:'';
    const header=`<div class="os-print-header">${logo}${contato}</div><h2 class="os-print-title">${titulo.toUpperCase()}</h2><hr>`;
    const assinatura=opts.assinatura?'<div class="assinatura"></div>':'';
    const body=`<div class="os-print-body">${identificacao}${contatoCliente}${relogio}${servico}${datasLine}${dataOficinaBlock}${valorBlock}${garantia}${assinatura}</div>`;
    return `<section class="os-print-via"><div class="os-print-watermark">${watermark}</div>${header}${body}</section>`;
  }
  const content=
    `<div class="os-print-container">`+
    via('Via do Cliente',{dataOficina:false,previsaoEntrega:true,garantia:true,showContacts:true,valor:true,assinatura:true},(campos.cliente||'').toUpperCase())+
    `<hr>`+
    via('Via da Loja',{dataOficina:true,previsaoEntrega:true,garantia:true,showContacts:false,valor:true,assinatura:true},'LOJA')+
    `<hr>`+
    via('Via da Oficina',{dataOficina:true,previsaoEntrega:false,garantia:false,showContacts:true,valor:false,assinatura:false,oficina:true},'SERVIÇO')+
    `</div>`;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${os.codigo}</title><style>
  @page{size:A4 portrait;margin:3mm;}
  html,body{height:100%;background:#fff;font-family:sans-serif;font-size:11pt;margin:0;}
  button{display:none;}
  .os-print-container{display:flex;flex-direction:column;height:100%;}
  hr{border:0;border-top:1px solid #000;margin:0;}
  .os-print-via{flex:1;background:#fff;border:1px solid #ccc;padding:2mm;display:flex;flex-direction:column;position:relative;overflow:hidden;}
  .os-print-watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:80pt;font-weight:bold;color:#000;opacity:0.05;pointer-events:none;white-space:nowrap;}
  .os-print-body{flex:1;display:flex;flex-direction:column;justify-content:space-between;}
  .os-print-header{display:flex;justify-content:space-between;align-items:flex-start;min-height:10mm;}
  .os-print-header .logo-img{max-height:10mm;object-fit:contain;}
  .os-print-header .logo-placeholder{width:30mm;height:10mm;background:#eee;display:flex;align-items:center;justify-content:center;color:#666;font-size:8pt;}
  .os-print-contact{text-align:right;font-size:7pt;}
  .os-print-title{text-align:center;font-weight:bold;font-size:15pt;margin-top:0;}
  .os-block{margin-top:1mm;font-size:10pt;}
  .os-block strong{font-size:10.5pt;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;column-gap:4mm;row-gap:1mm;}
  .os-identificacao{display:flex;justify-content:space-between;font-size:13pt;font-weight:bold;margin-top:1mm;}
  .os-identificacao div:last-child{text-align:right;}
  .datas-line{display:flex;justify-content:space-between;font-size:11pt;font-weight:bold;}
  .assinatura{border-bottom:1px solid #000;width:100mm;text-align:center;margin-left:auto;margin-top:8mm;height:25mm;position:relative;}
  .assinatura:after{content:"Assinatura";position:absolute;bottom:-4mm;left:0;right:0;font-size:10pt;}
  .os-garantia{margin-top:1mm;font-size:8pt;}
  .data-oficina-highlight{font-weight:bold;font-size:11pt;}
  </style></head><body>${content}</body></html>`);
  w.document.close();
  w.addEventListener('load',()=>w.print());
}


function setupOSDragAndDrop(){
  const board=document.getElementById('osKanban');
  if(!board) return;
  board.addEventListener('dragstart',e=>{
    const card=e.target.closest('.os-card');
    if(card) e.dataTransfer.setData('text/plain', card.dataset.id);
  });
  board.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover',e=>{ e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{
      e.preventDefault();
      col.classList.remove('drag-over');
      const id=e.dataTransfer.getData('text/plain');
      if(id){
        const list=loadOSList();
        const os=list.find(o=>o.id==id);
        if(os){
          os.status=col.dataset.status;
          os.pinnedAt=null;
          os.updatedAt=new Date().toISOString();
          saveOSList(list);
          updateOSEventStatus(os);
          renderOSKanban();
        }
      }
    });
  });
  let touchId=null;
  board.addEventListener('touchstart',e=>{
    const card=e.target.closest('.os-card');
    if(card) touchId=card.dataset.id;
  });
  board.addEventListener('touchend',e=>{
    if(!touchId) return;
    const t=e.changedTouches[0];
    const el=document.elementFromPoint(t.clientX,t.clientY);
    const col=el && el.closest('.kanban-col');
    if(col){
      const list=loadOSList();
      const os=list.find(o=>o.id==touchId);
      if(os){
        os.status=col.dataset.status;
        os.pinnedAt=null;
        os.updatedAt=new Date().toISOString();
        saveOSList(list);
        updateOSEventStatus(os);
        renderOSKanban();
      }
    }
    touchId=null;
  });
}
function openOSTypeModal(){
  const modal=document.getElementById('app-modal');
  const title=document.getElementById('modal-title');
  const body=modal.querySelector('.modal-body');
  const saveBtn=modal.querySelector('#modal-save');
  title.textContent='Nova OS';
  saveBtn.hidden=true;
  body.innerHTML=`<div class="os-type-choices"><button class="os-type os-type-reloj" data-type="reloj">Relojoaria</button><button class="os-type os-type-joia" data-type="joia">Joalheria</button><button class="os-type os-type-optica" data-type="optica">Óptica</button></div>`;
  body.querySelector('[data-type="reloj"]').addEventListener('click',()=>{ modal.close(); openOSForm('reloj'); });
  body.querySelector('[data-type="joia"]').addEventListener('click',()=>{ modal.close(); openComingSoon('Joalheria'); });
  body.querySelector('[data-type="optica"]').addEventListener('click',()=>{ modal.close(); openOSForm('optica'); });
  modal.open();
}
function openComingSoon(label){
  const modal=document.getElementById('app-modal');
  const title=document.getElementById('modal-title');
  const body=modal.querySelector('.modal-body');
  const saveBtn=modal.querySelector('#modal-save');
  title.textContent=label;
  saveBtn.hidden=true;
  body.innerHTML='<p>Em breve</p>';
  modal.open();
}
function openOSForm(tipo, os){
  const modal=document.getElementById('app-modal');
  const title=document.getElementById('modal-title');
  const body=modal.querySelector('.modal-body');
  const saveBtn=modal.querySelector('#modal-save');
  const campos=os?.campos||{};
  const dataAtual=campos.dataAtual||campos.dataHoje||formatDateDDMMYYYY(new Date());
  let reserved=null; let saved=false; let codigo=os?.codigo;
  if(!os){ reserved=reserveOSCode(currentProfile(), tipo); codigo=reserved.code; }
  const tipoLabel=OS_TIPO_LABELS[tipo]||'';
  title.textContent=os?`Editar OS ${codigo}`:`Nova OS ${tipoLabel}`;
  saveBtn.hidden=false;
  if(tipo==='optica'){
    body.innerHTML=`<form id="osForm"><div class="form-grid">
      <div class="os-code col-span-12">${codigo}</div>
      <label class="col-span-6">Nome*<input class="text-input" name="nome" value="${campos.nome||''}" required></label>
      <label class="col-span-6">CPF<input class="text-input" name="cpf" value="${campos.cpf||''}" placeholder="000.000.000-00"></label>
      <label class="col-span-6">Telefone*<input class="text-input" name="telefone" value="${campos.telefone||''}" required></label>
      <label class="col-span-6">Data atual<input class="text-input" name="dataAtual" value="${dataAtual}" readonly></label>
      <label class="col-span-6">Armação<input class="text-input" name="armacao" value="${campos.armacao||''}"></label>
      <label class="col-span-6">Lente<input class="text-input" name="lente" value="${campos.lente||''}"></label>
      <div class="col-span-12">
        <table class="grau-table">
          <thead><tr><th></th><th>ESF</th><th>CIL</th><th>EIXO</th><th>DNP</th><th>ADIÇÃO</th></tr></thead>
          <tbody>
            <tr><th>OE</th>
              <td><input class="text-input" name="oe_esf" value="${campos.grau?.OE?.esf||''}"></td>
              <td><input class="text-input" name="oe_cil" value="${campos.grau?.OE?.cil||''}"></td>
              <td><input class="text-input" name="oe_eixo" value="${campos.grau?.OE?.eixo||''}"></td>
              <td><input class="text-input" name="oe_dnp" value="${campos.grau?.OE?.dnp||''}"></td>
              <td><input class="text-input" name="oe_adicao" value="${campos.grau?.OE?.adicao||''}"></td>
            </tr>
            <tr><th>OD</th>
              <td><input class="text-input" name="od_esf" value="${campos.grau?.OD?.esf||''}"></td>
              <td><input class="text-input" name="od_cil" value="${campos.grau?.OD?.cil||''}"></td>
              <td><input class="text-input" name="od_eixo" value="${campos.grau?.OD?.eixo||''}"></td>
              <td><input class="text-input" name="od_dnp" value="${campos.grau?.OD?.dnp||''}"></td>
              <td><input class="text-input" name="od_adicao" value="${campos.grau?.OD?.adicao||''}"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <label class="col-span-12">Observação<textarea class="textarea" name="observacao" rows="3">${campos.observacao||''}</textarea></label>
      <label class="col-span-6">Previsão de Entrega<input type="date" class="date-input" name="previsaoEntrega" value="${campos.previsaoEntrega?formatDateYYYYMMDD(campos.previsaoEntrega):''}"></label>
      <label class="col-span-6">Valor Armação (R$)<input class="text-input" name="valorArmacao" value="${campos.valores?formatCurrency(campos.valores.armacao):''}" placeholder="0,00" inputmode="decimal"></label>
      <label class="col-span-6">Valor Lente (R$)<input class="text-input" name="valorLente" value="${campos.valores?formatCurrency(campos.valores.lente):''}" placeholder="0,00" inputmode="decimal"></label>
      <label class="col-span-6">Valor Total (R$)<input class="text-input" name="valorTotal" value="${campos.valores?formatCurrency(campos.valores.total):''}" readonly></label>
      <div class="os-error col-span-12" style="color:var(--red-600);"></div>
    </div></form>`;
  } else {
    body.innerHTML=`<form id="osForm"><div class="form-grid"><div class="os-code col-span-12">${codigo}</div><label class="col-span-6">Cliente*<input class="text-input" name="cliente" value="${campos.cliente||''}" required></label><label class="col-span-6">CPF<input class="text-input" name="cpf" value="${campos.cpf||''}" placeholder="000.000.000-00"></label><label class="col-span-6">Telefone*<input class="text-input" name="telefone" value="${campos.telefone||''}" required></label><label class="col-span-6">Data atual<input class="text-input" name="dataAtual" value="${dataAtual}" readonly></label><label class="col-span-6">Marca<input class="text-input" name="marca" value="${campos.marca||''}"></label><label class="col-span-6">Pulseira<input class="text-input" name="pulseira" value="${campos.pulseira||''}"></label><label class="col-span-6">Mostrador<input class="text-input" name="mostrador" value="${campos.mostrador||''}"></label><label class="col-span-6">Marcas de uso<input type="checkbox" class="switch" name="marcasUso" ${campos.marcasUso?'checked':''}></label><label class="col-span-12">Serviço*<textarea class="textarea" name="servico" rows="2" required>${campos.servico||''}</textarea></label><label class="col-span-12">Observação<textarea class="textarea" name="observacao" rows="3">${campos.observacao||''}</textarea></label><label class="col-span-12">Valor a Pagar (R$)<input class="text-input" name="valor" value="${campos.valor?formatCurrency(campos.valor):''}" placeholder="0,00" inputmode="decimal"></label><label class="col-span-6">Data de Oficina<input type="date" class="date-input" name="dataOficina" value="${campos.dataOficina?formatDateYYYYMMDD(campos.dataOficina):''}"></label><label class="col-span-6">Previsão de Entrega<input type="date" class="date-input" name="previsaoEntrega" value="${(campos.previsaoEntrega||campos.dataEntrega)?formatDateYYYYMMDD(campos.previsaoEntrega||campos.dataEntrega):''}"></label><label class="col-span-12">Nota para Oficina<textarea class="textarea" name="notaOficina" rows="2">${campos.notaOficina||''}</textarea></label><label class="col-span-12">Nota para Loja<textarea class="textarea" name="notaLoja" rows="2">${campos.notaLoja||''}</textarea></label><div class="os-error col-span-12" style="color:var(--red-600);"></div></div></form>`;
  }
  const form=body.querySelector('#osForm');
  if(tipo==='optica'){
    function maskCurrency(inp){
      let digits=inp.value.replace(/\D/g,'');
      inp.value=(Number(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    }
    const updateTotal=()=>{
      const va=parseCurrency(form.valorArmacao.value||'0');
      const vl=parseCurrency(form.valorLente.value||'0');
      form.valorTotal.value=(va+vl).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    };
    if(form.valorArmacao) form.valorArmacao.addEventListener('input',()=>{ maskCurrency(form.valorArmacao); updateTotal(); });
    if(form.valorLente) form.valorLente.addEventListener('input',()=>{ maskCurrency(form.valorLente); updateTotal(); });
    updateTotal();
  } else if(form.valor){
    form.valor.addEventListener('input',()=>{
      let digits=form.valor.value.replace(/\D/g,'');
      form.valor.value=(Number(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    });
  }
  const cpfInput=form.querySelector('input[name="cpf"]');
  if(cpfInput){
    const nomeInput=form.querySelector('input[name="nome"],input[name="cliente"]');
    const telInput=form.querySelector('input[name="telefone"]');
    const fillByCpf=(digits)=>{
      const cliente=getClients().find(c=>normalizeDigits(c.cpf)===digits);
      if(cliente){
        if(nomeInput){ nomeInput.value=cliente.nome; nomeInput.readOnly=true; nomeInput.classList.add('readonly-green'); }
        if(telInput){ telInput.value=formatTelefone(cliente.telefone); telInput.readOnly=true; telInput.classList.add('readonly-green'); }
      } else {
        if(nomeInput){ nomeInput.readOnly=false; nomeInput.classList.remove('readonly-green'); }
        if(telInput){ telInput.readOnly=false; telInput.classList.remove('readonly-green'); }
      }
    };
    cpfInput.addEventListener('input',()=>{
      let digits=cpfInput.value.replace(/\D/g,'').slice(0,11);
      if(digits.length>0){
        cpfInput.value=digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      } else {
        cpfInput.value='';
      }
      if(digits.length===11) fillByCpf(digits); else fillByCpf('');
    });
  }
  form.addEventListener('keydown',e=>{ if(e.key==='Enter' && e.target.tagName!=='TEXTAREA'){ e.preventDefault(); saveBtn.click(); }});
  saveBtn.onclick=e=>{
    e.preventDefault();
    const fd=new FormData(form);
    const err=form.querySelector('.os-error');
    err.textContent='';
    let data={};
    if(tipo==='optica'){
      data.nome=fd.get('nome')||'';
      data.telefone=fd.get('telefone')||'';
      data.cpf=fd.get('cpf')||'';
      data.armacao=fd.get('armacao')||'';
      data.lente=fd.get('lente')||'';
      data.grau={ OE:{esf:fd.get('oe_esf')||'', cil:fd.get('oe_cil')||'', eixo:fd.get('oe_eixo')||'', dnp:fd.get('oe_dnp')||'', adicao:fd.get('oe_adicao')||''}, OD:{esf:fd.get('od_esf')||'', cil:fd.get('od_cil')||'', eixo:fd.get('od_eixo')||'', dnp:fd.get('od_dnp')||'', adicao:fd.get('od_adicao')||''} };
      data.observacao=fd.get('observacao')||'';
      data.previsaoEntrega=formatDateDDMMYYYY(fd.get('previsaoEntrega'));
      data.dataAtual=formatDateDDMMYYYY(fd.get('dataAtual'));
      const va=parseCurrency(fd.get('valorArmacao')||'');
      const vl=parseCurrency(fd.get('valorLente')||'');
      data.valores={armacao:va,lente:vl,total:va+vl};
      if(!data.nome.trim()||!data.telefone.trim()){
        err.textContent='Preencha os campos obrigatórios.';
        return;
      }
    } else {
      data=Object.fromEntries(fd.entries());
      data.marcasUso=fd.get('marcasUso')==='on';
      data.valor=parseCurrency(data.valor);
      ['dataAtual','dataOficina','previsaoEntrega'].forEach(k=>{ data[k]=formatDateDDMMYYYY(data[k]); });
      if(!data.cliente.trim()||!data.telefone.trim()||!data.servico.trim()){
        err.textContent='Preencha os campos obrigatórios.';
        return;
      }
    }
    const now=new Date().toISOString();
    if(os){
      os.campos=data;
      os.tipo=tipo;
      os.updatedAt=now;
      upsertOS(os);
      ensureOSEvent(os);
    } else {
      const novo={id:Date.now(),codigo,tipo,perfil:currentProfile(),status:'loja',campos:data,createdAt:now,updatedAt:now};
      const list=loadOSList();
      list.push(novo);
      saveOSList(list);
      ensureOSEvent(novo);
    }
    saved=true;
    modal.close();
    renderOSKanban();
    renderOSCompleted();
  };
  const originalClose=modal.close;
  modal.close=()=>{ if(!saved && reserved) releaseOSCode(reserved.seq, currentProfile(), tipo); modal.close=originalClose; originalClose(); };
  modal.open();
}
function initOSPage(){
  if(currentProfile()==='Administrador'){
    document.querySelectorAll('.garantia-block button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const type=btn.dataset.save;
        const ta=document.getElementById(`garantia-${type}`);
        const notas=loadGarantias();
        notas[type]=ta.value;
        saveGarantias(notas);
        toast('Salvo');
      });
    });
    return;
  }
  const btn=document.getElementById('btnNovaOS');
  const btnEmpty=document.getElementById('btnNovaOSEmpty');
  if(btn) btn.addEventListener('click',openOSTypeModal);
  if(btnEmpty) btnEmpty.addEventListener('click',openOSTypeModal);
  const f=ui.os.filters;
  const search=document.getElementById('osSearch');
  const typeBtns=document.getElementById('osTypeButtons');
  const resetPages=()=>{ Object.keys(ui.os.pages).forEach(k=>ui.os.pages[k]=1); };
  if(search) search.addEventListener('input',e=>{ f.text=e.target.value.toLowerCase(); resetPages(); renderOSKanban(); });
  if(typeBtns) typeBtns.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-type]');
    if(!btn) return;
    typeBtns.querySelectorAll('button').forEach(b=>b.classList.toggle('active', b===btn));
    const t=btn.dataset.type;
    f.types=t==='all'?['reloj','joia','optica']:[t];
    resetPages();
    renderOSKanban();
  });
  const cTypeBtns=document.getElementById('osCompletedTypeButtons');
  const comp=document.getElementById('osCompleted');
  if(cTypeBtns) cTypeBtns.addEventListener('click',e=>{ const btn=e.target.closest('button[data-type]'); if(!btn) return; cTypeBtns.querySelectorAll('button').forEach(b=>b.classList.toggle('active', b===btn)); ui.os.completed.type=btn.dataset.type; ui.os.completed.page=1; renderOSCompleted(); });
  if(comp){
    comp.addEventListener('click',e=>{
      const btn=e.target.closest('button');
      if(!btn) return;
      const id=btn.dataset.id;
      if(btn.classList.contains('btn-os-expand')){
        const detail=comp.querySelector(`.os-details[data-id="${id}"]`);
        if(detail) detail.classList.toggle('show');
        return;
      }
      if(btn.classList.contains('btn-os-imprimir')){ const os=loadOSList().find(o=>o.id==id); if(os) printOS(os); }
      if(btn.classList.contains('completed-prev')){ if(ui.os.completed.page>1){ ui.os.completed.page--; renderOSCompleted(); } }
      if(btn.classList.contains('completed-next')){ const total=loadOSList().filter(o=>o.status==='completo').length; const max=Math.max(1,Math.ceil(total/OS_COMPLETED_PAGE_SIZE)); if(ui.os.completed.page<max){ ui.os.completed.page++; renderOSCompleted(); } }
    });
    const tooltip=document.createElement('div');
    tooltip.className='os-tooltip';
    tooltip.style.display='none';
    document.body.appendChild(tooltip);
    comp.addEventListener('mouseover',e=>{
      const cell=e.target.closest('.os-complete-client');
      if(!cell) return;
      tooltip.textContent=cell.dataset.info;
      tooltip.style.display='block';
      const rect=cell.getBoundingClientRect();
      tooltip.style.left=`${rect.left+window.scrollX}px`;
      tooltip.style.top=`${rect.bottom+window.scrollY+4}px`;
    });
    comp.addEventListener('mousemove',e=>{
      if(tooltip.style.display==='block'){
        tooltip.style.left=`${e.pageX+8}px`;
        tooltip.style.top=`${e.pageY+8}px`;
      }
    });
    comp.addEventListener('mouseout',e=>{
      if(e.target.closest('.os-complete-client')) tooltip.style.display='none';
    });
  }
  const board=document.getElementById('osKanban');
  if(board){
    board.addEventListener('click',e=>{
      const btn=e.target.closest('button');
      if(btn){
        const id=btn.dataset.id;
        if(btn.classList.contains('btn-os-imprimir')){ const os=loadOSList().find(o=>o.id==id); if(os) printOS(os); }
        if(btn.classList.contains('btn-os-editar')){ const os=loadOSList().find(o=>o.id==id); if(os) openOSForm(os.tipo, os); }
        if(btn.classList.contains('btn-os-excluir')){ if(confirm('Excluir OS?')){ deleteOS(Number(id)); removeOSEvent(Number(id)); renderOSKanban(); renderOSCompleted(); } }
        if(btn.classList.contains('btn-os-pin')){
          const list=loadOSList();
          const os=list.find(o=>o.id==id);
          if(os){
            if(os.status==='aguardando'){
              os.status='completo';
              os.pinnedAt=null;
              os.updatedAt=new Date().toISOString();
              os.completedAt=os.completedAt||new Date().toISOString();
              saveOSList(list);
              removeOSEvent(os.id);
              renderOSKanban();
              renderOSCompleted();
            } else if(os.status==='loja' || os.status==='oficina'){
              os.pinnedAt=os.pinnedAt?null:Date.now();
              os.updatedAt=new Date().toISOString();
              saveOSList(list);
              renderOSKanban();
            }
          }
        }
        if(btn.classList.contains('btn-os-toggle')){
          const list=loadOSList();
          const os=list.find(o=>o.id==id);
          if(os){
            os.expanded=!os.expanded;
            os.updatedAt=new Date().toISOString();
            saveOSList(list);
            const card=btn.closest('.os-card');
            card.classList.toggle('collapsed',!os.expanded);
            btn.textContent=os.expanded?'-':'+';
            btn.title=os.expanded?'Minimizar':'Expandir';
            btn.setAttribute('aria-label', os.expanded?'Minimizar':'Expandir');
          }
          return;
        }
        if(btn.classList.contains('kanban-prev')){ const st=btn.closest('.kanban-col').dataset.status; if(ui.os.pages[st]>1){ ui.os.pages[st]--; renderOSKanban(); } }
        if(btn.classList.contains('kanban-next')){ const st=btn.closest('.kanban-col').dataset.status; const total=ui.os.counts[st]||0; const max=Math.max(1,Math.ceil(total/OS_PAGE_SIZE)); if(ui.os.pages[st]<max){ ui.os.pages[st]++; renderOSKanban(); } }
        return;
      }
      const top=e.target.closest('.os-card-top');
      if(top){
        const card=top.closest('.os-card');
        const id=card.dataset.id;
        const list=loadOSList();
        const os=list.find(o=>o.id==id);
        if(os){
          os.expanded=!os.expanded;
          os.updatedAt=new Date().toISOString();
          saveOSList(list);
          card.classList.toggle('collapsed',!os.expanded);
          const tbtn=card.querySelector('.btn-os-toggle');
          if(tbtn){
            tbtn.textContent=os.expanded?'-':'+';
            tbtn.title=os.expanded?'Minimizar':'Expandir';
            tbtn.setAttribute('aria-label', os.expanded?'Minimizar':'Expandir');
          }
        }
      }
    });
    board.addEventListener('change',e=>{
      const sw=e.target.closest('.os-em-loja');
      if(sw){
        const id=sw.dataset.id;
        const list=loadOSList();
        const os=list.find(o=>o.id==id);
        if(os){
          os.status=sw.checked?'aguardando':'oficina';
          os.updatedAt=new Date().toISOString();
          saveOSList(list);
          renderOSKanban();
          renderOSCompleted();
          updateOSEventStatus(os);
        }
      }
    });
    board.addEventListener('keydown',e=>{
      if(e.target.classList.contains('os-card') && e.key==='Enter'){
        const os=loadOSList().find(o=>o.id==e.target.dataset.id);
        if(os) openOSForm(os.tipo, os);
      }
    });
    setupOSDragAndDrop();
  }
  renderOSKanban();
  renderOSCompleted();
}

// ===== Theme =====
function toggleTheme() {
  const html = document.documentElement;
  const next = html.classList.toggle('theme-dark') ? 'dark' : 'light';
  state.setTheme(next);
}
(function initTheme(){
  if(state.getTheme()==='dark') document.documentElement.classList.add('theme-dark');
})();

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  migrateToProfiles();
  seedAllDash();
  if(!localStorage.getItem(PERFIL_KEY)) setActivePerfil('Usuario Teste');
  ensurePerfilSeeds();
  cleanupDesfalques();
  cleanupOrphanEventos();
  ensureProfileBoot(getPerfil());
  purgeOrphanEvents();
  ui.initDropdowns();
  ui.initModal();
  const perfilSelect=document.getElementById('profileSelect');
  if(perfilSelect){
    perfilSelect.value=getPerfil();
    updateProfileUI();
    perfilSelect.addEventListener('change',()=>{
      setActivePerfil(perfilSelect.value);
      ensureProfileBoot(perfilSelect.value);
      updateProfileUI();
      ensurePerfilSeeds();
      applyPerfilGates();
      renderRoute(currentRoute);
      onProfileChanged();
    });
  }
  document.querySelectorAll('.nav-item').forEach(item => {
    const hasSubmenu = item.classList.contains('has-submenu');
    if(hasSubmenu){
      const shouldOpen = item.dataset.expanded === 'true' && isSubmenuEnabled(item);
      setNavSubmenuState(item, shouldOpen);
    }
    const activateSubmenu = () => {
      const expanded = item.dataset.expanded === 'true';
      if(expanded){
        setNavSubmenuState(item, false);
      } else {
        collapseAllSubmenus(item.dataset.root);
        setNavSubmenuState(item, true);
      }
    };
    const activateRoute = () => {
      const targetRoute = item.dataset.route || item.dataset.defaultRoute;
      if(targetRoute){
        collapseAllSubmenus();
        hideNavTooltip();
        location.hash = '#/'+targetRoute;
      }
    };
    item.addEventListener('click', e => {
      if(hasSubmenu && isSubmenuEnabled(item)){
        e.preventDefault();
        activateSubmenu();
      } else {
        activateRoute();
      }
    });
    item.addEventListener('keydown', e => {
      if(e.key==='Enter' || e.key===' '){
        e.preventDefault();
        if(hasSubmenu && isSubmenuEnabled(item)){
          activateSubmenu();
        } else {
          activateRoute();
        }
      }
    });
    item.addEventListener('mouseenter', () => {
      if(hasSubmenu && item.dataset.expanded === 'true') return;
      showNavTooltipForItem(item);
    });
    item.addEventListener('mouseleave', () => {
      hideNavTooltip();
    });
    item.addEventListener('focus', () => {
      if(hasSubmenu && item.dataset.expanded === 'true') return;
      showNavTooltipForItem(item);
    });
    item.addEventListener('blur', () => {
      hideNavTooltip();
    });
  });
  document.querySelectorAll('.nav-subitem').forEach(sub => {
    sub.addEventListener('click', () => {
      const parent = document.querySelector(`.nav-item[data-root="${sub.dataset.parent}"]`);
      collapseAllSubmenus();
      if(parent) setNavSubmenuState(parent, false);
      hideNavTooltip();
      location.hash = '#/'+sub.dataset.route;
    });
    sub.addEventListener('keydown', e => {
      if(e.key==='Enter'){
        const parent = document.querySelector(`.nav-item[data-root="${sub.dataset.parent}"]`);
        collapseAllSubmenus();
        if(parent) setNavSubmenuState(parent, false);
        hideNavTooltip();
        location.hash = '#/'+sub.dataset.route;
      }
    });
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest('.nav-group')) collapseAllSubmenus();
  });
  applyPerfilGates();
  await limparCachesJoaoClaro();
  renderRoute(location.hash.slice(2) || 'dashboard');
  refreshUI();
});

window.addEventListener('hashchange', () => renderRoute(location.hash.slice(2) || 'dashboard'));

const scheduleNavPopoverReposition = () => requestAnimationFrame(repositionActiveNavPopover);
window.addEventListener('resize', scheduleNavPopoverReposition);
window.addEventListener('scroll', scheduleNavPopoverReposition, true);

// remove focus state from regular buttons after click
document.addEventListener('click',e=>{
  const btn=e.target.closest('button');
  if(btn && !btn.classList.contains('pill-date') && !btn.closest('.segmented')) btn.blur();
});
