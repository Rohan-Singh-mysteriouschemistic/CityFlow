import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './context/AuthContext'
import LoadingScreen from './components/LoadingScreen'

import Login    from './pages/Login'
import Register from './pages/Register'

import RiderDashboard  from './pages/rider/Rider_Dashboard'
import DriverDashboard from './pages/driver/Driver_Dashboard'
import AdminDashboard  from './pages/admin/Admin_Dashboard'

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const { user } = useAuth()

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            fontSize: '14px',
            fontFamily: 'var(--font-body)',
          }
        }}
      />
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/rider/*" element={
          <ProtectedRoute role="rider">
            <RiderDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/driver/*" element={
          <ProtectedRoute role="driver">
            <DriverDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/admin/*" element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }/>

        <Route path="/" element={
          user
            ? <Navigate to={`/${user.role}`} replace />
            : <Navigate to="/login" replace />
        }/>

        <Route path="*" element={<Navigate to="/" replace />}/>
      </Routes>
    </>
  )
}