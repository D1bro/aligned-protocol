export default function Loading() {
  return (
    <div className="page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
      <div className="spinner" role="status" aria-label="Loading" />
    </div>
  );
}
