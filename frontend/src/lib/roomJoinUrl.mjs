const PIN_PATTERN = /^\d{6}$/;

/** Resolve a room PIN from the existing path route or the QR query string. */
export function resolveRoomPin(routePin, queryPin) {
  const pin = (routePin ?? queryPin ?? '').trim();
  return PIN_PATTERN.test(pin) ? pin : null;
}

/** Build a public player URL from the frontend's current origin. */
export function buildRoomJoinUrl(pin, origin) {
  if (!PIN_PATTERN.test(pin)) throw new Error('O PIN da sala deve conter exatamente 6 dígitos.');
  const url = new URL('/join', origin);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('A origem do frontend deve usar HTTP ou HTTPS.');
  url.searchParams.set('pin', pin);
  return url.toString();
}
