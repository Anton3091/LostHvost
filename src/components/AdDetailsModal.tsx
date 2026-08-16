import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, AlertCircle, Calendar, MapPin, Tag, ShieldAlert, Check, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { PublicAdItem, User } from '../types';
import { CaptchaWidget } from './CaptchaWidget';

interface AdDetailsModalProps {
  ad: PublicAdItem | null;
  onClose: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onRequestPhone: (adId: string, captchaToken: string) => Promise<string>;
  onSubmitComplaint: (adId: string, captchaToken: string) => Promise<void>;
}

const YandexMapsLogo = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8">
    <path fill="#FFCC00" d="M16 2.5c-6.35 0-11.5 4.94-11.5 11.03 0 7.78 9.9 15.03 11.5 16.03 1.6-1 11.5-8.25 11.5-16.03C27.5 7.44 22.35 2.5 16 2.5Z" />
    <path fill="#E00034" d="M16 7.5c-3.27 0-5.92 2.56-5.92 5.72 0 2.51 1.67 4.64 3.98 5.4v5.32h3.88v-5.32c2.31-.76 3.98-2.89 3.98-5.4 0-3.16-2.65-5.72-5.92-5.72Zm0 3.25c1.45 0 2.63 1.1 2.63 2.47s-1.18 2.47-2.63 2.47-2.63-1.1-2.63-2.47 1.18-2.47 2.63-2.47Z" />
  </svg>
);

const TwoGisLogo = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true" className="h-8 w-8">
    <circle cx="16" cy="16" r="14" fill="#20A859" />
    <path fill="#fff" d="M9.5 11.2c1.25-1.2 3.04-1.92 5.1-1.92 3.7 0 6.2 2.16 6.2 5.18 0 2.1-1.08 3.38-3.56 4.84l-3.74 2.2h7.46v2.42H10.1v-2.26l5.75-3.53c1.72-1.06 2.3-1.82 2.3-3.39 0-1.8-1.34-3.05-3.45-3.05-1.27 0-2.48.47-3.52 1.4l-1.68-1.89Z" />
  </svg>
);

