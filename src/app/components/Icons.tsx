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
