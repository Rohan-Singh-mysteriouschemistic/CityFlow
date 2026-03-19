import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'

const S = {
  shell: { display:'flex', minHeight:'100vh', background:'#0a0a0a' },
  sidebar: {
    width:220, background:'#111318', borderRight:'1px solid #2a2f3e',
    display:'flex', flexDirection:'column'
  },
  logo: {
    padding:'22px 20px', display:'flex', alignItems:'center', gap:10,
    borderBottom:'1px solid #2a2f3e'
  },
  logoIcon: {
    width:32, height:32, borderRadius:8,
    background:'linear-gradient(135deg,#2dd4a0,#4f8cff)',
    display:'flex', alignItems:'center', justifyContent:'center'
  },
  logoName: { fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:'#e8eaf0' },
  nav: { padding:'12px 8px', flex:1 },
  navItem: (active, disabled) => ({
    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
    borderRadius:8, cursor: disabled ? 'not-allowed' : 'pointer', fontSize:13, marginBottom:2,
    background: active ? 'rgba(45,212,160,.1)' : 'transparent',
    color: disabled ? '#3a3f50' : active ? '#2dd4a0' : '#8b93a8',
    fontWeight: active ? 500 : 400,
    border:'none', width:'100%', textAlign:'left', transition:'.15s',
    opacity: disabled ? 0.5 : 1
  }),
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'auto' },
  topbar: {
    padding:'18px 28px', borderBottom:'1px solid #2a2f3e',
    background:'#111318', display:'flex', alignItems:'center', justifyContent:'space-between'
  },
  content: { padding:'28px', flex:1 },
  grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 },
  kpi: {
    background:'#111318', border:'1px solid #2a2f3e', borderRadius:12,
    padding:'18px 20px'
  },
  kpiLabel: { fontSize:11, color:'#8b93a8', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8 },
  kpiVal: { fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:700, lineHeight:1 },
  card: { background:'#111318', border:'1px solid #2a2f3e', borderRadius:14, overflow:'hidden' },
  cardHead: {
    padding:'16px 20px', borderBottom:'1px solid #2a2f3e',
    display:'flex', alignItems:'center', justifyContent:'space-between'
  },
  cardTitle: { fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:600, color:'#e8eaf0' },
  cardBody: { padding:'20px' },
  pill: (c) => ({
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
    background: c==='completed'?'rgba(45,212,160,.12)':c==='in_progress'?'rgba(79,140,255,.12)':'rgba(240,96,96,.12)',
    color: c==='completed'?'#2dd4a0':c==='in_progress'?'#4f8cff':'#f06060'
  }),
  toggle: (on) => ({
    width:52, height:28, borderRadius:14, border:'none', cursor:'pointer',
    background: on ? '#2dd4a0' : '#2a2f3e', position:'relative',
    transition:'.3s', flexShrink:0
  }),
  toggleKnob: (on) => ({
    position:'absolute', top:3, left: on ? 27 : 3,
    width:22, height:22, borderRadius:'50%',
    background:'white', transition:'.3s'
  }),
  input: {
    background:'#181c24', border:'1px solid #2a2f3e', borderRadius:10,
    padding:'11px 14px', color:'#e8eaf0', fontSize:14, outline:'none', width:'100%'
  },
  select: {
    background:'#181c24', border:'1px solid #2a2f3e', borderRadius:10,
    padding:'11px 14px', color:'#e8eaf0', fontSize:14, outline:'none',
    width:'100%', boxSizing:'border-box', cursor:'pointer'
  },
  btn: {
    background:'linear-gradient(135deg,#2dd4a0,#4f8cff)',
    border:'none', borderRadius:10, padding:'12px 20px',
    color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', width:'100%'
  },
  rideRow: {
    display:'flex', alignItems:'flex-start', gap:14, padding:'14px 0',
    borderBottom:'1px solid #1e2330'
  },
  logoutBtn: {
    margin:'12px 8px', padding:'9px 12px', borderRadius:8, border:'none',
    background:'transparent', color:'#f06060', fontSize:13, cursor:'pointer',
    textAlign:'left', width:'calc(100% - 16px)'
  }
}

