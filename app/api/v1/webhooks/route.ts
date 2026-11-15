import {randomUUID} from "node:crypto";
import {z} from "zod";
import {api,jsonBody,preflight} from "@/lib/security/http";
import {requireAdmin,token,HttpError} from "@/lib/security/auth";
import {publicWebhookUrl} from "@/lib/security/webhooks";
import {db} from "@/lib/database/db";
export const OPTIONS=preflight;
export const POST=(request:Request)=>api(request,async()=>{requireAdmin(request);const {url}=z.object({url:z.string().url().max(2000)}).parse(await jsonBody(request,3000));try{await publicWebhookUrl(url);}catch{throw new HttpError(400,"Use a public HTTPS host configured in WEBHOOK_ALLOWED_HOSTS.");}const id=randomUUID();const secret=token();const result=await db().query("INSERT INTO webhooks(id,url,secret) VALUES($1,$2,$3) ON CONFLICT(url) DO UPDATE SET secret=EXCLUDED.secret,active=true RETURNING id",[id,url,secret]);return {id:result.rows[0].id,secret,events:["db-assistant:escalated"]};});
