import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { useGetCities, useGetNearestStations, useGetStationOverview, getGetCitiesQueryKey, getGetNearestStationsQueryKey } from '@workspace/api-client-react';
import type { CitySuggestion, GetNearestStationsParams, StationResult } from '@workspace/api-client-react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, ArrowDown, ArrowUpRight, Check, ChevronDown, CircleHelp, Clock3, Crosshair, Database, LoaderCircle, MapPin, Navigation, Search, Zap, SlidersHorizontal, X, ExternalLink, GitCompareArrows, Info } from 'lucide-react';

const queryClient = new QueryClient();

const stationIcon = L.divIcon({ className: '', html: '<div class="station-pin"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
const queryIcon = L.divIcon({ className: '', html: '<div class="query-pin"></div>', iconSize: [20, 20], iconAnchor: [10, 10] });
const indiaCenter: [number, number] = [22.5, 79];

function MapFocus({ point, stations, selectedStation }: {
  point: [number, number] | null;
  stations: StationResult[];
  selectedStation: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    const selected = stations.find((station) => station.stationId === selectedStation);
    if (selected) {
      map.flyTo([selected.latitude, selected.longitude], 13, { duration: 0.8 });
      return;
    }
    if (!point) return;
    if (stations.length === 0) {
      map.flyTo(point, 12, { duration: 0.8 });
      return;
    }
    const bounds = L.latLngBounds([
      point,
      ...stations.map((station) => [station.latitude, station.longitude] as [number, number]),
    ]);
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 13, animate: true, duration: 0.8 });
  }, [map, point, selectedStation, stations]);
  return null;
}

function StationMap({ stations, queryPoint, selectedStation, onSelect }: {
  stations: StationResult[];
  queryPoint: [number, number] | null;
  selectedStation: string | null;
  onSelect: (id: string) => void;
}) {
  return <MapContainer center={indiaCenter} zoom={5} scrollWheelZoom className="h-full min-h-[310px] w-full">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <MapFocus point={queryPoint} stations={stations} selectedStation={selectedStation} />
    {queryPoint && <Marker position={queryPoint} title="Search point" icon={queryIcon}><Popup><div className="font-semibold">Your search point</div><div className="mono mt-1 text-[11px]">{queryPoint[0].toFixed(5)}, {queryPoint[1].toFixed(5)}</div></Popup></Marker>}
    {stations.map((station, index) => <Marker key={station.stationId} position={[station.latitude, station.longitude]} title={station.name} icon={stationIcon} eventHandlers={{ click: () => onSelect(station.stationId) }}>
      <Popup><div className="max-w-[220px]"><div className="text-[10px] uppercase tracking-[.16em] text-teal-300">Nearby station · #{index + 1}</div><div className="mt-1 font-semibold">{station.name}</div><div className="mt-1 text-xs text-slate-300">{station.city}{station.stateProvince ? `, ${station.stateProvince}` : ''}</div><div className="mono mt-2 text-[10px] text-slate-400">{station.latitude.toFixed(5)}, {station.longitude.toFixed(5)}</div><div className="mono mt-1 text-xs text-teal-200">{station.distanceKm.toFixed(2)} km away</div></div></Popup>
    </Marker>)}
  </MapContainer>;
}

