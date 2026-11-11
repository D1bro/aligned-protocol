"use client";

import { createContext, useContext } from "react";
import { filmSource, type FilmSource } from "@/lib/films";

// The film links pasted in Console → Films, given to every page from the
// root layout, so any player can find its slot's link.
const FilmLinksContext = createContext<Record<string, string>>({});

export function FilmLinksProvider({ links, children }: { links: Record<string, string>; children: React.ReactNode }) {
  return <FilmLinksContext.Provider value={links}>{children}</FilmLinksContext.Provider>;
}

// A clip's source: its own file if it has one, otherwise its slot's link.
export function useFilmSource(clip: { id: string; src: string | null } | null | undefined): FilmSource | null {
  const links = useContext(FilmLinksContext);
  if (!clip) return null;
  if (clip.src) return { kind: "file", src: clip.src };
  return filmSource(links[clip.id]);
}
