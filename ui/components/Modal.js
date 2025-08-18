export class Modal {
  constructor(el){ this.el = el; }
  open(){ this.el?.classList.add('open'); }
  close(){ this.el?.classList.remove('open'); }
}

export default Modal;
