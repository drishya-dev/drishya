function wovenLogo(): string {
  const ribbons = [0, 60, 120, 180, 240, 300].map(angle => `
    <g data-logo-ribbon transform="rotate(${angle})">
      <use href="#hero-logo-ribbon" transform="translate(1 4)" fill="#a6a091"/>
      <use href="#hero-logo-ribbon" fill="url(#hero-logo-face)"/>
    </g>`).join('');

  return `<svg class="identity-sculpture" viewBox="-230 -215 460 430" focusable="false">
    <defs>
      <path id="hero-logo-ribbon" d="M 55 -116
        C 26 -151 3 -187 -33 -160 C -72 -128 -117 -78 -117 -30
        C -117 20 -76 66 -20 84 C 8 93 34 85 53 63
        C 36 70 15 72 -5 67 C -58 58 -91 14 -91 -30
        C -91 -73 -52 -112 -18 -140 C -1 -154 18 -145 55 -116 Z"/>
      <linearGradient id="hero-logo-face" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop stop-color="#ece9dd"/>
        <stop offset="1" stop-color="#cfcbbe"/>
      </linearGradient>
      <mask id="hero-logo-aperture" maskUnits="userSpaceOnUse" x="-190" y="-190" width="380" height="380">
        <rect x="-190" y="-190" width="380" height="380" fill="white"/>
        <circle r="71" fill="black"/>
      </mask>
    </defs>
    <g transform="scale(1.1)" mask="url(#hero-logo-aperture)">${ribbons}</g>
  </svg>`;
}

export function identityHTML():string {
  const nodes=[[56,90],[140,30],[242,65],[334,20],[420,112],[470,200],[377,271],[264,215],[163,286],[65,227],[213,145],[335,140]];
  const edges=[[0,1],[0,9],[1,2],[1,10],[2,3],[2,10],[3,4],[3,11],[4,5],[4,11],[5,6],[6,7],[6,11],[7,8],[7,10],[8,9],[9,10],[10,11]];
  const rearNodes=nodes.slice(0,6);
  const frontNodes=nodes.slice(6);
  const rearEdges=edges.filter(([a,b])=>a!<6&&b!<6);
  const frontEdges=edges.filter(([a,b])=>a!>=6||b!>=6);
  return `<div class="identity-world" aria-hidden="true"><svg class="identity-map identity-map-rear" viewBox="0 0 520 320"><g>${rearEdges.map(([a,b])=>`<path d="M${nodes[a!]!.join(',')}L${nodes[b!]!.join(',')}"/>`).join('')}</g>${rearNodes.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="2.5"/>`).join('')}</svg><svg class="identity-map identity-map-front" viewBox="0 0 520 320"><g>${frontEdges.map(([a,b])=>`<path d="M${nodes[a!]!.join(',')}L${nodes[b!]!.join(',')}"/>`).join('')}</g>${frontNodes.map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="${i===4?5:2.5}"/>`).join('')}</svg>${wovenLogo()}<span class="identity-coordinate">दृश्य <span>that which is seen</span></span></div>`;
}
