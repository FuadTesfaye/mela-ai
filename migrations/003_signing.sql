CREATE TABLE IF NOT EXISTS signing_tracks (
 id uuid PRIMARY KEY,
 lesson_id text NOT NULL,
 video_id text NOT NULL CHECK (video_id ~ '^[-_a-zA-Z0-9]{11}$'),
 language text NOT NULL DEFAULT 'EthSL' CHECK (language='EthSL'),
 status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','uploading','awaiting-review','approved','rejected','archived')),
 interpreter text NOT NULL,
 publication_consent boolean NOT NULL CHECK(publication_consent),
 source_duration numeric NOT NULL CHECK(source_duration>0 AND source_duration<=14400),
 duration numeric NOT NULL CHECK(duration>0 AND duration<=14400),
 offset_seconds numeric NOT NULL DEFAULT 0 CHECK(offset_seconds BETWEEN -30 AND 30),
 upload_started_at timestamptz,
 file_path text,
 mime text,
 file_size bigint,
 media_sha256 text,
 reviewer text,
 review_notes text,
 review_checks jsonb,
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status<>'approved' OR (file_path IS NOT NULL AND reviewer IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS signing_one_approved_idx ON signing_tracks(lesson_id,video_id) WHERE status='approved';
CREATE INDEX IF NOT EXISTS signing_lesson_idx ON signing_tracks(lesson_id,created_at DESC);
