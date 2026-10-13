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
  console.error("Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to web/.env, then run this again.");
  process.exit(1);
}
function isServiceKey(value) {
  if (value.startsWith("sb_secret_")) return true;
  if (!value.startsWith("eyJ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(value.split(".")[1], "base64url").toString());
    return payload.role === "service_role";
  } catch {
    return false;
  }
}
if (!isServiceKey(key)) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is not a secret key. Use the sb_secret_ key, not the publishable key.");
  process.exit(1);
}

const dir = path.resolve(process.cwd(), "..", "data_files");
const names = fs.readdirSync(dir).filter((n) => n.toLowerCase().endsWith(".csv"));
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: WebSocket },
});

const existing = await supabase.storage.listBuckets();
if (existing.error) {
  console.error(existing.error.message);
  process.exit(1);
}
if (!existing.data?.some((b) => b.name === bucket)) {
  const created = await supabase.storage.createBucket(bucket, { public: false });
  if (created.error) {
    console.error(created.error.message);
    process.exit(1);
  }
  console.log(`Created private bucket ${bucket}`);
}

for (const name of names) {
  const body = fs.readFileSync(path.join(dir, name));
  const { error } = await supabase.storage.from(bucket).upload(name, body, {
    upsert: true,
    contentType: "text/csv; charset=utf-8",
  });
  if (error) {
    console.error(`${name}: ${error.message}`);
    process.exit(1);
  }
  console.log(`${name} (${body.length} bytes)`);
}
console.log(`Uploaded ${names.length} CSV file(s) to ${bucket}.`);
