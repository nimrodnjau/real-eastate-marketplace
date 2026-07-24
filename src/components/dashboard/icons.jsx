// Small stroke-icon set for the dashboards. Kept as plain inline SVG (same
// approach already used in PasswordField.jsx / CountrySelect.jsx) so no icon
// library needs to be installed.

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export function HomeIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9a1 1 0 0 0 1 1H10v-6h4v6h3.5a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function BuildingIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="4" y="3" width="11" height="18" />
      <rect x="15" y="8" width="5" height="13" />
      <path d="M7 7h1M11 7h1M7 11h1M11 11h1M7 15h1M11 15h1" />
    </svg>
  );
}

export function UsersIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="17" cy="8.5" r="2.4" />
      <path d="M15.5 14.8c2.6.4 4.5 2.3 4.5 5.2" />
    </svg>
  );
}

export function FileTextIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h8M8 9h3" />
    </svg>
  );
}

export function WalletIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="6" width="18" height="13" rx="1.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BellIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 10a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function ShieldCheckIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 5 5.5v6c0 4.6 3 7.7 7 9.5 4-1.8 7-4.9 7-9.5v-6L12 3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </svg>
  );
}

export function MapPinIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-6.5 7-11.5a7 7 0 1 0-14 0C5 14.5 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
  );
}

export function StarIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3Z" />
    </svg>
  );
}

export function TrendingUpIcon(props) {
  return (
    <svg {...base} {...props}>
      <polyline points="3 17 9.5 10.5 13.5 14.5 21 6" />
      <polyline points="14.5 6 21 6 21 12.5" />
    </svg>
  );
}

export function KeyIcon(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12 20 3M17 6l2 2M20 3l2 2" />
    </svg>
  );
}

export function LandmarkIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10h16M5 10v9M9 10v9M15 10v9M19 10v9M3 21h18M12 3 4 7h16L12 3Z" />
    </svg>
  );
}

export function ClipboardListIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5" y="4" width="14" height="17" rx="1.5" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <path d="M8.5 11h.01M8.5 15h.01M11.5 11h4M11.5 15h4" />
    </svg>
  );
}

export function MessageCircleIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M21 12a8.5 8.5 0 1 1-3.6-6.9L21 4l-1 3.6A8.4 8.4 0 0 1 21 12Z" />
    </svg>
  );
}

export function LogOutIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
      <path d="M14 8l4 4-4 4M18 12H9" />
    </svg>
  );
}

export function ChevronRightIcon(props) {
  return (
    <svg {...base} {...props}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

// The signature element: a stamped verification seal used for badges and
// empty states. Rotate the wrapper (see .stamp-badge in dashboard.css) to
// get the "pressed at an angle" feel.
export function StampIcon(props) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
      <circle cx="12" cy="12" r="9.2" />
      <circle cx="12" cy="12" r="6.8" strokeDasharray="1.5 2.2" />
      <path d="m8.7 12.2 2.1 2.1 4.3-4.6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const ICONS = {
  home: HomeIcon,
  building: BuildingIcon,
  users: UsersIcon,
  fileText: FileTextIcon,
  wallet: WalletIcon,
  bell: BellIcon,
  shieldCheck: ShieldCheckIcon,
  mapPin: MapPinIcon,
  star: StarIcon,
  trendingUp: TrendingUpIcon,
  key: KeyIcon,
  landmark: LandmarkIcon,
  clipboardList: ClipboardListIcon,
  messageCircle: MessageCircleIcon,
  logOut: LogOutIcon,
  chevronRight: ChevronRightIcon,
  stamp: StampIcon,
};

export function Icon({ name, ...props }) {
  const Cmp = ICONS[name] || FileTextIcon;
  return <Cmp {...props} />;
}