const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const joinUrl = (base: string, path: string): string => {
  if (!base) return path;
  return `${trimTrailingSlash(base)}${path.startsWith("/") ? path : `/${path}`}`;
};

const envScraperApiBase = import.meta.env.VITE_SCRAPER_API_BASE_URL as string | undefined;
const envScraperAppBase = import.meta.env.VITE_SCRAPER_APP_BASE_URL as string | undefined;

export const SCRAPER_API_BASE = trimTrailingSlash(
  (envScraperApiBase && envScraperApiBase.trim()) || (import.meta.env.DEV ? "http://localhost:3000" : "")
);

export const SCRAPER_APP_BASE = trimTrailingSlash(
  (envScraperAppBase && envScraperAppBase.trim()) || SCRAPER_API_BASE
);

export const buildScraperApiUrl = (path: string): string =>
  joinUrl(SCRAPER_API_BASE, path.startsWith("/") ? path : `/${path}`);

export const buildScraperAppUrl = (path = ""): string => {
  if (!path) return SCRAPER_APP_BASE || "/";
  return joinUrl(SCRAPER_APP_BASE, path.startsWith("/") ? path : `/${path}`);
};

