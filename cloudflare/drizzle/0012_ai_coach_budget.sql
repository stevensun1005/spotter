CREATE TABLE `ai_coach_budget` (
	`month` text NOT NULL,
	`owner` text NOT NULL,
	`charged_nanos` integer NOT NULL,
	PRIMARY KEY(`month`, `owner`),
	CONSTRAINT "ai_coach_budget_cap" CHECK("ai_coach_budget"."charged_nanos" BETWEEN 0 AND 10000000000)
);
