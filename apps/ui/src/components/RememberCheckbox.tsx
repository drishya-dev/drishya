/** SHIP-6d: the "Remember for this checkout" choice beside an Enable button. One compact Modern checkbox (a real checkbox, so keyboard,
 *  focus and assistive technology work as before), in the type size and colour of the card it sits in. */
export function RememberCheckbox({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="remember-check">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />
    <span className="remember-box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="m2.5 6.2 2.3 2.3 4.7-5" /></svg></span>
    <span>Remember for this checkout</span>
  </label>;
}
