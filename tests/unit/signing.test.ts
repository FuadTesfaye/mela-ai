import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  parseRange,
  signingPath,
  storeSigningMedia,
  streamSigningMedia,
} from "../../lib/signing/storage";
import {
  reviewSchema,
  validateSigningApproval,
} from "../../lib/signing/service";
test("signing review requires separate fluent reviewer, coverage and all checks", () => {
  const review = reviewSchema.parse({
    action: "approve",
    reviewer: "Reviewer",
    offsetSeconds: 0,
    checks: {
      fluentEthSL: true,
      accurateMeaning: true,
      visibleHandsAndFace: true,
      synchronized: true,
      completeCoverage: true,
    },
  });
  if (review.action !== "approve") throw Error("Expected approval");
  const row = {
    status: "awaiting-review",
    file_path: "file.webm",
    interpreter: "Signer",
    duration: 120,
    source_duration: 120,
  };
  assert.doesNotThrow(() => validateSigningApproval(row, review));
  assert.throws(
    () => validateSigningApproval({ ...row, interpreter: "reviewer" }, review),
    /separate/,
  );
  assert.throws(
    () => validateSigningApproval({ ...row, duration: 70 }, review),
    /cover/,
  );
  assert.throws(
    () => validateSigningApproval({ ...row, status: "draft" }, review),
    /Submit/,
  );
  assert.equal(
    reviewSchema.safeParse({
      ...review,
      checks: { ...review.checks, fluentEthSL: false },
    }).success,
    false,
  );
});
test("single byte ranges support seeking and reject malformed requests", () => {
  assert.deepEqual(parseRange("bytes=4-9", 20), {
    start: 4,
    end: 9,
    partial: true,
  });
  assert.deepEqual(parseRange("bytes=-4", 20), {
    start: 16,
    end: 19,
    partial: true,
  });
  for (const value of ["bytes=99-", "bytes=5-2", "bytes=0-2,5-7", "bytes=-0"])
    assert.throws(() => parseRange(value, 20));
  assert.throws(() => signingPath("../../secret.mp4"));
});
test("signing upload streams media, serves byte ranges and removes invalid uploads", async () => {
  const before = process.env.SIGNING_STORAGE_DIR;
  const directory = await mkdtemp(join(tmpdir(), "mela-signing-"));
  process.env.SIGNING_STORAGE_DIR = directory;
  try {
    const data = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4, 5, 6]);
    const stored = await storeSigningMedia(
      new Request("http://localhost/media", {
        method: "PUT",
        headers: { "Content-Type": "video/webm" },
        body: data,
      }),
      randomUUID(),
    );
    assert.equal(stored.bytes, 10);
    assert.equal(stored.sha256.length, 64);
    const response = await streamSigningMedia(
      new Request("http://localhost/media", {
        headers: { Range: "bytes=4-6" },
      }),
      stored.name,
      stored.mime,
    );
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("Content-Range"), "bytes 4-6/10");
    assert.deepEqual(
      new Uint8Array(await response.arrayBuffer()),
      data.slice(4, 7),
    );
    await assert.rejects(
      storeSigningMedia(
        new Request("http://localhost/media", {
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          body: "not video",
        }),
        randomUUID(),
      ),
      /does not match/,
    );
    await assert.rejects(
      storeSigningMedia(
        new Request("http://localhost/media", {
          method: "PUT",
          headers: {
            "Content-Type": "video/webm",
            "Content-Length": "134217729",
          },
          body: data,
        }),
        randomUUID(),
      ),
      /128 MiB/,
    );
    assert.equal((await readdir(directory)).length, 1);
  } finally {
    if (before === undefined) delete process.env.SIGNING_STORAGE_DIR;
    else process.env.SIGNING_STORAGE_DIR = before;
    await rm(directory, { recursive: true, force: true });
  }
});
