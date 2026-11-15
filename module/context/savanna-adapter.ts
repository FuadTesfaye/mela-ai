import type {LearningContext,Section} from "../../lib/types";
export function detectContext():LearningContext {
 const root=document.querySelector<HTMLElement>("[data-mela-context]")||document.querySelector<HTMLElement>("main,article");
 if(!root)return {pageType:"unknown",sections:[]};
 const sections:Section[]=[];
 // Only authored, approved lesson containers are extracted; never forms or arbitrary body text.
 root.querySelectorAll<HTMLElement>("[data-mela-section]").forEach((node,i)=>{
 if(node.closest("[data-private],form,nav"))return;
 const id=node.id||`section-${i}`;const url=new URL(location.href);url.hash=id;url.search="";
 sections.push({id,title:node.querySelector("h2,h3,h4")?.textContent?.trim()||root.dataset.lessonTitle||"Lesson",content:(node.querySelector("[data-mela-content]")||node).textContent?.trim().slice(0,6000)||"",url:url.href,courseId:root.dataset.courseId,language:node.lang==="am"?"am":"en"});
 });
 return {pageType:root.dataset.pageType==="jobs"?"jobs":sections.length?"lesson":root.dataset.courseId?"dashboard":"unknown",courseId:root.dataset.courseId,courseTitle:root.dataset.courseTitle,moduleTitle:root.dataset.moduleTitle,lessonTitle:root.dataset.lessonTitle,sections:sections.slice(0,30)};
}
