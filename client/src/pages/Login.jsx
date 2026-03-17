import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const user = await login(email, password)
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}!`)
      navigate(`/${user.role}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div style={styles.brand}>
          <div style={styles.logo}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={styles.brandName}>CityFlow</span>
        </div>
        <div style={styles.heroText}>
          <h1 style={styles.heroH1}>Delhi's smartest<br/>ride platform.</h1>
          <p style={styles.heroP}>Fast, reliable, affordable rides across all 15 zones of the capital.</p>
        </div>
        <div style={styles.stats}>
          {[['15', 'Delhi Zones'], ['500+', 'Daily Rides'], ['4.8★', 'Avg Rating']].map(([val, label]) => (
            <div key={label} style={styles.stat}>
              <span style={styles.statVal}>{val}</span>
              <span style={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Sign in</h2>
          <p style={styles.cardSub}>Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input
                style={styles.input}
                type="email"
                placeholder="you@cityflow.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input
                style={styles.input}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button style={{...styles.btn, opacity: loading ? 0.7 : 1}} type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <div style={styles.divider}><span>Test accounts</span></div>
          <div style={styles.testAccounts}>
            {[
              { label: 'Rider',  email: 'rohan@cityflow.in'  },
              { label: 'Driver', email: 'ramesh@cityflow.in' },
              { label: 'Admin',  email: 'admin@cityflow.in'  },
            ].map(a => (
              <button key={a.label} style={styles.testBtn}
                onClick={() => { setEmail(a.email); setPassword('test1234') }}>
                {a.label}
              </button>
            ))}
          </div>

          <p style={styles.footer}>
            No account?{' '}
            <Link to="/register" style={styles.link}>Create one →</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    display: 'flex', minHeight: '100vh', background: '#0a0a0a',
  },
  left: {
    flex: 1, background: 'linear-gradient(135deg, #111318 0%, #1a1f2e 100%)',
    padding: '48px 56px', display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', borderRight: '1px solid #2a2f3e',
  },
  brand: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: {
    width: 40, height: 40,
    background: 'linear-gradient(135deg, #4f8cff, #7c6aff)',
    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 700, color: '#e8eaf0' },
  heroText: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  heroH1: {
    fontFamily: "'Syne', sans-serif", fontSize: 48, fontWeight: 800,
    color: '#e8eaf0', lineHeight: 1.15, marginBottom: 16,
  },
  heroP: { fontSize: 17, color: '#8b93a8', maxWidth: 380, lineHeight: 1.7 },
  stats: { display: 'flex', gap: 40 },
  stat: { display: 'flex', flexDirection: 'column', gap: 4 },
  statVal: { fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 700, color: '#4f8cff' },
  statLabel: { fontSize: 13, color: '#8b93a8' },
  right: {
    width: 480, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '48px 40px',
  },
  card: { width: '100%', maxWidth: 400 },
  cardTitle: { fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 700, color: '#e8eaf0', marginBottom: 8 },
  cardSub: { fontSize: 14, color: '#8b93a8', marginBottom: 32 },
  form: { display: 'flex', flexDirection: 'column', gap: 20 },
  field: { display: 'flex', flexDirection: 'column', gap: 8 },
  label: { fontSize: 13, fontWeight: 500, color: '#8b93a8' },
  input: {
    background: '#181c24', border: '1px solid #2a2f3e', borderRadius: 10,
    padding: '12px 16px', color: '#e8eaf0', fontSize: 15, outline: 'none',
    transition: 'border-color 0.2s',
  },
  btn: {
    background: 'linear-gradient(135deg, #4f8cff, #7c6aff)',
    border: 'none', borderRadius: 10, padding: '13px 24px',
    color: '#fff', fontSize: 15, fontWeight: 600, marginTop: 4,
    transition: 'opacity 0.2s',
  },
  divider: {
    display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0',
    color: '#4a5270', fontSize: 12,
    '::before': { content: '""', flex: 1, height: 1, background: '#2a2f3e' },
  },
  testAccounts: { display: 'flex', gap: 8, marginBottom: 24 },
  testBtn: {
    flex: 1, background: '#181c24', border: '1px solid #2a2f3e',
    borderRadius: 8, padding: '8px 12px', color: '#8b93a8',
    fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
  },
  footer: { textAlign: 'center', fontSize: 14, color: '#4a5270' },
  link: { color: '#4f8cff', fontWeight: 500 },
}