function Home() {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [k, setK] = useState(5);
  const [queryParams, setQueryParams] = useState<GetNearestStationsParams | null>(null);
  const [searchPoint, setSearchPoint] = useState<[number, number] | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [detailStation, setDetailStation] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [smartSearch, setSmartSearch] = useState(false);
  const [chargingType, setChargingType] = useState('');
  const [minimumPowerKw, setMinimumPowerKw] = useState('');
  const [maximumDistanceKm, setMaximumDistanceKm] = useState('');
  const [minimumPorts, setMinimumPorts] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [geoError, setGeoError] = useState('');
  const [locating, setLocating] = useState(false);
  const [validationError, setValidationError] = useState('');
  const geoAttempt = useRef(0);

  const cityParams = useMemo(() => ({ q: cityQuery.trim() }), [cityQuery]);
  const citiesEnabled = cityDropdownOpen && cityQuery.trim().length >= 2;
  const overview = useGetStationOverview();
  const cities = useGetCities(cityParams, { query: { enabled: citiesEnabled, queryKey: getGetCitiesQueryKey(cityParams) } });
  const nearestParams = queryParams ?? { latitude: 0, longitude: 0, k };
  const nearest = useGetNearestStations(nearestParams, {
    query: { enabled: queryParams !== null, queryKey: getGetNearestStationsQueryKey(nearestParams), retry: false },
  });

  function runSearch(latValue = latitude, lonValue = longitude) {
    setValidationError('');
    if (latValue.trim() === '' || lonValue.trim() === '') {
      setValidationError('Enter both coordinates or choose a city from the station dataset.');
      return;
    }
    const lat = Number(latValue);
    const lon = Number(lonValue);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      setValidationError('Please enter a valid latitude between -90 and 90.');
      return;
    }
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      setValidationError('Please enter a valid longitude between -180 and 180.');
      return;
    }
    if (smartSearch) {
      const checks: [string, string, number][] = [
        ['Minimum power', minimumPowerKw, 0],
        ['Maximum distance', maximumDistanceKm, 0],
        ['Minimum ports', minimumPorts, 1],
      ];
      for (const [label, value, min] of checks) {
        const number = Number(value);
        const isInvalid = value.trim() && (
          !Number.isFinite(number) ||
          number < min ||
          (label === 'Minimum ports' && !Number.isInteger(number))
        );
        if (isInvalid) {
          setValidationError(label === 'Minimum ports'
            ? 'Minimum ports must be a whole number of at least 1.'
            : `${label} must be a number of at least ${min}.`);
          return;
        }
      }
    }
    const point: [number, number] = [lat, lon];
    setLatitude(String(lat)); setLongitude(String(lon)); setSearchPoint(point); setSelectedStation(null);
    const params: GetNearestStationsParams = { latitude: lat, longitude: lon, k };
    if (smartSearch) {
      if (chargingType) params.chargingType = chargingType as 'AC' | 'DC';
      if (minimumPowerKw.trim()) params.minimumPowerKw = Number(minimumPowerKw);
      if (maximumDistanceKm.trim()) params.maximumDistanceKm = Number(maximumDistanceKm);
      if (minimumPorts.trim()) params.minimumPorts = Number(minimumPorts);
    }
    setDetailStation(null); setCompareIds([]);
    setQueryParams(params);
  }

  function chooseCity(city: CitySuggestion) {
    setSelectedCity(city); setCityQuery(`${city.name}${city.stateProvince ? `, ${city.stateProvince}` : ''}`);
    setCityDropdownOpen(false);
    setLatitude(String(city.latitude)); setLongitude(String(city.longitude));
    runSearch(String(city.latitude), String(city.longitude));
  }

  function useLocation() {
    setGeoError('');
    if (!navigator.geolocation) { setGeoError('Location is unavailable in this browser.'); return; }
    const attempt = ++geoAttempt.current;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      if (attempt !== geoAttempt.current) return;
      setLocating(false);
      setSelectedCity(null);
      runSearch(String(position.coords.latitude), String(position.coords.longitude));
    }, (error) => {
      if (attempt !== geoAttempt.current) return;
      setLocating(false);
      setGeoError(error.code === error.PERMISSION_DENIED
        ? 'Location permission was denied or cancelled. Allow access in your browser settings and try again.'
        : error.code === error.POSITION_UNAVAILABLE
          ? 'Your device could not determine a location. Try coordinates or a dataset city.'
          : 'Location lookup timed out. You can retry or enter coordinates.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  function cancelLocation() {
    geoAttempt.current += 1;
    setLocating(false);
    setGeoError('Location request cancelled.');
  }
  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }
  function resetFilters() {
    setChargingType(''); setMinimumPowerKw(''); setMaximumDistanceKm(''); setMinimumPorts('');
    setDetailStation(null); setCompareIds([]);
    if (queryParams) {
      setQueryParams({ latitude: queryParams.latitude, longitude: queryParams.longitude, k: queryParams.k });
    }
  }

  const results = nearest.data?.stations ?? [];
  const nearestError = nearest.isError;
  const searchPointLabel = selectedCity
    ? `${selectedCity.name}${selectedCity.stateProvince ? `, ${selectedCity.stateProvince}` : ''}`
    : searchPoint
      ? `${searchPoint[0].toFixed(4)}, ${searchPoint[1].toFixed(4)}`
      : '';
  const activeFilters = queryParams ? [
    queryParams.chargingType && `${queryParams.chargingType} charging`,
    queryParams.minimumPowerKw !== undefined && `≥ ${queryParams.minimumPowerKw} kW`,
    queryParams.maximumDistanceKm !== undefined && `within ${queryParams.maximumDistanceKm} km`,
    queryParams.minimumPorts !== undefined && `≥ ${queryParams.minimumPorts} ports`,
  ].filter(Boolean) as string[] : [];
  return <main className="min-h-[100dvh] overflow-x-hidden bg-[#0c1421]">
    <header className="border-b border-white/[.07] bg-[#0c1421]/95">
      <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-300/20 bg-teal-300/[.09] text-teal-300"><Zap size={20} fill="currentColor" /></div>
          <div><div className="text-[17px] font-bold tracking-[-.04em] text-slate-100">Charge<span className="text-teal-300">Find</span></div><div className="text-[10px] font-medium uppercase tracking-[.19em] text-slate-500">EV Spatial Intelligence</div></div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/[.08] bg-white/[.025] px-3 py-2" data-testid="status-dataset">
          <span className={`h-2 w-2 rounded-full ${overview.data?.dataReady ? 'bg-teal-300 shadow-[0_0_9px_#58d5c7]' : overview.isError ? 'bg-rose-400' : 'animate-pulse bg-amber-300'}`} />
           <span className="text-xs text-slate-300">{overview.isLoading ? 'Checking station data' : overview.isError ? 'Data status unavailable' : overview.data?.dataReady ? 'Station dataset ready' : 'Dataset not ready'}</span>
        </div>
      </div>
    </header>

    <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-8 sm:px-8 lg:pt-11">
      <section className="fade-up mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.22em] text-teal-300"><span className="h-px w-6 bg-teal-400/70" /> Find your next charge</div>
          <h1 className="text-[34px] font-semibold leading-[1.08] tracking-[-.055em] text-[#eff5f4] sm:text-[44px]">Find Your Nearest<br className="hidden sm:block" /> <span className="text-slate-400">EV Charger.</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">Find real EV charging stations around you. Search by city, coordinates, or your current location, then compare ranked results on the map using the included India dataset.</p>
        </div>
        <div className="flex items-center gap-3 self-start rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3 md:self-auto">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-300/[.1] text-teal-300"><Database size={17} /></div>
          {overview.isLoading ? <div className="space-y-2"><div className="h-3 w-28 animate-pulse rounded bg-slate-700" /><div className="h-2 w-20 animate-pulse rounded bg-slate-800" /></div> :
            overview.data ? <div><div className="mono text-sm font-bold text-slate-100" data-testid="text-stations-indexed">{overview.data.stationsIndexed.toLocaleString()} <span className="font-sans font-normal text-slate-400">stations indexed</span></div><div className="mt-1 text-[11px] text-slate-500">{overview.data.citiesIndexed.toLocaleString()} cities · {overview.data.algorithm}</div></div> :
            <div><div className="text-sm text-slate-200">Station index status</div><button className="mt-1 text-xs text-teal-300 hover:text-teal-200" onClick={() => overview.refetch()} data-testid="button-retry-overview">Retry status</button></div>}
        </div>
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-[minmax(340px,390px)_minmax(0,1fr)]">
        <div className="surface fade-up relative z-20 rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div><h2 className="text-[16px] font-semibold tracking-[-.02em] text-slate-100">Find charging stations</h2><p className="mt-1 text-xs text-slate-500">Choose a city or enter exact coordinates.</p></div>
            <div className="mono rounded-md border border-teal-300/15 bg-teal-300/[.06] px-2 py-1 text-[10px] text-teal-200">01 / SEARCH</div>
          </div>

          <div className="mb-5 rounded-xl border border-white/[.07] bg-[#0d1827]/65 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><SlidersHorizontal size={14} className="text-teal-300" /><div><div className="text-xs font-semibold text-slate-200">Search mode</div><div className="mt-0.5 text-[10px] text-slate-500">Filters are applied by the station search.</div></div></div>
              <div className="flex rounded-md border border-white/[.08] p-0.5" role="group" aria-label="Search mode">
                <button type="button" data-testid="button-mode-nearest" aria-pressed={!smartSearch} onClick={() => setSmartSearch(false)} className={`rounded px-2.5 py-1.5 text-[10px] font-semibold ${!smartSearch ? 'bg-teal-300/15 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}>Nearest</button>
                <button type="button" data-testid="button-mode-smart" aria-pressed={smartSearch} onClick={() => setSmartSearch(true)} className={`rounded px-2.5 py-1.5 text-[10px] font-semibold ${smartSearch ? 'bg-teal-300/15 text-teal-100' : 'text-slate-400 hover:text-slate-200'}`}>Smart search</button>
              </div>
            </div>
            {smartSearch && <div className="mt-3 grid grid-cols-2 gap-2.5">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Charging type
                <select data-testid="select-charging-type" value={chargingType} onChange={(event) => setChargingType(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-slate-700/70 bg-[#101d2c] px-2 text-xs normal-case tracking-normal text-slate-100 outline-none focus:border-teal-300/50">
                  <option value="">Any type</option><option value="AC">AC</option><option value="DC">DC</option>
                </select>
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Minimum power · kW
                <input data-testid="input-minimum-power" type="number" min="0" step="any" value={minimumPowerKw} onChange={(event) => setMinimumPowerKw(event.target.value)} placeholder="Any" className="mono mt-1.5 h-9 w-full rounded-md border border-slate-700/70 bg-[#101d2c] px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-teal-300/50" />
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Max distance · km
                <input data-testid="input-maximum-distance" type="number" min="0" step="any" value={maximumDistanceKm} onChange={(event) => setMaximumDistanceKm(event.target.value)} placeholder="Any" className="mono mt-1.5 h-9 w-full rounded-md border border-slate-700/70 bg-[#101d2c] px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-teal-300/50" />
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Minimum ports
                <input data-testid="input-minimum-ports" type="number" min="1" step="1" value={minimumPorts} onChange={(event) => setMinimumPorts(event.target.value)} placeholder="Any" className="mono mt-1.5 h-9 w-full rounded-md border border-slate-700/70 bg-[#101d2c] px-2 text-xs font-normal normal-case tracking-normal text-slate-100 outline-none focus:border-teal-300/50" />
              </label>
              <div className="col-span-2 flex items-center justify-between pt-0.5">
                <span data-testid="text-active-filter-count" className="text-[10px] text-slate-500">{[chargingType, minimumPowerKw, maximumDistanceKm, minimumPorts].filter(Boolean).length} filters selected</span>
                <button type="button" onClick={resetFilters} data-testid="button-reset-filters" className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 hover:text-teal-200"><X size={12} />Reset filters</button>
              </div>
            </div>}
          </div>

          <div className="relative mb-4">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[.13em] text-slate-400" htmlFor="city-search">Dataset city</label>
            <div className={`flex h-11 items-center gap-3 rounded-lg border bg-[#0d1827] px-3 transition-colors ${cityDropdownOpen ? 'border-teal-300/45' : 'border-slate-700/70'}`}>
              <Search size={16} className="shrink-0 text-slate-500" />
              <input id="city-search" data-testid="input-city-search" className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600" placeholder="Search an indexed city…" value={cityQuery} onFocus={() => setCityDropdownOpen(true)} onChange={(event) => { setCityQuery(event.target.value); setSelectedCity(null); setCityDropdownOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setCityDropdownOpen(false); if (event.key === 'Enter' && cities.data?.[0]) chooseCity(cities.data[0]); }} />
              <button onClick={() => setCityDropdownOpen(!cityDropdownOpen)} aria-label="Toggle city suggestions" data-testid="button-city-suggestions" className="text-slate-500 hover:text-slate-200"><ChevronDown size={16} /></button>
            </div>
            {cityDropdownOpen && cityQuery.trim().length >= 2 && <div className="absolute left-0 right-0 top-[72px] z-30 max-h-56 overflow-auto rounded-xl border border-slate-700 bg-[#111e2e] p-1 shadow-2xl">
              {cities.isLoading ? <div className="px-3 py-4 text-xs text-slate-400">Looking in the station dataset…</div> : cities.isError ? <div className="px-3 py-3 text-xs text-rose-300">City suggestions are unavailable.<button type="button" onClick={() => cities.refetch()} data-testid="button-retry-cities" className="ml-2 font-semibold text-teal-200 underline underline-offset-2">Retry</button></div> : (cities.data?.length ?? 0) === 0 ? <div className="px-3 py-4 text-xs text-slate-400">No indexed city matches this search.</div> : cities.data?.map((city) => <button key={`${city.name}-${city.stateProvince ?? ''}`} onClick={() => chooseCity(city)} data-testid={`option-city-${city.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-white/[.05]">
                <span><span className="block text-sm font-medium text-slate-100">{city.name}{city.stateProvince ? `, ${city.stateProvince}` : ''}</span><span className="mt-0.5 block text-[11px] text-slate-500">{city.stationCount.toLocaleString()} indexed station{city.stationCount === 1 ? '' : 's'}</span></span>
                <ArrowUpRight size={14} className="text-slate-500" />
              </button>)}
            </div>}
            {selectedCity && <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-teal-300/[.06] px-2.5 py-2 text-[11px] leading-4 text-teal-100/80"><Check size={13} className="mt-[1px] shrink-0 text-teal-300" />Using the dataset’s representative coordinates for {selectedCity.name}{selectedCity.stateProvince ? `, ${selectedCity.stateProvince}` : ''}.</div>}
          </div>

          <div className="mb-3 flex items-center gap-3"><span className="h-px flex-1 bg-white/[.07]" /><span className="text-[10px] uppercase tracking-[.15em] text-slate-600">or exact location</span><span className="h-px flex-1 bg-white/[.07]" /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-semibold uppercase tracking-[.13em] text-slate-400">Latitude
            <input data-testid="input-latitude" type="number" step="any" min="-90" max="90" placeholder="12.9716" value={latitude} onChange={(event) => { setLatitude(event.target.value); setSelectedCity(null); setValidationError(''); }} className="mono mt-2 h-11 w-full rounded-lg border border-slate-700/70 bg-[#0d1827] px-3 text-sm font-normal text-slate-100 outline-none transition focus:border-teal-300/50" />
            </label>
            <label className="text-[11px] font-semibold uppercase tracking-[.13em] text-slate-400">Longitude
            <input data-testid="input-longitude" type="number" step="any" min="-180" max="180" placeholder="77.5946" value={longitude} onChange={(event) => { setLongitude(event.target.value); setSelectedCity(null); setValidationError(''); }} className="mono mt-2 h-11 w-full rounded-lg border border-slate-700/70 bg-[#0d1827] px-3 text-sm font-normal text-slate-100 outline-none transition focus:border-teal-300/50" />
            </label>
          </div>
        {validationError && <p data-testid="text-coordinate-error" role="alert" className="mt-2 text-xs leading-5 text-rose-300">{validationError}</p>}
          <div className="mt-4 flex items-center justify-between">
            <label htmlFor="result-count" className="text-xs text-slate-400">Stations to find <span className="text-slate-600">(K)</span></label>
            <div className="flex items-center gap-3">
              <button aria-label="Decrease number of results" data-testid="button-k-decrease" onClick={() => setK(Math.max(1, k - 1))} disabled={k === 1} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300 disabled:opacity-30"><ArrowDown size={12} /></button>
              <span id="result-count" data-testid="text-result-count" className="mono min-w-5 text-center text-sm text-slate-100">{k}</span>
              <button aria-label="Increase number of results" data-testid="button-k-increase" onClick={() => setK(Math.min(10, k + 1))} disabled={k === 10} className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-300 disabled:opacity-30"><ArrowUpRight size={13} /></button>
            </div>
          </div>
          <button onClick={locating ? cancelLocation : useLocation} data-testid="button-geolocation" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-teal-300/20 bg-teal-300/[.055] py-2.5 text-xs font-semibold text-teal-200 transition hover:bg-teal-300/[.1]">{locating ? <><X size={14} /> Cancel location request</> : <><Crosshair size={14} /> Use my current location</>}</button>
          {geoError && <p data-testid="text-geolocation-error" className="mt-2 text-xs leading-5 text-rose-300">{geoError}</p>}
          <button onClick={() => runSearch()} disabled={nearest.isFetching} data-testid="button-find-stations" className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#35c7b8] text-sm font-bold text-[#08201f] shadow-[0_5px_22px_rgba(29,193,179,.14)] transition hover:bg-[#58d8ca] disabled:cursor-not-allowed disabled:opacity-40">
            {nearest.isFetching ? <><LoaderCircle size={16} className="animate-spin" /> Finding nearest charging stations...</> : <><Navigation size={15} /> Find Nearest Stations</>}
          </button>
          {selectedCity && <p className="mt-2 text-center text-[10px] text-slate-500">Search point reflects representative city coordinates, not an exact address.</p>}
        </div>

        <div className="fade-up min-w-0 space-y-4">
          <section className="surface overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/[.07] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2"><MapPin size={15} className="text-teal-300" /><span className="text-sm font-semibold text-slate-200">Station map</span></div>
              <div className="flex items-center gap-4 text-[10px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f7c85d]" />Search point</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" />Station</span></div>
            </div>
            <div className="h-[310px] sm:h-[380px] lg:h-[420px]">
              <StationMap stations={results} queryPoint={searchPoint} selectedStation={selectedStation} onSelect={setSelectedStation} />
            </div>
            {!queryParams && <div className="pointer-events-none -mt-[96px] relative z-[500] mx-auto w-max rounded-lg border border-slate-600/70 bg-[#0d1827]/90 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-sm">Search to see actual nearby stations</div>}
          </section>

          <section className="surface rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-sm font-semibold text-slate-100">Nearest Charging Stations</h2><p className="mt-1 text-[11px] text-slate-500">{queryParams ? nearest.data ? `Ranked by Haversine distance · K = ${queryParams.k}` : `Searching for up to ${queryParams.k} stations` : 'Results appear here after a search'}</p></div>
              {nearest.data && <div className="mono flex items-center gap-1.5 rounded-md border border-white/[.07] bg-white/[.025] px-2 py-1.5 text-[10px] text-slate-300"><Clock3 size={12} className="text-teal-300" />{nearest.data.searchTimeMs.toFixed(2)} ms</div>}
            </div>
            {!nearest.isFetching && !nearestError && nearest.data && queryParams && <p data-testid="search-summary" className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-teal-300/[.12] bg-teal-300/[.035] px-3 py-3 text-[11px] leading-5 text-slate-300 sm:px-4">
              <span className="font-semibold text-slate-100">{nearest.data.resultCount} station{nearest.data.resultCount === 1 ? '' : 's'} found</span><span aria-hidden="true" className="text-teal-300/50">·</span>
              <span>Closest: {results[0] ? `${results[0].distanceKm.toFixed(2)} km (${results[0].name})` : 'none returned'}</span><span aria-hidden="true" className="text-teal-300/50">·</span>
              <span>Search point: {searchPointLabel || 'coordinates unavailable'}</span>
            </p>}
            {!nearest.isFetching && nearest.data && <div className="mb-4 flex flex-wrap items-center gap-1.5" data-testid="active-search-filters">
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Submitted filters</span>
              {activeFilters.length ? activeFilters.map((filter) => <span key={filter} className="rounded border border-teal-300/15 bg-teal-300/[.06] px-2 py-1 text-[10px] text-teal-100">{filter}</span>) : <span className="text-[10px] text-slate-500">None · nearest search</span>}
              <span className="ml-auto mono text-[10px] text-slate-400" data-testid="text-returned-count">{nearest.data.resultCount} returned / K {queryParams?.k}</span>
            </div>}
            {nearest.isFetching && <div className="space-y-2" aria-label="Loading stations"><div className="h-[68px] animate-pulse rounded-lg bg-white/[.04]" /><div className="h-[68px] animate-pulse rounded-lg bg-white/[.03]" /><div className="h-[68px] animate-pulse rounded-lg bg-white/[.025]" /></div>}
            {!nearest.isFetching && nearestError && <div className="rounded-xl border border-rose-400/15 bg-rose-400/[.04] px-4 py-5"><div className="text-sm font-semibold text-rose-200">Couldn’t load nearby stations</div><p className="mt-1 text-xs leading-5 text-slate-400">Unable to reach the station service. Please try again.</p><button onClick={() => nearest.refetch()} data-testid="button-retry-search" className="mt-3 rounded-md border border-rose-300/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-300/[.08]">Retry search</button></div>}
            {!nearest.isFetching && !nearestError && queryParams && nearest.data && results.length === 0 && <div className="rounded-xl border border-white/[.07] bg-white/[.02] px-4 py-8 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/40 text-slate-400"><MapPin size={17} /></div><div className="text-sm font-semibold text-slate-200">No stations found nearby</div><p className="mt-1 text-xs text-slate-500">Try another point or city from the indexed dataset.</p></div>}
            {!nearest.isFetching && !queryParams && <div className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-white/[.02] p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700/30 text-slate-500"><Search size={15} /></div><div><div className="text-xs font-medium text-slate-300">Ready when you are</div><p className="mt-1 text-[11px] text-slate-500">Enter coordinates or choose an indexed city to see ranked results.</p></div></div>}
            {!nearest.isFetching && results.length > 0 && <div className="space-y-2">
              {results.map((station, index) => <div key={station.stationId} data-testid={`result-station-${station.stationId}`} className={`rounded-xl border p-2 transition ${selectedStation === station.stationId ? 'border-teal-300/35 bg-teal-300/[.06]' : 'border-white/[.065] bg-white/[.018] hover:border-white/[.14]'}`}>
                <button type="button" onClick={() => setSelectedStation(station.stationId)} aria-pressed={selectedStation === station.stationId} className="group flex w-full items-start gap-3 rounded-lg p-1 text-left">
                <span className={`mono mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] ${index === 0 ? 'bg-teal-300/15 text-teal-200' : 'bg-white/[.05] text-slate-400'}`}>{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-100">{station.name}</span>
                  <span className="mt-1 block truncate text-[11px] text-slate-500">{station.city}{station.stateProvince ? `, ${station.stateProvince}` : ''}</span>
                  <span className="mono mt-1 block text-[9px] text-slate-600">{station.latitude.toFixed(5)}, {station.longitude.toFixed(5)}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {station.powerClass && <span className="rounded border border-white/[.08] px-1.5 py-0.5 text-[9px] text-slate-300">{station.powerClass}</span>}
                    {station.powerKw !== null && <span className="rounded border border-white/[.08] px-1.5 py-0.5 text-[9px] text-slate-300">{station.powerKw} kW</span>}
                    {station.ports !== null && <span className="rounded border border-white/[.08] px-1.5 py-0.5 text-[9px] text-slate-300">{station.ports} {station.ports === 1 ? 'port' : 'ports'}</span>}
                    {station.fastDc !== null && <span className="rounded border border-white/[.08] px-1.5 py-0.5 text-[9px] text-slate-300">{station.fastDc ? 'DC fast' : 'Not DC fast'}</span>}
                  </span>
                 </span>
                <span className="shrink-0 pt-0.5 text-right"><span className="mono block text-[13px] font-bold text-teal-200">{station.distanceKm.toFixed(2)}<span className="ml-1 text-[10px] font-normal text-slate-400">km</span></span><span className="mt-1 block text-[9px] uppercase tracking-wider text-slate-600">away</span><span className="mt-2 inline-flex items-center gap-1 text-[9px] text-teal-300/75 transition group-hover:text-teal-200"><MapPin size={10} />View on map</span></span>
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/[.055] pt-2 pl-1">
                  <button type="button" data-testid={`button-details-${station.stationId}`} aria-expanded={detailStation === station.stationId} onClick={() => setDetailStation(detailStation === station.stationId ? null : station.stationId)} className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-slate-400 hover:bg-white/[.05] hover:text-slate-200"><Info size={11} />Why this station</button>
                  <button type="button" data-testid={`button-compare-${station.stationId}`} aria-pressed={compareIds.includes(station.stationId)} disabled={!compareIds.includes(station.stationId) && compareIds.length >= 3} onClick={() => toggleCompare(station.stationId)} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium disabled:opacity-35 ${compareIds.includes(station.stationId) ? 'text-teal-200' : 'text-slate-400 hover:bg-white/[.05] hover:text-slate-200'}`}><GitCompareArrows size={11} />{compareIds.includes(station.stationId) ? 'Comparing' : 'Compare'}</button>
                  <a data-testid={`link-directions-${station.stationId}`} href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium text-teal-300 hover:bg-teal-300/[.07]">Directions <ExternalLink size={10} /></a>
                </div>
                {detailStation === station.stationId && <div data-testid={`details-${station.stationId}`} className="mt-2 rounded-lg border border-teal-300/[.12] bg-[#0b1724]/70 px-3 py-2.5 text-[10px] leading-5 text-slate-400">
                  <div className="font-semibold text-slate-200">Why this station</div>
                  <p>Ranked #{index + 1} of {nearest.data?.resultCount ?? 0} returned stations by Haversine distance: {station.distanceKm.toFixed(2)} km from your search point.</p>
                  {activeFilters.length ? <p>Search constraints submitted: {activeFilters.join(' · ')}. This result passed those server-side constraints.</p> : <p>No charging or distance filters were submitted; ranking is based on proximity only.</p>}
                  <p>Dataset fields describe listed capacity only. Live availability and connector inventory are not provided.</p>
                </div>}
              </div>)}
            </div>}
            {compareIds.length > 0 && <div data-testid="comparison-panel" className="mt-4 rounded-xl border border-teal-300/[.15] bg-teal-300/[.035] p-3">
              <div className="mb-2 flex items-center justify-between"><div className="text-[11px] font-semibold text-slate-200">Station comparison <span className="font-normal text-slate-500">· {compareIds.length}/3 selected</span></div><button type="button" data-testid="button-clear-comparison" onClick={() => setCompareIds([])} className="text-[10px] text-slate-400 hover:text-slate-200">Clear</button></div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{results.filter((station) => compareIds.includes(station.stationId)).map((station) => <div key={station.stationId} data-testid={`compare-station-${station.stationId}`} className="rounded-lg border border-white/[.06] bg-[#0d1827]/70 p-2.5">
                <div className="truncate text-[11px] font-semibold text-slate-100">{station.name}</div><div className="mt-1 text-[10px] text-slate-500">{station.city}{station.stateProvince ? `, ${station.stateProvince}` : ''}</div>
                <div className="mt-2 space-y-1 mono text-[9px] text-slate-400"><div>Distance · {station.distanceKm.toFixed(2)} km</div><div>Power · {station.powerKw !== null ? `${station.powerKw} kW` : 'Not listed'}</div><div>Ports · {station.ports !== null ? station.ports : 'Not listed'}</div><div>Power class · {station.powerClass ?? 'Not listed'}</div><div>Fast DC · {station.fastDc === null ? 'Not listed' : station.fastDc ? 'Yes' : 'No'}</div></div>
              </div>)}</div>
              <p className="mt-2 text-[9px] text-slate-500">Only available dataset fields are compared; no overall winner is calculated.</p>
            </div>}
            {nearest.data && <div data-testid="runtime-metrics" className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[.06] pt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5"><Activity size={12} className="text-teal-300" />{nearest.data.nodesVisited.toLocaleString()} nodes visited</span>
              <span>{nearest.data.branchesPruned.toLocaleString()} branches pruned</span>
              <span>{nearest.data.stationsIndexed.toLocaleString()} indexed</span>
              <span>{nearest.data.resultCount} returned · K {queryParams?.k}</span>
              <span>{nearest.data.searchTimeMs.toFixed(2)} ms</span>
              <span>2D KD-tree · Haversine</span>
            </div>}
          </section>
        </div>
      </section>

      <section className="surface mt-7 rounded-2xl px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-4 flex items-center gap-2 text-teal-300"><CircleHelp size={15} /><span className="text-[10px] font-semibold uppercase tracking-[.16em]">How it works</span><span className="ml-1 text-[10px] font-normal normal-case tracking-normal text-slate-500">A geographic top-K search</span></div>
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex gap-3"><span className="mono mt-0.5 text-[10px] text-teal-300">01</span><p className="text-[11px] leading-5 text-slate-400"><span className="mr-1 font-semibold uppercase tracking-wide text-slate-200">Build</span>Stations are indexed in a 2D KD-tree.</p></div>
          <div className="flex gap-3"><span className="mono mt-0.5 text-[10px] text-teal-300">02</span><p className="text-[11px] leading-5 text-slate-400"><span className="mr-1 font-semibold uppercase tracking-wide text-slate-200">Search</span>The tree prunes regions that cannot contain closer stations.</p></div>
          <div className="flex gap-3"><span className="mono mt-0.5 text-[10px] text-teal-300">03</span><p className="text-[11px] leading-5 text-slate-400"><span className="mr-1 font-semibold uppercase tracking-wide text-slate-200">Measure</span>Haversine calculates geographic distance.</p></div>
          <div className="flex gap-3"><span className="mono mt-0.5 text-[10px] text-teal-300">04</span><p className="text-[11px] leading-5 text-slate-400"><span className="mr-1 font-semibold uppercase tracking-wide text-slate-200">Rank</span>The nearest K stations are returned and mapped.</p></div>
        </div>
      </section>
      <footer className="mt-8 flex flex-col gap-2 border-t border-white/[.06] pt-4 text-[10px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <span>{overview.data?.dataset ?? 'India station dataset'}{overview.data?.algorithm ? ` · ${overview.data.algorithm}` : ''}</span>
        <span>Station details reflect dataset fields; availability is not inferred.</span>
      </footer>
    </div>
  </main>;
}

function Router() {
  return <RoutedErrorBoundary><Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch></RoutedErrorBoundary>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;