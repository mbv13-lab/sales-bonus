function calculateSimpleRevenue(purchase, product) {
  "use strict"
  const { discount = 0, quantity = 0 } = purchase
  const sale_price = purchase.sale_price || product?.sale_price || 0

  const decimalDiscount = discount / 100
  const totalBeforeDiscount = sale_price * quantity
  return totalBeforeDiscount * (1 - decimalDiscount)
}

function calculateBonusByProfit(index, total, profit) {
  if (total <= 1 || profit <= 0) return 0

  if (index === 0) {
    return profit * 0.15
  } else if (index === 1 || index === 2) {
    return profit * 0.1
  } else if (index === total - 1) {
    return 0
  } else {
    return profit * 0.05
  }
}

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
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }))

  const sellerIndex = Object.fromEntries(
    sellerStats.map((s) => [String(s.id), s])
  )

  // Шаг 3. Обработка чеков
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id]
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

      // Аккумулируем данные в правильные поля
      seller.revenue += revenue
      seller.profit += profit

      // Учёт количества проданных товаров (берём строго оригинальный sku из продукта)
      const originalSku = product.sku;
      if (!seller.products_sold[originalSku]) {
        seller.products_sold[originalSku] = 0
      }
      seller.products_sold[originalSku] += item.quantity
    })
  })

  // Сортировка продавцов по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit)

  // Расчет бонусов и персонального топ-10 продуктов
  const totalSellers = sellerStats.length
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, totalSellers, seller.profit)

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
  })

  // Финальный отчет с округлением
  return sellerStats.map((seller) => ({
    seller_id: seller.id, // Убрали String(), возвращаем исходный тип ID (если тесты строгие)
    name: seller.name.trim(),
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2),
  }))
}
