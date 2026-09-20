import { formatPKR, formatDate, formatMonth } from "@/lib/utils";
import { showAppAlert } from "@/lib/app-alert";

export type ReceiptData = {
  schoolName: string;
  schoolLogoUrl?: string | null;
  schoolAddress: string | null;
  schoolPhone: string | null;
  receiptNo: string;
  voucherNo: string;
  studentName: string;
  fatherName: string;
  className: string;
  section: string;
  rollNo: string;
  billingMonth: string;
  amount: number;
  paidAt: string;
  items: { name: string; amount: number }[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function schoolInitial(name: string): string {
  const trimmed = name.trim();
  return (trimmed.charAt(0) || "S").toUpperCase();
}

/**
 * Opens a print-ready receipt window. Uses the school's uploaded logo_url when
 * provided; otherwise a circular monogram with the school initial.
 */
export function printReceipt(data: ReceiptData) {
  const schoolName = escapeHtml(data.schoolName || "School");
  const address = escapeHtml(data.schoolAddress?.trim() || "");
  const phone = escapeHtml(data.schoolPhone?.trim() || "");
  const addressLine = [address, phone].filter(Boolean).join(" · ");

  const items =
    data.items.length > 0
      ? data.items
      : [{ name: "Fee payment", amount: data.amount }];

  const rows = items
    .map(
      (i) => `
      <tr>
        <td>${escapeHtml(i.name)}</td>
        <td class="amt">${formatPKR(i.amount)}</td>
      </tr>`
    )
    .join("");

  const logoUrl = data.schoolLogoUrl?.trim() || "";
  const logoBlock = logoUrl
    ? `<img class="logo" src="${escapeHtml(logoUrl)}" alt="" />`
    : `<div class="logo-fallback" aria-hidden="true">${escapeHtml(
        schoolInitial(data.schoolName)
      )}</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Receipt ${escapeHtml(data.receiptNo)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      color: #1B2A4A;
      background: #fff;
    }
    .sheet {
      max-width: 440px;
      margin: 0 auto;
      border: 1px solid #dce6ec;
      border-radius: 12px;
      overflow: hidden;
    }
    .header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      background: #1B2A4A;
      color: #fff;
      padding: 18px 20px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
      flex: 1;
    }
    .logo, .logo-fallback {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      flex-shrink: 0;
      object-fit: cover;
      background: #fff;
    }
    .logo-fallback {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 800;
      color: #1B2A4A;
      border: 2px solid #A8D842;
    }
    .brand-text { min-width: 0; }
    .brand-text h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      line-height: 1.25;
      color: #fff;
    }
    .brand-text p {
      margin: 4px 0 0;
      font-size: 11px;
      line-height: 1.35;
      color: rgba(255,255,255,0.78);
    }
    .badge {
      flex-shrink: 0;
      background: #A8D842;
      color: #1B2A4A;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 5px 12px;
      border-radius: 999px;
    }
    .body { padding: 18px 20px 20px; }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 16px;
      margin-bottom: 16px;
    }
    .field .label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #6b7c93;
      margin-bottom: 2px;
    }
    .field .value {
      font-size: 13px;
      font-weight: 600;
      color: #1B2A4A;
      word-break: break-word;
    }
    .divider {
      border: none;
      border-top: 1px dashed #dce6ec;
      margin: 0 0 14px;
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.items thead th {
      text-align: left;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #6b7c93;
      padding: 0 0 8px;
      border-bottom: 1px solid #dce6ec;
    }
    table.items thead th:last-child { text-align: right; }
    table.items td {
      padding: 9px 0;
      border-bottom: 1px solid #eef2f5;
      vertical-align: top;
    }
    table.items td.amt {
      text-align: right;
      font-weight: 600;
      white-space: nowrap;
      padding-left: 12px;
    }
    .total-box {
      margin-top: 14px;
      background: #f0f3f6;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .total-box .label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #6b7c93;
    }
    .total-box .amount {
      font-size: 22px;
      font-weight: 800;
      color: #1B2A4A;
      line-height: 1;
    }
    .sign-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 36px;
      gap: 16px;
    }
    .office-copy {
      font-size: 11px;
      font-style: italic;
      color: #6b7c93;
      font-weight: 600;
    }
    .signature {
      text-align: right;
      min-width: 140px;
    }
    .signature .line {
      border-top: 1px solid #1B2A4A;
      margin-bottom: 6px;
    }
    .signature .cap {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7c93;
    }
    .footer {
      margin-top: 20px;
      text-align: center;
      font-size: 10px;
      color: #6b7c93;
      line-height: 1.4;
    }
    @media print {
      body { padding: 0; }
      .sheet { border: none; border-radius: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        ${logoBlock}
        <div class="brand-text">
          <h1>${schoolName}</h1>
          ${addressLine ? `<p>${addressLine}</p>` : ""}
        </div>
      </div>
      <span class="badge">CASH</span>
    </div>

    <div class="body">
      <div class="meta">
        <div class="field">
          <span class="label">Receipt No.</span>
          <span class="value">${escapeHtml(data.receiptNo)}</span>
        </div>
        <div class="field">
          <span class="label">Date</span>
          <span class="value">${escapeHtml(formatDate(data.paidAt))}</span>
        </div>
        <div class="field">
          <span class="label">Voucher No.</span>
          <span class="value">${escapeHtml(data.voucherNo)}</span>
        </div>
        <div class="field">
          <span class="label">Billing Month</span>
          <span class="value">${escapeHtml(formatMonth(data.billingMonth))}</span>
        </div>
      </div>

      <hr class="divider"/>

      <div class="meta">
        <div class="field">
          <span class="label">Student</span>
          <span class="value">${escapeHtml(data.studentName)}</span>
        </div>
        <div class="field">
          <span class="label">Father's Name</span>
          <span class="value">${escapeHtml(data.fatherName)}</span>
        </div>
        <div class="field">
          <span class="label">Class / Section</span>
          <span class="value">${escapeHtml(`${data.className}-${data.section}`)}</span>
        </div>
        <div class="field">
          <span class="label">GR No.</span>
          <span class="value">${escapeHtml(data.rollNo)}</span>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Fee Head</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="total-box">
        <span class="label">Total Paid</span>
        <span class="amount">${formatPKR(data.amount)}</span>
      </div>

      <div class="sign-row">
        <span class="office-copy">OFFICE COPY</span>
        <div class="signature">
          <div class="line"></div>
          <div class="cap">Authorized Signature</div>
        </div>
      </div>

      <p class="footer">
        This is a computer-generated receipt and does not require a physical stamp.
      </p>
    </div>
  </div>
  <script>
    window.onload = function () {
      var img = document.querySelector(".logo");
      function go() { window.print(); }
      if (img && !img.complete) {
        img.onload = go;
        img.onerror = go;
        setTimeout(go, 1500);
      } else {
        go();
      }
    };
  </script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=520,height=780");
  if (!w) {
    showAppAlert(
      "Please allow pop-ups in your browser to print receipts.",
      "Pop-up blocked"
    );
    return;
  }
  w.document.write(html);
  w.document.close();
}
