import type {Language} from "../types";
import {smsText} from "./transports";
import {db} from "../database/db";
import {answerQuestion} from "../ai/answer";
import {createTicket} from "../support/tickets";
import {verifyCode,unsubscribeDestination,subscribe} from "./subscriptions";
export async function channelLanguage(channel:string,destination:string):Promise<Language>{const result=await db().query("SELECT language FROM channel_preferences WHERE channel=$1 AND destination=$2",[channel,destination]);return result.rows[0]?.language==="am"?"am":"en";}
export async function handleCommand(channel:"telegram"|"sms",destination:string,text:string){const normalized=text.trim();const lower=normalized.toLowerCase();if(["/start","start"].includes(lower))return `Welcome to MELA. Your chat ID: ${destination}. Ask about browsers, passwords, email or demo jobs. /am: Amharic, /en: English, /help: tutor, /alerts keyword: Telegram job alerts, /stop: stop alerts.`;
 if(["/am","am","/en","en"].includes(lower)){const language=lower.endsWith("am")?"am":"en";await db().query("INSERT INTO channel_preferences(channel,destination,language) VALUES($1,$2,$3) ON CONFLICT(channel,destination) DO UPDATE SET language=EXCLUDED.language",[channel,destination,language]);return language==="am"?"ሰላም! ጥያቄዎን በአማርኛ ይጠይቁ።":"English selected. What would you like to understand?";}
 if(["stop","/stop"].includes(lower)){await unsubscribeDestination(channel,destination);return "MELA job alerts stopped.";}
 if(/^\/?verify \d{6}$/i.test(normalized)){await verifyCode({channel,destination,code:normalized.slice(-6)});return "MELA job alerts verified. Reply STOP to unsubscribe.";}
 const language=await channelLanguage(channel,destination);
 if(["help","/help"].includes(lower))return language==="am"?"የሰው እርዳታ ለመጠየቅ CONFIRMHELP ይላኩ። የዚህን ቻናል መለያ ከጥያቄዎ ጋር እናስቀምጣለን። ውይይትዎ አይጋራም።":"Reply CONFIRMHELP to queue a tutor request. We’ll store your channel ID to deliver replies. Your conversation will not be shared.";
 if(["confirmhelp","/confirmhelp"].includes(lower)){const ticket=await createTicket({language,consent:true,conversation:[]});await db().query("INSERT INTO channel_tickets(ticket_id,channel,destination) VALUES($1,$2,$3)",[ticket.id,channel,destination]);return `Tutor request queued: ${ticket.id}. Replies arrive here when a tutor responds.`;}
 if(channel==="telegram"&&/^\/alerts(?:\s|$)/i.test(normalized)){await subscribe({channel,destination,language,keywords:normalized.slice(7).trim().slice(0,200)},true);return "Subscribed to demo job alerts. /stop unsubscribes. No active vacancies are promised.";}
 const answer=await answerQuestion({question:normalized,language,context:{pageType:/job|interview|ሥራ|ስራ/.test(lower)?"jobs":"unknown",sections:[]},cloudConsent:false});const base=process.env.APP_URL||"http://localhost:3000";const sources=answer.citations.map(c=>c.title+": "+new URL(c.url,base).href).join("\n");if(channel==="sms"&&answer.citations[0]){const link=new URL(answer.citations[0].url,base).href;const budget=Math.max(0,159-Array.from(link).length);return Array.from(answer.answer).slice(0,budget).join("")+" "+link;}return answer.answer+(sources?"\n\n"+sources:"");}
