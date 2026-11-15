import nodemailer from 'nodemailer'
import { transferEmailHtml } from './templates/transferEmail'

const transporter = nodemailer.createTransport({
  host: 'smtppro.zoho.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.ZOHO_SMTP_USER!,
    pass: process.env.ZOHO_SMTP_PASS!,
  },
})

export interface TransferEmailArgs {
  toEmail: string
  senderDisplayName: string
  eventName: string
  eventDate: string
  venue: string
  seatList: string
  transferId: string
}

export async function sendTransferEmail(args: TransferEmailArgs): Promise<void> {
  try {
    await transporter.sendMail({
      from: `"Ticketmaster" <${process.env.ZOHO_SMTP_USER!}>`,
      to: args.toEmail,
      subject: `${args.senderDisplayName} sent you tickets`,
      html: transferEmailHtml({
        senderName: args.senderDisplayName,
        eventName: args.eventName,
        eventDate: args.eventDate,
        venue: args.venue,
        seatList: args.seatList,
        acceptUrl: 'https://www.ticketmaster.com/ticket-transfer',
        declineUrl: '',
      }),
    })
  } catch (err: any) {
    throw new Error(`Zoho SMTP send failed: ${err.message}`)
  }
}