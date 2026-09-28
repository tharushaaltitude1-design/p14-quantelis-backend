import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Sparkles, Zap } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { SearchInput } from '@/components/ui/SearchInput';
import { Toggle } from '@/components/ui/Toggle';
import { HORIZONS } from '@/data/mock';
import { useWorkspace, useWorkspaceDispatch } from '@/state/workspaceContext';
import type { Project } from '@/data/mock';

const STEPS = ['Dataset', 'Configure', 'Review', 'Run'];
const CONFIDENCE_LEVELS = ['80%', '90%', '95%', '99%'];

type WizardState = { datasetId: string; name: string; variable: string; horizon: string; confidence: string; seasonality: boolean };

type NewProjectWizardProps = { onClose: () => void; onCreated?: (project: Project) => void; initialDatasetId?: string };

export function NewProjectWizard({ onClose, onCreated, initialDatasetId }: NewProjectWizardProps) {
  const { datasets, projects } = useWorkspace();
  const dispatch = useWorkspaceDispatch();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardState>({ datasetId: initialDatasetId ?? '', name: '', variable: '', horizon: HORIZONS[1], confidence: '95%', seasonality: true });
  const [errors, setErrors] = useState<Partial<Record<keyof WizardState, string>>>({});
  const [running, setRunning] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [progress, setProgress] = useState(0);
  const [created, setCreated] = useState<Project | null>(null);
  const timerRef = useRef<number | null>(null);
  const progressRef = useRef(0);

  const dataset = useMemo(() => datasets.find((d) => d.id === form.datasetId), [datasets, form.datasetId]);
  const visibleDatasets = useMemo(
    () => (datasetSearch ? datasets.filter((d) => d.name.toLowerCase().includes(datasetSearch.toLowerCase())) : datasets),
    [datasets, datasetSearch],
  );
  const variables = useMemo(
    () => (dataset ? dataset.columns.filter((column) => column.type === 'Numeric').map((column) => column.name) : []),
    [dataset],
  );

  // Pick a default dataset once, and seed the project name with it. Doing this in the
  // effect (rather than deriving the name from `dataset`) means the suggestion never
  // overwrites a name the user has already typed.
  useEffect(() => {
    if (form.datasetId || datasets.length === 0) return;
    const first = initialDatasetId ? datasets.find((d) => d.id === initialDatasetId) : undefined;
    const chosen = first ?? datasets[0];
    setForm((current) => ({ ...current, datasetId: chosen.id, name: current.name || `${chosen.name} plan` }));
  }, [datasets, form.datasetId, initialDatasetId]);

  useEffect(() => {
    setForm((current) => {
      const numeric = dataset ? dataset.columns.filter((c) => c.type === 'Numeric').map((c) => c.name) : [];
      if (numeric.includes(current.variable)) return current;
      return { ...current, variable: numeric[0] ?? current.variable };
    });
  }, [dataset]);

  useEffect(() => () => { if (timerRef.current) window.clearInterval(timerRef.current); }, []);

  const update = <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  /**
   * Choosing a dataset re-suggests the project name from it, but only while the name is
   * still the untouched suggestion, so re-picking a dataset never wipes typed input.
   */
  const selectDataset = (datasetId: string) => {
    const chosen = datasets.find((d) => d.id === datasetId);
    const suggestion = chosen ? `${chosen.name} plan` : '';
    setForm((current) => {
      const name = current.name === '' || current.name === `${current.datasetId ? datasets.find((d) => d.id === current.datasetId)?.name ?? '' : ''} plan` ? suggestion : current.name;
      return { ...current, datasetId, name, variable: current.variable };
    });
    setErrors((current) => ({ ...current, datasetId: undefined, name: undefined }));
  };

  const validateStep = (target: number): boolean => {
    if (target === 1) {
      if (!form.datasetId) {
        setErrors({ datasetId: 'Choose a dataset to continue.' });
        return false;
      }
      if (form.name.trim().length < 3) {
        setErrors({ name: 'Give the project a name of at least 3 characters.' });
        return false;
      }
    }
    if (target === 2 && !form.variable) {
      setErrors({ variable: 'Choose a forecast variable.' });
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < 4) {
      setStep(step + 1);
      return;
    }
    startRun();
  };

  const startRun = () => {
    setRunning(true);
    progressRef.current = 0;
    setProgress(0);
    // Progress lives in a ref as well as state so the completion check happens exactly once
    // in the interval callback (a state updater must stay free of side effects for StrictMode).
    timerRef.current = window.setInterval(() => {
      progressRef.current = Math.min(100, progressRef.current + 8 + Math.round(Math.random() * 10));
      setProgress(progressRef.current);
      if (progressRef.current >= 100) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        timerRef.current = null;
        finishRun();
      }
    }, 220);
  };

  const finishRun = () => {
    if (!dataset) return;
    const base = 88 + (form.seasonality ? 4 : 0) + (form.confidence === '99%' ? 1 : 0);
    const project: Project = {
      id: `draft-${Date.now().toString(36)}`,
      name: form.name.trim(),
      dataset: dataset.name,
      variable: form.variable,
      horizon: form.horizon,
      lastRun: 'Just now',
      status: 'Active',
      runs: 1,
      confidence: Math.min(99, base),
    };
    dispatch({
      type: 'project/add',
      project: { name: project.name, dataset: project.dataset, variable: project.variable, horizon: project.horizon, confidence: project.confidence, runs: 1 },
    });
    dispatch({ type: 'toast/push', toast: { kind: 'success', title: 'Forecast complete', message: `${project.name} scored ${project.confidence.toFixed(1)}% accuracy.` } });
    setRunning(false);
    setCreated(project);
  };

  if (running) {
    return (
      <Modal title="Forecast is running" onClose={onClose}>
        <div className="running-state">
          <div className="processing-orb">
            <Zap size={25} />
          </div>
          <h3>Building your forecast model</h3>
          <p>Quantelis is evaluating seasonality, trends, and external drivers.</p>
          <div className="processing-bar">
            <i style={{ width: `${progress}%` }} />
          </div>
          <span role="status" aria-live="polite">
            {progress < 100 ? `Processing ${dataset?.name ?? 'dataset'} · ${progress}%` : 'Finalising results…'}
          </span>
        </div>
      </Modal>
    );
  }

  if (created) {
    return (
      <Modal title="Forecast complete" onClose={onClose}>
        <div className="running-state">
          <div className="success-mark">
            <Check size={24} />
          </div>
          <h3>{created.name}</h3>
          <p>
            {created.variable} over {created.horizon} scored {created.confidence.toFixed(1)}% accuracy.
          </p>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onCreated?.(created);
                onClose();
              }}
            >
              View results <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New forecasting project" onClose={onClose}>
      <div className="wizard-steps">
        {STEPS.map((label, index) => (
          <div key={label} className={step === index + 1 ? 'current' : step > index + 1 ? 'done' : ''}>
            <span>{index + 1}</span>
            {label}
          </div>
        ))}
      </div>
      {step === 1 && (
        <div className="wizard-content">
          <h3>Choose your dataset</h3>
          <p>Start with a validated dataset from your workspace.</p>
          <SearchInput
            value={datasetSearch}
            onChange={setDatasetSearch}
            label="Search datasets"
            placeholder="Search datasets…"
            className="wizard-search"
          />
          <div className="choice-list">
            {visibleDatasets.map((item) => (
              <button type="button" className={`choice-row ${form.datasetId === item.id ? 'selected' : ''}`} key={item.id} onClick={() => selectDataset(item.id)} aria-pressed={form.datasetId === item.id}>
                <span className="radio-dot" />
                <span>
                  <b>{item.name}</b>
                  <small>
                    {item.rows} rows · {item.variables} variables
                  </small>
                </span>
                <ChevronRight size={16} />
              </button>
            ))}
            {visibleDatasets.length === 0 && <p className="field-error">No dataset matches “{datasetSearch}”.</p>}
          </div>
          {errors.datasetId && (
            <span className="field-error" role="alert">
              {errors.datasetId}
            </span>
          )}
          <label className="field-label" htmlFor="wizard-name">
            Project name
          </label>
          <input
            id="wizard-name"
            className="text-input wizard-input"
            value={form.name}
            placeholder="e.g. East Coast Demand Plan"
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => update('name', event.target.value)}
          />
          {errors.name && (
            <span className="field-error" role="alert">
              {errors.name}
            </span>
          )}
        </div>
      )}
      {step === 2 && (
        <div className="wizard-content">
          <h3>Configure the forecast</h3>
          <p>Set the target and horizon for this project.</p>
          <label className="field-label" htmlFor="wizard-variable">
            Forecast variable
          </label>
          <Select
            value={form.variable}
            onChange={(value) => update('variable', value)}
            options={variables.length > 0 ? variables : ['No numeric columns in this dataset']}
            label="Forecast variable"
            id="wizard-variable"
            className="wizard-select"
            aria-invalid={errors.variable ? true : undefined}
          />
          {errors.variable && (
            <span className="field-error" role="alert">
              {errors.variable}
            </span>
          )}
          <label className="field-label" htmlFor="wizard-horizon">
            Forecast horizon
          </label>
          <Select value={form.horizon} onChange={(value) => update('horizon', value)} options={HORIZONS} label="Forecast horizon" id="wizard-horizon" className="wizard-select" />
          <label className="field-label" htmlFor="wizard-confidence">
            Confidence interval
          </label>
          <Select value={form.confidence} onChange={(value) => update('confidence', value)} options={CONFIDENCE_LEVELS} label="Confidence interval" id="wizard-confidence" className="wizard-select" />
          <div className="toggle-row">
            <span>
              <b>Detect seasonality automatically</b>
              <small>Let Quantelis identify recurring patterns.</small>
            </span>
            <Toggle checked={form.seasonality} onChange={(next) => update('seasonality', next)} label="Detect seasonality automatically" />
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="wizard-content">
          <h3>Review run parameters</h3>
          <p>Your project is ready for a first forecast.</p>
          {[
            ['Dataset', dataset?.name ?? '—'],
            ['Project name', form.name.trim() || '—'],
            ['Variable', form.variable || '—'],
            ['Horizon', form.horizon],
            ['Confidence interval', form.confidence],
            ['Seasonality', form.seasonality ? 'Automatic' : 'Off'],
          ].map(([label, value]) => (
            <div className="review-row" key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
          {projects.some((project) => project.name.toLowerCase() === form.name.trim().toLowerCase()) && (
            <span className="field-error" role="alert">
              A project with this name already exists.
            </span>
          )}
        </div>
      )}
      {step === 4 && (
        <div className="wizard-content">
          <div className="success-mark">
            <Sparkles size={24} />
          </div>
          <h3>Ready to run</h3>
          <p>Your first forecast will take a few seconds in this build. You can keep working while it processes.</p>
        </div>
      )}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={step === 1 ? onClose : () => setStep(step - 1)}>
          {step === 1 ? 'Cancel' : 'Back'}
        </button>
        <button type="button" className="primary-button" onClick={goNext}>
          {step === 4 ? 'Run forecast' : 'Continue'}
          {step === 4 ? <Zap size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      {step > 1 && (
        <button type="button" className="wizard-back-link" onClick={() => setStep(1)}>
          <ChevronLeft size={14} /> Change dataset
        </button>
      )}
    </Modal>
  );
}
