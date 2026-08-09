import { useEffect, useState } from 'react';

const colorSchemeQuery = '(prefers-color-scheme: dark)';

const getSystemDarkMode = () => window.matchMedia(colorSchemeQuery).matches;

export const cartoTileUrl = (isDarkMode: boolean) =>
  `https://{s}.basemaps.cartocdn.com/rastertiles/${isDarkMode ? 'dark_all' : 'voyager'}/{z}/{x}/{y}{r}.png`;

export const cartoPickerTileUrl = (isDarkMode: boolean) =>
  `https://{s}.basemaps.cartocdn.com/rastertiles/${isDarkMode ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`;

export function useSystemDarkMode() {
  const [isDarkMode, setIsDarkMode] = useState(getSystemDarkMode);

  useEffect(() => {
    const mediaQuery = window.matchMedia(colorSchemeQuery);
    const updateTheme = (event: MediaQueryListEvent) => setIsDarkMode(event.matches);

    mediaQuery.addEventListener('change', updateTheme);
    return () => mediaQuery.removeEventListener('change', updateTheme);
  }, []);

  return isDarkMode;
}
