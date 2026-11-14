// Drishya's woven mark, from Harsh's LAND-18 geometry: six ribbons turned 60° apart around an open aperture.
// Each mount gets its own ids so several marks can share one page.
let count = 0;
const RIBBON = 'M 55 -116 C 26 -151 3 -187 -33 -160 C -72 -128 -117 -78 -117 -30 C -117 20 -76 66 -20 84 C 8 93 34 85 53 63 C 36 70 15 72 -5 67 C -58 58 -91 14 -91 -30 C -91 -73 -52 -112 -18 -140 C -1 -154 18 -145 55 -116 Z';

export function logoSVG(): string {
  const n = ++count, ribbon = `r${n}`, face = `f${n}`, mask = `m${n}`;
  const ribbons = [0, 60, 120, 180, 240, 300].map(angle => `<g class="ribbon" data-angle="${angle}" transform="rotate(${angle})"><use href="#${ribbon}" transform="translate(1 4)" fill="#8f8a7d"/><use href="#${ribbon}" fill="url(#${face})"/></g>`).join('');
  return `<svg class="mark" viewBox="-230 -215 460 430" focusable="false" aria-hidden="true">
    <defs>
      <path id="${ribbon}" d="${RIBBON}"/>
      <linearGradient id="${face}" x1="0%" y1="0%" x2="100%" y2="100%"><stop stop-color="#f1eee4"/><stop offset="1" stop-color="#c9c4b6"/></linearGradient>
      <mask id="${mask}" maskUnits="userSpaceOnUse" x="-230" y="-215" width="460" height="430"><rect x="-230" y="-215" width="460" height="430" fill="white"/><circle class="aperture" r="71" fill="black"/></mask>
    </defs>
    <g class="weave" transform="scale(1.1)" mask="url(#${mask})">${ribbons}</g>
  </svg>`;
}

export function mountLogos(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-logo]')) el.innerHTML = logoSVG();
}
