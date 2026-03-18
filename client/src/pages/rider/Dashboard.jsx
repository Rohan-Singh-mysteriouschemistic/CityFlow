import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../api/axios'
import toast from 'react-hot-toast'

const S = {
  shell: { display:'flex', minHeight:'100vh', background:'#0a0a0a' },
  sidebar: {
    width:220, background:'#111318', borderRight:'1px solid #2a2f3e',
    display:'flex', flexDirection:'column', padding:'0'
  },
  logo: {
    padding:'22px 20px', display:'flex', alignItems:'center', gap:10,
    borderBottom:'1px solid #2a2f3e'
  },
  logoIcon: {
    width:32, height:32, borderRadius:8,
    background:'linear-gradient(135deg,#4f8cff,#7c6aff)',
    display:'flex', alignItems:'center', justifyContent:'center'
  },
  logoName: { fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:'#e8eaf0' },
  nav: { padding:'12px 8px', flex:1 },
  navItem: (active) => ({
    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
    borderRadius:8, cursor:'pointer', fontSize:13, marginBottom:2,
    background: active ? 'rgba(79,140,255,.12)' : 'transparent',
    color: active ? '#4f8cff' : '#8b93a8', fontWeight: active ? 500 : 400,
    border:'none', width:'100%', textAlign:'left', transition:'.15s'
  }),
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'auto' },
  topbar: {
    padding:'18px 28px', borderBottom:'1px solid #2a2f3e',
    background:'#111318', display:'flex', alignItems:'center', justifyContent:'space-between'
  },
  content: { padding:'28px', flex:1 },
  greeting: { fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'#e8eaf0', marginBottom:4 },
  sub: { fontSize:13, color:'#8b93a8', marginBottom:28 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 },
  grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 },
  kpi: {
    background:'#111318', border:'1px solid #2a2f3e', borderRadius:12,
    padding:'18px 20px', cursor:'pointer'
  },
  kpiLabel: { fontSize:11, color:'#8b93a8', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8 },
  // FIX 1: was `"'Syne',sans-serif', fontSize:26` — mismatched quotes broke the entire object literal
  kpiVal: { fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:700, lineHeight:1 },
  card: {
    background:'#111318', border:'1px solid #2a2f3e',
    borderRadius:14, overflow:'hidden'
  },
  cardHead: {
    padding:'16px 20px', borderBottom:'1px solid #2a2f3e',
    display:'flex', alignItems:'center', justifyContent:'space-between'
  },
  cardTitle: { fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:600, color:'#e8eaf0' },
  cardBody: { padding:'20px' },
  btn: {
    background:'linear-gradient(135deg,#4f8cff,#7c6aff)',
    border:'none', borderRadius:10, padding:'12px 20px',
    color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', width:'100%'
  },
  // FIX 2: added boxSizing:'border-box' so padding doesn't cause overflow
  input: {
    background:'#181c24', border:'1px solid #2a2f3e', borderRadius:10,
    padding:'11px 14px', color:'#e8eaf0', fontSize:14, outline:'none',
    width:'100%', boxSizing:'border-box'
  },
  select: {
    background:'#181c24', border:'1px solid #2a2f3e', borderRadius:10,
    padding:'11px 14px', color:'#e8eaf0', fontSize:14, outline:'none',
    width:'100%', boxSizing:'border-box'
  },
  label: { fontSize:12, color:'#8b93a8', marginBottom:6, display:'block' },
  field: { marginBottom:14 },
  pill: (c) => ({
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600,
    background: c==='completed'?'rgba(45,212,160,.12)':c==='in_progress'?'rgba(79,140,255,.12)':'rgba(240,96,96,.12)',
    color: c==='completed'?'#2dd4a0':c==='in_progress'?'#4f8cff':'#f06060'
  }),
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

