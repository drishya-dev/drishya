import { useRef, type InputHTMLAttributes } from 'react';

/**
 * Clarity's one search field (FINISH-0a): a 14 px search icon, the input, and a clear button once there is text.
 * Escape clears the text; a second Escape (on an empty field) blurs it. Used by Home now; Files, Toolbox, search and
 * the readers adopt it in their own FINISH items.
 */
export function SearchField({ value, onValueChange, label, clearLabel, className, onKeyDown, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onValueChange: (value: string) => void;
  /** The input's accessible name. */
  label: string;
  /** The clear button's accessible name. */
  clearLabel: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <div className={`cl-search${className ? ` ${className}` : ''}`}>
    <svg className="cl-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 4.5 4.5" /></svg>
    <input {...rest} ref={input} type="text" enterKeyHint="search" autoComplete="off" aria-label={label} value={value} onChange={event => onValueChange(event.target.value)}
      onKeyDown={event => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== 'Escape') return;
        if (value) { event.preventDefault(); event.stopPropagation(); onValueChange(''); }
        else { event.currentTarget.blur(); }
      }} />
    {value && <button type="button" className="cl-search-clear" aria-label={clearLabel} onClick={() => { onValueChange(''); input.current?.focus(); }}>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
    </button>}
  </div>;
}
