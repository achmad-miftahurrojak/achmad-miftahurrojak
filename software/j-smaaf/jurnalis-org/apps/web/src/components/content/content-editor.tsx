'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, List, ListOrdered, Quote, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Undo, Redo,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ContentEditor({
  content,
  onChange,
  placeholder = 'Tulis konten di sini...',
}: {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
      Image,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: { class: 'ProseMirror' },
    },
  })

  if (!editor) return null

  function addLink() {
    const url = window.prompt('URL link:')
    if (url) editor?.chain().focus().setLink({ href: url }).run()
  }

  function addImage() {
    const url = window.prompt('URL gambar:')
    if (url) editor?.chain().focus().setImage({ src: url }).run()
  }

  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading', { level: 3 }) },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
    { icon: LinkIcon, action: addLink, active: editor.isActive('link') },
    { icon: ImageIcon, action: addImage, active: false },
    { icon: Undo, action: () => editor.chain().focus().undo().run(), active: false },
    { icon: Redo, action: () => editor.chain().focus().redo().run(), active: false },
  ]

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap gap-1 border-b p-1">
        {tools.map((t, i) => (
          <Button key={i} type="button" variant="ghost" size="icon"
            className={`h-8 w-8 ${t.active ? 'bg-accent' : ''}`} onClick={t.action}>
            <t.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
