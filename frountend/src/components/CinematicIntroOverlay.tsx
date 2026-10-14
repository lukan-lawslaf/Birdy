import React, { useState, useEffect, useRef } from "react";
import { KingfisherLoader } from "./KingfisherLoader";

type IntroPhase = "init" | "intro" | "takeoff" | "loader" | "revealing" | "hidden";

interface CinematicIntroOverlayProps {
  onComplete?: () => void;
  forcePlay?: boolean;
}

const STORAGE_KEY = "birdpedia_intro_seen";
const INTRO_VIDEO_SRC = "/intro/birdpedia_intro.mp4";
const TAKEOFF_VIDEO_SRC = "/intro/birdpedia_takeoff.mp4";

export const CinematicIntroOverlay: React.FC<CinematicIntroOverlayProps> = ({
  onComplete,
  forcePlay = false,
}) => {
  const [phase, setPhase] = useState<IntroPhase>("init");
  const [isAppReady, setIsAppReady] = useState(false);
  const [loaderStartTime, setLoaderStartTime] = useState<number | null>(null);

  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const transitionHandledRef = useRef(false);
  const takeoffEndedRef = useRef(false);

  // 1. Initial Session & Accessibility Check
  useEffect(() => {
    // Check if user already saw intro in this browser session
    const hasSeenIntro = sessionStorage.getItem(STORAGE_KEY) === "true";
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!forcePlay && (hasSeenIntro || prefersReducedMotion)) {
      setPhase("hidden");
      onComplete?.();
      return;
    }

    // Begin cinematic intro phase
    setPhase("intro");
  }, [forcePlay, onComplete]);

  // Support manual replay triggers (e.g. from footer or navbar)
  useEffect(() => {
    const handleReplay = () => {
      sessionStorage.removeItem(STORAGE_KEY);
      transitionHandledRef.current = false;
      takeoffEndedRef.current = false;
      setPhase("intro");
      const v1 = video1Ref.current;
      if (v1) {
        v1.currentTime = 0;
        v1.play().catch(console.warn);
      }
      const v2 = video2Ref.current;
      if (v2) {
        v2.currentTime = 0;
      }
    };

    window.addEventListener("birdpedia:replay-intro", handleReplay);
    return () => window.removeEventListener("birdpedia:replay-intro", handleReplay);
  }, []);

  // 2. Track Document & App Readiness in background
  useEffect(() => {
    const handleReady = () => {
      // Also wait for document fonts to be ready
      if (document.fonts) {
        document.fonts.ready.then(() => setIsAppReady(true)).catch(() => setIsAppReady(true));
      } else {
        setIsAppReady(true);
      }
    };

    if (document.readyState === "complete") {
      handleReady();
    } else {
      window.addEventListener("load", handleReady);
      return () => window.removeEventListener("load", handleReady);
    }
  }, []);

  // 3. Preload & Prepare Video 2 while Video 1 plays
  useEffect(() => {
    if (phase === "intro") {
      const v2 = video2Ref.current;
      if (v2) {
        v2.preload = "auto";
        v2.load();
        v2.currentTime = 0;
      }

      const v1 = video1Ref.current;
      if (v1) {
        v1.play().catch((err) => {
          console.warn("[Birdpedia Intro] Video 1 autoplay was prevented:", err);
          // Graceful fallback to SVG loader instead of leaving user stuck
          setPhase("loader");
        });
      }
    }
  }, [phase]);

  // 4. Keyboard Skip (Escape key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skipIntro();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const skipIntro = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setPhase("revealing");
    setTimeout(() => {
      setPhase("hidden");
      onComplete?.();
    }, 800);
  };

  // 5. Video 1 Playback Handlers: Trigger seamless cross-cut to Video 2
  const handleVideo1TimeUpdate = () => {
    const v1 = video1Ref.current;
    const v2 = video2Ref.current;
    if (!v1 || !v2 || transitionHandledRef.current) return;

    // When Video 1 has <= 0.1s remaining, trigger Video 2
    if (v1.duration && v1.currentTime >= v1.duration - 0.1) {
      triggerTakeoff();
    }
  };

  const handleVideo1Ended = () => {
    if (!transitionHandledRef.current) {
      triggerTakeoff();
    }
  };

  const triggerTakeoff = () => {
    transitionHandledRef.current = true;
    const v2 = video2Ref.current;
    if (v2) {
      v2.play().catch((err) => {
        console.warn("[Birdpedia Intro] Video 2 play error:", err);
        setPhase("loader");
      });
    }
    setPhase("takeoff");
  };

  // 6. Video 2 Playback Handlers: Transition into SVG loader as scene turns white
  const handleVideo2TimeUpdate = () => {
    const v2 = video2Ref.current;
    if (!v2 || takeoffEndedRef.current) return;

    // Video 2 is ~5.9s. The kingfisher flies out by ~5.4s leaving the white environment.
    // Transition to pure white SVG loader at 5.5s for seamless continuity.
    if (v2.duration && v2.currentTime >= Math.min(v2.duration - 0.25, 5.55)) {
      triggerSvgLoader();
    }
  };

  const handleVideo2Ended = () => {
    if (!takeoffEndedRef.current) {
      triggerSvgLoader();
    }
  };

  const triggerSvgLoader = () => {
    takeoffEndedRef.current = true;
    setPhase("loader");
    setLoaderStartTime(Date.now());
  };

  // 7. Coordinate SVG Loader Completion with App Readiness
  useEffect(() => {
    if (phase !== "loader") return;

    const MIN_LOADER_DISPLAY_MS = 1200; // Let the elegant SVG kingfisher flap smoothly for at least ~1.2s
    const checkInterval = setInterval(() => {
      const elapsed = loaderStartTime ? Date.now() - loaderStartTime : 0;
      if (isAppReady && elapsed >= MIN_LOADER_DISPLAY_MS) {
        clearInterval(checkInterval);
        sessionStorage.setItem(STORAGE_KEY, "true");
        setPhase("revealing");
        setTimeout(() => {
          setPhase("hidden");
          onComplete?.();
        }, 800);
      }
    }, 100);

    // Hard fallback timeout: never keep user waiting more than 4s on loader
    const fallbackTimer = setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setPhase("revealing");
      setTimeout(() => {
        setPhase("hidden");
        onComplete?.();
      }, 800);
    }, 4000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(fallbackTimer);
    };
  }, [phase, isAppReady, loaderStartTime, onComplete]);

  if (phase === "hidden") return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center overflow-hidden select-none transition-opacity duration-800 ${
        phase === "revealing" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      aria-live="polite"
    >
      {/* 1. Cinematic Video Deck (Phase 1 & 2) */}
      <div className="absolute inset-0 bg-white pointer-events-none overflow-hidden">
        {/* Video 1 — Intro */}
        <video
          ref={video1Ref}
          src={INTRO_VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onTimeUpdate={handleVideo1TimeUpdate}
          onEnded={handleVideo1Ended}
          onError={() => setPhase("loader")}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-150 ${
            phase === "intro" ? "opacity-100 z-20" : "opacity-0 z-10"
          }`}
        />

        {/* Video 2 — Takeoff (Preloaded & layered directly underneath) */}
        <video
          ref={video2Ref}
          src={TAKEOFF_VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          onTimeUpdate={handleVideo2TimeUpdate}
          onEnded={handleVideo2Ended}
          onError={() => setPhase("loader")}
          className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300 ${
            phase === "takeoff" ? "opacity-100 z-20" : "opacity-0 z-10"
          }`}
        />
      </div>

      {/* 2. Custom Animated SVG Kingfisher Loader (Phase 3) */}
      <div
        className={`relative z-30 flex flex-col items-center justify-center transition-all duration-700 ${
          phase === "loader"
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-3 pointer-events-none"
        }`}
      >
        <KingfisherLoader size={170} />

        {/* Minimal, elegant brand title beneath icon */}
        <div className="mt-6 text-center flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-neutral-900 block">
            Birdpedia
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#4d5a3d] mt-1.5 font-semibold block">
            The Living Avian Archive
          </span>

          {/* Delicate Hairline Progress Track */}
          <div className="w-20 h-[1.5px] bg-neutral-200 rounded-full mt-5 overflow-hidden relative">
            <div
              className="absolute top-0 bottom-0 w-1/2 bg-[#4d5a3d] rounded-full"
              style={{
                animation: "kf-bar-scan 1.5s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        <style>{`
          @keyframes kf-bar-scan {
            0% { left: -50%; }
            100% { left: 100%; }
          }
        `}</style>
      </div>

      {/* 3. Subtle Skip Intro Pill (Accessible via click or ESC) */}
      <button
        onClick={skipIntro}
        className="absolute top-6 right-6 z-40 px-3.5 py-1.5 rounded-full bg-white/70 hover:bg-white border border-neutral-200/80 text-neutral-500 hover:text-neutral-900 text-xs font-mono tracking-wider shadow-sm backdrop-blur-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5 opacity-60 hover:opacity-100"
        aria-label="Skip cinematic introduction"
      >
        <span>Skip Intro</span>
        <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-400">ESC</span>
      </button>
    </div>
  );
};
