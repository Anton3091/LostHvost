import React, { useState, useEffect, useCallback } from 'react';
import { MapView } from './components/MapView';
import { AdDetailsModal } from './components/AdDetailsModal';
import { CreateAdWizard } from './components/CreateAdWizard';
import { ProfileView } from './components/ProfileView';
import { AuthModal } from './components/AuthModal';
import { BottomNav } from './components/BottomNav';
import { PublicAdItem, User, GeoSubscription, NotificationItem, AdItem, SystemLog } from './types';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeScreen, setActiveScreen] = useState<'map' | 'profile'>('map');

  // Ads & Viewport
  const [ads, setAds] = useState<PublicAdItem[]>([]);
  const [selectedAd, setSelectedAd] = useState<PublicAdItem | null>(null);
  const [userAds, setUserAds] = useState<AdItem[]>([]);

  // Modals
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [prefillAdData, setPrefillAdData] = useState<any | null>(null);

  // Geo-subscription & Notifications
  const [geoSub, setGeoSub] = useState<GeoSubscription | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Master Data
  const [masterUsers, setMasterUsers] = useState<User[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);

  // Fetch Ads with optional bounding box
  const fetchAds = useCallback(async (minLat?: number, maxLat?: number, minLng?: number, maxLng?: number) => {
    try {
      let url = '/api/ads';
      const params = new URLSearchParams();
      if (minLat && maxLat && minLng && maxLng) {
        params.append('minLat', minLat.toString());
        params.append('maxLat', maxLat.toString());
        params.append('minLng', minLng.toString());
        params.append('maxLng', maxLng.toString());
      }
      if (currentUser?.id) {
        params.append('currentUserId', currentUser.id);
      }
      if (params.toString()) url += '?' + params.toString();

      const res = await fetch(url);
      const data = await res.json();
      if (data.ads) {
        setAds(data.ads);
      }
    } catch (err) {
      console.error('Failed to fetch ads:', err);
    }
  }, [currentUser]);

  // Fetch User-specific Data (Subscriptions, Notifications, Master users, Logs)
  const fetchUserData = useCallback(async () => {
    if (!currentUser) return;
    try {
      // Subscription
      const subRes = await fetch('/api/subscription', {
        headers: { 'X-User-Id': currentUser.id }
      });
      const subData = await subRes.json();
      if (subData.subscription) setGeoSub(subData.subscription);

      // Notifications
      const notifRes = await fetch('/api/notifications', {
        headers: { 'X-User-Id': currentUser.id }
      });
      const notifData = await notifRes.json();
      if (notifData.notifications) setNotifications(notifData.notifications);

      // Master users & Logs if Master
      if (currentUser.role === 'master') {
        const masterRes = await fetch('/api/master/users', {
          headers: { 'X-User-Id': currentUser.id }
        });
        const masterData = await masterRes.json();
        if (masterData.users) setMasterUsers(masterData.users);

        const logsRes = await fetch('/api/logs');
        const logsData = await logsRes.json();
        if (logsData.logs) setSystemLogs(logsData.logs);
      }
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  useEffect(() => {
    fetchUserData();
  }, [currentUser, fetchUserData]);

  // Auth Handlers
  const handleLoginApi = async (email: string, pass: string, captchaToken: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, captchaToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка входа');
    return data.user;
  };

  const handleRegisterApi = async (email: string, pass: string, name: string, captchaToken: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, name, captchaToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка регистрации');
    return data.user;
  };

  const handleYandexApi = async (captchaToken: string) => {
    const res = await fetch('/api/auth/yandex', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка входа');
    return data.user;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveScreen('map');
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    await fetch('/api/auth/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
    setCurrentUser(null);
    setActiveScreen('map');
    fetchAds();
  };

  // Request Phone Handler
  const handleRequestPhone = async (adId: string, captchaToken: string) => {
    const res = await fetch(`/api/ads/${adId}/phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser?.id, captchaToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось получить номер');
    return data.phone;
  };

  // Submit Complaint
  const handleSubmitComplaint = async (adId: string, reason: string, captchaToken: string) => {
    const res = await fetch(`/api/ads/${adId}/complaint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ captchaToken, reason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Не удалось отправить жалобу');
    fetchAds();
  };

  // Create Ad Submit Handler
  const handleCreateAdSubmit = async (adData: any) => {
    const res = await fetch('/api/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...adData, userId: currentUser?.id })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Ошибка публикации');
    fetchAds();
    return { status: data.status, ad: data.ad };
  };

  // Unpublish Ad
  const handleUnpublishAd = async (adId: string) => {
    const res = await fetch(`/api/ads/${adId}/unpublish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser?.id })
    });
    if (res.ok) {
      fetchAds();
      fetchUserData();
    }
  };

  // Geo-Subscription Handlers
  const handleSaveSubscription = async (lat: number, lng: number, radius: number) => {
    if (!currentUser) return;
    const res = await fetch('/api/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, lat, lng, radius })
    });
    const data = await res.json();
    if (data.subscription) setGeoSub(data.subscription);
  };

  const handleDeleteSubscription = async () => {
    if (!currentUser) return;
    await fetch('/api/subscription', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id })
    });
    setGeoSub(null);
  };

  // Update Notifications Settings
  const handleUpdateNotificationSettings = async (push: boolean, email: boolean) => {
    if (!currentUser) return;
    const res = await fetch('/api/user/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, push, email })
    });
    const data = await res.json();
    if (data.user) {
      setCurrentUser(data.user);
    }
  };

  // Master actions
  const handleMasterBlockUser = async (targetUserId: string, blockUntil?: string) => {
    if (!currentUser || currentUser.role !== 'master') return;
    await fetch('/api/master/block', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUser.id
      },
      body: JSON.stringify({ targetUserId, blockUntil })
    });
    fetchUserData();
    fetchAds();
  };

  const handleMasterUnblockUser = async (targetUserId: string) => {
    if (!currentUser || currentUser.role !== 'master') return;
    await fetch('/api/master/unblock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': currentUser.id
      },
      body: JSON.stringify({ targetUserId })
    });
    fetchUserData();
  };

  const handleCreateClick = () => {
    if (!currentUser) {
      setShowAuthModal(true);
    } else {
      setPrefillAdData(null);
      setShowCreateWizard(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Top Header & Mobile Floating Navigation Bar */}
      <BottomNav
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
        onCreateAdClick={handleCreateClick}
        currentUser={currentUser}
        onOpenAuth={() => setShowAuthModal(true)}
      />

      {/* Main Content View */}
      <main className="flex-1 pb-20">
        {activeScreen === 'map' ? (
          <MapView
            ads={ads}
            onSelectAd={setSelectedAd}
            onViewportChange={(minLat, maxLat, minLng, maxLng) =>
              fetchAds(minLat, maxLat, minLng, maxLng)
            }
            geoSubscription={geoSub}
            onSaveSubscription={handleSaveSubscription}
            onDeleteSubscription={handleDeleteSubscription}
            isLoggedIn={Boolean(currentUser)}
            onOpenAuth={() => setShowAuthModal(true)}
          />
        ) : currentUser ? (
          <ProfileView
            user={currentUser}
            onLogout={handleLogout}
            onDeleteAccount={handleDeleteAccount}
            userAds={ads as any}
            notifications={notifications}
            onUnpublishAd={handleUnpublishAd}
            onPrefillCreateAd={ad => {
              setPrefillAdData(ad);
              setShowCreateWizard(true);
            }}
            onUpdateNotificationSettings={handleUpdateNotificationSettings}
            masterUsersList={masterUsers}
            onMasterBlockUser={handleMasterBlockUser}
            onMasterUnblockUser={handleMasterUnblockUser}
            systemLogs={systemLogs}
          />
        ) : (
          <div className="p-8 text-center">
            <button
              onClick={() => setShowAuthModal(true)}
              className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl shadow cursor-pointer"
            >
              Войти в профиль
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      {selectedAd && (
        <AdDetailsModal
          ad={selectedAd}
          onClose={() => setSelectedAd(null)}
          currentUser={currentUser}
          onOpenAuth={() => setShowAuthModal(true)}
          onRequestPhone={handleRequestPhone}
          onSubmitComplaint={handleSubmitComplaint}
        />
      )}

      {showCreateWizard && (
        <CreateAdWizard
          onClose={() => setShowCreateWizard(false)}
          onSubmit={handleCreateAdSubmit}
          prefillData={prefillAdData}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={user => {
            setCurrentUser(user);
            setShowAuthModal(false);
          }}
          onLoginApi={handleLoginApi}
          onRegisterApi={handleRegisterApi}
          onYandexApi={handleYandexApi}
        />
      )}
    </div>
  );
}
