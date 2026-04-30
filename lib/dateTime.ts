const ISO_WITH_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const TIME_ZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/i;

const toDateInput = (value: string) => {
  const trimmed = value.trim();
  const withZone =
    ISO_WITH_TIME_RE.test(trimmed) && !TIME_ZONE_SUFFIX_RE.test(trimmed)
      ? `${trimmed}Z`
      : trimmed;

  return withZone.replace(/(\.\d{3})\d+(?=(Z|[+-]\d{2}:?\d{2})$)/i, "$1");
};

export const parseApiDateTime = (value?: string | null) => {
  if (!value) return null;

  const date = new Date(toDateInput(value));
  return Number.isFinite(date.getTime()) ? date : null;
};

export const normalizeApiDateTime = (value?: string | null) => {
  const date = parseApiDateTime(value);
  return date ? date.toISOString() : value ?? null;
};
