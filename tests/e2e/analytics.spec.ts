import { test, expect } from '@playwright/test';

/**
 * Analytics Dashboard E2E Tests
 *
 * Tests for business intelligence and reporting features:
 * - Dashboard metrics
 * - Charts and visualizations
 * - Date range filtering
 * - Data export
 */

async function login(page) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill('admin@restaurant.com');
  await page.getByLabel(/password/i).fill('admin123');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/analytics');
  });

  test('should display analytics dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  });

  test('should display summary cards', async ({ page }) => {
    // Revenue card
    await expect(page.locator('[data-testid="revenue-card"]')).toBeVisible();
    await expect(page.getByText(/total revenue/i)).toBeVisible();

    // Orders card
    await expect(page.locator('[data-testid="orders-card"]')).toBeVisible();
    await expect(page.getByText(/total orders/i)).toBeVisible();

    // Average order value card
    await expect(page.locator('[data-testid="aov-card"]')).toBeVisible();
    await expect(page.getByText(/average order/i)).toBeVisible();

    // Customers card
    await expect(page.locator('[data-testid="customers-card"]')).toBeVisible();
    await expect(page.getByText(/customers/i)).toBeVisible();
  });

  test('should display daily sales chart', async ({ page }) => {
    await expect(page.getByText(/daily sales/i)).toBeVisible();

    // Check for chart container
    const chart = page.locator('[data-testid="daily-sales-chart"]');
    await expect(chart).toBeVisible();

    // Verify chart has rendered (recharts adds svg)
    await expect(chart.locator('svg')).toBeVisible();
  });

  test('should display orders by channel pie chart', async ({ page }) => {
    await expect(page.getByText(/orders by channel/i)).toBeVisible();

    const pieChart = page.locator('[data-testid="channel-pie-chart"]');
    await expect(pieChart).toBeVisible();
    await expect(pieChart.locator('svg')).toBeVisible();
  });

  test('should display top selling items', async ({ page }) => {
    await expect(page.getByText(/top selling items/i)).toBeVisible();

    const barChart = page.locator('[data-testid="top-items-chart"]');
    await expect(barChart).toBeVisible();
  });

  test('should filter by date range', async ({ page }) => {
    // Click date range picker
    await page.getByLabel(/date range/i).click();

    // Select last 7 days
    await page.getByRole('option', { name: /last 7 days/i }).click();

    // Wait for data to reload
    await page.waitForLoadState('networkidle');

    // Verify data updated (check for loading state completion)
    await expect(page.locator('[data-testid="loading"]')).not.toBeVisible();
  });

  test('should export data to CSV', async ({ page }) => {
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.getByRole('button', { name: /export|download csv/i }).click();

    // Wait for download
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/analytics.*\.csv/);
  });

  test('should display hourly distribution chart', async ({ page }) => {
    await expect(page.getByText(/hourly distribution/i)).toBeVisible();

    const hourlyChart = page.locator('[data-testid="hourly-chart"]');
    await expect(hourlyChart).toBeVisible();
  });

  test('should show percentage changes', async ({ page }) => {
    // Look for percentage indicators
    const percentages = page.locator('[data-testid*="percentage"]');
    const count = await percentages.count();

    expect(count).toBeGreaterThan(0);

    // Verify format (should include + or - and %)
    const firstPercentage = await percentages.first().textContent();
    expect(firstPercentage).toMatch(/[+\-]\d+(\.\d+)?%/);
  });
});

test.describe('Health Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/health');
  });

  test('should display health dashboard', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /system health/i })).toBeVisible();
  });

  test('should show overall system status', async ({ page }) => {
    const statusBadge = page.locator('[data-testid="system-status"]');
    await expect(statusBadge).toBeVisible();

    const statusText = await statusBadge.textContent();
    expect(statusText).toMatch(/OK|DEGRADED|DOWN/);
  });

  test('should display service statuses', async ({ page }) => {
    // Database status
    await expect(page.getByText(/database/i)).toBeVisible();
    await expect(page.locator('[data-testid="database-status"]')).toBeVisible();

    // Redis status
    await expect(page.getByText(/redis/i)).toBeVisible();
    await expect(page.locator('[data-testid="redis-status"]')).toBeVisible();

    // Square API status
    await expect(page.getByText(/square/i)).toBeVisible();
    await expect(page.locator('[data-testid="square-status"]')).toBeVisible();

    // Queue status
    await expect(page.getByText(/queue/i)).toBeVisible();
    await expect(page.locator('[data-testid="queue-status"]')).toBeVisible();
  });

  test('should display system metrics', async ({ page }) => {
    // Uptime
    await expect(page.getByText(/uptime/i)).toBeVisible();

    // CPU usage
    await expect(page.getByText(/cpu/i)).toBeVisible();
    const cpuProgress = page.locator('[data-testid="cpu-progress"]');
    await expect(cpuProgress).toBeVisible();

    // Memory usage
    await expect(page.getByText(/memory/i)).toBeVisible();
    const memoryProgress = page.locator('[data-testid="memory-progress"]');
    await expect(memoryProgress).toBeVisible();
  });

  test('should display response times', async ({ page }) => {
    const responseTimes = page.locator('[data-testid*="response-time"]');
    const count = await responseTimes.count();

    expect(count).toBeGreaterThan(0);

    // Verify format (should be in milliseconds)
    const firstResponseTime = await responseTimes.first().textContent();
    expect(firstResponseTime).toMatch(/\d+\s*ms/);
  });

  test('should auto-refresh data', async ({ page }) => {
    // Enable auto-refresh
    const autoRefreshToggle = page.getByLabel(/auto refresh/i);
    if (!(await autoRefreshToggle.isChecked())) {
      await autoRefreshToggle.click();
    }

    // Get initial uptime value
    const initialUptime = await page.locator('[data-testid="uptime"]').textContent();

    // Wait for refresh interval (5 seconds + buffer)
    await page.waitForTimeout(6000);

    // Get updated uptime
    const updatedUptime = await page.locator('[data-testid="uptime"]').textContent();

    // Values should be different (time progressed)
    expect(updatedUptime).not.toBe(initialUptime);
  });

  test('should manually refresh data', async ({ page }) => {
    // Click refresh button
    await page.getByRole('button', { name: /refresh/i }).click();

    // Wait for loading state
    await expect(page.locator('[data-testid="loading"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading"]')).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/reports');
  });

  test('should display reports page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible();
  });

  test('should show available report types', async ({ page }) => {
    await expect(page.getByText(/sales report/i)).toBeVisible();
    await expect(page.getByText(/inventory report/i)).toBeVisible();
    await expect(page.getByText(/staff report/i)).toBeVisible();
  });

  test('should generate sales report', async ({ page }) => {
    // Select report type
    await page.getByLabel(/report type/i).click();
    await page.getByRole('option', { name: /sales/i }).click();

    // Select date range
    await page.getByLabel(/start date/i).fill('2025-01-01');
    await page.getByLabel(/end date/i).fill('2025-01-31');

    // Generate report
    await page.getByRole('button', { name: /generate/i }).click();

    // Wait for report
    await expect(page.locator('[data-testid="report-content"]')).toBeVisible({ timeout: 10000 });
  });

  test('should download PDF report', async ({ page }) => {
    // Generate a report first
    await page.getByRole('button', { name: /generate/i }).click();
    await expect(page.locator('[data-testid="report-content"]')).toBeVisible({ timeout: 10000 });

    // Download PDF
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /download pdf/i }).click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/.*\.pdf/);
  });
});
