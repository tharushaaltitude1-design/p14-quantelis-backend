export function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status.toLowerCase().replace(' ', '-')}`}><i />{status}</span>;
}
