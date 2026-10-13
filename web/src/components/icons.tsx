type IconProps = { className?: string };

function Icon({ className = "h-4 w-4", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {children}
    </svg>
  );
}

export const Check = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const ChevronRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 6l6 6-6 6" />
  </Icon>
);

export const ArrowUpRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 17L17 7M8 7h9v9" />
  </Icon>
);

export const UserCheck = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    <path d="M16 10.5l2 2 3.5-4" />
  </Icon>
);

export const Users = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8.5" cy="8" r="3.5" />
    <path d="M2 20c.6-3.4 3.2-5.5 6.5-5.5S14.4 16.6 15 20" />
    <path d="M15.5 4.7a3.5 3.5 0 010 6.6M17.5 14.8c2.3.6 4 2.5 4.5 5.2" />
  </Icon>
);

export const Coins = (props: IconProps) => (
  <Icon {...props}>
    <ellipse cx="12" cy="7" rx="7" ry="3" />
    <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" />
    <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
  </Icon>
);

export const Shield = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3l7 3v5.5c0 4.3-2.9 7.8-7 9.5-4.1-1.7-7-5.2-7-9.5V6l7-3z" />
  </Icon>
);

export const Zap = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z" />
  </Icon>
);

export const TrendingUp = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
);

export const Lock = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 018 0v3" />
  </Icon>
);

export const Copy = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 012-2h9" />
  </Icon>
);

/** Two linked rings on the accent tile: the product mark. */
export function LogoMark({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={`shrink-0 ${className}`}>
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <circle cx="13" cy="16" r="5.5" fill="none" strokeWidth="2.5" className="stroke-accent-foreground" />
      <circle cx="19" cy="16" r="5.5" fill="none" strokeWidth="2.5" className="stroke-accent-foreground" />
    </svg>
  );
}
