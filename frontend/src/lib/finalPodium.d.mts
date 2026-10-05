export interface PodiumEntry {
  position: number;
}

export function selectPodiumEntries<T extends PodiumEntry>(entries: readonly T[]): T[];
