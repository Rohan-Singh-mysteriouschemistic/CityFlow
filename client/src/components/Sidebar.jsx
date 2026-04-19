import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = {
  rider:  [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'history',   label: 'Ride History' },
  ],
  driver: [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'history',   label: 'Ride History' },
  ],
  admin: [
    { id: 'overview', label: 'Dashboard' },
    { id: 'rides',    label: 'All Rides' },
    { id: 'drivers',  label: 'Drivers' },
    { id: 'riders',   label: 'Riders' },
    { id: 'zones',    label: 'Zones' },
  ],
}

/**
 * Sidebar — left navigation for authenticated pages.
 *
 * Props:
 *   role       — 'rider' | 'driver' | 'admin'
 *   activeTab  — currently active nav id
 *   onTabChange — (id: string) => void
 */
export default function Sidebar({ role, activeTab, onTabChange }) {
  const { user, logout } = useAuth()
  const items = NAV_ITEMS[role] || []

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar__logo">
        <span className="sidebar__wordmark">CityFlow</span>
      </div>

      <nav className="sidebar__nav" aria-label="Section links">
        {items.map(item => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`sidebar__link${activeTab === item.id ? ' sidebar__link--active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-current={activeTab === item.id ? 'page' : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__user">
          Signed in as
          <div className="sidebar__user-name">{user?.full_name || user?.email}</div>
        </div>
        <button className="sidebar__logout" onClick={logout} id="btn-logout">
          Sign out
        </button>
      </div>
    </aside>
  )
}
