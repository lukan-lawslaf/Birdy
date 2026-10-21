import React from "react";

interface KingfisherLoaderProps {
  className?: string;
  size?: number;
}

export const KingfisherLoader: React.FC<KingfisherLoaderProps> = ({
  className = "",
  size = 200,
}) => {
  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      aria-label="Birdpedia loading animation"
      role="status"
    >
      <style>{`
        /* Living breath hover */
        @keyframes kf-breathe {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-5px);
          }
        }

        /* Subtle wing preen and feather flex */
        @keyframes kf-wing-preen {
          0%, 75%, 100% {
            transform: rotate(0deg) translateY(0px);
          }
          82% {
            transform: rotate(-3.5deg) translateY(-2px);
          }
          88% {
            transform: rotate(2deg) translateY(1px);
          }
        }

        /* Delicate tail flick */
        @keyframes kf-tail-flick {
          0%, 80%, 100% {
            transform: rotate(0deg);
          }
          86% {
            transform: rotate(-3deg);
          }
          92% {
            transform: rotate(2.5deg);
          }
        }

        /* Iridescent azure sheen */
        @keyframes kf-azure-shimmer {
          0%, 100% {
            opacity: 0.85;
            filter: drop-shadow(0 0 2px rgba(14, 165, 233, 0.3));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 8px rgba(14, 165, 233, 0.75));
          }
        }

        /* Acoustic bio-telemetry radar pulse */
        @keyframes kf-acoustic-wave {
          0% {
            transform: scale(0.65);
            opacity: 0.75;
          }
          100% {
            transform: scale(1.55);
            opacity: 0;
          }
        }

        /* Soft ground shadow pulse */
        @keyframes kf-shadow-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.22;
          }
          50% {
            transform: scale(0.82);
            opacity: 0.10;
          }
        }

        .kf-bird-stage {
          animation: kf-breathe 2.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .kf-wing-animated {
          transform-origin: 88px 64px;
          animation: kf-wing-preen 3.2s ease-in-out infinite;
        }

        .kf-tail-animated {
          transform-origin: 112px 106px;
          animation: kf-tail-flick 3.2s ease-in-out infinite;
        }

        .kf-shimmer-wing {
          animation: kf-azure-shimmer 2.2s ease-in-out infinite;
        }

        .kf-acoustic-ring {
          position: absolute;
          width: 140px;
          height: 140px;
          border-radius: 50%;
          border: 1px solid rgba(77, 90, 61, 0.35);
          top: 50%;
          left: 50%;
          margin-top: -85px;
          margin-left: -70px;
          animation: kf-acoustic-wave 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
          pointer-events-none;
        }

        .kf-acoustic-ring:nth-child(2) {
          animation-delay: 1.1s;
          border-color: rgba(14, 165, 233, 0.25);
        }
      `}</style>

      {/* Acoustic Bio-telemetry Rings */}
      <div className="kf-acoustic-ring" aria-hidden="true" />
      <div className="kf-acoustic-ring" aria-hidden="true" />

      {/* Refined Museum-Grade Kingfisher Vector */}
      <div className="kf-bird-stage relative z-10">
        <svg
          width={size}
          height={size * 0.75}
          viewBox="0 0 200 150"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          <defs>
            {/* Signature Electric Azure / Cerulean Wing Gradient */}
            <linearGradient id="kfAzureGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0284c7" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0369a1" />
            </linearGradient>

            {/* Warm Chestnut / Ochre Breast Gradient */}
            <linearGradient id="kfChestGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#c2410c" />
            </linearGradient>

            {/* Pedestal Moss Stone Gradient */}
            <linearGradient id="kfStoneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ece5d8" />
              <stop offset="100%" stopColor="#d5cebf" />
            </linearGradient>
          </defs>

          {/* 1. Sculpted Pedestal Stone Baseline (Direct echo of Video 1 pedestal) */}
          <path
            d="M 74,126 C 86,124 116,124 128,126 L 124,133 C 112,135 88,135 78,133 Z"
            fill="url(#kfStoneGrad)"
          />
          {/* Subtle Moss Tuft Accent */}
          <path
            d="M 82,125 C 86,123 92,124 96,125"
            stroke="#4d5a3d"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* 2. Coral Feet Perched on Pedestal */}
          <path
            d="M 94,121 L 92,126 M 96,121 L 96,126 M 98,121 L 100,126"
            stroke="#ea580c"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* 3. Tail Feathers (Extends below the folded primary wing) */}
          <g className="kf-tail-animated">
            <path d="M 112,106 L 120,132 L 114,130 L 108,108 Z" fill="#0284c7" />
            <path d="M 116,108 L 122,132 L 118,131 L 112,110 Z" fill="#18181b" />
          </g>

          {/* 4. Warm Chestnut Breast & Flank */}
          <path
            d="M 68,76 
               C 74,94 84,112 100,118 
               C 108,118 114,114 116,108 
               C 106,106 98,98 94,86 
               C 88,78 80,74 74,72 Z"
            fill="url(#kfChestGrad)"
          />

          {/* 5. Pure White Throat Patch (Clean, distinct signature) */}
          <path
            d="M 66,66 C 70,76 78,80 84,80 C 80,74 78,70 76,66 Z"
            fill="#ffffff"
          />
          {/* Pure White Neck Slash */}
          <ellipse
            cx="94"
            cy="62"
            rx="6"
            ry="3"
            transform="rotate(-15 94 62)"
            fill="#ffffff"
          />

          {/* 6. Head & Crown (Sleek aerodynamic crest slope) */}
          <path
            d="M 64,58 
               C 68,48 78,42 92,42 
               C 104,42 114,48 118,58 
               C 120,66 118,76 114,84 
               C 108,82 102,78 98,72 
               C 90,70 82,68 76,64 
               C 70,62 66,60 64,58 Z"
            fill="#18181b"
          />

          {/* 7. Orange Ear Covert Patch */}
          <path
            d="M 82,56 C 90,52 96,54 100,60 C 94,62 88,60 82,56 Z"
            fill="#ea580c"
          />

          {/* 8. Dagger Spear Beak (Needle-sharp, firmly rooted, perfectly proportioned) */}
          <path d="M 14,57 L 66,54 L 66,62 Z" fill="#18181b" />
          <line
            x1="14"
            y1="57"
            x2="66"
            y2="58"
            stroke="#3f3f46"
            strokeWidth="0.8"
          />

          {/* 9. Intelligent Eye Pinprick (Refined & dignified, NO cartoon sticker) */}
          <circle cx="76" cy="53" r="1.6" fill="#f8fafc" />
          <circle cx="76.2" cy="52.8" r="0.8" fill="#09090b" />

          {/* 10. Folded Wing with Living Azure Shimmer & Layered Primaries */}
          <g className="kf-wing-animated">
            {/* Wing Base Structure */}
            <path
              d="M 88,64 
                 C 102,66 118,76 122,96 
                 C 124,106 122,116 118,124 
                 C 112,118 108,106 104,96 
                 C 98,84 92,74 88,64 Z"
              fill="#18181b"
            />
            {/* Iridescent Azure Dorsal Wing Feathers */}
            <path
              className="kf-shimmer-wing"
              d="M 92,66 C 104,68 116,78 118,94 C 114,94 108,86 102,76 C 98,70 94,68 92,66 Z"
              fill="url(#kfAzureGrad)"
            />
            {/* Primary Flight Feather Tips */}
            <path
              d="M 118,96 L 122,122 L 118,120 L 114,98 Z"
              fill="#0f172a"
            />
            <path
              d="M 114,102 L 118,124 L 115,122 L 110,104 Z"
              fill="#0f172a"
            />
          </g>
        </svg>
      </div>

      {/* Gentle Ground Shadow */}
      <div
        className="mt-3 w-16 h-1.5 rounded-full bg-stone-900/15 filter blur-[1.5px]"
        style={{
          animation:
            "kf-shadow-pulse 2.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite",
        }}
        aria-hidden="true"
      />
    </div>
  );
};
