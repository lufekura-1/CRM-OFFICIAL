// Configuração da O.S. para Óptica

export function makeCodigo(numero, siglaPerfil){
  return `OT${numero}${siglaPerfil}`;
}

export const corPrincipal = '#8B0000'; // vermelho escuro

export const dadosGerais = {
  nome: '',
  telefone: '',
  cpf: '',
  armacao: '',
  lente: '',
  grau: {
    OE: { esf: '', cil: '', eixo: '', dnp: '', adicao: '' },
    OD: { esf: '', cil: '', eixo: '', dnp: '', adicao: '' }
  },
  observacao: '',
  previsaoEntrega: ''
};

export const viaLoja = {
  valorArmacao: 0,
  valorLente: 0,
  get valorTotal(){
    return this.valorArmacao + this.valorLente;
  }
};

export const garantia = {
  visivelEm: ['cliente']
}; // texto definido pelo administrador

export default {
  makeCodigo,
  corPrincipal,
  dadosGerais,
  viaLoja,
  garantia
};
