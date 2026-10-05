/** Keep only server-ranked podium places, preserving the server's order and values. */
export function selectPodiumEntries(entries) {
  return entries.filter((entry) => entry.position >= 1 && entry.position <= 3);
}
