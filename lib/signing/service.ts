import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../database/db";
import { HttpError } from "../security/auth";
import { youtubeId } from "../media/youtube";
import { lessonIds } from "../media/lesson-catalog";
export const signingDraftSchema = z.object({
  videoUrl: z.string().url().max(2000),
  interpreter: z.string().trim().min(2).max(150),
  publicationConsent: z.literal(true),
  sourceDuration: z.number().positive().max(14400),
  duration: z.number().positive().max(14400),
  offsetSeconds: z.number().min(-30).max(30).default(0),
});
export const reviewSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({
    action: z.literal("archive"),
    reviewer: z.string().trim().min(2).max(150),
    notes: z.string().max(3000).default(""),
  }),
  z.object({
    action: z.literal("approve"),
    reviewer: z.string().trim().min(2).max(150),
    notes: z.string().max(3000).default(""),
    offsetSeconds: z.number().min(-30).max(30),
    checks: z.object({
      fluentEthSL: z.literal(true),
      accurateMeaning: z.literal(true),
      visibleHandsAndFace: z.literal(true),
      synchronized: z.literal(true),
      completeCoverage: z.literal(true),
    }),
  }),
  z.object({
    action: z.literal("reject"),
    reviewer: z.string().trim().min(2).max(150),
    notes: z.string().trim().min(3).max(3000),
  }),
]);
export function validLesson(id: string) {
  if (!(lessonIds as readonly string[]).includes(id))
    throw new HttpError(404, "Lesson not found.");
}
export function publicTrack(row: Record<string, unknown>) {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    videoId: row.video_id,
    language: row.language,
    status: row.status,
    interpreter: row.interpreter,
    sourceDuration: Number(row.source_duration),
    duration: Number(row.duration),
    offsetSeconds: Number(row.offset_seconds),
    hasMedia: !!row.file_path,
    mime: row.mime,
    size: Number(row.file_size || 0),
    reviewer: row.reviewer,
    notes: row.review_notes,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}
export async function createSigningDraft(
  lessonId: string,
  input: z.input<typeof signingDraftSchema>,
) {
  validLesson(lessonId);
  const data = signingDraftSchema.parse(input);
  let videoId: string;
  try {
    videoId = youtubeId(data.videoUrl);
  } catch {
    throw new HttpError(400, "Use a public HTTPS YouTube source.");
  }
  const id = randomUUID();
  const result = await db().query(
    "INSERT INTO signing_tracks(id,lesson_id,video_id,interpreter,publication_consent,source_duration,duration,offset_seconds) VALUES($1,$2,$3,$4,true,$5,$6,$7) RETURNING *",
    [
      id,
      lessonId,
      videoId,
      data.interpreter,
      data.sourceDuration,
      data.duration,
      data.offsetSeconds,
    ],
  );
  return publicTrack(result.rows[0]);
}
export function validateSigningApproval(
  row: Record<string, unknown>,
  review: z.infer<typeof reviewSchema>,
) {
  if (review.action !== "approve") return;
  if (row.status !== "awaiting-review" || !row.file_path)
    throw new HttpError(409, "Submit a completed upload for review first.");
  if (
    String(row.interpreter).trim().toLowerCase() ===
    review.reviewer.toLowerCase()
  )
    throw new HttpError(
      400,
      "A separate fluent reviewer must approve the interpretation.",
    );
  if (review.offsetSeconds > 2)
    throw new HttpError(
      400,
      "The interpretation must cover the beginning of the source video.",
    );
  if (
    Number(row.duration) + review.offsetSeconds <
    Number(row.source_duration) - 2
  )
    throw new HttpError(
      400,
      "The recording does not cover the source video. Upload the complete interpretation.",
    );
}
export async function reviewSigning(
  id: string,
  input: z.input<typeof reviewSchema>,
) {
  const review = reviewSchema.parse(input);
  const initial = await db().query(
    "SELECT lesson_id,video_id FROM signing_tracks WHERE id=$1",
    [id],
  );
  if (!initial.rows[0]) throw new HttpError(404, "Signing draft not found.");
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      initial.rows[0].lesson_id + ":" + initial.rows[0].video_id,
    ]);
    const result = await client.query(
      "SELECT * FROM signing_tracks WHERE id=$1 FOR UPDATE",
      [id],
    );
    const row = result.rows[0];
    if (review.action === "archive") {
      if (row.status !== "approved")
        throw new HttpError(
          409,
          "Only published interpretations can be unpublished.",
        );
      await client.query(
        "UPDATE signing_tracks SET status='archived',reviewer=$2,review_notes=$3 WHERE id=$1",
        [id, review.reviewer, review.notes],
      );
    } else if (review.action === "submit") {
      if (!["draft", "rejected"].includes(row.status) || !row.file_path)
        throw new HttpError(409, "Upload a draft video before submitting.");
      await client.query(
        "UPDATE signing_tracks SET status='awaiting-review' WHERE id=$1",
        [id],
      );
    } else {
      if (row.status !== "awaiting-review")
        throw new HttpError(
          409,
          "Only submitted interpretations can be reviewed.",
        );
      validateSigningApproval(row, review);
      if (review.action === "approve") {
        await client.query(
          "UPDATE signing_tracks SET status='archived' WHERE lesson_id=$1 AND video_id=$2 AND status='approved'",
          [row.lesson_id, row.video_id],
        );
        await client.query(
          "UPDATE signing_tracks SET status='approved',reviewer=$2,review_notes=$3,review_checks=$4,reviewed_at=now(),offset_seconds=$5 WHERE id=$1",
          [
            id,
            review.reviewer,
            review.notes,
            JSON.stringify(review.checks),
            review.offsetSeconds,
          ],
        );
      } else
        await client.query(
          "UPDATE signing_tracks SET status='rejected',reviewer=$2,review_notes=$3,reviewed_at=now() WHERE id=$1",
          [id, review.reviewer, review.notes],
        );
    }
    const updated = await client.query(
      "SELECT * FROM signing_tracks WHERE id=$1",
      [id],
    );
    await client.query("COMMIT");
    return publicTrack(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function approvedSigning(lessonId: string, videoId: string) {
  if (!process.env.DATABASE_URL) return null;
  const result = await db().query(
    "SELECT id,video_id,reviewer,offset_seconds FROM signing_tracks WHERE lesson_id=$1 AND video_id=$2 AND status='approved' ORDER BY reviewed_at DESC LIMIT 1",
    [lessonId, videoId],
  );
  const row = result.rows[0];
  return row
    ? {
        url: `/api/v1/signing/${row.id}/media`,
        videoId: row.video_id,
        language: "EthSL",
        reviewer: row.reviewer,
        offsetSeconds: Number(row.offset_seconds),
      }
    : null;
}
