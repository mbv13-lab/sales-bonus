const BONUS_RATES = {
  TOP_SELLER: 0.15,
  SECOND_THIRD: 0.1,
  OTHER: 0.05,
  LAST: 0
};

/**
 * Рассчитывает выручку с учётом скидки
 * @param {Object} purchase - данные покупки
 * @param {Object} product - данные товара
 * @returns {number} итоговая выручка
 */
function calculateSimpleRevenue(purchase, product) {
  "use strict";
  const { discount = 0, quantity = 0 } = purchase;

  let sale_price = 0;
  if (purchase.sale_price !== undefined) {
    sale_price = purchase.sale_price;
  } else if (product?.sale_price !== undefined) {
    sale_price = product.sale_price;
  }

  // Валидация входных данных
  if (discount < 0) throw new Error("Discount cannot be negative");
  if (quantity < 0) throw new Error("Quantity cannot be negative");

  const decimalDiscount = discount / 100;
  const totalBeforeDiscount = sale_price * quantity;
  return totalBeforeDiscount * (1 - decimalDiscount);
}

/**
 * Рассчитывает бонус в зависимости от позиции продавца в рейтинге
 * @param {number} index - позиция продавца (0 — лучший)
 * @param {number} total - общее количество продавцов
 * @param {number} profit - прибыль продавца
 * @returns {number} размер бонуса
 */
function calculateBonusByProfit(index, total, profit) {
  // Валидация входных данных
  if (!Number.isInteger(index) || index < 0) {
    throw new Error("Index must be a non-negative integer");
  }
  if (!Number.isInteger(total) || total <= 0) {
    throw new Error("Total must be a positive integer");
  }
  if (profit <= 0) return 0;

  if (index === 0) {
    return profit * BONUS_RATES.TOP_SELLER;
  } else if (index === 1 || index === 2) {
    return profit * BONUS_RATES.SECOND_THIRD;
  } else if (index === total - 1) {
    return BONUS_RATES.LAST;
  } else {
    return profit * BONUS_RATES.OTHER;
  }
}

/**
 * Анализирует данные о продажах и формирует отчёт по продавцам
 * @param {Object} data - входные данные (покупки, продавцы, товары)
 * @param {Object} options - опции (функции расчёта выручки и бонусов)
 * @returns {Array} отчёт по продавцам с бонусами и топ-продуктами
 */
function analyzeSalesData(data, options) {
  // Шаг 1. Валидация входных данных
  if (!data ||
    !data.purchase_records ||
    !Array.isArray(data.purchase_records) ||
    data.purchase_records.length === 0 ||
    !data.sellers ||
    !Array.isArray(data.sellers) ||
    data.sellers.length === 0 ||
    !data.products ||
    !Array.isArray(data.products) ||
    data.products.length === 0) {
    throw new Error("Некорректные входные данные");
  }

  const calculateRevenue = options?.calculateRevenue || calculateSimpleRevenue;
  const calculateBonus = options?.calculateBonus || calculateBonusByProfit;

  // Шаг 2. Создание необходимых индексов
  const productIndex = Object.fromEntries(
    data.products.map((p) => [p.sku.trim().toLowerCase(), p])
  );

  // Базовая статистика продавцов
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  const sellerIndex = Object.fromEntries(
    sellerStats.map((s) => [String(s.id), s])
  );

  // Шаг 3. Обработка чеков
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[String(record.seller_id)];
    if (!seller) return;

    seller.sales_count += 1;

    // Расчёт прибыли для каждого товара
    record.items.forEach((item) => {
      // Проверка наличия SKU
      if (!item.sku) {
        console.warn(`Item without SKU in purchase record ${record.id}`);
        return;
      }

      const normalizedSku = item.sku.trim().toLowerCase();
      const product = productIndex[normalizedSku];

      if (!product) {
        console.warn(`Product with SKU ${item.sku} not found`);
        return;
      }

      // Себестоимость с проверкой
      const purchasePrice = product.purchase_price || 0;
      const cost = purchasePrice * item.quantity;

      // Выручка с валидацией
      const revenue = calculateRevenue(item, product) || 0;

      // Прибыль
      const profit = revenue - cost;

      // Аккумулируем данные
      seller.revenue += revenue;
      seller.profit += profit;

      // Учёт количества проданных товаров
      const originalSku = product.sku;
      if (!seller.products_sold[originalSku]) {
        seller.products_sold[originalSku] = 0;
      }
      seller.products_sold[originalSku] += item.quantity;
    });
  });

  // Сортировка продавцов по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Расчёт бонусов и персонального топ-10 продуктов
  const totalSellers = sellerStats.length;
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, totalSellers, seller.profit);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => {
        // Если количество продаж разное — сортируем по убыванию количества
        if (b.quantity !== a.quantity) {
          return b.quantity - a.quantity;
        }
        // Если количество одинаковое — сортируем по алфавиту артикула SKU
        return a.sku.localeCompare(b.sku);
      })
      .slice(0, 10);
  });

  // Финальный отчёт с округлением
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name.trim(),
    revenue: Number(seller.revenue.toFixed(2)),
    profit: Number(seller.profit.toFixed(2)),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: Number(seller.bonus.toFixed(2)),
  }));
}
