CREATE TABLE `NotificationEmailSubscription` (
 `id` VARCHAR(191) NOT NULL, `organizationId` VARCHAR(191) NOT NULL, `userId` VARCHAR(191) NOT NULL,
 `enabled` BOOLEAN NOT NULL DEFAULT false, `subjectTemplate` VARCHAR(191) NOT NULL DEFAULT '[OyamaCRM] {title}',
 `minimumSeverity` VARCHAR(191) NOT NULL DEFAULT 'ALL', `enabledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `updatedAt` DATETIME(3) NOT NULL,
 UNIQUE INDEX `NotificationEmailSubscription_userId_key` (`userId`), INDEX `NotificationEmailSubscription_organizationId_enabled_idx` (`organizationId`,`enabled`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE `NotificationEmailDelivery` (
 `id` VARCHAR(191) NOT NULL, `subscriptionId` VARCHAR(191) NOT NULL, `notificationId` VARCHAR(191) NOT NULL,
 `status` VARCHAR(191) NOT NULL DEFAULT 'SENDING', `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `completedAt` DATETIME(3) NULL,
 UNIQUE INDEX `NotificationEmailDelivery_subscriptionId_notificationId_key` (`subscriptionId`,`notificationId`), PRIMARY KEY (`id`),
 CONSTRAINT `NotificationEmailDelivery_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `NotificationEmailSubscription` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT `NotificationEmailDelivery_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
