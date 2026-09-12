'use client'

import imageCompression from 'browser-image-compression'

// RULE-008: setiap upload gambar HARUS dikompres dulu di client
export async function compressImages(files: File[], maxSizeMB = 0.5): Promise<File[]> {
  return Promise.all(
    files.map(async (file) => {
      if (!file.type.startsWith('image/')) return file
      return imageCompression(file, {
        maxSizeMB,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })
    }),
  )
}
