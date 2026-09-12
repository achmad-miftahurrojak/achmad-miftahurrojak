'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { formatDate, formatRupiah } from '@/lib/utils'
import { useApproveTransaction, type FinanceTransaction } from '@/hooks/use-finance'
import { useUser } from '@/hooks/use-user'
import { ADMIN_OR_KETUA } from '@jurnalis-org/shared/constants'

export function FinanceTable({ transactions }: { transactions: FinanceTransaction[] }) {
  const approve = useApproveTransaction()
  const { data: user } = useUser()
  const canApprove = user ? (ADMIN_OR_KETUA as readonly string[]).includes(user.role) : false

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tanggal</TableHead>
            <TableHead>Deskripsi</TableHead>
            <TableHead className="text-right">Jumlah</TableHead>
            <TableHead>Status</TableHead>
            {canApprove && <TableHead className="w-36">Aksi</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="whitespace-nowrap text-sm">{formatDate(tx.created_at)}</TableCell>
              <TableCell>
                <p className="text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">
                  {tx.category ?? '-'} · oleh {tx.recorder?.full_name ?? '-'}
                  {tx.proof_url && (
                    <> · <a href={tx.proof_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">bukti</a></>
                  )}
                </p>
              </TableCell>
              <TableCell className={`whitespace-nowrap text-right text-sm font-semibold ${tx.type === 'pemasukan' ? 'text-green-600' : 'text-destructive'}`}>
                {tx.type === 'pemasukan' ? '+' : '-'}{formatRupiah(tx.amount)}
              </TableCell>
              <TableCell><StatusBadge status={tx.status} /></TableCell>
              {canApprove && (
                <TableCell>
                  {tx.status === 'pending' && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => approve.mutate({ id: tx.id, action: 'approved' })}>
                        Setujui
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7 text-xs"
                        onClick={() => approve.mutate({ id: tx.id, action: 'rejected' })}>
                        Tolak
                      </Button>
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
