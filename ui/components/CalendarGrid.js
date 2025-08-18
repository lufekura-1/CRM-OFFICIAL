import { diasDoMes } from '../../services/calendar.js';

export function CalendarGrid(year, month){
  const el = document.createElement('div');
  el.className = 'calendar-grid';
  const days = diasDoMes(year, month);
  days.forEach(d=>{
    const cell=document.createElement('div');
    cell.className='calendar-cell';
    cell.textContent=d.getDate();
    el.append(cell);
  });
  return el;
}

export default CalendarGrid;
