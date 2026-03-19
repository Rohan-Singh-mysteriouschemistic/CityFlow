import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './context/AuthContext'

import Login    from './pages/Login'
import Register from './pages/Register'

import RiderDashboard  from './pages/rider/Dashboard'
import DriverDashboard from './pages/driver/Dashboard'
import AdminDashboard  from './pages/admin/Dashboard'

const ProtectedRoute = ({ children, role }) => {
  const { user, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'#8b93a8'}}>Loading...</div>
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
            background: '#1e2330',
            color: '#e8eaf0',
            border: '1px solid #2a2f3e',
            fontSize: '14px',
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

        <Route path="*" element={
          <Navigate to="/" replace />
        }/>
      </Routes>
    </>
  )
}