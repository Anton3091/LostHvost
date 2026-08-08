import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import { Locate, Bell, Check, Trash2, MapPin, Search, Filter, ChevronRight, Sparkles, SlidersHorizontal } from 'lucide-react';
import { PublicAdItem, GeoSubscription } from '../types';

interface MapViewProps {
  ads: PublicAdItem[];
  onSelectAd: (ad: PublicAdItem) => void;
  onViewportChange?: (minLat: number, maxLat: number, minLng: number, maxLng: number) => void;
  geoSubscription: GeoSubscription | null;
  onSaveSubscription: (lat: number, lng: number, radius: number) => void;
  onDeleteSubscription: () => void;
  isLoggedIn: boolean;
  onOpenAuth: () => void;
}

export const MapView: React.FC<MapViewProps> = ({
  ads,
  onSelectAd,
  onViewportChange,
  geoSubscription,
  onSaveSubscription,
  onDeleteSubscription,
  isLoggedIn,
  onOpenAuth
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const userGpsMarker = useRef<L.Marker | null>(null);
  const subCircleLayer = useRef<L.Circle | null>(null);
  const subMarkerLayer = useRef<L.Marker | null>(null);

  // Default subscription radius set to 10 km (10000 m) as requested
  const [isSubMode, setIsSubMode] = useState(false);
  const [subLat, setSubLat] = useState<number>(geoSubscription?.lat || 55.751244);
  const [subLng, setSubLng] = useState<number>(geoSubscription?.lng || 37.598418);
  const [subRadius, setSubRadius] = useState<number>(geoSubscription?.radius || 10000);

  // Pet List Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'cat' | 'dog' | 'other'>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'lost' | 'found'>('all');

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

    // CartoDB Voyager Tile Layer for clean aesthetic map
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    leafletMap.current = map;

    // Trigger size invalidation to fix initial tile rendering inside flex card
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

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
    notifyViewport();

    return () => {
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
        color: '#008E3A',
        fillColor: '#008E3A',
        fillOpacity: 0.15,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(map);

      // Draw Center Marker
      const centerIcon = L.divIcon({
        className: 'sub-center-pin',
        html: `
          <div style="background: #008E3A; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(0,142,58,0.4);">
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
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается вашим браузером');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        if (leafletMap.current) {
          leafletMap.current.flyTo([latitude, longitude], 13);

          if (userGpsMarker.current) {
            leafletMap.current.removeLayer(userGpsMarker.current);
          }

          const gpsIcon = L.divIcon({
            className: 'pulse-gps-marker',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });

          userGpsMarker.current = L.marker([latitude, longitude], { icon: gpsIcon }).addTo(
            leafletMap.current
          );

          if (isSubMode) {
            setSubLat(latitude);
            setSubLng(longitude);
          }
        }
      },
      err => {
        alert('Не удалось определить текущую геопозицию.');
      },
      { enableHighAccuracy: true }
    );
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
    setIsSubMode(!isSubMode);
  };

  const handleSaveSub = () => {
    onSaveSubscription(subLat, subLng, subRadius);
    setIsSubMode(false);
  };

  // Filtered Pets List
  const filteredAds = useMemo(() => {
    return ads.filter(ad => {
      const matchesSearch =
        !searchQuery ||
        (ad.petName && ad.petName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ad.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ad.contactName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory = selectedCategory === 'all' || ad.category === selectedCategory;
      const matchesType = selectedType === 'all' || ad.type === selectedType;

      return matchesSearch && matchesCategory && matchesType;
    });
  }, [ads, searchQuery, selectedCategory, selectedType]);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4 space-y-5 text-slate-900 dark:text-slate-100">
      
      {/* SECTION 1: TOP NOTIFICATION SUBSCRIPTION BLOCK */}
      <section className="liquid-glass p-5 rounded-3xl space-y-3.5 border border-white/80 dark:border-white/10 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#008E3A]/15 text-[#008E3A] flex items-center justify-center font-semibold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Гео-подписка на уведомления
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Мгновенные оповещения о животных поблизости
              </p>
            </div>
          </div>

          {geoSubscription?.isActive && !isSubMode && (
            <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
              <Check className="w-3 h-3" />
              <span>Активно ({geoSubscription.radius >= 1000 ? `${geoSubscription.radius / 1000} км` : `${geoSubscription.radius} м`})</span>
            </span>
          )}
        </div>

        {/* Subscription Control Form / Controls */}
        {!isSubMode ? (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {geoSubscription?.isActive ? (
                <span>
                  Вы получаете уведомления о новых карточках в радиусе <strong className="text-[#008E3A]">{geoSubscription.radius >= 1000 ? `${geoSubscription.radius / 1000} км` : `${geoSubscription.radius} м`}</strong>.
                </span>
              ) : (
                <span>
                  Выберите центральную точку на карте и задайте любой радиус зоны уведомлений.
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 flex-shrink-0">
              <button
                onClick={toggleSubMode}
                className="bg-[#008E3A] hover:bg-[#007A32] text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-md shadow-emerald-700/20 transition active:scale-95 cursor-pointer flex items-center space-x-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{geoSubscription?.isActive ? 'Изменить зону' : 'Настроить подписку'}</span>
              </button>

              {geoSubscription?.isActive && (
                <button
                  onClick={onDeleteSubscription}
                  title="Отключить подписку"
                  className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 p-2.5 rounded-2xl text-xs transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3.5 pt-2 bg-white/40 dark:bg-slate-800/40 p-4 rounded-2xl border border-white/50 dark:border-white/5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-200">
              <div className="flex items-center space-x-1.5 text-[#008E3A]">
                <MapPin className="w-4 h-4" />
                <span>Радиус зоны: <strong className="text-[#008E3A]">{subRadius >= 1000 ? `${subRadius / 1000} км` : `${subRadius} м`}</strong></span>
              </div>
              <span className="text-[11px] text-slate-400">Перетащите маркер на карте ниже</span>
            </div>

            {/* Dynamic Range Slider */}
            <div className="space-y-1.5">
              <input
                type="range"
                min={500}
                max={30000}
                step={500}
                value={subRadius}
                onChange={e => setSubRadius(Number(e.target.value))}
                className="w-full accent-[#008E3A] cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-medium text-slate-400">
                <span>500 м</span>
                <span>5 км</span>
                <span>15 км</span>
                <span>30 км</span>
              </div>
            </div>

            {/* Quick Radius Selector Pills */}
            <div className="grid grid-cols-5 gap-1.5">
              {[1000, 3000, 5000, 10000, 20000].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSubRadius(r)}
                  className={`py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                    subRadius === r
                      ? 'bg-[#008E3A] text-white border-[#008E3A] shadow-md shadow-emerald-700/20'
                      : 'border-white/60 bg-white/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-white'
                  }`}
                >
                  {r >= 1000 ? `${r / 1000} км` : `${r} м`}
                </button>
              ))}
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                onClick={handleSaveSub}
                className="flex-1 bg-[#008E3A] hover:bg-[#007A32] text-white font-semibold py-2.5 rounded-2xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Сохранить подписку ({subRadius >= 1000 ? `${subRadius / 1000} км` : `${subRadius} м`})</span>
              </button>
              <button
                onClick={() => setIsSubMode(false)}
                className="bg-slate-200/60 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-2xl text-xs font-semibold transition cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: MIDDLE MAP SECTION (INTEGRATED MAP CONTAINER) */}
      <section className="relative w-full h-[360px] rounded-3xl overflow-hidden shadow-xl border border-white/70 dark:border-white/10 liquid-glass">
        {/* Map Canvas */}
        <div ref={mapRef} className="w-full h-full z-0" />

        {/* Legend Overlay Pill (Top-Left) */}
        <div className="absolute top-3.5 left-3.5 z-[1000] liquid-glass px-3.5 py-2 rounded-full flex items-center space-x-3 text-xs font-medium text-slate-800 dark:text-slate-100 shadow-md">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff9500] ring-2 ring-white shadow-sm" />
            <span className="text-[11px] font-semibold">Потерян</span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#34c759] ring-2 ring-white shadow-sm" />
            <span className="text-[11px] font-semibold">Найден</span>
          </div>
        </div>

        {/* Floating Controls Overlay (Top-Right) */}
        <div className="absolute top-3.5 right-3.5 z-[1000] flex flex-col space-y-2">
          <button
            onClick={handleGetLocation}
            title="Мое местоположение"
            className="w-10 h-10 liquid-glass text-slate-800 dark:text-slate-100 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-md cursor-pointer"
          >
            <Locate className="w-4 h-4 text-[#008E3A]" />
          </button>
        </div>
      </section>

      {/* SECTION 3: BOTTOM PETS LIST SECTION */}
      <section className="space-y-4 pt-2">
        {/* Header with Search and Filter controls */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Питомцы на карте
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-[#008E3A]/15 text-[#008E3A] text-xs font-bold">
                {filteredAds.length}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Нажмите для просмотра
            </span>
          </div>

          {/* Search bar & Quick Category Pills */}
          <div className="space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Поиск по кличке, описанию, городу..."
                className="w-full liquid-glass-card pl-10 pr-4 py-2.5 rounded-2xl text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#008E3A]"
              />
            </div>

            {/* Category and Status Filter Chips */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              {/* Type Filter */}
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-1.5 rounded-full font-semibold transition flex-shrink-0 cursor-pointer ${
                  selectedType === 'all'
                    ? 'bg-[#008E3A] text-white shadow-sm'
                    : 'liquid-glass-card text-slate-600 dark:text-slate-300 hover:bg-white'
                }`}
              >
                Все типы
              </button>
              <button
                onClick={() => setSelectedType('lost')}
                className={`px-3 py-1.5 rounded-full font-semibold transition flex-shrink-0 cursor-pointer ${
                  selectedType === 'lost'
                    ? 'bg-[#FF9500] text-white shadow-sm'
                    : 'liquid-glass-card text-slate-600 dark:text-slate-300 hover:bg-white'
                }`}
              >
                Потерялись
              </button>
              <button
                onClick={() => setSelectedType('found')}
                className={`px-3 py-1.5 rounded-full font-semibold transition flex-shrink-0 cursor-pointer ${
                  selectedType === 'found'
                    ? 'bg-[#34C759] text-white shadow-sm'
                    : 'liquid-glass-card text-slate-600 dark:text-slate-300 hover:bg-white'
                }`}
              >
                Найдены
              </button>

              <span className="text-slate-300 dark:text-slate-700">|</span>

              {/* Category Filter */}
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full font-semibold transition flex-shrink-0 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'liquid-glass-card text-slate-600 dark:text-slate-300 hover:bg-white'
                }`}
              >
                Все виды
              </button>
              <button
                onClick={() => setSelectedCategory('cat')}
                className={`px-3 py-1.5 rounded-full font-semibold transition flex-shrink-0 cursor-pointer ${
                  selectedCategory === 'cat'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'liquid-glass-card text-slate-600 dark:text-slate-300 hover:bg-white'
                }`}
              >
                🐱 Кошки
              </button>
              <button
                onClick={() => setSelectedCategory('dog')}
                className={`px-3 py-1.5 rounded-full font-semibold transition flex-shrink-0 cursor-pointer ${
                  selectedCategory === 'dog'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm'
                    : 'liquid-glass-card text-slate-600 dark:text-slate-300 hover:bg-white'
                }`}
              >
                🐶 Собаки
              </button>
            </div>
          </div>
        </div>

        {/* Pet Cards List */}
        {filteredAds.length === 0 ? (
          <div className="liquid-glass p-8 rounded-3xl text-center space-y-2">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Питомцы не найдены
            </p>
            <p className="text-xs text-slate-400">
              Попробуйте изменить параметры поиска или фильтры.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredAds.map(ad => {
              const isLost = ad.type === 'lost';
              return (
                <div
                  key={ad.id}
                  onClick={() => onSelectAd(ad)}
                  className="liquid-glass-card p-3.5 rounded-3xl flex items-center space-x-3.5 border border-white/70 dark:border-white/10 active:scale-[0.97] active:bg-slate-200/50 dark:active:bg-slate-800/50 transition-all duration-200 cursor-pointer shadow-sm group"
                >
                  {/* Thumbnail photo */}
                  <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 shadow-sm border border-black/5 dark:border-white/5">
                    <img
                      src={ad.photos[0] || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80&w=200'}
                      alt={ad.petName || 'Питомец'}
                      className="w-full h-full object-cover group-active:scale-105 transition-transform duration-300"
                    />
                    <span
                      className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-tight text-white ${
                        isLost ? 'bg-[#FF9500]' : 'bg-[#34C759]'
                      }`}
                    >
                      {isLost ? 'ПОТЕРЯЛСЯ' : 'НАЙДЕН'}
                    </span>
                  </div>

                  {/* Info details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {ad.petName || (isLost ? 'Без клички' : 'Питомец без имени')}
                      </h4>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {ad.category === 'cat' ? '🐱 Кошка' : ad.category === 'dog' ? '🐶 Собака' : '🐾 Другое'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-snug">
                      {ad.description}
                    </p>

                    <div className="flex items-center space-x-3 text-[10px] text-slate-400 font-medium pt-0.5">
                      <div className="flex items-center space-x-1 truncate">
                        <MapPin className="w-3 h-3 text-[#008E3A] flex-shrink-0" />
                        <span className="truncate">{ad.lat.toFixed(4)}, {ad.lng.toFixed(4)}</span>
                      </div>
                      <span>•</span>
                      <span>{new Date(ad.createdAt).toLocaleDateString('ru-RU')}</span>
                    </div>
                  </div>

                  {/* Chevron Right */}
                  <div className="w-7 h-7 rounded-full bg-slate-100/80 dark:bg-slate-800/80 text-slate-400 group-hover:text-[#008E3A] group-hover:bg-[#008E3A]/10 flex items-center justify-center transition flex-shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
};
