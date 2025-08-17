const PERFIL_KEY = 'activePerfil';
function getPerfil(){ return localStorage.getItem(PERFIL_KEY) || 'Teste'; }
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

const PROFILES = ['Exótica','Jorel Chicuta','Jorel Avenida','Administrador','Teste'];

const ALL_PROFILES = ['Exótica','Jorel Chicuta','Jorel Avenida','Administrador','Teste'];
(function hardResetOnce(){
  const k = 'RESET_2025_08_16_DONE';
  if(localStorage.getItem(k)) return;
  for(const p of ALL_PROFILES){
    localStorage.removeItem(`${p}:clients`);
    localStorage.removeItem(`${p}:calendar`);
  }
  localStorage.setItem(k,'1');
})();

function seedProfile(profile='Teste'){
  setJSONForPerfil(profile,'clientes',[]);
  setJSONForPerfil(profile,'calendar',[]);
  setJSONForPerfil(profile,'dashboard',{slots:Array(8).fill(null)});
}

function ensureProfileBoot(profile=currentProfile()){
  profile = profile || 'Teste';
  if(!ALL_PROFILES.includes(profile)) profile='Teste';
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
  renderClientsTable?.(); renderCalendarMonth?.(); renderDashboard?.();
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
  renderClientsTable?.();
  renderCalendarMonth?.();
  renderDashboard?.();
  renderSelectedPurchaseDetails?.();
}

function on(el, ev, fn){ el && (el._h?.[ev] && el.removeEventListener(ev, el._h[ev]), (el._h=el._h||{}, el._h[ev]=fn), el.addEventListener(ev, fn)); }

function bindOnce(el, ev, fn){
  if(!el) return;
  if(el.__b && el.__b[ev]) el.removeEventListener(ev, el.__b[ev]);
  el.__b = el.__b||{}; el.__b[ev]=fn; el.addEventListener(ev, fn);
}

function toast(msg){ ui?.toast ? ui.toast(msg) : console.log(msg); }

on(document.getElementById('btnNovaCompra'), 'click', e => { e.preventDefault(); openPurchaseModalForSelected?.(); });
on(document.getElementById('btnNovoContato'), 'click', e => { e.preventDefault(); openContactModalForSelected?.(); });

function renderCalendarMonth(){
  purgeOrphanEvents();
  reloadCalendario?.();
}

let addGuard = false;
bindOnce(document.getElementById('dashAddMenu'),'click', e=>{
  const btn = e.target.closest('[data-widget]'); if(!btn || addGuard) return;
  addGuard = true;
  const type = btn.dataset.widget;
  insertWidgetOnce(type);
  closeDashMenu?.();
  setTimeout(()=> addGuard=false, 250);
});

function insertWidgetOnce(type){
  const layout = ensureFreeSlot(loadDashLayout());
  const firstEmpty = layout.slots.findIndex(s => s == null);
  if(firstEmpty === -1) return toast('Sem espaço');
  layout.slots[firstEmpty] = { id:type, size:'1x1' };
  saveDashLayout(layout);
  renderDashboard?.();
}

function dashKey(profile = getPerfil()){ return `perfil:${profile}:dashboard.layout`; }
function ensureSeed(profile = getPerfil()){
  const cur = getJSON(dashKey(profile), null);
  if(!cur || !Array.isArray(cur.slots) || cur.slots.length < 8){
    setJSON(dashKey(profile), { slots:Array(8).fill(null), version:1 });
  }
}
function seedAllDash(){ PROFILES.forEach(ensureSeed); }

function onProfileChanged(){
  ensureSeed(getPerfil());
  renderDashboard();
  renderClientsTable?.();
  renderCalendarMonth?.();
}

function addDaysUTC(date, days){ const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); d.setUTCDate(d.getUTCDate()+days); return d; }
function parseDDMMYYYY(s){ const [dd,mm,yy] = s.split('/').map(Number); return new Date(Date.UTC(yy, mm-1, dd)); }
function fmtYMD(d){ return d.toISOString().slice(0,10); }

function upsertEvent(list, ev){
  const idx = list.findIndex(e => e.id === ev.id);
  if(idx >= 0) list[idx] = ev; else list.push(ev);
}

function scheduleFollowUpsForPurchase(cliente, compra){
  const cal = getCalendar();
  const baseId = `${currentProfile()}:${cliente.id}:${compra.id}:0`;
  const baseDate = parseDDMMYYYY(compra.dataCompra);

  upsertEvent(cal, {
    id: baseId,
    date: fmtYMD(baseDate),
    title: cliente.nome,
    color: 'green',
    meta: { clientId: cliente.id, purchaseId: compra.id, followupOffsetDays: 0, kind:'purchase' }
  });

  for (const d of [90,180,365]){
    const id = `${currentProfile()}:${cliente.id}:${compra.id}:${d}`;
    const dt = addDaysUTC(baseDate, d);
    upsertEvent(cal, {
      id, date: fmtYMD(dt),
      title: `${cliente.nome} (${d===90?'3 meses':d===180?'6 meses':'12 meses'})`,
      color: 'blue',
      meta: { clientId: cliente.id, purchaseId: compra.id, followupOffsetDays: d, kind:'followup' }
    });
  }
  setCalendar(cal); renderCalendarMonth?.();
}

// MIGRAÇÃO – limpar laranjas existentes de compras
(function removeOrangePurchaseEvents(){
  const cal = getCalendar();
  const filtered = cal.filter(ev => !(ev.meta?.kind==='purchase' && ev.color==='orange'));
  if(filtered.length !== cal.length){ setCalendar(filtered); }
})();

function scheduleFollowUpsOnClientSave(cliente){
  (cliente.compras||[]).forEach(c => scheduleFollowUpsForPurchase(cliente, c));
}

function migrateToProfiles(){
  if(!localStorage.getItem('migrated_to_profiles_v1')){
    const legacy=['clientes','calendario','calendar','lembretes','contato','usuarios'];
    legacy.forEach(k=>{ const val=localStorage.getItem(k); if(val){ localStorage.setItem(`perfil:Teste:${k}`, val); localStorage.removeItem(k); } });
    localStorage.setItem('migrated_to_profiles_v1','1');
  }
}