export const AdDetailsModal: React.FC<AdDetailsModalProps> = ({
  ad,
  onClose,
  currentUser,
  onOpenAuth,
  onRequestPhone,
  onSubmitComplaint
}) => {
  if (!ad) return null;

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [phone, setPhone] = useState<string | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [showPhoneCaptcha, setShowPhoneCaptcha] = useState(false);
  const [phoneCaptchaToken, setPhoneCaptchaToken] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Complaint states
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  const [complaintCaptchaToken, setComplaintCaptchaToken] = useState('');
  const [complaintLoading, setComplaintLoading] = useState(false);
  const [complaintSuccess, setComplaintSuccess] = useState(false);
  const [complaintError, setComplaintError] = useState<string | null>(null);

  const isLost = ad.type === 'lost';

  // Request Phone Handler
  const handleStartPhoneRequest = () => {
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setShowPhoneCaptcha(true);
    setPhoneError(null);
  };

  const handleConfirmPhoneRequest = async () => {
    if (!phoneCaptchaToken) return;
    setPhoneLoading(true);
    setPhoneError(null);
    try {
      const fetchedPhone = await onRequestPhone(ad.id, phoneCaptchaToken);
      setPhone(fetchedPhone);
      setShowPhoneCaptcha(false);
    } catch (err: any) {
      setPhoneError(err.message || 'Ошибка получения номера телефона');
      setPhoneCaptchaToken('');
    } finally {
      setPhoneLoading(false);
    }
  };

  // Complaint Handler
  const handleSendComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintCaptchaToken) return;
    setComplaintLoading(true);
    setComplaintError(null);
    try {
      await onSubmitComplaint(ad.id, complaintCaptchaToken);
      setComplaintSuccess(true);
      setTimeout(() => {
        setShowComplaintModal(false);
        setComplaintSuccess(false);
      }, 2000);
    } catch (err: any) {
      setComplaintError(err.message || 'Не удалось отправить жалобу');
      setComplaintCaptchaToken('');
    } finally {
      setComplaintLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex flex-col justify-end">
        {/* Semi-transparent blur backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm"
        />

        {/* Sliding Apple Liquid Glass Bottom Sheet Card */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative z-10 w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-2xl border-t border-white/60 rounded-t-[36px] shadow-[0_-12px_48px_rgba(0,0,0,0.18)] max-h-[88vh] flex flex-col overflow-hidden text-slate-900"
        >
          {/* iOS Bottom Sheet Drag Handle Bar */}
          <div className="w-full pt-3 pb-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing">
            <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
          </div>

          {/* Top Bar with Title & Close Button */}
          <div className="flex items-center justify-between px-6 py-2.5 border-b border-slate-200/50">
            <div className="flex items-center space-x-2.5">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase shadow-sm ${
                  isLost
                    ? 'bg-[#FF9500]/15 text-[#D97706] border border-[#FF9500]/30'
                    : 'bg-[#34C759]/15 text-[#15803D] border border-[#34C759]/30'
                }`}
              >
                {isLost ? 'Потерялся' : 'Найден'}
              </span>
              <span className="bg-slate-100/80 text-slate-700 text-[11px] px-3 py-1 rounded-full font-medium border border-slate-200/60">
                {ad.category === 'cat' ? '🐱 Кошка' : ad.category === 'dog' ? '🐶 Собака' : '🐾 Питомец'}
              </span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-200/60 text-slate-600 hover:bg-slate-300/80 flex items-center justify-center transition active:scale-90 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Sheet Scrollable Content */}
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            {/* Photos Gallery */}
            {ad.photos && ad.photos.length > 0 && (
              <div className="space-y-3">
                <div className="relative aspect-[4/3] w-full rounded-3xl overflow-hidden bg-slate-100 border border-white/60 shadow-sm">
                  <img
                    src={ad.photos[activePhotoIdx]}
                    alt="Фото питомца"
                    className="w-full h-full object-cover transition duration-300"
                  />

                  {ad.photos.length > 1 && (
                    <>
                      <button
                        onClick={() =>
                          setActivePhotoIdx((activePhotoIdx - 1 + ad.photos.length) % ad.photos.length)
                        }
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full liquid-glass flex items-center justify-center text-slate-800 hover:scale-105 active:scale-95 transition"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setActivePhotoIdx((activePhotoIdx + 1) % ad.photos.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full liquid-glass flex items-center justify-center text-slate-800 hover:scale-105 active:scale-95 transition"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>

                {ad.photos.length > 1 && (
                  <div className="flex justify-center space-x-2 overflow-x-auto py-1">
                    {ad.photos.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActivePhotoIdx(idx)}
                        className={`w-14 h-14 rounded-2xl overflow-hidden border-2 transition cursor-pointer flex-shrink-0 ${
                          activePhotoIdx === idx
                            ? 'border-[#0C8C50] scale-105 shadow-md'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={p} alt="Превью" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pet Name & Main Info */}
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {ad.petName || (isLost ? 'Без клички' : 'Питомец без имени')}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                <div className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Опубликовано: {new Date(ad.createdAt).toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </div>

            {/* Description Box with Apple Liquid Glass Card */}
            <div className="liquid-glass-card p-4 rounded-3xl space-y-1.5">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Описание и приметы
              </h3>
              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-normal">
                {ad.description}
              </p>
            </div>

            {/* Location Pill */}
            <div className="liquid-glass-card p-3.5 rounded-2xl flex items-center space-x-3 text-xs text-slate-700">
              <div className="w-8 h-8 rounded-full bg-[#087747]/10 text-[#0C8C50] flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">Геолокация метки</div>
                <div className="text-[11px] text-slate-500 truncate">
                  {ad.lat.toFixed(6)}, {ad.lng.toFixed(6)}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`https://yandex.ru/maps/?ll=${encodeURIComponent(`${ad.lng},${ad.lat}`)}&z=16&pt=${encodeURIComponent(`${ad.lng},${ad.lat},pm2rdm`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Открыть координаты в Яндекс Картах"
                  title="Яндекс Карты"
                  className="inline-flex rounded-full p-0 transition hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E00034]"
                >
                  <YandexMapsLogo />
                </a>
                <a
                  href={`https://2gis.ru/geo/${ad.lng},${ad.lat}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Открыть координаты в 2ГИС"
                  title="2ГИС"
                  className="inline-flex rounded-full p-0 transition hover:scale-110 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20A859]"
                >
                  <TwoGisLogo />
                </a>
              </div>
            </div>

            {/* Phone Request / Call Action Pill */}
            <div className="pt-2">
              {phone ? (
                <div className="liquid-glass-card border border-emerald-500/30 p-4 rounded-3xl text-center space-y-3">
                  <p className="text-xs text-emerald-700 font-semibold">
                    {ad.contactName}
                  </p>
                  <div className="text-2.5xl font-bold tracking-wider text-slate-900 font-mono">
                    {phone}
                  </div>
                  <a
                    href={`tel:${phone}`}
                    className="w-full bg-[#34C759] hover:bg-emerald-600 text-white font-semibold py-3 px-4 rounded-2xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center space-x-2 text-sm"
                  >
                    <Phone className="w-4 h-4 fill-current" />
                    <span>Позвонить</span>
                  </a>
                </div>
              ) : (
                <button
                  onClick={handleStartPhoneRequest}
                  className="w-full bg-[#087747] hover:bg-[#06683D] text-white font-semibold py-3.5 px-5 rounded-2xl shadow-lg shadow-emerald-700/20 transition active:scale-[0.99] flex items-center justify-center space-x-2 text-sm cursor-pointer"
                >
                  <Phone className="w-4 h-4" />
                  <span>Показать контакты</span>
                </button>
              )}
            </div>

            {/* Discretely placed Complaint Option */}
            <div className="flex justify-center pt-2 pb-2">
              <button
                onClick={() => setShowComplaintModal(true)}
                className="text-xs text-slate-400 hover:text-rose-500 transition flex items-center space-x-1.5 cursor-pointer py-1 px-3 rounded-full hover:bg-slate-100/50"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Пожаловаться на объявление</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Phone CAPTCHA Modal */}
      {showPhoneCaptcha && (
        <div className="fixed inset-0 z-[2200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="liquid-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-slate-900">
            <h3 className="text-base font-bold">
              Защита от спама и парсинга
            </h3>
            <p className="text-xs text-slate-500">
              Для получения номера телефона пройдите проверку безопасности.
            </p>

            <CaptchaWidget
              onVerify={setPhoneCaptchaToken}
              isVerified={Boolean(phoneCaptchaToken)}
            />

            {phoneError && (
              <div className="p-3 bg-rose-500/15 text-rose-600 text-xs rounded-2xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{phoneError}</span>
              </div>
            )}

            <div className="flex space-x-2 pt-2">
              <button
                disabled={!phoneCaptchaToken || phoneLoading}
                onClick={handleConfirmPhoneRequest}
                className="flex-1 bg-[#087747] hover:bg-[#06683D] disabled:opacity-50 text-white font-medium py-2.5 rounded-2xl text-xs transition cursor-pointer"
              >
                {phoneLoading ? 'Загрузка...' : 'Подтвердить и открыть номер'}
              </button>
              <button
                onClick={() => setShowPhoneCaptcha(false)}
                className="bg-slate-200/60 text-slate-600 font-medium px-4 py-2.5 rounded-2xl text-xs transition cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complaint Modal */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-[2200] bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleSendComplaint}
            className="liquid-glass w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 text-slate-900"
          >
            <div className="flex items-center space-x-2 text-rose-500">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="text-base font-bold">
                Жалоба на объявление
              </h3>
            </div>

            {complaintSuccess ? (
              <div className="p-4 bg-emerald-500/15 text-emerald-700 rounded-2xl text-xs text-center flex flex-col items-center space-y-2">
                <Check className="w-8 h-8 text-emerald-500" />
                <span>Жалоба принята. Объявление передано на проверку.</span>
              </div>
            ) : (
              <>
                <CaptchaWidget
                  onVerify={setComplaintCaptchaToken}
                  isVerified={Boolean(complaintCaptchaToken)}
                />

                {complaintError && (
                  <div className="p-2.5 bg-rose-500/15 text-rose-600 text-xs rounded-2xl flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{complaintError}</span>
                  </div>
                )}

                <div className="flex space-x-2 pt-2">
                  <button
                    type="submit"
                    disabled={!complaintCaptchaToken || complaintLoading}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-2xl text-xs transition cursor-pointer"
                  >
                    {complaintLoading ? 'Отправка...' : 'Отправить жалобу'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowComplaintModal(false)}
                    className="bg-slate-200/60 text-slate-600 font-medium px-4 py-2.5 rounded-2xl text-xs transition cursor-pointer"
                  >
                    Отмена
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </AnimatePresence>
  );
};
