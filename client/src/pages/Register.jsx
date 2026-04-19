import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/axios'

const VEHICLE_TYPES = ['auto', 'sedan', 'suv', 'xl', 'bike']

export default function Register() {
  const navigate  = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)
  const [form,    setForm]    = useState({
    full_name: '', email: '', password: '', role: 'rider',
    license_no: '',
    vehicle: { registration_no: '', vehicle_type: 'sedan', make: '', model: '', color: '', year: 2022 },
  })

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }))
  const updateV = (field, val) => setForm(f => ({ ...f, vehicle: { ...f.vehicle, [field]: val } }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const payload = { ...form }
      if (form.role !== 'driver') { delete payload.license_no; delete payload.vehicle }
      await api.post('/auth/register', payload)
      navigate('/login', { state: { registered: true } })
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card page-enter">
        <h1 className="auth-card__title">CityFlow</h1>
        <p className="auth-card__sub">Create your account</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <fieldset style={{ border: 'none', padding: 0, marginBottom: 'var(--sp-5)' }}>
            <legend className="label" style={{ marginBottom: 'var(--sp-2)' }}>I want to</legend>
            <div className="role-toggle">
              {[{ value: 'rider', label: 'Book rides' }, { value: 'driver', label: 'Drive' }, { value: 'admin', label: 'Admin access' }].map(r => (
                <button key={r.value} type="button" id={`role-${r.value}`}
                  className={`role-btn${form.role === r.value ? ' role-btn--active' : ''}`}
                  onClick={() => update('role', r.value)}>{r.label}</button>
              ))}
            </div>
          </fieldset>

          <div className="form-group">
            <label className="label" htmlFor="reg-name">Full name</label>
            <input id="reg-name" className="input" type="text" placeholder="Your full name"
              value={form.full_name} onChange={e => update('full_name', e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="reg-email">Email</label>
            <input id="reg-email" className="input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => update('email', e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="reg-password">Password</label>
            <input id="reg-password" className="input" type="password" placeholder="Minimum 8 characters"
              value={form.password} onChange={e => update('password', e.target.value)} required autoComplete="new-password" />
          </div>

          {form.role === 'driver' && (
            <>
              <div className="form-group">
                <label className="label" htmlFor="reg-license">License number</label>
                <input id="reg-license" className="input" type="text" placeholder="DL0120210001"
                  value={form.license_no} onChange={e => update('license_no', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="label" htmlFor="reg-vtype">Vehicle type</label>
                <select id="reg-vtype" className="input" value={form.vehicle.vehicle_type}
                  onChange={e => updateV('vehicle_type', e.target.value)}>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              {[['reg-make','Make','make','Maruti'],['reg-model','Model','model','Dzire'],['reg-color','Color','color','White'],['reg-reg','Registration no','registration_no','DL01AB1234']].map(([id,label,field,ph]) => (
                <div className="form-group" key={field}>
                  <label className="label" htmlFor={id}>{label}</label>
                  <input id={id} className="input" type="text" placeholder={ph}
                    value={form.vehicle[field]} onChange={e => updateV(field, e.target.value)} required />
                </div>
              ))}
              <div className="form-group">
                <label className="label" htmlFor="reg-year">Year</label>
                <input id="reg-year" className="input" type="number" min="2000" max={new Date().getFullYear()}
                  value={form.vehicle.year} onChange={e => updateV('year', parseInt(e.target.value, 10))} required />
              </div>
            </>
          )}

          <button id="btn-create-account" className="btn btn-primary btn-full" type="submit"
            disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="auth-card__footer">
          Already have an account?{' '}
          <Link to="/login" className="auth-link">Sign in</Link>
        </p>
      </div>
    </div>
  )
}