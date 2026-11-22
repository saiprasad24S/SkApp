import { useEffect } from 'react'
import { MapContainer, Marker, Polyline, CircleMarker, TileLayer, Popup, useMap } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import { LogIn, LogOut, Radio, Clock, MapPin } from 'lucide-react'

export type RoutePoint = {
  latitude: number
  longitude: number
  timestamp?: string
  type?: string
  accuracy?: number
  speed?: number
  battery_percentage?: number
}

type RouteMapProps = {
  points: RoutePoint[]
  isLive?: boolean
  employeeName?: string
}

const startIcon = divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
    <div style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#10B981;color:white;font-weight:800;font-size:11px;border:3px solid white;box-shadow:0 6px 14px rgba(16,185,129,0.5);">
      START
    </div>
    <div style="background:#065F46;color:#A7F3D0;font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;margin-top:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);white-space:nowrap;">
      LOGIN
    </div>
  </div>`,
  className: 'route-start-pin',
  iconSize: [44, 60],
  iconAnchor: [22, 30],
})

const endIcon = divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
    <div style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#EF4444;color:white;font-weight:800;font-size:11px;border:3px solid white;box-shadow:0 6px 14px rgba(239,68,68,0.5);">
      END
    </div>
    <div style="background:#7F1D1D;color:#FECACA;font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;margin-top:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);white-space:nowrap;">
      LOGOUT
    </div>
  </div>`,
  className: 'route-end-pin',
  iconSize: [44, 60],
  iconAnchor: [22, 30],
})

