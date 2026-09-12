// Watermark canvas client-side (Addendum v3.1 Pattern 17)
export async function applyWatermark(file: File, text: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas tidak didukung'))
        return
      }
      ctx.drawImage(img, 0, 0)
      ctx.font = `${Math.max(16, Math.floor(img.width / 25))}px sans-serif`
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.save()
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(-Math.PI / 6)
      ctx.fillText(text, 0, 0)
      ctx.restore()
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Gagal membuat watermark'))
            return
          }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.85,
      )
    }
    img.onerror = () => reject(new Error('Gagal memuat gambar'))
    img.src = URL.createObjectURL(file)
  })
}
