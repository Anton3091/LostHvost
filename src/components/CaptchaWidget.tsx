import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { useSystemDarkMode } from '../theme';

interface CaptchaWidgetProps {
  onVerify: (token: string) => void;
  isVerified: boolean;
  siteKey?: string;
}

declare global {
  interface Window {
    smartCaptcha?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          hl?: 'ru' | 'en' | 'be' | 'kk' | 'tt' | 'uk' | 'uz' | 'tr';
          shieldPosition?: 'top-left' | 'center-left' | 'bottom-left' | 'top-right' | 'center-right' | 'bottom-right';
        }
      ) => string;
      reset: (widgetId: string) => void;
      destroy: (widgetId: string) => void;
      subscribe: (
        widgetId: string,
        event: 'network-error' | 'javascript-error' | 'token-expired',
        callback: () => void
      ) => () => void;
    };
  }
}

export const CaptchaWidget: React.FC<CaptchaWidgetProps> = ({
  onVerify,
  isVerified,
  siteKey = ((import.meta as any).env?.VITE_YANDEX_SMARTCAPTCHA_SITE_KEY as string)
}) => {
  const isDarkMode = useSystemDarkMode();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [smartCaptchaLoaded, setSmartCaptchaLoaded] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    if (window.smartCaptcha) {
      setSmartCaptchaLoaded(true);
      return;
    }

    const scriptId = 'yandex-smartcaptcha-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://smartcaptcha.cloud.yandex.ru/captcha.js?render=onload';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        if (window.smartCaptcha) setSmartCaptchaLoaded(true);
        else setRenderError(true);
      };

      script.onerror = () => {
        setRenderError(true);
      };

      document.head.appendChild(script);
    } else {
      const checkLoaded = () => {
        if (window.smartCaptcha) setSmartCaptchaLoaded(true);
        else setRenderError(true);
      };
      script.addEventListener('load', checkLoaded, { once: true });
      return () => script.removeEventListener('load', checkLoaded);
    }
  }, []);

  useEffect(() => {
    if (!smartCaptchaLoaded || !window.smartCaptcha || !containerRef.current || widgetIdRef.current || !siteKey) {
      return;
    }

    try {
      const widgetId = window.smartCaptcha.render(containerRef.current, {
        sitekey: siteKey,
        hl: 'ru',
        callback: (token: string) => {
          if (token) {
            setRenderError(false);
            onVerify(token);
          } else {
            onVerify('');
            setRenderError(true);
          }
        }
      });
      widgetIdRef.current = widgetId;

      const unsubscribeNetworkError = window.smartCaptcha.subscribe(widgetId, 'network-error', () => {
        onVerify('');
        setRenderError(true);
      });
      const unsubscribeJavaScriptError = window.smartCaptcha.subscribe(widgetId, 'javascript-error', () => {
        onVerify('');
        setRenderError(true);
      });
      const unsubscribeTokenExpired = window.smartCaptcha.subscribe(widgetId, 'token-expired', () => {
        onVerify('');
      });

      return () => {
        unsubscribeNetworkError();
        unsubscribeJavaScriptError();
        unsubscribeTokenExpired();
        if (widgetIdRef.current && window.smartCaptcha) {
          window.smartCaptcha.destroy(widgetIdRef.current);
          widgetIdRef.current = null;
        }
      };
    } catch (err) {
      console.warn('Yandex SmartCaptcha render error:', err);
      setRenderError(true);
    }
  // SmartCaptcha gets its colors from the browser's color scheme when the
  // dynamic scheme is enabled in Yandex Cloud. Recreate the iframe on change.
  }, [smartCaptchaLoaded, siteKey, onVerify, isDarkMode]);

  useEffect(() => {
    if (!isVerified && widgetIdRef.current && window.smartCaptcha) {
      window.smartCaptcha.reset(widgetIdRef.current);
    }
  }, [isVerified]);

  useEffect(() => {
    if (!siteKey) {
      onVerify('');
      setRenderError(true);
    }
  }, [siteKey, onVerify]);

  return (
    <div className="liquid-glass-card rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 flex flex-col space-y-2 select-none shadow-sm">
      <div ref={containerRef} className="min-h-[100px] flex justify-center my-1" />

      {(renderError || !smartCaptchaLoaded || isVerified) && (
        <div className="flex items-center justify-between">
          <div
            className="flex items-center space-x-3 text-left focus:outline-none group cursor-pointer"
          >
            <div
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all duration-200 ${
                isVerified
                  ? 'bg-[#34C759] border-[#34C759] text-white shadow-sm'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 group-hover:border-[#008E3A]'
              }`}
            >
              {isVerified ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-sm bg-transparent group-hover:bg-[#008E3A]/30 transition" />
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {isVerified ? 'Защита от ботов пройдена' : renderError ? 'Проверка безопасности недоступна' : 'Загрузка проверки безопасности'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Проверка от спама Yandex SmartCaptcha
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 text-slate-400 dark:text-slate-500 text-[10px] font-semibold pl-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FC3F1D]" />
            <span className="hidden sm:inline tracking-wider">YANDEX</span>
          </div>
        </div>
      )}
    </div>
  );
};
