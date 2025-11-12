import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 *
 * Tests cover the complete authentication flow including:
 * - User registration
 * - Login/logout
 * - JWT token handling
 * - Protected route access
 * - Session persistence
 */

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page).toHaveTitle(/Restaurant POS/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty form', async ({ page }) => {
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('invalid@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill('admin@restaurant.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify dashboard elements
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });

  test('should persist session after page reload', async ({ page, context }) => {
    // Login
    await page.getByLabel(/email/i).fill('admin@restaurant.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    // Reload page
    await page.reload();

    // Should still be logged in
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // Login
    await page.getByLabel(/email/i).fill('admin@restaurant.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);

    // Logout
    await page.getByRole('button', { name: /logout|sign out/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('/');
  });
});

test.describe('User Registration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sign up|register/i })).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('should validate password requirements', async ({ page }) => {
    await page.getByLabel(/email/i).fill('newuser@example.com');
    await page.getByLabel(/password/i).fill('weak');
    await page.getByRole('button', { name: /sign up|register/i }).click();

    await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();
  });

  test('should successfully register new user', async ({ page }) => {
    const timestamp = Date.now();

    await page.getByLabel(/name/i).fill('Test User');
    await page.getByLabel(/email/i).fill(`testuser${timestamp}@example.com`);
    await page.getByLabel(/password/i).fill('SecurePass123!');
    await page.getByRole('button', { name: /sign up|register/i }).click();

    // Should redirect to dashboard or verification page
    await expect(page).toHaveURL(/\/(dashboard|verify-email)/);
  });
});
