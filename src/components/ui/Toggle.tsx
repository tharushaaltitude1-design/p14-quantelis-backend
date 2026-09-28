type ToggleProps = { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean };

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={`toggle ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}
