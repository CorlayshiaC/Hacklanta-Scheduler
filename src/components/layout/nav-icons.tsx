import type { SVGAttributes } from "react";

export type NavIconKey =
  | "coverage"
  | "my-schedule"
  | "availability"
  | "shifts"
  | "events"
  | "calendar"
  | "swaps"
  | "settings";

type IconProps = SVGAttributes<SVGSVGElement>;

function Base(props: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 20 20"
      width="18"
      {...props}
    />
  );
}

function CoverageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="3.5" width="6" height="6" rx="1.5" />
      <rect x="2.5" y="10.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="10.5" width="6" height="6" rx="1.5" />
    </Base>
  );
}

function MyScheduleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 7v3.5l2.5 1.5" />
    </Base>
  );
}

function AvailabilityIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="4" width="15" height="13" rx="2" />
      <path d="M2.5 8h15" />
      <circle cx="6.5" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="11.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="6.5" cy="14" r="0.9" fill="currentColor" stroke="none" />
    </Base>
  );
}

function ShiftsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M10 3.5v13" />
      <path d="M3.5 10h13" />
    </Base>
  );
}

function EventsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 3.5v3M16 3.5v3" />
      <rect x="2.5" y="4.5" width="15" height="12.5" rx="2" />
      <path d="M2.5 9h15" />
      <path d="M6.5 12.5h2" />
    </Base>
  );
}

function CalendarIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 3.5v3M16 3.5v3" />
      <rect x="2.5" y="4.5" width="15" height="12.5" rx="2" />
      <path d="M2.5 9h15" />
      <rect x="5.5" y="11" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
    </Base>
  );
}

function SwapsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7.5h11" />
      <path d="M12 4.5l3 3-3 3" />
      <path d="M16 12.5H5" />
      <path d="M8 9.5l-3 3 3 3" />
    </Base>
  );
}

function SettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10" cy="10" r="2.5" />
      <path d="M10 3.5v2M10 14.5v2M16.5 10h-2M5.5 10h-2M14.6 5.4l-1.4 1.4M6.8 13.2l-1.4 1.4M14.6 14.6l-1.4-1.4M6.8 6.8L5.4 5.4" />
    </Base>
  );
}

export const NAV_ICONS: Record<NavIconKey, (props: IconProps) => React.JSX.Element> = {
  coverage: CoverageIcon,
  "my-schedule": MyScheduleIcon,
  availability: AvailabilityIcon,
  shifts: ShiftsIcon,
  events: EventsIcon,
  calendar: CalendarIcon,
  swaps: SwapsIcon,
  settings: SettingsIcon,
};
