// Simple event bus
const listeners = new Map();

export function on(event, fn){
  if(!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
}

export function off(event, fn){
  const set = listeners.get(event);
  if(set) set.delete(fn);
}

export function emit(event, payload){
  const set = listeners.get(event);
  if(set) set.forEach(fn => fn(payload));
}

export default { on, off, emit };
