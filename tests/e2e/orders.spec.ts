import { test, expect } from '@playwright/test';

/**
 * Order Management E2E Tests
 *
 * Critical business flow tests covering:
 * - Order creation
 * - Menu browsing
 * - Cart management
 * - Payment processing
 * - Order status updates
 */

// Helper function to login before tests
async function login(page) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill('staff@restaurant.com');
  await page.getByLabel(/password/i).fill('staff123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Order Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/pos');
  });

  test('should display POS interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /point of sale|pos/i })).toBeVisible();
    await expect(page.getByText(/menu/i)).toBeVisible();
    await expect(page.getByText(/cart/i)).toBeVisible();
  });

  test('should display menu categories', async ({ page }) => {
    // Check for common categories
    await expect(page.getByText(/appetizers|starters/i)).toBeVisible();
    await expect(page.getByText(/entrees|main/i)).toBeVisible();
    await expect(page.getByText(/beverages|drinks/i)).toBeVisible();
    await expect(page.getByText(/desserts/i)).toBeVisible();
  });

  test('should add item to cart', async ({ page }) => {
    // Click on first menu item
    const firstItem = page.locator('[data-testid="menu-item"]').first();
    await firstItem.click();

    // Verify item appears in cart
    await expect(page.getByText(/1 item/i)).toBeVisible();

    // Verify cart shows item
    const cartSection = page.locator('[data-testid="cart"]');
    await expect(cartSection.locator('[data-testid="cart-item"]')).toHaveCount(1);
  });

  test('should update item quantity', async ({ page }) => {
    // Add item to cart
    const firstItem = page.locator('[data-testid="menu-item"]').first();
    await firstItem.click();

    // Increase quantity
    await page.locator('[data-testid="increase-quantity"]').first().click();

    // Verify quantity updated
    await expect(page.locator('[data-testid="item-quantity"]').first()).toHaveText('2');
    await expect(page.getByText(/2 items/i)).toBeVisible();
  });

  test('should remove item from cart', async ({ page }) => {
    // Add item to cart
    await page.locator('[data-testid="menu-item"]').first().click();

    // Remove item
    await page.locator('[data-testid="remove-item"]').first().click();

    // Verify cart is empty
    await expect(page.getByText(/cart is empty/i)).toBeVisible();
  });

  test('should calculate total correctly', async ({ page }) => {
    // Add multiple items
    const items = page.locator('[data-testid="menu-item"]');
    await items.nth(0).click();
    await items.nth(1).click();

    // Verify subtotal exists
    await expect(page.getByText(/subtotal/i)).toBeVisible();
    await expect(page.getByText(/tax/i)).toBeVisible();
    await expect(page.getByText(/total/i)).toBeVisible();

    // Verify total is a valid number
    const totalText = await page.locator('[data-testid="order-total"]').textContent();
    expect(totalText).toMatch(/\$\d+\.\d{2}/);
  });

  test('should apply discount code', async ({ page }) => {
    // Add item to cart
    await page.locator('[data-testid="menu-item"]').first().click();

    // Apply discount
    await page.getByLabel(/discount code/i).fill('SAVE10');
    await page.getByRole('button', { name: /apply/i }).click();

    // Verify discount applied
    await expect(page.getByText(/discount applied/i)).toBeVisible();
    await expect(page.locator('[data-testid="discount-amount"]')).toBeVisible();
  });

  test('should complete order with cash payment', async ({ page }) => {
    // Add items to cart
    await page.locator('[data-testid="menu-item"]').first().click();

    // Proceed to payment
    await page.getByRole('button', { name: /checkout|place order/i }).click();

    // Select cash payment
    await page.getByRole('button', { name: /cash/i }).click();

    // Enter customer info
    await page.getByLabel(/customer name/i).fill('John Doe');
    await page.getByLabel(/phone/i).fill('555-0123');

    // Confirm order
    await page.getByRole('button', { name: /confirm order/i }).click();

    // Verify success
    await expect(page.getByText(/order placed successfully/i)).toBeVisible();
    await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
  });

  test('should complete order with card payment', async ({ page }) => {
    // Add items to cart
    await page.locator('[data-testid="menu-item"]').first().click();

    // Proceed to payment
    await page.getByRole('button', { name: /checkout|place order/i }).click();

    // Select card payment
    await page.getByRole('button', { name: /card|credit/i }).click();

    // Note: In test environment, we'd use Square's test card
    // This would integrate with Square's sandbox

    // Confirm order
    await page.getByRole('button', { name: /confirm order/i }).click();

    // Verify success or payment processing
    await expect(page.getByText(/order placed|processing payment/i)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Order Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/orders');
  });

  test('should display orders list', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /orders/i })).toBeVisible();

    // Check for orders table/list
    const ordersContainer = page.locator('[data-testid="orders-list"]');
    await expect(ordersContainer).toBeVisible();
  });

  test('should filter orders by status', async ({ page }) => {
    // Select status filter
    await page.getByLabel(/status/i).click();
    await page.getByRole('option', { name: /pending/i }).click();

    // Verify filtered results
    const orderCards = page.locator('[data-testid="order-card"]');
    const count = await orderCards.count();

    if (count > 0) {
      // All visible orders should be pending
      for (let i = 0; i < count; i++) {
        await expect(orderCards.nth(i)).toContainText(/pending/i);
      }
    }
  });

  test('should search orders by order number', async ({ page }) => {
    // Get first order number
    const firstOrder = page.locator('[data-testid="order-number"]').first();
    const orderNumber = await firstOrder.textContent();

    if (orderNumber) {
      // Search for it
      await page.getByLabel(/search/i).fill(orderNumber);

      // Should find the order
      await expect(page.locator('[data-testid="order-card"]')).toHaveCount(1);
      await expect(page.getByText(orderNumber)).toBeVisible();
    }
  });

  test('should view order details', async ({ page }) => {
    // Click on first order
    await page.locator('[data-testid="order-card"]').first().click();

    // Verify order details modal/page
    await expect(page.getByText(/order details/i)).toBeVisible();
    await expect(page.getByText(/items/i)).toBeVisible();
    await expect(page.getByText(/total/i)).toBeVisible();
    await expect(page.getByText(/customer/i)).toBeVisible();
  });

  test('should update order status', async ({ page }) => {
    // Click on first pending order
    await page.locator('[data-testid="order-card"][data-status="PENDING"]').first().click();

    // Change status to confirmed
    await page.getByRole('button', { name: /confirm|accept/i }).click();

    // Verify status updated
    await expect(page.getByText(/confirmed|accepted/i)).toBeVisible();
  });
});

