import { redirect } from 'next/navigation'

// Keep existing bookmarks and printed QR codes pointing to the item registry.
export default function ItemPage() {
  redirect('/items')
}
