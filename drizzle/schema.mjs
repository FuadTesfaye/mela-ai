/** Typed ORM schema for the existing SQL-managed database.
 * Install drizzle-orm/drizzle-kit before using. Do not push this schema to production:
 * migrations/ and schema_migrations remain the authoritative migration history.
 */
import {
  pgTable,
  primaryKey,
  text,
  uuid,
  jsonb,
  boolean,
  integer,
  bigint,
  bigserial,
  timestamp,
  numeric,
} from "drizzle-orm/pg-core";
const time = (name) => timestamp(name, { withTimezone: true });
export const schemaMigrations = pgTable("schema_migrations", {
  name: text("name").primaryKey(),
  appliedAt: time("applied_at").defaultNow(),
});
export const sections = pgTable("sections", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  url: text("url").notNull(),
  language: text("language", { enum: ["en", "am", "om", "ti"] }).notNull(),
  courseId: text("course_id"),
  keywords: jsonb("keywords").notNull().default([]),
});
export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  language: text("language").notNull(),
  status: text("status", { enum: ["queued", "active", "resolved"] })
    .notNull()
    .default("queued"),
  kind: text("kind").notNull().default("learning"),
  conversation: jsonb("conversation").notNull().default([]),
  context: jsonb("context"),
  screenshot: text("screenshot"),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const tutorMessages = pgTable("tutor_messages", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const jobs = pgTable("jobs", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  channel: text("channel", { enum: ["telegram", "sms"] }).notNull(),
  destination: text("destination").notNull(),
  language: text("language", { enum: ["en", "am", "om", "ti"] }).notNull(),
  keywords: text("keywords").notNull().default(""),
  verified: boolean("verified").notNull().default(false),
  verificationHash: text("verification_hash"),
  verificationExpires: time("verification_expires"),
  active: boolean("active").notNull().default(true),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const alertDeliveries = pgTable(
  "alert_deliveries",
  {
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscriptions.id, {
        onDelete: "cascade",
      }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    retryAt: time("retry_at").notNull().defaultNow(),
    leaseUntil: time("lease_until"),
  },
  (table) => [primaryKey({ columns: [table.subscriptionId, table.jobId] })],
);
export const shareSessions = pgTable("share_sessions", {
  id: uuid("id").primaryKey(),
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => tickets.id, { onDelete: "cascade" }),
  active: boolean("active").notNull().default(true),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const shareSignals = pgTable("share_signals", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => shareSessions.id, { onDelete: "cascade" }),
  sender: text("sender", { enum: ["learner", "tutor"] }).notNull(),
  data: jsonb("data").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey(),
  url: text("url").notNull().unique(),
  secret: text("secret").notNull(),
  active: boolean("active").notNull().default(true),
});
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").primaryKey(),
  webhookId: uuid("webhook_id")
    .notNull()
    .references(() => webhooks.id, { onDelete: "cascade" }),
  payload: jsonb("payload").notNull(),
  attempts: integer("attempts").notNull().default(0),
  deliveredAt: time("delivered_at"),
  retryAt: time("retry_at").notNull().defaultNow(),
  leaseUntil: time("lease_until"),
});
export const workerState = pgTable("worker_state", {
  name: text("name").primaryKey(),
  value: jsonb("value").notNull(),
});
export const channelPreferences = pgTable(
  "channel_preferences",
  {
    channel: text("channel").notNull(),
    destination: text("destination").notNull(),
    language: text("language").notNull().default("en"),
  },
  (table) => [primaryKey({ columns: [table.channel, table.destination] })],
);
export const channelTickets = pgTable("channel_tickets", {
  ticketId: uuid("ticket_id")
    .primaryKey()
    .references(() => tickets.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  destination: text("destination").notNull(),
  lastMessageId: bigint("last_message_id", { mode: "bigint" })
    .notNull()
    .default(0n),
});
export const signingTracks = pgTable("signing_tracks", {
  id: uuid("id").primaryKey(),
  lessonId: text("lesson_id").notNull(),
  videoId: text("video_id").notNull(),
  language: text("language").notNull().default("EthSL"),
  status: text("status").notNull().default("draft"),
  interpreter: text("interpreter").notNull(),
  publicationConsent: boolean("publication_consent").notNull(),
  sourceDuration: numeric("source_duration").notNull(),
  duration: numeric("duration").notNull(),
  offsetSeconds: numeric("offset_seconds").notNull().default("0"),
  uploadStartedAt: time("upload_started_at"),
  filePath: text("file_path"),
  mime: text("mime"),
  fileSize: bigint("file_size", { mode: "bigint" }),
  mediaSha256: text("media_sha256"),
  reviewer: text("reviewer"),
  reviewNotes: text("review_notes"),
  reviewChecks: jsonb("review_checks"),
  reviewedAt: time("reviewed_at"),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const telegramUpdates = pgTable("telegram_updates", {
  id: bigint("id", { mode: "bigint" }).primaryKey(),
  destination: text("destination").notNull(),
  text: text("text").notNull(),
  reply: text("reply"),
  attempts: integer("attempts").notNull().default(0),
  leaseUntil: time("lease_until"),
  completedAt: time("completed_at"),
  createdAt: time("created_at").notNull().defaultNow(),
});
