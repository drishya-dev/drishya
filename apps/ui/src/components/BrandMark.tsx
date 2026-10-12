/** The eye is the product; its connected iris is the agent's observable work. */
export function BrandMark() {
  return <svg className="brand-mark neural-eye" viewBox="0 0 32 24" fill="none" aria-hidden="true">
    <path d="M2 12C5.8 5.5 10.5 3 16 3s10.2 2.5 14 9c-3.8 6.5-8.5 9-14 9S5.8 18.5 2 12Z" stroke="currentColor" strokeWidth="1.6" />
    <path d="m11 8 5-2 5 6-5 6-5-2V8Zm0 0 10 4-10 4m5-10v12" stroke="currentColor" strokeWidth="1" strokeOpacity=".55" />
    <circle cx="16" cy="12" r="2.5" fill="currentColor" />
    {[ [11, 8], [16, 6], [21, 12], [16, 18], [11, 16] ].map(([cx, cy]) => <circle key={`${cx}/${cy}`} cx={cx} cy={cy} r="1.35" fill="currentColor" />)}
  </svg>;
}
