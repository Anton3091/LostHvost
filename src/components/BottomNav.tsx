import React from 'react';
import { Map, Plus, User as UserIcon } from 'lucide-react';
import { User } from '../types';
const appIcon = '/losthvost.png';

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
      <header className="app-header h-16 bg-slate-50 shadow-none px-5 flex items-center justify-between">
        <div
          onClick={() => onNavigate('map')}
          className="app-brand flex items-center space-x-3 cursor-pointer select-none active:scale-95 transition"
        >
          <img
            src={appIcon}
            alt="LostHvost"
            className="app-brand-logo w-10 h-10 rounded-2xl shadow-md shadow-emerald-700/20 object-cover"
          />
          <div>
            <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
              Поиск потеряшек
            </h1>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              Карта пропавших животных
            </p>
          </div>
        </div>

      </header>

      <nav className="app-bottom-nav fixed z-[1100] liquid-glass flex items-center">
        {/* Карта */}
        <button
          onClick={() => onNavigate('map')}
          className={`app-bottom-nav-item flex flex-col items-center space-y-0.5 transition-all duration-200 cursor-pointer active:scale-95 ${
            activeScreen === 'map'
              ? 'text-[#126E4A] font-bold'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <Map className="w-5 h-5" />
          <span className="text-[10px] font-medium">Карта</span>
        </button>

        {/* Central Creation Button (+ Pill) */}
        <button
          onClick={onCreateAdClick}
          className="app-create-button bg-[#126E4A] hover:bg-[#0D5638] text-white flex items-center justify-center border-4 border-white transition-transform duration-200 cursor-pointer"
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
          className={`app-bottom-nav-item flex flex-col items-center space-y-0.5 transition-all duration-200 cursor-pointer active:scale-95 ${
            activeScreen === 'profile'
              ? 'text-[#126E4A] font-bold'
              : 'text-slate-400 hover:text-slate-700'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium">Профиль</span>
        </button>
      </nav>
    </>
  );
};
