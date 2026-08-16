import React, { useEffect, useState } from 'react';
import {
  User as UserIcon,
  Eye,
  Calendar,
  LogOut,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Repeat,
  XCircle,
  Key,
  ListFilter,
  CheckCircle2,
  Lock,
  Unlock,
  Activity,
  ChevronRight,
  Mail,
  Loader2
} from 'lucide-react';
import { User, AdItem, SystemLog } from '../types';
import { PUSH_UNSUPPORTED_ERROR, PwaInstallGuideModal, PwaPushUnsupportedMessage } from './PwaInstallGuideModal';

interface ProfileViewProps {
  user: User;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  userAds: AdItem[];
  userAdsLoading: boolean;
  onUnpublishAd: (adId: string) => Promise<void>;
  onRepublishAd: (adId: string) => Promise<void>;
  onPrefillCreateAd: (ad: AdItem) => void;
  onUpdateNotificationSettings: (push: boolean, email: boolean, telegram: boolean) => Promise<void>;
  onOpenDeveloperContact: () => void;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  // Master methods
  masterUsersList?: User[];
  onMasterBlockUser?: (targetUserId: string, blockUntil?: string) => Promise<void>;
  onMasterUnblockUser?: (targetUserId: string) => Promise<void>;
  systemLogs?: SystemLog[];
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onLogout,
  onDeleteAccount,
  userAds,
  userAdsLoading,
  onUnpublishAd,
  onRepublishAd,
  onPrefillCreateAd,
  onUpdateNotificationSettings,
  onOpenDeveloperContact,
  onChangePassword,
  masterUsersList = [],
  onMasterBlockUser,
  onMasterUnblockUser,
  systemLogs = []
}) => {
  const [activeTab, setActiveTab] = useState<'ads' | 'master' | 'logs'>('ads');

  // Push settings state
  const [pushEnabled, setPushEnabled] = useState(user.notificationSettings?.push ?? false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [showPwaInstallGuide, setShowPwaInstallGuide] = useState(false);
  const [republishingAdId, setRepublishingAdId] = useState<string | null>(null);

  // Account Deletion Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Password change state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '' });
  const [passSuccess, setPassSuccess] = useState(false);

  // Master Block Modal
  const [selectedUserToBlock, setSelectedUserToBlock] = useState<User | null>(null);
  const [blockUntilDate, setBlockUntilDate] = useState('');

  useEffect(() => {
    setPushEnabled(user.notificationSettings?.push ?? false);
  }, [user]);

  // Combine and sort ads: active first, then unpublished
  const allAds = [...userAds].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleSaveSettings = async (push: boolean) => {
    setNotificationError(null);
    try {
      await onUpdateNotificationSettings(push, user.notificationSettings?.email ?? false, user.notificationSettings?.telegram ?? false);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (error: any) {
      setPushEnabled(user.notificationSettings?.push ?? false);
      setNotificationError(error?.message || 'Не удалось включить уведомления');
    }
  };
  const handleRepublish = async (adId: string) => {
    setRepublishingAdId(adId);
    try {
      await onRepublishAd(adId);
    } finally {
      setRepublishingAdId(null);
    }
  };

  const handleConfirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await onDeleteAccount();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleChangePass = async (e: React.FormEvent) => {
    e.preventDefault();
    await onChangePassword(passForm.oldPass, passForm.newPass);
    setPassSuccess(true); setTimeout(() => setPassSuccess(false), 2000); setPassForm({ oldPass: '', newPass: '' });
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPassForm({ oldPass: '', newPass: '' });
    setPassSuccess(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Profile Header Bar */}
      <div className="liquid-glass p-6 rounded-3xl shadow-lg flex items-center justify-between gap-4 text-slate-900">
        <div className="min-w-0 flex items-center space-x-3">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`Аватар ${user.name}`}
              className="w-12 h-12 rounded-2xl object-cover shadow-md shadow-emerald-700/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-[#087747] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-700/20">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center space-x-2">
              <h2 className="truncate text-lg font-bold text-slate-900">{user.name}</h2>
              {user.role === 'master' && (
                <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>МАСТЕР-АККАУНТ</span>
                </span>
              )}
            </div>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          title="Выйти"
          aria-label="Выйти из аккаунта"
          className="w-9 h-9 shrink-0 liquid-glass-card hover:bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* iOS-Style Settings Block */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden text-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800">Push-уведомления</span>
            <span className="text-[11px] text-slate-500">О новых объявлениях в геоподписке</span>
          </div>
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={e => { const value = e.target.checked; setPushEnabled(value); handleSaveSettings(value); }}
            className="w-5 h-5 rounded text-[#0C8C50] focus:ring-[#0C8C50] cursor-pointer"
          />
        </div>
        {notificationError === PUSH_UNSUPPORTED_ERROR ? (
          <div className="border-b border-slate-100 px-5 py-3">
            <PwaPushUnsupportedMessage onOpenGuide={() => setShowPwaInstallGuide(true)} />
          </div>
        ) : notificationError ? (
          <p className="border-b border-slate-100 px-5 py-3 text-xs font-semibold text-rose-600">{notificationError}</p>
        ) : null}

        <button
          type="button"
          onClick={() => setShowPasswordModal(true)}
          className="w-full px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
        >
          <span className="flex items-center space-x-3">
            <Key className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-800">Смена пароля</span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        <button
          type="button"
          onClick={onOpenDeveloperContact}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
        >
          <span className="flex items-center space-x-3">
            <Mail className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-800">Связаться с разработчиком</span>
          </span>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ads')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'ads'
              ? 'bg-white text-[#0C8C50] font-bold shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Мои объявления ({userAdsLoading ? '…' : allAds.length})
        </button>

        {user.role === 'master' && (
          <>
            <button
              onClick={() => setActiveTab('master')}
              className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer whitespace-nowrap text-amber-600 ${
                activeTab === 'master'
                  ? 'bg-white font-bold shadow-sm'
                  : 'hover:text-amber-700'
              }`}
            >
              Мастер-панель
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer whitespace-nowrap text-slate-500 ${
                activeTab === 'logs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : ''
              }`}
            >
              Логи
            </button>
          </>
        )}
      </div>

      {/* TAB 1: All Ads */}
      {activeTab === 'ads' && (
        <div className="space-y-4">
          {userAdsLoading ? (
            <div className="bg-white border border-slate-200 p-8 rounded-2xl flex items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin text-[#0C8C50]" />
              <span>Загружаем объявления…</span>
            </div>
          ) : allAds.length === 0 ? (
            <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center space-y-2">
              <p className="text-sm font-medium text-slate-600">
                У вас нет объявлений
              </p>
              <p className="text-xs text-slate-400">
                Созданные вами объявления будут отображаться здесь.
              </p>
            </div>
          ) : (
            allAds.map(ad => {
              const isActive = ad.status === 'active';
              return (
                <div
                  key={ad.id}
                  className={`bg-white border border-slate-200 p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row items-start justify-between gap-5 transition ${!isActive ? 'opacity-80' : ''}`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-5 flex-1 w-full">
                    <div className="relative shrink-0">
                      <img
                        src={ad.photos[0] || ''}
                        alt="Фото"
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-slate-100"
                      />
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isActive ? 'Активно' : ad.status === 'rejected' ? 'Отклонено' : ad.status === 'pending_moderation' ? 'На модерации' : 'Снято с публикации'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 flex-1 mt-3 sm:mt-0">
                      <div className="flex flex-col space-y-0.5">
                        <span className="text-base font-bold text-slate-900">
                          {ad.petName || 'Питомец без имени'}
                        </span>
                        <p className="text-sm text-slate-500 line-clamp-2 leading-snug">
                          {ad.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
                        <div className="flex items-center gap-1 font-medium text-[#0C8C50]" title={`Просмотров: ${ad.viewsCount}`} aria-label={`Просмотров: ${ad.viewsCount}`}>
                          <Eye className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-1" title={`Опубликовано: ${new Date(ad.createdAt).toLocaleDateString('ru-RU')}`} aria-label={`Опубликовано: ${new Date(ad.createdAt).toLocaleDateString('ru-RU')}`}>
                          <Calendar className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
                    {isActive ? (
                      <button
                        onClick={() => onUnpublishAd(ad.id)}
                        className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold px-5 py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Снять с публикации</span>
                      </button>
                    ) : ad.status === 'unpublished' ? (
                      <button
                        onClick={() => handleRepublish(ad.id)}
                        disabled={republishingAdId === ad.id}
                        className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-5 py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-60 disabled:cursor-wait"
                      >
                        {republishingAdId === ad.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat className="w-4 h-4" />}
                        <span>{republishingAdId === ad.id ? 'Публикуем…' : 'Опубликовать заново'}</span>
                      </button>
                    ) : ad.status === 'rejected' ? (
                      <button
                        onClick={() => onPrefillCreateAd(ad)}
                        className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-5 py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Repeat className="w-4 h-4" />
                        <span>Изменить объявление</span>
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Проверяем объявление…</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 5: Master Control Panel (Master account only) */}
      {activeTab === 'master' && user.role === 'master' && (
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-amber-600">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900">
              Управление пользователями и блокировками
            </h3>
          </div>

          <div className="space-y-3">
            {masterUsersList.map(u => (
              <div
                key={u.id}
                className="border border-slate-100 p-3 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800 flex items-center space-x-2">
                    <span>{u.name} ({u.email})</span>
                    {u.isBlocked && (
                      <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        ЗАБЛОКИРОВАН {u.blockUntil ? `до ${new Date(u.blockUntil).toLocaleDateString('ru-RU')}` : 'бессрочно'}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    Зарегистрирован: {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>

                {u.id !== user.id && (
                  <div>
                    {u.isBlocked ? (
                      <button
                        onClick={() => onMasterUnblockUser && onMasterUnblockUser(u.id)}
                        className="bg-emerald-50 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Разблокировать</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelectedUserToBlock(u)}
                        className="bg-rose-50 text-rose-700 font-semibold px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Заблокировать</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: System Logs Inspector */}
      {activeTab === 'logs' && user.role === 'master' && (
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-slate-700 font-bold text-sm">
            <Activity className="w-4 h-4 text-blue-600" />
            <span>Системный и аудитный журнал (Логи)</span>
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 font-mono text-[11px]">
            {systemLogs.map(l => (
              <div
                key={l.id}
                className={`p-2.5 rounded-lg border ${
                  l.result === 'success'
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : l.result === 'warning'
                    ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div className="flex justify-between font-bold text-[10px]">
                  <span>[{l.timestamp.substring(11, 19)}] {l.type} - {l.component}</span>
                  <span>{l.result.toUpperCase()}</span>
                </div>
                <p className="mt-0.5">{l.details}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="text-[11px] text-slate-400 hover:text-rose-600 transition cursor-pointer"
        >
          Удалить аккаунт
        </button>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[2100] bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-slate-900">
              <Key className="w-5 h-5 text-[#0C8C50]" />
              <h3 className="text-base font-bold">Смена пароля</h3>
            </div>
            <p className="text-xs text-slate-500">Введите текущий пароль и новый пароль длиной не менее 10 символов.</p>
            <form onSubmit={handleChangePass} className="space-y-3">
              <input
                type="password"
                required
                placeholder="Текущий пароль"
                value={passForm.oldPass}
                onChange={e => setPassForm({ ...passForm, oldPass: e.target.value })}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50"
              />
              <input
                type="password"
                required
                minLength={10}
                placeholder="Новый пароль"
                value={passForm.newPass}
                onChange={e => setPassForm({ ...passForm, newPass: e.target.value })}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50"
              />
              {passSuccess && <p className="text-[11px] text-[#0C8C50] font-semibold">Пароль успешно изменён</p>}
              <div className="flex space-x-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-[#087747] hover:bg-[#06683D] text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Обновить пароль
                </button>
                <button
                  type="button"
                  onClick={closePasswordModal}
                  className="bg-slate-100 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[2100] bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-600 flex items-center space-x-2">
              <Trash2 className="w-5 h-5" />
              <span>Подтверждение удаления аккаунта</span>
            </h3>
            <p className="text-xs text-slate-600">
              Вы уверены, что хотите удалить свой аккаунт? Все ваши активные и завершенные объявления будут сняты и удалены без возможности восстановления.
            </p>
            <div className="flex space-x-2 pt-2">
              <button
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs transition cursor-pointer"
              >
                {deleteLoading ? 'Удаление...' : 'Да, удалить'}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="bg-slate-100 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Master Block User Modal */}
      {selectedUserToBlock && (
        <div className="fixed inset-0 z-[2100] bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-amber-600">
              Блокировка пользователя {selectedUserToBlock.email}
            </h3>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700">
                Дата окончания блокировки (Оставьте пустым для бессрочной блокировки):
              </label>
              <input
                type="date"
                value={blockUntilDate}
                onChange={e => setBlockUntilDate(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50"
              />
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={async () => {
                  if (onMasterBlockUser && selectedUserToBlock) {
                    await onMasterBlockUser(selectedUserToBlock.id, blockUntilDate || undefined);
                    setSelectedUserToBlock(null);
                    setBlockUntilDate('');
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Подтвердить блокировку
              </button>
              <button
                onClick={() => setSelectedUserToBlock(null)}
                className="bg-slate-100 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {showPwaInstallGuide && <PwaInstallGuideModal onClose={() => setShowPwaInstallGuide(false)} />}
    </div>
  );
};
