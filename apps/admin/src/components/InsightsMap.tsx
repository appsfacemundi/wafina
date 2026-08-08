'use client';

import type { AdminInsightsMapPoint } from '@wafina/shared';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';

const STATUS_COLOR: Record<string, string> = {
  Pending: '#d97706',
  Claimed: '#64748b',
  Collection_Scheduled: '#0057d9',
  Collected: '#0057d9',
  Delivered: '#22c55e',
};

function colorFor(point: AdminInsightsMapPoint): string {
  if (point.kind === 'institution') return point.verified ? '#22c55e' : '#d97706';
  return STATUS_COLOR[point.status ?? ''] ?? '#64748b';
}

/**
 * Real-device finding, 2026-08-08 — a naive "average all points into one
 * center + fixed low zoom" put the view somewhere between geographically
 * distant clusters (e.g. Angola vs. Portugal), with the actual markers tiny
 * and easy to miss at that zoom level. fitBounds guarantees every visible
 * point is actually in frame regardless of how spread out the data is.
 * Lives inside MapContainer (useMap only works there) and re-fits whenever
 * the point set changes (country filter, map-kind toggle).
 */
function FitBounds({ points }: { points: AdminInsightsMapPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 10);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 });
  }, [points, map]);

  return null;
}

interface InsightsMapProps {
  points: AdminInsightsMapPoint[];
}

/**
 * Admin Insights module, 2026-08-08 — split into its own client-only file
 * (loaded via next/dynamic with ssr:false in the page) because Leaflet
 * reaches for `window` at import time and crashes during Next.js's server
 * render otherwise. CircleMarker (not the default L.Marker) deliberately —
 * avoids Leaflet's well-known broken-default-icon-asset issue under bundlers,
 * with no icon image dependency to configure at all.
 */
export function InsightsMap({ points }: InsightsMapProps) {
  return (
    <MapContainer center={[10, 5]} zoom={3} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={points} />
      {points.map((p, i) => (
        <CircleMarker
          key={i}
          center={[p.lat, p.lng]}
          radius={p.kind === 'institution' ? 7 : 5}
          pathOptions={{
            color: colorFor(p),
            fillColor: colorFor(p),
            fillOpacity: 0.75,
            weight: p.kind === 'institution' ? 2 : 1,
          }}
        >
          <Popup>
            <strong>{p.label}</strong>
            <br />
            {p.kind === 'institution' ? (p.verified ? 'Instituição verificada' : 'Instituição por verificar') : p.status}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
