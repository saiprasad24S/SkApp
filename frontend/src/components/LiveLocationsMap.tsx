import { useMemo } from 'react'
import { MapContainer, Marker, TileLayer, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import type { LatLngExpression } from 'leaflet'
import { MapPin, Navigation } from 'lucide-react'

type EmployeeLocation = {
  id: number
  employee_id: string
  name: string
  email?: string
  department?: string
  default_address?: string
  profile_photo?: string
  latitude: number
  longitude: number
}

type LiveLocationsMapProps = {
  locations: EmployeeLocation[]
  onEmployeeClick?: (employee: EmployeeLocation) => void
}

const createProfileIcon = (photo: string | undefined, name: string) => divIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:999px;padding:3px;background:linear-gradient(135deg,#6B2FA0,#8B5CF6);box-shadow:0 8px 22px rgba(107,47,160,.4);overflow:hidden;cursor:pointer;transition:transform .2s;"><img src="${photo || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=6B2FA0&color=fff'}" alt="${name}" style="width:100%;height:100%;object-fit:cover;border-radius:999px;border:2px solid white;" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6B2FA0&color=fff'" /></div>`,
  className: 'profile-pin-icon',
  iconSize: [56, 56],
  iconAnchor: [28, 28],
})

export function LiveLocationsMap({ locations, onEmployeeClick }: LiveLocationsMapProps) {
  const markers = useMemo(() => {
    const normalized = locations.filter((loc) => {
      const latitude = Number(loc.latitude)
      const longitude = Number(loc.longitude)
      return !isNaN(latitude) && !isNaN(longitude)
    })

    return normalized.map((loc) => ({
      ...loc,
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      icon: createProfileIcon(loc.profile_photo, loc.name),
    }))
  }, [locations])

  const center: LatLngExpression = useMemo(() => {
    if (markers.length === 0) return [17.385, 78.4867] // Hyderabad default
    return [markers[0].latitude, markers[0].longitude]
  }, [markers])

  return (
    <div style={{ width: '100%', height: '420px', borderRadius: '16px', overflow: 'hidden' }}>
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={loc.icon}
            eventHandlers={onEmployeeClick ? {
              click: () => onEmployeeClick(loc),
            } : undefined}
          >
            <Popup>
              <div style={{ padding: '0.4rem', minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <img
                    src={loc.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(loc.name)}&background=6B2FA0&color=fff`}
                    alt={loc.name}
                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #6B2FA0' }}
                  />
                  <div>
                    <strong style={{ color: '#6B2FA0', fontSize: '0.95rem', display: 'block' }}>{loc.name}</strong>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>
                      ID: {loc.employee_id}
                    </span>
                  </div>
                </div>
                {loc.department && (
                  <p style={{ margin: '0.1rem 0', fontSize: '0.75rem', color: '#4b5563' }}>
                    Dept: {loc.department}
                  </p>
                )}
                {loc.email && (
                  <p style={{ margin: '0.1rem 0', fontSize: '0.72rem', color: '#6b7280' }}>
                    {loc.email}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.35rem', fontSize: '0.72rem', fontFamily: 'monospace', color: '#6b7280' }}>
                  <MapPin size={12} color="#6B2FA0" /> {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                </div>
                {onEmployeeClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEmployeeClick(loc)
                    }}
                    style={{
                      marginTop: '0.6rem',
                      width: '100%',
                      padding: '0.55rem 0.8rem',
                      background: 'linear-gradient(135deg, #6B2FA0, #8B5CF6)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem',
                      boxShadow: '0 3px 10px rgba(107,47,160,0.3)',
                    }}
                  >
                    <Navigation size={14} /> View Traced Route
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
