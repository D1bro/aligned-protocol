import Image from "next/image";
import hero from "@/public/media/hero/dusk-mountains.jpg";

// The dusk hero behind My Space's welcome (brief, 3 Nov 2026: photography
// only in hero areas). The image was generated for The Aligned (Figma AI,
// 3 Nov 2026), so there's no third-party licence to track; Next serves it
// resized and compressed for each screen, with a blurred placeholder while it
// loads. Decorative only; the shade keeps the text readable over it.
export function DuskHero({ children }: { children: React.ReactNode }) {
  return (
    <section className="dusk-hero">
      <Image src={hero} alt="" fill priority sizes="(max-width: 768px) 100vw, 1100px" placeholder="blur" className="dusk-art" />
      <div className="dusk-shade" aria-hidden="true" />
      <div className="dusk-content">{children}</div>
    </section>
  );
}
