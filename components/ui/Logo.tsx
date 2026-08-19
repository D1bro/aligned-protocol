export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="sb-logo">
      <div className="sb-mark">
        <svg width="30" height="27" viewBox="0 0 30 27" fill="none" aria-hidden="true">
          <path d="M15 1 L29 25 L1 25 Z" stroke="#E0B140" strokeWidth="2.2" fill="none" />
          <circle cx="15" cy="18" r="2.5" fill="#E0B140" />
        </svg>
        <span className="sb-brand">ALIGNED</span>
      </div>
      {subtitle ? <div className="sb-sub">{subtitle}</div> : null}
    </div>
  );
}
