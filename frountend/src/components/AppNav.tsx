import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../lib/ThemeContext";
import { Compass, Feather, BookOpen, Search, Menu, X, Sparkles, Sun, Moon } from "lucide-react";
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
    { path: "/atlas", label: "Feather Atlas", icon: Feather, badge: "3D Lab" },
    { path: "/catalog", label: "Species Catalog", icon: BookOpen },
  ];

  const isActive = (path: string) => {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-6 lg:px-10 py-3 bg-[var(--bg)]/90 backdrop-blur-md border-b border-[var(--line)] transition-colors duration-500">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group select-none">
          <div className="w-9 h-9 rounded-xl bg-[var(--sage-tint)] border border-[var(--sage)]/30 flex items-center justify-center text-[var(--sage)] shadow-sm group-hover:scale-105 transition-transform duration-300">
            <Feather className="w-4 h-4 transition-transform group-hover:-rotate-12" />
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

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-[var(--panel)] p-1 rounded-full border border-[var(--line)] shadow-sm">
          {navLinks.map((link) => {
            const active = isActive(link.path);
            const Icon = link.icon;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all duration-200 select-none ${
                  active
                    ? "text-[var(--sage-ink)]"
                    : "text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--chip)]"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active-indicator"
                    className="absolute inset-0 bg-[var(--sage)] rounded-full shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  {link.label}
                  {link.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                        active
                          ? "bg-[var(--sage-ink)]/20 text-[var(--sage-ink)]"
                          : "bg-[var(--sage-tint)] text-[var(--sage)] border border-[var(--sage)]/20"
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
          {/* Day / Dusk Theme Switcher Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle between Day and Dusk natural lighting mode"
            className="p-2 rounded-full bg-[var(--panel)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)] hover:border-[var(--sage)] transition-colors shadow-sm cursor-pointer"
            title={`Switch to ${theme === "day" ? "Dusk (Dark)" : "Day (Natural)"} lighting`}
          >
            {theme === "day" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Quick Search */}
          {onOpenSearch && (
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 px-3 py-2 rounded-full text-xs text-[var(--muted)] bg-[var(--panel)] hover:bg-[var(--chip)] hover:text-[var(--ink)] border border-[var(--line)] transition-colors shadow-sm cursor-pointer"
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
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--sage)] text-[var(--sage-ink)] hover:opacity-90 shadow-sm transition-all hover:scale-[1.02] active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>3D Atlas</span>
          </Link>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--panel)] border border-[var(--line)]"
            aria-label="Toggle navigation menu"
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
            className="md:hidden overflow-hidden border-t border-[var(--line)] mt-3 pt-3"
          >
            <div className="flex flex-col gap-1.5 pb-2">
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
