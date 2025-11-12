/**
 * Test Data Helpers
 *
 * Provides reusable test data and helper functions for E2E tests
 */

export const testUsers = {
  admin: {
    email: 'admin@restaurant.com',
    password: 'admin123',
    role: 'ADMIN',
  },
  manager: {
    email: 'manager@restaurant.com',
    password: 'manager123',
    role: 'MANAGER',
  },
  staff: {
    email: 'staff@restaurant.com',
    password: 'staff123',
    role: 'STAFF',
  },
  kitchen: {
    email: 'kitchen@restaurant.com',
    password: 'kitchen123',
    role: 'KITCHEN',
  },
};

export const testMenuItems = [
  {
    name: 'Margherita Pizza',
    category: 'Entrees',
    price: 12.99,
    description: 'Classic pizza with fresh mozzarella',
  },
  {
    name: 'Caesar Salad',
    category: 'Appetizers',
    price: 8.99,
    description: 'Crisp romaine with Caesar dressing',
  },
  {
    name: 'Tiramisu',
    category: 'Desserts',
    price: 6.99,
    description: 'Italian coffee-flavored dessert',
  },
  {
    name: 'Coca Cola',
    category: 'Beverages',
    price: 2.99,
    description: 'Refreshing soft drink',
  },
];

export const testOrders = [
  {
    items: ['Margherita Pizza', 'Caesar Salad', 'Coca Cola'],
    customerName: 'John Doe',
    phone: '555-0123',
    channel: 'IN_PERSON',
    paymentMethod: 'CASH',
  },
  {
    items: ['Caesar Salad', 'Tiramisu', 'Coca Cola'],
    customerName: 'Jane Smith',
    phone: '555-0456',
    channel: 'ONLINE',
    paymentMethod: 'CARD',
  },
];

export const testDiscountCodes = [
  { code: 'SAVE10', percentage: 10, description: '10% off' },
  { code: 'SAVE20', percentage: 20, description: '20% off' },
  { code: 'FREESHIP', type: 'free_shipping', description: 'Free delivery' },
];

/**
 * Helper to create a test order via API
 */
export async function createTestOrder(request, order, authToken) {
  const response = await request.post('/api/orders', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    data: order,
  });

  return await response.json();
}

/**
 * Helper to get auth token for a user
 */
export async function getAuthToken(request, user) {
  const response = await request.post('/api/auth/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  const data = await response.json();
  return data.token;
}

/**
 * Helper to clean up test data
 */
export async function cleanupTestData(request, authToken) {
  // Delete test orders
  await request.delete('/api/test/cleanup', {
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
  });
}

/**
 * Helper to wait for WebSocket connection
 */
export async function waitForWebSocket(page, timeout = 5000) {
  await page.waitForFunction(
    () => {
      return (window as any).socketConnected === true;
    },
    { timeout }
  );
}

/**
 * Helper to mock Square payment response
 */
export function mockSquarePayment(page, success = true) {
  return page.route('**/api/payments', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success,
          paymentId: 'test_payment_' + Date.now(),
          status: success ? 'COMPLETED' : 'FAILED',
        }),
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Helper to take a screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Helper to check accessibility
 */
export async function checkAccessibility(page) {
  // Check for basic a11y attributes
  const issues = [];

  // Check for alt text on images
  const images = await page.locator('img').all();
  for (const img of images) {
    const alt = await img.getAttribute('alt');
    if (!alt) {
      issues.push('Image missing alt text');
    }
  }

  // Check for form labels
  const inputs = await page.locator('input, textarea, select').all();
  for (const input of inputs) {
    const id = await input.getAttribute('id');
    const ariaLabel = await input.getAttribute('aria-label');
    if (id) {
      const label = await page.locator(`label[for="${id}"]`).count();
      if (label === 0 && !ariaLabel) {
        issues.push(`Input ${id} missing label`);
      }
    }
  }

  return issues;
}
