import Link from "next/link";

export default function NotFound() {
  return (
    <div className="center-page auth-bg">
      <div className="wrap" style={{ textAlign: "center" }}>
        <h1>Page not found</h1>
        <p className="lead" style={{ margin: "0 auto 1.5rem" }}>
          That page doesn&apos;t exist — this is exactly the kind of dead link the old prototype had
          (login routing to a page that was never built). This one redirects you home instead.
        </p>
        <Link href="/" className="btn btn-p">Go home</Link>
      </div>
    </div>
  );
}
