interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return <section className={`card ${className}`.trim()}>{children}</section>;
}