function ensurePerfilSeeds(){
  if(getPerfil()==='Administrador'){
    const usuarios=getJSON(prefix()+'usuarios', []);
    if(usuarios.length===0){
      const seeds=["Jorel Chicuta","Jorel Avenida","Exótica","Teste"].map(n=>({id:uuid(), nome:n, email:'', perfil:''}));
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
  const tags = new Set(ui.clients.filters.usos||[]);
  return list.filter(c=>{
    const byText = c.nome?.toLowerCase().includes(t)
      || (c.telefone||'').toLowerCase().includes(t)
      || (c.nfe||'').toLowerCase().includes(t);
    const byCPF  = digits && normalizeDigits(c.cpf).includes(digits);
    const byTags = tags.size===0 || (Array.isArray(c.usos) && c.usos.some(tg=>tags.has(tg)));
    return (byText || byCPF) && byTags;
  });
}

function updateProfileUI(){
  const badge=document.getElementById('profileBadge');
  if(!badge) return;
  const p=activeProfile();
  badge.textContent=p;
  badge.classList.remove('profile-admin','profile-other');
  badge.classList.add(p==='Administrador'?'profile-admin':'profile-other');
}

let selectedPurchaseId = null;
let currentClientId = null;
let currentClientPurchases = [];
let renderSelectedPurchaseDetails = null;

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
  const map={vs:'Visão Simples', mf:'Multifocal', bf:'Bifocal', sl:'Solar'};
  portal.innerHTML=`<div id="tagMenuContent" class="tag-menu">${Object.entries(map).map(([k,v])=>`<div class=\"tag-row\"><label class=\"tag-switch\"><input type=\"checkbox\" data-tag=\"${k}\" ${ui.clients.filters.usos.includes(v)?'checked':''}><span>${v}</span></label></div>`).join('')}</div>`;
  document.getElementById('tagMenuContent')?.addEventListener('change',e=>{
    const cb=e.target.closest('input[type="checkbox"][data-tag]'); if(!cb) return;
    toggleTagFilter(cb.dataset.tag, cb.checked);
    renderClientsTable?.();
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
  const map={vs:'Visão Simples', mf:'Multifocal', bf:'Bifocal', sl:'Solar'};
  const val=map[code]||code;
  const set=new Set(ui.clients.filters.usos||[]);
  if(on) set.add(val); else set.delete(val);
  ui.clients.filters.usos=Array.from(set);
  setJSON(prefix()+'clients.filters.usos', ui.clients.filters.usos);
}

// ===== State =====
const PERFIS = ['Exótica','Jorel Chicuta','Jorel Avenida','Administrador','Teste'];

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

function applyPerfilGates(){
  const isAdmin = getPerfil()==='Administrador';
  const navConfig=document.querySelector('.nav-config');
  if(navConfig) navConfig.style.display = isAdmin ? '' : 'none';
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
  let eventos=getJSON(calKey(),[]);
  eventos=eventos.filter(e=>{
    if(e.meta?.type==='followup' && e.meta?.clienteId===clienteId){
      if(!compraId || e.meta?.compraId===compraId) return false;
    }
    return true;
  });
  setJSON(calKey(),eventos);
  renderCalendarMonth && renderCalendarMonth();
  reloadCalendario();
}

const db = {
  _get() {
    const data = getJSON(prefix()+'clientes', []);
    const filtered = data.filter(c => c.nome !== 'José' && !isNomeBloqueado(c.nome));
    if (filtered.length !== data.length) setJSON(prefix()+'clientes', filtered);
    return filtered;
  },
  _set(data) {
    setJSON(prefix()+'clientes', data);
  },
  initComSeeds() {
    if (getPerfil() !== 'Teste') return;
    if (this._get().length) return;
    const seeds = [];
    for (let i = 1; i <= 10; i++) {
      const now = new Date();
      const id = uuid();
      const nome = `Cliente ${i}`;
      if (isNomeBloqueado(nome)) continue;
      const compras = [];
      for (let j = 1; j <= 2; j++) {
        const dataCompra = new Date(now.getTime() - (i * j) * 86400000).toISOString().slice(0, 10);
        const cp={
          id: uuid(),
          dataCompra,
          armacao: `A${i}${j}`,
          lente: `L${i}${j}`,
          valorLente: 100 + i * j,
          nfe: '',
          tiposCompra: [],
          armacaoMaterial: 'OUTRO',
          receituario: {
            oe: { esferico: '-1.00', cilindrico: '-0.50', eixo: '90', dnp: '30', adicao: '1.00' },
            od: { esferico: '-1.00', cilindrico: '-0.50', eixo: '90', dnp: '30', adicao: '1.00' }
          },
          followUps: {}
        };
        compras.push(cp);
      }
      compras.sort((a, b) => b.dataCompra.localeCompare(a.dataCompra));
      const cliente={
        id,
        nome,
        telefone: `11999${String(i).padStart(4, '0')}`,
        dataNascimento: `1990-01-${String(i).padStart(2, '0')}`,
        cpf: `${String(i).padStart(11, '0')}`,
        observacoes: '',
        usos: [],
        compras,
        criadoEm: now.toISOString(),
        atualizadoEm: now.toISOString()
      };
      compras.forEach(cp=>{ cp.dataISO=cp.dataCompra; scheduleFollowUpsForPurchase(cliente,cp); });
      seeds.push(cliente);
    }
    this._set(seeds);
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
      observacoes: payload.observacoes || '',
      usos: payload.usos || [],
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
  atualizarCompra(clienteId, compraId, patch) {
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
    reloadCalendario();
    renderDashboard();
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
    const seeds=[...PROTECTED_USERS,'Teste'].map(n=>({id:uuid(), nome:n, email:'', perfil:''}));
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
  clients: { filters: { usos: [] }, search: '' },
  dashboard: { layout: null },
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
      } else if (e.key === '/' && document.activeElement !== document.querySelector('.global-search')) {
        e.preventDefault();
        document.querySelector('.global-search').focus();
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
  clientes: renderClientes,
  lembretes: renderLembretes,
  contato: renderContato,
  gerencia: renderGerencia,
  configuracoes: renderConfig
};
let currentRoute = 'dashboard';
function renderRoute(name){
  currentRoute = name in routes ? name : 'dashboard';
  const main = document.querySelector('#app-main');
  if(currentRoute==='gerencia') main.innerHTML='';
  else main.innerHTML = routes[currentRoute]() || '';
  cards.apply(main);
  cards.loading(main);
  const titles = {
    dashboard: 'Dashboard',
    calendario: 'Calendario',
    clientes: 'Clientes',
    lembretes: 'Lembretes',
    contato: 'Contato a ser executado',
    gerencia: 'Gerencia',
    configuracoes: 'Configurações'
  };
  document.getElementById('page-title').textContent = titles[currentRoute] || currentRoute;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('is-active', i.dataset.route === currentRoute));
  if(currentRoute === 'dashboard') initDashboardPage();
  if(currentRoute === 'clientes') initClientesPage();
  if(currentRoute === 'calendario') initCalendarioPage();
  if(currentRoute === 'gerencia') initGerenciaPage();
  if(currentRoute === 'configuracoes') initConfiguracoesPage();
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

function renderCalendario() {
  return `
  <div class="card-grid">
    <div class="card" data-card-id="calendario" data-colspan="12">
      <div class="card-body calendario-wrapper">
        <div id="calendar" class="calendar">
        <div class="cal-toolbar">
          <div class="cal-left">
            <button class="btn btn-primary btn-criar-evento">Criar evento</button>
            <button class="btn btn-desfalques" style="display:none">Desfalques</button>
          </div>
          <div class="cal-nav">
            <button class="btn cal-prev" aria-label="Mês anterior">&#8249;</button>
            <h2 class="cal-mes monthTitle"></h2>
            <button class="btn cal-next" aria-label="Próximo mês">&#8250;</button>
          </div>
          <div class="cal-right">
            <select class="cal-mes-select" aria-label="Mês"></select>
            <select class="cal-ano" aria-label="Ano"></select>
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
  </div>`;
}
function renderClientes() {
  return `
  <div class="card-grid">
    <div class="card" data-card-id="lista-clientes" data-colspan="6">
      <div class="card-header">
        <div class="card-head">Lista de Clientes</div>
        <div class="list-toolbar clients-toolbar">
          <div class="search-wrap"><span class="icon">${iconSearch}</span><input id="clientSearch" class="search-input" placeholder="Pesquisar clientes…" aria-label="Pesquisar clientes" /></div>
          <button id="tagMenuBtn" type="button" class="btn-dropdown">Etiquetas ▾</button>
          <button id="addClientBtn" class="btn-icon btn-plus add-cliente" aria-label="Adicionar" title="Adicionar">${iconPlus}</button>
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
function renderLembretes() {
  return renderCardGrid('Lembretes') + '<div class="kanban-area empty-state">Quadro de Kanban</div>';
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

function renderContato() {
  return renderCardGrid('Contato');
}

function renderGerencia() {
  return renderCardGrid('Gerencia');
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

// ===== Helpers =====
function uuid() {
  return Math.random().toString(36).slice(2, 11);
}

function formatTelefone(t) {
  return t.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
}

function formatDateBr(str) {
  return str ? new Date(str).toLocaleDateString('pt-BR') : '';
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

function openClienteModal(id, onSave) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = modal.querySelector('.modal-body');
  const content = modal.querySelector('.modal-dialog');
  content.classList.remove('modal-novo-cliente','modal-editar-cliente','modal-nova-compra');
  content.classList.add(id ? 'modal-editar-cliente' : 'modal-novo-cliente');
  const cliente = id ? db.buscarPorId(id) : null;
  title.textContent = id ? 'Editar Cliente' : 'Novo Cliente';
  body.innerHTML = `
      <form id="cliente-form">
        <input type="hidden" id="cliente-id">
        <div class="modal-section">
          <h3>Dados Pessoais</h3>
          <div class="form-grid">
            <div class="form-field col-span-12"><label for="cliente-nome">Nome *</label><input id="cliente-nome" name="nome" class="text-input" maxlength="80" required></div>
            <div class="form-field col-span-4"><label for="cliente-telefone">Telefone *</label><input id="cliente-telefone" name="telefone" class="text-input" required placeholder="(00) 00000-0000"></div>
            <div class="form-field col-span-4"><label for="cliente-dataNascimento">Data de Nascimento</label><input id="cliente-dataNascimento" type="date" name="dataNascimento" class="date-input"></div>
            <div class="form-field col-span-4"><label for="cliente-cpf">CPF</label><input id="cliente-cpf" name="cpf" class="text-input" placeholder="000.000.000-00"></div>
            <div class="form-field col-span-12"><label>O cliente usa:</label>
              <div class="chips" id="cliente-usa" role="group">
                <button type="button" class="chip" data-value="Visão Simples" aria-pressed="false">Visão Simples</button>
                <button type="button" class="chip" data-value="Multifocal" aria-pressed="false">Multifocal</button>
                <button type="button" class="chip" data-value="Bifocal" aria-pressed="false">Bifocal</button>
                <button type="button" class="chip" data-value="Solar" aria-pressed="false">Solar</button>
              </div>
            </div>
            ${id ? '<div class="form-field col-span-12"><label for="cliente-observacoes">Observações</label><textarea id="cliente-observacoes" name="observacoes" class="textarea" rows="4"></textarea></div>' : ''}
          </div>
        </div>
        ${id ? '' : `
        <div class="modal-section">
          <h3>Dados da Compra</h3>
          <div class="form-grid">
            <div class="form-field col-span-4"><label for="dataCompra">Data da Compra *</label><input id="dataCompra" type="date" name="dataCompra" class="date-input" required></div>
            <div class="form-field col-span-4"><label for="valorLente">Valor da Lente (R$)</label><input id="valorLente" name="valorLente" class="text-input" placeholder="0,00" inputmode="decimal"></div>
            <div class="form-field col-span-4"><label for="compra-nfe">NFE/NFC-e</label><input id="compra-nfe" name="nfe" class="text-input"></div>
            <div class="form-field col-span-12"><label for="armacao">Armação</label><input id="armacao" name="armacao" class="text-input"></div>
            <div class="form-field col-span-12"><label>Material da armação</label>
              <div class="segmented" id="armacao-material" role="group">
                <button type="button" class="seg-btn" data-value="ACETATO" aria-pressed="false">ACETATO</button>
                <button type="button" class="seg-btn" data-value="METAL" aria-pressed="false">METAL</button>
                <button type="button" class="seg-btn" data-value="TITANIUM" aria-pressed="false">TITANIUM</button>
                <button type="button" class="seg-btn" data-value="OUTRO" aria-pressed="false">OUTRO</button>
              </div>
            </div>
            <div class="form-field col-span-12"><label for="lente">Lente</label><input id="lente" name="lente" class="text-input"></div>
            <div class="form-field col-span-12"><label>Tipos de compra</label>
              <div class="segmented" id="tipos-compra" role="group">
                <button type="button" class="seg-btn" data-value="V.S" aria-pressed="false">V.S</button>
                <button type="button" class="seg-btn" data-value="M.F" aria-pressed="false">M.F</button>
                <button type="button" class="seg-btn" data-value="SOLAR" aria-pressed="false">SOLAR</button>
              </div>
            </div>
            <div class="form-field col-span-12"><label for="obs-compra">Observações</label><textarea id="obs-compra" name="observacoes" class="textarea" rows="3"></textarea></div>
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
        `}
      </form>`;
  const saveBtn = modal.querySelector('#clientSaveBtn') || modal.querySelector('#modal-save');
  saveBtn.setAttribute('form','cliente-form');
  saveBtn.id = 'clientSaveBtn';
  const cancelBtn = modal.querySelector('[data-modal-close]');
  cancelBtn.id = 'clientCancelBtn';
  bindOnce(saveBtn,'click', e=>{e.preventDefault(); handleClientSave();});
  bindOnce(cancelBtn,'click', e=>{e.preventDefault(); closeClientModal();});
  const form = body.querySelector('#cliente-form');
  form.dataset.id = id || '';
  const idInput = form.querySelector('#cliente-id');
  if(idInput) idInput.value = id || '';
  clientModalOnSave = onSave;
  const today = new Date().toISOString().slice(0,10);
  if (!id && form.dataCompra) form.dataCompra.value = today;
  const telInput = form.telefone;
  telInput.addEventListener('input', () => {
    let digits = telInput.value.replace(/\D/g,'').slice(0,11);
    telInput.value = formatTelefone(digits);
  });
  if (form.valorLente) {
    form.valorLente.addEventListener('input', () => {
      let digits = form.valorLente.value.replace(/\D/g,'');
      form.valorLente.value = (Number(digits)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    });
  }
  const usaDiv = form.querySelector('#cliente-usa');
  usaDiv.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const pressed = btn.getAttribute('aria-pressed')==='true';
      btn.setAttribute('aria-pressed',(!pressed).toString());
    });
  });
  let tiposDiv, materialDiv;
  if(!id){
    tiposDiv = form.querySelector('#tipos-compra');
    tiposDiv.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const pressed=btn.getAttribute('aria-pressed')==='true';
        btn.setAttribute('aria-pressed',(!pressed).toString());
      });
    });
    materialDiv = form.querySelector('#armacao-material');
    materialDiv.querySelectorAll('button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        materialDiv.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));
        btn.setAttribute('aria-pressed','true');
      });
    });
  }
  if (cliente) {
    form.nome.value = cliente.nome;
    form.telefone.value = formatTelefone(cliente.telefone);
    form.dataNascimento.value = cliente.dataNascimento || '';
    form.cpf.value = cliente.cpf || '';
    if (form.observacoes) form.observacoes.value = cliente.observacoes || '';
    (cliente.usos || []).forEach(u=>{
      usaDiv.querySelector(`button[data-value="${u}"]`)?.setAttribute('aria-pressed','true');
    });
  }
  modal.open();
}

function openCompraModal(clienteId, compraId, onSave) {
  const modal = document.getElementById('app-modal');
  const title = document.getElementById('modal-title');
  const body = modal.querySelector('.modal-body');
  const content = modal.querySelector('.modal-dialog');
  content.classList.remove('modal-novo-cliente','modal-editar-cliente','modal-nova-compra');
  content.classList.add('modal-nova-compra');
  const cliente = db.buscarPorId(clienteId);
  const compra = compraId ? cliente.compras.find(cp => cp.id === compraId) : null;
  title.textContent = compra ? 'Editar Compra' : 'Nova Compra';
  body.innerHTML = `
    <form id="compra-form">
      <div class="modal-section">
        <h3>Dados da Compra</h3>
        <div class="form-grid">
          <div class="form-field col-span-4"><label for="compra-data">Data da Compra *</label><input id="compra-data" type="date" name="dataCompra" class="date-input" required></div>
          <div class="form-field col-span-4"><label for="compra-valor">Valor da Lente (R$)</label><input id="compra-valor" name="valorLente" class="text-input" placeholder="0,00" inputmode="decimal"></div>
          <div class="form-field col-span-4"><label for="compra-nfe">NFE/NFC-e</label><input id="compra-nfe" name="nfe" class="text-input"></div>
          <div class="form-field col-span-12"><label for="compra-armacao">Armação</label><input id="compra-armacao" name="armacao" class="text-input"></div>
          <div class="form-field col-span-12"><label>Material da armação</label>
            <div class="segmented" id="compra-material" role="group">
              <button type="button" class="seg-btn" data-value="ACETATO" aria-pressed="false">ACETATO</button>
              <button type="button" class="seg-btn" data-value="METAL" aria-pressed="false">METAL</button>
              <button type="button" class="seg-btn" data-value="TITANIUM" aria-pressed="false">TITANIUM</button>
              <button type="button" class="seg-btn" data-value="OUTRO" aria-pressed="false">OUTRO</button>
            </div>
          </div>
          <div class="form-field col-span-12"><label for="compra-lente">Lente</label><input id="compra-lente" name="lente" class="text-input"></div>
          <div class="form-field col-span-12"><label>Tipos de compra</label>
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
    </form>`;
  const saveBtn = modal.querySelector('#modal-save');
  saveBtn.setAttribute('form','compra-form');
  saveBtn.id = 'purchaseSaveBtn';
  const cancelBtn = modal.querySelector('[data-modal-close]');
  cancelBtn.id = 'purchaseCancelBtn';
  bindOnce(saveBtn,'click', e=>{ e.preventDefault(); handlePurchaseSave(); });
  bindOnce(cancelBtn,'click', e=>{ e.preventDefault(); closePurchaseModal(); });
  const form = body.querySelector('#compra-form');
  form.dataset.clienteId = clienteId;
  form.dataset.compraId = compraId || '';
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
  const grid = wrapper.querySelector('.cal-grid');
  const emptyEl = wrapper.querySelector('.cal-empty');
  const monthEl = wrapper.querySelector('.cal-mes');
  const monthSelect = wrapper.querySelector('.cal-mes-select');
  const yearSelect = wrapper.querySelector('.cal-ano');
  const btnHoje = wrapper.querySelector('.cal-hoje');
  const btnCriar = wrapper.querySelector('.btn-criar-evento');
  const btnDesf = wrapper.querySelector('.btn-desfalques');
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
  if(getPerfil()==='Administrador'){
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
  function buildCompras(){
    const arr=[];
    db.listarClientes().forEach(c=>{
      (c.compras||[]).forEach(cp=>{
        arr.push({
          dataISO: cp.dataCompra,
          clienteNome: c.nome,
          clienteDados:{ telefone: c.telefone, email: c.email },
          armacao: cp.armacao,
          nfe: cp.nfe || '',
          tiposCompra: cp.tiposCompra || [],
          armacaoMaterial: cp.armacaoMaterial || ''
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
      render();
    }
    const cliente=db.buscarPorId(ev.meta?.clienteId);
    if(cliente){
      const compra=(cliente.compras||[]).find(c=>c.id===ev.meta?.compraId);
      if(compra){
        compra.followUps=compra.followUps||{};
        const fu=compra.followUps[ev.meta.stage]||{};
        fu.done=value;
        fu.doneAt=value?new Date().toISOString():null;
        fu.eventId=ev.id;
        fu.dueDateISO=fu.dueDateISO||ev.date;
        compra.followUps[ev.meta.stage]=fu;
        db.atualizarCompra(cliente.id, compra.id, {followUps: compra.followUps});
      }
    }
    renderDashboard();
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
          chip.textContent=cmp.clienteNome;
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
            chip.textContent=`${ev.nome} ${ev.periodo==='dia_todo'?'Dia todo':'Manhã'}`;
            chip.tabIndex=0;
            setupCalendarChipEvents(chip,()=>showEventoPopover(chip,ev));
            item.appendChild(chip);
          }else{
            const chip=document.createElement('div');
            chip.className='calendar-chip evento'+(ev.origem==='admin'?' admin':'');
            const color=ev.color;
            if(color) chip.classList.add(`event-color-${color}`);
            if(ev.meta?.type==='followup' || color==='followup') chip.classList.add('followup');
            chip.textContent=ev.title || ev.titulo;
            const done = ev.meta?.done ?? ev.efetuado;
            if(done!==undefined) chip.setAttribute('data-efetuado', done);
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
          card.innerHTML=`<strong>${ev.nome}</strong><span class="tag">${ev.periodo==='dia_todo'?'Dia todo':'Manhã'}</span>`;
          card.tabIndex=0;
          setupCalendarChipEvents(card,()=>showEventoPopover(card,ev));
        }else{
          card.className='calendar-card evento'+(ev.origem==='admin'?' admin':'');
          const color=ev.color;
          if(color) card.classList.add(`event-color-${color}`);
          if(ev.meta?.type==='followup' || color==='followup') card.classList.add('followup');
          card.innerHTML=`<strong>${ev.title || ev.titulo}</strong>${ev.observacao?`<p>${ev.observacao}</p>`:''}`;
          const done = ev.meta?.done ?? ev.efetuado;
          if(done!==undefined){
            card.setAttribute('data-efetuado', done);
            card.innerHTML += `<label>Efetuado <input type="checkbox" class="switch" ${done?'checked':''}></label>`;
            const sw=card.querySelector('.switch');
            if(sw){
              sw.addEventListener('click',e=>e.stopPropagation());
              if(ev.meta?.type==='followup') sw.addEventListener('change',()=>onToggleFollowUp(ev, sw.checked));
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
  btnHoje.addEventListener('click',()=>{ currentDate=new Date(); modo='mes'; segBtns.forEach(b=>b.setAttribute('aria-pressed', b.dataset.modo===modo?'true':'false')); render(); });
  btnCriar.addEventListener('click',()=>openEventoModal());
  btnPrev.addEventListener('click',()=>onChangeMonth(-1));
  btnNext.addEventListener('click',()=>onChangeMonth(1));
  btnPrevWeek.addEventListener('click',()=>onChangeWeek(-1));
  btnNextWeek.addEventListener('click',()=>onChangeWeek(1));
  segBtns.forEach(btn=>{ btn.addEventListener('click',()=>{ modo=btn.dataset.modo; segBtns.forEach(b=>b.setAttribute('aria-pressed', b===btn?'true':'false')); render(); }); });
  function openEventoModal(dataISO, ev){
    const modal=document.getElementById('app-modal');
    const title=document.getElementById('modal-title');
    const body=modal.querySelector('.modal-body');
    const content = modal.querySelector('.modal-dialog');
    content.classList.remove('modal-novo-cliente','modal-editar-cliente','modal-nova-compra');
    const isEdit=!!ev;
    const isAdmin=getPerfil()==='Administrador';
    title.textContent=isEdit?'Editar evento':'Criar evento';
    const destHtml=isAdmin&&!isEdit?`<div class="form-field col-span-12"><label>Destinos</label><table class="destinos-table"><thead><tr><th>Perfil</th><th>Enviar</th></tr></thead><tbody>${PERFIS.map(p=>`<tr><td>${p}</td><td><input type='checkbox' value='${p}' class='switch'></td></tr>`).join('')}</tbody></table></div>`:'';
    body.innerHTML=`<form id="evento-form"><div class="form-grid"><div class="form-field col-span-4"><label for="evento-data">Data *</label><input id="evento-data" type="date" name="data" class="date-input" required></div><div class="form-field col-span-8"><label for="evento-titulo">Título *</label><input id="evento-titulo" name="titulo" class="text-input" required></div><div class="form-field col-span-12"><label for="evento-obs">Observação</label><textarea id="evento-obs" name="obs" class="textarea" rows="3"></textarea></div>${destHtml}</div></form>`;
    modal.querySelector('#modal-save').setAttribute('form','evento-form');
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
    const title=document.getElementById('modal-title');
    const body=modal.querySelector('.modal-body');
    title.textContent='Novo desfalque';
    body.innerHTML=`<form id="desfalque-form"><div class="form-grid"><div class="form-field col-span-12"><label for="d-nome">Nome *</label><input id="d-nome" class="text-input" required></div><div class="form-field col-span-12"><label for="d-data">Data *</label><input id="d-data" type="date" class="date-input" required></div><div class="form-field col-span-12"><label>Manhã ⇄ Dia todo <input type="checkbox" id="d-periodo" class="switch"></label></div></div></form>`;
    modal.querySelector('#modal-save').setAttribute('form','desfalque-form');
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
      pop.innerHTML=`<div class="pop-head"><span class="pop-date">${formatDateBr(ev.dataISO)}</span>${admin?`<div class="popover-actions"><button class="btn-icon delete" aria-label="Apagar" title="Apagar">${iconTrash}</button></div>`:''}</div><div class="pop-title">${ev.nome} <span class="tag">${ev.periodo==='dia_todo'?'Dia todo':'Manhã'}</span></div>`;
      const layer=document.getElementById('calPopoverLayer');
      if(!layer) return;
      layer.appendChild(pop);
      positionPopover(target,pop);
      if(admin) pop.querySelector('.btn-icon.delete').addEventListener('click',()=>onDeleteEvento(ev.id));
      setupPopoverDismiss(pop,target);
      return;
    }
    if(ev.meta?.type==='followup'){
      pop.innerHTML=`<div class="pop-head"><span class="pop-date">${formatDateBr(ev.date)}</span></div><div class="pop-title">${ev.title || ''}</div><div class="pop-footer"><label>Contato efetuado <input type="checkbox" class="switch" ${ev.meta?.done?'checked':''}></label></div>`;
      const layer=document.getElementById('calPopoverLayer');
      if(!layer) return;
      layer.appendChild(pop);
      positionPopover(target,pop);
      const chk=pop.querySelector('.switch');
      if(chk) chk.addEventListener('change',()=>onToggleFollowUp(ev,chk.checked));
      setupPopoverDismiss(pop,target);
      return;
    }
    pop.innerHTML=`<div class="pop-head"><span class="pop-date">${formatDateBr(ev.date||ev.dataISO)}</span><div class="popover-actions"><button class="btn-icon delete" aria-label="Apagar" title="Apagar">${iconTrash}</button><button class="btn-icon adjust" aria-label="Ajustar" title="Ajustar">${iconEdit}</button></div></div><div class="pop-title">${ev.title||ev.titulo}</div><div class="pop-divider"></div>${ev.observacao?`<div class="pop-obs">${ev.observacao}</div>`:''}<div class="pop-footer"><input type="checkbox" class="switch" aria-label="Concluído" ${(ev.meta?.done ?? ev.efetuado)?'checked':''}></div>`;
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
    pop.innerHTML=`<div class="popover-body">`
      +`<div class="popover-row"><span class="label">Data</span><span class="value">${formatDateBr(cp.dataISO)}</span></div>`
      +`<div class="popover-row"><span class="label">Cliente</span><span class="value">${cp.clienteNome}</span></div>`
      +`${cp.nfe?`<div class="popover-row"><span class="label">NFE/NFC-e</span><span class="value">${cp.nfe}</span></div>`:''}`
      +`${cp.armacao?`<div class="popover-row"><span class="label">Armação</span><span class="value">${cp.armacao}${cp.armacaoMaterial?` <span class='tag'>${cp.armacaoMaterial}</span>`:''}</span></div>`:''}`
      +`${cp.tiposCompra?.length?`<div class="popover-row"><span class="label">Tipos</span><span class="value">${cp.tiposCompra.map(t=>`<span class='tag'>${t}</span>`).join(' ')}</span></div>`:''}`
      +`${cp.clienteDados?.telefone?`<div class="popover-row"><span class="label">Telefone</span><span class="value">${formatTelefone(cp.clienteDados.telefone)}</span></div>`:''}`
      +`${cp.clienteDados?.email?`<div class="popover-row"><span class="label">Email</span><span class="value">${cp.clienteDados.email}</span></div>`:''}`
      +`</div>`;
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
  function scheduleClose(){ hideTimer=setTimeout(closePopover,800); }
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
}
function initClientesPage() {
  db.initComSeeds();
  const tbody = document.getElementById('clientsTbody');
  const searchInput = document.getElementById('clientSearch');
  const tagBtn = document.getElementById('tagMenuBtn');
  const addBtn = document.getElementById('addClientBtn');
  const detail = document.querySelector('.detalhe-body');
  const headers = document.querySelectorAll('.table-clients th.sortable');
  const pag = document.querySelector('.clients-pagination');
  const prevBtn = pag.querySelector('.prev-page');
  const nextBtn = pag.querySelector('.next-page');
  const pageInfo = pag.querySelector('.page-info');
  const pageSizeSel = pag.querySelector('.page-size');
  let uiState = getJSON(prefix()+'clients.ui', { page:1, pageSize:10, sort:{key:'nome',dir:'asc'} });
  ui.clients.filters.usos = getJSON(prefix()+'clients.filters.usos', []);
  ui.clients.search = '';
  let sortBy = uiState.sort.key;
  let sortDir = uiState.sort.dir;
  let page = uiState.page;
  let pageSize = uiState.pageSize;

  pageSizeSel.value = String(pageSize);

  function persist(){ setJSON(prefix()+'clients.ui',{ page, pageSize, sort:{key:sortBy,dir:sortDir} }); setJSON(prefix()+'clients.filters.usos', ui.clients.filters.usos); }

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
            <td>${c.nome}</td>
            <td>${formatTelefone(c.telefone)}</td>
            <td>${compra ? formatDateBr(compra.dataCompra) : '-'}</td>`;
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
      const pills = compras.map(cp => `<button class="pill-date" data-purchase-id="${cp.id}">${formatDateBr(cp.dataCompra)}</button>`).join('');
      detail.innerHTML = `
        <div class="mini-card client-overview">
          <div class="overview-header">
            <h2>${c.nome}</h2>
            <div class="actions">
              <button class="btn-icon adjust btn-edit-detalhe" aria-label="Editar Cliente" title="Editar Cliente">${iconEdit}</button>
              <button class="btn-icon delete btn-delete-detalhe" aria-label="Excluir Cliente" title="Excluir Cliente">${iconTrash}</button>
            </div>
          </div>
          <div class="dados-pessoais info-grid">
          <div class="cli-field"><span class="phone-ico" aria-hidden="true"></span><span class="cli-label">Telefone:</span><strong class="cli-phone" id="cliPhoneValue">${formatTelefone(c.telefone)}</strong></div>
          <div class="info-label">Nascimento</div><div class="info-value">${c.dataNascimento ? formatDateBr(c.dataNascimento) : '-'}</div>
          <div class="info-label">CPF</div><div class="info-value">${c.cpf ? formatCpf(c.cpf) : '-'}</div>
          <div class="info-label">O cliente usa</div><div class="info-value">${(c.usos && c.usos.length)?c.usos.join(', '):'-'}</div>
        </div>
      </div>
        <div class="mini-card">
          <div class="detalhe-head">
            <h3>Histórico de Compras</h3>
            <div class="detalhe-actions">
              <button id="btnNovaCompra" class="btn btn-primary btn-nova-compra">Nova Compra</button>
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
            <div class="purchase-date-badge">${formatDateBr(cp.dataCompra)}</div>
            <div class="info-grid">
              <div class="info-label">Armação</div><div class="info-value">${cp.armacao || ''} ${cp.armacaoMaterial?`<span class='tag'>${cp.armacaoMaterial}</span>`:''}</div>
              <div class="info-label">Lente</div><div class="info-value">${cp.lente || ''}</div>
              <div class="info-label">Valor</div><div class="info-value">${formatCurrency(cp.valor ?? cp.valorLente)}</div>
              ${cp.nfe?`<div class="info-label">NFE/NFC-e</div><div class="info-value">${cp.nfe}</div>`:''}
              ${cp.tiposCompra?.length?`<div class="info-label">Tipos</div><div class="info-value">${cp.tiposCompra.map(t=>`<span class='tag'>${t}</span>`).join(' ')}</div>`:''}
            </div>
            <div class="receituario">
              <div class="rx-table-wrapper">
                <table class="rx-table">
                  <thead>
                    <tr><th></th><th>Esférico</th><th>Cilíndrico</th><th>Eixo</th><th>DNP</th><th>Adição</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>OE</td><td>${cp.receituario?.oe?.esferico || ''}</td><td>${cp.receituario?.oe?.cilindrico || ''}</td><td>${cp.receituario?.oe?.eixo || ''}</td><td>${cp.receituario?.oe?.dnp || ''}</td><td>${cp.receituario?.oe?.adicao || ''}</td></tr>
                    <tr><td>OD</td><td>${cp.receituario?.od?.esferico || ''}</td><td>${cp.receituario?.od?.cilindrico || ''}</td><td>${cp.receituario?.od?.eixo || ''}</td><td>${cp.receituario?.od?.dnp || ''}</td><td>${cp.receituario?.od?.adicao || ''}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
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
            db.atualizarCompra(id, cpId, { followUps: cp.followUps });
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
      detail.querySelector('.btn-delete-detalhe').addEventListener('click', () => {
        if (!confirm('Excluir cliente?')) return;
        const currentRow = tbody.querySelector(`tr[data-id="${c.id}"]`);
        const nextRow = currentRow ? (currentRow.nextElementSibling || currentRow.previousElementSibling) : null;
        deleteClient(c.id);
        state.setClienteSelecionado(nextRow ? nextRow.dataset.id : '');
        renderDetail();
        ui.toast('Cliente excluído');
      });
      const novaBtn = detail.querySelector('#btnNovaCompra');
      on(novaBtn, 'click', e => { e.preventDefault(); openCompraModal(c.id, null, () => { updateTable(); renderDetail(); }); });
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

  addBtn.addEventListener('click', () => openClienteModal(null, id => { state.setClienteSelecionado(id); updateTable(); renderDetail(); }));
    window.refreshClientsTable = updateTable;
    window.renderClientsTable = updateTable;

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


function loadDashLayout(){
  ensureSeed(getPerfil());
  return getJSON(dashKey(), { slots: Array(8).fill(null), version:1 });
}

function saveDashLayout(layout){ setJSON(dashKey(), layout); }

function ensureFreeSlot(layout){
  layout.slots = layout.slots.slice(0,8);
  while(layout.slots.length < 8) layout.slots.push(null);
  return layout;
}

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

function renderWidgetContent(cardInner, slot){
  const title = document.createElement('div'); title.className='dash-card-title';
  const value = document.createElement('div'); value.className='dash-card-value';

  if(slot.id === 'widget.clientsCount'){
    title.textContent = 'Quantidade de clientes';
    value.textContent = String(getClients().length);
  } else if(slot.id === 'widget.followupsToday'){
    title.textContent = 'Contatos para Hoje';
    value.textContent = String(getFollowupsStats().todayCount);
    cardInner.parentElement?.classList.add('card-info');
  } else if(slot.id === 'widget.followupsLate'){
    title.textContent = 'Contatos Atrasados';
    value.textContent = String(getFollowupsStats().late);
    cardInner.parentElement?.classList.add('card-danger');
  } else if(slot.id === 'widget.followupsDone'){
    title.textContent = 'Contatos Efetuados';
    const s = getFollowupsStats();
    value.innerHTML = `<div class="subline">Semana: ${s.doneWeek}</div><div class="subline">Mês: ${s.doneMonth}</div>`;
    cardInner.parentElement?.classList.add('card-success','card-compact');
  }

  cardInner.appendChild(title); cardInner.appendChild(value);
}

function renderDashboard(){
  purgeOrphanEvents();
  const grid = document.getElementById('dashboardGrid');
  if(!grid) return;
  const layout = ensureFreeSlot(loadDashLayout());
  grid.innerHTML = '';
  layout.slots.forEach((slot, i)=>{
    const slotEl = document.createElement('div');
    slotEl.className = 'dash-slot' + (slot? '' : ' empty');
    slotEl.dataset.slot = i;
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

    if(slot){
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
        lay.slots[i] = null; saveDashLayout(ensureFreeSlot(lay)); renderDashboard();
      };

      const wrap = document.createElement('div'); wrap.className = 'dash-card-inner';
      renderWidgetContent(wrap, slot);
      card.appendChild(close);
      card.appendChild(wrap);
      slotEl.appendChild(card);
    }

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

function initGerenciaPage(){
  const main=document.getElementById('app-main');
  if(main) main.innerHTML='';
  const modal=document.getElementById('app-modal');
  const title=document.getElementById('modal-title');
  const body=modal.querySelector('.modal-body');
  function openPrompt(){
    title.textContent='Senha';
    body.innerHTML=`<form id="gerencia-form"><div class="form-field col-span-12"><label for="gerencia-pass">Senha</label><input id="gerencia-pass" type="password" class="text-input" required></div></form>`;
    modal.querySelector('#modal-save').setAttribute('form','gerencia-form');
    modal.open();
    body.querySelector('#gerencia-form').addEventListener('submit',e=>{
      e.preventDefault();
      const val=body.querySelector('#gerencia-pass').value;
      if(val==='12345'){
        modal.close();
        if(main){
          main.innerHTML=renderGerencia();
          cards.apply(main);
          cards.loading(main);
          initConfiguracoesPage();
        }
      } else {
        alert('Senha inválida');
      }
    });
  }
  openPrompt();
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
    const title=document.getElementById('modal-title');
    const body=modal.querySelector('.modal-body');
    title.textContent=id?'Editar usuário':'Novo usuário';
    body.innerHTML=`<form id="usuario-form"><div class="form-grid"><div class="form-field col-span-12"><label for="u-nome">Nome *</label><input id="u-nome" name="nome" class="text-input" required></div><div class="form-field col-span-12"><label for="u-email">Email</label><input id="u-email" name="email" class="text-input"></div><div class="form-field col-span-12"><label for="u-perfil">Perfil</label><input id="u-perfil" name="perfil" class="text-input"></div></div></form>`;
    modal.querySelector('#modal-save').setAttribute('form','usuario-form');
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

function reloadCalendario(){
  purgeOrphanEvents();
  if(currentRoute==='calendario') renderRoute('calendario');
}

let clientModalOnSave=null;
let purchaseModalOnSave=null;

function parseCurrency(str){
  const n = parseFloat((str||'').toString().replace(/[^\d,-]/g,'').replace(',','.'));
  return isNaN(n)?0:n;
}

function readPrescriptionTable(){
  const get=id=>document.getElementById(id)?.value.trim()||'';
  return {
    oe:{ esferico:get('rxOEEsf'), cilindrico:get('rxOECil'), eixo:get('rxOEEixo'), dnp:get('rxOEDnp'), adicao:get('rxOEAd') },
    od:{ esferico:get('rxODESf'), cilindrico:get('rxODCil'), eixo:get('rxODEixo'), dnp:get('rxODDnp'), adicao:get('rxODAd') }
  };
}

function getSelectedTagUsosFromForm(){
  return Array.from(document.querySelectorAll('input[name="tagUso"]:checked')).map(cb=>cb.value);
}

function readClientForm(){
  return {
    id: document.getElementById('cliente-id')?.value || null,
    nome: document.getElementById('cliente-nome').value.trim(),
    telefone: document.getElementById('cliente-telefone').value.trim(),
    nascimento: document.getElementById('cliente-dataNascimento').value.trim(),
    cpf: document.getElementById('cliente-cpf').value.trim(),
    usos: getSelectedTagUsosFromForm(),
    compras: []
  };
}

function readPurchaseForm(){
  return {
    clienteId: document.getElementById('purchaseClientId').value,
    compra: {
      id: document.getElementById('purchaseId').value || null,
      dataCompra: document.getElementById('purchaseDate').value,
      nfe: document.getElementById('purchaseNFE').value.trim(),
      armacao: document.getElementById('purchaseFrame').value.trim(),
      material: document.querySelector('input[name="frameMaterial"]:checked')?.value || '',
      lente: document.getElementById('purchaseLens').value.trim(),
      valor: parseCurrency(document.getElementById('purchaseValue').value),
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
  m.classList.add('is-open');
  m.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
}

function closeModal(id){
  const m=document.getElementById(id) || document.getElementById('app-modal');
  if(m){
    m.classList.remove('is-open');
    m.setAttribute('aria-hidden','true');
  }
  document.body.classList.remove('modal-open');
  document.querySelectorAll('.modal-backdrop, .veil, [data-overlay]').forEach(n=>n.remove());
}

function closeClientModal(){
  const modal = document.getElementById('app-modal');
  const saveBtn = modal?.querySelector('#clientSaveBtn') || modal?.querySelector('#purchaseSaveBtn') || modal?.querySelector('#modal-save');
  if (saveBtn) saveBtn.id = 'modal-save';
  closeModal('clientModal');
  refreshUI();
}

function closePurchaseModal(){
  const modal = document.getElementById('app-modal');
  const saveBtn = modal?.querySelector('#purchaseSaveBtn') || modal?.querySelector('#clientSaveBtn') || modal?.querySelector('#modal-save');
  if (saveBtn) saveBtn.id = 'modal-save';
  closeModal('purchaseModal');
  refreshUI();
}

function refreshUI(){
  window.renderClientsTable?.();
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
  const f = readClientForm();
  if(!f.nome?.trim()) return toast('Informe o Nome');
  let list = getClients();
  if(f.id){
    list = list.map(c=>c.id===f.id ? {...c, ...f} : c);
  }else{
    f.id = `cli_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    list.push(f);
  }
  setClients(list);
  (f.compras||[]).forEach(c=>scheduleFollowUpsForPurchase(f,c));
  closeModal('clientModal');
  if(typeof clientModalOnSave === 'function') clientModalOnSave(f.id);
  refreshUI();
}

function handlePurchaseSave(){
  const {clienteId, compra} = readPurchaseForm();
  if(!clienteId) return toast('Cliente inválido');
  const list = getClients();
  const idx = list.findIndex(c=>c.id===clienteId);
  if(idx<0) return toast('Cliente não encontrado');
  list[idx].compras = list[idx].compras || [];
  if(!compra.id) compra.id = `cmp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const pIdx = list[idx].compras.findIndex(x=>x.id===compra.id);
  if(pIdx>=0) list[idx].compras[pIdx]=compra; else list[idx].compras.push(compra);
  setClients(list);
  scheduleFollowUpsForPurchase(list[idx], compra);
  closeModal('purchaseModal');
  if(typeof purchaseModalOnSave === 'function') purchaseModalOnSave();
  refreshUI();
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
  if(!localStorage.getItem(PERFIL_KEY)) setActivePerfil('Teste');
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
    item.addEventListener('click', () => { location.hash = '#/'+item.dataset.route; });
    item.addEventListener('keydown', e => { if(e.key==='Enter') location.hash = '#/'+item.dataset.route; });
  });
  applyPerfilGates();
  await limparCachesJoaoClaro();
  renderRoute(location.hash.slice(2) || 'dashboard');
  refreshUI();
});

window.addEventListener('hashchange', () => renderRoute(location.hash.slice(2) || 'dashboard'));
