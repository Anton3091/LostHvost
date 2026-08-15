import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Locate, Bell, Check, Trash2, MapPin, ChevronRight, Settings, X, Loader2 } from 'lucide-react';
import { PublicAdItem, GeoSubscription } from '../types';
import { cartoTileUrl } from '../theme';
import { getCurrentLocation, isGeolocationPermissionDenied } from '../geolocation';
import { PUSH_UNSUPPORTED_ERROR, PwaInstallGuideModal, PwaPushUnsupportedMessage } from './PwaInstallGuideModal';

interface MapViewProps {
  ads: PublicAdItem[];
  onSelectAd: (ad: PublicAdItem) => void;
  onViewportChange?: (minLat: number, maxLat: number, minLng: number, maxLng: number) => void;
  geoSubscription: GeoSubscription | null;
  onSaveSubscription: (lat: number, lng: number, radius: number) => Promise<void>;
  onDeleteSubscription: () => void;
  isLoggedIn: boolean;
  onOpenAuth: () => void;
}

const subscriptionRadii = [500, 1000, 2000, 10000];
const normalizeSubscriptionRadius = (radius: number | undefined) =>
  subscriptionRadii.includes(radius || 0) ? radius! : 1000;
const formatSubscriptionRadius = (radius: number) => radius >= 1000 ? `${radius / 1000}км` : `${radius}м`;

