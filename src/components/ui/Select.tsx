import { useId } from 'react';

export type SelectOption = { value: string; label: string } | string;

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  required?: boolean;
  'aria-invalid'?: boolean;
};

function normalise(option: SelectOption): { value: string; label: string } {
  return typeof option === 'string' ? { value: option, label: option } : option;
}

/**
 * Controlled wrapper around a native <select>. Native is deliberate: it keeps mobile
 * pickers, keyboard behaviour and screen-reader support intact. The option colours are
 * fixed in CSS so the list is readable against the dark theme.
 */
export function Select({ value, onChange, options, label, className = '', disabled, required, ...aria }: SelectProps) {
  const generatedId = useId();
  const id = aria.id ?? generatedId;
  return (
    <select
      id={id}
      className={`text-input ${className}`}
      value={value}
      disabled={disabled}
      required={required}
      aria-label={label}
      aria-invalid={aria['aria-invalid']}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => {
        const { value: optionValue, label: optionLabel } = normalise(option);
        return (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        );
      })}
    </select>
  );
}
