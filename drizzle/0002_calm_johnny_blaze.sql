ALTER TABLE `song_requests` ADD `termsAccepted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `song_requests` ADD `termsVersion` varchar(32) DEFAULT '2026-09-27' NOT NULL;