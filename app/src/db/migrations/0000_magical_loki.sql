CREATE TABLE `accounts` (
	`userId` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`providerAccountId` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	PRIMARY KEY(`provider`, `providerAccountId`),
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `build_components` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text NOT NULL,
	`part_id` text,
	`custom_part_id` text,
	`slot` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`custom_notes` text,
	FOREIGN KEY (`build_id`) REFERENCES `builds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`custom_part_id`) REFERENCES `custom_parts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `build_ratings` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text NOT NULL,
	`user_id` text NOT NULL,
	`stars` integer NOT NULL,
	`review` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`build_id`) REFERENCES `builds`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `build_ratings_build_user_idx` ON `build_ratings` (`build_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `build_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`build_id` text NOT NULL,
	`warning_code` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`suggested_fix` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`build_id`) REFERENCES `builds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `builds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`anonymous_session_id` text,
	`name` text NOT NULL,
	`description` text,
	`is_public` integer DEFAULT false NOT NULL,
	`tags` text DEFAULT '[]',
	`custom_payload_weight_grams` real DEFAULT 0 NOT NULL,
	`cloned_from_build_id` text,
	`average_rating` real,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`deleted_at` integer,
	`image_url` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `builds_user_name_idx` ON `builds` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `builds_public_idx` ON `builds` (`is_public`);--> statement-breakpoint
CREATE TABLE `custom_parts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text DEFAULT 'Unknown' NOT NULL,
	`model` text DEFAULT 'Custom' NOT NULL,
	`weight_grams` real NOT NULL,
	`main_category` text NOT NULL,
	`sub_category` text NOT NULL,
	`key_specs` text DEFAULT '{}',
	`is_composite` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `custom_parts_user_idx` ON `custom_parts` (`user_id`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`manufacturer` text NOT NULL,
	`model` text NOT NULL,
	`weight_grams` real NOT NULL,
	`main_category` text NOT NULL,
	`sub_category` text NOT NULL,
	`attributes` text DEFAULT '{}' NOT NULL,
	`is_composite` integer DEFAULT false NOT NULL,
	`integrated_part_ids` text DEFAULT '[]',
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `parts_category_idx` ON `parts` (`main_category`,`sub_category`);--> statement-breakpoint
CREATE INDEX `parts_archived_idx` ON `parts` (`is_archived`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`sessionToken` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `thrust_test_data` (
	`id` text PRIMARY KEY NOT NULL,
	`motor_id` text NOT NULL,
	`propeller_id` text NOT NULL,
	`battery_cell_count` integer NOT NULL,
	`battery_chemistry` text NOT NULL,
	`test_points` text NOT NULL,
	`is_empirical` integer DEFAULT true NOT NULL,
	`source_label` text,
	`is_archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`motor_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`propeller_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `motor_prop_cell_chemistry_idx` ON `thrust_test_data` (`motor_id`,`propeller_id`,`battery_cell_count`,`battery_chemistry`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer,
	`image` text,
	`password_hash` text,
	`roles` text DEFAULT '["registered_user"]' NOT NULL,
	`subscription_status` text DEFAULT 'free' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL,
	PRIMARY KEY(`identifier`, `token`)
);
