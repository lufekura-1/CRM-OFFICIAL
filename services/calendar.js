// Date helpers for calendar
export function primeiroDia(year, month){
  return new Date(year, month, 1);
}

export function diasDoMes(year, month){
  const date = new Date(year, month, 1);
  const res = [];
  while(date.getMonth() === month){
    res.push(new Date(date));
    date.setDate(date.getDate()+1);
  }
  return res;
}

export default { primeiroDia, diasDoMes };
