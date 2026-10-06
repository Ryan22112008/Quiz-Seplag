ALTER TABLE `User`
    MODIFY `googleId` VARCHAR(191) NULL,
    ADD COLUMN `passwordHash` VARCHAR(255) NULL,
    ADD COLUMN `emailVerifiedAt` DATETIME(3) NULL;

CREATE TABLE `EmailVerificationToken` (
    `id` CHAR(64) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `pendingPasswordHash` VARCHAR(255) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `EmailVerificationToken_userId_idx`(`userId`),
    INDEX `EmailVerificationToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
