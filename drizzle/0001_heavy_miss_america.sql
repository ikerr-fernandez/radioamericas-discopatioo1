CREATE TABLE `song_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`songTitle` varchar(255) NOT NULL,
	`artist` varchar(255) NOT NULL,
	`album` varchar(255),
	`year` int,
	`requesterName` varchar(120),
	`course` varchar(80),
	`dedication` text,
	`sourceUrl` varchar(500),
	`status` enum('pending','selected','played','rejected') NOT NULL DEFAULT 'pending',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `song_requests_id` PRIMARY KEY(`id`)
);
