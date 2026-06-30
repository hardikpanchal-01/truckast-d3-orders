/**
 * Order filtering utilities to match D3 production logic.
 * Filters orders based on exclusion patterns from excluded_order_patterns table.
 */

import { ExclusionPatterns } from "@/actions/exclusionActions";

/**
 * Order structure for filtering
 */
export interface FilterableOrder {
  order_id: number;
  order_code: string;
  customer_name: string | null;
  delivery_addr1: string | null;
  order_products?: Array<{
    item_code?: string | null;
    order_qty_unit?: string | null;
    is_mix?: boolean | null;
  }> | null;
}

/**
 * Checks if a string contains any of the excluded patterns (case-insensitive)
 */
function containsExcludedPattern(
  value: string | null | undefined,
  patterns: string[]
): boolean {
  if (!value || patterns.length === 0) return false;
  const lowerValue = value.toLowerCase();
  return patterns.some((pattern) => lowerValue.includes(pattern.toLowerCase()));
}

/**
 * Filters out orders that match excluded customer names, products, or delivery addresses
 * @param orders - Array of orders to filter
 * @param patterns - Exclusion patterns object
 * @returns Filtered array of orders
 */
export function filterExcludedOrders<T extends FilterableOrder>(
  orders: T[],
  patterns: ExclusionPatterns
): T[] {
  return orders.filter((order) => {
    // Check customer name
    if (containsExcludedPattern(order.customer_name, patterns.customers)) {
      return false;
    }

    // Check if any product in order_products matches excluded products
    if (order.order_products && patterns.products.length > 0) {
      const hasExcludedProduct = order.order_products.some((product) =>
        containsExcludedPattern(product.item_code, patterns.products)
      );
      if (hasExcludedProduct) {
        return false;
      }
    }

    // Check delivery address
    if (containsExcludedPattern(order.delivery_addr1, patterns.deliveryAddresses)) {
      return false;
    }

    return true;
  });
}

/**
 * Checks if a single order should be excluded
 * @param order - Order to check
 * @param patterns - Exclusion patterns object
 * @returns true if order should be excluded, false otherwise
 */
export function isOrderExcluded<T extends FilterableOrder>(
  order: T,
  patterns: ExclusionPatterns
): boolean {
  // Check customer name
  if (containsExcludedPattern(order.customer_name, patterns.customers)) {
    return true;
  }

  // Check if any product in order_products matches excluded products
  if (order.order_products && patterns.products.length > 0) {
    const hasExcludedProduct = order.order_products.some((product) =>
      containsExcludedPattern(product.item_code, patterns.products)
    );
    if (hasExcludedProduct) {
      return true;
    }
  }

  // Check delivery address
  if (containsExcludedPattern(order.delivery_addr1, patterns.deliveryAddresses)) {
    return true;
  }

  return false;
}
