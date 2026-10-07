ALTER TABLE `RoomPlayer`
  ADD COLUMN `userId` VARCHAR(191) NULL,
  ADD COLUMN `email` VARCHAR(191) NULL,
  ADD INDEX `RoomPlayer_userId_idx` (`userId`),
  ADD CONSTRAINT `RoomPlayer_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
