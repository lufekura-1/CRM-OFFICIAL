// ID helper
export function makeBaseId(perfil, clienteId, compraId, seq=0){
  if(!perfil || !clienteId || !compraId) throw new Error('missing parts for id');
  return `${perfil}:${clienteId}:${compraId}:${seq}`;
}

export default { makeBaseId };
