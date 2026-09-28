type RankingItem = { id: string; name: string; sub: string; score: number };

export function RankingBars({ items }: { items: RankingItem[] }) {
  return (
    <div className="ranking-list">
      {items.map((item, index) => (
        <div className="ranking-row" key={item.id}>
          <span className="rank-number">{String(index + 1).padStart(2, '0')}</span>
          <span className="rank-name"><b>{item.name}</b><small>{item.sub}</small></span>
          <div className="rank-bar"><i style={{ width: `${item.score}%` }} /></div>
          <b className="score">{item.score}</b>
        </div>
      ))}
    </div>
  );
}
