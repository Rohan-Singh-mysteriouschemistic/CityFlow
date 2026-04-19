import Sidebar from './Sidebar'

/**
 * AppShell — wraps every authenticated page.
 * Renders Sidebar on the left, main content area on the right.
 *
 * Props:
 *   children    — page content
 *   role        — 'rider' | 'driver' | 'admin' (passed to Sidebar)
 *   activeTab   — current tab id
 *   onTabChange — tab change handler
 */
export default function AppShell({ children, role, activeTab, onTabChange }) {
  return (
    <div className="app-shell">
      <Sidebar role={role} activeTab={activeTab} onTabChange={onTabChange} />
      <main className="app-shell__main" id="main-content">
        {children}
      </main>
    </div>
  )
}
