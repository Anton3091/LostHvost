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

const overallTimeoutMs = 45_000;
const geolocationBridgeOrigin = 'https://www.losthvost.ru';

type GeolocationStage = 'initial' | 'precise' | 'bridge';
type GeolocationDiagnosticPhase = 'start' | 'permission' | 'success' | 'error' | 'stalled';
type GeolocationPermissionState = PermissionState | 'unsupported' | 'query-error' | 'unknown';

function geolocationAttemptId() {
  return globalThis.crypto?.randomUUID?.() || `geo_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function deviceContext() {
  const userAgent = navigator.userAgent;
  const isIPad = /iPad/i.test(userAgent) || (/Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1);
  const platform = /iPhone/i.test(userAgent) ? 'iPhone' : isIPad ? 'iPad' : /Macintosh/i.test(userAgent) ? 'Mac' : 'other';
  const osVersion = userAgent.match(/OS (\d+(?:_\d+)*) like Mac OS X/i)?.[1]?.replaceAll('_', '.') || 'unknown';

  return {
    platform,
    osVersion,
    isStandalone: isStandalonePwa(),
    isSecureContext: window.isSecureContext,
    visibilityState: document.visibilityState
  };
}

function reportGeolocationDiagnostic(payload: {
  attemptId: string;
  phase: GeolocationDiagnosticPhase;
  stage: GeolocationStage;
  permissionState: GeolocationPermissionState;
  durationMs: number;
  errorCode?: number;
  errorMessage?: string;
}) {
  void fetch('/api/client-events/geolocation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, ...deviceContext() }),
    keepalive: true
  }).catch(() => undefined);
}

async function readGeolocationPermission(): Promise<GeolocationPermissionState> {
  if (!navigator.permissions?.query) return 'unsupported';
  try {
    return (await navigator.permissions.query({ name: 'geolocation' })).state;
  } catch {
    return 'query-error';
  }
}

export function isGeolocationPermissionDenied(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && Number(error.code) === 1;
}

export function isStandalonePwa() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const standaloneDisplay = window.matchMedia?.('(display-mode: standalone)').matches;
  const appleStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(standaloneDisplay || appleStandalone);
}

export function getCurrentLocationViaBridge(): Promise<{ latitude: number; longitude: number }> {
  if (typeof window === 'undefined') return Promise.reject(new Error('GEOLOCATION_BRIDGE_UNAVAILABLE'));

  return new Promise((resolve, reject) => {
    const requestId = geolocationAttemptId();
    const startedAt = performance.now();
    let bridgeWindow: Window | null = null;
    let timeoutId = 0;

    const report = (phase: GeolocationDiagnosticPhase, error?: Error & { code?: number }) => {
      reportGeolocationDiagnostic({
        attemptId: requestId,
        phase,
        stage: 'bridge',
        permissionState: 'unknown',
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
        ...(error?.code !== undefined ? { errorCode: Number(error.code) } : {}),
        ...(error?.message ? { errorMessage: error.message } : {})
      });
    };

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeoutId);
    };
    const fail = (message: string, code?: number) => {
      const error = new Error(message) as Error & { code?: number };
      if (code !== undefined) error.code = code;
      report('error', error);
      cleanup();
      reject(error);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== geolocationBridgeOrigin || event.source !== bridgeWindow) return;
      const data = event.data as {
        type?: string;
        requestId?: string;
        status?: string;
        latitude?: number;
        longitude?: number;
        errorCode?: number;
        errorMessage?: string;
      };
      if (data?.type !== 'losthvost:geo-bridge' || data.requestId !== requestId) return;

      if (data.status === 'success' && Number.isFinite(data.latitude) && Number.isFinite(data.longitude)) {
        const latitude = Number(data.latitude);
        const longitude = Number(data.longitude);
        if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
          report('success');
          cleanup();
          resolve({ latitude, longitude });
          return;
        }
      }

      fail(data.errorMessage || 'GEOLOCATION_BRIDGE_FAILED', data.errorCode);
    };

    window.addEventListener('message', onMessage);
    bridgeWindow = window.open(
      `${geolocationBridgeOrigin}/geo-bridge?requestId=${encodeURIComponent(requestId)}`,
      '_blank',
      'popup=yes,width=430,height=640'
    );
    if (!bridgeWindow) {
      fail('GEOLOCATION_BRIDGE_BLOCKED');
      return;
    }
    report('start');

    timeoutId = window.setTimeout(() => {
      bridgeWindow?.close();
      const error = new Error('GEOLOCATION_BRIDGE_TIMEOUT');
      report('stalled', error);
      cleanup();
      reject(error);
    }, 60_000);
  });
}

export function getCurrentLocation(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('GEOLOCATION_UNSUPPORTED'));
  }

  return new Promise((resolve, reject) => {
    const attemptId = geolocationAttemptId();
    const startedAt = performance.now();
    let activeStage: GeolocationStage = 'initial';
    let permissionState: GeolocationPermissionState = 'unknown';
    let settled = false;

    const elapsed = () => Math.max(0, Math.round(performance.now() - startedAt));
    const report = (phase: GeolocationDiagnosticPhase, stage: GeolocationStage, error?: GeolocationPositionError | Error) => {
      reportGeolocationDiagnostic({
        attemptId,
        phase,
        stage,
        permissionState,
        durationMs: elapsed(),
        ...('code' in (error || {}) ? { errorCode: Number((error as GeolocationPositionError).code) } : {}),
        ...(error?.message ? { errorMessage: error.message } : {})
      });
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(overallTimer);
      callback();
    };
    const onSuccess = (stage: GeolocationStage, position: GeolocationPosition) => {
      report('success', stage);
      finish(() => resolve(position));
    };
    const onFinalError = (stage: GeolocationStage, error: GeolocationPositionError) => {
      report('error', stage, error);
      finish(() => reject(error));
    };
    const requestPosition = (stage: GeolocationStage, options: PositionOptions) => {
      activeStage = stage;
      navigator.geolocation.getCurrentPosition(
        position => onSuccess(stage, position),
        error => {
          if (stage === 'initial' && !isGeolocationPermissionDenied(error)) {
            report('error', stage, error);
            // A precise GPS fix is useful when the regular provider is unavailable,
            // but it should not be the first request that Safari has to authorize.
            requestPosition('precise', preciseOptions);
            return;
          }
          onFinalError(stage, error);
        },
        options
      );
      // Keep the native request inside the original click call stack. Diagnostics
      // start only after Safari has received getCurrentPosition().
      report('start', stage);
    };

    const overallTimer = window.setTimeout(() => {
      const error = new Error('GEOLOCATION_REQUEST_STALLED');
      report('stalled', activeStage, error);
      finish(() => reject(error));
    }, overallTimeoutMs);

    requestPosition('initial', initialOptions);
    void readGeolocationPermission().then(state => {
      permissionState = state;
      report('permission', activeStage);
    });
  });
}
