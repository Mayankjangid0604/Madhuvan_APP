// Utilities for building fee-related printable documents:
//  - Invoice   (for pending fees; split for online-payment students; capped at ₹60,000/invoice)
//  - Receipt   (issued only after a fee is paid)
//  - Bill      (for expense entries in the ledger)
//  - Voucher   (for expense/salary payments)
//
// All amounts are in ₹.
import { printElement } from "./printUtil";

const fmtINR = (amount) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    Math.round(Number(amount || 0) * 100) / 100
  );

const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const escapeHtml = (str) =>
  String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

/**
 * One invoice per fee — no splitting for half-yearly / yearly cycles.
 * Kept as a helper (single-element array) so existing callers stay simple.
 */
export const splitInvoicesForFee = ({ total_amount, fee_type_cycle, period_start }) => {
  const total = Number(total_amount) || 0;
  const cycle = (fee_type_cycle || "monthly").toLowerCase();
  const months = cycle === "half_yearly" ? 6 : cycle === "yearly" ? 12 : 1;

  const start = period_start ? new Date(period_start) : new Date();
  const invStart = new Date(start.getFullYear(), start.getMonth(), 1);
  const invEnd = new Date(start.getFullYear(), start.getMonth() + months, 0);

  return [
    {
      index: 1,
      total: 1,
      amount: Math.round(total * 100) / 100,
      period_start: invStart.toISOString().split("T")[0],
      period_end: invEnd.toISOString().split("T")[0],
    },
  ];
};

/**
 * gstSplitFromOnlineInvoice(invoice_amount)
 * Splits an online-payment invoice amount into Accommodation + Mess parts.
 *   - Mess = ₹5000 + 2.5% CGST + 2.5% SGST (i.e. mess base 5000, taxes on top)
 *   - Accommodation = remaining amount (GST inclusive; back-calculated)
 * If invoice_amount < mess total, all of it becomes mess-taxed portion.
 */
export const gstSplitFromOnlineInvoice = (invoice_amount) => {
  const total = Number(invoice_amount) || 0;
  const messBase = 5000;
  const messCgst = messBase * 0.025;
  const messSgst = messBase * 0.025;
  const messTotal = messBase + messCgst + messSgst; // 5250

  if (total <= messTotal) {
    // Whole thing lumped as mess-only (edge case)
    const t = total / 1.05;
    return {
      accommodation: { base: 0, cgst: 0, sgst: 0, total: 0 },
      mess: { base: Math.round(t * 100) / 100, cgst: Math.round(t * 0.025 * 100) / 100, sgst: Math.round(t * 0.025 * 100) / 100, total },
      grand_total: total,
    };
  }

  const accomTotal = total - messTotal;
  // Accommodation is GST inclusive: base * 1.05 = accomTotal
  const accomBase = accomTotal / 1.05;
  const accomCgst = accomBase * 0.025;
  const accomSgst = accomBase * 0.025;

  return {
    accommodation: {
      base: Math.round(accomBase * 100) / 100,
      cgst: Math.round(accomCgst * 100) / 100,
      sgst: Math.round(accomSgst * 100) / 100,
      total: Math.round(accomTotal * 100) / 100,
    },
    mess: {
      base: messBase,
      cgst: Math.round(messCgst * 100) / 100,
      sgst: Math.round(messSgst * 100) / 100,
      total: messTotal,
    },
    grand_total: total,
  };
};

