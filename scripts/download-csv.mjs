import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import WebSocket from "ws";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || "dashboard-data";

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const targetFile = process.argv[2] || "actions_log.csv";
const outPath = path.resolve(process.cwd(), targetFile);

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

console.log(`Connecting to Supabase bucket "${bucket}" to download "${targetFile}"...`);

const { data, error } = await supabase.storage.from(bucket).download(targetFile);

if (error) {
  console.error(`Download failed: ${error.message}`);
  process.exit(1);
}

const buffer = Buffer.from(await data.arrayBuffer());
fs.writeFileSync(outPath, buffer);
console.log(`Successfully downloaded "${targetFile}" (${buffer.length} bytes) to ${outPath}`);
