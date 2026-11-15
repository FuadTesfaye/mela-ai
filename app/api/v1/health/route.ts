import {db} from "@/lib/database/db";
export async function GET(){try{await db().query("SELECT 1 FROM schema_migrations LIMIT 1");return Response.json({status:"ok",database:"ready"});}catch{return Response.json({status:"degraded",database:"unavailable",retrieval:"demo fixtures available"},{status:503});}}
