export interface RoomPlayer {
  id: string;
  name: string;
  avatarCharacterId?: string;
  avatarAccessoryId?: string;
}

export const AVATAR_CHARACTER_IDS = ['bear', 'fox', 'frog', 'panda', 'cat', 'monster', 'unicorn', 'koala'] as const;
export const AVATAR_ACCESSORY_IDS = ['none', 'crown', 'hat', 'headphones', 'cap', 'flowers', 'glasses'] as const;
