export function Balloon(content, variant = 'panel') {
  const el = document.createElement('div');
  el.className = `balloon balloon--${variant}`;
  el.tabIndex = 0;
  if (content) {
    if (Array.isArray(content)) el.append(...content);
    else el.append(content);
  }
  return el;
}

export default Balloon;

