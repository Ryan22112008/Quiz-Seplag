ALTER TABLE `Quiz` ADD COLUMN `deletedAt` DATETIME(3) NULL;

CREATE INDEX `Quiz_ownerId_deletedAt_idx` ON `Quiz`(`ownerId`, `deletedAt`);
