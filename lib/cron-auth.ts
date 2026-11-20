/** True when the request carries the scheduled-job password (CRON_SECRET). Compares in constant time. */
export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  // Always walk the longer string so the time taken does not reveal how much matched.
  let difference = given.length ^ expected.length;
  const length = Math.max(given.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (given.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}
