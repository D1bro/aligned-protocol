// A 1–10 track: where an area is now, and the next step up.
export function ScoreTrack({ score, target }: { score: number; target: number }) {
  return (
    <div className="clear-track" role="img" aria-label={`Now ${score} out of 10; next step ${target}`}>
      <div className="clear-track-bar">
        <span className="clear-track-fill" style={{ width: `${score * 10}%` }} />
        <span className="clear-track-next" style={{ left: `${target * 10}%` }} />
      </div>
      <div className="clear-track-labels">
        <span>Now <b>{score}</b>/10</span>
        <span className="next">Next step <b>{target}</b></span>
      </div>
    </div>
  );
}
