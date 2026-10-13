import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient, type WebSocketLikeConstructor } from "@supabase/supabase-js";
import WebSocket from "ws";
import { env } from "./env";

const LOCAL_DIR = path.resolve(process.cwd(), "..", "data_files");

export function bucketName(): string {
  return env("SUPABASE_BUCKET") || "dashboard-data";
}

function serviceKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  if (!key.startsWith("eyJ")) return false;
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()) as { role?: string };
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

export function supabaseConfigured(): boolean {
  return Boolean(env("SUPABASE_URL") && serviceKey(env("SUPABASE_SERVICE_ROLE_KEY")));
}

function production(): boolean {
  return env("NODE_ENV") === "production";
}

/** Shown when the env points at Supabase but cannot write the private bucket yet. */
export function storageNote(): string | null {
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseConfigured()) return null;
  if (production()) {
    return "Set SUPABASE_URL and the secret SUPABASE_SERVICE_ROLE_KEY (sb_secret_…) on the host. Production reads the CSVs only from the Supabase bucket.";
  }
  if (!url && !key) return null;
  if (!url) return "Add SUPABASE_URL to web/.env. The dashboard is still reading the local CSV files.";
  if (key.startsWith("sb_publishable_")) {
    return "The Supabase key in web/.env is the publishable key, which cannot write the private bucket. Replace SUPABASE_SERVICE_ROLE_KEY with the secret key (it starts with sb_secret_). The dashboard is reading the local CSV files until then.";
  }
  return "SUPABASE_SERVICE_ROLE_KEY needs to be the secret key (sb_secret_…) or the service_role key. The dashboard is reading the local CSV files until then.";
}

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!supabaseConfigured()) {
    throw new Error("Set SUPABASE_URL and the secret SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!client) {
    client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
    });
  }
  return client;
}

function assertName(name: string) {
  if (!/^[\w.-]+\.csv$/i.test(name)) throw new Error(`Unexpected data file name: ${name}`);
}

function localPath(name: string) {
  assertName(name);
  return path.join(LOCAL_DIR, name);
}

function requireRemoteOrLocalDev() {
  if (!supabaseConfigured() && production()) {
    throw new Error(
      "Set SUPABASE_URL and the secret SUPABASE_SERVICE_ROLE_KEY on the host. Production reads the CSVs only from the Supabase bucket.",
    );
  }
}

function missing(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  const status = String(error.statusCode ?? "");
  return status === "404" || msg.includes("not found") || msg.includes("object not found");
}

export async function ensureBucket() {
  const name = bucketName();
  const { data, error } = await supabase().storage.listBuckets();
  if (error) throw new Error(error.message);
  if (data?.some((b) => b.name === name || b.id === name)) return;
  const created = await supabase().storage.createBucket(name, { public: false });
  if (created.error && !created.error.message.toLowerCase().includes("already")) {
    throw new Error(created.error.message);
  }
}

export async function listObjects(): Promise<{ name: string; updated_at: string; size: number }[]> {
  requireRemoteOrLocalDev();
  if (!supabaseConfigured()) {
    if (!fs.existsSync(LOCAL_DIR)) return [];
    return fs
      .readdirSync(LOCAL_DIR)
      .filter((n) => n.toLowerCase().endsWith(".csv"))
      .sort()
      .map((name) => {
        const st = fs.statSync(path.join(LOCAL_DIR, name));
        return { name, updated_at: st.mtime.toISOString(), size: st.size };
      });
  }
  await ensureBucket();
  const { data, error } = await supabase().storage.from(bucketName()).list("", { limit: 100 });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((f) => f.name.toLowerCase().endsWith(".csv"))
    .map((f) => ({
      name: f.name,
      updated_at: f.updated_at || f.created_at || "",
      size: Number((f.metadata as { size?: number } | null)?.size ?? 0),
    }));
}

export async function readObject(name: string): Promise<string | null> {
  assertName(name);
  requireRemoteOrLocalDev();
  if (!supabaseConfigured()) {
    const file = localPath(name);
    if (!fs.existsSync(file)) return null;
    return fs.readFileSync(file, "utf8");
  }
  const { data, error } = await supabase().storage.from(bucketName()).download(name);
  if (error) {
    if (missing(error)) return null;
    throw new Error(`Could not read ${name}: ${error.message}`);
  }
  return await data.text();
}

export async function writeObject(name: string, text: string) {
  assertName(name);
  requireRemoteOrLocalDev();
  if (!supabaseConfigured()) {
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    fs.writeFileSync(localPath(name), text, "utf8");
    return;
  }
  await ensureBucket();
  const { error } = await supabase()
    .storage.from(bucketName())
    .upload(name, Buffer.from(text, "utf8"), {
      upsert: true,
      contentType: "text/csv; charset=utf-8",
    });
  if (error) throw new Error(`Could not write ${name}: ${error.message}`);
}

/** Upload every CSV in the local data_files folder into the private bucket. */
export async function uploadLocalCsvs(): Promise<string[]> {
  if (!supabaseConfigured()) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in web/.env before uploading.");
  }
  if (!fs.existsSync(LOCAL_DIR)) return [];
  await ensureBucket();
  const names = fs.readdirSync(LOCAL_DIR).filter((n) => n.toLowerCase().endsWith(".csv"));
  const uploaded: string[] = [];
  for (const name of names) {
    const text = fs.readFileSync(path.join(LOCAL_DIR, name));
    const { error } = await supabase()
      .storage.from(bucketName())
      .upload(name, text, { upsert: true, contentType: "text/csv; charset=utf-8" });
    if (error) throw new Error(`Could not upload ${name}: ${error.message}`);
    uploaded.push(name);
  }
  return uploaded;
}
