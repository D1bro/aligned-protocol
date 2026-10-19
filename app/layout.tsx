import type { Metadata, Viewport } from "next";
import { Sora, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE } from "@/lib/site-copy";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-sora",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Aligned", template: "%s · Aligned" },
  description: SITE.description,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#100F18",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`}>
      <body>
        {children}
        {/* Cookieless visit counts (Vercel Web Analytics); only reports once enabled in Vercel. */}
        <Analytics />
      </body>
    </html>
  );
}
