export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="page">
      <div className="eyebrow"><span className="eydot" /> {title}</div>
      <h1>Not built yet — next milestone</h1>
      <p className="lead">{blurb}</p>
      <div className="incomplete-box" style={{ maxWidth: 520 }}>
        <p className="body-t">
          The Audit flow (this milestone) is real and wired up end to end. {title} is scoped for the next
          build pass, using the same design system and the schema already in place for it.
        </p>
      </div>
    </div>
  );
}
