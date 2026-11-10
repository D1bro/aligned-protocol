// A 1–10 track: where an area is now, and (once a Next Step is set) the
// score they think it could take them to.
export function ScoreTrack({ score, target }: { score: number; target: number | null }) {
  return (
    <div className="clear-track" role="img" aria-label={`Now ${score} out of 10${target ? `; aiming for ${target}` : ""}`}>
      <div className="clear-track-bar">
        <span className="clear-track-fill" style={{ width: `${score * 10}%` }} />
        {target ? <span className="clear-track-next" style={{ left: `${target * 10}%` }} /> : null}
      </div>
      <div className="clear-track-labels">
        <span>Now <b>{score}</b>/10</span>
        {target ? <span className="next">Aiming for <b>{target}</b></span> : null}
      </div>
    </div>
  );
}
