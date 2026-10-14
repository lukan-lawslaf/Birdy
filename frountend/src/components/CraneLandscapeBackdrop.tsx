import React, { useState } from "react";
import { useTheme } from "../lib/ThemeContext";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260901_122529_931c22c8-8d2d-47c0-ad51-b97f56a91e42.mp4";
const POSTER_URL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/4f690bd1-881a-4192-82f2-d714d34c8fb9.png";

export const CraneLandscapeBackdrop: React.FC = () => {
  const { theme } = useTheme();
  const [videoLoaded, setVideoLoaded] = useState(false);

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* 1. Continuous Hand-drawn Teal Ink Crane Video Loop */}
      <video
        className={`absolute inset-0 w-full h-full object-cover object-bottom transition-opacity duration-1000 pointer-events-none ${
          videoLoaded ? "opacity-100" : "opacity-0"
        } ${
          theme === "dusk"
            ? "opacity-35 mix-blend-luminosity brightness-75 contrast-125"
            : "opacity-90"
        }`}
        autoPlay
        muted
        loop
        playsInline
        poster={POSTER_URL}
        onLoadedData={() => setVideoLoaded(true)}
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>

      {/* Static poster fallback & initial instant visual until video frame decodes */}
      <img
        src={POSTER_URL}
        alt=""
        className={`absolute inset-0 w-full h-full object-cover object-bottom pointer-events-none transition-opacity duration-700 ${
          videoLoaded ? "opacity-0" : "opacity-100"
        } ${theme === "dusk" ? "opacity-30 mix-blend-luminosity brightness-75" : "opacity-90"}`}
      />

      {/* 2. Theme-adaptive atmospheric tone veil */}
      <div
        className={`absolute inset-0 transition-colors duration-700 pointer-events-none ${
          theme === "dusk"
            ? "bg-[#14170f]/75 mix-blend-multiply"
            : "bg-gradient-to-t from-transparent via-[var(--bg)]/10 to-[var(--bg)]/40"
        }`}
      />
    </div>
  );
};