// ============================================
// SHARED STYLES
// ============================================
const baseStyles = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; }
  .doc-wrap { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #cbd5e1; }
  .doc-header { display: flex; justify-content: space-between; align-items: start; border-bottom: 3px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
  .doc-title { font-size: 22px; color: #1e3a8a; font-weight: 700; }
  .doc-subtitle { font-size: 12px; color: #64748b; margin-top: 4px; }
  .doc-meta { text-align: right; font-size: 11px; color: #475569; }
  .doc-meta strong { color: #1e293b; }
  .party-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .party-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; background: #f8fafc; }
  .party-box h4 { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
  .party-box .name { font-weight: 700; font-size: 13px; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  .items-table th { background: #1e40af; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; }
  .items-table td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  .items-table tfoot td { font-weight: 700; background: #f1f5f9; }
  .text-right { text-align: right; }
  .totals-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-left: auto; width: 280px; }
  .totals-box .row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
  .totals-box .row.grand { border-top: 2px solid #1e40af; margin-top: 8px; padding-top: 8px; font-weight: 800; font-size: 14px; color: #1e40af; }
  .doc-footer { margin-top: 24px; padding-top: 16px; border-top: 1px dashed #cbd5e1; font-size: 11px; color: #64748b; text-align: center; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 40px; }
  .sig-box { text-align: center; font-size: 11px; color: #475569; width: 180px; }
  .sig-line { border-top: 1px solid #1e293b; margin-bottom: 4px; padding-top: 40px; }
  .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .badge.paid { background: #dcfce7; color: #166534; }
  .badge.due { background: #fef3c7; color: #92400e; }
  .badge.split { background: #ede9fe; color: #6d28d9; }
`;

// ============================================
// INVOICE (for pending / unpaid fees)
// ============================================
export const buildInvoiceHTML = ({
  hostel = {},
  student = {},
  invoice_no,
  invoice_date,
  period_start,
  period_end,
  amount,
  fee_type = "Hostel Fee",
  is_online_payment = false,
  split_index,
  split_total,
}) => {
  const hostelName = escapeHtml(hostel.hostel_name || "Madhuvan Hostel");
  const hostelAddr = [hostel.address_line1, hostel.address_line2].filter(Boolean).map(escapeHtml).join(", ");
  const hostelPhone = escapeHtml(hostel.phone || "");
  const hostelEmail = escapeHtml(hostel.email || "");
  const hostelGstin = escapeHtml(hostel.gstin || "");

  const splitBadge = "";

  let itemsRows = "";
  if (is_online_payment) {
    const parts = gstSplitFromOnlineInvoice(amount);
    itemsRows = `
      <tr>
        <td>Accommodation Fee<br><small style="color:#64748b">SAC 996311 (GST-inclusive)</small></td>
        <td class="text-right">${fmtINR(parts.accommodation.base)}</td>
        <td class="text-right">${fmtINR(parts.accommodation.cgst)}</td>
        <td class="text-right">${fmtINR(parts.accommodation.sgst)}</td>
        <td class="text-right">${fmtINR(parts.accommodation.total)}</td>
      </tr>
      <tr>
        <td>Mess / Food Charges<br><small style="color:#64748b">SAC 996333</small></td>
        <td class="text-right">${fmtINR(parts.mess.base)}</td>
        <td class="text-right">${fmtINR(parts.mess.cgst)}</td>
        <td class="text-right">${fmtINR(parts.mess.sgst)}</td>
        <td class="text-right">${fmtINR(parts.mess.total)}</td>
      </tr>
    `;
    const totalCgst = parts.accommodation.cgst + parts.mess.cgst;
    const totalSgst = parts.accommodation.sgst + parts.mess.sgst;
    const totalBase = parts.accommodation.base + parts.mess.base;
    itemsRows += `
      <tr style="background:#f1f5f9;font-weight:700">
        <td>Totals</td>
        <td class="text-right">${fmtINR(totalBase)}</td>
        <td class="text-right">${fmtINR(totalCgst)}</td>
        <td class="text-right">${fmtINR(totalSgst)}</td>
        <td class="text-right">${fmtINR(parts.grand_total)}</td>
      </tr>
    `;
  } else {
    itemsRows = `
      <tr>
        <td>${escapeHtml(fee_type)}<br><small style="color:#64748b">Period: ${fmtDate(period_start)} – ${fmtDate(period_end)}</small></td>
        <td class="text-right" colspan="3">—</td>
        <td class="text-right">${fmtINR(amount)}</td>
      </tr>
    `;
  }

  return `
    <div class="doc-wrap">
      <div class="doc-header">
        <div>
          <div class="doc-title">${hostelName}</div>
          <div class="doc-subtitle">${hostelAddr}</div>
          ${hostelPhone ? `<div class="doc-subtitle">📞 ${hostelPhone}</div>` : ""}
          ${hostelEmail ? `<div class="doc-subtitle">✉️ ${hostelEmail}</div>` : ""}
          ${hostelGstin ? `<div class="doc-subtitle">GSTIN: <strong>${hostelGstin}</strong></div>` : ""}
        </div>
        <div class="doc-meta">
          <div style="font-size:16px;font-weight:800;color:#1e40af">TAX INVOICE</div>
          <div>${splitBadge}</div>
          <div style="margin-top:6px"><strong>Invoice #:</strong> ${escapeHtml(invoice_no || "")}</div>
          <div><strong>Date:</strong> ${fmtDate(invoice_date)}</div>
          <div><strong>Period:</strong> ${fmtDate(period_start)} – ${fmtDate(period_end)}</div>
          <div><span class="badge due">Payment Pending</span></div>
        </div>
      </div>

      <div class="party-grid">
        <div class="party-box">
          <h4>Billed To</h4>
          <div class="name">${escapeHtml(student.student_name || "")}</div>
          <div>Student ID: <strong>${escapeHtml(student.student_id || "")}</strong></div>
          ${student.father_name ? `<div>Father: ${escapeHtml(student.father_name)}</div>` : ""}
          ${student.student_mobile ? `<div>Mobile: ${escapeHtml(student.student_mobile)}</div>` : ""}
          ${student.class_or_coaching ? `<div>Class: ${escapeHtml(student.class_or_coaching)}</div>` : ""}
        </div>
        <div class="party-box">
          <h4>Payment Mode</h4>
          <div class="name">${is_online_payment ? "🔷 ONLINE (GST Applicable)" : "💵 CASH"}</div>
          <div style="margin-top:6px;font-size:11px;color:#64748b">
            ${is_online_payment
              ? "This invoice is generated per GST rules for online payments."
              : "Cash payment invoice — no GST split."}
          </div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="text-right">Taxable Value</th>
            <th class="text-right">CGST (2.5%)</th>
            <th class="text-right">SGST (2.5%)</th>
            <th class="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <div class="totals-box">
        <div class="row"><span>Sub Total</span><span>₹ ${fmtINR(amount)}</span></div>
        <div class="row grand"><span>Grand Total</span><span>₹ ${fmtINR(amount)}</span></div>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div>Student / Guardian</div>
        <div class="sig-box"><div class="sig-line"></div>For ${hostelName}</div>
      </div>

      <div class="doc-footer">
        This is an invoice for pending fee. A receipt will be issued after payment.<br/>
        Generated on ${fmtDate(new Date())}
      </div>
    </div>
  `;
};

// ============================================
// RECEIPT (only after payment)
// ============================================
export const buildReceiptHTML = ({
  hostel = {},
  student = {},
  receipt_no,
  payment_date,
  amount_received,
  payment_mode = "CASH",
  reference_no,
  for_period_start,
  for_period_end,
  notes,
}) => {
  const hostelName = escapeHtml(hostel.hostel_name || "Madhuvan Hostel");
  const hostelAddr = [hostel.address_line1, hostel.address_line2].filter(Boolean).map(escapeHtml).join(", ");
  return `
    <div class="doc-wrap">
      <div class="doc-header">
        <div>
          <div class="doc-title">${hostelName}</div>
          <div class="doc-subtitle">${hostelAddr}</div>
        </div>
        <div class="doc-meta">
          <div style="font-size:16px;font-weight:800;color:#059669">PAYMENT RECEIPT</div>
          <div><span class="badge paid">PAID</span></div>
          <div style="margin-top:6px"><strong>Receipt #:</strong> ${escapeHtml(receipt_no || "")}</div>
          <div><strong>Date:</strong> ${fmtDate(payment_date)}</div>
        </div>
      </div>

      <div class="party-grid">
        <div class="party-box">
          <h4>Received From</h4>
          <div class="name">${escapeHtml(student.student_name || "")}</div>
          <div>Student ID: <strong>${escapeHtml(student.student_id || "")}</strong></div>
          ${student.father_name ? `<div>Father: ${escapeHtml(student.father_name)}</div>` : ""}
          ${student.student_mobile ? `<div>Mobile: ${escapeHtml(student.student_mobile)}</div>` : ""}
        </div>
        <div class="party-box">
          <h4>Payment Details</h4>
          <div><strong>Amount:</strong> ₹ ${fmtINR(amount_received)}</div>
          <div><strong>Mode:</strong> ${escapeHtml(payment_mode)}</div>
          ${reference_no ? `<div><strong>Reference:</strong> ${escapeHtml(reference_no)}</div>` : ""}
          ${for_period_start ? `<div><strong>For Period:</strong> ${fmtDate(for_period_start)} – ${fmtDate(for_period_end)}</div>` : ""}
        </div>
      </div>

      <div style="border:2px dashed #059669; border-radius:8px; padding:20px; text-align:center; background:#f0fdf4">
        <div style="font-size:11px; color:#065f46; text-transform:uppercase; letter-spacing:1px">Amount Received (In Words)</div>
        <div style="margin-top:6px; font-size:14px; font-weight:700; color:#064e3b">
          Rupees ${amountToWords(amount_received)} only
        </div>
      </div>

      ${notes ? `<div style="margin-top:12px; padding:10px; background:#fef9c3; border-radius:6px; font-size:12px">📝 ${escapeHtml(notes)}</div>` : ""}

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div>Payer</div>
        <div class="sig-box"><div class="sig-line"></div>For ${hostelName}</div>
      </div>

      <div class="doc-footer">
        Thank you for your payment. Please retain this receipt for your records.
      </div>
    </div>
  `;
};

// ============================================
// BILL (for expenses in ledger)
// ============================================
export const buildBillHTML = ({ hostel = {}, entry }) => {
  const hostelName = escapeHtml(hostel.hostel_name || "Madhuvan Hostel");
  const hostelAddr = [hostel.address_line1, hostel.address_line2].filter(Boolean).map(escapeHtml).join(", ");
  return `
    <div class="doc-wrap">
      <div class="doc-header">
        <div>
          <div class="doc-title">${hostelName}</div>
          <div class="doc-subtitle">${hostelAddr}</div>
        </div>
        <div class="doc-meta">
          <div style="font-size:16px;font-weight:800;color:#dc2626">EXPENSE BILL</div>
          <div><strong>Bill #:</strong> EXP-${escapeHtml(entry.entry_id || "")}</div>
          <div><strong>Date:</strong> ${fmtDate(entry.entry_date)}</div>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Category</th>
            <th>Payment Mode</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(entry.description || "-")}</td>
            <td>${escapeHtml((entry.category || "-").replace(/_/g, " "))}</td>
            <td>${escapeHtml(entry.payment_mode || "CASH")}</td>
            <td class="text-right">₹ ${fmtINR(entry.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" class="text-right">Total</td>
            <td class="text-right">₹ ${fmtINR(entry.amount)}</td>
          </tr>
        </tfoot>
      </table>

      ${entry.reference_no ? `<div style="margin-bottom:10px"><strong>Reference:</strong> ${escapeHtml(entry.reference_no)}</div>` : ""}

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div>Prepared By</div>
        <div class="sig-box"><div class="sig-line"></div>Authorized Signatory</div>
      </div>

      <div class="doc-footer">Generated on ${fmtDate(new Date())}</div>
    </div>
  `;
};

// ============================================
// VOUCHER (payment voucher for salary / expense payout)
// ============================================
export const buildVoucherHTML = ({ hostel = {}, voucher_no, date, payee, amount, purpose, payment_mode = "CASH", reference_no }) => {
  const hostelName = escapeHtml(hostel.hostel_name || "Madhuvan Hostel");
  return `
    <div class="doc-wrap">
      <div class="doc-header">
        <div>
          <div class="doc-title">${hostelName}</div>
        </div>
        <div class="doc-meta">
          <div style="font-size:16px;font-weight:800;color:#7c3aed">PAYMENT VOUCHER</div>
          <div><strong>Voucher #:</strong> ${escapeHtml(voucher_no || "")}</div>
          <div><strong>Date:</strong> ${fmtDate(date)}</div>
        </div>
      </div>

      <div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin-bottom:16px">
        <div style="margin-bottom:8px"><strong>Paid To:</strong> ${escapeHtml(payee)}</div>
        <div style="margin-bottom:8px"><strong>Purpose:</strong> ${escapeHtml(purpose)}</div>
        <div style="margin-bottom:8px"><strong>Payment Mode:</strong> ${escapeHtml(payment_mode)}</div>
        ${reference_no ? `<div style="margin-bottom:8px"><strong>Reference:</strong> ${escapeHtml(reference_no)}</div>` : ""}
        <div style="margin-top:10px; padding:12px; background:#f5f3ff; border-radius:6px; text-align:center">
          <div style="font-size:11px; color:#6d28d9; text-transform:uppercase">Amount</div>
          <div style="font-size:20px; font-weight:800; color:#5b21b6">₹ ${fmtINR(amount)}</div>
          <div style="font-size:12px; color:#6d28d9; margin-top:4px">Rupees ${amountToWords(amount)} only</div>
        </div>
      </div>

      <div class="sig-row">
        <div class="sig-box"><div class="sig-line"></div>Receiver</div>
        <div class="sig-box"><div class="sig-line"></div>Approved By</div>
      </div>

      <div class="doc-footer">Generated on ${fmtDate(new Date())}</div>
    </div>
  `;
};

// ============================================
// Number to words (Indian format, integer part)
// ============================================
function amountToWords(num) {
  const n = Math.floor(Number(num) || 0);
  if (n === 0) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (v) => {
    if (v < 20) return a[v];
    if (v < 100) return b[Math.floor(v / 10)] + (v % 10 ? " " + a[v % 10] : "");
    return a[Math.floor(v / 100)] + " Hundred" + (v % 100 ? " " + inWords(v % 100) : "");
  };
  let s = "";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  if (crore) s += inWords(crore) + " Crore ";
  if (lakh) s += inWords(lakh) + " Lakh ";
  if (thousand) s += inWords(thousand) + " Thousand ";
  if (rest) s += inWords(rest);
  return s.trim();
}

// Print helpers
export const printInvoice = (params) => {
  const html = buildInvoiceHTML(params);
  printElement(html, `Invoice-${params.invoice_no || "New"}`, baseStyles);
};
export const printReceipt = (params) => {
  const html = buildReceiptHTML(params);
  printElement(html, `Receipt-${params.receipt_no || "New"}`, baseStyles);
};
export const printBill = (params) => {
  const html = buildBillHTML(params);
  printElement(html, `Bill-${params.entry?.entry_id || "New"}`, baseStyles);
};
export const printVoucher = (params) => {
  const html = buildVoucherHTML(params);
  printElement(html, `Voucher-${params.voucher_no || "New"}`, baseStyles);
};

// Print all invoices for a fee (auto-split for half-yearly/yearly)
export const printAllInvoicesForFee = ({ hostel, student, fee, is_online_payment }) => {
  const invoices = splitInvoicesForFee({
    total_amount: fee.final_amount || fee.fee_amount,
    fee_type_cycle: student.fee_type_cycle,
    period_start: fee.fee_period_start || fee.fee_month,
  });
  const merged = invoices
    .map((inv) =>
      buildInvoiceHTML({
        hostel,
        student,
        invoice_no: `INV-${student.student_id}-${fee.fee_id}-${inv.index}`,
        invoice_date: new Date().toISOString().split("T")[0],
        period_start: inv.period_start,
        period_end: inv.period_end,
        amount: inv.amount,
        fee_type: fee.fee_type || "Hostel Fee",
        is_online_payment,
        split_index: inv.index,
        split_total: inv.total,
      })
    )
    .join('<div style="page-break-after: always"></div>');
  printElement(merged, `Invoices-${student.student_name}`, baseStyles);
};
