import { useState, useEffect } from 'react'
import AppShell from '../../components/AppShell'
import StatusBadge from '../../components/StatusBadge'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import LocationSearch from '../../components/LocationSearch'
import MapRoute from '../../components/MapRoute'
import api from '../../api/axios'
import toast from 'react-hot-toast'
import { fetchRoute, haversineDistance } from '../../utils/mapUtils'

const BASE_RATES = { auto: 15, sedan: 20, suv: 25, xl: 30, bike: 10 }
const BASE_FARE  = 30

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function RiderDashboard() {
  const [tab, setTab] = useState('dashboard')

  const [activeRide,    setActiveRide]    = useState(null)
  const [pendingReq,    setPendingReq]    = useState(null)
  const [history,       setHistory]       = useState([])
  const [histLoading,   setHistLoading]   = useState(false)
  const [zones,         setZones]         = useState([])
  const [ratingRide,    setRatingRide]    = useState(null)
  const [ratingVal,     setRatingVal]     = useState(0)
  const [ratingLoading, setRatingLoading] = useState(false)

  const [form, setForm] = useState({
    pickup_address: '', pickup_lat: null, pickup_lng: null,
    drop_address: '',   drop_lat: null,   drop_lng: null,
    vehicle_type: 'sedan', payment_method: '', promo_code: '',
    estimated_km: '',
  })
  const [pickupSet,    setPickupSet]    = useState(false)
  const [dropSet,      setDropSet]      = useState(false)
  const [routeData,    setRouteData]    = useState(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [booking,      setBooking]      = useState(false)
  const [bookError,    setBookError]    = useState(null)
  const [surgeZone,    setSurgeZone]    = useState(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  // Initial load
  useEffect(() => {
    checkActive()
    loadHistory()
    api.get('/rides/zones').then(r => setZones(r.data.zones || [])).catch(() => {})
  }, []) // eslint-disable-line

  // Poll active ride every 6s
  useEffect(() => {
    const t = setInterval(checkActive, 6000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line

  // Poll unrated every 6s
  useEffect(() => {
    const check = async () => {
      try {
        const r = await api.get('/rides/unrated/rider')
        if (r.data.ride && !ratingRide) { setRatingRide(r.data.ride); setRatingVal(0) }
      } catch {}
    }
    check()
    const t = setInterval(check, 6000)
    return () => clearInterval(t)
  }, [ratingRide?.ride_id]) // eslint-disable-line

  // Route calculation
  useEffect(() => {
    if (!pickupSet || !dropSet) return
    const p = [form.pickup_lng, form.pickup_lat]
    const d = [form.drop_lng,   form.drop_lat]
    if (!p[0] || !d[0]) return
    let cancelled = false
    setRouteLoading(true)
    ;(async () => {
      const data = await fetchRoute(p, d)
      if (cancelled) return
      if (data) {
        setRouteData(data)
        setForm(f => ({ ...f, estimated_km: String(data.distance_km) }))
      } else {
        const km = haversineDistance(form.pickup_lat, form.pickup_lng, form.drop_lat, form.drop_lng)
        setRouteData(null)
        setForm(f => ({ ...f, estimated_km: String(km) }))
      }
      setRouteLoading(false)
    })()
    return () => { cancelled = true }
  }, [pickupSet, dropSet, form.pickup_lat, form.pickup_lng, form.drop_lat, form.drop_lng]) // eslint-disable-line

  // Zone detection
  useEffect(() => {
    if (!form.pickup_lat || zones.length === 0) { setSurgeZone(null); return }
    let best = null, bestDist = Infinity
    for (const z of zones) {
      const dist = haversineDistance(form.pickup_lat, form.pickup_lng, parseFloat(z.center_lat), parseFloat(z.center_lng))
      if (dist <= 1.0 && dist < bestDist) { bestDist = dist; best = z }
    }
    setSurgeZone(best)
  }, [form.pickup_lat, form.pickup_lng, zones])

  async function checkActive() {
    try {
      const r = await api.get('/rides/active/rider')
      if (r.data.ride) { setActiveRide(r.data.ride); setPendingReq(null) }
      else if (r.data.pending_request) { setPendingReq(r.data.pending_request); setActiveRide(null) }
      else {
        setActiveRide(prev => { if (prev) loadHistory(); return null })
        setPendingReq(null)
      }
    } catch {}
  }

  async function loadHistory() {
    setHistLoading(true)
    try {
      const r = await api.get('/rides/history/rider')
      setHistory(r.data.rides || [])
    } catch {} finally { setHistLoading(false) }
  }

  async function requestRide(e) {
    e.preventDefault()
    setBookError(null)
    if (!form.pickup_lat) { setBookError('Select a pickup location from the suggestions.'); return }
    if (!form.drop_lat)   { setBookError('Select a drop location from the suggestions.'); return }
    if (!form.payment_method) { setBookError('Select a payment method.'); return }
    setBooking(true)
    try {
      const { data } = await api.post('/rides/request', {
        pickup_address: form.pickup_address, pickup_lat: form.pickup_lat, pickup_lng: form.pickup_lng,
        dropoff_address: form.drop_address,  dropoff_lat: form.drop_lat,  dropoff_lng: form.drop_lng,
        vehicle_type: form.vehicle_type, payment_method: form.payment_method,
        promo_code: form.promo_code || undefined,
        zone_id: surgeZone?.zone_id || undefined,
        estimated_km: form.estimated_km,
      })
      toast.success(data.message || 'Ride requested')
      await checkActive()
      setTab('dashboard')
    } catch (err) {
      setBookError(err.response?.data?.message || 'Could not request ride.')
    } finally { setBooking(false) }
  }

  async function cancelPending() {
    if (!pendingReq?.request_id) return
    setCancelLoading(true)
    try {
      await api.delete(`/rides/request/${pendingReq.request_id}/cancel`)
      toast.success('Request cancelled')
      setPendingReq(null)
    } catch (err) { toast.error(err.response?.data?.message || 'Cancel failed') }
    finally { setCancelLoading(false) }
  }

  async function cancelActive() {
    if (!activeRide?.ride_id) return
    setCancelLoading(true)
    try {
      await api.patch(`/rides/${activeRide.ride_id}/cancel`, { reason: 'Cancelled by rider' })
      toast.success('Ride cancelled')
      setActiveRide(null); loadHistory(); setTab('dashboard')
    } catch (err) { toast.error(err.response?.data?.message || 'Cancel failed') }
    finally { setCancelLoading(false) }
  }

  async function submitRating() {
    if (!ratingRide?.ride_id || ratingVal < 1) { toast.error('Select a star rating'); return }
    setRatingLoading(true)
    try {
      await api.patch(`/rides/${ratingRide.ride_id}/rate`, { rating: ratingVal, comment: '' })
      toast.success('Rating submitted')
      setRatingRide(null); setRatingVal(0); loadHistory()
    } catch (err) { toast.error(err.response?.data?.message || 'Rating failed') }
    finally { setRatingLoading(false) }
  }

  // Estimated fare
  const surge = surgeZone ? parseFloat(surgeZone.surge_multiplier || 1) * parseFloat(surgeZone.admin_surge_multiplier || 1) : 1
  const km    = parseFloat(form.estimated_km) || 0
  const rate  = BASE_RATES[form.vehicle_type] || 20
  const estimatedFare = km > 0 ? Math.round((BASE_FARE + km * rate) * surge) : null

  const completedCount = history.filter(r => r.status === 'completed').length
  const hasActive = !!activeRide || !!pendingReq

  const histColumns = [
    { key: 'created_at', label: 'Date', render: v => fmt(v) },
    { key: 'pickup_address', label: 'From → To', render: (_, row) => `${row.pickup_address?.split(',')[0]} → ${row.drop_address?.split(',')[0]}` },
    { key: 'vehicle_type', label: 'Vehicle', render: v => v?.toUpperCase() },
    { key: 'total_amount', label: 'Fare', render: v => v ? `₹${parseFloat(v).toFixed(0)}` : '—' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
  ]

  return (
    <AppShell role="rider" activeTab={tab} onTabChange={setTab}>
      <div className="page-enter">

        {/* Rate ride panel */}
        {ratingRide && (
          <div className="ride-panel" style={{ marginBottom: 'var(--sp-6)' }}>
            <div className="ride-panel__head">
              <span className="ride-panel__title">Rate your ride</span>
            </div>
            <div className="ride-panel__body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-3)' }}>
                How was your trip with <strong>{ratingRide.driver_name}</strong>?
              </p>
              <div className="star-row">
                {[1,2,3,4,5].map(s => (
                  <button key={s} id={`star-${s}`}
                    className={`star-btn${ratingVal >= s ? ' star-btn--active' : ''}`}
                    onClick={() => setRatingVal(s)} aria-label={`${s} star`}>★</button>
                ))}
              </div>
              <button id="btn-submit-rating" className="btn btn-primary"
                onClick={submitRating} disabled={ratingLoading || ratingVal < 1}>
                {ratingLoading ? 'Submitting…' : 'Submit rating'}
              </button>
              <button className="btn btn-secondary" style={{ marginLeft: 'var(--sp-2)' }}
                onClick={() => { setRatingRide(null); setRatingVal(0) }}>
                Skip
              </button>
            </div>
          </div>
        )}

        {tab === 'dashboard' && (
          <>
            <div className="section-header">
              <h1 className="section-title" style={{ marginBottom: 0 }}>Book a ride</h1>
            </div>

            <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <StatCard label="Total rides" value={completedCount} />
              <StatCard label="Active ride" value={hasActive ? 'Yes' : 'None'} />
            </div>

            {/* Active / pending ride notice */}
            {hasActive && (
              <div className="ride-panel">
                <div className="ride-panel__head">
                  <span className="ride-panel__title">
                    {activeRide ? `Ride #${activeRide.ride_id}` : 'Pending request'}
                  </span>
                  <StatusBadge status={activeRide?.status || 'pending'} />
                </div>
                <div className="ride-panel__body">
                  {activeRide && (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
                        {activeRide.driver_name} · {activeRide.vehicle_type?.toUpperCase()} · {activeRide.registration_no}
                      </p>
                      {activeRide.status === 'otp_pending' && (
                        <div style={{ marginBottom: 'var(--sp-4)' }}>
                          <div className="label">Your OTP — share with driver</div>
                          <div className="otp-display">{activeRide.otp}</div>
                        </div>
                      )}
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
                        {activeRide.pickup_address} → {activeRide.drop_address}
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
                      {activeRide.status === 'pending' && (
                        <button id="btn-cancel-ride" className="btn btn-secondary"
                          onClick={cancelActive} disabled={cancelLoading}>
                          {cancelLoading ? 'Cancelling…' : 'Cancel ride'}
                        </button>
                      )}
                    </>
                  )}
                  {pendingReq && !activeRide && (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
                        Waiting for a driver to accept your request…
                      </p>
                      <button id="btn-cancel-request" className="btn btn-secondary"
                        onClick={cancelPending} disabled={cancelLoading}>
                        {cancelLoading ? 'Cancelling…' : 'Cancel request'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Booking form */}
            {!hasActive && (
              <div className="ride-panel">
                <div className="ride-panel__head">
                  <span className="ride-panel__title">New ride</span>
                </div>
                <div className="ride-panel__body">
                  {bookError && <p className="form-error" role="alert">{bookError}</p>}
                  <form onSubmit={requestRide} noValidate>
                    <div className="form-group">
                      <LocationSearch
                        label="Pickup location"
                        placeholder="e.g. Connaught Place"
                        value={form.pickup_address}
                        onSelect={({ address, lat, lng }) => {
                          setForm(f => ({ ...f, pickup_address: address, pickup_lat: lat, pickup_lng: lng }))
                          setPickupSet(true)
                        }}
                      />
                    </div>
                    <div className="form-group">
                      <LocationSearch
                        label="Drop location"
                        placeholder="e.g. Cyber City, Gurugram"
                        value={form.drop_address}
                        onSelect={({ address, lat, lng }) => {
                          setForm(f => ({ ...f, drop_address: address, drop_lat: lat, drop_lng: lng }))
                          setDropSet(true)
                        }}
                      />
                    </div>

                    {pickupSet && dropSet && (
                      <div className="form-group">
                        <MapRoute
                          pickupCoords={[form.pickup_lng, form.pickup_lat]}
                          dropCoords={[form.drop_lng, form.drop_lat]}
                          height="200px"
                          routeGeometry={routeData?.geometry || null}
                        />
                      </div>
                    )}

                    {surgeZone && (
                      <p style={{ fontSize: 12, color: 'var(--status-warn)', marginBottom: 'var(--sp-3)' }}>
                        Surge zone: {surgeZone.zone_name}
                      </p>
                    )}

                    <div className="form-group">
                      <div className="label">Distance</div>
                      <div style={{ fontSize: 14, color: 'var(--text-secondary)', padding: 'var(--sp-3) 0' }}>
                        {routeLoading ? 'Calculating…' : form.estimated_km ? `${form.estimated_km} km${routeData?.duration_min ? ` · ~${Math.round(routeData.duration_min)} min` : ''}` : 'Select both locations above'}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="label">Vehicle type</label>
                      <div className="radio-group">
                        {Object.entries(BASE_RATES).map(([t, r]) => (
                          <label key={t} className="radio-label">
                            <input type="radio" name="vehicle_type" value={t}
                              checked={form.vehicle_type === t}
                              onChange={() => setForm(f => ({ ...f, vehicle_type: t }))} />
                            {t.charAt(0).toUpperCase() + t.slice(1)} · ₹{r}/km
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="label">Payment method</label>
                      <div className="radio-group">
                        {['Cash', 'Card', 'Wallet', 'UPI'].map(m => (
                          <label key={m} className="radio-label">
                            <input type="radio" name="payment_method" value={m.toLowerCase()}
                              checked={form.payment_method === m.toLowerCase()}
                              onChange={() => setForm(f => ({ ...f, payment_method: m.toLowerCase() }))} />
                            {m}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="label" htmlFor="promo-code">Promo code (optional)</label>
                      <input id="promo-code" className="input" type="text" placeholder="Enter promo code"
                        value={form.promo_code} onChange={e => setForm(f => ({ ...f, promo_code: e.target.value }))} />
                    </div>

                    {estimatedFare && (
                      <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 'var(--sp-4)' }}>
                        Estimated fare: <span className="mono" style={{ fontWeight: 500 }}>₹{estimatedFare}</span>
                        {surge > 1 && <span style={{ fontSize: 12, color: 'var(--status-warn)' }}> ({surge.toFixed(2)}× surge)</span>}
                      </p>
                    )}

                    <button id="btn-request-ride" className="btn btn-primary btn-full" type="submit"
                      disabled={booking} style={{ opacity: booking ? 0.7 : 1 }}>
                      {booking ? 'Requesting…' : 'Request ride'}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'history' && (
          <>
            <h1 className="section-title">Ride history</h1>
            <DataTable
              columns={histColumns}
              rows={history.slice(0, 20)}
              loading={histLoading}
              emptyMessage="No rides yet."
            />
          </>
        )}
      </div>
    </AppShell>
  )
}
