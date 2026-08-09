import React from 'react';
import { Map, Plus, User as UserIcon } from 'lucide-react';
import { User } from '../types';
import appIcon from '../assets/images/losthvost.png';

interface BottomNavProps {
  activeScreen: 'map' | 'profile';
  onNavigate: (screen: 'map' | 'profile') => void;
  onCreateAdClick: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeScreen,
  onNavigate,
  onCreateAdClick,
  currentUser,
  onOpenAuth
}) => {
  return (
    <>
      {/* Top Apple Liquid Glass Header */}
      <header className="h-16 liquid-glass px-5 flex items-center justify-between sticky top-0 z-[1100]">
        <div
          onClick={() => onNavigate('map')}
          className="flex items-center space-x-3 cursor-pointer select-none active:scale-95 transition"
        >
          <img
            src={appIcon}
            alt="LostHvost"
            className="w-10 h-10 rounded-2xl shadow-md shadow-emerald-700/20 object-cover"
          />
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Поиск потеряшек
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Карта пропавших животных
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {currentUser ? (
            <button
              onClick={() => onNavigate('profile')}
              className="flex items-center space-x-2 liquid-glass px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-800 dark:text-slate-200 transition hover:scale-105 active:scale-95 cursor-pointer"
            >
              <div className="w-5 h-5 rounded-full bg-[#008E3A] text-white flex items-center justify-center text-[10px] font-bold">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline">{currentUser.name}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="bg-[#008E3A] hover:bg-[#007A32] text-white px-4 py-1.5 rounded-full text-xs font-semibold shadow-md shadow-emerald-700/20 transition active:scale-95 cursor-pointer"
            >
              Войти
            </button>
          )}
        </div>
      </header>

      {/* Bottom Floating Apple Liquid Glass Navigation Pill */}
      <nav className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[1100] liquid-glass px-7 py-2.5 rounded-full shadow-2xl flex items-center space-x-8">
        {/* Карта */}
        <button
          onClick={() => onNavigate('map')}
          className={`flex flex-col items-center space-y-0.5 transition-all duration-200 cursor-pointer active:scale-95 ${
            activeScreen === 'map'
              ? 'text-[#008E3A] dark:text-[#008E3A] font-bold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Map className="w-5 h-5" />
          <span className="text-[10px] font-medium">Карта</span>
        </button>

        {/* Central Creation Button (+ Pill) */}
        <button
          onClick={onCreateAdClick}
          className="w-12 h-12 rounded-full bg-[#008E3A] hover:bg-[#007A32] text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 -mt-6 border-4 border-white/80 dark:border-slate-900/80 transition-transform duration-200 transform active:scale-90 cursor-pointer"
          title="Подать объявление"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>

        {/* Профиль */}
        <button
          onClick={() => {
            if (!currentUser) {
              onOpenAuth();
            } else {
              onNavigate('profile');
            }
          }}
          className={`flex flex-col items-center space-y-0.5 transition-all duration-200 cursor-pointer active:scale-95 ${
            activeScreen === 'profile'
              ? 'text-[#008E3A] dark:text-[#008E3A] font-bold'
              : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">Профиль</span>
        </button>
      </nav>
    </>
  );
};
