import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { ArrowLeft, ArrowRight, Upload, Trash2, MapPin, Sparkles, CheckCircle2, AlertCircle, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdType, AdCategory } from '../types';
import { CaptchaWidget } from './CaptchaWidget';
import { cartoPickerTileUrl, useSystemDarkMode } from '../theme';
import { getCurrentLocation, isGeolocationPermissionDenied } from '../geolocation';

interface CreateAdWizardProps {
  onClose: () => void;
  onSubmit: (adData: any) => Promise<{ status: string; ad: any; requestId?: string }>;
  onReportIssue: (ad: any, requestId?: string) => void;
  prefillData?: any;
}

export const CreateAdWizard: React.FC<CreateAdWizardProps> = ({
  onClose,
  onSubmit,
  onReportIssue,
  prefillData
}) => {
  const isDarkMode = useSystemDarkMode();
  const [step, setStep] = useState(1);
  const [currentAdId, setCurrentAdId] = useState<string | undefined>(prefillData?.id);

  // Form State
  const [type, setType] = useState<AdType>(prefillData?.type || 'lost');
  const [category, setCategory] = useState<AdCategory>(prefillData?.category || 'cat');
  const [photos, setPhotos] = useState<string[]>(prefillData?.photos || []);
  const [petName, setPetName] = useState(prefillData?.petName || '');
  const [contactName, setContactName] = useState(prefillData?.contactName || '');
  const [phone, setPhone] = useState(() => formatPhone(prefillData?.phone || '+7'));
  const [description, setDescription] = useState(prefillData?.description || '');
  const [lat, setLat] = useState<number>(prefillData?.lat || 55.751244);
  const [lng, setLng] = useState<number>(prefillData?.lng || 37.598418);
  const [captchaToken, setCaptchaToken] = useState('');

  // Status & Error handling
  const [error, setError] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationResult, setModerationResult] = useState<'success' | 'pending' | 'rejected' | null>(null);
  const [lastModerationRequestId, setLastModerationRequestId] = useState<string | undefined>();

  // Map Picker Ref
  const pickerMapRef = useRef<HTMLDivElement>(null);
  const leafletPickerMap = useRef<L.Map | null>(null);
  const pickerTileLayer = useRef<L.TileLayer | null>(null);
  const pickerMarker = useRef<L.Marker | null>(null);

  // Photo upload handler
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    if (photos.length + files.length > 3) {
      setError('Максимум 3 фотографии разрешено');
      return;
    }

    Array.from(files).forEach((file: File) => {
      // Validate file size (<= 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError(`Файл ${file.name} превышает допустимый размер 10 МБ`);
        return;
      }

      // Check format
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError(`Формат ${file.name} не поддерживается (разрешены JPEG, PNG, WebP)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = event => {
        const result = event.target?.result as string;
        if (result) {
          // Check image resolution (400x400 to 12000x12000)
          const img = new Image();
          img.onload = () => {
            if (img.width < 400 || img.height < 400) {
              setError(`Разрешение фото должно быть не менее 400x400 px`);
              return;
            }
            if (img.width > 12000 || img.height > 12000) {
              setError(`Разрешение фото слишком большое (макс 12000x12000 px)`);
              return;
            }
            setPhotos(prev => [...prev, result]);
            setError(null);
          };
          img.src = result;
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  function formatPhone(value: string) {
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
    if (!digits) return '+7';
    if (!digits.startsWith('7')) return `+${digits.slice(0, 15)}`;
    digits = digits.slice(0, 11);
    const area = digits.slice(1, 4);
    const first = digits.slice(4, 7);
    const second = digits.slice(7, 9);
    const third = digits.slice(9, 11);
    let result = '+7';
    if (area) result += ` (${area}`;
    if (area.length === 3) result += ')';
    if (first) result += ` ${first}`;
    if (second) result += `-${second}`;
    if (third) result += `-${third}`;
    return result;
  }

  const handlePhoneChange = (val: string) => {
    setPhone(formatPhone(val));
  };

  // Fetch Location Handler
  const handleGetLocation = async () => {
    setLocationLoading(true);
    try {
      const { coords: { latitude, longitude } } = await getCurrentLocation();
      setLat(latitude);
      setLng(longitude);
      setError(null);
      if (leafletPickerMap.current && pickerMarker.current) {
        leafletPickerMap.current.setView([latitude, longitude], 16);
        pickerMarker.current.setLatLng([latitude, longitude]);
      }
    } catch (locationError) {
      setError(
        isGeolocationPermissionDenied(locationError)
          ? 'Нет доступа к геолокации. Разрешите местоположение для LostHvost или Safari в настройках устройства, затем повторите попытку.'
          : 'Не удалось определить местоположение. Проверьте GPS и подключение к интернету или выберите точку вручную.'
      );
    } finally {
      setLocationLoading(false);
    }
  };

  // Init Step 4 Map Picker
  useEffect(() => {
    if (step === 4 && pickerMapRef.current && !leafletPickerMap.current) {
      const map = L.map(pickerMapRef.current, {
        center: [lat, lng],
        zoom: 14,
        zoomControl: false
      });

      pickerTileLayer.current = L.tileLayer(cartoPickerTileUrl(isDarkMode), {
        maxZoom: 19
      }).addTo(map);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'pin-picker-marker',
        html: `<div style="background: #008E3A; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); font-size: 16px;">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      pickerMarker.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map);

      pickerMarker.current.on('dragend', (e: any) => {
        const latlng = e.target.getLatLng();
        setLat(latlng.lat);
        setLng(latlng.lng);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        setLat(e.latlng.lat);
        setLng(e.latlng.lng);
        pickerMarker.current?.setLatLng(e.latlng);
      });

      leafletPickerMap.current = map;
    }
  }, [step, isDarkMode]);

  useEffect(() => {
    pickerTileLayer.current?.setUrl(cartoPickerTileUrl(isDarkMode));
  }, [isDarkMode]);

  // Validation before next step
  const validateAndNext = () => {
    setError(null);
    if (step === 1) {
      if (!type) return setError('Выберите тип объявления');
    } else if (step === 2) {
      if (!category) return setError('Выберите категорию животного');
    } else if (step === 3) {
      if (photos.length < 1) return setError('Загрузите хотя бы 1 фотографию (максимум 3)');
      if (type === 'lost' && !petName.trim()) {
        return setError('Укажите кличку животного');
      }
      if (!description.trim() || description.trim().length < 10) {
        return setError('Укажите подробное описание и приметы (не менее 10 символов)');
      }
      if (!contactName.trim()) return setError('Укажите имя контактного лица');
      if (phone.replace(/\D/g, '').length !== 11) return setError('Укажите корректный номер телефона');
    }
    setStep(prev => prev + 1);
  };

  // Submit Handler
  const handleSubmit = async () => {
    setError(null);
    if (!captchaToken) {
      setError('Пройдите проверку CAPTCHA');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await onSubmit({
        ...(currentAdId ? { id: currentAdId } : {}),
        type,
        category,
        photos,
        petName,
        contactName,
        phone,
        description,
        lat,
        lng,
        captchaToken
      });

      setCurrentAdId(res.ad?.id || currentAdId);
      setLastModerationRequestId(res.requestId);

      if (res.status === 'active') {
        setModerationResult('success');
      } else if (res.status === 'pending_moderation') {
        setModerationResult('pending');
      } else {
        setModerationResult('rejected');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка создания объявления');
      setCaptchaToken('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-md"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 liquid-glass w-full max-w-lg rounded-3xl overflow-hidden my-auto flex flex-col max-h-[92vh] text-slate-900 dark:text-slate-100 shadow-2xl"
        >
          {/* Header */}
        <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">
              Новое объявление ({step} из 5)
            </h2>
            <div className="w-48 bg-slate-200/60 dark:bg-slate-800/60 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-[#008E3A] h-full transition-all duration-300"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800/60 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition text-xs font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Wizard Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-center space-x-2 border border-rose-200 dark:border-rose-900">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Type */}
          {step === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Шаг 1: Укажите тип объявления
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType('lost')}
                  className={`p-4 rounded-xl border-2 text-center transition cursor-pointer ${
                    type === 'lost'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">🔍</span>
                  <span className="text-sm">ПОТЕРЯЛ</span>
                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-1">
                    Мой питомец убежал или потерялся
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setType('found')}
                  className={`p-4 rounded-xl border-2 text-center transition cursor-pointer ${
                    type === 'found'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="text-2xl block mb-1">🏠</span>
                  <span className="text-sm">НАШЁЛ</span>
                  <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-1">
                    Я нашел чужого питомца
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Category */}
          {step === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Шаг 2: Выберите категорию животного
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'cat', label: 'Кошка', icon: '🐱' },
                  { id: 'dog', label: 'Собака', icon: '🐶' },
                  { id: 'other', label: 'Другое', icon: '🐾' }
                ].map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategory(item.id as AdCategory)}
                    className={`p-4 rounded-xl border-2 text-center transition cursor-pointer ${
                      category === item.id
                        ? 'border-[#008E3A] bg-emerald-50 dark:bg-emerald-950/40 text-[#008E3A] font-bold'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-2xl block mb-1">{item.icon}</span>
                    <span className="text-xs">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Photos, pet and contact details */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Шаг 3: Данные объявления
                </h3>
                <span className="text-xs text-slate-500">{photos.length} / 3</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {photos.map((p, idx) => (
                  <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <img src={p} alt="Загруженное фото" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-rose-600 text-white p-1 rounded-full shadow hover:bg-rose-700 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {photos.length < 3 && (
                  <label className="aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#008E3A] dark:hover:border-[#008E3A] flex flex-col items-center justify-center p-2 text-center cursor-pointer transition bg-slate-50 dark:bg-slate-800/40">
                    <Upload className="w-6 h-6 text-slate-400 mb-1" />
                    <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      Добавить фото
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Поддерживаются JPEG, PNG, WebP до 10 МБ. Основным объектом на фото должно быть животное.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Кличка {type === 'lost' ? <span className="text-rose-500">* (Обязательно)</span> : '(Если известна)'}
                </label>
                <input
                  type="text"
                  value={petName}
                  onChange={e => setPetName(e.target.value)}
                  placeholder={type === 'lost' ? 'Например: Барсик' : 'Например: Мухтар (если есть ошейник)'}
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#008E3A]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Описание и особые приметы <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Опишите окрас, породу, ошейник, состояние здоровья, где виден питомец..."
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#008E3A]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Имя контактного лица <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="Ваше имя"
                  className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#008E3A]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Номер телефона <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={18}
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    placeholder="+7 (916) 123-45-67"
                    className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 pl-9 text-xs font-mono bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#008E3A]"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Номер телефона защищен и передается только авторизованным пользователям после прохождения CAPTCHA.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: Location */}
          {step === 4 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Шаг 4: Укажите точное место на карте
              </h3>
              <p className="text-xs text-slate-500">
                Кликните по карте или перетащите маркер в точку пропажи / обнаружения.
              </p>

              <button
                type="button"
                onClick={handleGetLocation}
                disabled={locationLoading}
                className="w-full flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-xl transition text-xs font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-wait"
              >
                <MapPin className={`w-4 h-4 ${locationLoading ? 'animate-pulse' : ''}`} />
                <span>{locationLoading ? 'Определяем местоположение…' : 'Использовать моё текущее местоположение'}</span>
              </button>

              <div className="relative w-full h-56 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                <div ref={pickerMapRef} className="w-full h-full" />
              </div>

              <div className="text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg">
                Координаты: {lat.toFixed(6)}, {lng.toFixed(6)}
              </div>
            </div>
          )}

          {/* STEP 5: Moderation & Publish */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Шаг 5: Проверка безопасности и публикация
              </h3>

              {!moderationResult ? (
                <>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                    <p className="font-semibold">Проверьте данные объявления перед отправкой:</p>
                    <p>• Тип: {type === 'lost' ? 'Потерял' : 'Нашёл'} ({category === 'cat' ? 'Кошка' : category === 'dog' ? 'Собака' : 'Другое'})</p>
                    <p>• Кличка: {petName || 'Не указана'}</p>
                    <p>• Контакт: {contactName} ({phone})</p>
                    <p>• Фотографий: {photos.length} шт.</p>
                  </div>

                  <CaptchaWidget
                    onVerify={setCaptchaToken}
                    isVerified={Boolean(captchaToken)}
                  />

                  <button
                    disabled={!captchaToken || isSubmitting}
                    onClick={handleSubmit}
                    className="w-full bg-[#008E3A] hover:bg-[#007A32] disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow transition flex items-center justify-center space-x-2 text-xs cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Объявление на модерации с ИИ</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Опубликовать объявление</span>
                      </>
                    )}
                  </button>
                </>
              ) : moderationResult === 'success' ? (
                <div className="p-5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 text-emerald-800 dark:text-emerald-200 rounded-2xl text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="font-bold text-sm">Объявление прошло модерацию и опубликовано!</h4>
                  <p className="text-xs">Оно появится на карте и просуществует 7 суток.</p>
                  <button
                    onClick={onClose}
                    className="mt-2 bg-emerald-600 text-white font-medium px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Перейти к карте
                  </button>
                </div>
              ) : moderationResult === 'pending' ? (
                <div className="p-5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 text-amber-800 dark:text-amber-200 rounded-2xl text-center space-y-2">
                  <Sparkles className="w-10 h-10 text-amber-500 mx-auto animate-pulse" />
                  <h4 className="font-bold text-sm">Ожидает автоматической модерации</h4>
                  <p className="text-xs">Сервис нейросети временно перезагружается. Проверка выполнится автоматически в ближайшее время.</p>
                  <button
                    onClick={onClose}
                    className="mt-2 bg-amber-600 text-white font-medium px-4 py-2 rounded-xl text-xs cursor-pointer"
                  >
                    Закрыть
                  </button>
                </div>
              ) : (
                <div className="p-5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-800 dark:text-rose-200 rounded-2xl text-center space-y-2">
                  <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
                  <h4 className="font-bold text-sm">Объявление отклонено модератором</h4>
                  <p className="text-xs">Содержание или фотография не соответствуют правилам публикации домашних животных.</p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      onClick={() => { setModerationResult(null); setCaptchaToken(''); setStep(3); }}
                      className="flex-1 bg-rose-600 text-white font-medium px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                    >
                      Изменить объявление
                    </button>
                    <button
                      onClick={() => onReportIssue({ id: currentAdId, status: 'rejected' }, lastModerationRequestId)}
                      className="flex-1 bg-white/70 dark:bg-slate-900/60 text-rose-700 dark:text-rose-200 font-medium px-4 py-2.5 rounded-xl text-xs cursor-pointer border border-rose-200 dark:border-rose-800"
                    >
                      Сообщить о проблеме
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        {!moderationResult && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(prev => prev - 1)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold flex items-center space-x-1.5 transition cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Назад</span>
              </button>
            ) : (
              <div />
            )}

            {step < 5 && (
              <button
                type="button"
                onClick={validateAndNext}
                className="px-6 py-2.5 rounded-xl bg-[#008E3A] hover:bg-[#007A32] text-white text-sm font-semibold flex items-center space-x-1.5 shadow-md shadow-emerald-700/20 transition cursor-pointer"
              >
                <span>Далее</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
    </AnimatePresence>
  );
};
