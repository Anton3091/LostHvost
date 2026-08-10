const initialOptions: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 300_000
};

const preciseOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 60_000
};

export function isGeolocationPermissionDenied(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 1;
}

export function isStandalonePwa() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const standaloneDisplay = window.matchMedia?.('(display-mode: standalone)').matches;
  const appleStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(standaloneDisplay || appleStandalone);
}

export function getCurrentLocation(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('GEOLOCATION_UNSUPPORTED'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      initialError => {
        if (isGeolocationPermissionDenied(initialError)) {
          reject(initialError);
          return;
        }

        // A precise GPS fix is useful when the regular provider is unavailable,
        // but it should not be the first request that Safari has to authorize.
        navigator.geolocation.getCurrentPosition(resolve, reject, preciseOptions);
      },
      initialOptions
    );
  });
}
