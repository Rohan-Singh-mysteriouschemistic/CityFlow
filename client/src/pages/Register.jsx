import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../api/axios'

export default function Register() {
  const navigate = useNavigate()
  const [step,    setStep]    = useState(1)
  const [loading, setLoading] = useState(false)
  const [form,    setForm]    = useState({
    full_name: '', email: '', phone: '', password: '', role: 'rider',
    license_no: '',
    vehicle: { registration_no: '', vehicle_type: 'sedan', make: '', model: '', color: '', year: 2022 }
  })

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }))
  const updateVehicle = (field, val) => setForm(f => ({ ...f, vehicle: { ...f.vehicle, [field]: val } }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload = { ...form }
      if (form.role === 'rider') { delete payload.license_no; delete payload.vehicle }
      const { data } = await api.post('/auth/register', payload)
      sessionStorage.setItem('cityflow_token', data.token)
      sessionStorage.setItem('cityflow_user',  JSON.stringify(data.user))
      toast.success('Account created!')
      navigate(`/${data.user.role}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span style={styles.brandName}>CityFlow</span>
        </div>

        <h2 style={styles.title}>Create account</h2>
        <p style={styles.sub}>Join Delhi's ride platform</p>

        {/* Role Toggle */}
        <div style={styles.roleToggle}>
          {['rider', 'driver'].map(r => (
            <button key={r} onClick={() => { update('role', r); setStep(1) }}
              style={{ ...styles.roleBtn, ...(form.role === r ? styles.roleBtnActive : {}) }}>
              {r === 'rider' ? '🧍 Rider' : '🚗 Driver'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Step 1 — Basic Info */}
          {step === 1 && (
            <>
              {[
                { label: 'Full Name',    field: 'full_name', type: 'text',     placeholder: 'Rohan Singh'         },
                { label: 'Email',        field: 'email',     type: 'email',    placeholder: 'you@cityflow.in'     },
                { label: 'Phone',        field: 'phone',     type: 'tel',      placeholder: '98XXXXXXXX'          },
                { label: 'Password',     field: 'password',  type: 'password', placeholder: 'Min 8 characters'    },
              ].map(({ label, field, type, placeholder }) => (
                <div key={field} style={styles.field}>
                  <label style={styles.label}>{label}</label>
                  <input style={styles.input} type={type} placeholder={placeholder}
                    value={form[field]} onChange={e => update(field, e.target.value)} required />
                </div>
              ))}
              {form.role === 'rider' ? (
                <button type="submit" style={styles.btn} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account →'}
                </button>
              ) : (
                <button type="button" style={styles.btn} onClick={() => setStep(2)}>
                  Next — Vehicle Details →
                </button>
              )}
            </>
          )}

          {/* Step 2 — Driver Details */}
          {step === 2 && form.role === 'driver' && (
            <>
              <div style={styles.field}>
                <label style={styles.label}>License Number</label>
                <input style={styles.input} placeholder="DL0120210001"
                  value={form.license_no} onChange={e => update('license_no', e.target.value)} required />
              </div>
              {[
                { label: 'Registration No', field: 'registration_no', placeholder: 'DL01AB1234' },
                { label: 'Make',            field: 'make',            placeholder: 'Maruti'      },
                { label: 'Model',           field: 'model',           placeholder: 'Dzire'       },
                { label: 'Color',           field: 'color',           placeholder: 'White'       },
              ].map(({ label, field, placeholder }) => (
                <div key={field} style={styles.field}>
                  <label style={styles.label}>{label}</label>
                  <input style={styles.input} placeholder={placeholder}
                    value={form.vehicle[field]}
                    onChange={e => updateVehicle(field, e.target.value)} required />
                </div>
              ))}
              <div style={styles.field}>
                <label style={styles.label}>Vehicle Type</label>
                <select style={styles.input} value={form.vehicle.vehicle_type}
                  onChange={e => updateVehicle('vehicle_type', e.target.value)}>
                  {['auto', 'sedan', 'suv', 'xl', 'bike'].map(t => (
                    <option key={t} value={t}>{t.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" style={styles.btnOutline} onClick={() => setStep(1)}>← Back</button>
                <button type="submit" style={{ ...styles.btn, flex: 1 }} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account →'}
                </button>
              </div>
            </>
          )}
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in →</Link>
        </p>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh', background: '#0a0a0a',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 440,
    background: '#111318', border: '1px solid #2a2f3e',
    borderRadius: 20, padding: '40px 40px',
  },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logo: {
    width: 34, height: 34,
    background: 'linear-gradient(135deg, #4f8cff, #7c6aff)',
    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: '#e8eaf0' },
  title: { fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, color: '#e8eaf0', marginBottom: 6 },
  sub: { fontSize: 14, color: '#8b93a8', marginBottom: 24 },
  roleToggle: {
    display: 'flex', gap: 8, marginBottom: 24,
    background: '#181c24', borderRadius: 10, padding: 4,
  },
  roleBtn: {
    flex: 1, padding: '9px 16px', borderRadius: 8, border: 'none',
    background: 'transparent', color: '#8b93a8', fontSize: 13, fontWeight: 500,
    transition: 'all 0.2s',
  },
  roleBtnActive: { background: '#1e2330', color: '#e8eaf0', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 500, color: '#8b93a8' },
  input: {
    background: '#181c24', border: '1px solid #2a2f3e', borderRadius: 10,
    padding: '11px 14px', color: '#e8eaf0', fontSize: 14, outline: 'none',
  },
  btn: {
    background: 'linear-gradient(135deg, #4f8cff, #7c6aff)',
    border: 'none', borderRadius: 10, padding: '12px 20px',
    color: '#fff', fontSize: 14, fontWeight: 600, marginTop: 4,
  },
  btnOutline: {
    background: 'transparent', border: '1px solid #2a2f3e', borderRadius: 10,
    padding: '12px 20px', color: '#8b93a8', fontSize: 14, fontWeight: 500,
  },
  footer: { textAlign: 'center', fontSize: 13, color: '#4a5270', marginTop: 24 },
  link: { color: '#4f8cff', fontWeight: 500 },
}