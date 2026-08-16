import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Check, Loader2 } from 'lucide-react';
import { getPullRefreshDistance, getPullRefreshPhase, PULL_REFRESH_THRESHOLD, PullRefreshPhase } from '../adsRefresh';

interface PullToRefreshProps {
  children: React.ReactNode;
  enabled: boolean;
  onRefresh: () => Promise<void>;
}

type PullStatus = 'idle' | PullRefreshPhase | 'refreshing' | 'complete';

export function PullToRefresh({ children, enabled, onRefresh }: PullToRefreshProps) {
  const startY = useRef(0);
  const distanceRef = useRef(0);
  const tracking = useRef(false);
  const resetTimer = useRef<number | null>(null);
  const [distance, setDistance] = useState(0);
  const [status, setStatus] = useState<PullStatus>('idle');

  const reset = () => {
    tracking.current = false;
    distanceRef.current = 0;
    setDistance(0);
    setStatus('idle');
  };

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
  }, []);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!enabled || status === 'refreshing' || window.scrollY > 0 || event.touches.length !== 1) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-pull-refresh-ignore="true"]')) return;
    tracking.current = true;
    startY.current = event.touches[0].clientY;
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!enabled || status === 'refreshing' || window.scrollY > 0 || event.button !== 0) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-pull-refresh-ignore="true"]')) return;
    tracking.current = true;
    startY.current = event.clientY;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!tracking.current || event.touches.length !== 1) return;
    const nextDistance = getPullRefreshDistance(event.touches[0].clientY - startY.current);
    if (nextDistance <= 0) {
      reset();
      return;
    }
    event.preventDefault();
    distanceRef.current = nextDistance;
    setDistance(nextDistance);
    setStatus(getPullRefreshPhase(nextDistance));
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tracking.current || event.buttons !== 1) return;
    const nextDistance = getPullRefreshDistance(event.clientY - startY.current);
    if (nextDistance <= 0) {
      reset();
      return;
    }
    event.preventDefault();
    distanceRef.current = nextDistance;
    setDistance(nextDistance);
    setStatus(getPullRefreshPhase(nextDistance));
  };

  const handleTouchEnd = async () => {
    if (!tracking.current) return;
    tracking.current = false;
    if (distanceRef.current < PULL_REFRESH_THRESHOLD) {
      reset();
      return;
    }

    distanceRef.current = 52;
    setDistance(52);
    setStatus('refreshing');
    await onRefresh();
    setStatus('complete');
    resetTimer.current = window.setTimeout(reset, 700);
  };

  const visible = status !== 'idle';
  const label = status === 'ready'
    ? 'Отпустите, чтобы обновить'
    : status === 'refreshing'
      ? 'Обновляем объявления…'
      : status === 'complete'
        ? 'Обновлено'
        : 'Потяните для обновления';

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => void handleTouchEnd()}
      onTouchCancel={reset}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => void handleTouchEnd()}
      onMouseLeave={() => { if (tracking.current) void handleTouchEnd(); }}
    >
      <div
        aria-live="polite"
        aria-hidden={!visible}
        className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[2000] flex justify-center transition-opacity duration-150"
        style={{ opacity: visible ? 1 : 0, transform: `translateY(${Math.max(0, distance - 48)}px)` }}
      >
        <div className="liquid-glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-slate-700 shadow-lg">
          {status === 'refreshing' ? <Loader2 className="h-4 w-4 animate-spin text-[#0C8C50]" />
            : status === 'complete' ? <Check className="h-4 w-4 text-[#0C8C50]" />
              : <ArrowDown className={`h-4 w-4 text-[#0C8C50] transition-transform ${status === 'ready' ? 'rotate-180' : ''}`} />}
          <span>{label}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
