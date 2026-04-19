import { useState, useEffect } from 'react'
import AppShell from '../../components/AppShell'
import StatusBadge from '../../components/StatusBadge'
import StatCard from '../../components/StatCard'
import DataTable from '../../components/DataTable'
import api from '../../api/axios'
import toast from 'react-hot-toast'

function fmt(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

// Inline suspend dropdown per row
function SuspendActions({ userId, status, onAction }) {
  const [duration, setDuration] = useState('1_day')
  const [loading,  setLoading]  = useState(false)

  async function suspend() {
    setLoading(true)
    try {
      await api.patch(`/admin/users/${userId}/suspend`, { duration })
      toast.success('User suspended')
      onAction()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setLoading(false) }
  }

  async function activate() {
    setLoading(true)
    try {
      await api.patch(`/admin/users/${userId}/activate`)
      toast.success('User activated')
      onAction()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setLoading(false) }
  }

  if (status === 'suspended') {
    return (
      <button id={`btn-activate-${userId}`} className="btn btn-secondary"
        onClick={activate} disabled={loading} style={{ fontSize: 12 }}>
        {loading ? '…' : 'Activate'}
      </button>
    )
  }

  return (
    <span style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'center' }}>
      <select className="input-sm" value={duration} onChange={e => setDuration(e.target.value)}
        id={`suspend-duration-${userId}`}>
        <option value="1_day">1 day</option>
        <option value="3_days">3 days</option>
        <option value="1_week">1 week</option>
        <option value="permanent">Permanent</option>
      </select>
      <button id={`btn-suspend-${userId}`} className="btn btn-secondary"
        onClick={suspend} disabled={loading} style={{ fontSize: 12 }}>
        {loading ? '…' : 'Suspend'}
      </button>
    </span>
  )
}

