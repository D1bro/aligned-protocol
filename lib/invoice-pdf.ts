import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatPence } from "@/lib/money";

// An issued invoice as a PDF, drawn only from its frozen snapshot, so the
// file always matches what was issued. Uses the built-in Helvetica (no font
// files to bundle); text is reduced to what that font can print.

export type InvoiceForPdf = {
  number: string;
  issue_date: string;
  due_date: string;
  service_period: string | null;
  notes: string | null;
  supplier: { trading_name?: string; legal_name?: string; legal_form?: string; address?: string; email?: string; phone?: string };
  customer: { name?: string; email?: string; address?: string };
  payment_instructions: { account_name?: string; sort_code?: string; account_number?: string; note?: string };
  items: { description: string; quantity: number; unit_pence: number }[];
  subtotal_pence: number;
  discount_pence: number;
  total_pence: number;
  credits_purchased: number;
};

const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.42, 0.42, 0.45);
const RULE = rgb(0.85, 0.85, 0.87);

// Helvetica (WinAnsi) can't draw every character; swap the common ones and drop the rest.
function printable(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7e£€©·•\n]/g, "");
}

function ukDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of printable(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

export async function renderInvoicePdf(inv: InvoiceForPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Invoice ${inv.number}`);
  doc.setAuthor(printable(inv.supplier.trading_name ?? ""));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 50;
  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, size = 10, f = font, color = INK) => page.drawText(printable(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, size = 10, f = font, color = INK) =>
    page.drawText(printable(s), { x: xr - f.widthOfTextAtSize(printable(s), size), y, size, font: f, color });
  const ensure = (h: number) => {
    if (y - h < M + 40) {
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };
  const block = (lines: string[], x: number, size = 10, color = INK) => {
    for (const l of lines) {
      text(l, x, size, font, color);
      y -= size + 4;
    }
  };

  // Header: supplier left, INVOICE right.
  text(inv.supplier.trading_name ?? "", M, 18, bold);
  right("INVOICE", W - M, 18, bold);
  y -= 24;
  const top = y;
  const supplierLines = [
    inv.supplier.legal_name && inv.supplier.legal_name !== inv.supplier.trading_name
      ? `${inv.supplier.legal_name}${inv.supplier.legal_form ? ` (${inv.supplier.legal_form})` : ""}`
      : inv.supplier.legal_form ?? "",
    ...(inv.supplier.address ?? "").split("\n"),
    inv.supplier.email ?? "",
    inv.supplier.phone ?? "",
  ].filter(Boolean);
  block(supplierLines, M, 9, MUTED);
  const afterSupplier = y;

  y = top;
  for (const [k, v] of [
    ["Invoice number", inv.number],
    ["Issue date", ukDate(inv.issue_date)],
    ["Due date", ukDate(inv.due_date)],
  ]) {
    right(`${k}: ${v}`, W - M, 9, k === "Invoice number" ? bold : font);
    y -= 13;
  }
  y = Math.min(y, afterSupplier) - 18;

  text("Bill to", M, 9, bold, MUTED);
  y -= 14;
  block([inv.customer.name ?? "", ...(inv.customer.address ?? "").split("\n"), inv.customer.email ?? ""].filter(Boolean), M, 10);
  if (inv.service_period) {
    y -= 4;
    text(`Service period: ${inv.service_period}`, M, 9, font, MUTED);
    y -= 14;
  }
  y -= 14;

  // Lines.
  const cols = { desc: M, qty: 360, unit: 450, amount: W - M };
  text("Description", cols.desc, 9, bold, MUTED);
  right("Qty", cols.qty + 20, 9, bold, MUTED);
  right("Unit price", cols.unit + 40, 9, bold, MUTED);
  right("Amount", cols.amount, 9, bold, MUTED);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: RULE });
  y -= 16;
  for (const it of inv.items) {
    const lines = wrap(it.description, font, 10, cols.qty - cols.desc - 40);
    ensure(lines.length * 14 + 10);
    right(String(it.quantity), cols.qty + 20);
    right(formatPence(it.unit_pence), cols.unit + 40);
    right(formatPence(it.quantity * it.unit_pence), cols.amount);
    for (const l of lines) {
      text(l, cols.desc);
      y -= 14;
    }
    y -= 4;
  }
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: RULE });
  y -= 12;

  ensure(80);
  const totalRow = (k: string, v: string, f = font, size = 10) => {
    right(k, cols.unit + 40, size, f);
    right(v, cols.amount, size, f);
    y -= size + 6;
  };
  totalRow("Subtotal", formatPence(inv.subtotal_pence));
  if (inv.discount_pence) totalRow("Discount", `-${formatPence(inv.discount_pence)}`);
  totalRow("Total due", formatPence(inv.total_pence), bold, 12);
  y -= 4;
  text("Not VAT registered. No VAT is charged.", M, 9, font, MUTED);
  y -= 13;
  if (inv.credits_purchased) {
    text(`Includes ${inv.credits_purchased} coaching session${inv.credits_purchased === 1 ? "" : "s"}.`, M, 9, font, MUTED);
    y -= 13;
  }
  y -= 14;

  ensure(90);
  text("How to pay", M, 10, bold);
  y -= 15;
  const pi = inv.payment_instructions;
  block(
    [
      pi.account_name ? `Account name: ${pi.account_name}` : "",
      pi.sort_code ? `Sort code: ${pi.sort_code}` : "",
      pi.account_number ? `Account number: ${pi.account_number}` : "",
      `Reference: ${inv.number}`,
      pi.note ?? "",
    ].filter(Boolean),
    M,
    10
  );

  if (inv.notes) {
    y -= 10;
    const lines = wrap(inv.notes, font, 9, W - 2 * M);
    ensure(lines.length * 13 + 10);
    block(lines, M, 9, MUTED);
  }

  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    const footer = printable(`${inv.supplier.trading_name ?? ""} · Invoice ${inv.number} · Page ${i + 1} of ${pages.length}`);
    pg.drawText(footer, { x: M, y: 30, size: 8, font, color: MUTED });
  });
  return doc.save();
}
