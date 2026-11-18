export interface TransferEmailTemplateArgs {
  senderName: string
  eventName: string
  eventDate: string
  venue: string
  seatList: string
  acceptUrl: string
  declineUrl: string
}

export function transferEmailHtml(args: TransferEmailTemplateArgs): string {
  const { senderName, eventName, eventDate, venue, seatList } = args;
  const acceptUrl = "https://www.ticketmaster.com/ticket-transfer";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${senderName} sent you tickets</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e7eb;">
          <tr>
            <td style="background-color:#026cdf;padding:20px 24px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;text-transform:lowercase;">ticketmaster</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#374151;">${senderName} sent you tickets</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;border:1px solid #e5e7eb;border-radius:4px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <div style="font-size:18px;font-weight:700;color:#111827;margin-bottom:6px;">${eventName}</div>
                    <div style="font-size:14px;color:#374151;margin-bottom:4px;">${eventDate}</div>
                    <div style="font-size:14px;color:#374151;margin-bottom:10px;">${venue}</div>
                    <div style="font-size:14px;font-weight:600;color:#026cdf;">${seatList}</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 20px 0;font-size:13px;line-height:1.6;color:#374151;font-style:italic;">This email is NOT your ticket. You must click the button below, log in or create an account, and accept the tickets to access them.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px 0;">
                <tr>
                  <td align="center" style="border-radius:4px;background-color:#026cdf;">
                    <a href="https://www.ticketmaster.com/ticket-transfer" style="display:inline-block;padding:14px 22px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:4px;">Accept Tickets</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">Do not reply to this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
