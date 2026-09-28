import { useEffect, useState } from 'react';
import { Modal } from './Modal';

type PromptDialogProps = {
  title: string;
  label: string;
  initialValue?: string;
  confirmLabel?: string;
  maxLength?: number;
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
  onCancel: () => void;
};

/** Shared single-field dialog, used for every "rename" action. */
export function PromptDialog({ title, label, initialValue = '', confirmLabel = 'Save', maxLength = 80, validate, onSubmit, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(initialValue);
    setError(null);
  }, [initialValue]);

  const trimmed = value.trim();

  return (
    <Modal title={title} onClose={onCancel} size="narrow">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const message = trimmed ? (validate?.(trimmed) ?? null) : 'This field is required.';
          setError(message);
          if (!message) onSubmit(trimmed);
        }}
      >
        <label className="field-label" htmlFor="prompt-dialog-input">
          {label}
        </label>
        <input
          id="prompt-dialog-input"
          className="text-input prompt-input"
          value={value}
          maxLength={maxLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'prompt-dialog-error' : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
        />
        {error ? (
          <span className="field-error" id="prompt-dialog-error" role="alert">
            {error}
          </span>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
