import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { financeTransactionSchema, financeApprovalSchema } from '@jurnalis-org/shared/validations/finance'
import { FINANCE_READ, FINANCE_WRITE, ADMIN_OR_KETUA, PAGE_SIZES } from '@jurnalis-org/shared/constants'
import { sendFinancePendingApproval } from '../lib/notifications'

export default async function financeRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate, fastify.requireRole(FINANCE_READ)] }, async (request, reply) => {
    const query = request.query as { page?: string; type?: string; status?: string }
    const page = Math.max(1, Number(query.page ?? 1))
    const where: Record<string, unknown> = {}
    if (query.type) where.type = query.type
    if (query.status) where.status = query.status
    try {
      const [items, total] = await Promise.all([
        prisma.finance.findMany({
          where,
          include: {
            recorder: { select: { id: true, full_name: true } },
            approver: { select: { id: true, full_name: true } },
          },
          orderBy: { created_at: 'desc' },
          skip: (page - 1) * PAGE_SIZES.finance,
          take: PAGE_SIZES.finance,
        }),
        prisma.finance.count({ where }),
      ])
      return reply.send({
        data: items.map((f) => ({ ...f, amount: Number(f.amount) })),
        meta: { total, page, totalPages: Math.ceil(total / PAGE_SIZES.finance) },
      })
    } catch (err) {
      fastify.log.error({ err }, '[finance] list gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/summary', { preHandler: [fastify.authenticate, fastify.requireRole(FINANCE_READ)] }, async (_request, reply) => {
    try {
      const agg = await prisma.finance.groupBy({
        by: ['type', 'status'],
        _sum: { amount: true },
        _count: true,
      })
      let totalIn = 0
      let totalOut = 0
      let pendingCount = 0
      for (const row of agg) {
        const amount = Number(row._sum.amount ?? 0)
        if (row.status === 'approved' && row.type === 'pemasukan') totalIn += amount
        if (row.status === 'approved' && row.type === 'pengeluaran') totalOut += amount
        if (row.status === 'pending') pendingCount += row._count
      }
      const monthly = await prisma.$queryRaw<{ month: string; pemasukan: string; pengeluaran: string }[]>`
        SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
               COALESCE(SUM(CASE WHEN type = 'pemasukan' AND status = 'approved' THEN amount END), 0) AS pemasukan,
               COALESCE(SUM(CASE WHEN type = 'pengeluaran' AND status = 'approved' THEN amount END), 0) AS pengeluaran
        FROM finance
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY 1 ORDER BY 1`
      return reply.send({
        balance: totalIn - totalOut,
        totalIn,
        totalOut,
        pendingCount,
        monthly: monthly.map((m) => ({ month: m.month, pemasukan: Number(m.pemasukan), pengeluaran: Number(m.pengeluaran) })),
      })
    } catch (err) {
      fastify.log.error({ err }, '[finance] summary gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireRole(FINANCE_WRITE)] }, async (request, reply) => {
    const parsed = financeTransactionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const tx = await prisma.finance.create({
        data: {
          type: parsed.data.type,
          amount: parsed.data.amount,
          description: parsed.data.description,
          category: parsed.data.category,
          proof_url: parsed.data.proof_url,
          recorded_by: request.currentUser.id,
        },
      })
      await sendFinancePendingApproval(fastify, {
        financeId: tx.id,
        description: tx.description,
        amount: Number(tx.amount),
      })
      return reply.status(201).send({ transaction: { ...tx, amount: Number(tx.amount) } })
    } catch (err) {
      fastify.log.error({ err }, '[finance] create gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.post('/:id/approval', { preHandler: [fastify.authenticate, fastify.requireRole(ADMIN_OR_KETUA)] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = financeApprovalSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Data tidak valid' })
    }
    try {
      const tx = await prisma.finance.findUnique({ where: { id } })
      if (!tx) return reply.status(404).send({ error: 'Transaksi tidak ditemukan' })
      if (tx.status !== 'pending') return reply.status(400).send({ error: 'Transaksi sudah diproses' })
      const updated = await prisma.finance.update({
        where: { id },
        data: {
          status: parsed.data.action,
          approved_by: request.currentUser.id,
          approved_at: new Date(),
        },
      })
      return reply.send({ transaction: { ...updated, amount: Number(updated.amount) } })
    } catch (err) {
      fastify.log.error({ err }, '[finance] approval gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })

  fastify.get('/export', { preHandler: [fastify.authenticate, fastify.requireRole(FINANCE_READ)] }, async (request, reply) => {
    const query = request.query as { from?: string; to?: string }
    const where: Record<string, unknown> = {}
    if (query.from || query.to) {
      where.created_at = {}
      if (query.from) (where.created_at as Record<string, unknown>).gte = new Date(query.from)
      if (query.to) (where.created_at as Record<string, unknown>).lte = new Date(query.to)
    }
    try {
      const items = await prisma.finance.findMany({
        where,
        include: { recorder: { select: { full_name: true } } },
        orderBy: { created_at: 'asc' },
      })
      const rows = items.map((f) =>
        [
          f.created_at.toISOString().slice(0, 10),
          f.type,
          f.description,
          String(Number(f.amount)),
          f.category ?? '',
          f.status,
          f.recorder?.full_name ?? '',
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','),
      )
      const csv = ['"Tanggal","Jenis","Deskripsi","Jumlah","Kategori","Status","Dicatat Oleh"', ...rows].join('\n')
      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Content-Disposition', 'attachment; filename="laporan-keuangan.csv"')
        .send(csv)
    } catch (err) {
      fastify.log.error({ err }, '[finance] export gagal')
      return reply.status(500).send({ error: 'Terjadi kesalahan server' })
    }
  })
}
