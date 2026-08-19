export function Notice({ type, children }: { type: "err" | "ok"; children: React.ReactNode }) {
  if (!children) return null;
  return <div className={`notice notice-${type}`}>{children}</div>;
}
