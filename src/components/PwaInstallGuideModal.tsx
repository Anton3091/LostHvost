import { useEffect, type ReactNode } from 'react';
import { BellRing, Compass, Share, SquarePlus, X } from 'lucide-react';

export const PUSH_UNSUPPORTED_ERROR = 'Push-уведомления не поддерживаются этим браузером';

interface PwaPushUnsupportedMessageProps {
  onOpenGuide: () => void;
}

export function PwaPushUnsupportedMessage({ onOpenGuide }: PwaPushUnsupportedMessageProps) {
  return (
    <p className="text-xs font-semibold text-rose-600">
      {PUSH_UNSUPPORTED_ERROR}. Установите сайт как PWA на рабочий стол. Более подробно о том как это сделать указано в{' '}
      <a
        href="#pwa-install-guide"
        onClick={event => {
          event.preventDefault();
          onOpenGuide();
        }}
        className="underline underline-offset-2 hover:text-rose-700"
      >
        инструкции
      </a>.
    </p>
  );
}

interface PwaInstallGuideModalProps {
  onClose: () => void;
}

export function PwaInstallGuideModal({ onClose }: PwaInstallGuideModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[2200] flex items-center justify-center bg-slate-900/70 p-4"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[28px] bg-[#f5f7ef] p-5 text-slate-900 shadow-2xl sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-guide-title"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть инструкцию"
            className="rounded-full p-2 text-slate-500 transition hover:bg-white hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <header className="flex flex-col items-center text-center">
          <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-[#b7df68] text-slate-950 shadow-[0_10px_24px_rgba(93,141,20,0.18)]" aria-hidden="true">
            <BellRing className="h-7 w-7" />
          </span>
          <h2 id="pwa-install-guide-title" className="mt-4 max-w-sm text-3xl font-extrabold leading-tight tracking-tight">
            Добавьте LostHvost на экран «Домой»
          </h2>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-slate-600">
            Чтобы сайт корректно работал как приложение и присылал push-уведомления о новых объявлениях.
          </p>
        </header>

        <ol className="mt-6 flex list-none flex-col gap-3 p-0" aria-label="Как установить LostHvost">
          <InstallStep
            icon={<Compass />}
            number={1}
            title="Откройте сайт в Safari"
            text="Откройте losthvost.ru на iPhone или iPad в браузере Safari."
          />
          <InstallStep
            icon={<Share />}
            number={2}
            title="Нажмите «Поделиться»"
            text="Кнопка находится на нижней панели браузера."
          />
          <InstallStep
            icon={<SquarePlus />}
            number={3}
            title="Добавьте на экран «Домой»"
            text="Выберите этот пункт в меню, затем нажмите «Добавить»."
          />
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-14 w-full rounded-2xl bg-[#087747] text-base font-semibold text-white shadow-lg shadow-emerald-900/15 transition hover:bg-[#06683D]"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

function InstallStep({ icon, number, title, text }: { icon: ReactNode; number: number; title: string; text: string }) {
  return (
    <li className="grid min-h-24 grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5 rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 shadow-[0_4px_16px_rgba(17,17,17,0.04)]">
      <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-slate-100 text-slate-950" aria-hidden="true">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] font-extrabold uppercase leading-tight tracking-[0.08em] text-[#547f19]">Шаг {number}</span>
        <strong className="mt-1 text-[15px] leading-tight">{title}</strong>
        <small className="mt-1 text-xs leading-snug text-slate-500">{text}</small>
      </span>
    </li>
  );
}
