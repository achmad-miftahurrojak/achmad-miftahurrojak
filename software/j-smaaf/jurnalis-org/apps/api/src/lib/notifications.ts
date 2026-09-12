import type { FastifyInstance } from 'fastify'
import { prisma } from './prisma'
import { sendWhatsApp } from './whatsapp'
import { sendEmail } from './email'

interface NotificationPayload {
  recipient_id: string
  type: string
  title: string
  message: string
  data?: Record<string, unknown>
  channel?: 'in_app' | 'whatsapp' | 'email'
}

// Rate limit berbasis DB (bukan in-memory): maks 5 notifikasi tipe sama ke user yang sama per 5 menit
async function isRateLimited(recipientId: string, type: string): Promise<boolean> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const count = await prisma.notification.count({
    where: {
      recipient_id: recipientId,
      type,
      created_at: { gte: fiveMinutesAgo },
    },
  })
  return count >= 5
}

export async function sendNotification(fastify: FastifyInstance, payload: NotificationPayload): Promise<void> {
  const channel = payload.channel ?? 'in_app'

  try {
    if (await isRateLimited(payload.recipient_id, payload.type)) {
      fastify.log.info({ recipient: payload.recipient_id, type: payload.type }, '[notifications] rate-limited, skipped')
      return
    }

    const recipient = await prisma.user.findUnique({
      where: { id: payload.recipient_id },
      select: { id: true, email: true, phone: true, wa_notifications: true, email_notifications: true },
    })
    if (!recipient) return

    const notification = await prisma.notification.create({
      data: {
        recipient_id: payload.recipient_id,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        data: (payload.data ?? {}) as never,
        channel,
        status: channel === 'in_app' ? 'sent' : 'pending',
        sent_at: channel === 'in_app' ? new Date() : null,
      },
    })

    if (channel === 'in_app') {
      fastify.pushToUser(payload.recipient_id, 'notification:new', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: payload.data ?? {},
        created_at: notification.created_at.toISOString(),
      })
      return
    }

    let sent = false
    if (channel === 'whatsapp' && recipient.wa_notifications && recipient.phone) {
      sent = await sendWhatsApp(recipient.phone, `*${payload.title}*\n\n${payload.message}`)
    }
    if (!sent && recipient.email_notifications) {
      sent = await sendEmail(
        recipient.email,
        payload.title,
        `<h2>${payload.title}</h2><p>${payload.message}</p>`,
      )
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: sent ? 'sent' : 'failed', sent_at: sent ? new Date() : null },
    })
  } catch (err) {
    fastify.log.error({ err, payload }, '[notifications] gagal mengirim notifikasi')
  }
}

export async function sendTaskAssigned(
  fastify: FastifyInstance,
  params: { recipientId: string; taskTitle: string; taskId: string; dueDate?: string | null },
): Promise<void> {
  await sendNotification(fastify, {
    recipient_id: params.recipientId,
    type: 'task_assigned',
    title: 'Tugas Baru',
    message: `Kamu ditugaskan: ${params.taskTitle}${params.dueDate ? ` (deadline ${params.dueDate})` : ''}`,
    data: { task_id: params.taskId, url: `/tasks/${params.taskId}` },
  })
}

export async function sendTaskStatusChange(
  fastify: FastifyInstance,
  params: { recipientId: string; taskTitle: string; taskId: string; newStatus: string },
): Promise<void> {
  await sendNotification(fastify, {
    recipient_id: params.recipientId,
    type: 'task_status',
    title: 'Status Tugas Berubah',
    message: `Tugas "${params.taskTitle}" sekarang berstatus ${params.newStatus}`,
    data: { task_id: params.taskId, url: `/tasks/${params.taskId}` },
  })
}

export async function sendMeetingReminder(
  fastify: FastifyInstance,
  params: { recipientId: string; meetingTitle: string; meetingId: string; startTime: string },
): Promise<void> {
  await sendNotification(fastify, {
    recipient_id: params.recipientId,
    type: 'meeting_reminder',
    title: 'Pengingat Kegiatan',
    message: `${params.meetingTitle} dimulai ${params.startTime}`,
    data: { meeting_id: params.meetingId, url: '/schedule' },
  })
}

export async function sendFinancePendingApproval(
  fastify: FastifyInstance,
  params: { financeId: string; description: string; amount: number },
): Promise<void> {
  try {
    const approvers = await prisma.user.findMany({
      where: { role: { in: ['ketua', 'admin'] }, is_active: true },
      select: { id: true },
    })
    await Promise.all(
      approvers.map((a) =>
        sendNotification(fastify, {
          recipient_id: a.id,
          type: 'finance_pending',
          title: 'Transaksi Menunggu Approval',
          message: `${params.description} — Rp ${params.amount.toLocaleString('id-ID')}`,
          data: { finance_id: params.financeId, url: '/finance' },
        }),
      ),
    )
  } catch (err) {
    fastify.log.error({ err }, '[notifications] gagal kirim finance pending approval')
  }
}
