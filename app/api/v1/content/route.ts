import { z } from "zod";
import { api, jsonBody, preflight } from "@/lib/security/http";
import { section } from "@/lib/security/schemas";
import { requireAdmin } from "@/lib/security/auth";
import { db } from "@/lib/database/db";
export const OPTIONS = preflight;
export const POST = (request: Request) =>
  api(request, async () => {
    requireAdmin(request);
    const { sections } = z
      .object({
        sections: z
          .array(section.extend({ language: z.enum(["en", "am", "om", "ti"]) }))
          .min(1)
          .max(100),
      })
      .parse(await jsonBody(request, 700000));
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      for (const s of sections)
        await client.query(
          "INSERT INTO sections(id,title,content,url,language,course_id,keywords) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title,content=EXCLUDED.content,url=EXCLUDED.url,language=EXCLUDED.language,course_id=EXCLUDED.course_id,keywords=EXCLUDED.keywords",
          [
            s.id,
            s.title,
            s.content,
            s.url,
            s.language,
            s.courseId,
            JSON.stringify(s.keywords || []),
          ],
        );
      await client.query("COMMIT");
      return { indexed: sections.length };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });
