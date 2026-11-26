CREATE TABLE `social_remarks` (
	`owner` text NOT NULL,
	`contact` text NOT NULL,
	`remark` text NOT NULL,
	PRIMARY KEY(`owner`, `contact`),
	FOREIGN KEY (`owner`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contact`) REFERENCES `spotter_access_accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "social_remark_contact" CHECK("social_remarks"."owner" <> "social_remarks"."contact"),
	CONSTRAINT "social_remark_length" CHECK(length("social_remarks"."remark") BETWEEN 1 AND 40)
);
--> statement-breakpoint
CREATE INDEX `social_remarks_contact` ON `social_remarks` (`contact`);