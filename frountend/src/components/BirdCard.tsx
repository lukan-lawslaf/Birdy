import React, { useRef, useState } from "react";
import { BirdSpecies } from "../data/mockBirds";
import { birdAudio } from "../lib/birdAudio";
import { Sparkles, ArrowRight, Volume2 } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

interface BirdCardProps {
  bird: BirdSpecies;
  onSelect: (bird: BirdSpecies) => void;
}

export const BirdCard: React.FC<BirdCardProps> = ({ bird, onSelect }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

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

  const handlePlayCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlayingAudio(true);
    birdAudio.play(bird.id);
    setTimeout(() => setIsPlayingAudio(false), 1400);
  };

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
        className="group relative flex flex-col items-center justify-between p-6 sm:p-7 rounded-2xl bg-[var(--panel)] border border-[var(--line)] hover:border-[var(--sage)] shadow-[0_8px_25px_rgba(var(--shadow),0.12)] hover:shadow-[0_20px_45px_rgba(var(--shadow),0.24)] transition-colors duration-400 text-center overflow-hidden h-full cursor-pointer select-none"
        onClick={() => onSelect(bird)}
      >
        {/* Organic Light Glaze following mouse tilt */}
        <motion.div
          style={{
            background: `radial-gradient(circle at ${sheenX} ${sheenY}, var(--sage-tint), transparent 60%)`,
          }}
          className="absolute inset-0 opacity-0 group-hover:opacity-40 transition-opacity duration-300 pointer-events-none"
        />

        {/* Top Badges & Audio Trigger */}
        <div
          style={{ transform: "translateZ(25px)" }}
          className="w-full flex items-center justify-between z-10 mb-2"
        >
          <span className="text-[10.5px] font-mono tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[var(--chip)] text-[var(--muted)] border border-[var(--line)]">
            {bird.order}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Live Vocalization Chirp Button */}
            <button
              onClick={handlePlayCall}
              aria-label={`Listen to vocalization of ${bird.name}`}
              className={`p-1.5 rounded-full transition-all border ${
                isPlayingAudio
                  ? "bg-[var(--sage)] text-[var(--sage-ink)] border-[var(--sage)] scale-110"
                  : "bg-[var(--chip)] text-[var(--muted)] hover:text-[var(--ink)] border-[var(--line)] hover:border-[var(--sage)]"
              }`}
              title="Listen to synthesized vocalization"
            >
              <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? "animate-pulse" : ""}`} />
            </button>

            {bird.has3dModel && (
              <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[var(--sage-tint)] text-[var(--sage)] border border-[var(--sage)]/30">
                <Sparkles className="w-2.5 h-2.5" />
                3D
              </span>
            )}
          </div>
        </div>

        {/* Bird Cutout Stage (floating in 3D depth) */}
        <div
          style={{ transform: "translateZ(40px)" }}
          className="relative w-full h-48 sm:h-52 my-3 flex items-center justify-center z-10"
        >
          {/* Natural ground shadow beneath the bird */}
          <div className="absolute bottom-2 w-32 h-6 rounded-full bg-[rgba(var(--shadow),0.22)] blur-md group-hover:scale-110 transition-transform duration-500" />

          <img
            src={bird.imageUrl}
            alt={`Photograph of ${bird.name} (${bird.commonName})`}
            className="relative max-h-full max-w-[85%] object-contain drop-shadow-[0_12px_22px_rgba(var(--shadow),0.4)] group-hover:scale-106 group-hover:-translate-y-1 transition-all duration-400 ease-out"
            loading="lazy"
            width="260"
            height="200"
          />
        </div>

        {/* Bird Name & Sublabel */}
        <div
          style={{ transform: "translateZ(28px)" }}
          className="w-full z-10 mb-5 text-center"
        >
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--ink)] font-display transition-colors duration-200">
            {bird.name}
          </h3>
          <p className="text-xs sm:text-sm text-[var(--muted)] font-medium mt-1 truncate">
            {bird.sublabel}
          </p>
        </div>

        {/* Pill Button matching birds p.txt natural sage palette */}
        <div style={{ transform: "translateZ(35px)" }} className="z-10 w-full sm:w-auto">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(bird);
            }}
            aria-label={`Learn more about ${bird.name}`}
            className="w-full sm:w-auto min-h-[44px] px-8 py-2 rounded-full text-xs sm:text-sm font-semibold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 shadow-[0_4px_14px_rgba(var(--shadow),0.18)] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer focus-visible:ring-2 focus-visible:ring-[var(--sage)] focus-visible:ring-offset-2"
          >
            <span>Learn More</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>
      </motion.article>
    </div>
  );
};
