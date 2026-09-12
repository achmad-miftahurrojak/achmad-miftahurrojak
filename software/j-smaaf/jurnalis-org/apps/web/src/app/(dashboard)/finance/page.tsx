'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, Plus, TrendingDown, TrendingUp, Wallet, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { FinanceForm } from '@/components/finance/finance-form'
import { FinanceTable } from '@/components/finance/finance-table'
import { useFinanceList, useFinanceSummary } from '@/hooks/use-finance'
import { useUser } from '@/hooks/use-user'
import { formatRupiah } from '@/lib/utils'
import { apiFetch } from '@/lib/api-client'
import { toast } from 'sonner'
import { FINANCE_WRITE } from '@jurnalis-org/shared/constants'

function FinanceContent() {
  const searchParams = useSearchParams()
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1))
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const { data: summary, isLoading: loadingSummary } = useFinanceSummary()
  const { data, isLoading } = useFinanceList(page, status === 'all' ? undefined : status)
  const { data: user } = useUser()
  const canWrite = user ? (FINANCE_WRITE as readonly string[]).includes(user.role) : false

  async function handleExport() {
    const res = await apiFetch('/api/finance/export')
    if (!res.ok) {
      toast.error('Export gagal')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'laporan-keuangan.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const cards = [
    { label: 'Saldo', value: summary?.balance ?? 0, icon: Wallet, color: 'text-primary' },
    { label: 'Total Pemasukan', value: summary?.totalIn ?? 0, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Total Pengeluaran', value: summary?.totalOut ?? 0, icon: TrendingDown, color: 'text-destructive' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Keuangan</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void handleExport()}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          {canWrite && (
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Catat Transaksi</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Transaksi Baru</DialogTitle></DialogHeader>
                <FinanceForm onDone={() => setFormOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loadingSummary ? (
        <LoadingSkeleton rows={1} />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <c.icon className={`mb-2 h-5 w-5 ${c.color}`} />
                <p className="text-lg font-bold sm:text-xl">{formatRupiah(c.value)}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {(summary?.pendingCount ?? 0) > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          <Clock className="h-4 w-4" />
          {summary!.pendingCount} transaksi menunggu approval ketua
        </div>
      )}

      <Tabs value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
        <TabsList>
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Disetujui</TabsTrigger>
          <TabsTrigger value="rejected">Ditolak</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : !data || data.data.length === 0 ? (
        <EmptyState icon={Wallet} title="Belum ada transaksi" description="Transaksi yang dicatat bendahara akan muncul di sini." />
      ) : (
        <>
          <FinanceTable transactions={data.data} />
          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
              <span className="text-sm text-muted-foreground">Halaman {page} dari {data.meta.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.meta.totalPages} onClick={() => setPage(page + 1)}>Berikutnya</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function FinancePage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={4} />}>
      <FinanceContent />
    </Suspense>
  )
}
