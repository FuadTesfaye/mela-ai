import type {Section,LearningContext,Language,Answer} from "../types";
const stop=new Set(["a","an","the","is","are","of","to","in","on","for","i","my","me","it","how","what","do","can","please","explain","current","lesson","help","with","and","በ","የ","ነው","ምን","እንዴት","እርዳኝ"]);
export function tokenize(text:string){return [...new Set(text.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(t=>t.length>1&&!stop.has(t)))];}
const bilingual:Record<string,string[]>={password:["የይለፍ","ቃል","ደህንነት"],browser:["አሳሽ","በይነመረብ"],internet:["በይነመረብ","ኢንተርኔት"],job:["ሥራ","ስራ"],interview:["ቃለ","መጠይቅ"],offline:["መስመር","ውጭ"],email:["ኢሜይል"],learning:["ትምህርት","ተማር"]};
export function retrieve(question:string,sections:Section[],context:LearningContext,language:Language):Section[]{
 const q=tokenize(question);for(const [en,am]of Object.entries(bilingual))if(q.some(t=>t===en||am.some(a=>t.includes(a))))q.push(en,...am);
 const contextual=/current lesson|this lesson|የአሁኑ|ትምህርት|በአማርኛ/.test(question.toLowerCase());
 const unique=new Map<string,Section>();for(const s of [...context.sections,...sections])if((!s.courseId||!context.courseId||s.courseId===context.courseId||context.pageType==="jobs")&&(!s.language||s.language===language))unique.set(s.id,s);
 const active=new Set(context.sections.map(s=>s.id));return [...unique.values()].map(s=>{const title=tokenize(s.title+" "+(s.keywords||[]).join(" "));const body=tokenize(s.content);const overlap=q.reduce((n,t)=>n+(title.includes(t)?3:body.includes(t)?1:0),0);const contextualMatch=contextual&&(active.has(s.id)||s.courseId===context.courseId);return {s,score:overlap>0?overlap+(active.has(s.id)?8:0):contextualMatch?2:0};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.s);
}
export function groundedAnswer(question:string,sections:Section[],context:LearningContext,language:Language,simple=false):Answer {
 const found=retrieve(question,sections,context,language);const sentences=(text:string)=>simple?text.split(/(?<=[.!?።])\s*/u).filter(Boolean).slice(0,2).join(" "):text;
 return {answer:found.length?found.map(s=>sentences(s.content)).join("\n\n"):language==="am"?"ይህን መረጃ በትምህርቱ ውስጥ ማግኘት አልቻልኩም። ጥያቄዎን በሌላ መንገድ ይጠይቁ ወይም የሰው እርዳታ ይጠይቁ።":"I couldn’t find that information in the available learning materials. Try another question or ask a person for help.",citations:found.map(s=>({id:s.id,title:s.title,url:s.url,excerpt:s.content.slice(0,240)})),provider:"none",matched:found.length>0,actions:["human-help"]};
}