export const MapView: React.FC<MapViewProps> = ({
  ads,
  onSelectAd,
  onViewportChange,
  geoSubscription,
  onSaveSubscription,
  onDeleteSubscription,
  isLoggedIn,
  onOpenAuth,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const baseTileLayer = useRef<L.TileLayer | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const userGpsMarker = useRef<L.Marker | null>(null);
  const subCircleLayer = useRef<L.Circle | null>(null);
  const subMarkerLayer = useRef<L.Marker | null>(null);

  const [isSubMode, setIsSubMode] = useState(false);
  const [locationHelpOpen, setLocationHelpOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [subLat, setSubLat] = useState<number>(geoSubscription?.lat || 55.751244);
  const [subLng, setSubLng] = useState<number>(geoSubscription?.lng || 37.598418);
  const [subRadius, setSubRadius] = useState<number>(() => normalizeSubscriptionRadius(geoSubscription?.radius));
  const [subscriptionSaved, setSubscriptionSaved] = useState(false);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);
  const [subscriptionSaveError, setSubscriptionSaveError] = useState<string | null>(null);
  const [showPwaInstallGuide, setShowPwaInstallGuide] = useState(false);

  useEffect(() => {
    if (isSubMode) return;
    setSubLat(geoSubscription?.lat || 55.751244);
    setSubLng(geoSubscription?.lng || 37.598418);
    setSubRadius(normalizeSubscriptionRadius(geoSubscription?.radius));
  }, [geoSubscription, isSubMode]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const initialLat = geoSubscription?.lat || 55.751244;
    const initialLng = geoSubscription?.lng || 37.598418;

    // Zoom level 11 scales to approximately a 10 km radius view
    const map = L.map(mapRef.current, {
      center: [initialLat, initialLng],
      zoom: 11,
      zoomControl: false
    });

    map.attributionControl.setPrefix(false);

    baseTileLayer.current = L.tileLayer(cartoTileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    leafletMap.current = map;

    // Viewport change listener
    const notifyViewport = () => {
      if (!leafletMap.current || !onViewportChange) return;
      const bounds = leafletMap.current.getBounds();
      onViewportChange(
        bounds.getSouth(),
        bounds.getNorth(),
        bounds.getWest(),
        bounds.getEast()
      );
    };

    map.on('moveend', notifyViewport);
    map.on('zoomend', notifyViewport);

    // Wait for the card to receive its final size before requesting ads for the
    // viewport. The timer is cleared on cleanup because React StrictMode can
    // mount and immediately dispose the first Leaflet instance in development.
    const initialViewportTimer = window.setTimeout(() => {
      if (leafletMap.current !== map) return;
      map.invalidateSize({ pan: false });
      notifyViewport();
    }, 200);

    return () => {
      window.clearTimeout(initialViewportTimer);
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Update Ad Markers on Map
  useEffect(() => {
    if (!leafletMap.current || !markersLayer.current) return;
    markersLayer.current.clearLayers();

    ads.forEach(ad => {
      const isLost = ad.type === 'lost';

      // Custom Apple-style dot icon without text/labels
      const dotIcon = L.divIcon({
        className: `apple-dot-marker apple-dot-${isLost ? 'lost' : 'found'}`,
        html: `<div class="apple-dot-inner"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([ad.lat, ad.lng], { icon: dotIcon });

      // Direct click on dot marker opens the bottom sheet pet detail card
      marker.on('click', () => {
        onSelectAd(ad);
      });

      markersLayer.current?.addLayer(marker);
    });
  }, [ads, onSelectAd]);

  // Handle Geo-Subscription mode on Map
  useEffect(() => {
    if (!leafletMap.current) return;
    const map = leafletMap.current;

    if (subCircleLayer.current) {
      map.removeLayer(subCircleLayer.current);
      subCircleLayer.current = null;
    }
    if (subMarkerLayer.current) {
      map.removeLayer(subMarkerLayer.current);
      subMarkerLayer.current = null;
    }

    if (isSubMode || geoSubscription?.isActive) {
      const activeLat = isSubMode ? subLat : geoSubscription?.lat || subLat;
      const activeLng = isSubMode ? subLng : geoSubscription?.lng || subLng;
      const activeRadius = isSubMode ? subRadius : geoSubscription?.radius || subRadius;

      // Draw Radius Circle
      subCircleLayer.current = L.circle([activeLat, activeLng], {
        radius: activeRadius,
        color: '#0C8C50',
        fillColor: '#0C8C50',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(map);

      // Draw Center Marker
      const centerIcon = L.divIcon({
        className: 'sub-center-pin',
        html: `
          <div style="background: #0C8C50; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(12,140,80,0.4);">
            📍
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      subMarkerLayer.current = L.marker([activeLat, activeLng], {
        icon: centerIcon,
        draggable: isSubMode
      }).addTo(map);

      if (isSubMode && subMarkerLayer.current) {
        subMarkerLayer.current.on('dragend', (e: any) => {
          const latlng = e.target.getLatLng();
          setSubLat(latlng.lat);
          setSubLng(latlng.lng);
        });
      }
    }

    // Map Click Handler when setting up Subscription
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (isSubMode) {
        setSubLat(e.latlng.lat);
        setSubLng(e.latlng.lng);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [isSubMode, subLat, subLng, subRadius, geoSubscription]);

  // Geolocation trigger
  const handleGetLocation = async () => {
    setLocationHelpOpen(false);
    setLocationLoading(true);
    const applyLocation = (pos: GeolocationPosition) => {
      const { latitude, longitude } = pos.coords;
      if (!leafletMap.current) return;
      leafletMap.current.flyTo([latitude, longitude], 13);
      if (userGpsMarker.current) leafletMap.current.removeLayer(userGpsMarker.current);
      const gpsIcon = L.divIcon({
        className: 'pulse-gps-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      userGpsMarker.current = L.marker([latitude, longitude], { icon: gpsIcon }).addTo(leafletMap.current);
      if (isSubMode) {
        setSubLat(latitude);
        setSubLng(longitude);
      }
    };

    try {
      applyLocation(await getCurrentLocation());
    } catch (error) {
      if (isGeolocationPermissionDenied(error)) {
        setLocationHelpOpen(true);
      } else if (error instanceof Error && error.message === 'GEOLOCATION_UNSUPPORTED') {
        alert('Геолокация не поддерживается вашим устройством.');
      } else {
        alert('Не удалось определить местоположение. Проверьте GPS и подключение к интернету и повторите попытку.');
      }
    } finally {
      setLocationLoading(false);
    }
  };

  const toggleSubMode = () => {
    if (!isLoggedIn) {
      onOpenAuth();
      return;
    }
    if (!isSubMode && leafletMap.current) {
      const center = leafletMap.current.getCenter();
      setSubLat(center.lat);
      setSubLng(center.lng);
    }
    setSubscriptionSaved(false);
    setSubscriptionSaveError(null);
    setIsSubMode(!isSubMode);
  };

  const handleSaveSub = async () => {
    setSubscriptionSaving(true);
    setSubscriptionSaveError(null);
    try {
      await onSaveSubscription(subLat, subLng, subRadius);
      setIsSubMode(false);
      setSubscriptionSaved(true);
    } catch (error: any) {
      setSubscriptionSaveError(error.message || 'Не удалось сохранить гео-подписку');
    } finally {
      setSubscriptionSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 space-y-5 text-slate-900">
      
      {/* SECTION 1: TOP NOTIFICATION SUBSCRIPTION BLOCK */}
      <section className={`liquid-glass border border-white/80 shadow-xl ${isSubMode ? 'p-5 rounded-3xl space-y-3.5' : 'p-3.5 rounded-2xl'}`}>
        {subscriptionSaved ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#087747]/15 text-[#0C8C50] flex items-center justify-center font-semibold">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Гео-подписка сохранена</h2>
                <p className="text-[11px] text-slate-500 font-medium">Push-уведомления включены в настройках</p>
              </div>
            </div>
            <div className="rounded-2xl border border-blue-200/80 bg-blue-50/80 p-3 space-y-1.5 text-[11px] leading-relaxed text-blue-900">
              <p className="font-bold">Пуши работают только в установленном PWA</p>
              <p>На iPhone или iPad откройте LostHvost в Safari, нажмите «Поделиться» → «На экран Домой», затем запускайте сайт с иконки и разрешите уведомления.</p>
            </div>
            <button
              type="button"
              onClick={() => setSubscriptionSaved(false)}
              className="w-full bg-[#087747] hover:bg-[#06683D] text-white font-semibold py-2.5 rounded-2xl text-xs transition cursor-pointer"
            >
              Вернуться к карте
            </button>
          </div>
        ) : !isSubMode ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#087747]/15 text-[#0C8C50] flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900 leading-tight">Гео-подписка</h2>
              <p className="text-[11px] text-slate-500 leading-snug whitespace-normal break-words">
                Выберите область на карте и получите уведомление как только появится новое объявление
              </p>
            </div>
            <button
              onClick={toggleSubMode}
              className="bg-[#087747] hover:bg-[#06683D] text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-md shadow-emerald-700/20 transition active:scale-95 cursor-pointer flex items-center gap-1.5 flex-shrink-0"
            >
              {geoSubscription?.isActive && <Check className="w-3.5 h-3.5" />}
              <span>{geoSubscription?.isActive ? 'Изменить' : 'Настроить'}</span>
            </button>
            {geoSubscription?.isActive && (
              <button
                onClick={onDeleteSubscription}
                title="Отключить подписку"
                aria-label="Отключить гео-подписку"
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 p-2 rounded-xl transition cursor-pointer flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#087747]/15 text-[#0C8C50] flex items-center justify-center font-semibold">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 leading-tight">Гео-подписка на уведомления</h2>
                <p className="text-[11px] text-slate-500 font-medium">Настройте точку и радиус зоны</p>
              </div>
            </div>
            <div className="space-y-3.5 pt-2 bg-white/40 p-4 rounded-2xl border border-white/50">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <div className="flex items-center space-x-1.5 text-[#0C8C50]">
                <MapPin className="w-4 h-4" />
                <span>Радиус зоны: <strong className="text-[#0C8C50]">{formatSubscriptionRadius(subRadius)}</strong></span>
              </div>
              <span className="text-[11px] text-slate-400 text-right">Перетащите маркер на карте ниже</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {subscriptionRadii.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSubRadius(r)}
                  className={`py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    subRadius === r
                      ? 'bg-[#087747] text-white border-[#0C8C50] shadow-md shadow-emerald-700/20'
                      : 'border-white/60 bg-white/60 text-slate-700 hover:bg-white'
                  }`}
                >
                  {formatSubscriptionRadius(r)}
                </button>
              ))}
            </div>

            {subscriptionSaveError === PUSH_UNSUPPORTED_ERROR ? (
              <PwaPushUnsupportedMessage onOpenGuide={() => setShowPwaInstallGuide(true)} />
            ) : subscriptionSaveError ? (
              <p className="text-xs font-semibold text-rose-600">{subscriptionSaveError}</p>
            ) : null}

            <div className="flex space-x-2 pt-1">
              <button
                onClick={handleSaveSub}
                disabled={subscriptionSaving}
                className="flex-1 bg-[#087747] hover:bg-[#06683D] text-white font-semibold py-2.5 rounded-2xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition cursor-pointer"
              >
                {subscriptionSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{subscriptionSaving ? 'Сохраняем…' : `Сохранить подписку (${formatSubscriptionRadius(subRadius)})`}</span>
              </button>
              <button
                onClick={() => setIsSubMode(false)}
                className="bg-slate-200/60 text-slate-600 px-4 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer"
              >
                Отмена
              </button>
            </div>
            </div>
          </>
        )}
      </section>

      {showPwaInstallGuide && <PwaInstallGuideModal onClose={() => setShowPwaInstallGuide(false)} />}

      {/* SECTION 2: MIDDLE MAP SECTION (INTEGRATED MAP CONTAINER) */}
      <section className="relative w-full h-[360px] rounded-3xl overflow-hidden shadow-xl border border-white/70 liquid-glass">
        {/* Map Canvas */}
        <div ref={mapRef} className="w-full h-full z-0" />

        {/* Legend Overlay Pill (Top-Left) */}
        <div className="absolute top-3.5 left-3.5 z-[1000] liquid-glass px-3.5 py-2 rounded-full flex items-center space-x-3 text-xs font-medium text-slate-800 shadow-md">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e53935] ring-2 ring-white shadow-sm" />
            <span className="text-[11px] font-semibold">Потерян</span>
          </div>
          <span className="text-slate-300">|</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb] ring-2 ring-white shadow-sm" />
            <span className="text-[11px] font-semibold">Найден</span>
          </div>
        </div>

        {/* Floating location control aligned left of the Leaflet zoom controls */}
        <div className="absolute bottom-7 right-14 z-[1000]">
          <button
            type="button"
            onClick={handleGetLocation}
            disabled={locationLoading}
            title={locationLoading ? 'Определяем местоположение' : 'Моё местоположение'}
            aria-label={locationLoading ? 'Определяем местоположение' : 'Моё местоположение'}
            className="w-10 h-10 liquid-glass text-slate-800 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-md cursor-pointer disabled:opacity-60 disabled:cursor-wait"
          >
            <Locate className={`w-4 h-4 text-[#0C8C50] ${locationLoading ? 'animate-pulse' : ''}`} />
          </button>
        </div>
      </section>

      {/* SECTION 3: BOTTOM PETS LIST SECTION */}
      <section className="space-y-4 pt-2">
        {/* Header with Search and Filter controls */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900">
                Питомцы на карте
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#087747]/15 text-[#0C8C50] text-xs font-bold">
                {ads.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Нажмите для просмотра
            </span>
          </div>

        </div>

        {/* Pet Cards List */}
        {ads.length === 0 ? (
          <div className="liquid-glass p-8 rounded-3xl text-center space-y-2">
            <p className="text-sm font-semibold text-slate-600">
              Питомцы не найдены
            </p>
            <p className="text-xs text-slate-400">
              Попробуйте изменить параметры поиска или фильтры.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {ads.map(ad => {
              const isLost = ad.type === 'lost';
              return (
                <div
                  key={ad.id}
                  onClick={() => onSelectAd(ad)}
                  className="liquid-glass-card p-3.5 rounded-3xl flex items-center space-x-3.5 border border-white/70 active:scale-[0.97] active:bg-slate-200/50 transition-all duration-200 cursor-pointer shadow-sm group"
                >
                  {/* Thumbnail photo */}
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 flex-shrink-0 shadow-sm border border-black/5">
                    <img
                      src={ad.photos[0] || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200'}
                      alt={ad.petName || 'Питомец'}
                      className="w-full h-full object-cover group-active:scale-105 transition-transform duration-300"
                    />
                    <span
                      className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight text-white ${
                        isLost ? 'bg-[#e53935]' : 'bg-[#2563eb]'
                      }`}
                    >
                      {isLost ? 'ПОТЕРЯЛСЯ' : 'НАЙДЕН'}
                    </span>
                  </div>

                  {/* Info details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 truncate">
                        {ad.petName || 'Питомец без имени'}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {ad.category === 'cat' ? '🐱 Кошка' : ad.category === 'dog' ? '🐶 Собака' : '🐾 Другое'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-snug">
                      {ad.description}
                    </p>

                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-medium pt-0.5">
                      <div className="flex items-center space-x-1 truncate">
                        <MapPin className="w-3 h-3 text-[#0C8C50] flex-shrink-0" />
                        <span className="truncate">{ad.lat.toFixed(4)}, {ad.lng.toFixed(4)}</span>
                      </div>
                      <span>•</span>
                      <span>{new Date(ad.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>

                  {/* Chevron Right */}
                  <div className="w-7 h-7 rounded-full bg-slate-100/80 text-slate-400 group-hover:text-[#0C8C50] group-hover:bg-[#087747]/10 flex items-center justify-center transition flex-shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {locationHelpOpen && (
        <div className="fixed inset-0 z-[2400] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 animate-[app-rise_260ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <button
              type="button"
              onClick={() => setLocationHelpOpen(false)}
              className="absolute right-4 top-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-11 h-11 rounded-2xl bg-[#087747]/15 text-[#0C8C50] flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 pr-8">
              <h3 className="text-base font-bold">Разрешите доступ к геопозиции</h3>
              <p className="text-xs leading-relaxed text-slate-500">
                Доступ к геопозиции отклонён браузером или системой. Проверьте разрешения и повторите запрос.
              </p>
            </div>
            <div className="space-y-2 text-xs text-slate-700">
              <p><strong>1.</strong> В настройках устройства разрешите доступ к местоположению для браузера.</p>
              <p><strong>2.</strong> В настройках сайта разрешите геопозицию для losthvost.ru.</p>
              <p><strong>3.</strong> Вернитесь на сайт и повторите запрос.</p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={locationLoading}
                className="w-full h-11 rounded-2xl bg-[#087747] text-white text-sm font-semibold disabled:opacity-60"
              >
                Запросить ещё раз
              </button>
              <button
                type="button"
                onClick={() => setLocationHelpOpen(false)}
                className="w-full h-10 rounded-2xl bg-slate-100 text-slate-700 text-sm font-semibold"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
