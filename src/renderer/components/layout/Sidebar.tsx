import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BarChart2, Clock, Moon, Sun, Tag, Bell, Settings } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/limits', label: 'App Limits', icon: Clock },
  { to: '/downtime', label: 'Downtime', icon: Moon },
  { to: '/reminders', label: 'Reminders', icon: Bell },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar(): React.ReactElement {
  const theme = useAppStore((s) => s.theme)
  const toggleTheme = useAppStore((s) => s.toggleTheme)

  return (
    <aside style={{
      width: 200,
      background: 'var(--bg-card)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0 0',
      flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.3px' }}>
          ScreenGuard
        </span>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: 2, flex: 1 }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-2)',
              background: isActive ? 'var(--accent-sub)' : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Theme toggle */}
      <div style={{ padding: '12px 12px 20px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 12px', borderRadius: 8, border: 'none',
            background: 'transparent', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-3)',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-row)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'
          }}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
      </div>
    </aside>
  )
}
