import React, { useState } from 'react';
import {
  User as UserIcon,
  Bell,
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
  Activity
} from 'lucide-react';
import { User, AdItem, NotificationItem, SystemLog } from '../types';

interface ProfileViewProps {
  user: User;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  userAds: AdItem[];
  notifications: NotificationItem[];
  onUnpublishAd: (adId: string) => Promise<void>;
  onPrefillCreateAd: (ad: AdItem) => void;
  onUpdateNotificationSettings: (push: boolean, email: boolean) => Promise<void>;
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
  notifications,
  onUnpublishAd,
  onPrefillCreateAd,
  onUpdateNotificationSettings,
  onChangePassword,
  masterUsersList = [],
  onMasterBlockUser,
  onMasterUnblockUser,
  systemLogs = []
}) => {
  const [activeTab, setActiveTab] = useState<'ads' | 'notifs' | 'master' | 'logs'>('ads');

  // Push & Email Settings state
  const [pushEnabled, setPushEnabled] = useState(user.notificationSettings?.push ?? true);
  const [emailEnabled, setEmailEnabled] = useState(user.notificationSettings?.email ?? true);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Account Deletion Modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Password change state
  const [passForm, setPassForm] = useState({ oldPass: '', newPass: '' });
  const [passSuccess, setPassSuccess] = useState(false);

  // Master Block Modal
  const [selectedUserToBlock, setSelectedUserToBlock] = useState<User | null>(null);
  const [blockUntilDate, setBlockUntilDate] = useState('');

  // Combine and sort ads: active first, then unpublished
  const allAds = [...userAds].sort((a, b) => {
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const handleSaveSettings = async (push: boolean, email: boolean) => {
    await onUpdateNotificationSettings(push, email);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
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

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Profile Header Bar */}
      <div className="liquid-glass p-6 rounded-3xl shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-slate-900 dark:text-slate-100">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-[#008E3A] text-white flex items-center justify-center font-bold text-lg shadow-md shadow-emerald-700/20">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{user.name}</h2>
              {user.role === 'master' && (
                <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 text-[10px] font-extrabold px-2 py-0.5 rounded-md flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>МАСТЕР-АККАУНТ</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="liquid-glass-card hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-rose-500 font-medium px-4 py-2 rounded-2xl text-xs flex items-center space-x-1.5 transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Выйти</span>
        </button>
      </div>

      {/* iOS-Style Settings Block */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden text-sm">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Push-уведомления</span>
            <span className="text-[11px] text-slate-500">О новых объявлениях в геоподписке</span>
          </div>
          <input
            type="checkbox"
            checked={pushEnabled}
            onChange={e => { const value = e.target.checked; setPushEnabled(value); handleSaveSettings(value, emailEnabled); }}
            className="w-5 h-5 rounded text-[#008E3A] focus:ring-[#008E3A] cursor-pointer"
          />
        </div>
        
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Email-уведомления</span>
            <span className="text-[11px] text-slate-500">Важные оповещения на почту</span>
          </div>
          <input
            type="checkbox"
            checked={emailEnabled}
            onChange={e => { const value = e.target.checked; setEmailEnabled(value); handleSaveSettings(pushEnabled, value); }}
            className="w-5 h-5 rounded text-[#008E3A] focus:ring-[#008E3A] cursor-pointer"
          />
        </div>

        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col space-y-3">
          <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-semibold">
            <Key className="w-4 h-4 text-slate-400" />
            <span>Смена пароля</span>
          </div>
          <form onSubmit={handleChangePass} className="flex flex-col sm:flex-row gap-3">
            <input
              type="password"
              required
              placeholder="Текущий пароль"
              value={passForm.oldPass}
              onChange={e => setPassForm({ ...passForm, oldPass: e.target.value })}
              className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs bg-slate-50 dark:bg-slate-800"
            />
            <input
              type="password"
              required
              placeholder="Новый пароль"
              value={passForm.newPass}
              onChange={e => setPassForm({ ...passForm, newPass: e.target.value })}
              className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl p-2 text-xs bg-slate-50 dark:bg-slate-800"
            />
            <button
              type="submit"
              className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white font-semibold px-4 py-2 rounded-xl text-xs transition cursor-pointer"
            >
              Обновить
            </button>
          </form>
          {passSuccess && <span className="text-[11px] text-[#008E3A] font-semibold">Пароль успешно изменен</span>}
        </div>

        <div 
          onClick={() => setShowDeleteModal(true)}
          className="px-5 py-4 flex items-center space-x-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer transition"
        >
          <Trash2 className="w-4 h-4" />
          <span className="font-semibold">Удалить аккаунт навсегда</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-2xl overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab('ads')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer whitespace-nowrap ${
            activeTab === 'ads'
              ? 'bg-white dark:bg-slate-900 text-[#008E3A] font-bold shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          Мои объявления ({allAds.length})
        </button>

        <button
          onClick={() => setActiveTab('notifs')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer whitespace-nowrap flex items-center justify-center space-x-1 ${
            activeTab === 'notifs'
              ? 'bg-white dark:bg-slate-900 text-[#008E3A] font-bold shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
          }`}
        >
          <Bell className="w-3.5 h-3.5" />
          <span>Уведомления</span>
        </button>

        {user.role === 'master' && (
          <>
            <button
              onClick={() => setActiveTab('master')}
              className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer whitespace-nowrap text-amber-600 dark:text-amber-400 ${
                activeTab === 'master'
                  ? 'bg-white dark:bg-slate-900 font-bold shadow-sm'
                  : 'hover:text-amber-700'
              }`}
            >
              Мастер-панель
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer whitespace-nowrap text-slate-500 ${
                activeTab === 'logs'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
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
          {allAds.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center space-y-2">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
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
                  className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-sm flex flex-col sm:flex-row items-start justify-between gap-5 transition ${!isActive ? 'opacity-80' : ''}`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-5 flex-1 w-full">
                    <div className="relative shrink-0">
                      <img
                        src={ad.photos[0] || ''}
                        alt="Фото"
                        className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-slate-100 dark:border-slate-800"
                      />
                      <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm whitespace-nowrap ${
                          isActive
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-100'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {isActive ? 'Опубликовано' : 'Снято с публикации'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 flex-1 mt-3 sm:mt-0">
                      <div className="flex flex-col space-y-0.5">
                        <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {ad.petName || ad.category}
                        </span>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                          {ad.description}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-1">
                        <div className="flex items-center space-x-1.5 font-medium text-[#008E3A]">
                          <Eye className="w-4 h-4" />
                          <span>Просмотров: {ad.viewsCount}</span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-4 h-4" />
                          <span>Опубликовано: {new Date(ad.createdAt).toLocaleDateString('ru-RU')}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto shrink-0 flex items-center justify-end">
                    {isActive ? (
                      <button
                        onClick={() => onUnpublishAd(ad.id)}
                        className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 font-semibold px-5 py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Снять с публикации</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => onPrefillCreateAd(ad)}
                        className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-semibold px-5 py-3 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5"
                      >
                        <Repeat className="w-4 h-4" />
                        <span>Опубликовать заново</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: Notifications Feed */}
      {activeTab === 'notifs' && (
        <div className="space-y-6">
          {/* Notifications Feed */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              История уведомлений
            </h3>
            {notifications.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl text-xs text-slate-400 text-center">
                У вас нет новых уведомлений
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#008E3A] dark:text-[#008E3A]">
                      {n.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(n.date).toLocaleString('ru-RU')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 5: Master Control Panel (Master account only) */}
      {activeTab === 'master' && user.role === 'master' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
          <div className="flex items-center space-x-2 text-amber-600">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Управление пользователями и блокировками
            </h3>
          </div>

          <div className="space-y-3">
            {masterUsersList.map(u => (
              <div
                key={u.id}
                className="border border-slate-100 dark:border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center space-x-2 text-slate-700 dark:text-slate-200 font-bold text-sm">
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

      {/* Account Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[2100] bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-rose-600 flex items-center space-x-2">
              <Trash2 className="w-5 h-5" />
              <span>Подтверждение удаления аккаунта</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
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
                className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-amber-600">
              Блокировка пользователя {selectedUserToBlock.email}
            </h3>
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Дата окончания блокировки (Оставьте пустым для бессрочной блокировки):
              </label>
              <input
                type="date"
                value={blockUntilDate}
                onChange={e => setBlockUntilDate(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs bg-slate-50 dark:bg-slate-800"
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
                className="bg-slate-100 dark:bg-slate-800 text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
