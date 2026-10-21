import React, { useRef, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

interface LiquidGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  enableTilt?: boolean;
  enableSheen?: boolean;
  elevation?: "subtle" | "standard" | "elevated";
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * LiquidGlassCard:
 * A liquidGL-inspired tactile component combining optical background refraction,
 * multi-tier double bevel specular rims, and real-time cursor light refraction.
 */
export const LiquidGlassCard: React.FC<LiquidGlassCardProps> = ({
  children,
  className = "",
  enableTilt = true,
  enableSheen = true,
  elevation = "standard",
  onClick,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Motion physics for 3D liquid tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 220, damping: 22 });
  const mouseYSpring = useSpring(y, { stiffness: 220, damping: 22 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["7deg", "-7deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-7deg", "7deg"]);

  // Dynamic light sheen following mouse position
  const sheenX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const sheenY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const xPct = mouseX / rect.width - 0.5;
    const yPct = mouseY / rect.height - 0.5;

    x.set(xPct);
    y.set(yPct);

    // Also update CSS custom properties for sheen
    cardRef.current.style.setProperty("--mouse-x", `${(mouseX / rect.width) * 100}%`);
    cardRef.current.style.setProperty("--mouse-y", `${(mouseY / rect.height) * 100}%`);
  }, [x, y]);

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  const elevationClass =
    elevation === "elevated"
      ? "liquid-glass-elevated"
      : elevation === "subtle"
      ? "liquid-glass-capsule"
      : "liquid-glass";

  return (
    <div
      style={{ perspective: enableTilt ? "1000px" : undefined }}
      className="w-full h-full"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        ref={cardRef}
        style={{
          rotateX: enableTilt ? rotateX : 0,
          rotateY: enableTilt ? rotateY : 0,
          transformStyle: enableTilt ? "preserve-3d" : undefined,
        }}
        onClick={onClick}
        className={`relative ${elevationClass} liquid-bevel rounded-2xl transition-all duration-300 ${className}`}
        {...(props as any)}
      >
        {/* Cursor Liquid Light Refraction Sheen */}
        {enableSheen && (
          <motion.div
            style={{
              background: `radial-gradient(circle at ${sheenX} ${sheenY}, rgba(var(--glass-specular), 0.16) 0%, rgba(var(--sage-rgb), 0.08) 28%, transparent 65%)`,
            }}
            className={`absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-300 z-10 ${
              isHovered ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        {/* Content */}
        <div className="relative z-10 w-full h-full">{children}</div>
      </motion.div>
    </div>
  );
};

/**
 * LiquidGlassCapsule:
 * Sleek, pill-shaped liquid glass capsule for navbars, controls, or badges.
 */
export const LiquidGlassCapsule: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = "", onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`liquid-glass-capsule liquid-bevel rounded-full px-4 py-2 transition-all duration-200 ${className}`}
    >
      {children}
    </div>
  );
};