export default function DriverDashboard() {
  const { user, logout } = useAuth()
  const [tab,        setTab]        = useState('home')
  const [profile,    setProfile]    = useState(null)
  const [history,    setHistory]    = useState([])
  const [available,  setAvailable]  = useState(false)
  const [activeRide, setActiveRide] = useState(null)
  const [otp,        setOtp]        = useState('')
  const [loading,    setLoading]    = useState(false)
  const [requests,   setRequests]   = useState([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [accepting,  setAccepting]  = useState(null)
  const [paymentConfirmed, setPaymentConfirmed] = useState(false)
  // ── Zone state ──────────────────────────────
  const [zones,         setZones]         = useState([])
  const [selectedZone,  setSelectedZone]  = useState(null)   // zone_id (number)
  const [zoneLoading,   setZoneLoading]   = useState(false)
  // ────────────────────────────────────────────
  const prevRequestIds = useRef([])

  // ── initial load ──────────────────────────────────────────
  useEffect(() => {
    api.get('/auth/me').then(r => {
      setProfile(r.data.user)
      setAvailable(r.data.user.is_available || false)
      if (r.data.user.current_zone_id) setSelectedZone(r.data.user.current_zone_id)
    })
    api.get('/rides/zones').then(r => setZones(r.data.zones || []))
    loadHistory()
    checkActiveRide()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── polling every 5 s ────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      checkActiveRide()
      if (!activeRide) loadRequests()
    }, 5000)
    return () => clearInterval(interval)
  }, [tab, activeRide]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── notify driver when a NEW request appears in their zone ─
  useEffect(() => {
    if (requests.length === 0) return
    const currentIds = requests.map(r => r.request_id)
    const isFirstLoad = prevRequestIds.current.length === 0
    if (!isFirstLoad) {
      const newOnes = currentIds.filter(id => !prevRequestIds.current.includes(id))
      if (newOnes.length > 0) {
        toast('🚖 New ride request in your zone!', {
          duration: 4000,
          style: {
            background: '#111318', color: '#e8eaf0',
            border: '1px solid #2dd4a0', borderRadius: 10
          }
        })
        if (available && !activeRide) setTab('requests')
      }
    }
    prevRequestIds.current = currentIds
  }, [requests]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequests = async () => {
    try {
      const r = await api.get('/rides/available')
      setRequests(r.data.requests || [])
    } catch {}
  }

  const handleRefresh = async () => {
    setRequestsLoading(true)
    try {
      const r = await api.get('/rides/available')
      setRequests(r.data.requests || [])
      toast.success('Requests refreshed')
    } catch {
      toast.error('Failed to refresh requests')
    } finally {
      setRequestsLoading(false)
    }
  }

  const checkActiveRide = async () => {
    try {
      const r = await api.get('/rides/active/driver')
      setActiveRide(r.data.ride || null)
    } catch {}
  }

  // ── update operating zone ─────────────────────────────────
  const updateZone = async (zone_id) => {
    setZoneLoading(true)
    try {
      await api.patch('/drivers/zone', { zone_id: parseInt(zone_id) })
      setSelectedZone(parseInt(zone_id))
      const z = zones.find(z => z.zone_id === parseInt(zone_id))
      toast.success(`Zone updated to ${z?.zone_name || 'selected zone'}`)
      loadRequests()   // refresh available rides for new zone
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update zone')
    } finally {
      setZoneLoading(false)
    }
  }

  // ── accept: first-come-first-served ──────────────────────
  const acceptRequest = async (request_id) => {
    if (activeRide) {
      toast.error('Complete your current ride before accepting a new one')
      return
    }
    setAccepting(request_id)
    try {
      const { data } = await api.post(`/rides/accept/${request_id}`)
      toast.success(`Ride accepted! OTP: ${data.otp}`)
      await checkActiveRide()
      setTab('active')
      loadRequests()
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not accept ride'
      if (err.response?.status === 409) {
        toast.error('Ride was already accepted by another driver')
        loadRequests()
      } else {
        toast.error(msg)
      }
    } finally {
      setAccepting(null)
    }
  }

  const loadHistory = async () => {
    try {
      const r = await api.get('/rides/history/driver')
      setHistory(r.data.rides)
    } catch {}
  }

  const toggleAvailability = async () => {
    try {
      const newVal = !available
      setAvailable(newVal)
      await api.patch(`/drivers/availability`, { is_available: newVal })
      toast.success(newVal ? 'You are now online' : 'You are now offline')
      if (newVal) loadRequests()
    } catch {
      setAvailable(v => !v)
      toast.error('Failed to update status')
    }
  }

  const startRide = async (ride_id) => {
    if (!otp || otp.length !== 4) return toast.error('Enter 4-digit OTP')
    setLoading(true)
    try {
      await api.patch(`/rides/${ride_id}/start`, { otp })
      toast.success('Ride started!')
      await checkActiveRide()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start ride')
    } finally {
      setLoading(false)
    }
  }

  const completeRide = async (ride_id) => {
    setLoading(true)
    try {
      await api.patch(`/rides/${ride_id}/complete`, { actual_km: activeRide?.estimated_km || 12 })
      toast.success('Ride completed! Please confirm payment.')
      setPaymentConfirmed(false)
      await checkActiveRide()
      loadHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete ride')
    } finally {
      setLoading(false)
    }
  }

  const confirmPayment = async (ride_id) => {
    setLoading(true)
    try {
      await api.patch(`/rides/${ride_id}/confirm-payment`)
      toast.success('Payment confirmed!')
      setPaymentConfirmed(true)
      setActiveRide(null)
      setOtp('')
      loadHistory()
      setTab('home')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to confirm payment')
    } finally {
      setLoading(false)
    }
  }

  const hasActiveRide   = !!activeRide
  const totalEarned     = history.reduce((s,r) => s + parseFloat(r.total_amount||0), 0)
  const completedCnt    = history.filter(r => r.status === 'completed').length
  const avgRating       = profile?.avg_rating || 0
  const todayRides      = history.filter(r =>
    r.status==='completed' && new Date(r.start_time).toDateString()===new Date().toDateString()
  )
  const currentZoneName = zones.find(z => z.zone_id === selectedZone)?.zone_name || null

  const navItems = [
    { id:'home',     label:'Dashboard',   icon:'📊', disabled: false },
    { id:'requests', label:'Requests',    icon:'📬',
      disabled: hasActiveRide,
      badge: !hasActiveRide && requests.length > 0 ? requests.length : null },
    { id:'active',   label:'Active Ride', icon:'🚗', disabled: false },
    { id:'history',  label:'My Rides',    icon:'🕒', disabled: false },
    { id:'profile',  label:'Profile',     icon:'👤', disabled: false },
  ]

  return (
    <div style={S.shell}>
      {/* ── SIDEBAR ── */}
      <aside style={S.sidebar}>
        <div style={S.logo}>
          <div style={S.logoIcon}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={S.logoName}>CityFlow</span>
        </div>

        <nav style={S.nav}>
          {navItems.map(item => (
            <button
              key={item.id}
              style={S.navItem(tab===item.id, item.disabled)}
              onClick={() => !item.disabled && setTab(item.id)}
              title={item.disabled ? 'Complete your active ride first' : ''}
            >
              <span style={{fontSize:15}}>{item.icon}</span>
              <span style={{flex:1}}>{item.label}</span>
              {item.badge && (
                <span style={{
                  background:'#f06060', color:'#fff',
                  borderRadius:'50%', width:18, height:18,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, fontWeight:700, flexShrink:0
                }}>{item.badge}</span>
              )}
              {item.disabled && (
                <span style={{fontSize:10, color:'#3a3f50'}}>🔒</span>
              )}
            </button>
          ))}
        </nav>

        {/* Zone badge in sidebar */}
        {currentZoneName && (
          <div style={{
            margin:'0 8px 8px', padding:'8px 12px', borderRadius:8,
            background:'rgba(79,140,255,.08)', border:'1px solid rgba(79,140,255,.2)',
            fontSize:11, color:'#4f8cff'
          }}>
            📍 Zone: <strong>{currentZoneName}</strong>
          </div>
        )}

        <div style={{padding:'8px', borderTop:'1px solid #2a2f3e'}}>
          <div style={{padding:'10px 12px 6px', fontSize:12, color:'#4a5270'}}>
            Signed in as
            <div style={{color:'#8b93a8', fontWeight:500, marginTop:2}}>{user?.full_name}</div>
          </div>
          <button style={S.logoutBtn} onClick={logout}>← Sign out</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={S.main}>
        {/* topbar */}
        <div style={S.topbar}>
          <div>
            <div style={{fontSize:15, fontWeight:600, color:'#e8eaf0'}}>
              {tab==='home'     && 'Driver Dashboard'}
              {tab==='requests' && 'Ride Requests'}
              {tab==='active'   && 'Active Ride'}
              {tab==='history'  && 'Ride History'}
              {tab==='profile'  && 'My Profile'}
            </div>
            <div style={{fontSize:12, color:'#8b93a8'}}>
              {currentZoneName ? `${currentZoneName} · CityFlow Driver` : 'Delhi · CityFlow Driver'}
            </div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            {hasActiveRide && (
              <span style={{fontSize:11, color:'#4f8cff', fontWeight:600,
                background:'rgba(79,140,255,.1)', padding:'4px 10px', borderRadius:20}}>
                🚗 On a ride
              </span>
            )}
            <span style={{fontSize:12, color: available ? '#2dd4a0' : '#8b93a8'}}>
              {available ? '● Online' : '○ Offline'}
            </span>
            <button style={S.toggle(available)} onClick={toggleAvailability}>
              <div style={S.toggleKnob(available)}/>
            </button>
          </div>
        </div>

        {/* Task 2: Persistent verification banner for unverified drivers */}
        {profile && !profile.is_verified && (
          <div style={{
            background:'rgba(245,166,35,.08)', borderBottom:'1px solid rgba(245,166,35,.25)',
            padding:'12px 28px',
            display:'flex', alignItems:'center', gap:12
          }}>
            <span style={{fontSize:18}}>⚠️</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13, fontWeight:600, color:'#f5a623', marginBottom:2}}>
                Account Pending Verification
              </div>
              <div style={{fontSize:12, color:'#8b93a8'}}>
                Your account is pending verification by the admin. You cannot accept rides until approved.
              </div>
            </div>
            <span style={{
              fontSize:10, color:'#f5a623', fontWeight:700, letterSpacing:'.5px',
              background:'rgba(245,166,35,.1)', padding:'4px 10px', borderRadius:20,
              whiteSpace:'nowrap'
            }}>
              PENDING REVIEW
            </span>
          </div>
        )}

        <div style={S.content}>

          {/* ── HOME TAB ── */}
          {tab === 'home' && (
            <>
              <div style={{fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'#e8eaf0', marginBottom:4}}>
                Welcome, {user?.full_name?.split(' ')[0]} 🚗
              </div>
              <div style={{fontSize:13, color:'#8b93a8', marginBottom:28}}>
                {hasActiveRide
                  ? '🚗 You have an active ride in progress'
                  : available
                    ? 'You are online and accepting rides'
                    : 'You are offline — toggle to go online'}
              </div>

              {/* Active ride banner */}
              {hasActiveRide && (
                <div style={{
                  background:'rgba(79,140,255,.08)', border:'1px solid rgba(79,140,255,.3)',
                  borderRadius:12, padding:'16px 20px', marginBottom:20,
                  display:'flex', alignItems:'center', justifyContent:'space-between'
                }}>
                  <div>
                    <div style={{fontSize:13, fontWeight:600, color:'#4f8cff', marginBottom:2}}>Active Ride</div>
                    <div style={{fontSize:12, color:'#8b93a8'}}>
                      {activeRide.pickup_address} → {activeRide.drop_address}
                    </div>
                  </div>
                  <button style={{
                    background:'linear-gradient(135deg,#2dd4a0,#4f8cff)',
                    border:'none', borderRadius:8, padding:'8px 16px',
                    color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer'
                  }} onClick={() => setTab('active')}>
                    View Ride →
                  </button>
                </div>
              )}

              <div style={S.grid4}>
                <div style={{...S.kpi, borderTop:'2px solid #2dd4a0'}}>
                  <div style={S.kpiLabel}>Total Earned</div>
                  <div style={{...S.kpiVal, color:'#2dd4a0'}}>₹{totalEarned.toFixed(0)}</div>
                </div>
                <div style={{...S.kpi, borderTop:'2px solid #4f8cff'}}>
                  <div style={S.kpiLabel}>Total Rides</div>
                  <div style={{...S.kpiVal, color:'#4f8cff'}}>{completedCnt}</div>
                </div>
                <div style={{...S.kpi, borderTop:'2px solid #f5a623'}}>
                  <div style={S.kpiLabel}>Avg Rating</div>
                  <div style={{...S.kpiVal, color:'#f5a623'}}>★ {parseFloat(avgRating).toFixed(2)}</div>
                </div>
                <div style={{...S.kpi, borderTop:'2px solid #7c6aff'}}>
                  <div style={S.kpiLabel}>Status</div>
                  <div style={{...S.kpiVal, fontSize:16, color: available ? '#2dd4a0' : '#8b93a8'}}>
                    {available ? 'Online' : 'Offline'}
                  </div>
                </div>
              </div>

              <div style={S.grid2}>
                {/* Availability + Zone card */}
                <div style={S.card}>
                  <div style={S.cardHead}><span style={S.cardTitle}>Status & Zone</span></div>
                  <div style={S.cardBody}>
                    {/* Availability toggle */}
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'14px 16px', background:'#181c24', borderRadius:10, marginBottom:14
                    }}>
                      <div>
                        <div style={{fontSize:14, fontWeight:500, color:'#e8eaf0'}}>
                          {available ? 'You are Online' : 'You are Offline'}
                        </div>
                        <div style={{fontSize:12, color:'#8b93a8', marginTop:2}}>
                          {available ? 'Accepting new ride requests' : 'Not accepting rides'}
                        </div>
                      </div>
                      <button style={S.toggle(available)} onClick={toggleAvailability}>
                        <div style={S.toggleKnob(available)}/>
                      </button>
                    </div>

                    {/* ── ZONE SELECTOR ── */}
                    <div style={{marginBottom:14}}>
                      <div style={{
                        fontSize:11, color:'#8b93a8', marginBottom:8,
                        textTransform:'uppercase', letterSpacing:'.6px'
                      }}>
                        Operating Zone
                      </div>
                      <div style={{position:'relative'}}>
                        <select
                          style={{
                            ...S.select,
                            borderColor: selectedZone ? 'rgba(45,212,160,.4)' : '#2a2f3e',
                            opacity: zoneLoading ? 0.6 : 1
                          }}
                          value={selectedZone || ''}
                          disabled={zoneLoading}
                          onChange={e => updateZone(e.target.value)}
                        >
                          <option value="" disabled>— Select your zone —</option>
                          {zones.map(z => (
                            <option key={z.zone_id} value={z.zone_id}>
                              {z.zone_name} {z.area_name ? `(${z.area_name})` : ''}
                            </option>
                          ))}
                        </select>
                        {zoneLoading && (
                          <div style={{
                            position:'absolute', right:12, top:'50%', transform:'translateY(-50%)',
                            fontSize:11, color:'#2dd4a0'
                          }}>Saving…</div>
                        )}
                      </div>
                      {selectedZone && (
                        <div style={{
                          marginTop:8, fontSize:11, color:'#2dd4a0',
                          display:'flex', alignItems:'center', gap:6
                        }}>
                          ✓ Showing requests in <strong>{currentZoneName}</strong> only
                        </div>
                      )}
                      {!selectedZone && (
                        <div style={{marginTop:8, fontSize:11, color:'#f5a623'}}>
                          ⚠ Select a zone to receive targeted ride requests
                        </div>
                      )}
                    </div>

                    {hasActiveRide && (
                      <div style={{
                        padding:'10px 14px', borderRadius:8,
                        background:'rgba(240,96,96,.06)', border:'1px solid rgba(240,96,96,.2)',
                        fontSize:12, color:'#f06060'
                      }}>
                        ⚠ Complete your current ride before accepting a new one
                      </div>
                    )}
                  </div>
                </div>

                {/* Today's Summary */}
                <div style={S.card}>
                  <div style={S.cardHead}><span style={S.cardTitle}>Today's Summary</span></div>
                  <div style={S.cardBody}>
                    {[
                      ['Rides Today',  todayRides.length],
                      ['Earned Today', '₹' + todayRides.reduce((s,r) => s+parseFloat(r.total_amount||0), 0).toFixed(0)],
                      ['Total Rides',  completedCnt],
                      ['Total Earned', '₹' + totalEarned.toFixed(0)],
                      ['Avg Rating',   '★ ' + parseFloat(avgRating).toFixed(2)],
                    ].map(([k,v]) => (
                      <div key={k} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'9px 0', borderBottom:'1px solid #1e2330', fontSize:13
                      }}>
                        <span style={{color:'#8b93a8'}}>{k}</span>
                        <span style={{color:'#e8eaf0', fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── REQUESTS TAB ── */}
          {tab === 'requests' && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.cardTitle}>Ride Requests — {currentZoneName || 'Your Zone'}</span>
                <button onClick={handleRefresh} disabled={requestsLoading} style={{
                  fontSize:12, color: requestsLoading ? '#4a5270' : '#2dd4a0',
                  background:'none', border:'none',
                  cursor: requestsLoading ? 'not-allowed' : 'pointer',
                  opacity: requestsLoading ? 0.6 : 1
                }}>{requestsLoading ? '↻ Refreshing…' : '↻ Refresh'}</button>
              </div>
              <div style={S.cardBody}>
                {/* Zone notice */}
                <div style={{
                  background:'rgba(45,212,160,.05)', border:'1px solid rgba(45,212,160,.15)',
                  borderRadius:10, padding:'10px 14px', marginBottom:16,
                  fontSize:12, color:'#8b93a8',
                  display:'flex', alignItems:'center', justifyContent:'space-between'
                }}>
                  <span>
                    📍 Showing requests from riders in <strong style={{color:'#2dd4a0'}}>
                      {currentZoneName || 'your zone'}
                    </strong>. First driver to accept wins.
                  </span>
                  {!selectedZone && (
                    <button
                      onClick={() => setTab('home')}
                      style={{
                        fontSize:11, color:'#f5a623', background:'rgba(245,166,35,.08)',
                        border:'1px solid rgba(245,166,35,.3)', borderRadius:6,
                        padding:'4px 10px', cursor:'pointer', flexShrink:0, marginLeft:12
                      }}
                    >
                      Set zone →
                    </button>
                  )}
                </div>

                {requests.length === 0 ? (
                  <div style={{textAlign:'center', padding:32, color:'#8b93a8'}}>
                    <div style={{fontSize:32, marginBottom:12}}>📭</div>
                    No ride requests in your zone right now.
                    <div style={{fontSize:11, marginTop:8, color:'#4a5270'}}>Polling every 5 seconds…</div>
                  </div>
                ) : requests.map(r => (
                  <div key={r.request_id} style={{
                    background:'#181c24', borderRadius:10, padding:'16px',
                    marginBottom:12, border:'1px solid #2a2f3e',
                    opacity: accepting && accepting !== r.request_id ? 0.5 : 1,
                    transition:'opacity .2s'
                  }}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
                      <span style={{fontSize:13, fontWeight:600, color:'#e8eaf0'}}>{r.rider_name}</span>
                      <span style={{fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:'#2dd4a0'}}>
                        ₹{parseFloat(r.estimated_fare).toFixed(0)}
                      </span>
                    </div>
                    <div style={{fontSize:12, color:'#8b93a8', marginBottom:4}}>
                      📍 {r.pickup_address}
                    </div>
                    <div style={{fontSize:12, color:'#8b93a8', marginBottom:12}}>
                      🏁 {r.drop_address}
                    </div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                      <span style={{fontSize:11, color:'#4a5270'}}>
                        {r.estimated_km} km · {r.zone_name}
                        {parseFloat(r.surge_multiplier) > 1 &&
                          <span style={{color:'#f06060'}}> · ⚡{r.surge_multiplier}×</span>}
                      </span>
                      <button
                        disabled={!!accepting}
                        style={{
                          background: accepting === r.request_id
                            ? '#2a2f3e'
                            : 'linear-gradient(135deg,#2dd4a0,#4f8cff)',
                          border:'none', borderRadius:8, padding:'8px 16px',
                          color:'#fff', fontSize:13, fontWeight:600,
                          cursor: accepting ? 'not-allowed' : 'pointer'
                        }}
                        onClick={() => acceptRequest(r.request_id)}
                      >
                        {accepting === r.request_id ? 'Accepting…' : 'Accept →'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── ACTIVE RIDE TAB ── */}
          {tab === 'active' && (
            <div style={{maxWidth:500}}>
              {activeRide ? (
                <div style={S.card}>
                  <div style={S.cardHead}>
                    <span style={S.cardTitle}>Current Ride</span>
                    <span style={S.pill(activeRide.status)}>{activeRide.status?.replace('_',' ')}</span>
                  </div>
                  <div style={S.cardBody}>

                    {/* OTP display */}
                    <div style={{
                      background:'rgba(45,212,160,.06)', border:'1px solid rgba(45,212,160,.2)',
                      borderRadius:12, padding:'16px', marginBottom:20, textAlign:'center'
                    }}>
                      <div style={{fontSize:11, color:'#8b93a8', marginBottom:6, textTransform:'uppercase', letterSpacing:1}}>
                        Rider OTP — verify before starting
                      </div>
                      <div style={{
                        fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:800,
                        color:'#2dd4a0', letterSpacing:10
                      }}>
                        {activeRide.otp || '••••'}
                      </div>
                    </div>

                    {/* Ride details */}
                    {[
                      ['Rider',    activeRide.rider_name],
                      ['Pickup',   activeRide.pickup_address],
                      ['Drop',     activeRide.drop_address],
                      ['Distance', `${activeRide.estimated_km} km`],
                      ['Fare',     `₹${parseFloat(activeRide.total_amount || activeRide.estimated_fare || 0).toFixed(0)}`],
                    ].map(([k,v]) => (
                      <div key={k} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'9px 0', borderBottom:'1px solid #1e2330', fontSize:13
                      }}>
                        <span style={{color:'#8b93a8'}}>{k}</span>
                        <span style={{color:'#e8eaf0', fontWeight:500}}>{v}</span>
                      </div>
                    ))}

                    {/* OTP input to start ride */}
                    {activeRide.status === 'accepted' && (
                      <div style={{marginTop:20}}>
                        <div style={{fontSize:12, color:'#8b93a8', marginBottom:8}}>
                          Enter the 4-digit OTP the rider shares with you
                        </div>
                        <input
                          style={{...S.input, marginBottom:12, letterSpacing:8, fontSize:20, textAlign:'center'}}
                          placeholder="_ _ _ _" maxLength={4}
                          value={otp} onChange={e => setOtp(e.target.value)}
                        />
                        <button
                          style={{...S.btn, opacity:loading?0.7:1}}
                          onClick={() => startRide(activeRide.ride_id)}
                          disabled={loading}
                        >
                          {loading ? 'Starting...' : '▶ Start Ride'}
                        </button>
                      </div>
                    )}

                    {activeRide.status === 'in_progress' && (
                      <div style={{marginTop:20}}>
                        <button
                          style={{...S.btn, opacity:loading?0.7:1}}
                          onClick={() => completeRide(activeRide.ride_id)}
                          disabled={loading}
                        >
                          {loading ? 'Completing...' : '✓ Complete Ride'}
                        </button>
                      </div>
                    )}

                    {activeRide.status === 'completed' && !paymentConfirmed && (
                      <div style={{marginTop:20}}>
                        <div style={{
                          background:'rgba(245,166,35,.06)', border:'1px solid rgba(245,166,35,.25)',
                          borderRadius:12, padding:'16px', marginBottom:14, textAlign:'center'
                        }}>
                          <div style={{fontSize:11, color:'#f5a623', marginBottom:6, textTransform:'uppercase', letterSpacing:1, fontWeight:600}}>
                            Payment Confirmation Required
                          </div>
                          <div style={{fontSize:13, color:'#8b93a8'}}>
                            Has the rider paid for this ride?
                          </div>
                        </div>
                        <button
                          style={{...S.btn, background:'linear-gradient(135deg,#2dd4a0,#4f8cff)', opacity:loading?0.7:1}}
                          onClick={() => confirmPayment(activeRide.ride_id)}
                          disabled={loading}
                        >
                          {loading ? 'Confirming...' : '✔ Confirm Payment Received'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{...S.card, padding:48, textAlign:'center'}}>
                  <div style={{fontSize:40, marginBottom:16}}>🚗</div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:600, color:'#e8eaf0', marginBottom:8}}>
                    No active ride
                  </div>
                  <div style={{fontSize:13, color:'#8b93a8', marginBottom:20}}>
                    {available ? 'Waiting for ride requests…' : 'Go online to receive rides'}
                  </div>
                  <button style={{
                    background:'linear-gradient(135deg,#2dd4a0,#4f8cff)',
                    border:'none', borderRadius:10, padding:'10px 20px',
                    color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer'
                  }} onClick={() => setTab('requests')}>
                    View Requests
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.cardTitle}>Ride History</span>
                <span style={{fontSize:12, color:'#8b93a8'}}>{history.length} rides</span>
              </div>
              <div style={S.cardBody}>
                {history.length === 0 ? (
                  <div style={{textAlign:'center', padding:32, color:'#8b93a8'}}>No rides yet</div>
                ) : history.map(r => (
                  <div key={r.ride_id} style={S.rideRow}>
                    <div style={{
                      width:36, height:36, borderRadius:10, flexShrink:0,
                      background:'rgba(45,212,160,.1)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
                    }}>🚗</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:500, color:'#e8eaf0', marginBottom:2}}>
                        {r.pickup_address} → {r.drop_address}
                      </div>
                      <div style={{fontSize:11, color:'#8b93a8'}}>
                        Rider: {r.rider_name} · {r.estimated_km} km
                      </div>
                      <div style={{fontSize:11, color:'#4a5270', marginTop:2}}>
                        {r.start_time ? new Date(r.start_time).toLocaleDateString('en-IN', {
                          day:'numeric', month:'short', year:'numeric',
                          hour:'2-digit', minute:'2-digit'
                        }) : '—'}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:'#2dd4a0', marginBottom:4}}>
                        {r.total_amount ? `₹${parseFloat(r.total_amount).toFixed(0)}` : '—'}
                      </div>
                      <span style={S.pill(r.status)}>{r.status?.replace('_',' ')}</span>
                      {r.rider_rating && (
                        <div style={{fontSize:11, color:'#f5a623', marginTop:4}}>★ {r.rider_rating}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PROFILE TAB ── */}
          {tab === 'profile' && profile && (
            <div style={{maxWidth:480}}>
              <div style={S.card}>
                <div style={S.cardHead}>
                  <span style={S.cardTitle}>Driver Profile</span>
                  {profile.is_verified
                    ? <span style={{fontSize:11, color:'#2dd4a0', fontWeight:600}}>✓ Verified</span>
                    : <span style={{fontSize:11, color:'#f5a623', fontWeight:600}}>⏳ Pending Verification</span>
                  }
                </div>
                <div style={S.cardBody}>
                  <div style={{
                    width:64, height:64, borderRadius:16, marginBottom:16,
                    background:'linear-gradient(135deg,#2dd4a0,#4f8cff)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'white'
                  }}>
                    {profile.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:'#e8eaf0', marginBottom:4}}>
                    {profile.full_name}
                  </div>
                  <div style={{fontSize:13, color:'#8b93a8', marginBottom:20}}>Driver · {currentZoneName || 'Delhi NCR'}</div>
                  {[
                    ['Email',        profile.email],
                    ['Phone',        profile.phone],
                    ['Avg Rating',   `★ ${parseFloat(profile.avg_rating||0).toFixed(2)}`],
                    ['Total Rides',  profile.total_rides || 0],
                    ['Total Earned', `₹${parseFloat(profile.total_earned||0).toFixed(0)}`],
                    ['Operating Zone', currentZoneName || '—'],
                    ['Member Since', new Date(profile.created_at).toLocaleDateString('en-IN',{month:'long',year:'numeric'})],
                  ].map(([k,v]) => (
                    <div key={k} style={{
                      display:'flex', justifyContent:'space-between',
                      padding:'10px 0', borderBottom:'1px solid #1e2330', fontSize:13
                    }}>
                      <span style={{color:'#8b93a8'}}>{k}</span>
                      <span style={{color:'#e8eaf0', fontWeight:500}}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}