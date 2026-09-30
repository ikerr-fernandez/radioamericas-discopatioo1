CREATE TABLE `site_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`rating` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `site_feedback_id` PRIMARY KEY(`id`)
);
