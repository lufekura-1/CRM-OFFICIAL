/**
 * @typedef {Object} Cliente
 * @property {string} id
 * @property {string} nome
 * @property {string} telefone
 * @property {string} [cpf]
 * @property {string} [nascimento]
 * @property {string[]} [etiquetas]
 */

/**
 * @typedef {Object} Compra
 * @property {string} id
 * @property {string} clienteId
 * @property {string} data
 * @property {string} [armacao]
 * @property {string} [lente]
 * @property {number} [valor]
 * @property {string[]} [tipos]
 * @property {Object} medidas
 * @property {Object} medidas.OE
 * @property {Object} medidas.OD
 * @property {Object} flagsContato
 * @property {boolean} flagsContato.m3
 * @property {boolean} flagsContato.m6
 * @property {boolean} flagsContato.m12
 */

/**
 * @typedef {Object} EventoCalendario
 * @property {string} id
 * @property {string} perfil
 * @property {string} dataISO
 * @property {string} label
 * @property {string} [color]
 * @property {Object} meta
 * @property {'purchase'|'lembrete'|'os'} meta.kind
 * @property {string} [meta.purchaseId]
 * @property {string} [meta.clienteId]
 */

/**
 * @typedef {Object} Lembrete
 * @property {string} id
 * @property {string} clienteId
 * @property {string} dataISO
 * @property {'contato'} tipo
 * @property {'pendente'|'feito'} status
 * @property {'3m'|'6m'|'12m'|'manual'} origem
 */

export {};
