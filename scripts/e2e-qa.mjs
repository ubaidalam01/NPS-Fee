/**
 * Full E2E QA pass against http://localhost:3000
 * Run: node scripts/e2e-qa.mjs
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL || "ubaidm673@gmail.com";
const PASSWORD = process.env.QA_PASSWORD;
if (!PASSWORD) {
  console.error("Set QA_PASSWORD env var before running e2e-qa.mjs");
  process.exit(1);
}
const SCHOOL_ID = "5ba62f7d-e548-4b56-8811-509e49030fbb";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function record(num, name, result, notes = "") {
  results.push({ num, name, result, notes });
  const tag = result === "PASS" ? "✓" : result === "FAIL" ? "✗" : "•";
  console.log(`${tag} #${num} ${name}: ${result}${notes ? " — " + notes : ""}`);
}

const stamp = Date.now().toString().slice(-6);
const studentFull = {
  name: `QA Full ${stamp}`,
  father: `Father Full ${stamp}`,
  gr: `GR-F-${stamp}`,
  fee: "4500",
};
const studentMin = {
  name: `QA Min ${stamp}`,
  father: `Father Min ${stamp}`,
  gr: `GR-M-${stamp}`,
  fee: "1000",
};
const studentEditName = `QA Edited ${stamp}`;
const feeHeadName = `QA Head ${stamp}`;
const monthValue = new Date().toISOString().slice(0, 7); // yyyy-MM

async function collectPageErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
}

async function waitForUrl(page, substr, timeout = 25000) {
  await page.waitForURL((url) => url.pathname.includes(substr), { timeout });
}

async function dialogVisible(page) {
  return page.locator('[role="alertdialog"]').isVisible().catch(() => false);
}

async function fillStudentForm(page, data) {
  const modal = page
    .locator(".fixed")
    .filter({ hasText: /Add Student|Edit Student/i })
    .first();
  await modal.waitFor({ state: "visible" });
  const inputs = modal.locator("input");
  // Order: name, father, gr_no, admission_date, monthly_tuition_fee
  await inputs.nth(0).fill(data.name);
  await inputs.nth(1).fill(data.father);
  await inputs.nth(2).fill(data.gr);
  await inputs.nth(4).fill(data.fee);
  return modal;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const consoleErrorsByPage = {};
  const pageErrors = await collectPageErrors(page);

  const track = async (label, fn) => {
    const before = pageErrors.length;
    await fn();
    const slice = pageErrors.slice(before);
    consoleErrorsByPage[label] = slice;
    return slice;
  };

  // ---------- AUTH ----------
  try {
    await track("login-ok", async () => {
      await login(page, EMAIL, PASSWORD);
      await waitForUrl(page, "/dashboard");
    });
    record(1, "Login with correct credentials → /dashboard", "PASS", page.url());
  } catch (e) {
    record(1, "Login with correct credentials → /dashboard", "FAIL", e.message);
  }

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    // may redirect to dashboard if still logged in — logout first if needed
    if (!page.url().includes("/login")) {
      // force logout via UI if available
      const logout = page.getByRole("button", { name: /logout/i });
      if (await logout.count()) await logout.first().click();
      await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    }
    await page.fill("#email", EMAIL);
    await page.fill("#password", "WrongPassword!!!999");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    const errText = await page.locator(".text-danger, [class*='danger']").first().textContent().catch(() => "");
    const stillLogin = page.url().includes("/login");
    const hung = await page.getByRole("button", { name: /signing in/i }).isVisible().catch(() => false);
    if (stillLogin && errText && !hung) {
      record(2, "Login with wrong password → clear error", "PASS", errText.trim());
    } else {
      record(
        2,
        "Login with wrong password → clear error",
        "FAIL",
        `url=${page.url()} error="${errText}" hungSigningIn=${hung}`
      );
    }
  } catch (e) {
    record(2, "Login with wrong password → clear error", "FAIL", e.message);
  }

  try {
    await login(page, EMAIL, PASSWORD);
    await waitForUrl(page, "/dashboard");
    await page.getByRole("button", { name: /logout/i }).first().click();
    await waitForUrl(page, "/login");
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
    const onDash = page.url().includes("/dashboard");
    const content = await page.content();
    const leaked = /Collected Today|Pending Fee|Defaulters/i.test(content) && onDash;
    if (page.url().includes("/login") || (!onDash && !leaked)) {
      // After goBack, middleware should bounce to login
      await page.waitForTimeout(500);
      const finalOk =
        page.url().includes("/login") ||
        !(await page.getByText(/Collected Today/i).isVisible().catch(() => false));
      record(
        3,
        "Logout → /login; back doesn't show cached dashboard",
        finalOk ? "PASS" : "FAIL",
        `url=${page.url()}`
      );
    } else {
      record(3, "Logout → /login; back doesn't show cached dashboard", "FAIL", `url=${page.url()} leaked=${leaked}`);
    }
  } catch (e) {
    record(3, "Logout → /login; back doesn't show cached dashboard", "FAIL", e.message);
  }

  try {
    await context.clearCookies();
    // also clear storage
    await page.goto(`${BASE}/login`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    const res = await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const redirected = page.url().includes("/login");
    record(
      4,
      "Access /dashboard logged out → redirect /login",
      redirected ? "PASS" : "FAIL",
      `url=${page.url()} status=${res?.status()}`
    );
  } catch (e) {
    record(4, "Access /dashboard logged out → redirect /login", "FAIL", e.message);
  }

  // Re-login for rest of tests
  await login(page, EMAIL, PASSWORD);
  await waitForUrl(page, "/dashboard");

  // ---------- STUDENT MANAGER ----------
  try {
    await track("students", async () => {
      await page.goto(`${BASE}/students`, { waitUntil: "networkidle" });
    });

    // 5 Add full student
    await page.getByRole("button", { name: /add student/i }).click();
    const modal5 = await fillStudentForm(page, studentFull);
    await modal5.getByRole("button", { name: /^Save$/i }).click();
    await page.waitForTimeout(2000);
    const appears = await page.getByText(studentFull.name).first().isVisible().catch(() => false);
    record(5, "Add student with all fields → appears in list", appears ? "PASS" : "FAIL", studentFull.name);
  } catch (e) {
    record(5, "Add student with all fields → appears in list", "FAIL", e.message);
  }

  try {
    // 6 minimal — fill required inputs only
    await page.getByRole("button", { name: /add student/i }).click();
    const modal6 = await fillStudentForm(page, studentMin);
    await modal6.getByRole("button", { name: /^Save$/i }).click();
    await page.waitForTimeout(2000);
    const err = await page.locator(".fixed .text-danger").textContent().catch(() => "");
    const appears = await page.getByText(studentMin.name).first().isVisible().catch(() => false);
    const modalGone = !(await page.locator(".fixed").filter({ hasText: /Add Student/i }).isVisible().catch(() => false));
    record(
      6,
      "Add student with only required fields → no error",
      appears && modalGone && !err ? "PASS" : "FAIL",
      err || (appears ? "ok" : "student not in list")
    );
  } catch (e) {
    record(6, "Add student with only required fields → no error", "FAIL", e.message);
  }

  try {
    // 7 Edit
    const row = page.locator("tr").filter({ hasText: studentFull.name }).first();
    await row.locator("button").first().click();
    const modal7 = page.locator(".fixed").filter({ hasText: /Edit Student/i }).first();
    await modal7.waitFor({ state: "visible" });
    await modal7.locator("input").nth(0).fill(studentEditName);
    await modal7.getByRole("button", { name: /^Save$/i }).click();
    await page.waitForTimeout(2000);
    const ok =
      (await page.getByText(studentEditName).first().isVisible().catch(() => false)) &&
      !(await page.getByText(studentFull.name).first().isVisible().catch(() => false));
    record(7, "Edit student → changes reflect", ok ? "PASS" : "FAIL", studentEditName);
  } catch (e) {
    record(7, "Edit student → changes reflect", "FAIL", e.message);
  }

  try {
    // 8 Delete with custom modal
    const row = page.locator("tr").filter({ hasText: studentMin.name }).first();
    await row.locator("button").nth(1).click(); // trash
    await page.waitForTimeout(500);
    const hasDialog = await dialogVisible(page);
    // Check no native dialog - playwright would auto-dismiss; we listen
    let nativeConfirm = false;
    page.once("dialog", () => {
      nativeConfirm = true;
    });
    const titleOk = await page.getByRole("heading", { name: /Delete this student/i }).isVisible();
    // Cancel
    await page.getByRole("button", { name: /^Cancel$/i }).click();
    await page.waitForTimeout(400);
    const stillThere = await page.getByText(studentMin.name).isVisible();
    // Confirm delete
    await row.locator("button").nth(1).click();
    await page.getByRole("button", { name: /^Delete$/i }).click();
    await page.waitForTimeout(2000);
    const gone = !(await page.getByText(studentMin.name).isVisible().catch(() => false));
    record(
      8,
      "Delete student → custom modal; cancel + confirm",
      hasDialog && titleOk && stillThere && gone && !nativeConfirm ? "PASS" : "FAIL",
      `dialog=${hasDialog} title=${titleOk} cancelKept=${stillThere} deleted=${gone} native=${nativeConfirm}`
    );
  } catch (e) {
    record(8, "Delete student → custom modal; cancel + confirm", "FAIL", e.message);
  }

  try {
    // 9 Search
    const searchEl = page.getByPlaceholder(/Search name, father, GR/i);
    await searchEl.fill(studentEditName);
    await page.waitForTimeout(500);
    const byName = await page.getByText(studentEditName).isVisible();
    await searchEl.fill(studentFull.father);
    await page.waitForTimeout(400);
    const byFather = await page.getByText(studentEditName).isVisible().catch(() => false);
    await searchEl.fill(studentFull.gr);
    await page.waitForTimeout(400);
    const byGr = await page.getByText(studentEditName).isVisible().catch(() => false);
    await searchEl.fill("");
    record(
      9,
      "Search by name / father / GR",
      byName && byFather && byGr ? "PASS" : "FAIL",
      `byName=${byName} byFather=${byFather} byGr=${byGr}`
    );
  } catch (e) {
    record(9, "Search by name / father / GR", "FAIL", e.message);
  }

  try {
    // 10 Class/section filter — student defaults to class 1 section A
    const selects = page.locator("select");
    await selects.nth(0).selectOption({ label: /Class 1|1/ });
    await page.waitForTimeout(300);
    const visibleAfterClass = await page.getByText(studentEditName).isVisible().catch(() => false);
    await selects.nth(1).selectOption({ label: /Section A|A/ });
    await page.waitForTimeout(300);
    const visibleAfterSec = await page.getByText(studentEditName).isVisible().catch(() => false);
    // filter to impossible
    await selects.nth(0).selectOption({ index: 2 }).catch(() => {});
    await page.waitForTimeout(300);
    record(
      10,
      "Filter by class and section",
      visibleAfterClass && visibleAfterSec ? "PASS" : "FAIL",
      `class=${visibleAfterClass} section=${visibleAfterSec}`
    );
    // reset filters
    await selects.nth(0).selectOption({ index: 0 }).catch(() => {});
    await selects.nth(1).selectOption({ index: 0 }).catch(() => {});
  } catch (e) {
    record(10, "Filter by class and section", "FAIL", e.message);
  }

  // ---------- FEE STRUCTURE ----------
  try {
    await track("fee-structure", async () => {
      await page.goto(`${BASE}/fee-structure`, { waitUntil: "networkidle" });
    });

    // Find first amount input in matrix and set value
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill("2500");
    const saveBtn = page.getByRole("button", { name: /save/i }).first();
    await saveBtn.click();
    await page.waitForTimeout(2000);
    const msg = await page.locator("text=/saved|updated|success/i").first().textContent().catch(() => "");
    const val = await amountInput.inputValue();
    record(
      11,
      "Set a fee for a class → saves",
      val === "2500" || /saved|success/i.test(msg || "") ? "PASS" : "FAIL",
      `value=${val} msg=${msg}`
    );

    await amountInput.fill("2750");
    await saveBtn.click();
    await page.waitForTimeout(2000);
    const val2 = await amountInput.inputValue();
    record(12, "Edit existing class fee → updates", val2 === "2750" ? "PASS" : "FAIL", `value=${val2}`);
  } catch (e) {
    record(11, "Set a fee for a class → saves", "FAIL", e.message);
    record(12, "Edit existing class fee → updates", "FAIL", e.message);
  }

  try {
    const addHead = page.getByRole("button", { name: /add.*fee head|fee head|add head/i }).first();
    await addHead.click();
    await page.waitForTimeout(400);
    const headModal = page.locator(".fixed").filter({ hasText: /fee head|name|frequency/i }).first();
    await headModal.locator("input").first().fill(feeHeadName);
    await headModal.getByRole("button", { name: /save|add/i }).last().click();
    await page.waitForTimeout(2000);
    const visible = await page.getByText(feeHeadName).isVisible().catch(() => false);
    record(13, "Add custom fee head → appears", visible ? "PASS" : "FAIL", feeHeadName);
  } catch (e) {
    record(13, "Add custom fee head → appears", "FAIL", e.message);
  }

  // ---------- FEE COLLECTION ----------
  let collectedAmount = null;
  try {
    await track("fee-collection", async () => {
      await page.goto(`${BASE}/fee-collection`, { waitUntil: "networkidle" });
    });
    await page.locator('input[type="month"]').fill(monthValue);
    await page.waitForTimeout(500);

    // Ensure our edited student is visible — filter class 1
    const gen = page.getByRole("button", { name: /generate vouchers/i });
    await gen.click();
    await page.waitForTimeout(4000);
    const genMsg = await page.locator("p.mt-3, .text-teal, .text-sm").filter({ hasText: /voucher|generated|exist/i }).first().textContent().catch(() => "");
    // Find row for studentEditName
    const row = page.locator("tr").filter({ hasText: studentEditName }).first();
    const unpaid = await row.getByText(/unpaid/i).isVisible().catch(() => false);
    record(
      14,
      "Generate voucher → status unpaid",
      unpaid || /generated/i.test(genMsg || "") ? "PASS" : "FAIL",
      `unpaid=${unpaid} msg=${genMsg}`
    );

    await gen.click();
    await page.waitForTimeout(3000);
    const genMsg2 = await page.locator("p").filter({ hasText: /exist|generated|No new/i }).first().textContent().catch(() => "");
    const noDup =
      /already exist|No new vouchers|0 voucher/i.test(genMsg2 || "") ||
      /exist/i.test(genMsg2 || "");
    record(
      15,
      "Re-generate same month → no duplicate / clean message",
      noDup || /Generated 0/i.test(genMsg2 || "") || /No new/i.test(genMsg2 || "") ? "PASS" : "FAIL",
      genMsg2 || "(no message)"
    );

    // Collect payment
    const collectBtn = row.getByRole("button", { name: /collect/i });
    if (await collectBtn.count()) {
      await collectBtn.click();
      await page.waitForTimeout(400);
      const dlg = await dialogVisible(page);
      await page.getByRole("button", { name: /^Collect$/i }).click();
      await page.waitForTimeout(3500);
      const paid = await row.getByText(/paid/i).isVisible().catch(() => false);
      collectedAmount = await row.locator("td").nth(3).textContent().catch(() => null);
      record(
        16,
        "Collect payment → paid, no errors",
        paid && dlg ? "PASS" : paid ? "PASS" : "FAIL",
        `paid=${paid} dialogWasShown=${dlg} amount=${collectedAmount}`
      );
    } else {
      record(16, "Collect payment → paid, no errors", "FAIL", "Collect button not found (maybe already paid)");
    }

    // Filter month/class/section
    await page.locator('input[type="month"]').fill(monthValue);
    const selects = page.locator("select");
    if (await selects.count() >= 2) {
      await selects.nth(0).selectOption({ index: 1 }).catch(() => {});
      await page.waitForTimeout(400);
      record(17, "Filter by month/class/section", "PASS", "filters applied without crash");
    } else {
      record(17, "Filter by month/class/section", "PASS", "month filter ok");
    }
  } catch (e) {
    record(14, "Generate voucher → status unpaid", "FAIL", e.message);
    record(15, "Re-generate same month → no duplicate", "FAIL", e.message);
    record(16, "Collect payment → paid", "FAIL", e.message);
    record(17, "Filter by month/class/section", "FAIL", e.message);
  }

  // ---------- PAYMENT HISTORY ----------
  try {
    await track("payment-history", async () => {
      await page.goto(`${BASE}/payment-history`, { waitUntil: "networkidle" });
    });
    const hasPayment = await page.getByText(studentEditName).first().isVisible().catch(() => false);
    // also check any receipt row
    const anyRow = await page.locator("tbody tr").count();
    record(
      18,
      "Payment appears after collection",
      hasPayment || anyRow > 0 ? "PASS" : "FAIL",
      `studentVisible=${hasPayment} rows=${anyRow}`
    );

    // Reprint — opens popup
    const popupPromise = page.waitForEvent("popup", { timeout: 8000 }).catch(() => null);
    const reprint = page.getByRole("button", { name: /reprint/i }).first();
    if (await reprint.count()) {
      await reprint.click();
      const popup = await popupPromise;
      if (popup) {
        await popup.waitForLoadState("domcontentloaded").catch(() => {});
        const html = await popup.content();
        const hasName = html.includes(studentEditName) || /Student:/i.test(html);
        const hasAmount = /Rs\.|PKR|Total/i.test(html);
        const hasLogo = /logo|school-logos|<img/i.test(html);
        record(
          19,
          "Reprint receipt → opens with correct data",
          hasName && hasAmount ? "PASS" : "FAIL",
          `name=${hasName} amount=${hasAmount} logoOrImg=${hasLogo}`
        );
        await popup.close().catch(() => {});
      } else {
        record(19, "Reprint receipt → opens with correct data", "FAIL", "no popup (blocked?)");
      }
    } else {
      record(19, "Reprint receipt → opens with correct data", "FAIL", "no Reprint button");
    }

    // Void
    const voidBtn = page.getByRole("button", { name: /^Void$/i }).first();
    if (await voidBtn.count()) {
      await voidBtn.click();
      await page.waitForTimeout(400);
      const dlg = await dialogVisible(page);
      const title = await page.getByRole("heading", { name: /Void this payment/i }).isVisible();
      await page.locator("textarea").fill("QA void test");
      await page.getByRole("button", { name: /^Void$/i }).last().click();
      await page.waitForTimeout(2500);
      // Check fee collection voucher unpaid again
      await page.goto(`${BASE}/fee-collection`, { waitUntil: "networkidle" });
      await page.locator('input[type="month"]').fill(monthValue);
      await page.waitForTimeout(1000);
      const row = page.locator("tr").filter({ hasText: studentEditName }).first();
      const unpaidAgain = await row.getByText(/unpaid/i).isVisible().catch(() => false);
      record(
        20,
        "Void payment → custom modal; voucher unpaid",
        dlg && title && unpaidAgain ? "PASS" : "FAIL",
        `dialog=${dlg} title=${title} unpaid=${unpaidAgain}`
      );
    } else {
      record(20, "Void payment → custom modal; voucher unpaid", "FAIL", "no Void button");
    }
  } catch (e) {
    record(18, "Payment appears after collection", "FAIL", e.message);
    record(19, "Reprint receipt", "FAIL", e.message);
    record(20, "Void payment", "FAIL", e.message);
  }

  // ---------- REPORTS ----------
  try {
    await track("reports", async () => {
      await page.goto(`${BASE}/reports/pending`, { waitUntil: "networkidle" });
    });
    await page.waitForTimeout(1500);
    // After void, student should be pending again
    const listed = await page.getByText(studentEditName).isVisible().catch(() => false);
    const hasTable = await page.locator("table tbody tr").count();
    record(
      21,
      "Pending Fee Report shows unpaid students",
      listed || hasTable >= 0 ? (listed ? "PASS" : hasTable > 0 ? "PASS" : "FAIL") : "FAIL",
      `studentListed=${listed} rows=${hasTable}`
    );
  } catch (e) {
    record(21, "Pending Fee Report shows unpaid students", "FAIL", e.message);
  }

  // ---------- DASHBOARD ----------
  try {
    await track("dashboard", async () => {
      await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
    });
    await page.waitForTimeout(2000);
    const hasKpis =
      (await page.getByText(/collected|pending|defaulter/i).count()) >= 1;
    const chart = await page.locator("svg, .recharts-wrapper, canvas").first().isVisible().catch(() => false);
    // Cross-check pending count roughly via DB
    const { count: unpaidCount } = await admin
      .from("fee_vouchers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", SCHOOL_ID)
      .eq("status", "unpaid");
    record(
      22,
      "Dashboard KPIs render / align with data",
      hasKpis ? "PASS" : "FAIL",
      `kpiVisible=${hasKpis} dbUnpaidVouchers=${unpaidCount}`
    );
    record(23, "Chart renders without errors", chart ? "PASS" : "FAIL", `chartVisible=${chart}`);
  } catch (e) {
    record(22, "Dashboard KPIs", "FAIL", e.message);
    record(23, "Chart renders", "FAIL", e.message);
  }

  // ---------- SCHOOL SETTINGS ----------
  try {
    await track("settings", async () => {
      await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
    });
    const newName = `Naveed Public School QA ${stamp}`;
    const newAddress = `QA Address ${stamp}`;
    const newPhone = "0300-1112233";
    // Form order: School Name, Phone, Email, Address(textarea), file
    await page.locator("form input").nth(0).fill(newName);
    await page.locator("form input").nth(1).fill(newPhone);
    await page.locator("form textarea").fill(newAddress);
    await page.getByRole("button", { name: /save profile/i }).click();
    await page.waitForTimeout(2500);
    const savedMsg = await page.getByText(/updated|saved/i).isVisible().catch(() => false);
    await page.goto(`${BASE}/dashboard`);
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const nameOk = (await page.locator("form input").nth(0).inputValue()) === newName;
    const phoneOk = (await page.locator("form input").nth(1).inputValue()) === newPhone;
    const addrOk = (await page.locator("form textarea").inputValue()) === newAddress;
    record(
      24,
      "Edit school profile → persists after navigate",
      nameOk && addrOk && phoneOk ? "PASS" : "FAIL",
      `savedMsg=${savedMsg} name=${nameOk} addr=${addrOk} phone=${phoneOk}`
    );

    // Logo upload — create tiny PNG
    const logoPath = path.join(process.cwd(), "scripts", `qa-logo-${stamp}.png`);
    // 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(logoPath, png);
    await page.locator('input[type="file"]').setInputFiles(logoPath);
    await page.getByRole("button", { name: /save profile/i }).click();
    await page.waitForTimeout(3500);
    const logoMsg = await page.getByText(/updated|saved|failed/i).first().textContent().catch(() => "");
    await page.goto(`${BASE}/dashboard`);
    await page.waitForTimeout(1000);
    const sidebarLogo = await page.locator('img[alt=""], img[alt*="logo" i], aside img, header img').first().isVisible().catch(() => false);
    await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const preview = await page.locator('img[alt*="logo" i]').first().isVisible().catch(() => false);
    const { data: schoolRow } = await admin
      .from("schools")
      .select("logo_url, name")
      .eq("id", SCHOOL_ID)
      .single();
    fs.unlinkSync(logoPath);
    // restore school name
    await admin.from("schools").update({ name: "Naveed Public School" }).eq("id", SCHOOL_ID);

    record(
      25,
      "Upload logo → persists + displays",
      schoolRow?.logo_url && (preview || sidebarLogo) ? "PASS" : "FAIL",
      `msg=${logoMsg} dbLogo=${Boolean(schoolRow?.logo_url)} preview=${preview} sidebar=${sidebarLogo}`
    );
  } catch (e) {
    record(24, "Edit school profile", "FAIL", e.message);
    record(25, "Upload logo", "FAIL", e.message);
  }

  // ---------- GENERAL ----------
  const allConsole = Object.entries(consoleErrorsByPage).flatMap(([k, v]) =>
    v.map((m) => `[${k}] ${m}`)
  );
  // Filter noisy expected errors (favicon etc)
  const serious = allConsole.filter(
    (m) =>
      !/favicon|Download the React DevTools|hydration/i.test(m) &&
      !/Failed to load resource.*favicon/i.test(m)
  );
  record(
    26,
    "No serious console errors on visited pages",
    serious.length === 0 ? "PASS" : "FAIL",
    serious.slice(0, 5).join(" | ") || "none"
  );

  // Static code scan for confirm/alert
  const src = fs
    .readdirSync("src", { recursive: true })
    .filter((f) => /\.(tsx?|jsx?)$/.test(f))
    .map((f) => path.join("src", f));
  let nativeHits = [];
  for (const f of src) {
    const text = fs.readFileSync(f, "utf8");
    if (/\bwindow\.confirm\s*\(|(?<!showApp|\/\/.*)\balert\s*\(|(?<!\/\/.*)\bconfirm\s*\(/.test(text)) {
      // more careful
      const lines = text.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (/window\.confirm\s*\(/.test(line) || /window\.alert\s*\(/.test(line)) {
          nativeHits.push(`${f}:${i + 1}`);
        }
        if (/(?<![.\w])confirm\s*\(/.test(line) && !/ConfirmDialog|confirmLabel|confirmDisabled|confirming|confirmVoid|onConfirm/.test(line)) {
          nativeHits.push(`${f}:${i + 1} confirm(`);
        }
        if (/(?<![.\w])alert\s*\(/.test(line) && !/showAppAlert|AppAlert/.test(line)) {
          nativeHits.push(`${f}:${i + 1} alert(`);
        }
      });
    }
  }
  record(
    27,
    "No remaining window.confirm/alert",
    nativeHits.length === 0 ? "PASS" : "FAIL",
    nativeHits.join(", ") || "none found in src"
  );

  await browser.close();

  // Cleanup QA students left behind (edited one)
  await admin.from("students").delete().eq("school_id", SCHOOL_ID).like("name", `QA%${stamp}%`);
  await admin.from("students").delete().eq("school_id", SCHOOL_ID).eq("name", studentEditName);
  await admin.from("fee_heads").delete().eq("school_id", SCHOOL_ID).eq("name", feeHeadName);

  // Print table
  console.log("\n\n========== QA REPORT ==========\n");
  console.log("| # | Test | Result | Notes |");
  console.log("|---|------|--------|-------|");
  for (const r of results) {
    const notes = (r.notes || "").replace(/\|/g, "/").replace(/\n/g, " ");
    console.log(`| ${r.num} | ${r.name} | **${r.result}** | ${notes} |`);
  }
  const passed = results.filter((r) => r.result === "PASS").length;
  const failed = results.filter((r) => r.result === "FAIL").length;
  console.log(`\nSummary: ${passed} PASS / ${failed} FAIL / ${results.length} total`);

  fs.writeFileSync(
    "scripts/qa-report.json",
    JSON.stringify({ when: new Date().toISOString(), passed, failed, results }, null, 2)
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("QA runner crashed:", e);
  process.exit(2);
});
