import React, { useState, useEffect, useRef } from "react";
import { KingfisherLoader } from "./KingfisherLoader";
import { Play, Volume2, VolumeX } from "lucide-react";

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
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  // Transition state: smooth cross-dissolve opacity
  const [v1Opacity, setV1Opacity] = useState(1);
  const [v2Opacity, setV2Opacity] = useState(0);
  const [whiteDissolveOpacity, setWhiteDissolveOpacity] = useState(0);

  const video1Ref = useRef<HTMLVideoElement>(null);
  const video2Ref = useRef<HTMLVideoElement>(null);
  const takeoffStartedRef = useRef(false);
  const whiteDissolveTriggeredRef = useRef(false);

  // Helper to ensure video elements strictly comply with browser autoplay policies
  const prepareVideo = (video: HTMLVideoElement | null) => {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
  };

  // 1. Initial Session & Accessibility Check
  useEffect(() => {
    // Check URL parameters for explicit force-play (e.g. ?intro=true or #intro)
    const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const forceViaUrl = Boolean(urlParams?.has("intro") || urlParams?.has("replay"));

    const hasSeenIntro = sessionStorage.getItem(STORAGE_KEY) === "true";
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!forcePlay && !forceViaUrl && (hasSeenIntro || prefersReducedMotion)) {
      setPhase("hidden");
      onComplete?.();
      return;
    }

    // Begin cinematic intro phase
    setPhase("intro");
    setV1Opacity(1);
    setV2Opacity(0);
    setWhiteDissolveOpacity(0);
    takeoffStartedRef.current = false;
    whiteDissolveTriggeredRef.current = false;
  }, [forcePlay, onComplete]);

  // Support manual replay triggers (from footer or AppNav)
  useEffect(() => {
    const handleReplay = () => {
      sessionStorage.removeItem(STORAGE_KEY);
      takeoffStartedRef.current = false;
      whiteDissolveTriggeredRef.current = false;
      setV1Opacity(1);
      setV2Opacity(0);
      setWhiteDissolveOpacity(0);
      setNeedsUserGesture(false);
      setPhase("intro");

      const v1 = video1Ref.current;
      const v2 = video2Ref.current;

      if (v2) {
        prepareVideo(v2);
        v2.currentTime = 0;
        v2.pause();
      }

      if (v1) {
        prepareVideo(v1);
        v1.currentTime = 0;
        v1.play().catch((err) => {
          console.warn("[Birdpedia Intro] Replay autoplay blocked:", err);
          setNeedsUserGesture(true);
        });
      }
    };

    window.addEventListener("birdpedia:replay-intro", handleReplay);
    return () => window.removeEventListener("birdpedia:replay-intro", handleReplay);
  }, []);

  // 2. Track Document & App Readiness in background
  useEffect(() => {
    const handleReady = () => {
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

  // 3. Mount & Autoplay Video 1 safely
  useEffect(() => {
    if (phase !== "intro") return;

    const v1 = video1Ref.current;
    const v2 = video2Ref.current;

    // Ensure DOM properties are set
    prepareVideo(v1);
    prepareVideo(v2);

    if (v2) {
      v2.preload = "auto";
      v2.currentTime = 0;
      v2.load();
    }

    if (v1) {
      v1.currentTime = 0;
      const playPromise = v1.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setNeedsUserGesture(false);
          })
          .catch((err) => {
            console.warn("[Birdpedia Intro] Autoplay prevented by browser policy:", err);
            // Instead of skipping, show a refined click-to-play button
            setNeedsUserGesture(true);
          });
      }
    }
  }, [phase]);

  // Click-to-start handler if browser strictly forbids autoplay
  const handleUserGestureStart = () => {
    setNeedsUserGesture(false);
    const v1 = video1Ref.current;
    if (v1) {
      prepareVideo(v1);
      v1.play().catch(console.error);
    }
  };

  // Toggle audio mute/unmute
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (video1Ref.current) video1Ref.current.muted = nextMuted;
    if (video2Ref.current) video2Ref.current.muted = nextMuted;
  };

  // 4. Keyboard Skip (Escape key)
  useEffect(() => {
    if (phase === "hidden") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skipIntro();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase]);

  const skipIntro = () => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setPhase("revealing");
    setTimeout(() => {
      setPhase("hidden");
      onComplete?.();
    }, 700);
  };

  // 5. Seamless Transition from Video 1 -> Video 2
  const handleVideo1TimeUpdate = () => {
    const v1 = video1Ref.current;
    const v2 = video2Ref.current;
    if (!v1 || !v2) return;

    // Video 1 duration is 8.0s.
    // At 7.4s: Pre-start Video 2 in the background so frames are actively decoding
    if (v1.currentTime >= 7.4 && !takeoffStartedRef.current) {
      takeoffStartedRef.current = true;
      prepareVideo(v2);
      v2.currentTime = 0;
      v2.play().catch(console.warn);
    }

    // At 7.7s: Cross-fade Video 1 into Video 2 over ~300ms
    if (v1.currentTime >= 7.7) {
      setV1Opacity(0);
      setV2Opacity(1);
    }
  };

  const handleVideo1Ended = () => {
    // Ensure Video 2 is fully active
    setV1Opacity(0);
    setV2Opacity(1);
    setPhase("takeoff");
    const v2 = video2Ref.current;
    if (v2 && v2.paused) {
      prepareVideo(v2);
      v2.play().catch(console.warn);
    }
  };

  // 6. Seamless Transition from Video 2 -> Phase 3 (SVG Loader)
  const handleVideo2TimeUpdate = () => {
    const v2 = video2Ref.current;
    if (!v2) return;

    // In Video 2 (~5.9s total):
    // The bird spreads its wings and takes off around ~4.8s, exiting the upper-left by ~5.2s.
    // At 5.1s: Smoothly fade in pure white dissolve wash over the scene (600ms)
    if (v2.currentTime >= 5.1 && !whiteDissolveTriggeredRef.current) {
      whiteDissolveTriggeredRef.current = true;
      setWhiteDissolveOpacity(1);

      // Once the white dissolve reaches 100% (at 5.7s), switch cleanly to the SVG Loader
      setTimeout(() => {
        setPhase("loader");
        setLoaderStartTime(Date.now());
        if (video2Ref.current) {
          video2Ref.current.pause();
        }
      }, 600);
    }
  };

  const handleVideo2Ended = () => {
    if (phase !== "loader" && phase !== "revealing" && phase !== "hidden") {
      setWhiteDissolveOpacity(1);
      setPhase("loader");
      setLoaderStartTime(Date.now());
    }
  };

  // 7. Coordinate SVG Loader Completion with App Readiness
  useEffect(() => {
    if (phase !== "loader") return;

    const MIN_LOADER_DISPLAY_MS = 1400; // Elegant Kingfisher SVG animation loops smoothly for ~1.4s
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

    // Hard fallback timeout: maximum 4.5s
    const fallbackTimer = setTimeout(() => {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setPhase("revealing");
      setTimeout(() => {
        setPhase("hidden");
        onComplete?.();
      }, 800);
    }, 4500);

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
      onClick={needsUserGesture ? handleUserGestureStart : undefined}
    >
      {/* 1. Cinematic Video Deck (Phase 1 & 2) */}
      <div className="absolute inset-0 bg-white pointer-events-none overflow-hidden">
        {/* Video 2 — Takeoff (Mounted underneath and pre-buffered) */}
        <video
          ref={video2Ref}
          src={TAKEOFF_VIDEO_SRC}
          muted
          playsInline
          preload="auto"
          onTimeUpdate={handleVideo2TimeUpdate}
          onEnded={handleVideo2Ended}
          onError={(e) => {
            console.warn("[Birdpedia Intro] Video 2 error:", e);
            setPhase("loader");
          }}
          style={{
            opacity: v2Opacity,
            transition: "opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          className="absolute inset-0 w-full h-full object-cover object-center z-10"
        />

        {/* Video 1 — Intro (Mounted on top with cross-dissolve control) */}
        <video
          ref={video1Ref}
          src={INTRO_VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          onTimeUpdate={handleVideo1TimeUpdate}
          onEnded={handleVideo1Ended}
          onError={(e) => {
            console.warn("[Birdpedia Intro] Video 1 error:", e);
            setPhase("loader");
          }}
          style={{
            opacity: v1Opacity,
            transition: "opacity 350ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
          className="absolute inset-0 w-full h-full object-cover object-center z-20"
        />

        {/* Pure White Dissolve Layer: Smoothly washes over Video 2 as the bird takes flight */}
        <div
          style={{
            opacity: whiteDissolveOpacity,
            transition: "opacity 600ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className="absolute inset-0 bg-white z-30 pointer-events-none"
        />
      </div>

      {/* 2. Custom Animated SVG Kingfisher Loader (Phase 3) */}
      <div
        style={{
          transition: "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        className={`relative z-40 flex flex-col items-center justify-center ${
          phase === "loader"
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        }`}
      >
        <KingfisherLoader size={180} />

        {/* Refined botanical brandmark text beneath icon */}
        <div className="mt-7 text-center flex flex-col items-center">
          <span className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-[#1b1a17] block">
            Birdpedia
          </span>
          <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-[#4d5a3d] mt-1.5 font-semibold block">
            The Living Avian Archive
          </span>

          {/* Delicate Hairline Progress Track */}
          <div className="w-24 h-[1.5px] bg-neutral-200 rounded-full mt-5 overflow-hidden relative">
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

      {/* 3. User Gesture Fallback Overlay (Shown only if browser autoplay policy blocks initial play) */}
      {needsUserGesture && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm cursor-pointer">
          <div className="px-6 py-3.5 rounded-full bg-white/95 text-neutral-900 shadow-2xl flex items-center gap-3 transform hover:scale-105 active:scale-95 transition-all">
            <div className="w-8 h-8 rounded-full bg-[#4d5a3d] text-white flex items-center justify-center">
              <Play className="w-4 h-4 ml-0.5" />
            </div>
            <div className="text-left">
              <div className="text-xs font-bold font-display">Begin Cinematic Journey</div>
              <div className="text-[10px] text-neutral-500 font-mono">Click anywhere to start</div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Controls: Audio Mute Toggle & Skip Intro */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-2">
        {/* Audio Toggle */}
        <button
          onClick={toggleMute}
          className="p-2 rounded-full bg-white/80 hover:bg-white border border-neutral-200/80 text-neutral-600 hover:text-neutral-950 shadow-sm backdrop-blur-sm transition-all cursor-pointer"
          aria-label={isMuted ? "Unmute intro sound" : "Mute intro sound"}
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-[#4d5a3d]" />}
        </button>

        {/* Skip Intro Pill */}
        <button
          onClick={skipIntro}
          className="px-3.5 py-1.5 rounded-full bg-white/80 hover:bg-white border border-neutral-200/80 text-neutral-600 hover:text-neutral-950 text-xs font-mono tracking-wider shadow-sm backdrop-blur-sm transition-all duration-200 cursor-pointer flex items-center gap-1.5"
          aria-label="Skip cinematic introduction"
        >
          <span>Skip</span>
          <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-400">ESC</span>
        </button>
      </div>
    </div>
  );
};
