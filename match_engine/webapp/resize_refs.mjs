import sharp from "sharp";
import { readdirSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import { join, resolve } from "path";

const d = resolve("public/img/referees");
const files = readdirSync(d).filter(f => f.endsWith(".webp") && f !== "arbitro_3d.webp");
let saved = 0;
for (const f of files) {
  const fp = join(d, f);
  const m = await sharp(fp).metadata();
  if (m.width > 96 || m.height > 96) {
    const before = statSync(fp).size;
    const buf = await sharp(fp)
      .resize(90, 90, { fit: "cover", position: "top" })
      .webp({ quality: 82 })
      .toBuffer();
    await writeFile(fp, buf);
    saved += (before - buf.length);
    console.log(f, m.width + "x" + m.height, "->90x90", before + "->" + buf.length + "B");
  } else { console.log(f, m.width + "x" + m.height, "SKIP"); }
}
console.log("Total saved:", (saved/1024).toFixed(1), "KB");
