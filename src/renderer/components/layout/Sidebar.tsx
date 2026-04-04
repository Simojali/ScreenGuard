import React from 'react'
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, BarChart2, Clock, Moon } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/reports', label: 'Reports', icon: BarChart2 },
  { to: '/limits', label: 'App Limits', icon: Clock },
  { to: '/downtime', label: 'Downtime', icon: Moon },
]

export default function Sidebar(): React.ReactElement {
  return (
    <aside style={{
      width: 200,
      background: '#1a1d2e',
      borderRight: '1px solid #2d3148',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 0',
      flexShrink: 0,
    }}>
      <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #2d3148' }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#7c8cf8', letterSpacing: '-0.3px' }}>
          ScreenGuard
        </span>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: 2 }}>
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
              color: isActive ? '#7c8cf8' : '#94a3b8',
              background: isActive ? 'rgba(124,140,248,0.12)' : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
