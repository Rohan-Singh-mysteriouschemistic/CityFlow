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
  input: {
    background:'#181c24', border:'1px solid #2a2f3e', borderRadius:10,
    padding:'11px 14px', color:'#e8eaf0', fontSize:14, outline:'none', width:'100%'
  },
  select: {
    background:'#181c24', border:'1px solid #2a2f3e', borderRadius:10,
    padding:'11px 14px', color:'#e8eaf0', fontSize:14, outline:'none', width:'100%'
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
  const [tab,     setTab]     = useState('home')
  const [zones,   setZones]   = useState([])
  const [history, setHistory] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    pickup_address:'', pickup_lat:28.6139, pickup_lng:77.2090,
    drop_address:'',   drop_lat:28.5355,   drop_lng:77.3910,
    zone_id:'1', vehicle_type:'sedan', estimated_km:''
  })
  const [activeRide, setActiveRide] = useState(null)

  useEffect(() => {
    api.get('/rides/zones').then(r => setZones(r.data.zones))
    api.get('/auth/me').then(r => setProfile(r.data.user))
    loadHistory()
  }, [])

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
      if (data.driver_found === false) {
        toast('No drivers available right now. Try again shortly.', { icon: '⏳' })
      } else {
        setActiveRide(data)
        toast.success(`Driver found! OTP: ${data.otp}`)
        setTab('active')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request ride')
    } finally {
      setLoading(false)
    }
  }

  const cancelRide = async () => {
    if (!activeRide?.ride_id) return
    try {
      await api.patch(`/rides/${activeRide.ride_id}/cancel`, { reason: 'Cancelled by rider' })
      toast.success('Ride cancelled')
      setActiveRide(null)
      setTab('home')
      loadHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed')
    }
  }

  const totalSpent   = history.reduce((s,r) => s + parseFloat(r.total_amount||0), 0)
  const completedCnt = history.filter(r => r.status === 'completed').length

  return (
    <div style={S.shell}>
      {/* SIDEBAR */}
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
            { id:'home',    label:'Book a Ride',   icon:'🚖' },
            { id:'active',  label:'Active Ride',   icon:'📍' },
            { id:'history', label:'My Rides',      icon:'🕒' },
            { id:'profile', label:'Profile',       icon:'👤' },
          ].map(item => (
            <button key={item.id} style={S.navItem(tab===item.id)} onClick={() => setTab(item.id)}>
              <span style={{fontSize:15}}>{item.icon}</span> {item.label}
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

      {/* MAIN */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div>
            <div style={{fontSize:15, fontWeight:600, color:'#e8eaf0'}}>
              {tab === 'home'    && 'Book a Ride'}
              {tab === 'active'  && 'Active Ride'}
              {tab === 'history' && 'My Rides'}
              {tab === 'profile' && 'My Profile'}
            </div>
            <div style={{fontSize:12, color:'#8b93a8'}}>Delhi · CityFlow</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{
              width:8, height:8, borderRadius:'50%', background:'#2dd4a0',
              boxShadow:'0 0 6px #2dd4a0'
            }}/>
            <span style={{fontSize:12, color:'#2dd4a0'}}>Live</span>
          </div>
        </div>

        <div style={S.content}>

          {/* ── HOME TAB ── */}
          {tab === 'home' && (
            <>
              <div style={S.greeting}>Hello, {user?.full_name?.split(' ')[0]} 👋</div>
              <div style={S.sub}>Where are you going today?</div>

              <div style={S.grid4}>
                <div style={{...S.kpi, borderTop:'2px solid #4f8cff'}}>
                  <div style={S.kpiLabel}>Total Rides</div>
                  <div style={{...S.kpiVal, color:'#4f8cff'}}>{completedCnt}</div>
                </div>
                <div style={{...S.kpi, borderTop:'2px solid #2dd4a0'}}>
                  <div style={S.kpiLabel}>Total Spent</div>
                  <div style={{...S.kpiVal, color:'#2dd4a0'}}>₹{totalSpent.toFixed(0)}</div>
                </div>
                <div style={{...S.kpi, borderTop:'2px solid #f5a623'}}>
                  <div style={S.kpiLabel}>Avg Fare</div>
                  <div style={{...S.kpiVal, color:'#f5a623'}}>
                    ₹{completedCnt ? (totalSpent/completedCnt).toFixed(0) : 0}
                  </div>
                </div>
                <div style={{...S.kpi, borderTop:'2px solid #7c6aff'}}>
                  <div style={S.kpiLabel}>Member Since</div>
                  <div style={{...S.kpiVal, color:'#7c6aff', fontSize:16}}>
                    {profile ? new Date(profile.created_at).toLocaleDateString('en-IN',{month:'short',year:'numeric'}) : '—'}
                  </div>
                </div>
              </div>

              <div style={S.grid2}>
                {/* BOOK FORM */}
                <div style={S.card}>
                  <div style={S.cardHead}>
                    <span style={S.cardTitle}>Book Your Ride</span>
                    <span style={{fontSize:11, color:'#8b93a8'}}>Delhi NCR</span>
                  </div>
                  <div style={S.cardBody}>
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
                      <button style={{...S.btn, opacity: loading?0.7:1}} type="submit" disabled={loading}>
                        {loading ? 'Finding driver...' : '🚖 Request Ride'}
                      </button>
                    </form>
                  </div>
                </div>

                {/* ZONE FARES */}
                <div style={S.card}>
                  <div style={S.cardHead}>
                    <span style={S.cardTitle}>Delhi Zone Fares</span>
                    <span style={{fontSize:11, color:'#8b93a8'}}>15 zones</span>
                  </div>
                  <div style={{...S.cardBody, padding:0, maxHeight:380, overflowY:'auto'}}>
                    {zones.map(z => (
                      <div key={z.zone_id} style={{
                        display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'11px 20px', borderBottom:'1px solid #1e2330'
                      }}>
                        <div>
                          <div style={{fontSize:13, fontWeight:500, color:'#e8eaf0'}}>{z.zone_name}</div>
                          <div style={{fontSize:11, color:'#8b93a8'}}>{z.area_name}</div>
                        </div>
                        <div style={{textAlign:'right'}}>
                          <div style={{fontSize:13, fontWeight:600, color:'#e8eaf0'}}>₹{z.base_fare} base</div>
                          {z.is_surge_active && (
                            <span style={{fontSize:10, color:'#f06060', fontWeight:600}}>
                              ⚡ {z.surge_multiplier}× surge
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
                    <span style={S.cardTitle}>Ride in Progress</span>
                    <span style={S.pill('in_progress')}>Active</span>
                  </div>
                  <div style={S.cardBody}>
                    <div style={{
                      background:'#181c24', borderRadius:10, padding:'16px',
                      marginBottom:16, textAlign:'center'
                    }}>
                      <div style={{fontSize:12, color:'#8b93a8', marginBottom:4}}>Your OTP</div>
                      <div style={{
                        fontFamily:"'Syne',sans-serif", fontSize:42, fontWeight:800,
                        color:'#4f8cff', letterSpacing:8
                      }}>{activeRide.otp}</div>
                      <div style={{fontSize:11, color:'#8b93a8', marginTop:4}}>Share with driver to start</div>
                    </div>
                    <div style={{marginBottom:16}}>
                      <div style={{fontSize:12, color:'#8b93a8', marginBottom:8}}>Driver Details</div>
                      {activeRide.driver && Object.entries({
                        Name:         activeRide.driver.name,
                        Phone:        activeRide.driver.phone,
                        Vehicle:      `${activeRide.driver.make} ${activeRide.driver.model}`,
                        Color:        activeRide.driver.color,
                        Plate:        activeRide.driver.registration_no,
                        Rating:       `★ ${activeRide.driver.rating}`,
                      }).map(([k,v]) => (
                        <div key={k} style={{
                          display:'flex', justifyContent:'space-between',
                          padding:'7px 0', borderBottom:'1px solid #1e2330',
                          fontSize:13
                        }}>
                          <span style={{color:'#8b93a8'}}>{k}</span>
                          <span style={{color:'#e8eaf0', fontWeight:500}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      display:'flex', justifyContent:'space-between',
                      background:'#181c24', borderRadius:10, padding:'14px 16px',
                      marginBottom:16
                    }}>
                      <span style={{fontSize:13, color:'#8b93a8'}}>Estimated Fare</span>
                      <span style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:'#2dd4a0'}}>
                        ₹{parseFloat(activeRide.estimated_fare).toFixed(0)}
                      </span>
                    </div>
                    <button onClick={cancelRide} style={{
                      width:'100%', padding:'12px', borderRadius:10, border:'1px solid #f06060',
                      background:'transparent', color:'#f06060', fontSize:14, fontWeight:600,
                      cursor:'pointer'
                    }}>
                      Cancel Ride
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  ...S.card, padding:48, textAlign:'center'
                }}>
                  <div style={{fontSize:40, marginBottom:16}}>🚖</div>
                  <div style={{fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:600, color:'#e8eaf0', marginBottom:8}}>
                    No active ride
                  </div>
                  <div style={{fontSize:13, color:'#8b93a8', marginBottom:20}}>
                    Book a ride from the home tab
                  </div>
                  <button style={{...S.btn, maxWidth:200, margin:'0 auto'}}
                    onClick={() => setTab('home')}>
                    Book Now
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
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:16
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
                    ['Email',       profile.email],
                    ['Phone',       profile.phone],
                    ['Total Rides', profile.total_rides || 0],
                    ['Total Spent', `₹${parseFloat(profile.total_spent||0).toFixed(0)}`],
                    ['Member Since',new Date(profile.created_at).toLocaleDateString('en-IN',{month:'long',year:'numeric'})],
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