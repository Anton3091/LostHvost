export type AdType = 'lost' | 'found'; // 'Потерял' | 'Нашёл'
export type AdCategory = 'cat' | 'dog' | 'other'; // 'кошка' | 'собака' | 'другое'
export type AdStatus = 'pending_moderation' | 'active' | 'rejected' | 'unpublished';
export type UserRole = 'user' | 'master';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  isBlocked: boolean;
  blockUntil?: string | null; // ISO date string if temporary block
  authProvider: 'email' | 'yandex';
  notificationSettings: {
    push: boolean;
    email: boolean;
    telegram: boolean;
  };
  telegramConnected?: boolean;
  createdAt: string;
}

export interface AdItem {
  id: string;
  userId: string;
  type: AdType;
  category: AdCategory;
  photos: string[]; // Base64 or URL strings (1 to 3)
  petName?: string;
  contactName: string;
  phone?: string;
  description: string;
  lat: number;
  lng: number;
  createdAt: string; // ISO date string
  expiresAt: string; // ISO date string (createdAt + 7 days)
  unpublishedAt?: string; // ISO date string
  viewsCount: number;
  status: AdStatus;
  rejectionReason?: string;
  complaintCount?: number;
}

// Public representation of an ad (phone is strictly stripped!)
export interface PublicAdItem {
  id: string;
  type: AdType;
  category: AdCategory;
  photos: string[];
  petName?: string;
  contactName: string;
  description: string;
  lat: number;
  lng: number;
  createdAt: string;
  expiresAt: string;
  status: AdStatus;
  viewsCount?: number; // Only returned if logged-in user is author!
  isAuthor?: boolean;
  phone?: string; // Returned only to the author for editing their own ad.
  unpublishedAt?: string;
  rejectionReason?: string;
}

export interface GeoSubscription {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  radius: number; // 500, 1000, 2000, 10000 meters
  isActive: boolean;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
  adId?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  type: string;
  requestId?: string;
  component: string;
  userId?: string;
  adId?: string;
  result: 'success' | 'failure' | 'warning' | 'info';
  errorCode?: string;
  durationMs?: number;
  details: string;
}

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface RateLimitStatus {
  activeAdsCount: number;
  maxActiveAds: number; // 3
  publishAttempts24h: number;
  maxPublishAttempts24h: number; // 5
  phoneRequests24h: number;
  maxPhoneRequests24h: number; // 10
}
