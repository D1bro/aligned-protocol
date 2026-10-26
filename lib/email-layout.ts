// The one look shared by every email the Aligned Protocol sends: the console's
// emails (lib/messages.ts), the check-in reminder, and the Supabase sign-in
// emails (built into supabase/email-templates by scripts/build-email-templates.ts).
//
// Email-safe on purpose: tables, inline styles, a hosted logo, system fonts,
// 600px wide, and it reads as plain text where images are blocked.

export const LOGO_URL = "https://www.the-aligned.com/brand/aligned-logo.png";
export const MOTTO = "Alignment is the foundation. Action is the transformation.";

const C = {
  page: "#EFEEEA",
  card: "#FFFFFF",
  band: "#100F18",
  gold: "#D3A758",
  ink: "#1C1B22",
  ink2: "#55535E",
  ink3: "#8A8793",
  rule: "#E6E3DC",
  soft: "#F7F5F0",
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Body blocks. Text is escaped here; `raw` is for Supabase's {{ }} placeholders.
export type Block =
  | { p: string }
  | { small: string }
  | { button: { href: string; label: string } }
  | { steps: { title: string; text: string }[] }
  | { box: string[] }
  | { quote: string }
  | { signOff: string }
  | { smallLink: { lead: string; label: string; href: string } };

const nl = (s: string) => esc(s).replace(/\n/g, "<br>");

function block(b: Block): string {
  if ("p" in b) return `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${C.ink}">${nl(b.p)}</p>`;
  if ("small" in b) return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${C.ink3}">${nl(b.small)}</p>`;
  if ("button" in b) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="background:${C.gold};border-radius:10px">
<a href="${esc(b.button.href)}" style="display:inline-block;padding:14px 26px;font-family:${FONT};font-size:16px;font-weight:700;color:${C.band};text-decoration:none;border-radius:10px">${esc(b.button.label)}</a>
</td></tr></table>`;
  }
  if ("steps" in b) {
    const rows = b.steps
      .map(
        (s, i) => `<tr>
<td valign="top" style="padding:0 14px 14px 0;width:30px"><div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${C.band};color:${C.gold};font-size:13px;font-weight:700;text-align:center">${i + 1}</div></td>
<td valign="top" style="padding:3px 0 14px 0;font-size:15px;line-height:1.55;color:${C.ink2}"><strong style="color:${C.ink}">${esc(s.title)}</strong>${s.text ? `<br>${nl(s.text)}` : ""}</td>
</tr>`
      )
      .join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 12px;width:100%">${rows}</table>`;
  }
  if ("box" in b) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;width:100%"><tr><td style="background:${C.soft};border:1px solid ${C.rule};border-radius:10px;padding:16px 18px;font-size:15px;line-height:1.7;color:${C.ink}">${b.box.map(nl).join("<br>")}</td></tr></table>`;
  }
  if ("quote" in b) {
    return `<p style="margin:0 0 18px;padding:2px 0 2px 14px;border-left:3px solid ${C.gold};font-size:15px;line-height:1.65;color:${C.ink2};font-style:italic">${nl(b.quote)}</p>`;
  }
  if ("smallLink" in b) {
    return `<p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:${C.ink3}">${nl(b.smallLink.lead)} <a href="${esc(b.smallLink.href)}" style="color:${C.ink3}">${esc(b.smallLink.label)}</a>.</p>`;
  }
  return `<p style="margin:8px 0 0;font-size:16px;line-height:1.6;color:${C.ink}">${nl(b.signOff)}</p>`;
}

export function renderEmail(input: {
  preheader: string; // the grey preview line inboxes show after the subject
  heading: string;
  blocks: Block[];
  footerNote?: string; // why they're getting it, or what to do if it wasn't them
}): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(input.heading)}</title></head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.page}">${esc(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page}"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FONT}">
<tr><td align="center" style="background:${C.band};border-radius:16px 16px 0 0;padding:26px 24px 20px">
<img src="${LOGO_URL}" width="104" height="104" alt="Aligned" style="display:block;width:104px;height:104px;border:0">
</td></tr>
<tr><td style="background:${C.card};padding:34px 36px 30px;border-radius:0 0 16px 16px">
<h1 style="margin:0 0 18px;font-size:24px;line-height:1.3;font-weight:700;color:${C.ink};letter-spacing:-0.2px">${esc(input.heading)}</h1>
${input.blocks.map(block).join("\n")}
</td></tr>
<tr><td align="center" style="padding:22px 20px 6px;font-size:13px;line-height:1.6;color:${C.ink3}">
<em style="color:${C.ink2}">${esc(MOTTO)}</em><br>
Aligned · <a href="https://www.the-aligned.com" style="color:${C.ink3}">the-aligned.com</a>
${input.footerNote ? `<br><span style="font-size:12px">${nl(input.footerNote)}</span>` : ""}
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// The same email as plain text, for clients that don't show HTML.
export function renderText(input: { heading: string; blocks: Block[]; footerNote?: string }): string {
  const parts: string[] = [input.heading];
  for (const b of input.blocks) {
    if ("p" in b) parts.push(b.p);
    else if ("small" in b) parts.push(b.small);
    else if ("button" in b) parts.push(`${b.button.label}: ${b.button.href}`);
    else if ("steps" in b) parts.push(b.steps.map((s, i) => `${i + 1}. ${s.title}${s.text ? `: ${s.text}` : ""}`).join("\n"));
    else if ("box" in b) parts.push(b.box.join("\n"));
    else if ("quote" in b) parts.push(b.quote);
    else if ("smallLink" in b) parts.push(`${b.smallLink.lead} ${b.smallLink.label}: ${b.smallLink.href}`);
    else parts.push(b.signOff);
  }
  parts.push(`— ${MOTTO}\nAligned · www.the-aligned.com${input.footerNote ? `\n${input.footerNote}` : ""}`);
  return parts.join("\n\n");
}
