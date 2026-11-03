CREATE TABLE `calendars` (
	`id` text PRIMARY KEY NOT NULL,
	`read_hash` text NOT NULL,
	`edit_hash` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `months` (
	`key` text PRIMARY KEY NOT NULL,
	`calendar` text NOT NULL,
	`month` text NOT NULL,
	`ics` text NOT NULL
);
