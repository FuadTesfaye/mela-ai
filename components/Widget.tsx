"use client";
import {useEffect} from "react";
export default function Widget(){useEffect(()=>{const widget=document.createElement("db-assistant");widget.setAttribute("api","/api");widget.setAttribute("content","/content.json");document.body.append(widget);let script=document.querySelector('script[data-mela]');if(!script){script=document.createElement("script");script.setAttribute("data-mela","");(script as HTMLScriptElement).src="/db-assistant.js";document.body.append(script);}return()=>widget.remove();},[]);return null;}
export function AskButton({children,className="",question}:{children:React.ReactNode;className?:string;question?:string}){return <button className={className} onClick={()=>window.dispatchEvent(new CustomEvent("mela:open",{detail:{question}}))}>{children}</button>}
