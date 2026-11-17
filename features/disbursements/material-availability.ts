export function materialAvailability(stock: number) {
  return { stock_quantity: stock, reserved_quantity: 0, available_quantity: Math.max(0, stock) }
}

export function assertMaterialQuantity(name: string, requested: number, available: number, unit = 'หน่วย') {
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > 2147483647) throw new Error('จำนวนขอเบิกต้องเป็นจำนวนเต็มตั้งแต่ 1 และไม่เกินขอบเขตที่ระบบรองรับ')
  if (requested > available) throw new Error(`${name} พร้อมจ่าย ${available} ${unit} แต่ขอเบิก ${requested} ${unit}`)
}
