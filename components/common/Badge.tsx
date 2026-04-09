interface BadgeProps {
  children: React.ReactNode;
  tone?:
    | "neutral"
    | "accent"
    | "teal"
    | "green"
    | "amber"
    | "red"
    | "level1"
    | "level2"
    | "level3";
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}
