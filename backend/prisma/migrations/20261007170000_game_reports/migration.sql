CREATE TABLE `GameReport` (
    `id` VARCHAR(128) NOT NULL,
    `quizId` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `roomPin` CHAR(6) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `finishedAt` DATETIME(3) NOT NULL,
    `durationSeconds` INTEGER NOT NULL,
    `participantCount` INTEGER NOT NULL,
    `questionCount` INTEGER NOT NULL,
    `totalAnswers` INTEGER NOT NULL,
    `correctAnswers` INTEGER NOT NULL,
    `accuracyRate` INTEGER NOT NULL,
    `details` JSON NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GameReport_quizId_finishedAt_idx`(`quizId`, `finishedAt`),
    INDEX `GameReport_deletedAt_finishedAt_idx`(`deletedAt`, `finishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `GameReport` ADD CONSTRAINT `GameReport_quizId_fkey` FOREIGN KEY (`quizId`) REFERENCES `Quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `GameReport` ADD CONSTRAINT `GameReport_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
