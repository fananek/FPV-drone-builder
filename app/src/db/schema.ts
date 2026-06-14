import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Enums (stored as TEXT with check constraints) ────────────────────────────

export const MAIN_CATEGORIES = [
  "FRAME",
  "ELECTRONICS",
  "PROPULSION",
  "ACCESSORIES",
  "OTHER",
] as const;
export type MainCategory = (typeof MAIN_CATEGORIES)[number];

export const SUB_CATEGORIES = [
  "FRAME",
  "FC",
  "ESC",
  "AIO",
  "VTX",
  "CAMERA",
  "RC_RECEIVER",
  "GPS",
  "MAGNETOMETER",
  "BUZZER",
  "BEC",
  "LED",
  "RACE_WIRE",
  "ANTENNA",
  "BATTERY_STRAP",
  "BATTERY",
  "PROPELLER",
  "MOTOR",
  "OTHER",
] as const;
export type SubCategory = (typeof SUB_CATEGORIES)[number];

export const ROLES = [
  "anonymous",
  "registered_user",
  "moderator",
  "metadata_admin",
  "system_admin",
  "api_client",
] as const;
export type Role = (typeof ROLES)[number];

export const WARNING_SEVERITIES = ["error", "warning", "info"] as const;
export type WarningSeverity = (typeof WARNING_SEVERITIES)[number];

export const BATTERY_CHEMISTRIES = ["LiPo", "LiHv", "LiIon"] as const;
export type BatteryChemistry = (typeof BATTERY_CHEMISTRIES)[number];

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique().notNull(),
  emailVerified: integer("emailVerified", { mode: "timestamp_ms" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  // Multi-role: stored as JSON array e.g. '["registered_user","metadata_admin"]'
  roles: text("roles", { mode: "json" })
    .$type<Role[]>()
    .notNull()
    .default(sql`'["registered_user"]'`),
  subscriptionStatus: text("subscription_status")
    .notNull()
    .default("free"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ─── Auth.js Required Tables ──────────────────────────────────────────────────

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    compoundKey: primaryKey({
      columns: [table.provider, table.providerAccountId],
    }),
  })
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    compoundKey: primaryKey({
      columns: [table.identifier, table.token],
    }),
  })
);

// ─── Parts ────────────────────────────────────────────────────────────────────

export const parts = sqliteTable(
  "parts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    manufacturer: text("manufacturer").notNull(),
    model: text("model").notNull(),
    weightGrams: real("weight_grams").notNull(),
    mainCategory: text("main_category").$type<MainCategory>().notNull(),
    subCategory: text("sub_category").$type<SubCategory>().notNull(),
    // Full JSON blob of category-specific attributes
    attributes: text("attributes", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'`),
    isComposite: integer("is_composite", { mode: "boolean" })
      .notNull()
      .default(false),
    // References to virtual sub-components for AIO boards
    integratedPartIds: text("integrated_part_ids", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    categoryIdx: index("parts_category_idx").on(
      table.mainCategory,
      table.subCategory
    ),
    archivedIdx: index("parts_archived_idx").on(table.isArchived),
  })
);

// ─── Thrust Test Data ─────────────────────────────────────────────────────────

export type ThrustTestPoint = {
  throttlePercent: number;
  currentAmps: number;
  thrustGrams: number;
  voltageVolts: number;
  rpm?: number;
};

export const thrustTestData = sqliteTable(
  "thrust_test_data",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    motorId: text("motor_id")
      .notNull()
      .references(() => parts.id),
    propellerId: text("propeller_id")
      .notNull()
      .references(() => parts.id),
    batteryCellCount: integer("battery_cell_count").notNull(),
    batteryChemistry: text("battery_chemistry")
      .$type<BatteryChemistry>()
      .notNull(),
    testPoints: text("test_points", { mode: "json" })
      .$type<ThrustTestPoint[]>()
      .notNull(),
    isEmpirical: integer("is_empirical", { mode: "boolean" })
      .notNull()
      .default(true),
    sourceLabel: text("source_label"),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    motorPropIdx: uniqueIndex("motor_prop_cell_chemistry_idx").on(
      table.motorId,
      table.propellerId,
      table.batteryCellCount,
      table.batteryChemistry
    ),
  })
);

