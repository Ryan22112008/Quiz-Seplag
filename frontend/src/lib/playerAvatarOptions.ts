export const avatarCharacters = [
  { id: 'bear', label: 'Ursinho', emoji: '🐻' },
  { id: 'fox', label: 'Raposa', emoji: '🦊' },
  { id: 'frog', label: 'Sapo', emoji: '🐸' },
  { id: 'panda', label: 'Panda', emoji: '🐼' },
  { id: 'cat', label: 'Gatinho', emoji: '🐱' },
  { id: 'monster', label: 'Monstrinho', emoji: '👾' },
  { id: 'unicorn', label: 'Unicórnio', emoji: '🦄' },
  { id: 'koala', label: 'Coala', emoji: '🐨' },
] as const;

export const avatarAccessories = [
  { id: 'none', label: 'Sem acessório', emoji: '' },
  { id: 'crown', label: 'Coroa', emoji: '👑' },
  { id: 'hat', label: 'Chapéu', emoji: '🎩' },
  { id: 'headphones', label: 'Fones', emoji: '🎧' },
  { id: 'cap', label: 'Boné', emoji: '🧢' },
  { id: 'flowers', label: 'Flores', emoji: '🌼' },
  { id: 'glasses', label: 'Óculos', emoji: '🤓' },
] as const;

export type AvatarCharacterId = typeof avatarCharacters[number]['id'];
export type AvatarAccessoryId = typeof avatarAccessories[number]['id'];
export const DEFAULT_AVATAR_CHARACTER: AvatarCharacterId = 'bear';
export const DEFAULT_AVATAR_ACCESSORY: AvatarAccessoryId = 'none';
export function characterEmoji(id?: string | null) { return avatarCharacters.find((item) => item.id === id)?.emoji ?? avatarCharacters[0].emoji; }
export function accessoryEmoji(id?: string | null) { return avatarAccessories.find((item) => item.id === id)?.emoji ?? ''; }
