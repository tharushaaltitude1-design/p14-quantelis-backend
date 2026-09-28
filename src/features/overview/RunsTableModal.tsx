import { Download } from 'lucide-react';
import { runData } from '@/data/mock';
import { Modal } from '@/components/ui/Modal';
import { downloadCsv } from '@/lib/csv';

const total = runData.reduce((sum, point) => sum + point.runs, 0);

/** Table view of the runs-over-time chart, reachable from the chart's options menu. */
export function RunsTableModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Forecast runs over time" onClose={onClose}>
      <p className="modal-intro">{total} runs recorded across {runData.length} months.</p>
      <div className="table-wrap modal-table">
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th>Runs</th>
              <th>Share</th>
            </tr>
          </thead>
          <tbody>
            {runData.map((point) => (
              <tr key={point.month}>
                <td>{point.month}</td>
                <td className="tabular">{point.runs}</td>
                <td className="tabular">{Math.round((point.runs / total) * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="primary-button" onClick={() => downloadCsv('forecast-runs.csv', ['Month', 'Runs'], runData.map((point) => [point.month, point.runs]))}>
          <Download size={16} /> Download CSV
        </button>
      </div>
    </Modal>
  );
}
