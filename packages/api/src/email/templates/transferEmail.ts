export interface TransferEmailData {
  senderName: string;
  eventName: string;
  eventDate: string;
  venue: string;
  seatList: string;
  acceptUrl: string;
  declineUrl: string;
}

export type TransferEmailTemplateArgs = TransferEmailData;

export function transferEmailHtml(d: TransferEmailData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${d.senderName} sent you tickets</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background-color:#026cdf;padding:20px 24px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;text-transform:lowercase;">ticketmaster</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 20px 0;font-size:20px;line-height:1.3;color:#111827;font-weight:700;">Your Ticket Transfer From ${d.senderName} - Is Ready To Be Accepted!</h1>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
                <tr>
                  <td align="center" width="33%" style="padding:8px 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#026cdf;color:#ffffff;font-weight:700;display:inline-block;line-height:32px;text-align:center;margin-bottom:6px;">&#10003;</div>
                    <div style="font-size:12px;font-weight:700;color:#111827;">Received</div>
                  </td>
                  <td align="center" width="33%" style="padding:8px 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#d1d5db;color:#6b7280;font-weight:700;display:inline-block;line-height:32px;text-align:center;margin-bottom:6px;">&#9679;</div>
                    <div style="font-size:12px;font-weight:400;color:#6b7280;">Accepted</div>
                  </td>
                  <td align="center" width="33%" style="padding:8px 4px;">
                    <div style="width:32px;height:32px;border-radius:50%;background-color:#d1d5db;color:#6b7280;font-weight:700;display:inline-block;line-height:32px;text-align:center;margin-bottom:6px;">&#9679;</div>
                    <div style="font-size:12px;font-weight:400;color:#6b7280;">Complete</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:6px;">${d.eventName}</div>
                    <div style="font-size:14px;color:#374151;margin-bottom:4px;">${d.eventDate}</div>
                    <div style="font-size:14px;color:#374151;margin-bottom:10px;">${d.venue}</div>
                    <div style="font-size:14px;font-weight:600;color:#026cdf;">${d.seatList}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
                <tr>
                  <td align="center" style="border-radius:4px;background-color:#026cdf;">
                    <a href="${d.acceptUrl}" style="display:block;padding:16px 22px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;text-align:center;">ACCEPT TICKETS</a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#374151;font-style:italic;">This email is NOT your ticket. You must click the button below, log in or create an account, and accept the tickets to access them.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid #e5e7eb;border-radius:8px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:14px;font-weight:700;color:#111827;margin-bottom:6px;">Transfer Status: Received</div>
                    <div style="font-size:13px;color:#374151;">Your transfer has been received and is ready to be accepted.</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px 0;border-top:1px solid #e5e7eb;">
                <tr>
                  <td width="50%" valign="top" style="padding:16px 8px 0 0;">
                    <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px;">We're here to help</div>
                    <div style="font-size:12px;color:#6b7280;line-height:1.5;">Visit our Help Center for answers to common questions.</div>
                  </td>
                  <td width="50%" valign="top" style="padding:16px 0 0 8px;">
                    <div style="font-size:13px;font-weight:700;color:#111827;margin-bottom:6px;">Ticketmaster</div>
                    <div style="font-size:12px;color:#6b7280;line-height:1.5;">Attn: Fan Support<br/>1000 Corporate Landing<br/>Charleston, WV 25311</div>
                    <div style="font-size:12px;color:#6b7280;margin-top:6px;">&copy; 2025 Ticketmaster, All rights reserved.</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
