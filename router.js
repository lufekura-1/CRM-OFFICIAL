const routes = {};

export function register(route, fn){
  routes[route] = fn;
}

export function navigate(route){
  const fn = routes[route];
  if(fn) fn();
}

window.addEventListener('hashchange', () => {
  navigate(location.hash.slice(2));
});

export default { register, navigate };
