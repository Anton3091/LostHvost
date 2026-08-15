import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CaptchaWidget } from './CaptchaWidget';
import { User as UserType } from '../types';
import yandexIdLogo from '../assets/images/yandex-id-logo.svg';

interface AuthModalProps {
  onClose: () => void;
  onLoginSuccess: (user: UserType) => void;
  onLoginApi: (email: string, pass: string, captchaToken: string) => Promise<UserType>;
  onRegisterApi: (email: string, pass: string, name: string, captchaToken: string) => Promise<UserType>;
  onRecoveryApi: (email: string, captchaToken: string) => Promise<void>;
  onYandexApi: () => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  onClose,
  onLoginSuccess,
  onLoginApi,
  onRegisterApi,
  onRecoveryApi,
  onYandexApi
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'recovery'>('login');

  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

    if (mode === 'register' && password !== confirmPassword) {
      setError('Пароли не совпадают');
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
        await onRecoveryApi(email, captchaToken);
        setRecoverySuccess(true);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка авторизации');
      setCaptchaToken('');
    } finally {
      setLoading(false);
    }
  };

  const handleYandexLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await onYandexApi();
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
          className="relative z-10 liquid-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-slate-900"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-200/60 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1 text-center">
          <h2 className="text-xl font-bold text-slate-900">
            {mode === 'login' && 'Вход в аккаунт'}
            {mode === 'register' && 'Регистрация'}
            {mode === 'recovery' && 'Восстановление пароля'}
          </h2>
          <p className="text-xs text-slate-500">
            Сервис поиска пропавших животных
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-xl flex items-center space-x-2 border border-rose-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {recoverySuccess ? (
          <div className="p-4 bg-emerald-50 text-emerald-800 text-xs rounded-xl text-center space-y-2">
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
                <label className="text-xs font-medium text-slate-700">
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
                    className="w-full border border-slate-200 rounded-xl p-2.5 pl-9 text-xs bg-slate-50"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
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
                  className="w-full border border-slate-200 rounded-xl p-2.5 pl-9 text-xs bg-slate-50"
                />
              </div>
            </div>

            {mode !== 'recovery' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
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
                    className="w-full border border-slate-200 rounded-xl p-2.5 pl-9 text-xs bg-slate-50"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">
                  Повторите пароль
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="w-full border border-slate-200 rounded-xl p-2.5 pl-9 text-xs bg-slate-50"
                  />
                </div>
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start space-x-2.5 text-xs text-slate-600 cursor-pointer py-1 select-none">
                <input
                  type="checkbox"
                  required
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#0C8C50] focus:ring-[#0C8C50] w-4 h-4 cursor-pointer accent-[#0C8C50]"
                />
                <span className="leading-snug text-[11px]">
                  Я даю согласие на <a href="#" onClick={(e) => { e.preventDefault(); alert('Согласие на обработку персональных данных в соответствии с ФЗ-152'); }} className="text-[#0C8C50] underline font-medium">обработку персональных данных</a> и соглашаюсь с правилами сервиса
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
              className="w-full h-11 bg-[#087747] hover:bg-[#06683D] disabled:opacity-50 text-white font-semibold rounded-xl text-sm shadow-md shadow-emerald-700/20 transition cursor-pointer"
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
                disabled={loading}
                className="w-full h-11 border border-black bg-black hover:bg-[#1f1f1f] disabled:opacity-50 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2.5 transition cursor-pointer"
              >
                <img src={yandexIdLogo} alt="" aria-hidden="true" className="w-6 h-6" />
                <span>Войти с Яндекс ID</span>
              </button>
            )}
          </form>
        )}

        {/* Mode Switchers */}
        <div className="border-t border-slate-100 pt-3 flex flex-wrap justify-between text-xs text-slate-500">
          {mode === 'login' ? (
            <>
              <button
                onClick={() => { setMode('recovery'); setError(null); setCaptchaToken(''); }}
                className="hover:underline cursor-pointer"
              >
                Забыли пароль?
              </button>
              <button
                onClick={() => { setMode('register'); setError(null); setCaptchaToken(''); }}
                className="inline-flex min-h-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-[#0C8C50] shadow-sm shadow-emerald-700/10 transition hover:bg-emerald-100 hover:shadow-md cursor-pointer"
              >
                Регистрация
              </button>
            </>
          ) : (
            <button
              onClick={() => { setMode('login'); setError(null); setCaptchaToken(''); }}
              className="text-[#0C8C50] font-semibold hover:underline cursor-pointer mx-auto"
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
