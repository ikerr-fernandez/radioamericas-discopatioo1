CREATE TABLE `active_visitors` (
	`sessionId` varchar(64) NOT NULL,
	`ipHash` varchar(128),
	`deviceType` varchar(32),
	`browser` varchar(80),
	`lastSeen` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `active_visitors_sessionId` PRIMARY KEY(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `request_activity` (
	`requestId` int NOT NULL,
	`ipHash` varchar(128),
	`deviceType` varchar(32),
	`browser` varchar(80),
	`accessCodeUsed` boolean NOT NULL DEFAULT false,
	CONSTRAINT `request_activity_requestId` PRIMARY KEY(`requestId`)
);
