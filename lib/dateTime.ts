const TIME_ZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/i;
const FRACTION_OVERFLOW_RE = /(\.\d{3})\d+(?=(Z|[+-]\d{2}:?\d{2})?$)/i;

const toDateInput = (value: string) => {
  const trimmed = value.trim();
  return trimmed.replace(FRACTION_OVERFLOW_RE, "$1");
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
