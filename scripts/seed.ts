import content from "../data/content.json";
import jobs from "../data/jobs.json";
import {db,closeDb} from "../lib/database/db";
async function main(){const client=await db().connect();try{await client.query("BEGIN");for(const s of content)await client.query("INSERT INTO sections(id,title,content,url,language,course_id,keywords) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING",[s.id,s.title,s.content,s.url,s.language,s.courseId,JSON.stringify(s.keywords)]);for(const j of jobs)await client.query("INSERT INTO jobs(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING",[j.id,JSON.stringify(j)]);await client.query("COMMIT");console.log("Demo materials seeded (existing content preserved).");}catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();await closeDb();}}
main().catch(()=>{console.error("Seed failed. Run migrations first and check DATABASE_URL.");process.exitCode=1;});
