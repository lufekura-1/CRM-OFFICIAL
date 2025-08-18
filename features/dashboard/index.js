import { getClientes } from '../clientes/index.js';
import { listParaHoje, listAtrasados } from '../lembretes/index.js';

export function countClientes(){
  return getClientes().length;
}

export function countContatosHoje(){
  return listParaHoje().length;
}

export function countContatosAtrasados(){
  return listAtrasados().length;
}

export default { countClientes, countContatosHoje, countContatosAtrasados };
