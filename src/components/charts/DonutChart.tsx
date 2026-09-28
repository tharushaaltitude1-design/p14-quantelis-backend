import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { STATUS_COLORS, tooltipStyle } from './chartStyle';

type Slice = { name: string; value: number };

export function DonutChart({ data, centerLabel }: { data: Slice[]; centerLabel: string }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <div className="donut-layout">
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie data={data} innerRadius={66} outerRadius={88} paddingAngle={4} dataKey="value" stroke="none">
              {data.map((entry, index) => <Cell key={entry.name} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center"><b>{total}</b><span>{centerLabel}</span></div>
      </div>
      <div className="legend-list">
        {data.map((item, index) => <div key={item.name}><span><i className={`legend-dot dot-${index}`} />{item.name}</span><b>{item.value}</b></div>)}
      </div>
    </div>
  );
}
