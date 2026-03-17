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
    background:'linear-gradient(135deg,#f5a623,#f06060)',
    display:'flex', alignItems:'center', justifyContent:'center'
  },
  logoName: { fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:'#e8eaf0' },
  nav: { padding:'12px 8px', flex:1 },
  navItem: (active) => ({
    display:'flex', alignItems:'center', gap:10, padding:'9px 12px',
    borderRadius:8, cursor:'pointer', fontSize:13, marginBottom:2,
    background: active ? 'rgba(245,166,35,.1)' : 'transparent',
    color: active ? '#f5a623' : '#8b93a8', fontWeight: active ? 500 : 400,
    border:'none', width:'100%', textAlign:'left', transition:'.15s'
  }),
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'auto' },
  topbar: {
    padding:'18px 28px', borderBottom:'1px solid #2a2f3e',
    background:'#111318', display:'flex', alignItems:'center', justifyContent:'space-between'
  },
  content: { padding:'28px', flex:1 },
  grid4: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 },
  grid5: { display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14, marginBottom:24 },
  grid2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 },
  kpi: (color) => ({
    background:'#111318', border:'1px solid #2a2f3e', borderRadius:12,
    padding:'18px 20px', borderTop:`2px solid ${color}`
  }),
  kpiLabel: { fontSize:11, color:'#8b93a8', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:8 },
  kpiVal: { fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:700, lineHeight:1 },
  kpiSub: { fontSize:11, color:'#4a5270', marginTop:6 },
  card: { background:'#111318', border:'1px solid #2a2f3e', borderRadius:14, overflow:'hidden', marginBottom:20 },
  cardHead: {
    padding:'16px 20px', borderBottom:'1px solid #2a2f3e',
    display:'flex', alignItems:'center', justifyContent:'space-between'
  },
  cardTitle: { fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:600, color:'#e8eaf0' },
  th: {
    textAlign:'left', fontSize:10, color:'#8b93a8',
    textTransform:'uppercase', letterSpacing:'.6px', fontWeight:500,
    padding:'0 0 10px', borderBottom:'1px solid #2a2f3e'
  },
  td: { padding:'11px 0', borderBottom:'1px solid #1e2330', fontSize:12, verticalAlign:'middle' },
  pill: (c) => ({
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'3px 10px', borderRadius:20, fontSize:10, fontWeight:600,
    background:
      c==='completed'?'rgba(45,212,160,.12)':
      c==='in_progress'?'rgba(79,140,255,.12)':
      c==='active'||c==='true'?'rgba(45,212,160,.12)':
      'rgba(240,96,96,.12)',
    color:
      c==='completed'?'#2dd4a0':
      c==='in_progress'?'#4f8cff':
      c==='active'||c==='true'?'#2dd4a0':
      '#f06060'
  }),
  actionBtn: (color) => ({
    padding:'4px 10px', borderRadius:6, border:`1px solid ${color}`,
    background:'transparent', color, fontSize:11, fontWeight:500,
    cursor:'pointer', transition:'.15s'
  }),
  logoutBtn: {
    margin:'12px 8px', padding:'9px 12px', borderRadius:8, border:'none',
    background:'transparent', color:'#f06060', fontSize:13, cursor:'pointer',
    textAlign:'left', width:'calc(100% - 16px)'
  },
  surgeInput: {
    background:'#181c24', border:'1px solid #2a2f3e', borderRadius:6,
    padding:'5px 10px', color:'#e8eaf0', fontSize:12, outline:'none', width:70
  }
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [tab,     setTab]     = useState('overview')
  const [stats,   setStats]   = useState(null)
  const [rides,   setRides]   = useState([])
  const [drivers, setDrivers] = useState([])
  const [riders,  setRiders]  = useState([])
  const [zones,   setZones]   = useState([])
  const [revenue, setRevenue] = useState([])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    try {
      const [s, rd, dr, ri, z, rv] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/rides?limit=30'),
        api.get('/admin/drivers'),
        api.get('/admin/riders'),
        api.get('/admin/zones'),
        api.get('/admin/revenue/zones'),
      ])
      setStats(s.data.stats)
      setRides(rd.data.rides)
      setDrivers(dr.data.drivers)
      setRiders(ri.data.riders)
      setZones(z.data.zones)
      setRevenue(rv.data.data)
    } catch (err) {
      toast.error('Failed to load data')
    }
  }

  const verifyDriver = async (driver_id) => {
    try {
      await api.patch(`/admin/drivers/${driver_id}/verify`)
      toast.success('Driver verified')
      loadAll()
    } catch { toast.error('Failed') }
  }

  const toggleUser = async (user_id) => {
    try {
      await api.patch(`/admin/users/${user_id}/toggle`)
      toast.success('User status updated')
      loadAll()
    } catch { toast.error('Failed') }
  }

  const updateSurge = async (zone_id, surge_multiplier, is_surge_active) => {
    try {
      await api.patch(`/admin/zones/${zone_id}/surge`, { surge_multiplier, is_surge_active })
      toast.success('Zone updated')
      loadAll()
    } catch { toast.error('Failed') }
  }

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
            { id:'overview', label:'Overview',    icon:'📊' },
            { id:'rides',    label:'All Rides',   icon:'🚖' },
            { id:'drivers',  label:'Drivers',     icon:'🚗' },
            { id:'riders',   label:'Riders',      icon:'🧍' },
            { id:'zones',    label:'Zones',       icon:'📍' },
            { id:'revenue',  label:'Revenue',     icon:'₹'  },
          ].map(item => (
            <button key={item.id} style={S.navItem(tab===item.id)} onClick={() => setTab(item.id)}>
              <span style={{fontSize:15}}>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div style={{padding:'8px', borderTop:'1px solid #2a2f3e'}}>
          <div style={{padding:'10px 12px 6px', fontSize:12, color:'#4a5270'}}>
            Signed in as
            <div style={{color:'#f5a623', fontWeight:500, marginTop:2}}>{user?.full_name}</div>
            <div style={{color:'#4a5270', fontSize:10, marginTop:1}}>Super Admin</div>
          </div>
          <button style={S.logoutBtn} onClick={logout}>← Sign out</button>
        </div>
      </aside>

      <div style={S.main}>
        <div style={S.topbar}>
          <div>
            <div style={{fontSize:15, fontWeight:600, color:'#e8eaf0'}}>
              {tab==='overview'&&'Platform Overview'}
              {tab==='rides'   &&'All Rides'}
              {tab==='drivers' &&'Driver Management'}
              {tab==='riders'  &&'Rider Management'}
              {tab==='zones'   &&'Zone Management'}
              {tab==='revenue' &&'Revenue Analytics'}
            </div>
            <div style={{fontSize:12, color:'#8b93a8'}}>CityFlow Admin · Delhi</div>
          </div>
          <button onClick={loadAll} style={{
            background:'#181c24', border:'1px solid #2a2f3e', borderRadius:8,
            padding:'7px 14px', color:'#8b93a8', fontSize:12, cursor:'pointer'
          }}>↻ Refresh</button>
        </div>

        <div style={S.content}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && stats && (
            <>
              <div style={S.grid5}>
                {[
                  { label:'Total Rides',    val: stats.total_rides,       color:'#4f8cff' },
                  { label:'Active Now',     val: stats.active_rides,      color:'#2dd4a0' },
                  { label:'Total Revenue',  val:`₹${parseFloat(stats.total_revenue).toFixed(0)}`, color:'#f5a623' },
                  { label:'Total Riders',   val: stats.total_riders,      color:'#7c6aff' },
                  { label:'Total Drivers',  val: stats.total_drivers,     color:'#f06060' },
                ].map(({label,val,color}) => (
                  <div key={label} style={S.kpi(color)}>
                    <div style={S.kpiLabel}>{label}</div>
                    <div style={{...S.kpiVal, color}}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={S.grid4}>
                {[
                  { label:"Today's Rides",    val: stats.today_rides,      color:'#4f8cff' },
                  { label:"Today's Revenue",  val:`₹${parseFloat(stats.today_revenue).toFixed(0)}`, color:'#2dd4a0' },
                  { label:'Available Drivers',val: stats.available_drivers, color:'#f5a623' },
                  { label:'Avg Driver Rating',val:`★ ${stats.avg_driver_rating||0}`, color:'#7c6aff' },
                ].map(({label,val,color}) => (
                  <div key={label} style={S.kpi(color)}>
                    <div style={S.kpiLabel}>{label}</div>
                    <div style={{...S.kpiVal, color, fontSize:20}}>{val}</div>
                  </div>
                ))}
              </div>

              {/* Recent Rides */}
              <div style={S.card}>
                <div style={S.cardHead}>
                  <span style={S.cardTitle}>Recent Rides</span>
                  <button onClick={()=>setTab('rides')} style={{fontSize:12,color:'#f5a623',background:'none',border:'none',cursor:'pointer'}}>
                    View all →
                  </button>
                </div>
                <div style={{padding:'0 20px'}}>
                  <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        {['ID','Rider','Driver','Route','Fare','Status','Zone'].map(h=>(
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rides.slice(0,8).map(r => (
                        <tr key={r.ride_id}>
                          <td style={{...S.td, color:'#4a5270'}}>#{r.ride_id}</td>
                          <td style={{...S.td, color:'#e8eaf0'}}>{r.rider_name}</td>
                          <td style={{...S.td, color:'#e8eaf0'}}>{r.driver_name}</td>
                          <td style={{...S.td, color:'#8b93a8', fontSize:11, maxWidth:180}}>
                            {r.pickup_address?.split(',')[0]} → {r.drop_address?.split(',')[0]}
                          </td>
                          <td style={{...S.td, color:'#2dd4a0', fontWeight:600}}>
                            {r.total_amount ? `₹${parseFloat(r.total_amount).toFixed(0)}` : '—'}
                          </td>
                          <td style={S.td}><span style={S.pill(r.status)}>{r.status?.replace('_',' ')}</span></td>
                          <td style={{...S.td, color:'#8b93a8', fontSize:11}}>{r.zone_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── ALL RIDES ── */}
          {tab === 'rides' && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.cardTitle}>All Rides</span>
                <span style={{fontSize:12,color:'#8b93a8'}}>{rides.length} total</span>
              </div>
              <div style={{padding:'0 20px', overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:800}}>
                  <thead>
                    <tr>
                      {['ID','Rider','Driver','Pickup','Drop','Fare','Method','Status','Date'].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rides.map(r => (
                      <tr key={r.ride_id}>
                        <td style={{...S.td,color:'#4a5270'}}>#{r.ride_id}</td>
                        <td style={{...S.td,color:'#e8eaf0'}}>{r.rider_name}</td>
                        <td style={{...S.td,color:'#e8eaf0'}}>{r.driver_name}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{r.pickup_address?.split(',')[0]}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{r.drop_address?.split(',')[0]}</td>
                        <td style={{...S.td,color:'#2dd4a0',fontWeight:600}}>
                          {r.total_amount?`₹${parseFloat(r.total_amount).toFixed(0)}`:'—'}
                        </td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{r.payment_method||'—'}</td>
                        <td style={S.td}><span style={S.pill(r.status)}>{r.status?.replace('_',' ')}</span></td>
                        <td style={{...S.td,color:'#4a5270',fontSize:11}}>
                          {r.created_at?new Date(r.created_at).toLocaleDateString('en-IN'):'—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DRIVERS ── */}
          {tab === 'drivers' && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.cardTitle}>Driver Management</span>
                <span style={{fontSize:12,color:'#8b93a8'}}>{drivers.length} drivers</span>
              </div>
              <div style={{padding:'0 20px', overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:900}}>
                  <thead>
                    <tr>
                      {['Driver','Phone','Vehicle','Rating','Rides','Earned','Status','Verified','Actions'].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map(d => (
                      <tr key={d.user_id}>
                        <td style={{...S.td,color:'#e8eaf0',fontWeight:500}}>{d.full_name}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{d.phone}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>
                          {d.vehicle_type?.toUpperCase()} · {d.make} {d.model}
                        </td>
                        <td style={{...S.td,color:'#f5a623',fontWeight:600}}>★ {parseFloat(d.avg_rating||0).toFixed(2)}</td>
                        <td style={{...S.td,color:'#e8eaf0'}}>{d.total_rides||0}</td>
                        <td style={{...S.td,color:'#2dd4a0',fontWeight:600}}>₹{parseFloat(d.total_earned||0).toFixed(0)}</td>
                        <td style={S.td}>
                          <span style={S.pill(d.is_available?'active':'inactive')}>
                            {d.is_available?'Online':'Offline'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <span style={S.pill(d.is_verified?'completed':'cancelled')}>
                            {d.is_verified?'Verified':'Pending'}
                          </span>
                        </td>
                        <td style={{...S.td, display:'flex', gap:6}}>
                          {!d.is_verified && (
                            <button style={S.actionBtn('#2dd4a0')} onClick={() => verifyDriver(d.user_id)}>
                              Verify
                            </button>
                          )}
                          <button style={S.actionBtn(d.is_active?'#f06060':'#2dd4a0')}
                            onClick={() => toggleUser(d.user_id)}>
                            {d.is_active ? 'Suspend' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── RIDERS ── */}
          {tab === 'riders' && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.cardTitle}>Rider Management</span>
                <span style={{fontSize:12,color:'#8b93a8'}}>{riders.length} riders</span>
              </div>
              <div style={{padding:'0 20px', overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:700}}>
                  <thead>
                    <tr>
                      {['Rider','Email','Phone','Rides','Total Spent','Payment Pref','Status','Action'].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {riders.map(r => (
                      <tr key={r.user_id}>
                        <td style={{...S.td,color:'#e8eaf0',fontWeight:500}}>{r.full_name}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{r.email}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{r.phone}</td>
                        <td style={{...S.td,color:'#e8eaf0'}}>{r.total_rides||0}</td>
                        <td style={{...S.td,color:'#2dd4a0',fontWeight:600}}>₹{parseFloat(r.total_spent||0).toFixed(0)}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{r.preferred_payment?.toUpperCase()}</td>
                        <td style={S.td}>
                          <span style={S.pill(r.is_active?'active':'cancelled')}>
                            {r.is_active?'Active':'Suspended'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <button style={S.actionBtn(r.is_active?'#f06060':'#2dd4a0')}
                            onClick={() => toggleUser(r.user_id)}>
                            {r.is_active?'Suspend':'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ZONES ── */}
          {tab === 'zones' && (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={S.cardTitle}>Zone Management</span>
                <span style={{fontSize:12,color:'#8b93a8'}}>{zones.length} zones · Delhi NCR</span>
              </div>
              <div style={{padding:'0 20px', overflowX:'auto'}}>
                <table style={{width:'100%', borderCollapse:'collapse', minWidth:700}}>
                  <thead>
                    <tr>
                      {['Zone','Area','Base Fare','Per KM','Surge Multiplier','Surge Active','Action'].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map(z => (
                      <tr key={z.zone_id}>
                        <td style={{...S.td,color:'#e8eaf0',fontWeight:500}}>{z.zone_name}</td>
                        <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{z.area_name}</td>
                        <td style={{...S.td,color:'#f5a623',fontWeight:600}}>₹{z.base_fare}</td>
                        <td style={{...S.td,color:'#8b93a8'}}>₹{z.fare_per_km}/km</td>
                        <td style={S.td}>
                          <input style={S.surgeInput} type="number" step="0.1" min="1" max="5"
                            defaultValue={z.surge_multiplier}
                            onBlur={e => updateSurge(z.zone_id, e.target.value, z.is_surge_active)}/>
                        </td>
                        <td style={S.td}>
                          <span style={S.pill(z.is_surge_active?'active':'cancelled')}>
                            {z.is_surge_active?'Active':'Inactive'}
                          </span>
                        </td>
                        <td style={S.td}>
                          <button style={S.actionBtn(z.is_surge_active?'#f06060':'#2dd4a0')}
                            onClick={() => updateSurge(z.zone_id, z.surge_multiplier, !z.is_surge_active)}>
                            {z.is_surge_active?'Deactivate':'Activate'} Surge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── REVENUE ── */}
          {tab === 'revenue' && (
            <>
              <div style={S.grid4}>
                {[
                  { label:'Total Revenue',  val:`₹${revenue.reduce((s,r)=>s+parseFloat(r.total_revenue||0),0).toFixed(0)}`, color:'#2dd4a0' },
                  { label:'Total Rides',    val: revenue.reduce((s,r)=>s+parseInt(r.total_rides||0),0), color:'#4f8cff' },
                  { label:'Avg Fare',       val:`₹${(revenue.reduce((s,r)=>s+parseFloat(r.total_revenue||0),0)/Math.max(revenue.reduce((s,r)=>s+parseInt(r.total_rides||0),0),1)).toFixed(0)}`, color:'#f5a623' },
                  { label:'Active Zones',   val: revenue.filter(r=>parseInt(r.total_rides||0)>0).length, color:'#7c6aff' },
                ].map(({label,val,color}) => (
                  <div key={label} style={S.kpi(color)}>
                    <div style={S.kpiLabel}>{label}</div>
                    <div style={{...S.kpiVal, color}}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={S.card}>
                <div style={S.cardHead}>
                  <span style={S.cardTitle}>Revenue by Zone</span>
                </div>
                <div style={{padding:'0 20px'}}>
                  <table style={{width:'100%', borderCollapse:'collapse'}}>
                    <thead>
                      <tr>
                        {['Zone','Area','Total Rides','Total Revenue','Avg Fare'].map(h=>(
                          <th key={h} style={S.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {revenue.map((r,i) => (
                        <tr key={i}>
                          <td style={{...S.td,color:'#e8eaf0',fontWeight:500}}>{r.zone_name}</td>
                          <td style={{...S.td,color:'#8b93a8',fontSize:11}}>{r.area_name}</td>
                          <td style={{...S.td,color:'#4f8cff',fontWeight:600}}>{r.total_rides||0}</td>
                          <td style={{...S.td,color:'#2dd4a0',fontWeight:600}}>₹{parseFloat(r.total_revenue||0).toFixed(0)}</td>
                          <td style={{...S.td,color:'#f5a623'}}>₹{parseFloat(r.avg_fare||0).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}