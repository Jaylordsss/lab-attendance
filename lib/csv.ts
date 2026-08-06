/**
 * A small CSV reader.
 *
 * Deliberately not a dependency: school rosters are exported from Excel, and
 * the only awkward cases are quoted fields containing commas and the BOM Excel
 * writes at the start of a UTF-8 file. Both are handled here in forty lines.
 */

export type CsvRow = Record<string, string>;

export function parseCsv(text: string): CsvRow[] {
  // Excel writes a byte-order mark that would otherwise become part of the
  // first column's name, so the header never matches.
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  const lines = splitRows(clean);
  if (lines.length < 2) return [];

  const header = lines[0].map((h) =>
    h.trim().toLowerCase().replace(/\s+/g, "_"),
  );

  return lines.slice(1).flatMap((cells) => {
    // Skip blank lines rather than importing a row of empty strings.
    if (cells.every((c) => c.trim() === "")) return [];

    const row: CsvRow = {};
    header.forEach((key, i) => {
      row[key] = (cells[i] ?? "").trim();
    });
    return [row];
  });
}

/** Splits on newlines and commas, respecting double-quoted fields. */
function splitRows(text: string): string[][] {
  const rows: string[][] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (quoted) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is a literal quote.
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') quoted = true;
    else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else if (ch === "\n") {
      cells.push(cell);
      rows.push(cells);
      cells = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }

  cells.push(cell);
  rows.push(cells);
  return rows;
}

/** Accepts the spellings a Philippine school is likely to export. */
export const COLUMN_ALIASES: Record<string, string[]> = {
  student_no: ["student_no", "student_number", "student_id", "id_number", "lrn"],
  full_name: ["full_name", "name", "student_name", "fullname"],
  birthdate: ["birthdate", "birthday", "date_of_birth", "dob", "birth_date"],
  address: ["address", "home_address"],
  guardian_name: ["guardian_name", "guardian", "parent_name", "parent"],
  guardian_phone: [
    "guardian_phone",
    "guardian_contact",
    "guardian_mobile",
    "parent_contact",
    "contact_number",
  ],
  email: ["email", "email_address", "e_mail", "student_email", "gmail"],
  contact_no: [
    "contact_no",
    "student_contact",
    "student_mobile",
    "mobile",
    "mobile_number",
    "cellphone",
    "cp_number",
  ],
  department: ["department", "dept", "course", "program", "strand"],
};

export function pick(row: CsvRow, field: keyof typeof COLUMN_ALIASES): string {
  for (const alias of COLUMN_ALIASES[field]) {
    if (row[alias]) return row[alias];
  }
  return "";
}

/**
 * Dates arrive as 2009-05-14, 14/05/2009 or 5/14/2009 depending on who
 * exported the file. Ambiguous day/month pairs are resolved by assuming
 * day-first, which is the Philippine convention.
 */
export function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (iso) {
    return `${iso[1]}-${pad(iso[2])}-${pad(iso[3])}`;
  }

  const slashed = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(value);
  if (slashed) {
    let [, a, b, year] = slashed;
    let day = Number(a);
    let month = Number(b);

    // Only one reading is possible when a value exceeds twelve.
    if (day <= 12 && month > 12) [day, month] = [month, day];
    if (month > 12 || day > 31) return null;

    return `${year}-${pad(String(month))}-${pad(String(day))}`;
  }

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function pad(n: string): string {
  return n.padStart(2, "0");
}
