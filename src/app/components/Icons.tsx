import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

function iconProps(props: IconProps): IconProps {
  return {
    'aria-hidden': true,
    focusable: 'false',
    viewBox: '0 0 24 24',
    ...props,
  };
}

export function CloseIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
}

export function ChevronLeftIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m15 18-6-6 6-6" /></svg>;
}

export function ChevronRightIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m9 18 6-6-6-6" /></svg>;
}

export function InfoIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

export function LanguageIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c-2.4 2.4-3.5 5.4-3.5 9s1.1 6.6 3.5 9m0-18c2.4 2.4 3.5 5.4 3.5 9s-1.1 6.6-3.5 9" />
    </svg>
  );
}

export function DownloadIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" /></svg>;
}

export function HeartIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M20.8 8.2c0 4.2-5.4 8.3-8.8 10.8C8.6 16.5 3.2 12.4 3.2 8.2a4.4 4.4 0 0 1 8.8-.1 4.4 4.4 0 0 1 8.8.1Z" /></svg>;
}

export function RetouchIcon(props: IconProps) {
  return <svg {...iconProps(props)}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></svg>;
}

export function LockIcon(props: IconProps) {
  return <svg {...iconProps(props)}><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}

export function CloudIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M7 18a5 5 0 1 1 1-9.9A7 7 0 0 1 21 11a3.5 3.5 0 0 1-1.5 7H7Z" /></svg>;
}

export function CheckIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m5 12 4 4L19 6" /></svg>;
}

export function KeyIcon(props: IconProps) {
  return <svg {...iconProps(props)}><circle cx="16" cy="8" r="5" /><path d="m12.5 11.5-9 9H7v-3h3v-3" /></svg>;
}
