import type { ProblemLanguage } from "@/lib/types/session";

const LANG_ICON_SRC: Record<ProblemLanguage, string> = {
  java:   "/icons8-자바-커피-컵-로고.svg",
  python: "/icons8-파이썬.svg"
};

const LANG_LABEL: Record<ProblemLanguage, string> = {
  java:   "Java",
  python: "Python"
};

interface LangIconProps {
  language: ProblemLanguage;
  size?: number;
  showLabel?: boolean;
  className?: string;
}

export function LangIcon({ language, size = 14, showLabel = false, className }: LangIconProps) {
  return (
    <span className={`lang-icon-wrap${className ? ` ${className}` : ""}`}>
      <img
        src={LANG_ICON_SRC[language]}
        alt={LANG_LABEL[language]}
        width={size}
        height={size}
        style={{ display: "block", flexShrink: 0 }}
      />
      {showLabel && <span>{LANG_LABEL[language]}</span>}
    </span>
  );
}

export { LANG_LABEL };