export default function RiderDashboard() {
  const { user, logout } = useAuth()
  const [tab,        setTab]        = useState('home')
  const [zones,      setZones]      = useState([])
  const [history,    setHistory]    = useState([])
  const [profile,    setProfile]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [form, setForm] = useState({
    pickup_address:'', pickup_lat:28.6139, pickup_lng:77.2090,
    drop_address:'',   drop_lat:28.5355,   drop_lng:77.3910,
    zone_id:'1', vehicle_type:'sedan', estimated_km:''
  })
  const [activeRide,     setActiveRide]     = useState(null)
  const [pendingRequest, setPendingRequest] = useState(null)
  const [showConfirm,    setShowConfirm]    = useState(false)

  // ── initial load ──────────────────────────────────────────
  useEffect(() => {
    api.get('/rides/zones').then(r => setZones(r.data.zones))
    api.get('/auth/me').then(r => setProfile(r.data.user))
    loadHistory()
    checkActiveRide()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── poll active ride every 5 s ────────────────────────────
  useEffect(() => {
    const interval = setInterval(checkActiveRide, 5000)
    return () => clearInterval(interval)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 3: added `tab` to dep array — without it the effect captured a stale
  // closure over `tab` and never auto-switched away from non-home tabs.
  useEffect(() => {
    if (activeRide && ['accepted','in_progress'].includes(activeRide.status)) {
      if (tab === 'home') setTab('active')
    }
  }, [activeRide?.status, tab])

  const checkActiveRide = async () => {
    try {
      const r = await api.get('/rides/active/rider')
      if (r.data.ride) {
        setActiveRide(r.data.ride)
        setPendingRequest(null)
      } else if (r.data.pending_request) {
        setPendingRequest(r.data.pending_request)
        setActiveRide(null)
      } else {
        // FIX 4: moved history reload into a functional-update pattern so it
        // doesn't depend on stale `activeRide` / `pendingRequest` closure values.
        // Previously, the condition `if (activeRide || pendingRequest)` always
        // read the stale state captured when the interval was created (always
        // null/null), so history was never refreshed after a ride ended.
        setActiveRide(prev => {
          if (prev !== null) loadHistory()
          return null
        })
        setPendingRequest(prev => {
          if (prev !== null) loadHistory()
          return null
        })
      }
    } catch {}
  }

  const loadHistory = async () => {
    try {
      const r = await api.get('/rides/history/rider')
      setHistory(r.data.rides)
    } catch {}
  }

  const requestRide = async (e) => {
    e.preventDefault()
    if (!form.pickup_address || !form.drop_address || !form.estimated_km) {
      return toast.error('Please fill all fields')
    }
    setLoading(true)
    try {
      const { data } = await api.post('/rides/request', form)
      toast.success(data.message)
      toast(`Estimated fare: ₹${data.estimated_fare}`, { icon: '💰' })
      await checkActiveRide()
      setTab('active')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request ride')
    } finally {
      setLoading(false)
    }
  }

  const cancelRide = async () => {
    if (!activeRide?.ride_id) return
    setCancelLoading(true)
    try {
      await api.patch(`/rides/${activeRide.ride_id}/cancel`, { reason: 'Cancelled by rider' })
      toast.success('Ride cancelled')
      setActiveRide(null)
      setShowConfirm(false)
      setTab('home')
      loadHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed')
    } finally {
      setCancelLoading(false)
    }
  }

  const completedCnt = history.filter(r => r.status === 'completed').length
  const hasActiveRide = !!activeRide || !!pendingRequest

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
          {[
            { id:'home',    label:'Book a Ride', icon:'🚖' },
            { id:'active',  label:'Active Ride', icon:'📍', badge: hasActiveRide },
            { id:'history', label:'My Rides',    icon:'🕒' },
            { id:'profile', label:'Profile',     icon:'👤' },
          ].map(item => (
            <button key={item.id} style={S.navItem(tab===item.id)} onClick={() => setTab(item.id)}>
              <span style={{fontSize:15}}>{item.icon}</span>
              <span style={{flex:1}}>{item.label}</span>
              {item.badge && (
                <span style={{
                  width:8, height:8, borderRadius:'50%',
                  background:'#2dd4a0', boxShadow:'0 0 6px #2dd4a0',
                  flexShrink:0
                }}/>
              )}
            </button>
          ))}
        </nav>
        <div style={{padding:'8px', borderTop:'1px solid #2a2f3e'}}>
          <div style={{padding:'10px 12px', fontSize:12, color:'#4a5270'}}>
            Signed in as
            <div style={{color:'#8b93a8', fontWeight:500, marginTop:2}}>{user?.full_name}</div>
          </div>
          <button style={S.logoutBtn} onClick={logout}>← Sign out</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div>
            <div style={{fontSize:15, fontWeight:600, color:'#e8eaf0'}}>
              {tab==='home'    && 'Book a Ride'}
              {tab==='active'  && 'Active Ride'}
              {tab==='history' && 'My Rides'}
              {tab==='profile' && 'My Profile'}
            </div>
            <div style={{fontSize:12, color:'#8b93a8'}}>Delhi · CityFlow</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            {hasActiveRide ? (
              <>
                <div style={{
                  width:8, height:8, borderRadius:'50%', background:'#4f8cff',
                  boxShadow:'0 0 6px #4f8cff', animation:'pulse 1.5s infinite'
                }}/>
                <span style={{fontSize:12, color:'#4f8cff'}}>Ride Active</span>
              </>
            ) : (
              <>
                <div style={{
                  width:8, height:8, borderRadius:'50%', background:'#2dd4a0',
                  boxShadow:'0 0 6px #2dd4a0'
                }}/>
                <span style={{fontSize:12, color:'#2dd4a0'}}>Live</span>
              </>
            )}
          </div>
        </div>

        <div style={S.content}>

          {/* ── HOME / BOOK TAB ── */}
          {tab === 'home' && (
            <>
              <div style={S.greeting}>Hello, {user?.full_name?.split(' ')[0]} 👋</div>
              <div style={S.sub}>Where are you going today?</div>

              {hasActiveRide && (
                <div style={{
                  background:'rgba(79,140,255,.08)', border:'1px solid rgba(79,140,255,.3)',
                  borderRadius:12, padding:'16px 20px', marginBottom:24,
                  display:'flex', alignItems:'center', justifyContent:'space-between'
                }}>
                  <div>
                    <div style={{fontSize:13, fontWeight:600, color:'#4f8cff', marginBottom:4}}>
                      You have an active ride
                    </div>
                    <div style={{fontSize:12, color:'#8b93a8'}}>
                      {activeRide ? `${activeRide.pickup_address} → ${activeRide.drop_address}` : 'Waiting for a driver...'}
                    </div>
                    {activeRide && (
                      <div style={{fontSize:20, fontWeight:800, color:'#4f8cff',
                        letterSpacing:6, marginTop:6, fontFamily:"'Syne',sans-serif"}}>
                        OTP: {activeRide.otp}
                      </div>
                    )}
                  </div>
                  <button style={{
                    background:'linear-gradient(135deg,#4f8cff,#7c6aff)',
                    border:'none', borderRadius:8, padding:'8px 16px',
                    color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', flexShrink:0
                  }} onClick={() => setTab('active')}>
                    Track Ride →
                  </button>
                </div>
              )}

              <div style={S.grid2}>
                <div style={{...S.kpi, borderTop:'2px solid #4f8cff'}}>
                  <div style={S.kpiLabel}>Total Rides</div>
                  <div style={{...S.kpiVal, color:'#4f8cff'}}>{completedCnt}</div>
                </div>
                <div style={{...S.kpi, borderTop:'2px solid #7c6aff'}}>
                  <div style={S.kpiLabel}>Member Since</div>
                  <div style={{...S.kpiVal, color:'#7c6aff', fontSize:16}}>
                    {profile ? new Date(profile.created_at).toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—'}
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <div style={S.cardHead}>
                  <span style={S.cardTitle}>Book Your Ride</span>
                  <span style={{fontSize:11, color:'#8b93a8'}}>Delhi NCR</span>
                </div>
                <div style={S.cardBody}>
                  {hasActiveRide ? (
                    <div style={{textAlign:'center', padding:'24px 0', color:'#8b93a8', fontSize:13}}>
                      <div style={{fontSize:28, marginBottom:12}}>🚖</div>
                      You already have an active ride.
                      <br/>
                      <button style={{...S.btn, marginTop:16, maxWidth:200}} onClick={() => setTab('active')}>
                        View Active Ride
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={requestRide}>
                      <div style={S.field}>
                        <label style={S.label}>Pickup Location</label>
                        <input style={S.input} placeholder="e.g. Connaught Place"
                          value={form.pickup_address}
                          onChange={e => setForm(f=>({...f, pickup_address:e.target.value}))} />
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>Drop Location</label>
                        <input style={S.input} placeholder="e.g. Cyber City, Gurugram"
                          value={form.drop_address}
                          onChange={e => setForm(f=>({...f, drop_address:e.target.value}))} />
                      </div>
                      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                        <div style={S.field}>
                          <label style={S.label}>Zone</label>
                          <select style={S.select} value={form.zone_id}
                            onChange={e => setForm(f=>({...f, zone_id:e.target.value}))}>
                            {zones.map(z => (
                              <option key={z.zone_id} value={z.zone_id}>{z.zone_name}</option>
                            ))}
                          </select>
                        </div>
                        <div style={S.field}>
                          <label style={S.label}>Vehicle Type</label>
                          <select style={S.select} value={form.vehicle_type}
                            onChange={e => setForm(f=>({...f, vehicle_type:e.target.value}))}>
                            {['auto','sedan','suv','xl','bike'].map(t => (
                              <option key={t} value={t}>{t.toUpperCase()}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div style={S.field}>
                        <label style={S.label}>Estimated Distance (km)</label>
                        <input style={S.input} type="number" placeholder="e.g. 12.5"
                          value={form.estimated_km}
                          onChange={e => setForm(f=>({...f, estimated_km:e.target.value}))} />
                      </div>
                      <button style={{...S.btn, opacity:loading?0.7:1}} type="submit" disabled={loading}>
                        {loading ? 'Finding driver...' : '🚖 Request Ride'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── ACTIVE RIDE TAB ── */}
          {tab === 'active' && (
            <div style={{maxWidth:500}}>
              {activeRide ? (
                <div style={S.card}>
                  <div style={S.cardHead}>
                    <span style={S.cardTitle}>Your Ride</span>
                    <span style={S.pill(activeRide.status)}>
                      {activeRide.status === 'accepted'    && '⏳ Driver on way'}
                      {activeRide.status === 'otp_pending' && '🔐 Share OTP'}
                      {activeRide.status === 'in_progress' && '🚖 In Progress'}
                    </span>
                  </div>
                  <div style={S.cardBody}>

                    <div style={{
                      background:'rgba(79,140,255,.08)',
                      border:'2px solid rgba(79,140,255,.35)',
                      borderRadius:12, padding:'20px',
                      marginBottom:20, textAlign:'center'
                    }}>
                      <div style={{
                        fontSize:11, color:'#8b93a8', marginBottom:6,
                        textTransform:'uppercase', letterSpacing:1
                      }}>
                        Your OTP — share with driver
                      </div>
                      <div style={{
                        fontFamily:"'Syne',sans-serif", fontSize:48, fontWeight:900,
                        color:'#4f8cff', letterSpacing:12, lineHeight:1
                      }}>
                        {activeRide.otp || '••••'}
                      </div>
                      <div style={{fontSize:11, color:'#4a5270', marginTop:8}}>
                        This OTP verifies your identity to the driver
                      </div>
                    </div>

                    {/* Status timeline */}
                    <div style={{
                      display:'flex', alignItems:'center', gap:8,
                      marginBottom:20, padding:'12px 16px',
                      background:'#181c24', borderRadius:10
                    }}>
                      {[
                        { s:'accepted',    label:'Assigned'    },
                        { s:'in_progress', label:'In Progress' },
                        { s:'completed',   label:'Completed'   },
                      ].map((step, i, arr) => {
                        const isActive = activeRide.status === step.s
                        const isPast = (
                          (step.s === 'accepted'    && ['in_progress','completed'].includes(activeRide.status)) ||
                          (step.s === 'in_progress' && activeRide.status === 'completed')
                        )
                        return (
                          <div key={step.s} style={{display:'flex', alignItems:'center', flex: i < arr.length-1 ? 1 : 0}}>
                            <div style={{
                              width:28, height:28, borderRadius:'50%', flexShrink:0,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:11, fontWeight:600,
                              background: isActive ? '#4f8cff' : isPast ? 'rgba(79,140,255,.3)' : '#2a2f3e',
                              color: isActive || isPast ? '#fff' : '#4a5270',
                              border: isActive ? '2px solid #4f8cff' : 'none'
                            }}>{i+1}</div>
                            <div style={{fontSize:10, color: isActive ? '#4f8cff' : '#8b93a8', marginLeft:4, whiteSpace:'nowrap'}}>
                              {step.label}
                            </div>
                            {i < arr.length-1 && (
                              <div style={{flex:1, height:1, background:'#2a2f3e', margin:'0 8px'}}/>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Fare */}
                    <div style={{
                      display:'flex', justifyContent:'space-between',
                      background:'#181c24', borderRadius:10, padding:'14px 16px', marginBottom:16
                    }}>
                      <div>
                        <div style={{fontSize:11, color:'#8b93a8'}}>Estimated Fare</div>
                        <div style={{fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:'#2dd4a0'}}>
                          ₹{parseFloat(activeRide.estimated_fare || 0).toFixed(0)}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:11, color:'#8b93a8'}}>{activeRide.zone_name}</div>
                        {parseFloat(activeRide.surge_multiplier) > 1 && (
                          <div style={{fontSize:11, color:'#f06060', fontWeight:600}}>
                            ⚡ {activeRide.surge_multiplier}× surge
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Driver info */}
                    <div style={{marginBottom:20}}>
                      <div style={{fontSize:12, color:'#8b93a8', marginBottom:8}}>Driver Details</div>
                      {[
                        ['Name',    activeRide.driver_name],
                        ['Phone',   activeRide.driver_phone],
                        ['Vehicle', activeRide.make && `${activeRide.make} ${activeRide.model} · ${activeRide.color}`],
                        ['Plate',   activeRide.registration_no],
                        ['Rating',  activeRide.driver_avg_rating && `★ ${parseFloat(activeRide.driver_avg_rating).toFixed(2)}`],
                      ].filter(([,v]) => v).map(([k,v]) => (
                        <div key={k} style={{
                          display:'flex', justifyContent:'space-between',
                          padding:'7px 0', borderBottom:'1px solid #1e2330', fontSize:13
                        }}>
                          <span style={{color:'#8b93a8'}}>{k}</span>
                          <span style={{color:'#e8eaf0', fontWeight:500}}>{v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Cancel */}
                    {activeRide.status === 'accepted' && (
                      <>
                        {!showConfirm ? (
                          <button
                            onClick={() => setShowConfirm(true)}
                            style={{
                              width:'100%', padding:'12px', borderRadius:10,
                              border:'1px solid rgba(240,96,96,.4)',
                              background:'rgba(240,96,96,.06)',
                              color:'#f06060', fontSize:14, fontWeight:600, cursor:'pointer'
                            }}
                          >
                            Cancel Ride
                          </button>
                        ) : (
                          <div style={{
                            background:'rgba(240,96,96,.08)',
                            border:'1px solid rgba(240,96,96,.3)',
                            borderRadius:10, padding:'16px'
                          }}>
                            <div style={{fontSize:13, color:'#e8eaf0', fontWeight:500, marginBottom:4}}>
                              Cancel this ride?
                            </div>
                            <div style={{fontSize:12, color:'#8b93a8', marginBottom:14}}>
                              A penalty may apply. This cannot be undone.
                            </div>
                            <div style={{display:'flex', gap:10}}>
                              <button
                                onClick={() => setShowConfirm(false)}
                                style={{
                                  flex:1, padding:'10px', borderRadius:8,
                                  border:'1px solid #2a2f3e', background:'transparent',
                                  color:'#8b93a8', fontSize:13, cursor:'pointer'
                                }}
                              >
                                Keep Ride
                              </button>
                              <button
                                onClick={cancelRide}
                                disabled={cancelLoading}
                                style={{
                                  flex:1, padding:'10px', borderRadius:8,
                                  border:'none', background:'#f06060',
                                  color:'#fff', fontSize:13, fontWeight:600,
                                  cursor: cancelLoading ? 'not-allowed' : 'pointer',
                                  opacity: cancelLoading ? 0.7 : 1
                                }}
                              >
                                {cancelLoading ? 'Cancelling…' : 'Yes, Cancel'}
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {activeRide.status === 'in_progress' && (
                      <div style={{
                        padding:'12px 16px', borderRadius:10,
                        background:'rgba(79,140,255,.06)', border:'1px solid rgba(79,140,255,.2)',
                        fontSize:12, color:'#8b93a8', textAlign:'center'
                      }}>
                        🚖 Ride in progress — cancellation not available
                      </div>
                    )}
                  </div>
                </div>
              ) : pendingRequest ? (
                <div style={{...S.card, padding:48, textAlign:'center'}}>
                  <div style={{fontSize:40, marginBottom:16}}>⏳</div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:600, color:'#e8eaf0', marginBottom:8}}>
                    Waiting for a driver...
                  </div>
                  <div style={{fontSize:13, color:'#8b93a8', marginBottom:20}}>
                    Your request is being processed. We are looking for a driver for you.
                  </div>
                </div>
              ) : (
                <div style={{...S.card, padding:48, textAlign:'center'}}>
                  <div style={{fontSize:40, marginBottom:16}}>🤔</div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:600, color:'#e8eaf0', marginBottom:8}}>
                    No active ride
                  </div>
                  <div style={{fontSize:13, color:'#8b93a8', marginBottom:20}}>
                    Book a ride to get started.
                  </div>
                  <button style={{...S.btn, maxWidth:200, margin:'0 auto'}}
                    onClick={() => setTab('home')}>
                    Book a Ride
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── HISTORY TAB ── */}
          {tab === 'history' && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.cardTitle}>My Rides</span>
                <span style={{fontSize:12, color:'#8b93a8'}}>{history.length} rides</span>
              </div>
              <div style={S.cardBody}>
                {history.length === 0 ? (
                  <div style={{textAlign:'center', padding:32, color:'#8b93a8'}}>No rides yet</div>
                ) : history.map(r => (
                  <div key={r.ride_id} style={S.rideRow}>
                    <div style={{
                      width:36, height:36, borderRadius:10, flexShrink:0,
                      background:'rgba(79,140,255,.1)',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:16
                    }}>🚖</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13, fontWeight:500, color:'#e8eaf0', marginBottom:2}}>
                        {r.pickup_address} → {r.drop_address}
                      </div>
                      <div style={{fontSize:11, color:'#8b93a8'}}>
                        {r.driver_name} · {r.vehicle_type?.toUpperCase()} · {r.make} {r.model}
                      </div>
                      <div style={{fontSize:11, color:'#4a5270', marginTop:2}}>
                        {r.start_time ? new Date(r.start_time).toLocaleDateString('en-IN', {
                          day:'numeric', month:'short', year:'numeric',
                          hour:'2-digit', minute:'2-digit'
                        }) : '—'}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:'#e8eaf0', marginBottom:4}}>
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
                  <span style={S.cardTitle}>My Profile</span>
                </div>
                <div style={S.cardBody}>
                  <div style={{
                    width:64, height:64, borderRadius:16, marginBottom:16,
                    background:'linear-gradient(135deg,#4f8cff,#7c6aff)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'white'
                  }}>
                    {profile.full_name?.split(' ').map(n=>n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:'#e8eaf0', marginBottom:4}}>
                    {profile.full_name}
                  </div>
                  <div style={{fontSize:13, color:'#8b93a8', marginBottom:20}}>Rider · Delhi NCR</div>
                  {[
                    ['Email',        profile.email],
                    ['Phone',        profile.phone],
                    ['Total Rides',  profile.total_rides || 0],
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
