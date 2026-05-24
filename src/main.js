function analyzeSalesData(data, options) {
  // Шаг 1. Валидация входных данных
  if (
    !data ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0 ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !Array.isArray(data.products) ||
    data.products.length === 0
  ) {
    throw new Error("Некорректные входные данные")
  }

  const calculateRevenue = options?.calculateRevenue || calculateSimpleRevenue
  const calculateBonus = options?.calculateBonus || calculateBonusByProfit

  // Шаг 2. Создание необходимых индексов
  const productIndex = Object.fromEntries(
    data.products.map((p) => [p.sku.trim().toLowerCase(), p])
  )

  // Базовая статистика продавцов
  const sellerStats = data.sellers.map((seller) => ({
    id: String(seller.id), 
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }))

  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]))

  // Шаг 3. Обработка чеков
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[String(record.seller_id)]
    if (!seller) return

    seller.sales_count += 1

    // Расчёт прибыли для каждого товара
    record.items.forEach((item) => {
      const normalizedSku = item.sku.trim().toLowerCase()
      const product = productIndex[normalizedSku]

      if (!product) return

      // Себестоимость (cost)
      const cost = product.purchase_price * item.quantity

      // Выручка (revenue)
      const revenue = calculateRevenue(item, product)

      // Прибыль (profit)
      const profit = revenue - cost

      // Аккумулируем данные
      seller.revenue += revenue
      seller.profit += profit

      // Учёт количества проданных товаров 
      const originalSku = product.sku
      if (!seller.products_sold[originalSku]) {
        seller.products_sold[originalSku] = 0
      }
      seller.products_sold[originalSku] += item.quantity
    })
  })

  // Сортировка продавцов по прибыли (до округления)
  sellerStats.sort((a, b) => b.profit - a.profit)

  // Расчет бонусов и персонального топ-10 продуктов
  const totalSellers = sellerStats.length
  sellerStats.forEach((seller, index) => {
    
    const roundedProfit = +seller.profit.toFixed(2)
    seller.bonus = calculateBonus(index, totalSellers, roundedProfit)

    // Преобразуем и сортируем топ-10
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => {
        if (b.quantity !== a.quantity) {
          return b.quantity - a.quantity
        }
      
        return a.sku.localeCompare(b.sku)
      })
      .slice(0, 10)
  })

  // Финальный отчет с округлением
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name.trim(),
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2),
  }))
}
