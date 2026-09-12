import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { getPublicFaqs } from '@/lib/server-api'

export const metadata = { title: 'FAQ' }

export default async function FaqPage() {
  const data = await getPublicFaqs()
  const faqs = data?.data ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Pertanyaan Umum</h1>
      {faqs.length === 0 ? (
        <p className="mt-8 text-muted-foreground">Belum ada FAQ.</p>
      ) : (
        <Accordion type="single" collapsible className="mt-8">
          {faqs.map((faq) => (
            <AccordionItem key={faq.id} value={faq.id}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{faq.answer}</p>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  )
}
