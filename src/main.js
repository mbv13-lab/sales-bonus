function calculateSimpleRevenue(purchase, product) {
  "use strict"
  const { discount = 0, quantity = 0 } = purchase
  const sale_price = purchase.sale_price || product?.sale_price || 0

  const decimalDiscount = discount / 100
  const totalBeforeDiscount = sale_price * quantity

  return +(totalBeforeDiscount * (1 - decimalDiscount)).toFixed(2)
}

function calculateBonusByProfit(index, total, seller) {
  const { profit = 0 } = seller || {}

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
    !options ||
    typeof options.calculateRevenue !== "function" ||
    typeof options.calculateBonus !== "function"
  ) {
    throw new Error("Некорректные входные данные")
  }

  const calculateRevenue = options.calculateRevenue
  const calculateBonus = options.calculateBonus

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

      // Расчет прибыли (profit) от округлённой выручки 
      const revenue = calculateRevenue(item, product)
      const profit = revenue - cost

      // Аккумуляция  данных 
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

  // Сортировка продавцов по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit)

  // Расчет бонусов и персонального топ-10 продуктов
  const totalSellers = sellerStats.length
  sellerStats.forEach((seller, index) => {
    // Передаем объект seller целиком
    seller.bonus = calculateBonus(index, totalSellers, seller)

    // Сортировка только по количеству проданного и ограничение до ТОП-10 
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)
  })

  // Шаг 4. Результат по ТЗ
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
