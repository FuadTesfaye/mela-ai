import {api} from "@/lib/security/http";
import {requireAdmin,HttpError} from "@/lib/security/auth";
import {ticketAccess} from "@/lib/support/tickets";
export const GET=(request:Request,{params}:{params:Promise<{id:string}>})=>api(request,async()=>{requireAdmin(request);const {ticket}=await ticketAccess(request,(await params).id);if(!ticket.screenshot)throw new HttpError(404,"No screenshot.");const [prefix,encoded]=ticket.screenshot.split(",");return new Response(Buffer.from(encoded,"base64"),{headers:{"Content-Type":prefix.slice(5).split(";")[0],"Content-Security-Policy":"default-src 'none'; sandbox","Cache-Control":"no-store"}});});