const liveIcon = divIcon({
  html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
    <div style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#6B2FA0;color:white;font-weight:800;font-size:11px;border:3px solid white;box-shadow:0 6px 16px rgba(107,47,160,0.6);animation:pulse 2s infinite;">
      LIVE
    </div>
    <div style="background:#4C1D95;color:#E9D5FF;font-size:9px;font-weight:700;padding:2px 6px;border-radius:6px;margin-top:2px;box-shadow:0 2px 6px rgba(0,0,0,0.2);white-space:nowrap;">
      CURRENT
    </div>
  </div>`,
  className: 'route-live-pin',
  iconSize: [44, 60],
  iconAnchor: [22, 30],
})

function MapAutoBounds({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15)
      return
    }
    const bounds = latLngBounds(points.map((p) => [p.latitude, p.longitude]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
  }, [map, points])

  return null
}

export function RouteMap({ points, isLive = false, employeeName }: RouteMapProps) {
  const center: LatLngExpression = points.length > 0
    ? [points[0].latitude, points[0].longitude]
    : [17.385, 78.4867]

  // Identify check-in (start) point
  const checkInPoint = points.find((p) => p.type === 'CHECK_IN') || (points.length > 0 ? points[0] : null)
  
  // Identify check-out (end) point
  const checkOutPoint = points.slice().reverse().find((p) => p.type === 'CHECK_OUT')
  
  // The latest known point
  const latestPoint = points.length > 0 ? points[points.length - 1] : null
  
  // Determine if employee has logged out or is still live
  const hasLoggedOut = !!checkOutPoint
  const endPoint = checkOutPoint || latestPoint

  const formatTimestamp = (ts?: string) => {
    if (!ts) return ''
    try {
      return new Date(ts).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    } catch {
      return ts
    }
  }

  const formatDate = (ts?: string) => {
    if (!ts) return ''
    try {
      return new Date(ts).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return ''
    }
  }

  return (
    <div className="map-card" style={{ height: '100%', minHeight: '420px', borderRadius: '16px', overflow: 'hidden', position: 'relative' }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom className="map-view" style={{ height: '100%', minHeight: '420px' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapAutoBounds points={points} />
        {points.length > 0 && (
          <>
            {/* Full travel polyline */}
            <Polyline
              positions={points.map((point) => [point.latitude, point.longitude])}
              pathOptions={{
                color: '#6B2FA0',
                weight: 5,
                opacity: 0.85,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />

            {/* Intermediate tracked GPS waypoints */}
            {points.length > 2 &&
              points.slice(1, -1).map((pt, idx) => (
                <CircleMarker
                  key={`waypoint-${idx}`}
                  center={[pt.latitude, pt.longitude]}
                  radius={4}
                  pathOptions={{
                    color: '#6B2FA0',
                    fillColor: '#FFFFFF',
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ padding: '0.3rem', minWidth: '160px' }}>
                      <strong style={{ color: '#6B2FA0', fontSize: '0.85rem' }}>
                        Waypoint #{idx + 1}
                      </strong>
                      {pt.timestamp && (
                        <div style={{ fontSize: '0.75rem', color: '#4B5563', marginTop: '0.2rem' }}>
                          Time: {formatTimestamp(pt.timestamp)}
                        </div>
                      )}
                      {pt.speed != null && (
                        <div style={{ fontSize: '0.72rem', color: '#6B7280' }}>
                          Speed: {(pt.speed * 3.6).toFixed(1)} km/h
                        </div>
                      )}
                      <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9CA3AF', marginTop: '0.15rem' }}>
                        {pt.latitude.toFixed(5)}, {pt.longitude.toFixed(5)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

            {/* START / LOGIN MARKER */}
            {checkInPoint && (
              <Marker position={[checkInPoint.latitude, checkInPoint.longitude]} icon={startIcon}>
                <Popup>
                  <div style={{ padding: '0.4rem', minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981', fontWeight: 800, fontSize: '0.95rem' }}>
                      <LogIn size={16} /> Route Start (Login / Check-In)
                    </div>
                    {employeeName && (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginTop: '0.25rem' }}>
                        {employeeName}
                      </div>
                    )}
                    {checkInPoint.timestamp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#4B5563', marginTop: '0.35rem' }}>
                        <Clock size={12} /> {formatTimestamp(checkInPoint.timestamp)}
                        <span style={{ color: '#9CA3AF' }}>({formatDate(checkInPoint.timestamp)})</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6B7280', marginTop: '0.25rem' }}>
                      <MapPin size={12} /> {checkInPoint.latitude.toFixed(5)}, {checkInPoint.longitude.toFixed(5)}
                    </div>
                    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', color: '#065F46', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, marginTop: '0.4rem' }}>
                      Duty session started here
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {/* END / LOGOUT OR LIVE CURRENT LOCATION MARKER */}
            {endPoint && (points.length > 1 || hasLoggedOut) && (
              <Marker
                position={[endPoint.latitude, endPoint.longitude]}
                icon={hasLoggedOut ? endIcon : (isLive ? liveIcon : endIcon)}
              >
                <Popup>
                  <div style={{ padding: '0.4rem', minWidth: '200px' }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      color: hasLoggedOut ? '#EF4444' : '#6B2FA0',
                      fontWeight: 800,
                      fontSize: '0.95rem'
                    }}>
                      {hasLoggedOut ? (
                        <>
                          <LogOut size={16} /> Route End (Logout / Check-Out)
                        </>
                      ) : (
                        <>
                          <Radio size={16} /> Current Live Location
                        </>
                      )}
                    </div>
                    {employeeName && (
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', marginTop: '0.25rem' }}>
                        {employeeName}
                      </div>
                    )}
                    {endPoint.timestamp && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#4B5563', marginTop: '0.35rem' }}>
                        <Clock size={12} /> {formatTimestamp(endPoint.timestamp)}
                        <span style={{ color: '#9CA3AF' }}>({formatDate(endPoint.timestamp)})</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontFamily: 'monospace', color: '#6B7280', marginTop: '0.25rem' }}>
                      <MapPin size={12} /> {endPoint.latitude.toFixed(5)}, {endPoint.longitude.toFixed(5)}
                    </div>
                    <div style={{
                      background: hasLoggedOut ? '#FEF2F2' : '#F3EEF8',
                      border: `1px solid ${hasLoggedOut ? '#FECACA' : '#DDD6FE'}`,
                      color: hasLoggedOut ? '#991B1B' : '#5B21B6',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      marginTop: '0.4rem'
                    }}>
                      {hasLoggedOut ? 'Duty session ended here' : 'Actively transmitting live location'}
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}
          </>
        )}
      </MapContainer>
    </div>
  )
}
