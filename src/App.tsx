import React, { useState, useEffect, useCallback } from 'react';
import { MapView } from './components/MapView';
import { AdDetailsModal } from './components/AdDetailsModal';
import { CreateAdWizard } from './components/CreateAdWizard';
import { ProfileView } from './components/ProfileView';
import { AuthModal } from './components/AuthModal';
import { BottomNav } from './components/BottomNav';
import { PublicAdItem, User, GeoSubscription, NotificationItem, AdItem, SystemLog } from './types';

async function jsonFetch(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Сервер временно недоступен');
  return data;
}

function urlBase64ToUint8Array(value: string) {
  const padded = (value + '='.repeat((4 - value.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeScreen, setActiveScreen] = useState<'map' | 'profile'>('map');
  const [ads, setAds] = useState<PublicAdItem[]>([]);
  const [selectedAd, setSelectedAd] = useState<PublicAdItem | null>(null);
  const [userAds, setUserAds] = useState<AdItem[]>([]);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [prefillAdData, setPrefillAdData] = useState<any | null>(null);
  const [geoSub, setGeoSub] = useState<GeoSubscription | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [masterUsers, setMasterUsers] = useState<User[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

  useEffect(() => {
    jsonFetch('/api/auth/me').then(data => setCurrentUser(data.user)).finally(() => setAuthReady(true));
    const params = new URLSearchParams(location.search);
    const resetToken = params.get('reset');
    if (resetToken) {
      const password = window.prompt('Введите новый пароль (минимум 10 символов)');
      if (password) jsonFetch('/api/auth/password/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: resetToken, password }) }).then(() => alert('Пароль изменён. Войдите с новым паролем.')).catch(error => alert(error.message)).finally(() => history.replaceState({}, '', '/'));
    }
  }, []);

  const fetchAds = useCallback(async (minLat?: number, maxLat?: number, minLng?: number, maxLng?: number) => {
    const params = new URLSearchParams();
    if ([minLat, maxLat, minLng, maxLng].every(value => value !== undefined)) {
      params.set('minLat', String(minLat)); params.set('maxLat', String(maxLat)); params.set('minLng', String(minLng)); params.set('maxLng', String(maxLng));
    }
    try { const data = await jsonFetch(`/api/ads${params.size ? `?${params}` : ''}`); setAds(data.ads || []); } catch (error) { console.error(error); }
  }, []);

  const fetchUserData = useCallback(async () => {
    if (!currentUser) { setUserAds([]); setNotifications([]); setGeoSub(null); return; }
    try {
      const [subData, notificationData, adData] = await Promise.all([jsonFetch('/api/subscription'), jsonFetch('/api/notifications'), jsonFetch('/api/user/ads')]);
      setGeoSub(subData.subscription || null); setNotifications(notificationData.notifications || []); setUserAds(adData.ads || []);
      if (currentUser.role === 'master') {
        const [usersData, logsData] = await Promise.all([jsonFetch('/api/master/users'), jsonFetch('/api/logs')]);
        setMasterUsers(usersData.users || []); setSystemLogs(logsData.logs || []);
      }
    } catch (error) { console.error(error); }
  }, [currentUser]);

  useEffect(() => { fetchAds(); }, [fetchAds]);
  useEffect(() => { if (authReady) fetchUserData(); }, [authReady, fetchUserData]);

  const handleLoginApi = async (email: string, password: string, captchaToken: string) => (await jsonFetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, captchaToken }) })).user;
  const handleRegisterApi = async (email: string, password: string, name: string, captchaToken: string) => (await jsonFetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name, captchaToken }) })).user;
  const handleRecoveryApi = async (email: string, captchaToken: string) => { await jsonFetch('/api/auth/password/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, captchaToken }) }); };
  const handleYandexApi = async () => { const data = await jsonFetch('/api/auth/yandex/start', { method: 'POST' }); location.assign(data.url); };
  const handleLogout = async () => { await jsonFetch('/api/auth/logout', { method: 'POST' }); setCurrentUser(null); setActiveScreen('map'); };
  const handleDeleteAccount = async () => { const data = await jsonFetch('/api/auth/delete-account', { method: 'POST' }); if (data.deleted) { setCurrentUser(null); setActiveScreen('map'); } else alert('На вашу почту отправлена ссылка для подтверждения удаления.'); };
  const handleChangePassword = async (currentPassword: string, newPassword: string) => { await jsonFetch('/api/auth/password/change', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) }); };
  const handleRequestPhone = async (adId: string, captchaToken: string) => (await jsonFetch(`/api/ads/${adId}/phone`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captchaToken }) })).phone;
  const handleSubmitComplaint = async (adId: string, reason: string, captchaToken: string) => { await jsonFetch(`/api/ads/${adId}/complaint`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ captchaToken, reason }) }); fetchAds(); };
  const handleCreateAdSubmit = async (adData: any) => { const data = await jsonFetch('/api/ads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(adData) }); fetchAds(); fetchUserData(); return { status: data.status, ad: data.ad }; };
  const handleUnpublishAd = async (adId: string) => { await jsonFetch(`/api/ads/${adId}/unpublish`, { method: 'POST' }); fetchAds(); fetchUserData(); };
  const handleSelectAd = useCallback(async (ad: PublicAdItem) => { try { const data = await jsonFetch(`/api/ads/${ad.id}`); setSelectedAd(data.ad); } catch (error: any) { alert(error.message); } }, []);
  useEffect(() => {
    const sharedAdId = new URLSearchParams(location.search).get('ad');
    if (!sharedAdId) return;
    handleSelectAd({ id: sharedAdId } as PublicAdItem);
  }, [handleSelectAd]);
  const handleSaveSubscription = async (lat: number, lng: number, radius: number) => { const data = await jsonFetch('/api/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lat, lng, radius }) }); setGeoSub(data.subscription); };
  const handleDeleteSubscription = async () => { await jsonFetch('/api/subscription', { method: 'DELETE' }); setGeoSub(null); };

  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Push-уведомления запрещены браузером');
    const registration = await navigator.serviceWorker.ready;
    const { publicKey } = await jsonFetch('/api/push/public-key');
    if (!publicKey) return;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    await jsonFetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription) });
  };
  const handleUpdateNotificationSettings = async (push: boolean, email: boolean) => { if (push) await enablePush(); const data = await jsonFetch('/api/user/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ push, email }) }); setCurrentUser(data.user); if (!push) setGeoSub(null); };
  const handleMasterBlockUser = async (targetUserId: string, blockUntil?: string) => { await jsonFetch('/api/master/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUserId, blockUntil }) }); fetchUserData(); fetchAds(); };
  const handleMasterUnblockUser = async (targetUserId: string) => { await jsonFetch('/api/master/unblock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUserId }) }); fetchUserData(); };
  const handleCreateClick = () => { if (!currentUser) setShowAuthModal(true); else { setPrefillAdData(null); setShowCreateWizard(true); } };

  return <div className="app-shell min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
    <BottomNav activeScreen={activeScreen} onNavigate={setActiveScreen} onCreateAdClick={handleCreateClick} currentUser={currentUser} onOpenAuth={() => setShowAuthModal(true)} />
    <main className="flex-1 pb-20">{activeScreen === 'map' ? <MapView ads={ads} onSelectAd={handleSelectAd} onViewportChange={fetchAds} geoSubscription={geoSub} onSaveSubscription={handleSaveSubscription} onDeleteSubscription={handleDeleteSubscription} isLoggedIn={Boolean(currentUser)} onOpenAuth={() => setShowAuthModal(true)} /> : currentUser ? <ProfileView user={currentUser} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} onChangePassword={handleChangePassword} userAds={userAds} notifications={notifications} onUnpublishAd={handleUnpublishAd} onPrefillCreateAd={ad => { setPrefillAdData(ad); setShowCreateWizard(true); }} onUpdateNotificationSettings={handleUpdateNotificationSettings} masterUsersList={masterUsers} onMasterBlockUser={handleMasterBlockUser} onMasterUnblockUser={handleMasterUnblockUser} systemLogs={systemLogs} /> : <div className="p-8 text-center"><button onClick={() => setShowAuthModal(true)} className="bg-[#008E3A] text-white font-semibold px-6 py-3 rounded-xl shadow cursor-pointer">Войти в профиль</button></div>}</main>
    {selectedAd ? <AdDetailsModal ad={selectedAd} onClose={() => setSelectedAd(null)} currentUser={currentUser} onOpenAuth={() => setShowAuthModal(true)} onRequestPhone={handleRequestPhone} onSubmitComplaint={handleSubmitComplaint} /> : null}
    {showCreateWizard ? <CreateAdWizard onClose={() => setShowCreateWizard(false)} onSubmit={handleCreateAdSubmit} prefillData={prefillAdData} /> : null}
    {showAuthModal ? <AuthModal onClose={() => setShowAuthModal(false)} onLoginSuccess={user => { setCurrentUser(user); setShowAuthModal(false); }} onLoginApi={handleLoginApi} onRegisterApi={handleRegisterApi} onRecoveryApi={handleRecoveryApi} onYandexApi={handleYandexApi} /> : null}
  </div>;
}
