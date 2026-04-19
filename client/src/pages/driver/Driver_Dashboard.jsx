import { useState, useEffect, useRef } from 'react'
import AppShell from '../../components/AppShell'
import StatusBadge from '../../components/StatusBadge'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import MapRoute from '../../components/MapRoute'
import api from '../../api/axios'
import toast from 'react-hot-toast'

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function DriverDashboard() {
  const [tab,         setTab]         = useState('dashboard')
  const [profile,     setProfile]     = useState(null)
  const [online,      setOnline]      = useState(false)
  const [toggling,    setToggling]    = useState(false)
  const [available,   setAvailable]   = useState([])
  const [activeRide,  setActiveRide]  = useState(null)
  const [history,     setHistory]     = useState([])
  const [histLoading, setHistLoading] = useState(false)
  const [otp,         setOtp]         = useState('')
  const [otpError,    setOtpError]    = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    loadProfile()
    loadHistory()
    checkActive()
  }, []) // eslint-disable-line

  // Poll active ride every 6s
  useEffect(() => {
    const t = setInterval(checkActive, 6000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line

  // Poll available requests every 8s when online
  useEffect(() => {
    if (!online) { setAvailable([]); return }
    loadAvailable()
    pollRef.current = setInterval(loadAvailable, 8000)
    return () => clearInterval(pollRef.current)
  }, [online]) // eslint-disable-line

  async function loadProfile() {
    try {
      const r = await api.get('/drivers/me')
      setProfile(r.data.driver)
      setOnline(r.data.driver?.is_available || false)
    } catch {}
  }

  async function checkActive() {
    try {
      const r = await api.get('/rides/active/driver')
      setActiveRide(r.data.ride || null)
    } catch {}
  }

  async function loadAvailable() {
    try {
      const r = await api.get('/rides/available')
      setAvailable(r.data.requests || [])
    } catch {}
  }

  async function loadHistory() {
    setHistLoading(true)
    try {
      const r = await api.get('/rides/history/driver')
      setHistory(r.data.rides || [])
    } catch {} finally { setHistLoading(false) }
  }

  async function toggleOnline() {
    setToggling(true)
    try {
      const next = !online
      if (next) {
        await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(
            async pos => {
              try {
                await api.patch('/drivers/location', { lat: pos.coords.latitude, lng: pos.coords.longitude })
                res()
              } catch { rej(new Error('Location update failed')) }
            },
            () => rej(new Error('Could not get location'))
          )
        )
      }
      await api.patch('/drivers/availability', { is_available: next })
      setOnline(next)
      toast.success(next ? 'You are online' : 'You are offline')
    } catch (err) {
      toast.error(err.message || 'Toggle failed')
    } finally { setToggling(false) }
  }

  async function acceptRide(requestId) {
    try {
      await api.post(`/rides/accept/${requestId}`)
      toast.success('Ride accepted')
      setAvailable([])
      await checkActive()
    } catch (err) { toast.error(err.response?.data?.message || 'Accept failed') }
  }

  async function startRide() {
    if (!otp.trim()) { setOtpError('Enter the OTP provided by the rider.'); return }
    setOtpError(null)
    setActionLoading(true)
    try {
      await api.patch(`/rides/${activeRide.ride_id}/start`, { otp: otp.trim() })
      toast.success('Ride started')
      setOtp('')
      await checkActive()
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Invalid OTP')
    } finally { setActionLoading(false) }
  }

  async function completeRide() {
    setActionLoading(true)
    try {
      await api.patch(`/rides/${activeRide.ride_id}/complete`)
      toast.success('Ride completed')
      await checkActive(); loadHistory()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setActionLoading(false) }
  }

  async function confirmPayment() {
    setActionLoading(true)
    try {
      await api.patch(`/rides/${activeRide.ride_id}/confirm-payment`)
      toast.success('Payment confirmed')
      setActiveRide(null); loadHistory()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setActionLoading(false) }
  }

  const nearestZone = profile?.nearest_zone?.zone_name || '—'

  const histColumns = [
    { key: 'created_at', label: 'Date', render: v => fmt(v) },
    { key: 'pickup_address', label: 'From → To', render: (_, row) => `${row.pickup_address?.split(',')[0]} → ${row.drop_address?.split(',')[0]}` },
    { key: 'total_amount', label: 'Fare', render: v => v ? `₹${parseFloat(v).toFixed(0)}` : '—' },
    { key: 'driver_rating', label: 'Rating', render: v => v ? `★ ${v}` : '—' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
  ]

  return (
    <AppShell role="driver" activeTab={tab} onTabChange={setTab}>
      <div className="page-enter">

        {tab === 'dashboard' && (
          <>
            {/* Header */}
            <div className="section-header">
              <div>
                <h1 className="section-title" style={{ marginBottom: 'var(--sp-1)' }}>
                  {profile?.full_name || 'Driver'}
                </h1>
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {profile?.vehicle_type?.toUpperCase()} · {profile?.registration_no} · ★ {parseFloat(profile?.avg_rating || 0).toFixed(1)}
                </p>
              </div>
              <button
                id="btn-toggle-online"
                className={`toggle-btn${online ? ' toggle-btn--on' : ''}`}
                onClick={toggleOnline}
                disabled={toggling}
              >
                {toggling ? 'Updating…' : online ? 'Go Offline' : 'Go Online'}
              </button>
            </div>

            {/* Stats */}
            <div className="stat-grid">
              <StatCard label="Total rides"  value={profile?.total_rides ?? '—'} />
              <StatCard label="Total earned" value={profile?.total_earned ? `₹${parseFloat(profile.total_earned).toFixed(0)}` : '—'} />
              <StatCard label="Avg rating"   value={profile?.avg_rating ? parseFloat(profile.avg_rating).toFixed(1) : '—'} />
              <StatCard label="Current zone" value={nearestZone} />
            </div>

            {/* Active ride panel */}
            {activeRide && (
              <div className="ride-panel">
                <div className="ride-panel__head">
                  <span className="ride-panel__title">Active ride #{activeRide.ride_id}</span>
                  <StatusBadge status={activeRide.status} />
                </div>
                <div className="ride-panel__body">
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
                    {activeRide.pickup_address} → {activeRide.drop_address}
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 'var(--sp-4)' }}>
                    Rider: {activeRide.rider_name} · ₹{parseFloat(activeRide.estimated_fare || 0).toFixed(0)} est.
                  </p>

                  {activeRide.pickup_lat && activeRide.drop_lat && (
                    <div style={{ marginBottom: 'var(--sp-4)' }}>
                      <MapRoute
                        pickupCoords={[parseFloat(activeRide.pickup_lng), parseFloat(activeRide.pickup_lat)]}
                        dropCoords={[parseFloat(activeRide.drop_lng), parseFloat(activeRide.drop_lat)]}
                        height="220px"
                      />
                    </div>
                  )}

                  {activeRide.status === 'otp_pending' && (
                    <div className="form-group">
                      {otpError && <p className="form-error" role="alert">{otpError}</p>}
                      <label className="label" htmlFor="driver-otp">Enter rider OTP</label>
                      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                        <input id="driver-otp" className="input" type="text" placeholder="4-digit OTP"
                          value={otp} onChange={e => setOtp(e.target.value)} maxLength={6}
                          style={{ width: 140 }} />
                        <button id="btn-start-ride" className="btn btn-primary"
                          onClick={startRide} disabled={actionLoading}>
                          {actionLoading ? 'Verifying…' : 'Start ride'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeRide.status === 'active' && (
                    <button id="btn-complete-ride" className="btn btn-primary"
                      onClick={completeRide} disabled={actionLoading}>
                      {actionLoading ? 'Completing…' : 'Complete ride'}
                    </button>
                  )}

                  {activeRide.status === 'completed' && (
                    <button id="btn-confirm-payment" className="btn btn-primary"
                      onClick={confirmPayment} disabled={actionLoading}>
                      {actionLoading ? 'Confirming…' : 'Confirm payment'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Available requests */}
            {online && !activeRide && (
              <div>
                <div className="section-header">
                  <h2 className="section-title" style={{ marginBottom: 0 }}>Available requests</h2>
                </div>
                {available.length === 0 ? (
                  <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>No requests nearby. Checking every 8 seconds.</p>
                ) : (
                  available.map(req => (
                    <div key={req.request_id} className="request-item">
                      <div>
                        <div className="request-item__route">
                          {req.pickup_address?.split(',')[0]} → {req.drop_address?.split(',')[0]}
                        </div>
                        <div className="request-item__meta">
                          {req.vehicle_type?.toUpperCase()} · ₹{parseFloat(req.estimated_fare || 0).toFixed(0)} est.
                        </div>
                      </div>
                      <button id={`btn-accept-${req.request_id}`} className="btn btn-primary"
                        onClick={() => acceptRide(req.request_id)}>
                        Accept
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <h1 className="section-title">Ride history</h1>
            <DataTable
              columns={histColumns}
              rows={history}
              loading={histLoading}
              emptyMessage="No rides yet."
            />
          </>
        )}
      </div>
    </AppShell>
  )
}