// Global application state with simple pub/sub
let state = { profile: null, data: {} };
const subs = new Set();

export function getState(){
  return state;
}

export function setState(patch){
  state = { ...state, ...patch };
  subs.forEach(fn => fn(state));
}

export function subscribe(fn){
  subs.add(fn);
  return () => subs.delete(fn);
}

export default { getState, setState, subscribe };
