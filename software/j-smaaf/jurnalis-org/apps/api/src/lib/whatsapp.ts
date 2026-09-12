const WA_API_BASE = 'https://graph.facebook.com/v18.0'

export function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = `62${p.slice(1)}`
  if (p.startsWith('620')) p = `62${p.slice(3)}`
  return p
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID
  const accessToken = process.env.META_WA_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) return false

  try {
    const res = await fetch(`${WA_API_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizePhone(to),
        type: 'text',
        text: { body: message },
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
