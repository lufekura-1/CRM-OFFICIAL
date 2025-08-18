import { setState } from './core/state.js';
import { loadState } from './services/storage.js';
import router from './router.js';

function boot(){
  const profile = localStorage.getItem('lastProfile') || 'Usuario Teste';
  setState({ profile, ...loadState(profile) });

  router.register('dashboard', () => console.log('dashboard'));
  router.register('clientes', () => console.log('clientes'));

  router.navigate(location.hash.slice(2) || 'dashboard');
}

document.addEventListener('DOMContentLoaded', boot);
