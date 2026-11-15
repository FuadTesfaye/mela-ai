import {Pool} from "pg";
let pool:Pool|undefined;
export function db(){if(!process.env.DATABASE_URL)throw new Error("DATABASE_UNAVAILABLE");return pool??=new Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:3000,idleTimeoutMillis:30000});}
export async function closeDb(){await pool?.end();pool=undefined;}
