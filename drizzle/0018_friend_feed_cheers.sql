CREATE TABLE `friend_feed_cheers` (
	`recipient` text NOT NULL,
	`day` text NOT NULL,
	`sender` text NOT NULL,
	PRIMARY KEY(`recipient`, `day`, `sender`),
	CONSTRAINT "friend_feed_cheers_distinct_people" CHECK("friend_feed_cheers"."sender" <> "friend_feed_cheers"."recipient")
);
--> statement-breakpoint
CREATE INDEX `friend_feed_cheers_sender` ON `friend_feed_cheers` (`sender`);