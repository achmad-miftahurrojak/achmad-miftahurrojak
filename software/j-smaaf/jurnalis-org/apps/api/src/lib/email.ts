import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) return false
  try {
    const domain = process.env.APP_EMAIL_DOMAIN ?? 'jurnalis.org'
    await resend.emails.send({
      from: `Jurnalis Org <noreply@${domain}>`,
      to,
      subject,
      html,
    })
    return true
  } catch {
    return false
  }
}
