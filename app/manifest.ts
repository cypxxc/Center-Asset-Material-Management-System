import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CAMMS — ระบบบริหารจัดการพัสดุและสินทรัพย์ส่วนกลาง',
    short_name: 'CAMMS',
    description: 'ระบบบริหารจัดการพัสดุและสินทรัพย์ส่วนกลางสำหรับหน่วยงาน',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#0f172a',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
