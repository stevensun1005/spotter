CREATE TABLE `spotter_account_avatars` (
	`owner` text PRIMARY KEY NOT NULL,
	`image` text NOT NULL,
	FOREIGN KEY (`owner`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "spotter_avatar_image_length" CHECK(length("spotter_account_avatars"."image") BETWEEN 4 AND 80000)
);
