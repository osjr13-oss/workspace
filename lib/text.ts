const UNICODE_DASHES = /[\u2014\u2013\u2015\u2012\u2212]/g;
const MULTI_HYPHENS = /--+/g;
const SPACED_HYPHENS = /\s+-\s+/g;
const TRAILING_DASHES = /\s+-(?=[.,;:!?]|$)/g;
const LEADING_DASHES = /(^|[.,;:!?])\s+-\s*/g;

export function removeEmDashes(value: string): string {
  if (!value) return "";
  return value
    .replace(/\s*[\u2014\u2013\u2015\u2012\u2212]\s*/g, ", ")
    .replace(/\s*--+\s*/g, ", ")
    .replace(SPACED_HYPHENS, ", ")
    .replace(TRAILING_DASHES, "")
    .replace(LEADING_DASHES, "$1 ")
    .replace(UNICODE_DASHES, ", ")
    .replace(/,\s*,+/g, ",")
    .replace(/,\s*\./g, ".")
    .replace(/\s{2,}/g, " ");
}
