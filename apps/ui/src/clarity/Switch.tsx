import { useId, type ReactNode } from 'react';

/**
 * Clarity's one switch (FINISH-0a). A `role="switch"` button: Space or Enter toggles it, the whole row is the hit target,
 * the label sits on the left with an optional description beneath. Rendered only under `useSkin() === 'clarity'`;
 * Modern keeps its native checkboxes.
 */
export function Switch({ checked, onChange, label, description, disabled, inline, className, children }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  /** Sits in a line of other controls: the track follows the label instead of the row spanning its container. */
  inline?: boolean;
  className?: string;
  /** Extra material at the end of the row, such as a note; it is not part of the control. */
  children?: ReactNode;
}) {
  const id = useId(), labelId = `${id}-label`, descriptionId = `${id}-description`;
  return <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelId} aria-describedby={description ? descriptionId : undefined} disabled={disabled}
    className={`cl-switch${inline ? ' inline' : ''}${className ? ` ${className}` : ''}`} onClick={() => onChange(!checked)}>
    <span className="cl-switch-text"><span className="cl-switch-label" id={labelId}>{label}</span>{description && <span className="cl-switch-description" id={descriptionId}>{description}</span>}</span>
    <span className="cl-switch-track" aria-hidden="true"><span className="cl-switch-knob" /></span>
    {children}
  </button>;
}
