import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../lib/ThemeContext";
import { Mail, Phone, MapPin, ArrowRight, Check } from "lucide-react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260901_122529_931c22c8-8d2d-47c0-ad51-b97f56a91e42.mp4";
const POSTER_URL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4f690bd1-881a-4192-82f2-d714d34c8fb9.png";

export const SiteEnding: React.FC = () => {
  const { theme } = useTheme();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
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

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmail("");
      setSubscribed(false);
    }, 3500);
  };

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
              Preserving planetary biodiversity through millimeter-accurate digital specimens,
              animal-borne telemetry flyways, and acoustic field bio-monitoring.
            </p>

            {/* Contacts from ending.txt */}
            <ul className="mt-6 space-y-2 text-xs text-[var(--muted)] font-medium">
              <li className="flex items-center gap-2.5 hover:text-[var(--ink)] transition-colors">
                <Mail className="w-4 h-4 text-[var(--sage)] shrink-0" />
                <a href="mailto:curators@birdpedia.org" className="hover:underline">
                  curators@birdpedia.org
                </a>
              </li>
              <li className="flex items-center gap-2.5 hover:text-[var(--ink)] transition-colors">
                <Phone className="w-4 h-4 text-[var(--sage)] shrink-0" />
                <a href="tel:+18002473285" className="hover:underline">
                  +1 (800) 247-3285
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-[var(--sage)] shrink-0" />
                <span>International Avian Archive · Geneva & Cornell</span>
              </li>
            </ul>
          </div>

          {/* Col 1: Field Guide */}
          <nav className="flex flex-col" aria-label="Field Guide Navigation">
            <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--ink)] mb-4">
              Field Guide
            </h4>
            <ul className="space-y-2.5 text-xs text-[var(--muted)]">
              <li>
                <Link to="/atlas" className="hover:text-[var(--sage)] transition-colors hover:translate-x-1 inline-block">
                  3D Feather Atlas
                </Link>
              </li>
              <li>
                <Link to="/catalog" className="hover:text-[var(--sage)] transition-colors hover:translate-x-1 inline-block">
                  Species Catalog
                </Link>
              </li>
              <li>
                <a href="#birdpedia-showcase" className="hover:text-[var(--sage)] transition-colors hover:translate-x-1 inline-block">
                  Curated Plates
                </a>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Acoustic Library
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Morphometrics Grid
                </span>
              </li>
            </ul>
          </nav>

          {/* Col 2: Conservation */}
          <nav className="flex flex-col" aria-label="Conservation Navigation">
            <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--ink)] mb-4">
              Conservation
            </h4>
            <ul className="space-y-2.5 text-xs text-[var(--muted)]">
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  IUCN Red List Status
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Important Bird Areas
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Movebank Telemetry
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  eBird Observation Data
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Migratory Corridors
                </span>
              </li>
            </ul>
          </nav>

          {/* Col 3: Curatorial */}
          <nav className="flex flex-col" aria-label="Curatorial Navigation">
            <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--ink)] mb-4">
              Curatorial
            </h4>
            <ul className="space-y-2.5 text-xs text-[var(--muted)]">
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  About Birdpedia
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Specimen Digitization
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Ornithological Ethics
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Taxonomic Backbone
                </span>
              </li>
              <li>
                <span className="hover:text-[var(--sage)] transition-colors cursor-pointer">
                  Where’s My Observation?
                </span>
              </li>
            </ul>
          </nav>

          {/* Col 4: The Avian Gazette (Newsletter) */}
          <div className="flex flex-col">
            <h4 className="text-xs font-mono uppercase font-bold tracking-wider text-[var(--ink)] mb-4">
              The Avian Gazette
            </h4>
            <p className="text-xs text-[var(--muted)] leading-relaxed mb-4 font-light">
              Subscribe for seasonal migration dispatches, ringing returns, and new 3D specimen additions.
            </p>

            <form onSubmit={handleSubscribe} className="flex flex-col gap-2">
              <label htmlFor="gazette-email" className="sr-only">
                Email address
              </label>
              <div className="flex items-center w-full max-w-sm rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--panel)]/90 focus-within:border-[var(--sage)] transition-colors shadow-sm">
                <input
                  id="gazette-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your field email"
                  className="flex-1 min-w-0 bg-transparent px-3.5 py-2.5 text-xs text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Subscribe to Avian Gazette"
                  className="px-4 py-2.5 bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 transition-opacity flex items-center justify-center shrink-0 cursor-pointer"
                >
                  {subscribed ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
              {subscribed && (
                <span className="text-[11px] text-[var(--sage)] font-semibold mt-1">
                  ✓ Field subscription active. Welcome to Birdpedia.
                </span>
              )}
            </form>
          </div>
        </div>

        {/* 3. Bottom Bar: Socials + Legal Links in a frosted glass bar */}
        <div className="px-6 py-4 rounded-2xl bg-[var(--panel)]/75 backdrop-blur-md border border-[var(--line)]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--muted)] shadow-md">
          <div className="flex items-center gap-5">
            <a
              href="#"
              className="hover:text-[var(--ink)] hover:-translate-y-0.5 transition-all"
              aria-label="X (Twitter)"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="#"
              className="hover:text-[var(--ink)] hover:-translate-y-0.5 transition-all"
              aria-label="Instagram"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href="#"
              className="hover:text-[var(--ink)] hover:-translate-y-0.5 transition-all"
              aria-label="YouTube"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
          </div>

          <nav className="flex flex-wrap items-center gap-4 sm:gap-6" aria-label="Legal">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("birdpedia:replay-intro"))}
              className="hover:text-[var(--sage)] transition-colors cursor-pointer flex items-center gap-1 text-[var(--ink)] font-medium"
            >
              <span>↺ Replay Cinematic Intro</span>
            </button>
            <a href="#" className="hover:underline">Privacy Notice</a>
            <a href="#" className="hover:underline">Research Ethics</a>
            <a href="#" className="hover:underline">CC BY 4.0 Data Attribution</a>
            <a href="#" className="hover:underline">Cookie Policy</a>
          </nav>
        </div>
      </div>
    </footer>
  );
};