// ─── Builds ───────────────────────────────────────────────────────────────────

export const builds = sqliteTable(
  "builds",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    anonymousSessionId: text("anonymous_session_id"),
    name: text("name").notNull(),
    description: text("description"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .default(sql`'[]'`),
    customPayloadWeightGrams: real("custom_payload_weight_grams")
      .notNull()
      .default(0),
    clonedFromBuildId: text("cloned_from_build_id"),
    averageRating: real("average_rating"),
    ratingCount: integer("rating_count").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    imageUrl: text("image_url"),
  },
  (table) => ({
    userNameIdx: uniqueIndex("builds_user_name_idx").on(
      table.userId,
      table.name
    ),
    publicIdx: index("builds_public_idx").on(table.isPublic),
  })
);

// ─── Custom Parts (user-entered parts not in the curated repository) ──────────

export const customParts = sqliteTable(
  "custom_parts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    manufacturer: text("manufacturer").notNull().default("Unknown"),
    model: text("model").notNull().default("Custom"),
    weightGrams: real("weight_grams").notNull(),
    mainCategory: text("main_category").$type<MainCategory>().notNull(),
    subCategory: text("sub_category").$type<SubCategory>().notNull(),
    // Flexible key-spec summary entered by the user (free-form JSON)
    keySpecs: text("key_specs", { mode: "json" })
      .$type<Record<string, string>>()
      .default(sql`'{}'`),
    isComposite: integer("is_composite", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    userIdx: index("custom_parts_user_idx").on(table.userId),
  })
);

// ─── Build Components ─────────────────────────────────────────────────────────
// A component references EITHER a curated part (partId) OR a custom part
// (customPartId). Exactly one must be non-null.

export const buildComponents = sqliteTable("build_components", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  buildId: text("build_id")
    .notNull()
    .references(() => builds.id, { onDelete: "cascade" }),
  // Curated repository part (null if using a custom part)
  partId: text("part_id").references(() => parts.id),
  // User-defined custom part (null if using a curated part)
  customPartId: text("custom_part_id").references(() => customParts.id, {
    onDelete: "set null",
  }),
  // Slot key e.g. "frame", "fc", "esc", "motor_1", "motor_2", "battery" etc.
  slot: text("slot").notNull(),
  quantity: integer("quantity").notNull().default(1),
  customNotes: text("custom_notes"),
});

// ─── Build Warnings ───────────────────────────────────────────────────────────

export const buildWarnings = sqliteTable("build_warnings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  buildId: text("build_id")
    .notNull()
    .references(() => builds.id, { onDelete: "cascade" }),
  warningCode: text("warning_code").notNull(),
  severity: text("severity").$type<WarningSeverity>().notNull(),
  message: text("message").notNull(),
  suggestedFix: text("suggested_fix"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

// ─── Build Ratings ────────────────────────────────────────────────────────────

export const buildRatings = sqliteTable(
  "build_ratings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    buildId: text("build_id")
      .notNull()
      .references(() => builds.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stars: integer("stars").notNull(),
    review: text("review"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => ({
    buildUserIdx: uniqueIndex("build_ratings_build_user_idx").on(
      table.buildId,
      table.userId
    ),
  })
);

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
export type CustomPart = typeof customParts.$inferSelect;
export type NewCustomPart = typeof customParts.$inferInsert;
export type Build = typeof builds.$inferSelect;
export type NewBuild = typeof builds.$inferInsert;
export type BuildComponent = typeof buildComponents.$inferSelect;
export type NewBuildComponent = typeof buildComponents.$inferInsert;
export type BuildWarning = typeof buildWarnings.$inferSelect;
export type ThrustTest = typeof thrustTestData.$inferSelect;
export type BuildRating = typeof buildRatings.$inferSelect;
