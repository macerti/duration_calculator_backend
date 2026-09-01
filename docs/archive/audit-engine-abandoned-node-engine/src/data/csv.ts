import * as fs from "fs";
import * as path from "path";

/** Minimal CSV parser: handles quoted fields with embedded commas, CRLF. */
export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = raw.replace(/\r\n/g, "\n");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function readCsvFile(relativePath: string): Record<string, string>[] {
  const full = path.join(__dirname, "raw", relativePath);
  const raw = fs.readFileSync(full, "utf-8");
  const [header, ...rows] = parseCsv(raw);
  return rows.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => (obj[h.trim()] = (r[idx] ?? "").trim()));
    return obj;
  });
}
