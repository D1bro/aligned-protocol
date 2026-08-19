"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="center-page auth-bg">
      <div className="wrap" style={{ textAlign: "center" }}>
        <h1>Something went wrong</h1>
        <p className="lead" style={{ margin: "0 auto 1.5rem" }}>
          That's on us, not something you did. Try again, or come back in a moment.
        </p>
        <button className="btn btn-p" onClick={() => reset()}>Try again</button>
      </div>
    </div>
  );
}
