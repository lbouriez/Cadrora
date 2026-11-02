import { ProgressivePhoto } from '../../src/app/components/ProgressivePhoto';

export function Photo({src,alt='',className='',contain=false}:{src:string;alt?:string;className?:string;contain?:boolean}) {
  return <ProgressivePhoto src={src} alt={alt} sizes="100vw" immediate fit={contain?'contain':'cover'} className={className}/>;
}
