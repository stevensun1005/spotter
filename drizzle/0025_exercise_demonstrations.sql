CREATE TABLE `exercise_demonstrations` (
	`owner` text NOT NULL,
	`exercise_key` text NOT NULL,
	`gif` text NOT NULL,
	PRIMARY KEY(`owner`, `exercise_key`),
	FOREIGN KEY (`owner`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "exercise_demo_gif_size" CHECK(length("exercise_demonstrations"."gif") BETWEEN 4 AND 1048576)
);
