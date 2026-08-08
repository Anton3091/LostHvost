import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CaptchaWidget } from './CaptchaWidget';
import { User as UserType } from '../types';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: UserType) => void;
  onLoginApi: (email: string, pass: string, captchaToken: string) => Promise<UserType>;
  onRegisterApi: (email: string, pass: string, name: string, captchaToken: string) => Promise<UserType>;
  onYandexApi: (captchaToken: string) => Promise<UserType>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onClose,
  onLoginSuccess,
  onLoginApi,
  onRegisterApi,
  onYandexApi
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'recovery'>('login');

  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register' && !consent) {
      setError('Вы должны дать согласие на обработку персональных данных');
      return;
    }

    if (!captchaToken) {
      setError('Пройдите проверку CAPTCHA');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const user = await onLoginApi(email, password, captchaToken);
        onLoginSuccess(user);
        onClose();
      } else if (mode === 'register') {
        const user = await onRegisterApi(email, password, name, captchaToken);
        onLoginSuccess(user);
        onClose();
      } else if (mode === 'recovery') {
        setRecoverySuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации');
    } finally {
      setLoading(false);
    }
  };

  const handleYandexLogin = async () => {
    if (!captchaToken) {
      setError('Пройдите проверку CAPTCHA перед входом через Яндекс ID');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const user = await onYandexApi(captchaToken);
      onLoginSuccess(user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ошибка входа через Яндекс ID');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-md"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 liquid-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100"
        >
          <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800/60 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {mode === 'login' && 'Вход в аккаунт'}
            {mode === 'register' && 'Регистрация'}
            {mode === 'recovery' && 'Восстановление пароля'}
          </h2>
          <p className="text-xs text-slate-500">
            Сервис поиска пропавших животных
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center space-x-2 border border-rose-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {recoverySuccess ? (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-xs rounded-xl text-center space-y-2">
            <p className="font-semibold">Инструкции по восстановлению отправлены!</p>
            <p>Проверьте вашу почту ({email}) для установки нового пароля.</p>
            <button
              onClick={() => setMode('login')}
              className="mt-2 bg-blue-600 text-white font-semibold px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              Вернуться ко входу
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Ваше имя
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Александр"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 pl-9 text-xs bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                E-mail адрес
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 pl-9 text-xs bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            {mode !== 'recovery' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 pl-9 text-xs bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start space-x-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#008E3A] focus:ring-[#008E3A] w-4 h-4 cursor-pointer accent-[#008E3A]"
                />
                <span className="leading-snug text-[11px]">
                  Я даю согласие на <a href="#" onClick={(e) => { e.preventDefault(); alert('Согласие на обработку персональных данных в соответствии с ФЗ-152'); }} className="text-[#008E3A] underline font-medium">обработку персональных данных</a> и соглашаюсь с правилами сервиса
                </span>
              </label>
            )}

            <CaptchaWidget
              onVerify={setCaptchaToken}
              isVerified={Boolean(captchaToken)}
            />

            <button
              type="submit"
              disabled={loading || !captchaToken || (mode === 'register' && !consent)}
              className="w-full bg-[#008E3A] hover:bg-[#007A32] disabled:opacity-50 text-white font-semibold py-3 rounded-2xl text-xs shadow-md shadow-emerald-700/20 transition cursor-pointer"
            >
              {loading
                ? 'Загрузка...'
                : mode === 'login'
                ? 'Войти'
                : mode === 'register'
                ? 'Создать аккаунт'
                : 'Отправить ссылку'}
            </button>

            {/* Quick Yandex Auth Option */}
            {mode !== 'recovery' && (
              <button
                type="button"
                onClick={handleYandexLogin}
                className="w-full border border-rose-200/80 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100/60 text-rose-700 dark:text-rose-300 font-semibold py-3 rounded-2xl text-xs flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <span className="font-bold text-rose-600 font-serif text-sm">Я</span>
                <span>Войти через Яндекс ID</span>
              </button>
            )}
          </form>
        )}

        {/* Mode Switchers */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-wrap justify-between text-xs text-slate-500">
          {mode === 'login' ? (
            <>
              <button
                onClick={() => { setMode('recovery'); setError(null); }}
                className="hover:underline cursor-pointer"
              >
                Забыли пароль?
              </button>
              <button
                onClick={() => { setMode('register'); setError(null); }}
                className="text-[#008E3A] font-semibold hover:underline cursor-pointer"
              >
                Регистрация
              </button>
            </>
          ) : (
            <button
              onClick={() => { setMode('login'); setError(null); }}
              className="text-[#008E3A] font-semibold hover:underline cursor-pointer mx-auto"
            >
              Уже есть аккаунт? Войти
            </button>
          )}
        </div>
      </motion.div>
    </div>
    </AnimatePresence>
  );
};
