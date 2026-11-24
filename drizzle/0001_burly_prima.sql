CREATE TABLE `workout_heart` (
	`owner` text NOT NULL,
	`workout_id` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`owner`, `workout_id`),
	FOREIGN KEY (`owner`,`workout_id`) REFERENCES `entries`(`owner`,`id`) ON UPDATE no action ON DELETE cascade
);
