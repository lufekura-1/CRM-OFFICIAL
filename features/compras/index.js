import { getState } from '../../core/state.js';
import events from '../../core/events.js';
import { getClientes, updateCliente } from '../clientes/index.js';
import { removeEventosByCompra, createEvento } from '../calendario/index.js';
import { makeBaseId } from '../../services/id.js';

export function saveCompra(clienteId, compra){
  const profile = getState().profile;
  const clientes = getClientes();
  const cliente = clientes.find(c=>c.id===clienteId);
  if(!cliente) throw new Error('cliente not found');
  cliente.compras = cliente.compras || [];
  const idx = cliente.compras.findIndex(c=>c.id===compra.id);
  const isUpdate = idx>=0;
  if(isUpdate) cliente.compras[idx] = compra; else cliente.compras.push(compra);
  updateCliente(cliente);
  removeEventosByCompra(compra.id);
  createEvento({ id: makeBaseId(profile, clienteId, compra.id, 0), perfil: profile, dataISO: compra.data, label: 'Compra', meta:{ kind:'purchase', purchaseId: compra.id, clienteId }});
  events.emit(`compra/${isUpdate?'updated':'created'}`, compra);
}

export function deleteCompra(clienteId, compraId){
  const clientes = getClientes();
  const cliente = clientes.find(c=>c.id===clienteId);
  if(!cliente) throw new Error('cliente not found');
  cliente.compras = (cliente.compras||[]).filter(c=>c.id!==compraId);
  updateCliente(cliente);
  removeEventosByCompra(compraId);
  events.emit('compra/deleted', compraId);
}

export default { saveCompra, deleteCompra };
