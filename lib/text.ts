const EM_DASH = /\u2014/g;

export function removeEmDashes(value: string): string {
  return value.replace(EM_DASH, "-");
}