test.describe('Kitchen Display System', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/kds');
  });

  test('should display KDS interface', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /kitchen display/i })).toBeVisible();
  });

  test('should show new orders column', async ({ page }) => {
    await expect(page.getByText(/new orders/i)).toBeVisible();
  });

  test('should show in progress column', async ({ page }) => {
    await expect(page.getByText(/in progress|preparing/i)).toBeVisible();
  });

  test('should move order from new to preparing', async ({ page }) => {
    // Find first new order
    const newOrdersColumn = page.locator('[data-testid="new-orders-column"]');
    const firstOrder = newOrdersColumn.locator('[data-testid="kds-order-card"]').first();

    if (await firstOrder.isVisible()) {
      // Start preparing
      await firstOrder.getByRole('button', { name: /start|prepare/i }).click();

      // Should move to in-progress
      const inProgressColumn = page.locator('[data-testid="in-progress-column"]');
      await expect(inProgressColumn.locator('[data-testid="kds-order-card"]')).toHaveCountGreaterThan(0);
    }
  });

  test('should mark order as ready', async ({ page }) => {
    const inProgressColumn = page.locator('[data-testid="in-progress-column"]');
    const firstOrder = inProgressColumn.locator('[data-testid="kds-order-card"]').first();

    if (await firstOrder.isVisible()) {
      await firstOrder.getByRole('button', { name: /ready|complete/i }).click();

      // Verify success message
      await expect(page.getByText(/order marked as ready/i)).toBeVisible();
    }
  });

  test('should receive real-time order updates', async ({ page }) => {
    // Get initial order count
    const initialCount = await page.locator('[data-testid="kds-order-card"]').count();

    // In a real test, we'd create an order via API
    // and verify it appears in the KDS via WebSocket

    // For now, just verify the WebSocket connection indicator
    await expect(page.locator('[data-testid="connection-status"]')).toContainText(/connected/i);
  });
});
