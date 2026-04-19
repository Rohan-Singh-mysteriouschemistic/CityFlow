import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Login — /login
 * Single centered column, max-width 400px.
 * No hero image. No background pattern. No social proof.
 */
export default function Login() {
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [suspension,  setSuspension]  = useState(null)
  const { login }   = useAuth()
  const navigate    = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSuspension(null)
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(`/${user.role}`, { replace: true })
    } catch (err) {
      const data = err.response?.data
      if (data?.code === 'ACCOUNT_SUSPENDED') {
        setSuspension(data)
      } else {
        setError(data?.message || 'Sign in failed. Check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card page-enter">
        <h1 className="auth-card__title">CityFlow</h1>
        <p className="auth-card__sub">Sign in to continue</p>

        {error && <p className="form-error" role="alert">{error}</p>}

        {suspension && (
          <div className="suspension-notice" role="alert">
            <strong>Account suspended</strong>
            <p>
              Your account has been suspended for{' '}
              <strong>{suspension.suspension_label}</strong>.
              {suspension.is_permanent
                ? ' Contact support for assistance.'
                : ' You can sign in after the suspension ends.'}
            </p>
            {!suspension.is_permanent && suspension.suspension_until && (
              <p className="suspension-notice__until">
                Access restored:{' '}
                {new Date(suspension.suspension_until).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            id="btn-sign-in"
            className="btn btn-primary btn-full"
            type="submit"
            disabled={loading}
            style={{ opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Quick-fill test accounts */}
        <div className="auth-card__test-accounts">
          <span className="auth-card__test-label">Test accounts</span>
          {[
            { label: 'Rider',  email: 'rohan@cityflow.in'  },
            { label: 'Driver', email: 'ramesh@cityflow.in' },
            { label: 'Admin',  email: 'admin@cityflow.in'  },
          ].map(a => (
            <button
              key={a.label}
              className="btn btn-secondary"
              onClick={() => { setEmail(a.email); setPassword('test1234') }}
              type="button"
              id={`btn-test-${a.label.toLowerCase()}`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <p className="auth-card__footer">
          No account?{' '}
          <Link to="/register" className="auth-link">Create account</Link>
        </p>
      </div>
    </div>
  )
}