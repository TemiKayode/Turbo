import Image from 'next/image';
import Link from 'next/link';

type BrandMarkProps = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
};

const sizeMap = {
  sm: 36,
  md: 52,
  lg: 68,
} as const;

export default function BrandMark({ size = 'md', showWordmark = true, className }: BrandMarkProps) {
  const emblemSize = sizeMap[size];

  return (
    <Link href="/" className={['turbo-brandmark', `turbo-brandmark--${size}`, className].filter(Boolean).join(' ')}>
      <span className="turbo-brandmark__emblem">
        <Image
          src="/turbo-avi.png"
          alt="Turbo emblem"
          width={emblemSize}
          height={emblemSize}
          priority
          unoptimized
        />
      </span>
      {showWordmark && <span className="turbo-brandmark__word">Turbo</span>}
    </Link>
  );
}

