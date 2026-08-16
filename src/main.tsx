import {StrictMode, useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { MainPage } from './MainPage.tsx';
import { isStandalonePwa } from './geolocation.ts';
import { shouldRegisterServiceWorker } from './pwa.ts';
import './index.css';

const isMainPage = /^\/main\/?$/.test(window.location.pathname);

function PwaUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const reloadAfterActivation = useRef(false);
  const isPwa = isStandalonePwa();

  useEffect(() => {
    if (!shouldRegisterServiceWorker(import.meta.env.PROD, 'serviceWorker' in navigator)) return;

    const onControllerChange = () => {
      if (reloadAfterActivation.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const watchRegistration = (workerRegistration: ServiceWorkerRegistration) => {
      const showUpdate = () => {
        if (isPwa && workerRegistration.waiting && navigator.serviceWorker.controller) setRegistration(workerRegistration);
      };
      showUpdate();
      workerRegistration.addEventListener('updatefound', () => {
        const worker = workerRegistration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') showUpdate();
        });
      });
    };

    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(watchRegistration)
      .catch(error => console.error('Не удалось зарегистрировать service worker', error));

    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, [isPwa]);

  if (!isPwa || !registration) return null;

  return <div className="fixed inset-x-4 bottom-24 z-[1000] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl" role="status">
    <span>{updateInProgress ? 'Обновление устанавливается…' : 'Доступно обновление приложения'}</span>
    <button type="button" disabled={updateInProgress} className="shrink-0 rounded-xl bg-white px-3 py-2 font-semibold text-slate-900 disabled:opacity-70" onClick={() => {
      const worker = registration.waiting;
      if (!worker) return;
      setUpdateInProgress(true);
      reloadAfterActivation.current = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    }}>{updateInProgress ? 'Готовим…' : 'Обновить'}</button>
  </div>;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isMainPage ? <MainPage /> : <App />}
    <PwaUpdatePrompt />
  </StrictMode>,
);
