import type { ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'gift'
  | 'list'
  | 'heart'
  | 'building'
  | 'bell'
  | 'settings'
  | 'alert-circle'
  | 'users'
  | 'globe'
  | 'briefcase'
  | 'bar-chart'
  | 'refresh'
  | 'inbox'
  | 'check-circle'
  | 'truck'
  | 'package'
  | 'clock'
  | 'shield-check'
  | 'camera'
  | 'share';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const ICON_PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10.5V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-8.5" />
    </>
  ),
  gift: (
    <>
      <rect x="4" y="9" width="16" height="11" rx="1" />
      <path d="M4 9h16" />
      <path d="M12 9v11" />
      <path d="M12 9c-1.5-4-6-4-6-1s3 1 6 1" />
      <path d="M12 9c1.5-4 6-4 6-1s-3 1-6 1" />
    </>
  ),
  list: (
    <>
      <line x1="9" y1="6" x2="20" y2="6" />
      <line x1="9" y1="12" x2="20" y2="12" />
      <line x1="9" y1="18" x2="20" y2="18" />
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  heart: (
    <path d="M12 20s-7-4.35-9.5-9C.87 7.34 3 4 6.5 4c2 0 3.5 1.5 5.5 3.5C14 5.5 15.5 4 17.5 4 21 4 23.13 7.34 21.5 11 19 15.65 12 20 12 20Z" />
  ),
  building: (
    <>
      <rect x="5" y="3" width="9" height="18" />
      <rect x="8" y="7" width="2" height="2" fill="currentColor" stroke="none" />
      <rect x="8" y="12" width="2" height="2" fill="currentColor" stroke="none" />
      <path d="M14 21v-6h5v6" />
    </>
  ),
  bell: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </>
  ),
  settings: (
    <>
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="7" cy="18" r="2" />
    </>
  ),
  'alert-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M15 14.2c2.9.4 5 2.9 5 5.8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.7-3.8-9s1.3-6.5 3.8-9Z" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="1.5" />
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="3" y1="13" x2="21" y2="13" />
    </>
  ),
  'bar-chart': (
    <>
      <line x1="5" y1="20" x2="5" y2="12" />
      <line x1="12" y1="20" x2="12" y2="6" />
      <line x1="19" y1="20" x2="19" y2="15" />
    </>
  ),
  refresh: (
    <>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 8" />
      <polyline points="20 3 20 8 15 8" />
      <path d="M20 12a8 8 0 0 1-14 5.3L4 16" />
      <polyline points="4 21 4 16 9 16" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 12h4l2 3h4l2-3h4" />
      <path d="M5.5 5h13l1.5 7v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6z" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </>
  ),
  truck: (
    <>
      <rect x="2" y="8" width="12" height="9" rx="1" />
      <path d="M14 11h4l3 3.5V17h-7" />
      <circle cx="6.5" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
    </>
  ),
  package: (
    <>
      <path d="M12 3 4 7v10l8 4 8-4V7Z" />
      <path d="M4 7l8 4 8-4" />
      <line x1="12" y1="11" x2="12" y2="21" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </>
  ),
  'shield-check': (
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" />
      <polyline points="8.5 12 11 14.5 15.5 9.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" />
      <circle cx="12" cy="14" r="3" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <line x1="8.3" y1="10.7" x2="15.7" y2="6.3" />
      <line x1="8.3" y1="13.3" x2="15.7" y2="17.7" />
    </>
  ),
};
