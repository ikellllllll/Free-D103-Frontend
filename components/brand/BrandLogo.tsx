type BrandLogoVariant = "primary" | "primary-word";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  height?: number;
  className?: string;
}

const SRCS: Record<BrandLogoVariant, { light: string; dark: string }> = {
  "primary":      { light: "/brand/logo-primary-light.svg",       dark: "/brand/logo-primary-dark.svg" },
  "primary-word": { light: "/brand/logo-primary-word-light.svg",  dark: "/brand/logo-primary-word-dark.svg" },
};

export function BrandLogo({ variant = "primary", height = 28, className }: BrandLogoProps) {
  const { light, dark } = SRCS[variant];

  return (
    <span
      className={`brand-logo${className ? ` ${className}` : ""}`}
      aria-label="AIG"
      role="img"
      style={{ display: "inline-flex", lineHeight: 0 }}
    >
      <img src={light} alt="" aria-hidden height={height} style={{ height, width: "auto" }} className="brand-logo__light" />
      <img src={dark}  alt="" aria-hidden height={height} style={{ height, width: "auto" }} className="brand-logo__dark" />
    </span>
  );
}
