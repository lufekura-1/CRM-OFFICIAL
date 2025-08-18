// localStorage persistence per profile
const PREFIX = 'app:';

export function loadState(perfil){
  const raw = localStorage.getItem(PREFIX + perfil);
  if(!raw) return {};
  try { return JSON.parse(raw); }
  catch(err){ console.error('Invalid state', err); return {}; }
}

export function saveState(perfil, partial){
  const prev = loadState(perfil);
  const next = { ...prev, ...partial };
  localStorage.setItem(PREFIX + perfil, JSON.stringify(next));
}

export function migrate(version){
  // placeholder for migrations between versions
  console.log('migrate to', version);
}

export default { loadState, saveState, migrate };
