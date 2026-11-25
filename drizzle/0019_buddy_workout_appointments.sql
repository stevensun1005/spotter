CREATE TABLE `buddy_workout_appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`starts_at` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	FOREIGN KEY (`room`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "buddy_workout_appointments_distinct_people" CHECK("buddy_workout_appointments"."sender" <> "buddy_workout_appointments"."recipient")
);
--> statement-breakpoint
CREATE INDEX `buddy_workout_appointments_room_starts` ON `buddy_workout_appointments` (`room`,`starts_at`);--> statement-breakpoint
CREATE INDEX `buddy_workout_appointments_recipient` ON `buddy_workout_appointments` (`recipient`);