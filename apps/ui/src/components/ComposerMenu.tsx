import { useId, useRef, useState, type ReactNode } from 'react';

export interface ComposerMenuItem {
  key: string;
  label: string;
  /** A quiet second line: what the choice means or what it currently resolves to. */
  hint?: string;
  /** Present for a choice among alternatives (one item is checked); absent for an action. */
  checked?: boolean;
  disabled?: boolean;
  select: () => void;
}

/**
 * UI-28: the composer's product menu (model, effort, attach). A popover opened from its trigger, above it because the composer sits
 * at the bottom edge. Arrow keys, Home/End and Enter/Space work, Escape and Tab close, focus returns to the trigger. It opens and
 * closes with the shared Modern motion (composer.css), so reduced motion and low resource mode are respected in one place.
 */
export function ComposerMenu({ label, trigger, items, disabled, title, className = '', align = 'start' }: {
  label: string; trigger: ReactNode; items: ComposerMenuItem[]; disabled?: boolean; title?: string; className?: string; align?: 'start' | 'end';
}) {
  const popover = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ bottom: number; left: number; maxHeight: number }>();
  const enabled = () => [...popover.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []];
  const place = () => {
    const box = button.current?.getBoundingClientRect();
    if (!box) return;
    const left = align === 'end' ? Math.max(8, box.right - 240) : Math.max(8, Math.min(box.left, innerWidth - 248));
    setPosition({ bottom: innerHeight - box.top + 6, left, maxHeight: Math.max(96, box.top - 20) });
  };
  const show = (focus: 'selected' | 'first' | 'last' | false) => {
    place();
    popover.current?.showPopover();
    if (focus) requestAnimationFrame(() => {
      const all = enabled();
      (focus === 'last' ? all.at(-1) : focus === 'first' ? all[0] : all.find(item => item.getAttribute('aria-checked') === 'true') ?? all[0])?.focus({ preventScroll: true });
    });
  };
  const close = () => { popover.current?.hidePopover(); button.current?.focus({ preventScroll: true }); };
  return <>
    <button ref={button} type="button" className={`composer-menu-trigger ${className}`} aria-label={label} title={title} aria-haspopup="menu" aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={event => { if (open) popover.current?.hidePopover(); else show(event.detail === 0 ? 'selected' : false); }}
      onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); show(event.key === 'ArrowUp' ? 'last' : 'first'); } }}>{trigger}</button>
    <div ref={popover} id={id} popover="auto" role="menu" aria-label={label} className={`composer-menu ${className}`} style={position}
      onToggle={event => setOpen(event.newState === 'open')}
      onKeyDown={event => {
        const all = enabled(), at = all.indexOf(document.activeElement as HTMLButtonElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); all[(at + (event.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus({ preventScroll: true }); }
        else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); (event.key === 'Home' ? all[0] : all.at(-1))?.focus({ preventScroll: true }); }
        else if (event.key === 'Tab') popover.current?.hidePopover();
        else if (event.key === 'Escape') { event.preventDefault(); close(); }
      }}>
      {items.map(item => <button key={item.key} type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked} disabled={item.disabled} onClick={() => { item.select(); close(); }}>
        <svg className="composer-menu-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" /></svg>
        <span>{item.label}{item.hint && <small>{item.hint}</small>}</span>
      </button>)}
    </div>
  </>;
}
