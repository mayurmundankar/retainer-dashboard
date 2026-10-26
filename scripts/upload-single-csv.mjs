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
const filePath = path.resolve(process.cwd(), targetFile);

if (!fs.existsSync(filePath)) {
  console.error(`File does not exist: ${filePath}`);
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

const body = fs.readFileSync(filePath);
console.log(`Uploading "${targetFile}" (${body.length} bytes) to Supabase bucket "${bucket}"...`);

const { error } = await supabase.storage.from(bucket).upload(path.basename(targetFile), body, {
  upsert: true,
  contentType: "text/csv; charset=utf-8",
});

if (error) {
  console.error(`Upload failed: ${error.message}`);
  process.exit(1);
}

console.log(`Successfully uploaded "${targetFile}" to Supabase storage!`);
