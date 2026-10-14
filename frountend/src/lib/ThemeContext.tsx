import React, { createContext, useContext, useState, useEffect } from "react";

type ThemeMode = "day" | "dusk";

interface ThemeContextValue {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dusk",
  toggleTheme: () => {},
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("birdpedia_theme");
    return (saved === "day" || saved === "dusk") ? saved : "dusk";
  });

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem("birdpedia_theme", t);
    document.documentElement.setAttribute("data-theme", t);
    if (t === "dusk") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "day" ? "dusk" : "day");
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dusk") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
