export function Card(content){
  const el = document.createElement('div');
  el.className = 'card';
  if(content) el.append(content);
  return el;
}

export default Card;
