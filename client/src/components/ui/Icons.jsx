function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.75',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    resources: <><path d="M8 3h8l1 4H7l1-4z" /><path d="M7 7h10v12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V7z" /><path d="M10 12h4" /></>,
    forecast: <><path d="M4 19V5" /><path d="M4 19h16" /><path d="M7 15l4-4 3 2 5-6" /></>,
    emergency: <><path d="M12 3l8 14H4L12 3z" /><path d="M12 10v4" /><path d="M12 16.5h.01" /></>,
    redistribution: <><path d="M7 7h11l-3-3" /><path d="M17 17H6l3 3" /></>,
    intelligence: <><path d="M12 3a6 6 0 0 0-3 11v2h6v-2a6 6 0 0 0-3-11z" /><path d="M9 19h6" /><path d="M10 21h4" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></>,
    profile: <><circle cx="12" cy="8" r="3" /><path d="M5 19c1.5-3 3.8-4.5 7-4.5S17.5 16 19 19" /></>,
    logout: <><path d="M10 6H6v12h4" /><path d="M10 12h9" /><path d="M16 9l3 3-3 3" /></>,
    bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 18a2 2 0 0 0 4 0" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    building: <><path d="M4 20V6l8-3 8 3v14" /><path d="M9 20v-6h6v6" /></>,
    beds: <><path d="M4 18V8M4 14h16v4M8 14V10h8v4M20 18V8" /></>,
    visits: <><path d="M5 19V9M12 19V5M19 19v-7" /></>,
    alert: <><circle cx="12" cy="12" r="8" /><path d="M12 8v5" /><path d="M12 16h.01" /></>,
  };
  return <svg {...common}>{paths[name] || paths.dashboard}</svg>;
}

export default Icon;
