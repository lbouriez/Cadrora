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