export default function AdminDashboard() {
  const [tab, setTab] = useState('overview')

  // Overview
  const [stats,     setStats]     = useState(null)
  const [zoneRev,   setZoneRev]   = useState([])
  const [statsLoad, setStatsLoad] = useState(false)

  // Rides
  const [rides,     setRides]     = useState([])
  const [ridesLoad, setRidesLoad] = useState(false)

  // Drivers
  const [drivers,     setDrivers]     = useState([])
  const [driversLoad, setDriversLoad] = useState(false)

  // Riders
  const [riders,     setRiders]     = useState([])
  const [ridersLoad, setRidersLoad] = useState(false)

  // Zones
  const [zones,     setZones]     = useState([])
  const [zonesLoad, setZonesLoad] = useState(false)
  const [surgeEdits, setSurgeEdits] = useState({})  // { zone_id: { surge_multiplier, admin_surge } }

  useEffect(() => { loadStats() }, []) // eslint-disable-line

  useEffect(() => {
    if (tab === 'overview')  loadStats()
    if (tab === 'rides')     loadRides()
    if (tab === 'drivers')   loadDrivers()
    if (tab === 'riders')    loadRiders()
    if (tab === 'zones')     loadZones()
  }, [tab]) // eslint-disable-line

  async function loadStats() {
    setStatsLoad(true)
    try {
      const [s, z] = await Promise.all([api.get('/admin/stats'), api.get('/admin/revenue/zones')])
      setStats(s.data)
      setZoneRev(z.data.zones || [])
    } catch {} finally { setStatsLoad(false) }
  }

  async function loadRides() {
    setRidesLoad(true)
    try { const r = await api.get('/admin/rides'); setRides(r.data.rides || []) }
    catch {} finally { setRidesLoad(false) }
  }

  async function loadDrivers() {
    setDriversLoad(true)
    try { const r = await api.get('/admin/drivers'); setDrivers(r.data.drivers || []) }
    catch {} finally { setDriversLoad(false) }
  }

  async function loadRiders() {
    setRidersLoad(true)
    try { const r = await api.get('/admin/riders'); setRiders(r.data.riders || []) }
    catch {} finally { setRidersLoad(false) }
  }

  async function loadZones() {
    setZonesLoad(true)
    try { const r = await api.get('/admin/zones'); setZones(r.data.zones || []) }
    catch {} finally { setZonesLoad(false) }
  }

  async function verifyDriver(driverId) {
    try {
      await api.patch(`/admin/drivers/${driverId}/verify`)
      toast.success('Driver verified')
      loadDrivers()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  async function saveSurge(zoneId, field, value) {
    try {
      const endpoint = field === 'surge_multiplier'
        ? `/admin/zones/${zoneId}/multiplier`
        : `/admin/zones/${zoneId}/surge_admin`
      const body = field === 'surge_multiplier'
        ? { surge_multiplier: parseFloat(value) }
        : { admin_surge_multiplier: parseFloat(value) }
      await api.patch(endpoint, body)
      toast.success('Saved')
      loadZones()
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed') }
  }

  function getSurgeEdit(zoneId, field, fallback) {
    return surgeEdits[zoneId]?.[field] ?? fallback
  }

  function setSurgeEdit(zoneId, field, value) {
    setSurgeEdits(e => ({ ...e, [zoneId]: { ...e[zoneId], [field]: value } }))
  }

  // Column definitions
  const ridesColumns = [
    { key: 'ride_id', label: 'ID', render: v => <span className="mono" style={{ fontSize: 12 }}>{v}</span> },
    { key: 'rider_name',  label: 'Rider' },
    { key: 'driver_name', label: 'Driver' },
    { key: 'vehicle_type', label: 'Vehicle', render: v => v?.toUpperCase() },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'total_amount', label: 'Fare', render: v => v ? `₹${parseFloat(v).toFixed(0)}` : '—' },
    { key: 'created_at', label: 'Date', render: v => fmt(v) },
  ]

  const driversColumns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email',     label: 'Email' },
    { key: 'vehicle_type', label: 'Vehicle', render: v => v?.toUpperCase() },
    { key: 'zone_name', label: 'Zone' },
    { key: 'avg_rating', label: 'Rating', render: v => v ? `★ ${parseFloat(v).toFixed(1)}` : '—' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'is_verified', label: 'Verified', render: v => v ? 'Yes' : 'No' },
    { key: 'driver_id', label: 'Actions', render: (dId, row) => (
      <span style={{ display: 'flex', gap: 'var(--sp-1)', flexWrap: 'wrap' }}>
        {!row.is_verified && (
          <button id={`btn-verify-${dId}`} className="btn btn-secondary"
            onClick={() => verifyDriver(dId)} style={{ fontSize: 12 }}>Verify</button>
        )}
        <SuspendActions userId={row.user_id} status={row.status} onAction={loadDrivers} />
      </span>
    )},
  ]

  const ridersColumns = [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'total_rides', label: 'Total rides' },
    { key: 'total_spent', label: 'Total spent', render: v => v ? `₹${parseFloat(v).toFixed(0)}` : '—' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'user_id', label: 'Actions', render: (uId, row) => (
      <SuspendActions userId={uId} status={row.status} onAction={loadRiders} />
    )},
  ]

  const zoneRevColumns = [
    { key: 'zone_name', label: 'Zone' },
    { key: 'area', label: 'Area' },
    { key: 'total_rides', label: 'Rides' },
    { key: 'total_revenue', label: 'Revenue', render: v => v ? `₹${parseFloat(v).toFixed(0)}` : '—' },
    { key: 'surge_multiplier', label: 'Surge' },
    { key: 'admin_surge_multiplier', label: 'Admin surge' },
  ]

  const zonesColumns = [
    { key: 'zone_name', label: 'Zone' },
    { key: 'area', label: 'Area' },
    { key: 'center_lat', label: 'Lat' },
    { key: 'center_lng', label: 'Lng' },
    { key: 'surge_multiplier', label: 'Surge', render: (v, row) => (
      <span style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'center' }}>
        <input className="input-sm" type="number" step="0.1" min="1"
          id={`surge-${row.zone_id}`}
          value={getSurgeEdit(row.zone_id, 'surge_multiplier', v)}
          onChange={e => setSurgeEdit(row.zone_id, 'surge_multiplier', e.target.value)} />
        <button className="btn btn-secondary" style={{ fontSize: 12 }}
          id={`btn-save-surge-${row.zone_id}`}
          onClick={() => saveSurge(row.zone_id, 'surge_multiplier', getSurgeEdit(row.zone_id, 'surge_multiplier', v))}>
          Save
        </button>
      </span>
    )},
    { key: 'admin_surge_multiplier', label: 'Admin surge', render: (v, row) => (
      <span style={{ display: 'flex', gap: 'var(--sp-1)', alignItems: 'center' }}>
        <input className="input-sm" type="number" step="0.1" min="1"
          id={`admin-surge-${row.zone_id}`}
          value={getSurgeEdit(row.zone_id, 'admin_surge', v)}
          onChange={e => setSurgeEdit(row.zone_id, 'admin_surge', e.target.value)} />
        <button className="btn btn-secondary" style={{ fontSize: 12 }}
          id={`btn-save-admin-surge-${row.zone_id}`}
          onClick={() => saveSurge(row.zone_id, 'admin_surge_multiplier', getSurgeEdit(row.zone_id, 'admin_surge', v))}>
          Save
        </button>
      </span>
    )},
  ]

  return (
    <AppShell role="admin" activeTab={tab} onTabChange={setTab}>
      <div className="page-enter">

        {/* Tab bar */}
        <div className="tab-bar" role="tablist">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'rides',    label: 'All Rides' },
            { id: 'drivers',  label: 'Drivers' },
            { id: 'riders',   label: 'Riders' },
            { id: 'zones',    label: 'Zones' },
          ].map(t => (
            <button key={t.id} id={`tab-${t.id}`}
              className={`tab-btn${tab === t.id ? ' tab-btn--active' : ''}`}
              onClick={() => setTab(t.id)} role="tab"
              aria-selected={tab === t.id}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <>
            <div className="stat-grid">
              <StatCard label="Total rides"        value={statsLoad ? '…' : (stats?.total_rides ?? '—')} />
              <StatCard label="Active now"         value={statsLoad ? '…' : (stats?.active_rides ?? '—')} />
              <StatCard label="Total revenue"      value={statsLoad ? '…' : (stats?.total_revenue ? `₹${parseFloat(stats.total_revenue).toFixed(0)}` : '—')} />
              <StatCard label="Registered drivers" value={statsLoad ? '…' : (stats?.total_drivers ?? '—')} />
            </div>
            <h2 className="section-title">Live zone data</h2>
            <DataTable columns={zoneRevColumns} rows={zoneRev} loading={statsLoad} emptyMessage="No zone data." />
          </>
        )}

        {/* All Rides */}
        {tab === 'rides' && (
          <>
            <h1 className="section-title">All rides</h1>
            <DataTable columns={ridesColumns} rows={rides} loading={ridesLoad} emptyMessage="No rides." />
          </>
        )}

        {/* Drivers */}
        {tab === 'drivers' && (
          <>
            <h1 className="section-title">Drivers</h1>
            <DataTable columns={driversColumns} rows={drivers} loading={driversLoad} emptyMessage="No drivers." />
          </>
        )}

        {/* Riders */}
        {tab === 'riders' && (
          <>
            <h1 className="section-title">Riders</h1>
            <DataTable columns={ridersColumns} rows={riders} loading={ridersLoad} emptyMessage="No riders." />
          </>
        )}

        {/* Zones */}
        {tab === 'zones' && (
          <>
            <h1 className="section-title">Zones</h1>
            <DataTable columns={zonesColumns} rows={zones} loading={zonesLoad} emptyMessage="No zones." />
          </>
        )}
      </div>
    </AppShell>
  )
}