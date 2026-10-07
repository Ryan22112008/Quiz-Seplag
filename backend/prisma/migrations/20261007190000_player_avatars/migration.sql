ALTER TABLE `RoomPlayer`
  ADD COLUMN `avatarCharacterId` VARCHAR(24) NOT NULL DEFAULT 'bear',
  ADD COLUMN `avatarAccessoryId` VARCHAR(24) NOT NULL DEFAULT 'none';
