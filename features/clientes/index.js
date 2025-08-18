import { getState, setState } from '../../core/state.js';
import events from '../../core/events.js';

export function getClientes(){
  return getState().clientes || [];
}

export function addCliente(cliente){
  const clientes = getClientes();
  clientes.push(cliente);
  setState({ clientes });
  events.emit('cliente/created', cliente);
}

export function updateCliente(cliente){
  const clientes = getClientes().map(c=>c.id===cliente.id?{...c,...cliente}:c);
  setState({ clientes });
  events.emit('cliente/updated', cliente);
}

export function deleteCliente(id){
  const clientes = getClientes().filter(c=>c.id!==id);
  setState({ clientes });
  events.emit('cliente/deleted', id);
}

export default { getClientes, addCliente, updateCliente, deleteCliente };
