import { useId, type KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

/**
 * Controlled search field. Supports a clear (×) button and Escape-to-clear so the list
 * can always be recovered without reaching for the mouse.
 */
export function SearchInput({ value, onChange, label, placeholder = 'Search…', className = '', autoFocus, onKeyDown }: SearchInputProps) {
  const id = useId();
  return (
    <div className={`search-input-wrap ${className}`}>
      <Search size={16} aria-hidden="true" />
      <input
        id={id}
        type="search"
        role="searchbox"
        value={value}
        autoFocus={autoFocus}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            event.stopPropagation();
            onChange('');
            return;
          }
          onKeyDown?.(event);
        }}
      />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label={`Clear ${label.toLowerCase()}`} title="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
