type CheckboxProps = { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean; title?: string };

export function Checkbox({ checked, onChange, label, disabled, title }: CheckboxProps) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} title={title} disabled={disabled} className={`checkbox ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)}>
      {checked && <span>✓</span>}
    </button>
  );
}
