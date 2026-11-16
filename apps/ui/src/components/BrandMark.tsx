import { useId } from 'react';

// One ribbon of the six-ribbon woven mark (assets/brand/mark-on-dark.svg); the other five are this one turned by 60 degrees.
const ribbon = 'M 55 -116 C 26 -151 3 -187 -33 -160 C -72 -128 -117 -78 -117 -30 C -117 20 -76 66 -20 84 C 8 93 34 85 53 63 C 36 70 15 72 -5 67 C -58 58 -91 14 -91 -30 C -91 -73 -52 -112 -18 -140 C -1 -154 18 -145 55 -116 Z';

/** Builder-supplied mark, drawn as SVG in the current ink so it is sharp at every size and has no backing of its own.
 *  The button's accessible name already identifies Drishya. */
export function BrandMark() {
  // Several marks can be on one page (a header and Home's opening), so the ids are per instance.
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <span className="brand-mark brand-image" aria-hidden="true">
    <svg viewBox="-250 -250 500 500" width="32" height="32" focusable="false">
      <defs>
        <path id={`${id}r`} d={ribbon}/>
        <mask id={`${id}m`} maskUnits="userSpaceOnUse" x="-250" y="-250" width="500" height="500"><rect x="-230" y="-215" width="460" height="430" fill="#fff"/><circle r="71"/></mask>
      </defs>
      <g transform="scale(1.1)" mask={`url(#${id}m)`} fill="currentColor">{[0, 60, 120, 180, 240, 300].map(turn => <use key={turn} href={`#${id}r`} transform={`rotate(${turn})`}/>)}</g>
    </svg>
  </span>;
}
