import React, { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap, ScrollTrigger } from "../lib/gsap";
import { Feather, Navigation2, ArrowRight, ShieldCheck, Activity } from "lucide-react";

export const GsapSpecimenStory: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textBlockRef = useRef<HTMLDivElement>(null);
  const cardStackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GSAP Context ensures clean disposal on React 19 re-renders
    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // 1. Scrubbing Word-by-Word Text Illumination
        const words = textBlockRef.current?.querySelectorAll(".scrub-word");
        if (words && words.length > 0) {
          gsap.fromTo(
            words,
            { opacity: 0.18, y: 4 },
            {
              opacity: 1,
              y: 0,
              stagger: 0.08,
              ease: "power2.out",
              scrollTrigger: {
                trigger: textBlockRef.current,
                start: "top 78%",
                end: "bottom 45%",
                scrub: 0.7,
              },
            }
          );
        }

        // 2. Specimen Cards Stagger & Depth Reveal
        const cards = cardStackRef.current?.querySelectorAll(".specimen-card");
        if (cards && cards.length > 0) {
          gsap.fromTo(
            cards,
            { y: 50, opacity: 0, scale: 0.94 },
            {
              y: 0,
              opacity: 1,
              scale: 1,
              stagger: 0.15,
              ease: "power3.out",
              scrollTrigger: {
                trigger: cardStackRef.current,
                start: "top 82%",
                end: "top 45%",
                scrub: false,
              },
            }
          );
        }
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  const storyParagraph =
    "Across equatorial canopies and sub-polar flyways, eleven thousand bird species choreograph planetary biodiversity. Birdpedia unites interactive 3D bird models, 742,000 animal-borne GPS fixes, and acoustic sonograms into an enduring scientific sanctuary.";

  return (
    <section
      ref={containerRef}
      className="relative z-10 py-24 sm:py-32 px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto overflow-hidden select-none"
    >
      {/* Editorial Headline with Double-Bezel Header */}
      <div className="max-w-4xl mb-14 text-left">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-mono tracking-widest uppercase text-[var(--sage)] bg-[rgba(var(--sage-rgb),0.09)] border border-[rgba(var(--sage-rgb),0.22)] mb-5">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>Curatorial Monograph · Vol. IV</span>
        </div>

        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[var(--ink)] font-display tracking-tight leading-[1.08]">
          The Living Architecture of{" "}
          <span className="italic text-[var(--sage)] font-display">Avian Flight</span>
        </h2>
      </div>

      {/* Grid: Scrubbing Editorial Statement on Left + Double-Bezel Cards on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        {/* Left: Scrubbed Text Reveal */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
          <div
            ref={textBlockRef}
            className="text-xl sm:text-2xl lg:text-3xl font-display text-[var(--ink)] leading-[1.4] font-medium"
          >
            {storyParagraph.split(" ").map((word, idx) => (
              <span
                key={idx}
                className="scrub-word inline-block mr-[0.28em] transition-opacity duration-300"
              >
                {word}
              </span>
            ))}
          </div>

          {/* Curatorial Attestation Pill */}
          <div className="p-1.5 rounded-[1.75rem] bg-[var(--line)]/30 border border-[var(--line)]/70 shadow-sm max-w-md">
            <div className="px-5 py-4 rounded-[calc(1.75rem-0.375rem)] bg-[var(--panel)]/95 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[rgba(var(--sage-rgb),0.12)] border border-[var(--sage)]/25 flex items-center justify-center text-[var(--sage)]">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--ink)] font-display">AVONET & Movebank Curated</div>
                  <div className="text-[10px] text-[var(--muted)] font-mono">Peer-Reviewed Morphometrics</div>
                </div>
              </div>

              <Link
                to="/atlas"
                className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-[var(--sage)] hover:text-[var(--ink)] transition-colors"
              >
                <span>3D Stage</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Double-Bezel Interactive Specimen Showcase */}
        <div ref={cardStackRef} className="lg:col-span-6 space-y-5">
          {/* Card 1: Common Kingfisher Double-Bezel */}
          <div className="specimen-card group p-1.5 rounded-[2rem] bg-[var(--line)]/40 border border-[var(--line)] hover:border-[var(--sage)]/60 transition-all duration-500 shadow-lg">
            <div className="p-6 sm:p-7 rounded-[calc(2rem-0.375rem)] bg-[var(--panel)]/95 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-left flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--sage)] font-semibold">
                    Alcedinidae · Coraciiformes
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] font-mono">
                    3D Model Ready
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--ink)]">
                  Common Kingfisher
                </h3>
                <p className="text-xs font-mono text-[var(--muted)] italic mt-0.5 mb-3">
                  Alcedo atthis
                </p>
                <p className="text-xs text-[var(--muted)] leading-relaxed font-light max-w-sm">
                  Possesses aerodynamically evolved dagger-like rhamphotheca for near-zero cavitation diving into riparian waterways.
                </p>

                <div className="mt-4 flex items-center gap-4 text-[11px] font-mono text-[var(--muted)]">
                  <span>Mass: <strong className="text-[var(--ink)]">34g</strong></span>
                  <span>·</span>
                  <span>Wing: <strong className="text-[var(--ink)]">76mm</strong></span>
                  <span>·</span>
                  <span>Beak: <strong className="text-[var(--ink)]">38mm</strong></span>
                </div>
              </div>

              {/* Specimen Thumbnail with GSAP Hover Scale */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[rgba(var(--sage-rgb),0.06)] border border-[var(--line)] flex items-center justify-center p-2 shrink-0 group-hover:scale-105 transition-transform duration-500">
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_f9e3e60d-acdc-4925-b393-c4ce14b28711.png"
                  alt="Common Kingfisher Specimen"
                  className="w-full h-full object-contain drop-shadow-md"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Eurasian Hoopoe Double-Bezel */}
          <div className="specimen-card group p-1.5 rounded-[2rem] bg-[var(--line)]/40 border border-[var(--line)] hover:border-[var(--sage)]/60 transition-all duration-500 shadow-lg">
            <div className="p-6 sm:p-7 rounded-[calc(2rem-0.375rem)] bg-[var(--panel)]/95 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-left flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--sage)] font-semibold">
                    Upupidae · Bucerotiformes
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] font-mono">
                    3D Model Ready
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display text-[var(--ink)]">
                  Eurasian Hoopoe
                </h3>
                <p className="text-xs font-mono text-[var(--muted)] italic mt-0.5 mb-3">
                  Upupa epops
                </p>
                <p className="text-xs text-[var(--muted)] leading-relaxed font-light max-w-sm">
                  Distinguished by an erectile crest crown tipped with black and dramatic undulating flight dynamics resembling giant butterflies.
                </p>

                <div className="mt-4 flex items-center gap-4 text-[11px] font-mono text-[var(--muted)]">
                  <span>Mass: <strong className="text-[var(--ink)]">68g</strong></span>
                  <span>·</span>
                  <span>Wing: <strong className="text-[var(--ink)]">148mm</strong></span>
                  <span>·</span>
                  <span>Crest: <strong className="text-[var(--ink)]">52mm</strong></span>
                </div>
              </div>

              {/* Specimen Thumbnail with GSAP Hover Scale */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[rgba(var(--sage-rgb),0.06)] border border-[var(--line)] flex items-center justify-center p-2 shrink-0 group-hover:scale-105 transition-transform duration-500">
                <img
                  src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20261004_073256_21ed095c-d038-4ab5-87b7-b44e527ec449.png"
                  alt="Eurasian Hoopoe Specimen"
                  className="w-full h-full object-contain drop-shadow-md"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
