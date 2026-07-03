import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getItemValue(name: string, category?: string): number {
  const title = name.toLowerCase()
  const cat = (category || '').toLowerCase()
  if (title.includes('dell') || title.includes('latitude') || title.includes('macbook')) return 35000
  if (title.includes('chair') || title.includes('ergonomic')) return 5500
  if (title.includes('projector') || title.includes('epson')) return 18900
  if (title.includes('printer') || title.includes('laserjet')) return 8900
  if (title.includes('ipad') || title.includes('tablet')) return 16900
  if (cat.includes('it') || cat.includes('tech') || cat.includes('คอม')) return 12000
  if (cat.includes('เฟอร์') || cat.includes('โต๊ะ') || cat.includes('เก้าอี้')) return 3000
  if (cat.includes('av')) return 9000
  return 1500
}
