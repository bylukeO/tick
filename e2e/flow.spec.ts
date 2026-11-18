import { test, expect } from "@playwright/test";

test.describe("Ticket transfer flow", () => {
  const senderEmail = `sender_${Date.now()}@example.test`;
  const recipientEmail = "bob@demo.test";
  const password = "demo1234";

  test("register -> claim -> transfer -> accept -> sender retains ticket/QR", async ({ page }) => {
    await page.goto("/register");
    await page.fill('input[type="email"]', senderEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/wallet/);

    await page.goto("/");
    await page.locator('a:has-text("Select Seats")').first().click();
    await expect(page).toHaveURL(/\/events\//);

    const availableSeat = page.locator('button[title^="Sec "].bg-emerald-500').first();
    await expect(availableSeat).toBeVisible();

    await availableSeat.click();
    await page.getByLabel("Account password to confirm ticket claim").fill(password);
    await page.locator('button:has-text("Claim Ticket")').click();

    await expect(page).toHaveURL(/\/wallet/, { timeout: 20000 });
    await expect(page.locator('button:has-text("View Ticket")').first()).toBeVisible();

    // sender can view QR before transfer
    await page.locator('button:has-text("View Ticket")').first().click();
    await expect(page.locator('img[alt="Ticket barcode"]')).toBeVisible();
    await page.locator('button:has-text("Close")').click();

    // initiate transfer
    await page.locator('button:has-text("Transfer")').first().click();
    await page.fill('input[type="email"]', recipientEmail);
    await page.fill('input[type="password"]', password);
    await page.locator('button:has-text("Transfer")').last().click();

    await expect(page.locator("text=Pending").first()).toBeVisible({ timeout: 15000 });

    // recipient accepts
    await page.locator('button:has-text("Sign Out")').click();
    await page.goto("/login");
    await page.fill('input[type="email"]', recipientEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/wallet/);

    await page.goto("/transfers");
    await page.fill('input[type="password"]', password);
    await page.locator('button:has-text("Accept Tickets")').first().click();
    await expect(page.locator("text=Accepted").first()).toBeVisible({ timeout: 20000 });

    // sender original ticket/QR still retrievable after transfer
    await page.locator('button:has-text("Sign Out")').click();
    await page.goto("/login");
    await page.fill('input[type="email"]', senderEmail);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/wallet/);
    await expect(page.locator('button:has-text("View Ticket")').first()).toBeVisible();
    await page.locator('button:has-text("View Ticket")').first().click();
    await expect(page.locator('img[alt="Ticket barcode"]')).toBeVisible();
  });
});
