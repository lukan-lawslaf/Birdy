import { BirdAudioButton } from "./BirdAudioButton";
import { conservationLabel } from "../lib/conservation";
import React, { useRef, useState } from "react";
import { BirdSpecies } from "../data/mockBirds";
import { Sparkles, ArrowRight, Volume2, Radio, Weight, Feather, Compass } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

interface BirdCardProps {
  bird: BirdSpecies;
  onSelect: (bird: BirdSpecies) => void;
}

export const BirdCard: React.FC<BirdCardProps> = ({ bird, onSelect }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D Parallax & Tilt physics (inspired by 21st.dev 3D interactive gallery)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 220, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 220, damping: 20 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["9deg", "-9deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-9deg", "9deg"]);

  // Dynamic light sheen following mouse position
  const sheenX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const sheenY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / rect.width - 0.5;
    const yPct = mouseY / rect.height - 0.5;

    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };


  const [imageFailed, setImageFailed] = useState(false);

  // Determine IUCN subtle badge color scheme (natural botanical tones, no loud neons)
  const isVulnerableOrAbove = bird.conservation?.threatened || bird.iucnCategory === "VU" || bird.iucnCategory === "EN" || bird.iucnCategory === "CR";

  return (
    <div
      style={{ perspective: "1000px" }}
      className="w-full h-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.article
        ref={cardRef}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        initial={{ opacity: 0, y: 25 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        className="group relative flex flex-col items-center justify-between p-6 sm:p-7 rounded-2xl liquid-glass liquid-bevel hover:border-[var(--sage)] shadow-[0_12px_32px_rgba(var(--shadow),0.14)] hover:shadow-[0_24px_55px_rgba(var(--shadow),0.26)] transition-all duration-400 text-center overflow-hidden h-full cursor-pointer select-none"
        onClick={() => onSelect(bird)}
      >
        {/* liquidGL Dynamic Specular Refraction Sheen following mouse tilt */}
        <motion.div
          style={{
            background: `radial-gradient(circle at ${sheenX} ${sheenY}, rgba(var(--glass-specular), 0.32) 0%, rgba(var(--sage-rgb), 0.14) 28%, transparent 65%)`,
          }}
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-1"
        />

        {/* Top Badges & Audio Trigger */}
        <div
          style={{ transform: "translateZ(25px)" }}
          className="w-full flex items-center justify-between z-10 mb-2 gap-2"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Taxonomic Order Pill */}
            <span className="text-[10px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full liquid-glass-capsule text-[var(--muted)] border border-[rgba(var(--line-rgb),0.6)]">
              {bird.order}
            </span>

            {/* IUCN Red List Status Dot Pill */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                isVulnerableOrAbove
                  ? "bg-[#b28236]/15 text-[#c4923f] border-[#b28236]/30 shadow-xs"
                  : "bg-[var(--sage-tint)]/80 text-[var(--sage)] border-[var(--sage)]/25 shadow-xs"
              }`}
              title={`IUCN Status: ${bird.conservation?.rlLabel || bird.iucnLabel}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isVulnerableOrAbove ? "bg-[#c4923f]" : "bg-[var(--sage)]"
                }`}
              />
              {conservationLabel(bird.conservation?.rlCategory || bird.iucnCategory)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Movebank GPS Telemetry Indicator */}
            {bird.telemetry?.hasTracking && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[var(--muted)] px-2 py-0.5 rounded-full liquid-glass-capsule border border-[rgba(var(--line-rgb),0.6)]"
                title={`${bird.telemetry.points.toLocaleString()} GPS telemetry points in Movebank`}
              >
                <Radio className="w-2.5 h-2.5 text-[var(--sage)] animate-pulse" />
                <span>GPS</span>
              </span>
            )}

            {/* Synthesized Vocalization Audio Chirp Button */}
            <BirdAudioButton scientificName={bird.scientificName} name={bird.name} compact />

            {/* 3D Anatomical Specimen Pill */}
            {bird.has3dModel && (
              <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[var(--sage-tint)]/90 text-[var(--sage)] border border-[var(--sage)]/30 shadow-xs">
                <Sparkles className="w-2.5 h-2.5" />
                3D
              </span>
            )}
          </div>
        </div>

        {/* Bird Cutout Stage (floating in 3D depth) */}
        <div
          style={{ transform: "translateZ(40px)" }}
          className="relative w-full h-44 sm:h-48 my-2 flex items-center justify-center z-10"
        >
          {/* Natural ground shadow beneath the bird */}
          <div className="absolute bottom-2 w-32 h-6 rounded-full bg-[rgba(var(--shadow),0.22)] blur-md group-hover:scale-110 transition-transform duration-500" />

          {bird.imageUrl && !imageFailed && (
            <img
              src={bird.imageUrl}
              alt={`Photograph of ${bird.name} (${bird.commonName})`}
              onError={() => setImageFailed(true)}
              className="relative max-h-full max-w-[85%] object-contain drop-shadow-[0_12px_22px_rgba(var(--shadow),0.4)] group-hover:scale-106 group-hover:-translate-y-1 transition-all duration-400 ease-out"
              loading="lazy"
              width="260"
              height="200"
            />
          )}
          {(imageFailed || !bird.imageUrl) && (
            <div className="relative flex flex-col items-center justify-center gap-2 text-[var(--muted)]">
              <Feather className="w-14 h-14 text-[var(--sage)]/40" strokeWidth={1} />
              <span className="text-[10px] font-mono uppercase tracking-wider">
                No picture held
              </span>
            </div>
          )}
        </div>

        {/* Bird Title & Taxonomy Sublabel */}
        <div
          style={{ transform: "translateZ(28px)" }}
          className="w-full z-10 mb-3 text-center"
        >
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)] font-display transition-colors duration-200">
            {bird.name}
          </h3>
          <p className="text-xs sm:text-sm text-[var(--muted)] font-medium mt-0.5 truncate">
            {bird.sublabel}
          </p>
        </div>

        {/* Clean Visual Telemetry Bar (AVONET & Ecology Summary) - Liquid Glass Panel */}
        <div
          style={{ transform: "translateZ(30px)" }}
          className="w-full grid grid-cols-3 gap-1.5 py-2 px-1 mb-4 rounded-xl liquid-glass-capsule border border-[rgba(var(--line-rgb),0.65)] text-center z-10"
        >
          <div className="flex flex-col items-center justify-center py-0.5">
            <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
              <Weight className="w-2.5 h-2.5 text-[var(--sage)]" />
              <span>Mass</span>
            </span>
            <span className="text-[11px] font-bold text-[var(--ink)] mt-0.5">
              {bird.morphometrics?.massFormatted || bird.massG}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-0.5 border-x border-[rgba(var(--line-rgb),0.6)]">
            <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
              <Feather className="w-2.5 h-2.5 text-[var(--sage)]" />
              <span>Wings</span>
            </span>
            <span className="text-[11px] font-bold text-[var(--ink)] mt-0.5">
              {bird.wingspanCm}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center py-0.5">
            <span className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
              <Compass className="w-2.5 h-2.5 text-[var(--sage)]" />
              <span>Niche</span>
            </span>
            <span
              className="text-[11px] font-bold text-[var(--ink)] mt-0.5 truncate max-w-[85px]"
              title={bird.ecology?.trophicNiche || bird.diet}
            >
              {bird.ecology?.trophicNiche || bird.diet.split(",")[0]}
            </span>
          </div>
        </div>

        {/* Pill Button matching birds p.txt natural sage palette */}
        <div style={{ transform: "translateZ(35px)" }} className="z-10 w-full sm:w-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(bird);
            }}
            aria-label={`Explore database profile for ${bird.name}`}
            className="w-full sm:w-auto min-h-[42px] px-8 py-2 rounded-full text-xs sm:text-sm font-semibold liquid-pill-btn text-[var(--sage-ink)] shadow-md transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--sage)] focus-visible:ring-offset-2"
          >
            <span>Learn More</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </motion.article>
    </div>
  );
};
