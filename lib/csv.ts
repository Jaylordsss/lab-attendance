/**
 * A small delimited-text reader.
 *
 * Deliberately not a dependency: school rosters arrive in three shapes and
 * each has one quirk. A saved .csv uses commas and carries the byte-order mark
 * Excel writes. A range copied out of Google Sheets or Excel uses tabs. And
 * any of them may contain a quoted field with the delimiter inside it.
 *
 * The delimiter is detected rather than configured, because a teacher
 * selecting cells and pressing copy has no idea what separates them.
 */

export type CsvRow = Record<string, string>;

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

/**
 * Column order assumed when a paste arrives without its header row.
 *
 * Selecting the header as well as the students is one extra keystroke that
 * people reliably forget, and the failure is silent — every column comes back
 * empty and the preview blames the data. Falling back to a known order costs
 * nothing when the header is present and rescues the common mistake when it
 * is not.
 */
export const DEFAULT_COLUMNS = [
  "student_no",
  "full_name",
  "email",
  "birthdate",
  "department",
  "contact_no",
  "address",
  "guardian_name",
  "guardian_phone",
] as const;

/** True when the first row names columns rather than describing a student. */
function looksLikeHeader(cells: string[]): boolean {
  const normalised = cells.map((c) =>
    c.trim().toLowerCase().replace(/\s+/g, "_"),
  );

  const known = new Set(Object.values(COLUMN_ALIASES).flat());
  return normalised.some((c) => known.has(c));
}

export function parseCsv(text: string): CsvRow[] {
  // Excel writes a byte-order mark that would otherwise become part of the
  // first column's name, so the header never matches.
  const clean = text.replace(/^\uFEFF/, "").trim();
  if (!clean) return [];

  const lines = splitRows(clean, detectDelimiter(clean)).filter(
    (cells) => !cells.every((c) => c.trim() === ""),
  );

  if (lines.length === 0) return [];

  const hasHeader = looksLikeHeader(lines[0]);

  const header = hasHeader
    ? lines[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
    : [...DEFAULT_COLUMNS];

  const body = hasHeader ? lines.slice(1) : lines;

  return body.flatMap((cells) => {
    const row: CsvRow = {};
    header.forEach((key, i) => {
      row[key] = (cells[i] ?? "").trim();
    });
    return [row];
  });
}

/**
 * Whichever separator appears more often in the first line wins.
 *
 * Counting on the header alone is enough and safer than counting the whole
 * file: an address like "Caggay, Tuguegarao City" is full of commas, and in a
 * tab-separated paste those would otherwise outvote the real delimiter.
 */
function detectDelimiter(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  const tabs = (header.match(/\t/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  const semicolons = (header.match(/;/g) ?? []).length;

  if (tabs >= commas && tabs >= semicolons && tabs > 0) return "\t";
  if (semicolons > commas) return ";";
  return ",";
}

/** Splits on newlines and the given delimiter, respecting quoted fields. */
function splitRows(text: string, delimiter: string): string[][] {
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
    else if (ch === delimiter) {
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
