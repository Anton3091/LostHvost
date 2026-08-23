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
      className="pwa-guide-backdrop fixed inset-0 z-[2200] flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="pwa-guide-dialog max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[28px] p-5 text-slate-900 sm:p-7"
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
          <span className="pwa-guide-icon grid h-16 w-16 place-items-center rounded-[20px]" aria-hidden="true">
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
          className="mt-6 min-h-14 w-full rounded-2xl bg-[#126E4A] text-base font-semibold text-white transition hover:bg-[#0D5638]"
        >
          Понятно
        </button>
      </div>
    </div>
  );
}

function InstallStep({ icon, number, title, text }: { icon: ReactNode; number: number; title: string; text: string }) {
  return (
    <li className="pwa-guide-step grid min-h-24 grid-cols-[48px_minmax(0,1fr)] items-center gap-3.5 rounded-[18px] border border-slate-200 bg-white px-4 py-3.5">
      <span className="pwa-guide-step-icon grid h-12 w-12 place-items-center rounded-[15px]" aria-hidden="true">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[10px] font-extrabold uppercase leading-tight tracking-[0.08em] text-[#126E4A]">Шаг {number}</span>
        <strong className="mt-1 text-[15px] leading-tight">{title}</strong>
        <small className="mt-1 text-xs leading-snug text-slate-500">{text}</small>
      </span>
    </li>
  );
}
