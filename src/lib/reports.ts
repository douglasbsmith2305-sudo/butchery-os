export type ReportValue = string | number | boolean | null | undefined;

export type ReportTable = {
  title: string;
  headers: string[];
  rows: ReportValue[][];
};

function csvCell(value: ReportValue) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return /[\",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildSectionedCsv(title: string, generatedAt: string, tables: ReportTable[]) {
  const lines: ReportValue[][] = [
    [title],
    ["Generated", generatedAt],
    ["Note", "Each section below is a separate readable table."],
  ];

  for (const table of tables) {
    lines.push([], [table.title], table.headers, ...table.rows);
  }

  return `\uFEFF${lines.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
