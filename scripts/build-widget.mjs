import {build} from "esbuild";
import {stat, mkdir} from "node:fs/promises";
await mkdir("public",{recursive:true});
await build({entryPoints:["module/db-assistant.ts"],bundle:true,minify:true,target:"es2020",format:"iife",outfile:"public/db-assistant.js"});
const {size}=await stat("public/db-assistant.js");
if(size>500000)throw new Error(`Widget exceeds 500 KB: ${size}`);
console.log(`Widget: ${(size/1024).toFixed(1)} KB (uncompressed)`);
