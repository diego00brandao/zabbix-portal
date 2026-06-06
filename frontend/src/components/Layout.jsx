import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/',            icon: '▦', label: 'Dashboard',   roles: ['admin','manager','viewer'] },
  { to: '/hosts',       icon: '⬡', label: 'Servidores',  roles: ['admin','manager','viewer'] },
  { to: '/groups',      icon: '⊞', label: 'Grupos',      roles: ['admin','manager'] },
  { to: '/templates',   icon: '◫', label: 'Templates',   roles: ['admin','manager','viewer'] },
  { to: '/triggers',    icon: '◉', label: 'Alertas',     roles: ['admin','manager','viewer'] },
  { to: '/items',       icon: '≡', label: 'Itens',       roles: ['admin','manager','viewer'] },
  { to: '/alltriggers', icon: '⊡', label: 'Triggers',    roles: ['admin','manager','viewer'] },
  { to: '/reports',     icon: '↯', label: 'Relatórios',  roles: ['admin','manager','viewer'] },
  { to: '/audit',       icon: '⊕', label: 'Audit Log',   roles: ['admin','manager'] },
];

const ADMIN_NAV = [
  { to: '/admin/users',        icon: '⊙', label: 'Usuários'   },
  { to: '/admin/areas',        icon: '⊞', label: 'Áreas'      },
  { to: '/admin/connections',  icon: '⇌', label: 'Conexões'   },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const roleLabel = { admin: 'Administrador', viewer: 'Visualizador' };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{ ...styles.sidebar, width: collapsed ? '56px' : '220px' }}>
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarLogo}>◈</span>
          {!collapsed && <div><div style={styles.sidebarTitle}>Monitoração</div><div style={styles.sidebarSub}>Portal</div></div>}
          <button onClick={() => setCollapsed(c => !c)} style={styles.collapseBtn}>{collapsed ? '›' : '‹'}</button>
        </div>
        <nav style={styles.nav}>
          {NAV.filter(item => item.roles.includes(user?.role)).map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}
              style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}
              title={collapsed ? item.label : ''}>
              <span style={styles.navIcon}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          {user?.role === 'admin' && (<>
            {!collapsed && <div style={styles.navDivider}>Administração</div>}
            {collapsed && <div style={{ ...styles.navDivider, textAlign: 'center' }}>─</div>}
            {ADMIN_NAV.map(item => (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) })}
                title={collapsed ? item.label : ''}>
                <span style={styles.navIcon}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            ))}
          </>)}
        </nav>
        <div style={styles.userInfo}>
          <div style={{ ...styles.userAvatar, background: user?.areaColor ? `${user.areaColor}22` : 'var(--gold-dim)', borderColor: user?.areaColor ? `${user.areaColor}44` : 'rgba(201,168,76,0.2)' }}>
            {user?.fullName?.[0]?.toUpperCase() || '?'}
          </div>
          {!collapsed && (<>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.userName}>{user?.fullName?.split(' ')[0]}</div>
              <div style={styles.userRole}>{roleLabel[user?.role] || user?.role}</div>
              {user?.areaName && <div style={styles.userArea}>{user.areaName}</div>}
            </div>
            <button onClick={handleLogout} style={styles.logoutBtn} title="Sair">⏻</button>
          </>)}
        </div>
      </aside>
      <main style={styles.main}><Outlet /></main>
    </div>
  );
}

const styles = {
  sidebar: { background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0, position: 'relative', zIndex: 10 },
  sidebarHeader: { display: 'flex', alignItems: 'center', gap: '10px', padding: '20px 14px 16px', borderBottom: '1px solid var(--border)' },
  sidebarLogo: { fontSize: '20px', color: 'var(--gold)', fontFamily: 'var(--font-display)', flexShrink: 0 },
  sidebarTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-accent)', lineHeight: 1.2 },
  sidebarSub: { fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' },
  collapseBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px', padding: '2px 4px', borderRadius: '4px', flexShrink: 0, lineHeight: 1 },
  nav: { flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' },
  navItem: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: 500, transition: 'background var(--transition), color var(--transition)', whiteSpace: 'nowrap', overflow: 'hidden' },
  navItemActive: { background: 'var(--gold-dim)', color: 'var(--gold)' },
  navIcon: { fontSize: '15px', flexShrink: 0, width: '18px', textAlign: 'center' },
  navDivider: { fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 10px 4px' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 10px', borderTop: '1px solid var(--border)', overflow: 'hidden' },
  userAvatar: { width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: 'var(--gold)', border: '1px solid', flexShrink: 0 },
  userName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  userRole: { fontSize: '11px', color: 'var(--text-muted)' },
  userArea: { fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' },
  logoutBtn: { background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '15px', padding: '4px', borderRadius: '4px', flexShrink: 0 },
  main: { flex: 1, overflowY: 'auto', background: 'var(--bg-base)' },
};
