import { createClient } from "@supabase/supabase-js";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const outletId = process.env.NEXT_PUBLIC_OUTLET_ID;
const bucket = process.env.ARCHIVE_BUCKET ?? "archives";
const days = Number(process.env.ARCHIVE_AFTER_DAYS ?? 365);
const prune = process.argv.includes("--prune");

if (!url || !serviceKey || !outletId) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_OUTLET_ID");
}
if (prune && process.env.ARCHIVE_CONFIRM !== outletId) {
  throw new Error("Pruning requires ARCHIVE_CONFIRM to exactly match NEXT_PUBLIC_OUTLET_ID");
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
const tables = ["activity_logs", "stock_movements"];
const payload = { schema_version: 1, outlet_id: outletId, cutoff_at: cutoff, exported_at: new Date().toISOString(), tables: {} };

for (const table of tables) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*")
      .eq("outlet_id", outletId).lt("created_at", cutoff)
      .order("id").range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  payload.tables[table] = rows;
}

const json = Buffer.from(JSON.stringify(payload));
const archive = gzipSync(json, { level: 9 });
const checksum = createHash("sha256").update(archive).digest("hex");
const stamp = new Date().toISOString().replaceAll(":", "-");
const path = `${outletId}/${stamp}-${checksum.slice(0, 12)}.json.gz`;

const { error: bucketError } = await supabase.storage.createBucket(bucket, { private: true, fileSizeLimit: 50 * 1024 * 1024 });
if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) throw bucketError;
const { error: uploadError } = await supabase.storage.from(bucket).upload(path, archive, {
  contentType: "application/gzip",
  upsert: false,
});
if (uploadError) throw uploadError;

const counts = Object.fromEntries(tables.map(table => [table, payload.tables[table].length]));
const { data: run, error: runError } = await supabase.from("archive_runs").insert({
  outlet_id: outletId,
  storage_path: path,
  cutoff_at: cutoff,
  row_counts: counts,
  checksum,
  status: "verified",
}).select("id").single();
if (runError) throw runError;

if (prune) {
  for (const table of tables) {
    if (payload.tables[table].length === 0) continue;
    const { error } = await supabase.from(table).delete().eq("outlet_id", outletId).lt("created_at", cutoff);
    if (error) throw error;
  }
  await supabase.from("archive_runs").update({ status: "pruned" }).eq("id", run.id);
}

console.log(JSON.stringify({ path, checksum, counts, pruned: prune }));
