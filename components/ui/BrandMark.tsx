import Image from "next/image";
import { BRAND } from "@/lib/brand";

// The Aligned symbol at a given width; height follows the asset's ratio.
export function BrandMark({ width }: { width: number }) {
  const { src, width: w, height: h } = BRAND.symbol;
  return <Image src={src} width={width} height={Math.round((width * h) / w)} alt="" aria-hidden="true" priority />;
}
