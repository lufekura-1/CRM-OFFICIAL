export function Table(headers = []){
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  headers.forEach(h=>{ const th=document.createElement('th'); th.textContent=h; tr.append(th); });
  thead.append(tr);
  table.append(thead);
  return table;
}

export default Table;
