import Image from 'next/image';
import Link from 'next/link';

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: { logo: 32, avi: 24 },
  md: { logo: 48, avi: 32 },
  lg: { logo: 64, avi: 40 },
} as const;

export default function BrandMark({ size = 'md', showWordmark = true, className }: BrandMarkProps) {
  const dims = sizeMap[size];

  return (
    <Link href="/" className={['turbo-brandmark', `turbo-brandmark--${size}`, className].filter(Boolean).join(' ')}>
      <span className="turbo-brandmark__logos">
        <span className="turbo-brandmark__logo">
          <Image
            src="/turbo-logo.png"
            alt="Turbo logo"
            width={dims.logo}
            height={dims.logo}
            priority
            unoptimized
          />
        </span>
        <span className="turbo-brandmark__avi">
          <Image
            src="/turbo-avi.png"
            alt="Turbo identity"
            width={dims.avi}
            height={dims.avi}
            priority
            unoptimized
          />
        </span>
      </span>
      {showWordmark && <span className="turbo-brandmark__word">Turbo</span>}
    </Link>
  );
}


