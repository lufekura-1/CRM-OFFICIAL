import { getState, setState } from '../../core/state.js';
import events from '../../core/events.js';

export function getEventos(){
  return getState().eventos || [];
}

export function createEvento(ev){
  const eventos = getEventos();
  eventos.push(ev);
  setState({ eventos });
  events.emit('calendar/event/created', ev);
}

export function removeEventosByCompra(compraId){
  const before = getEventos();
  const eventos = before.filter(e=>!(e.meta?.purchaseId===compraId || e.meta?.compraId===compraId));
  setState({ eventos });
  if(before.length !== eventos.length){
    events.emit('calendar/event/removed', compraId);
  }
}

export default { getEventos, createEvento, removeEventosByCompra };
