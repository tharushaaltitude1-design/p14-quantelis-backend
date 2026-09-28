import { useRef, useState, type DragEvent } from 'react';
import { Plus, UploadCloud, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { MAX_UPLOAD_BYTES } from '@/config/constants';
import { useWorkspaceDispatch } from '@/state/workspaceContext';
import type { DatasetColumn, DatasetStatus } from '@/data/mock';

const ACCEPTED = ['.csv', '.xlsx', '.xls'];
const STATUSES: DatasetStatus[] = ['Validated', 'Processing', 'Needs review'];

type PickedFile = { name: string; size: number; columns: DatasetColumn[] };

function guessColumns(filename: string): DatasetColumn[] {
  // Without a parser we cannot read the real header row, so the preview is explicitly
  // labelled as inferred from the file name rather than presented as real data.
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').toLowerCase();
  return ['date', 'region', 'value'].map((name, index) => ({ name: index === 0 ? `${stem}_date` : `${stem}_${name}`, type: index === 0 ? 'Date' : index === 1 ? 'Categorical' : 'Numeric' }));
}

export function UploadDatasetModal({ onClose }: { onClose: () => void }) {
  const dispatch = useWorkspaceDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [status, setStatus] = useState<DatasetStatus>('Processing');
  const [saving, setSaving] = useState(false);

  const accept = (candidate: File | null | undefined) => {
    if (!candidate) return;
    const extension = `.${candidate.name.split('.').pop()?.toLowerCase() ?? ''}`;
    if (!ACCEPTED.includes(extension)) {
      setFileError(`${candidate.name} is not supported. Upload a ${ACCEPTED.join(', ')} file.`);
      setFile(null);
      return;
    }
    if (candidate.size > MAX_UPLOAD_BYTES) {
      setFileError(`${candidate.name} is larger than the 250 MB limit.`);
      setFile(null);
      return;
    }
    setFileError(null);
    setFile({ name: candidate.name, size: candidate.size, columns: guessColumns(candidate.name) });
    setName((current) => current || candidate.name.replace(/\.[^.]+$/, ''));
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files?.[0]);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setFileError('Choose a file before adding the dataset.');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Give the dataset a name.');
      return;
    }
    if (trimmed.length < 3) {
      setNameError('Use at least 3 characters.');
      return;
    }
    setSaving(true);
    dispatch({
      type: 'dataset/add',
      dataset: {
        name: trimmed,
        source: file.name.toLowerCase().endsWith('.csv') ? 'CSV upload' : 'Excel upload',
        rows: '—',
        variables: file.columns.length,
        status,
        quality: 100,
        columns: file.columns,
      },
    });
    dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Dataset added', message: `“${trimmed}” is now in your workspace.` } });
    setSaving(false);
    onClose();
  };

  return (
    <Modal title="Upload a dataset" onClose={onClose}>
      <form onSubmit={submit}>
        <p className="modal-intro">Add a structured dataset to your Quantelis workspace. CSV and XLSX files up to 250 MB are supported.</p>
        <div
          className={`upload-zone ${dragging ? 'dragging' : ''} ${file ? 'uploaded' : ''}`}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          aria-label="Choose a CSV or XLSX file, or drop one here"
        >
          {file ? (
            <>
              <UploadCloud size={28} />
              <b>{file.name}</b>
              <span>
                {(file.size / 1024).toFixed(1)} KB · {file.columns.length} inferred columns
              </span>
              <button
                type="button"
                className="text-button upload-clear"
                onClick={(event) => {
                  event.stopPropagation();
                  setFile(null);
                  setName('');
                }}
              >
                <X size={13} /> Remove file
              </button>
            </>
          ) : (
            <>
              <UploadCloud size={28} />
              <b>Drop your file here or browse</b>
              <span>CSV, XLSX up to 250 MB</span>
            </>
          )}
        </div>
        <input ref={inputRef} type="file" accept={ACCEPTED.join(',')} className="visually-hidden" aria-label="Dataset file" onChange={(event) => accept(event.target.files?.[0])} />
        {fileError && (
          <span className="field-error" role="alert">
            {fileError}
          </span>
        )}
        {file && (
          <div className="progress-line">
            <span>File validation</span>
            <b>100%</b>
            <i>
              <em />
            </i>
          </div>
        )}
        <label className="field-label" htmlFor="dataset-name">
          Dataset name
        </label>
        <input
          id="dataset-name"
          className="text-input dataset-name-input"
          value={name}
          placeholder="e.g. Q4 Regional Demand"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'dataset-name-error' : undefined}
          onChange={(event) => {
            setName(event.target.value);
            if (nameError) setNameError(null);
          }}
        />
        {nameError && (
          <span className="field-error" id="dataset-name-error" role="alert">
            {nameError}
          </span>
        )}
        <label className="field-label" htmlFor="dataset-status">
          Initial status
        </label>
        <select id="dataset-status" className="text-input dataset-name-input" value={status} onChange={(event) => setStatus(event.target.value as DatasetStatus)}>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-button" disabled={saving}>
            <Plus size={16} /> {saving ? 'Adding…' : 'Add dataset'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
