import { BrandMark } from "@/components/ui/BrandMark";

export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="sb-logo">
      <div className="sb-mark">
        <BrandMark width={30} />
        <span className="sb-brand">ALIGNED</span>
      </div>
      {subtitle ? <div className="sb-sub">{subtitle}</div> : null}
    </div>
  );
}
