import { getSiteUrl } from "@/lib/env";
import type { NotificationEmailContent } from "@/lib/notifications/types";

/**
 * Transactional email rendering: one structured content model (built in content.ts) rendered two
 * ways, a plain-text part and an HTML part, both sent on every message.
 *
 * ## Why the palette is hardcoded here
 *
 * This is the one file in the app allowed to contain raw hex values, and the design contract's
 * "no hardcoded hex" rule cannot apply to it: email clients do not support CSS custom properties,
 * external stylesheets, or class selectors reliably, so every color has to be an inline literal.
 * Agent 1's hex-check script must exclude this file (filed in docs/contracts/requests.md).
 *
 * ## Why it is light-theme only, and solid
 *
 * Per the V3 brief: email gets no glass. backdrop-filter does not exist in any email client, and a
 * translucent surface over a background image degrades to unreadable in the ones that partially
 * support it. So: solid light canvas, solid white card, one purple CTA, champagne reserved for
 * warnings. The values are the V3 light theme's ("aurora glass") semantic colors, transcribed.
 *
 * `color-scheme: light` is declared in both meta tags and on the body. Without it Gmail and
 * Outlook.com auto-invert a light email in dark mode by rewriting colors, which reliably ruins a
 * white-card layout (light text ends up on light backgrounds). Declaring the scheme opts out.
 *
 * ## Contrast
 *
 * White on the purple CTA is 5.15:1, clears AA. White on champagne (accentWarn) would fail badly,
 * so champagne never gets a solid fill with white text on it here: warnings are dark text on a
 * pale champagne tint with a champagne left rule, which is 16:1+. See the note filed to Agent 1 in
 * docs/contracts/requests.md, since the shared V3 spec's blanket "white on primary and warn fills"
 * does not hold for warn in either theme.
 *
 * ## Structure
 *
 * Tables with inline styles, not divs with a stylesheet: Outlook's Word rendering engine ignores
 * most modern layout CSS. Nothing here depends on border-radius, flexbox, or web fonts rendering;
 * where they are unsupported the layout degrades to square corners and a system font, which is
 * fine, rather than collapsing.
 */

const COLOR = {
  canvas: "#F4F4F7",
  card: "#FFFFFF",
  well: "#F7F7FA",
  hairline: "#E6E6EC",
  accentPrimary: "#6D4AFF",
  // V4.1 champagne addendum: the orange family is retired for a champagne-amber one. #82620F is
  // the corrected light-theme text/rule shade (docs/contracts/requests.md and tokens.css's own
  // comment: the addendum's literal #B08514 measures 3.38:1 on white, fails 4.5:1, darkened along
  // the same hue to clear it). accentWarnTint is a proportional pale wash of that same hue.
  accentWarn: "#82620F",
  accentWarnTint: "#FCF5E4",
  textPrimary: "#17171C",
  textSecondary: "#5F5F6B",
  onAccent: "#FFFFFF",
} as const;

const FONT_SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_MONO =
  "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/**
 * Every interpolated value below is user-authored (event names, shift titles, locations, a member's
 * own display name), so all of it is escaped. Quotes are included because some of these values land
 * in the preheader, which sits inside an attribute-adjacent context in a few clients' rewriting.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * App-relative path -> absolute URL. Email has no document base, so every link must be absolute.
 * A path that is already absolute is passed through, so a caller can link somewhere off-app.
 */
