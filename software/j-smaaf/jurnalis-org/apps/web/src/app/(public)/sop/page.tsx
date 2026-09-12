import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { getPublicSop } from '@/lib/server-api'

export const metadata = { title: 'SOP' }

export default async function SopPage() {
  const data = await getPublicSop()
  const docs = data?.data ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Standar Operasional Prosedur</h1>
      <p className="mt-2 text-muted-foreground">Panduan kerja dan standar redaksi Jurnalis Org.</p>
      {docs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Belum ada dokumen SOP yang dipublikasikan.</p>
      ) : (
        <Accordion type="single" collapsible className="mt-8">
          {docs.map((doc) => (
            <AccordionItem key={doc.id} value={doc.id}>
              <AccordionTrigger>{doc.title}</AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{doc.content}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}
