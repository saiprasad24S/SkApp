import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/clerk-react'
import { authedFetch } from '../lib/api'
import { MetricCard } from '../components/MetricCard'
import { LiveLocationsMap } from '../components/LiveLocationsMap'
import { RouteMap } from '../components/RouteMap'
import { useSearch } from '../context/SearchContext'
import { ArrowLeft, ExternalLink, Navigation } from 'lucide-react'

type LiveEmployee = {
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

export function DashboardPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { searchQuery } = useSearch()

  // Currently selected employee for viewing start-to-end route
  const [selectedEmployeeForRoute, setSelectedEmployeeForRoute] = useState<LiveEmployee | null>(null)

  const metricsQuery = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/dashboard/metrics', token)
      if (!response.ok) throw new Error('Unable to load metrics')
      return response.json() as Promise<Record<string, number>>
    },
    staleTime: 60_000,
  })

  const liveLocationsQuery = useQuery({
    queryKey: ['live-locations'],
    queryFn: async () => {
      const token = await getToken()
      if (!token) throw new Error('Missing token')
      const response = await authedFetch('/api/location/all-present-locations', token)
      if (!response.ok) throw new Error('Unable to load locations')
      return response.json() as Promise<LiveEmployee[]>
    },
    staleTime: 15_000,
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  })

  // Fetch route when an employee is selected from the map
  const employeeRouteQuery = useQuery({
    queryKey: ['dashboard-employee-route', selectedEmployeeForRoute?.employee_id],
    enabled: !!selectedEmployeeForRoute,
    queryFn: async () => {
      const token = await getToken()
      if (!token || !selectedEmployeeForRoute) throw new Error('Missing token')
      const response = await authedFetch(`/api/location/employee/route/${selectedEmployeeForRoute.employee_id}`, token)
      if (!response.ok) throw new Error('Unable to load route')
      return response.json() as Promise<{
        employee_id: string
        employee_name: string
        date: string
        route: Array<{ latitude: number; longitude: number; timestamp?: string; type?: string }>
        distance_covered_meters: number
        presence_status: string
        is_present: boolean
        check_in_time: string | null
        session_duration_seconds: number | null
      }>
    },
    refetchInterval: selectedEmployeeForRoute ? 15_000 : undefined,
    staleTime: 10_000,
  })

  const filteredLocations = useMemo(() => {
    const data = liveLocationsQuery.data ?? []
    if (!searchQuery.trim()) return data
    const query = searchQuery.toLowerCase().trim()
    return data.filter((loc) =>
      loc.name.toLowerCase().includes(query) ||
      loc.employee_id.toLowerCase().includes(query) ||
      (loc.email && loc.email.toLowerCase().includes(query)) ||
      (loc.default_address && loc.default_address.toLowerCase().includes(query)) ||
      (loc.department && loc.department.toLowerCase().includes(query))
    )
  }, [liveLocationsQuery.data, searchQuery])

  return (
    <section className="page-grid">
      <div className="hero-card hero-split">
        <div className="hero-copy">
          <span className="eyebrow">Today at a glance</span>
          <h3>Attendance, routing, and field coverage</h3>
          <p>Premium healthcare operations dashboard designed for Skandan field employees and admins.</p>
          <div className="hero-pills">
            <span>Live locations</span>
            <span>Photo proof</span>
            <span>Geofence checks</span>
          </div>
        </div>
        <div className="hero-summary">
          <MetricCard label="Present Employees" value={String(metricsQuery.data?.present_employees ?? 0)} />
          <MetricCard label="Employees in Field" value={String(metricsQuery.data?.employees_in_field ?? 0)} />
        </div>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Present Employees" value={String(metricsQuery.data?.present_employees ?? 0)} />
        <MetricCard label="Absent Employees" value={String(metricsQuery.data?.absent_employees ?? 0)} />
        <MetricCard label="Employees in Field" value={String(metricsQuery.data?.employees_in_field ?? 0)} />
        <MetricCard label="Completed Visits" value={String(metricsQuery.data?.completed_visits ?? 0)} />
        <MetricCard label="Pending Visits" value={String(metricsQuery.data?.pending_visits ?? 0)} />
        <MetricCard label="Distance Covered" value={`${Math.round(metricsQuery.data?.distance_covered_today_meters ?? 0)} m`} />
      </div>

      {/* Leave Overview Section */}
      <div className="glass-card card-soft" style={{ padding: '1.5rem', width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontSize: '0.75rem' }}>
              LEAVE MANAGEMENT
            </span>
            <h4 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.2rem 0' }}>Leave Overview</h4>
          </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigate('/leaves')}
            style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', cursor: 'pointer', padding: '0.4rem 0.8rem' }}
          >
            View All Leaves →
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div
            onClick={() => navigate('/leaves?status=PENDING')}
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '2px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '14px',
              padding: '1.2rem',
              cursor: 'pointer',
              boxShadow: (metricsQuery.data?.pending_leaves ?? 0) > 0 ? '0 4px 14px rgba(245, 158, 11, 0.15)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>
                Pending Review
              </span>
              {(metricsQuery.data?.pending_leaves ?? 0) > 0 && (
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#D97706' }} />
              )}
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#B45309', marginTop: '0.3rem' }}>
              {metricsQuery.data?.pending_leaves ?? 0}
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Click to view requests requiring action
            </p>
          </div>

          <div
            onClick={() => navigate('/leaves?status=APPROVED')}
            style={{
              background: 'rgba(34, 197, 94, 0.06)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '14px',
              padding: '1.2rem',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#16A34A', textTransform: 'uppercase' }}>
              Approved Leaves
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#15803D', marginTop: '0.3rem' }}>
              {metricsQuery.data?.approved_leaves ?? 0}
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Approved requests
            </p>
          </div>

          <div
            onClick={() => navigate('/leaves?status=REJECTED')}
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '14px',
              padding: '1.2rem',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase' }}>
              Rejected Leaves
            </span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#B91C1C', marginTop: '0.3rem' }}>
              {metricsQuery.data?.rejected_leaves ?? 0}
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--muted)' }}>
              Rejected requests
            </p>
          </div>
        </div>
      </div>

      {/* Route Monitoring / Live Employee Locations Section */}
      <div style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
        <div className="glass-card card-soft">
          {!selectedEmployeeForRoute ? (
            /* DEFAULT VIEW: ALL LIVE EMPLOYEES ON MAP */
            <>
              <div className="section-header">
                <div>
                  <span className="eyebrow">Route monitoring</span>
                  <h4>Live employee locations</h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    Click on any employee marker to view their start-to-end travel route.
                  </p>
                </div>
                <span className="badge success">Tracking active ({filteredLocations.length} on duty)</span>
              </div>
              {liveLocationsQuery.isLoading ? (
                <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px' }}>
                  Loading map...
                </div>
              ) : (
                <>
                  {filteredLocations.length > 0 && (
                    <div style={{
                      display: 'flex',
                      gap: '0.5rem',
                      overflowX: 'auto',
                      paddingBottom: '0.6rem',
                      marginBottom: '0.75rem',
                      alignItems: 'center',
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                        ACTIVE EMPLOYEES:
                      </span>
                      {filteredLocations.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => setSelectedEmployeeForRoute(emp)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.35rem 0.75rem',
                            borderRadius: '999px',
                            border: '1px solid var(--border)',
                            background: 'var(--panel)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                          }}
                        >
                          <img
                            src={emp.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=6B2FA0&color=fff`}
                            alt={emp.name}
                            style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }}
                          />
                          <span style={{ fontWeight: 600 }}>{emp.name}</span>
                          <span style={{ color: 'var(--primary)', fontSize: '0.72rem', fontWeight: 700 }}>
                            Trace Route →
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <LiveLocationsMap
                    locations={filteredLocations}
                    onEmployeeClick={(emp) => setSelectedEmployeeForRoute(emp)}
                  />
                </>
              )}
            </>
          ) : (
            /* DETAIL VIEW: SINGLE EMPLOYEE ROUTE (START TO END) */
            <>
              {/* Header with back button & navigation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedEmployeeForRoute(null)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '10px',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: 'var(--panel)',
                    }}
                  >
                    <ArrowLeft size={16} /> Back to all live employees
                  </button>
                  <div>
                    <span className="eyebrow" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontSize: '0.72rem' }}>
                      CANDIDATE TRACKING ROUTE
                    </span>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0.1rem 0' }}>
                      {selectedEmployeeForRoute.name} ({selectedEmployeeForRoute.employee_id})
                    </h4>
                  </div>
                </div>

                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => navigate(`/tracking/${selectedEmployeeForRoute.employee_id}`)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    cursor: 'pointer',
                    padding: '0.4rem 0.8rem',
                  }}
                >
                  Open in Tracking Center <ExternalLink size={14} />
                </button>
              </div>

              {/* Quick Route Summary Card */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.75rem',
                background: 'var(--accent-soft)',
                padding: '0.85rem 1rem',
                borderRadius: '12px',
                marginBottom: '1rem',
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img
                    src={selectedEmployeeForRoute.profile_photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedEmployeeForRoute.name)}&background=6B2FA0&color=fff`}
                    alt={selectedEmployeeForRoute.name}
                    style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                  />
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>{selectedEmployeeForRoute.name}</strong>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--muted)' }}>
                      {selectedEmployeeForRoute.department || 'Healthcare Professional'}
                    </p>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Status
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: employeeRouteQuery.data?.is_present ? '#10B981' : '#EF4444',
                    }} />
                    <strong style={{ fontSize: '0.85rem', color: employeeRouteQuery.data?.is_present ? '#065F46' : '#991B1B' }}>
                      {employeeRouteQuery.data?.is_present ? 'Active on Duty' : 'Checked Out'}
                    </strong>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Start (Login) Time
                  </span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.15rem' }}>
                    {employeeRouteQuery.data?.check_in_time
                      ? new Date(employeeRouteQuery.data.check_in_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                      : '—'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Distance Covered
                  </span>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.15rem', color: 'var(--primary)' }}>
                    {employeeRouteQuery.data
                      ? `${(employeeRouteQuery.data.distance_covered_meters / 1000).toFixed(2)} km`
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Map view */}
              {employeeRouteQuery.isLoading ? (
                <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px', color: 'var(--muted)' }}>
                  Loading candidate tracking route...
                </div>
              ) : employeeRouteQuery.isError ? (
                <div style={{ height: '420px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px', color: 'var(--danger)' }}>
                  Unable to load tracking route for this employee.
                </div>
              ) : (employeeRouteQuery.data?.route?.length ?? 0) === 0 ? (
                <div style={{ height: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--panel)', borderRadius: '14px', color: 'var(--muted)', gap: '0.5rem' }}>
                  <Navigation size={32} color="var(--muted)" />
                  <p>No GPS route points recorded for today yet.</p>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedEmployeeForRoute(null)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                  >
                    Back to all live employees
                  </button>
                </div>
              ) : (
                <RouteMap
                  points={employeeRouteQuery.data?.route || []}
                  isLive={employeeRouteQuery.data?.is_present}
                  employeeName={selectedEmployeeForRoute.name}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
