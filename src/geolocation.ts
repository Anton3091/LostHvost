const highAccuracyOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 60_000
};

const fallbackOptions: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 20_000,
  maximumAge: 300_000
};

export function isGeolocationPermissionDenied(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 1;
}

export function getCurrentLocation(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('GEOLOCATION_UNSUPPORTED'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      highAccuracyError => {
        if (isGeolocationPermissionDenied(highAccuracyError)) {
          reject(highAccuracyError);
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, fallbackOptions);
      },
      highAccuracyOptions
    );
  });
}
