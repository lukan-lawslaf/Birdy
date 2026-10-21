import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../lib/ThemeContext";
import { ArrowRight } from "lucide-react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260901_122529_931c22c8-8d2d-47c0-ad51-b97f56a91e42.mp4";
const POSTER_URL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4f690bd1-881a-4192-82f2-d714d34c8fb9.png";

export const SiteEnding: React.FC = () => {
  const { theme } = useTheme();
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const footerRef = useRef<HTMLElement>(null);

  // Performance optimization: Lazy-load and play the background video only when scrolled near view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVideoVisible(true);
        }
      },
      { rootMargin: "300px" }
    );

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => observer.disconnect();
  }, []);


  return (
    <footer
      ref={footerRef}
      className="site-footer relative isolate flex flex-col min-h-screen lg:min-h-[100svh] justify-between overflow-hidden overflow-wrap-break-word bg-transparent text-[var(--ink)] transition-colors duration-600 px-4 sm:px-8 lg:px-12 pt-16 pb-8 select-none"
    >
      {/* Main Content Container floating over the full-view Crane Landscape Backdrop */}
      <div className="footer-inner relative w-full max-w-7xl mx-auto flex-1 flex flex-col justify-between z-10 space-y-8">
        {/* Grid Columns in a refined translucent glassmorphic panel */}
        <div className="footer-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 items-start p-6 sm:p-10 rounded-3xl bg-[var(--panel)]/75 backdrop-blur-md border border-[var(--line)]/60 shadow-xl">
          {/* Brand Col */}
          <div className="lg:col-span-1 flex flex-col">
            <div className="flex items-center gap-3">
              {/* Botanical Seedling Brand Mark SVG from ending.txt */}
              <svg
                className="w-10 h-12 text-[var(--sage)] shrink-0"
                viewBox="0 0 96 120"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <ellipse cx="48" cy="60" rx="45" ry="57" />
                <path d="M48 88V46" strokeLinecap="round" />
                <path d="M48 58c-8-2-14-8-16-16 9 0 15 5 16 16Zm0 0c8-2 14-8 16-16-9 0-15 5-16 16Z" />
                <path d="M48 74c-9-2-15-8-17-17 10 0 16 6 17 17Zm0 0c9-2 15-8 17-17-10 0-16 6-17 17Z" />
                <path d="M48 46c-6-3-9-9-8-16 6 3 9 9 8 16Zm0 0c6-3 9-9 8-16-6 3-9 9-8 16Z" />
                <path d="M30 44c-5 1-9-1-12-5 5-2 9-1 12 5Zm36 0c5 1 9-1 12-5-5-2-9-1-12 5Z" />
              </svg>
              <div>
                <h3 className="text-2xl font-bold font-display text-[var(--ink)] tracking-tight">
                  Birdpedia
                </h3>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)]">
                  AVIAN ARCHIVE
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm text-[var(--muted)] leading-relaxed max-w-xs font-light">
              Preserving planetary biodiversity through interactive digital specimens,
              animal-borne telemetry flyways, and acoustic field bio-monitoring.
            </p>

            {/* Contacts from ending.txt */}
            <p className="text-xs text-[var(--muted)] leading-relaxed">An independent field guide built from open bird research, museum models and credited field recordings.</p>
          </div>

          {[
            { title: "Field guide", links: [["3D Feather Atlas", "/atlas"], ["Species catalogue", "/catalog"], ["Family tree", "/phylogeny"], ["Migration map", "/flyways"]] },
            { title: "Conservation", links: [["Threatened species", "/catalog?iucn=EN"], ["BirdLife International", "https://www.birdlife.org/"], ["IUCN Red List", "https://www.iucnredlist.org/"]] },
            { title: "Source archives", links: [["Xeno-canto recordings", "https://xeno-canto.org/"], ["Movebank studies", "https://www.movebank.org/"], ["eBird observations", "https://ebird.org/"], ["Wikimedia Commons", "https://commons.wikimedia.org/"]] },
          ].map((group) => (
            <nav key={group.title} className="flex flex-col" aria-label={group.title}>
              <h4 className="text-xs font-semibold text-[var(--ink)] mb-4">{group.title}</h4>
              <ul className="space-y-2.5 text-xs text-[var(--muted)]">
                {group.links.map(([label, url]) => <li key={label}>
                  {url.startsWith("/") ? <Link to={url} className="hover:text-[var(--sage)] hover:underline">{label}</Link> : <a href={url} target="_blank" rel="noreferrer" className="hover:text-[var(--sage)] hover:underline">{label}</a>}
                </li>)}
              </ul>
            </nav>
          ))}

          {/* Col 4: The Avian Gazette (Newsletter) */}
          <div className="flex flex-col">
            <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--ink)] mb-4">
              The Avian Gazette
            </h4>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-4 font-light">
              Seasonal migration stories and new specimens, coming in a future edition.
            </p>

            <p className="text-xs text-[var(--muted)] leading-relaxed mb-3">Newsletter sign-ups are not open yet.</p>
            <Link to="/catalog" className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--sage)] hover:underline">Explore the bird catalogue <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>

        {/* 3. Bottom Bar: Socials + Legal Links in a frosted glass bar */}
        <div className="px-6 py-4 rounded-2xl bg-[var(--panel)]/75 backdrop-blur-md border border-[var(--line)]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)] shadow-md">
          <span className="text-xs text-[var(--muted)]">Birdpedia · The living avian archive</span>

          <nav className="flex flex-wrap items-center gap-4 sm:gap-6" aria-label="Legal">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("birdpedia:replay-intro"))}
              className="hover:text-[var(--sage)] transition-colors cursor-pointer flex items-center gap-1 text-[var(--ink)] font-medium"
            >
              <span>↺ Replay Cinematic Intro</span>
            </button>


            <a href="https://doi.org/10.1111/ele.13898" target="_blank" rel="noreferrer" className="hover:underline">AVONET data source</a>

          </nav>
        </div>
      </div>
    </footer>
  );
};
