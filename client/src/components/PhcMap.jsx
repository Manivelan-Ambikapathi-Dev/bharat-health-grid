import { Component, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Card, Segmented, Spin } from 'antd';
import {
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map,
  Marker,
  useApiLoadingStatus,
} from '@vis.gl/react-google-maps';
import { formatNumber, shortPhcName } from '../utils/format.js';
import { buildMapPoints, countByStatus } from '../utils/phcMap.js';
import { STATUS_LABEL } from '../utils/stateStatus.js';
import StatusTag from './StatusTag.jsx';

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'Attention', value: 'attention' },
  { label: 'Healthy', value: 'normal' },
];

const LEGEND = [
  { status: 'normal', label: 'Green: Healthy' },
  { status: 'attention', label: 'Yellow: Attention' },
  { status: 'critical', label: 'Red: Critical' },
];

class MapFrameBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError?.();
  }

  render() {
    if (this.state.failed) {
      return <div className="map-setup" role="status">Google Maps could not be loaded.</div>;
    }
    return this.props.children;
  }
}

function markerLabel(point) {
  return `${shortPhcName(point.name)}, ${point.district}, ${point.state}. ${STATUS_LABEL[point.status]}`;
}

function markerIcon(status) {
  const fill = status === 'critical' ? '#cf1322' : status === 'attention' ? '#fadb14' : '#389e0d';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="9" fill="${fill}" stroke="#ffffff" stroke-width="2"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function MapCanvas({ points, selectedId, onSelect, onOpenPhc }) {
  const status = useApiLoadingStatus();
  const selected = points.find((point) => point.id === selectedId) || null;

  useEffect(() => {
    if (!selected) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      document.getElementById(`phc-map-open-${selected.id}`)?.focus();
    }, 60);
    return () => window.clearTimeout(timer);
  }, [selected]);

  if (status === APILoadingStatus.AUTH_FAILURE || status === APILoadingStatus.FAILED) {
    return <div className="map-setup" role="status">Google Maps could not be loaded.</div>;
  }

  if (status !== APILoadingStatus.LOADED) {
    return (
      <div className="map-setup" role="status">
        <Spin />
        <span>Loading the India map</span>
      </div>
    );
  }

  return (
    <Map
      className="phc-map-canvas"
      mapId="DEMO_MAP_ID"
      defaultCenter={{ lat: 22, lng: 79 }}
      defaultZoom={5}
      gestureHandling="greedy"
      disableDefaultUI={false}
      clickableIcons={false}
      aria-label="India PHC map"
    >
      {points.map((point) => (
        <Marker
          key={point.id}
          position={point.position}
          title={markerLabel(point)}
          icon={markerIcon(point.status)}
          onClick={() => onSelect(point.id)}
        />
      ))}
      {selected ? (
        <InfoWindow
          position={selected.position}
          pixelOffset={[0, -18]}
          onCloseClick={() => onSelect(null)}
          shouldFocus={false}
        >
          <div className="phc-popup">
            <button
              id={`phc-map-open-${selected.id}`}
              type="button"
              className="phc-popup-name"
              onClick={() => onOpenPhc(selected)}
            >
              {selected.name}
            </button>
            <dl>
              <div><dt>PHC code</dt><dd>{selected.phcCode}</dd></div>
              <div><dt>State</dt><dd>{selected.state}</dd></div>
              <div><dt>District</dt><dd>{selected.district}</dd></div>
              <div><dt>Available beds</dt><dd>{formatNumber(selected.availableBeds)}</dd></div>
              <div><dt>Medicine risk</dt><dd><StatusTag status={selected.medicineRisk} /></dd></div>
              <div><dt>Staff status</dt><dd><StatusTag status={selected.staffStatus} /></dd></div>
              <div><dt>Overall status</dt><dd><StatusTag status={selected.status} /></dd></div>
            </dl>
          </div>
        </InfoWindow>
      ) : null}
    </Map>
  );
}

function PhcMap({ phcs, beds, stock, alerts, onOpenPhc }) {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const points = useMemo(
    () => buildMapPoints({ phcs, beds, stock, alerts }),
    [phcs, beds, stock, alerts],
  );
  const counts = useMemo(() => countByStatus(points), [points]);
  const visible = filter === 'all' ? points : points.filter((point) => point.status === filter);

  useLayoutEffect(() => {
    if (!apiKey) {
      return undefined;
    }
    window.gm_authFailure = () => setLoadFailed(true);
    return () => {
      delete window.gm_authFailure;
    };
  }, [apiKey]);

  useEffect(() => {
    if (selectedId && !visible.some((point) => point.id === selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visible]);

  return (
    <Card className="section-card" title="National PHC Map">
      <div className="map-summary" aria-label="PHC status summary">
        <span><strong>{formatNumber(counts.total)}</strong> Total PHCs</span>
        <span><strong>{formatNumber(counts.critical)}</strong> Critical PHCs</span>
        <span><strong>{formatNumber(counts.attention)}</strong> Attention PHCs</span>
        <span><strong>{formatNumber(counts.normal)}</strong> Healthy PHCs</span>
      </div>
      <div className="map-toolbar">
        <Segmented
          options={FILTERS}
          value={filter}
          onChange={setFilter}
          aria-label="Filter PHC markers by status"
        />
        <ul className="map-legend">
          {LEGEND.map((item) => (
            <li key={item.status}>
              <span className={`legend-swatch phc-marker-${item.status}`} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
        <label className="map-open-label">
          Open a PHC
          <select
            aria-label="Open a PHC information card"
            value={selectedId ?? ''}
            onChange={(event) => {
              const nextId = event.target.value ? Number(event.target.value) : null;
              setSelectedId(nextId);
              if ((!apiKey || loadFailed) && nextId) {
                const point = points.find((item) => item.id === nextId);
                if (point) {
                  onOpenPhc(point);
                }
              }
            }}
          >
            <option value="">Choose a PHC</option>
            {visible.map((point) => (
              <option key={point.id} value={point.id}>
                {shortPhcName(point.name)} — {STATUS_LABEL[point.status]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="phc-map-frame">
        {!apiKey ? (
          <div className="map-setup" role="status">Google Maps API key is not configured.</div>
        ) : null}
        {apiKey && loadFailed ? (
          <div className="map-setup" role="status">Google Maps could not be loaded.</div>
        ) : null}
        {apiKey && !loadFailed ? (
          <MapFrameBoundary onError={() => setLoadFailed(true)}>
            <APIProvider
              apiKey={apiKey}
              region="IN"
              language="en"
              onError={() => setLoadFailed(true)}
            >
              <MapCanvas
                points={visible}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onOpenPhc={onOpenPhc}
              />
            </APIProvider>
          </MapFrameBoundary>
        ) : null}
      </div>
    </Card>
  );
}

export default PhcMap;
