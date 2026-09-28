import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Drawer, Select } from 'antd';
import { formatDate } from '../utils/format.js';
import Icon from '../components/ui/Icons.jsx';
import './AppLayout.css';

const NAV_ICONS = {
  overview: 'dashboard',
  resources: 'resources',
  demand: 'visits',
  forecast: 'forecast',
  emergency: 'emergency',
  redistribution: 'redistribution',
  intelligence: 'intelligence',
  manage: 'resources',
  dashboard: 'dashboard',
};

function initials(name) {
  return String(name || 'BH')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function AppLayout({
  states = [],
  selectedState,
  onStateChange,
  asOf,
  onRefresh,
  refreshing,
  showStateSelect = false,
  session,
  onLogout,
  pageTitle = 'Bharat Health Grid',
  pageKicker = 'AI-Powered Federated Health Resource Intelligence for India',
  navItems = [],
  alertCount = 0,
  children,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeId, setActiveId] = useState(navItems[0]?.id || '');

  function activate(item) {
    setMenuOpen(false);
    if (item.href) {
      navigate(item.href);
      return;
    }
    setActiveId(item.id);
    document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function isActive(item) {
    if (item.href) {
      return location.pathname === item.href.split('#')[0] && (!item.href.includes('#') || location.hash === `#${item.href.split('#')[1]}`);
    }
    return activeId === item.id;
  }

  return (
    <div className="shell">
      {menuOpen ? <button type="button" className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}
      <aside className={`sidebar${menuOpen ? ' is-open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">BHG</span>
          <div>
            <div className="brand-name">Bharat Health Grid</div>
            <div className="brand-subtitle">Health intelligence</div>
          </div>
        </div>
        <nav className="side-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`side-link${isActive(item) ? ' is-active' : ''}`}
              onClick={() => activate(item)}
            >
              <Icon name={NAV_ICONS[item.id] || 'dashboard'} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="side-footer">
          {session ? (
            <div className="role-block">
              <strong>{session.roleLabel}</strong>
              <span>{session.scopeLabel}</span>
            </div>
          ) : null}
          <button type="button" onClick={() => setProfileOpen(true)}>
            <Icon name="settings" /> Settings
          </button>
          <button type="button" onClick={() => setProfileOpen(true)}>
            <Icon name="profile" /> User Profile
          </button>
          {onLogout ? (
            <button type="button" onClick={onLogout}>
              <Icon name="logout" /> Logout
            </button>
          ) : null}
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-title">
            <button type="button" className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}>
              <Icon name="menu" />
            </button>
            <div className="topbar-kicker">{pageKicker}</div>
            <h1>{pageTitle}</h1>
          </div>
          <div className="topbar-tools">
            {showStateSelect ? (
              <Select
                className="state-select"
                value={selectedState}
                onChange={onStateChange}
                options={[
                  { value: 'all', label: 'All states' },
                  ...states.map((state) => ({ value: state, label: state })),
                ]}
                aria-label="State"
              />
            ) : null}
            {asOf ? <span className="user-scope">Data as of {formatDate(asOf)}</span> : null}
            <button type="button" className="icon-button" aria-label="View alerts" onClick={() => document.getElementById('alerts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              <Icon name="bell" />
              {alertCount > 0 ? <span className="notify-count">{alertCount}</span> : null}
            </button>
            {session ? (
              <button type="button" className="user-chip" onClick={() => setProfileOpen(true)} aria-label="Open profile">
                <span className="avatar">{initials(session.name)}</span>
                <span className="user-copy">
                  <span className="user-name">{session.name}</span>
                  <span className="user-scope">{session.scopeLabel}</span>
                </span>
              </button>
            ) : null}
            <Button onClick={onRefresh} loading={refreshing}>Refresh</Button>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
      <Drawer
        title="Account"
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        size="default"
      >
        {session ? (
          <div className="profile-meta">
            <div><span>Name</span><strong>{session.name}</strong></div>
            <div><span>Role</span><strong>{session.roleLabel}</strong></div>
            <div><span>Scope</span><strong>{session.scopeLabel}</strong></div>
            <p>Your dashboard, data, and approvals follow this signed-in role and scope. This view does not change access.</p>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default AppLayout;
