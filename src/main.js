function calculateSimpleRevenue(purchase, product) {
  "use strict"
  const { discount = 0, quantity = 0 } = purchase

  if (typeof discount !== "number" || typeof quantity !== "number") {
    throw new Error("Discount and quantity must be numbers")
  }

  const salePrice = purchase.sale_price ?? product?.sale_price ?? 0
  const decimalDiscount = Math.max(0, Math.min(discount, 100)) / 100 
  const totalBeforeDiscount = salePrice * quantity

  return Math.max(0, totalBeforeDiscount * (1 - decimalDiscount)) 
}
function calculateBonusByProfit(index, total, profit) {
  if (total <= 1 || profit <= 0 || index < 0) return 0

  // Топ-1: 15 % от прибыли
  if (index === 0) {
    return profit * 0.15
  }
  // Места 2–3: 10 % от прибыли
  else if (index === 1 || index === 2) {
    return profit * 0.1
  }
  // Последний продавец: без бонуса
  else if (index === total - 1) {
    return 0
  }
  // Остальные: 5 % от прибыли
  else {
    return profit * 0.05
  }
}
function analyzeSalesData(data, options) {
  // Валидация входных данных
  if (!data || typeof data !== "object") {
    throw new Error("Некорректные входные данные: data должен быть объектом")
  }

  const requiredArrays = ["purchase_records", "sellers", "products"]
  for (const key of requiredArrays) {
    if (!Array.isArray(data[key]) || data[key].length === 0) {
      throw new Error(
        `Некорректные входные данные: ${key} отсутствует или пуст`
      )
    }
  }

  // Проверка функций из options
  const calculateRevenue =
    typeof options?.calculateRevenue === "function"
      ? options.calculateRevenue
      : calculateSimpleRevenue
  const calculateBonus =
    typeof options?.calculateBonus === "function"
      ? options.calculateBonus
      : calculateBonusByProfit

  // Нормализация SKU
  const normalizeSku = (sku) => sku.trim().toLowerCase()

  // Создание индексов
  const productIndex = Object.fromEntries(
    data.products.map((p) => [normalizeSku(p.sku), p])
  )

  // Статистика продавцов
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name || ""} ${seller.last_name || ""}`.trim(),
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }))

  const sellerIndex = Object.fromEntries(
    sellerStats.map((s) => [String(s.id), s])
  )

  // Обработка чеков
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id]
    if (!seller) {
      console.warn(`Продавец с ID ${record.seller_id} не найден`)
      return
    }

    seller.sales_count += 1

    record.items.forEach((item) => {
      const normalizedSku = normalizeSku(item.sku)
      const product = productIndex[normalizedSku]

      if (!product) {
        console.warn(`Продукт с SKU ${item.sku} не найден`)
        return
      }

      const cost = product.purchase_price * item.quantity
      const revenue = calculateRevenue(item, product)
      const profit = revenue - cost

      seller.revenue += revenue
      seller.profit += profit

      const originalSku = product.sku
      seller.products_sold[originalSku] =
        (seller.products_sold[originalSku] || 0) + item.quantity
    })
  })

  // Сортировка и расчёт бонусов
  sellerStats.sort((a, b) => b.profit - a.profit)
  const totalSellers = sellerStats.length

  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, totalSellers, seller.profit)
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10)
  })

  // Финальный результат
  return sellerStats.map((seller) => ({
    seller_id: String(seller.id),
    name: seller.name,
    revenue: parseFloat(seller.revenue.toFixed(2)),
    profit: parseFloat(seller.profit.toFixed(2)),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: parseFloat(seller.bonus.toFixed(2)),
  }))
}
