type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

const cartoBasemapKey = (import.meta as ImportMetaWithEnv).env?.VITE_CARTO_BASEMAP_KEY?.trim();

export const withCartoBasemapKey = (url: string, key = cartoBasemapKey) => {
  if (!key) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}key=${encodeURIComponent(key)}`;
};

export const cartoTileUrl = withCartoBasemapKey(
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
);

export const cartoPickerTileUrl = withCartoBasemapKey(
  'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png'
);
