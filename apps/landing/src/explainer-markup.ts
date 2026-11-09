// LAND-10: compact editorial product explanation immediately above the walkthrough.
export function explanationHTML(): string {
  return `<section id="how-it-works" class="explainer wrap" aria-labelledby="explainer-title">
  <div class="explainer-copy">
    <h2 id="explainer-title" class="explainer-heading" tabindex="-1">
      <span class="explainer-lead">Your agent writes code.</span>
      <span class="explainer-sub">Drishya shows the work.</span>
    </h2>
    <p class="explainer-support">Watch the files it reads, commands it runs, and changes it makes.</p>
    <p class="explainer-body">Keep your agent’s work in view as it happens. Open the source it read, inspect the output it received, and review the edit it recorded. Return to any captured moment without losing the context of your repository.</p>
  </div>
  <div class="explainer-art" aria-hidden="true">
    <svg class="explainer-aperture" viewBox="0 0 280 120" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
      <polygon points="140,8 238,32 268,82 198,112 82,112 12,82 42,32" stroke="#33383D" stroke-width="1" opacity="0.5" />
      <circle cx="140" cy="60" r="50" stroke="#33383D" stroke-width="1" opacity="0.35" />
      <circle cx="140" cy="60" r="24" stroke="#33383D" stroke-width="1" opacity="0.25" />
    </svg>
    <div class="explainer-emblems">
      <div class="explainer-slot" data-emblem="file">
        <svg class="explainer-emblem-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
          <g class="explainer-emblem-inner" data-emblem-inner>
            <path d="M19 12H37L45 20V52H19V12Z" stroke="#92D6C3" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M37 12V20H45" stroke="#92D6C3" stroke-width="1.5" stroke-linejoin="round"/>
            <line x1="25" y1="28" x2="39" y2="28" stroke="#ADB5BF" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="25" y1="35" x2="35" y2="35" stroke="#ADB5BF" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="25" y1="42" x2="31" y2="42" stroke="#ADB5BF" stroke-width="1.5" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
      <div class="explainer-slot" data-emblem="command">
        <svg class="explainer-emblem-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
          <g class="explainer-emblem-inner" data-emblem-inner>
            <path d="M21 24L29 32L21 40" stroke="#92D6C3" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="33" y1="40" x2="43" y2="40" stroke="#F4F6F8" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="21" y1="47" x2="43" y2="47" stroke="#485056" stroke-width="1.5" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
      <div class="explainer-slot" data-emblem="edit">
        <svg class="explainer-emblem-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false" aria-hidden="true">
          <g class="explainer-emblem-inner" data-emblem-inner>
            <line x1="19" y1="24" x2="25" y2="24" stroke="#F49C9C" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="29" y1="24" x2="45" y2="24" stroke="#ADB5BF" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="19" y1="34" x2="25" y2="34" stroke="#A8DFBF" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="22" y1="31" x2="22" y2="37" stroke="#A8DFBF" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="29" y1="34" x2="45" y2="34" stroke="#ADB5BF" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="29" y1="44" x2="39" y2="44" stroke="#485056" stroke-width="1.5" stroke-linecap="round"/>
          </g>
        </svg>
      </div>
    </div>
  </div>
</section>`;
}
