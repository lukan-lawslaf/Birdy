import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../lib/ThemeContext";
import { Compass, Feather, BookOpen, Search, Menu, X, Sparkles, Sun, Moon, Navigation2, Film, Network } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AppNavProps {
  onOpenSearch?: () => void;
}

export const AppNav: React.FC<AppNavProps> = ({ onOpenSearch }) => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: "/", label: "Overview", icon: Compass },
    { path: "/atlas", label: "Atlas", icon: Feather, badge: "3D Lab" },
    { path: "/flyways", label: "Flyways", icon: Navigation2, badge: "GPS Map" },
    { path: "/phylogeny", label: "Family Tree", icon: Network },
    { path: "/catalog", label: "Catalog", icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="site-nav sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-10 py-3 transition-colors duration-500">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group select-none">
          <div className="w-9 h-9 rounded-xl liquid-glass liquid-bevel flex items-center justify-center text-[var(--sage)] shadow-sm group-hover:scale-105 transition-all duration-300">
            <Feather className="w-4 h-4 transition-transform group-hover:-rotate-12 text-[var(--sage)]" />
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-bold tracking-tight text-[var(--ink)] font-display flex items-center gap-1">
              Birdpedia
            </span>
            <span className="text-[10px] tracking-wider uppercase text-[var(--muted)] font-mono">
              The Living Avian Archive
            </span>
          </div>
        </Link>

        {/* Desktop Navigation - Liquid Glass Capsule */}
        <nav aria-label="Main navigation" className="hidden xl:flex items-center gap-1 liquid-glass-capsule liquid-bevel p-1 rounded-full shadow-[0_6px_20px_rgba(var(--shadow),0.08)]">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                aria-current={active ? "page" : undefined}
                className={`relative px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-2 transition-all duration-200 select-none ${
                  active
                    ? "text-[var(--sage-ink)] shadow-sm"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]/70"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active-indicator"
                    className="absolute inset-0 bg-[var(--sage)] rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_2px_8px_rgba(var(--shadow),0.2)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {link.label}
                  {link.badge && (
                    <span
                      className={`hidden lg:inline-block text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                        active
                          ? "bg-[var(--sage-ink)]/20 text-[var(--sage-ink)]"
                          : "bg-[var(--sage-tint)] text-[var(--sage)] border border-[var(--sage)]/25"
                      }`}
                    >
                      {link.badge}
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Replay Cinematic Intro Button */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("birdpedia:replay-intro"))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-[var(--muted)] liquid-glass-capsule hover:text-[var(--ink)] hover:border-[var(--sage)] transition-all cursor-pointer"
            title="Replay cinematic video intro"
            aria-label="Replay cinematic intro video"
          >
            <Film className="w-3.5 h-3.5 text-[var(--sage)]" />
            <span className="hidden sm:inline font-medium">Intro</span>
          </button>

          {/* Day / Dusk Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle between Day and Dusk natural lighting mode"
            className="p-2.5 rounded-full liquid-glass-capsule text-[var(--muted)] hover:text-[var(--ink)] transition-all hover:scale-105 active:scale-95 cursor-pointer"
            title={`Switch to ${theme === "day" ? "Dusk (Dark)" : "Day (Natural)"} lighting`}
          >
            {theme === "day" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Quick Search */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs text-[var(--muted)] liquid-glass-capsule hover:text-[var(--ink)] transition-all hover:scale-102 active:scale-98 cursor-pointer"
              title="Search species (Press /)"
            >
              <Search className="w-3.5 h-3.5 text-[var(--sage)]" />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 rounded bg-[var(--chip)] text-[9px] text-[var(--muted)] font-mono border border-[var(--line)]">
                /
              </kbd>
            </button>
          )}

          {/* 3D Atlas CTA */}
          <Link
            to="/atlas"
            className="hidden lg:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold liquid-pill-btn text-[var(--sage-ink)] shadow-md transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3D Atlas</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="xl:hidden p-2 rounded-xl liquid-glass text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="xl:hidden overflow-hidden mt-3"
          >
            <div className="flex flex-col gap-1.5 p-2 rounded-2xl liquid-glass liquid-bevel">
              {navLinks.map((link) => {
                const active = isActive(link.path);
                const Icon = link.icon;
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? "bg-[var(--sage)] text-[var(--sage-ink)]"
                        : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{link.label}</span>
                    </div>
                    {link.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/10 font-bold">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
