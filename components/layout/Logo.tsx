import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Altura del escudo en px */
  height?: number;
}

/** Escudo Salgado — solo icono, sin manchas. */
export default function Logo({ className = "", height = 66 }: LogoProps) {
  const width = Math.round(height * (617 / 576));

  return (
    <Link
      href="/"
      aria-label="Salgado Automotriz"
      className={cn("inline-flex shrink-0 items-center leading-none", className)}
    >
      <Image
        src="/logo-salgado-transparent.png?v=12"
        alt="Salgado Automotriz"
        width={width}
        height={height}
        priority
        unoptimized
        className="block object-contain"
        style={{ width, height }}
      />
    </Link>
  );
}