function absoluteUrl(path: string, siteUrl: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Plain-text part. Kept as the primary readable fallback, not an afterthought: it is what a
 * text-only client, a screen reader in plain-text mode, and most spam filters actually read.
 * Deliberately unchanged in shape from the pre-V3 text emails, since nothing about it was broken.
 */
export function renderNotificationEmailText(
  content: NotificationEmailContent,
  siteUrl: string = getSiteUrl(),
): string {
  const blocks: string[] = [content.greeting];

  if (content.intro.length > 0) {
    blocks.push(content.intro.join("\n"));
  }

  if (content.warning) {
    blocks.push(content.warning);
  }

  if (content.details.length > 0) {
    blocks.push(content.details.map((detail) => `${detail.label}: ${detail.value}`).join("\n"));
  }

  // Absolute, same as the HTML part: a bare "/my-schedule" is not clickable and not resolvable in
  // a mail client, which has no document base to resolve it against.
  blocks.push(`${content.cta.label}: ${absoluteUrl(content.cta.path, siteUrl)}`);

  return blocks.join("\n\n");
}

function renderDetailRow(detail: NotificationEmailContent["details"][number]): string {
  const valueFont = detail.mono ? FONT_MONO : FONT_SANS;

  return `
                <tr>
                  <td style="padding:0 0 14px 0;">
                    <div style="margin:0 0 2px 0;font-family:${FONT_SANS};font-size:11px;font-weight:600;line-height:16px;letter-spacing:0.06em;text-transform:uppercase;color:${COLOR.textSecondary};">${escapeHtml(detail.label)}</div>
                    <div style="margin:0;font-family:${valueFont};font-size:15px;line-height:22px;color:${COLOR.textPrimary};">${escapeHtml(detail.value)}</div>
                  </td>
                </tr>`;
}

function renderWarning(warning: string): string {
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="background-color:${COLOR.accentWarnTint};border-left:3px solid ${COLOR.accentWarn};border-radius:12px;padding:12px 14px;font-family:${FONT_SANS};font-size:14px;line-height:20px;color:${COLOR.textPrimary};">${escapeHtml(warning)}</td>
                </tr>
              </table>`;
}

function renderDetails(details: NotificationEmailContent["details"]): string {
  if (details.length === 0) return "";

  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px 0;">
                <tr>
                  <td style="background-color:${COLOR.well};border-radius:16px;padding:16px 18px 2px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${details
                      .map(renderDetailRow)
                      .join("")}
                    </table>
                  </td>
                </tr>
              </table>`;
}

export function renderNotificationEmailHtml(
  content: NotificationEmailContent,
  siteUrl: string = getSiteUrl(),
): string {
  const ctaUrl = absoluteUrl(content.cta.path, siteUrl);
  const settingsUrl = absoluteUrl("/settings/notifications", siteUrl);
  // The preheader is the grey line an inbox shows after the subject. Left to itself it picks up the
  // greeting ("Hi Jane,"), which is wasted space, so the lead sentence is used instead.
  const preheader = content.intro[0] ?? content.subject;

  const intro = content.intro
    .map(
      (paragraph) =>
        `
              <p style="margin:0 0 16px 0;font-family:${FONT_SANS};font-size:15px;line-height:23px;color:${COLOR.textPrimary};">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(content.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${COLOR.canvas};color-scheme:light;">
    <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${COLOR.canvas};">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLOR.canvas};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 6px 14px 6px;font-family:${FONT_SANS};font-size:14px;font-weight:600;line-height:20px;letter-spacing:0.01em;color:${COLOR.textSecondary};">prog scheduler</td>
            </tr>
            <tr>
              <td style="background-color:${COLOR.card};border:1px solid ${COLOR.hairline};border-radius:24px;padding:28px 28px 26px 28px;">
              <p style="margin:0 0 16px 0;font-family:${FONT_SANS};font-size:15px;line-height:23px;color:${COLOR.textPrimary};">${escapeHtml(content.greeting)}</p>${intro}${content.warning ? renderWarning(content.warning) : ""}${renderDetails(content.details)}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${COLOR.accentPrimary}" style="border-radius:999px;">
                    <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-family:${FONT_SANS};font-size:15px;font-weight:600;line-height:20px;color:${COLOR.onAccent};text-decoration:none;border-radius:999px;">${escapeHtml(content.cta.label)}</a>
                  </td>
                </tr>
              </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 6px 0 6px;font-family:${FONT_SANS};font-size:12px;line-height:18px;color:${COLOR.textSecondary};">
                You get this because you are on a progsu schedule. <a href="${escapeHtml(settingsUrl)}" style="color:${COLOR.accentPrimary};text-decoration:underline;">Change what you are emailed about</a>.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
