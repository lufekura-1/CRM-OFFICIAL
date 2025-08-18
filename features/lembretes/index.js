import { getState, setState } from '../../core/state.js';
import events from '../../core/events.js';

export function getLembretes(){
  return getState().lembretes || [];
}

export function addLembrete(l){
  const lembretes = getLembretes();
  lembretes.push(l);
  setState({ lembretes });
  events.emit('lembrete/created', l);
}

export function markDone(id){
  const lembretes = getLembretes().map(l=>l.id===id?{...l,status:'feito'}:l);
  setState({ lembretes });
  events.emit('lembrete/done', id);
}

export function listParaHoje(dateISO = new Date().toISOString().slice(0,10)){
  return getLembretes().filter(l=>l.dataISO===dateISO && l.status==='pendente');
}

export function listAtrasados(dateISO = new Date().toISOString().slice(0,10)){
  return getLembretes().filter(l=>l.dataISO < dateISO && l.status==='pendente');
}

export default { getLembretes, addLembrete, markDone, listParaHoje, listAtrasados };
