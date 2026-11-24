CREATE TABLE `ai_coach_quota` (
	`day` integer NOT NULL,
	`owner` text NOT NULL,
	`requests` integer NOT NULL,
	PRIMARY KEY(`day`, `owner`)
);
