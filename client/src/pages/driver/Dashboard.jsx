import { useState, useEffect } from 'react'
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
  navItem: (active) => ({
    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
    borderRadius:8, cursor:'pointer', fontSize:13, marginBottom:2,
    background: active ? 'rgba(45,212,160,.1)' : 'transparent',
    color: active ? '#2dd4a0' : '#8b93a8', fontWeight: active ? 500 : 400,
    border:'none', width:'100%', textAlign:'left', transition:'.15s'
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
  const [tab,       setTab]       = useState('home')
  const [profile,   setProfile]   = useState(null)
  const [history,   setHistory]   = useState([])
  const [available, setAvailable] = useState(false)
  const [activeRide, setActiveRide] = useState(null)
  const [otp,       setOtp]       = useState('')
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    api.get('/auth/me').then(r => {
      setProfile(r.data.user)
      setAvailable(r.data.user.is_available || false)
    })
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const r = await api.get('/rides/history/driver')
      setHistory(r.data.rides)
      const active = r.data.rides.find(r => ['accepted','in_progress'].includes(r.status))
      if (active) setActiveRide(active)
    } catch {}
  }

  const toggleAvailability = async () => {
    try {
      const newVal = !available
      setAvailable(newVal)
      await api.patch(`/drivers/availability`, { is_available: newVal })
      toast.success(newVal ? 'You are now online' : 'You are now offline')
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
      loadHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start ride')
    } finally {
      setLoading(false)
    }
  }

  const completeRide = async (ride_id) => {
    setLoading(true)
    try {
      await api.patch(`/rides/${ride_id}/complete`, { actual_km: 12, payment_method: 'upi' })
      toast.success('Ride completed!')
      setActiveRide(null)
      loadHistory()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete ride')
    } finally {
      setLoading(false)
    }
  }

  const totalEarned  = history.reduce((s,r) => s + parseFloat(r.total_amount||0), 0)
  const completedCnt = history.filter(r => r.status === 'completed').length
  const avgRating    = profile?.avg_rating || 0

  return (
    <div style={S.shell}>
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
            { id:'home',    label:'Dashboard',   icon:'📊' },
            { id:'active',  label:'Active Ride', icon:'🚗' },
            { id:'history', label:'My Rides',    icon:'🕒' },
            { id:'profile', label:'Profile',     icon:'👤' },
          ].map(item => (
            <button key={item.id} style={S.navItem(tab===item.id)} onClick={() => setTab(item.id)}>
              <span style={{fontSize:15}}>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div style={{padding:'8px', borderTop:'1px solid #2a2f3e'}}>
          <div style={{padding:'10px 12px 6px', fontSize:12, color:'#4a5270'}}>
            Signed in as
            <div style={{color:'#8b93a8', fontWeight:500, marginTop:2}}>{user?.full_name}</div>
          </div>
          <button style={S.logoutBtn} onClick={logout}>← Sign out</button>
        </div>
      </aside>

      <div style={S.main}>
        <div style={S.topbar}>
          <div>
            <div style={{fontSize:15, fontWeight:600, color:'#e8eaf0'}}>
              {tab === 'home'    && 'Driver Dashboard'}
              {tab === 'active'  && 'Active Ride'}
              {tab === 'history' && 'Ride History'}
              {tab === 'profile' && 'My Profile'}
            </div>
            <div style={{fontSize:12, color:'#8b93a8'}}>Delhi · CityFlow Driver</div>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12}}>
            <span style={{fontSize:12, color: available ? '#2dd4a0' : '#8b93a8'}}>
              {available ? '● Online' : '○ Offline'}
            </span>
            <button style={S.toggle(available)} onClick={toggleAvailability}>
              <div style={S.toggleKnob(available)}/>
            </button>
          </div>
        </div>

        <div style={S.content}>

          {/* ── HOME TAB ── */}
          {tab === 'home' && (
            <>
              <div style={{fontFamily:"'Syne',sans-serif", fontSize:22, fontWeight:700, color:'#e8eaf0', marginBottom:4}}>
                Welcome, {user?.full_name?.split(' ')[0]} 🚗
              </div>
              <div style={{fontSize:13, color:'#8b93a8', marginBottom:28}}>
                {available ? 'You are online and accepting rides' : 'You are offline — toggle to go online'}
              </div>

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
                <div style={S.card}>
                  <div style={S.cardHead}>
                    <span style={S.cardTitle}>Availability</span>
                  </div>
                  <div style={S.cardBody}>
                    <div style={{
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'16px', background:'#181c24', borderRadius:10, marginBottom:16
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
                    <div style={{fontSize:12, color:'#4a5270', lineHeight:1.7}}>
                      Go online to start receiving ride requests from riders in your zone.
                      Your rating and location determine ride matching priority.
                    </div>
                  </div>
                </div>

                <div style={S.card}>
                  <div style={S.cardHead}>
                    <span style={S.cardTitle}>Today's Summary</span>
                  </div>
                  <div style={S.cardBody}>
                    {[
                      ['Rides Today',    history.filter(r=>r.status==='completed' && new Date(r.start_time).toDateString()===new Date().toDateString()).length],
                      ['Earned Today',   '₹' + history.filter(r=>r.status==='completed' && new Date(r.start_time).toDateString()===new Date().toDateString()).reduce((s,r)=>s+parseFloat(r.total_amount||0),0).toFixed(0)],
                      ['Total Rides',    completedCnt],
                      ['Total Earned',   '₹' + totalEarned.toFixed(0)],
                      ['Avg Rating',     '★ ' + parseFloat(avgRating).toFixed(2)],
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
                    {[
                      ['Rider',    activeRide.rider_name],
                      ['Pickup',   activeRide.pickup_address],
                      ['Drop',     activeRide.drop_address],
                      ['Distance', `${activeRide.estimated_km} km`],
                      ['Fare',     `₹${parseFloat(activeRide.total_amount||0).toFixed(0)}`],
                    ].map(([k,v]) => (
                      <div key={k} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'9px 0', borderBottom:'1px solid #1e2330', fontSize:13
                      }}>
                        <span style={{color:'#8b93a8'}}>{k}</span>
                        <span style={{color:'#e8eaf0', fontWeight:500}}>{v}</span>
                      </div>
                    ))}

                    {activeRide.status === 'accepted' && (
                      <div style={{marginTop:20}}>
                        <div style={{fontSize:12, color:'#8b93a8', marginBottom:8}}>Enter Rider OTP to start</div>
                        <input style={{...S.input, marginBottom:12, letterSpacing:8, fontSize:20, textAlign:'center'}}
                          placeholder="_ _ _ _" maxLength={4}
                          value={otp} onChange={e => setOtp(e.target.value)} />
                        <button style={{...S.btn, opacity:loading?0.7:1}}
                          onClick={() => startRide(activeRide.ride_id)} disabled={loading}>
                          {loading ? 'Starting...' : '▶ Start Ride'}
                        </button>
                      </div>
                    )}

                    {activeRide.status === 'in_progress' && (
                      <div style={{marginTop:20}}>
                        <button style={{...S.btn, opacity:loading?0.7:1}}
                          onClick={() => completeRide(activeRide.ride_id)} disabled={loading}>
                          {loading ? 'Completing...' : '✓ Complete Ride'}
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
                  <div style={{fontSize:13, color:'#8b93a8'}}>
                    {available ? 'Waiting for ride requests...' : 'Go online to receive rides'}
                  </div>
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
                        {r.start_time ? new Date(r.start_time).toLocaleDateString('en-IN',{
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
                  <div style={{fontSize:13, color:'#8b93a8', marginBottom:20}}>Driver · Delhi NCR</div>
                  {[
                    ['Email',        profile.email],
                    ['Phone',        profile.phone],
                    ['Avg Rating',   `★ ${parseFloat(profile.avg_rating||0).toFixed(2)}`],
                    ['Total Rides',  profile.total_rides || 0],
                    ['Total Earned', `₹${parseFloat(profile.total_earned||0).toFixed(0)}`],
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