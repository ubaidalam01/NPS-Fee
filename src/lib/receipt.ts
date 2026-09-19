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

export function printReceipt(data: ReceiptData) {
  const rows = data.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${i.name}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${formatPKR(i.amount)}</td></tr>`
    )
    .join("");

  const logoHtml = data.schoolLogoUrl
    ? `<img src="${data.schoolLogoUrl}" alt="" style="max-height:56px;max-width:120px;object-fit:contain;margin-bottom:8px"/>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><title>Receipt ${data.receiptNo}</title>
<style>
  body{font-family:Georgia,serif;color:#1B2A4A;padding:24px;max-width:480px;margin:0 auto}
  h1{font-size:20px;margin:0}
  .muted{color:#6b7c93;font-size:12px}
  .badge{display:inline-block;background:#A8D842;color:#1B2A4A;padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
  .total{font-size:18px;font-weight:800;margin-top:12px;display:flex;justify-content:space-between}
  hr{border:none;border-top:1px dashed #dce6ec;margin:16px 0}
  @media print{body{padding:0}}
</style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      ${logoHtml}
      <h1>${data.schoolName}</h1>
      <p class="muted">${data.schoolAddress ?? ""}</p>
      <p class="muted">${data.schoolPhone ?? ""}</p>
    </div>
    <span class="badge">CASH</span>
  </div>
  <hr/>
  <p><strong>Receipt No:</strong> ${data.receiptNo}</p>
  <p><strong>Voucher No:</strong> ${data.voucherNo}</p>
  <p><strong>Date:</strong> ${formatDate(data.paidAt)}</p>
  <p><strong>Billing Month:</strong> ${formatMonth(data.billingMonth)}</p>
  <hr/>
  <p><strong>Student:</strong> ${data.studentName}</p>
  <p><strong>Father:</strong> ${data.fatherName}</p>
  <p><strong>Class:</strong> ${data.className}-${data.section} &nbsp; <strong>Roll:</strong> ${data.rollNo}</p>
  <table>
    <thead><tr><th style="text-align:left">Fee Head</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total"><span>Total Paid</span><span>${formatPKR(data.amount)}</span></div>
  <p class="muted" style="margin-top:24px;text-align:center">Thank you. This is a computer-generated receipt.</p>
  <script>window.onload=()=>{window.print()}</script>
</body></html>`;

  const w = window.open("", "_blank", "width=520,height=720");
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
