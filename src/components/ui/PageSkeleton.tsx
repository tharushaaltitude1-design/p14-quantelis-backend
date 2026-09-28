export function PageSkeleton() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="Loading page">
      <span className="skeleton" style={{ height: 44 }} />
      <span className="skeleton" style={{ height: 180 }} />
      <span className="skeleton" style={{ height: 260 }} />
    </div>
  );
}
