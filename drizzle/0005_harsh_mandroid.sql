CREATE TABLE `access_codes` (
	`code` varchar(32) NOT NULL,
	`usedAt` timestamp,
	CONSTRAINT `access_codes_code` PRIMARY KEY(`code`)
);
