export const ROLES = ['anggota', 'pengurus', 'bendahara', 'redaktur', 'ketua', 'alumni', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const PENGURUS_OR_ABOVE = ['pengurus', 'bendahara', 'redaktur', 'ketua', 'admin'] as const
export const ADMIN_OR_KETUA = ['admin', 'ketua'] as const
export const FINANCE_READ = ['bendahara', 'ketua', 'admin'] as const
export const FINANCE_WRITE = ['bendahara', 'admin'] as const
export const EDITORIAL_ACCESS = ['redaktur', 'ketua', 'admin'] as const
export const ANALYTICS_ACCESS = ['pengurus', 'bendahara', 'redaktur', 'ketua', 'admin'] as const

export const TASK_WEIGHTS: Record<string, number> = {
  liputan: 10,
  editing: 5,
  desain: 8,
  foto: 7,
  video: 12,
  administrasi: 3,
  lainnya: 5,
}

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu',
  in_progress: 'Dikerjakan',
  review: 'Review',
  revision: 'Revisi',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
}

export const TASK_TYPE_LABELS: Record<string, string> = {
  liputan: 'Liputan',
  editing: 'Editing',
  desain: 'Desain',
  foto: 'Foto',
  video: 'Video',
  administrasi: 'Administrasi',
  lainnya: 'Lainnya',
}

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Menunggu',
  review: 'Review',
  revision: 'Revisi',
  published: 'Terbit',
  archived: 'Arsip',
}

export const CONTENT_CATEGORY_LABELS: Record<string, string> = {
  sma: 'SMA',
  jurnal: 'Jurnal',
  liputan: 'Liputan',
  mading: 'Mading',
}

export const EDITORIAL_STAGES = [
  { value: 'draft', label: 'Ide/Draft' },
  { value: 'pending', label: 'Research' },
  { value: 'review', label: 'Review' },
  { value: 'revision', label: 'Revisi' },
  { value: 'published', label: 'Publish' },
] as const

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpha: 'Alpha',
}

export const MEETING_TYPE_LABELS: Record<string, string> = {
  rutin: 'Rutin',
  rapat: 'Rapat',
  workshop: 'Workshop',
  liputan: 'Liputan',
  lainnya: 'Lainnya',
}

export const FINANCE_STATUS_LABELS: Record<string, string> = {
  pending: 'Menunggu Approval',
  approved: 'Disetujui',
  rejected: 'Ditolak',
}

export const ROLE_LABELS: Record<string, string> = {
  anggota: 'Anggota',
  pengurus: 'Pengurus',
  bendahara: 'Bendahara',
  redaktur: 'Redaktur',
  ketua: 'Ketua',
  alumni: 'Alumni',
  admin: 'Admin',
}

export const PAGE_SIZES = {
  tasks: 20,
  projects: 12,
  content: 15,
  news: 9,
  notifications: 20,
  pitches: 15,
  assets: 24,
  alumni: 24,
  finance: 20,
} as const
