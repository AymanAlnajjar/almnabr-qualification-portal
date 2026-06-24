import { copyFile, mkdir, writeFile } from "node:fs/promises";

const publicConfig = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  maxPhotos: Number(process.env.MAX_PHOTOS || 5),
  maxPhotoBytes: Number(process.env.MAX_PHOTO_BYTES || 5 * 1024 * 1024)
};

await writeFile(
  new URL("../public/runtime-config.js", import.meta.url),
  `window.QUALIFICATION_CONFIG = ${JSON.stringify(publicConfig)};\n`,
  "utf8"
);

await mkdir(new URL("../public/assets", import.meta.url), { recursive: true });
await copyFile(
  new URL("../node_modules/@supabase/supabase-js/dist/umd/supabase.js", import.meta.url),
  new URL("../public/assets/supabase.js", import.meta.url)
);

console.log("Runtime configuration written.");
