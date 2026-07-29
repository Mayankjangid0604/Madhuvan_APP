import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  Home,
  Calendar,
  User,
  MessageSquare,
  LogOut,
  IndianRupee,
  Wallet,
  Info,
  ShieldAlert,
  CheckCircle,
  Shield,
} from "lucide-react";
import Button from "../buttons/Button";
import RefundReceiptModal from "./RefundReceiptModal";
import DateInput from "../common/DateInput";
import { fineAPI } from "../../services/api/fine.api";
import { feeAPI } from "../../services/api/fee.api";
import "./checkoutModal.css";

const toNumber = (v) => Number(v) || 0;

const CheckoutStudent = ({ student, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [showRefundReceipt, setShowRefundReceipt] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [securityInfo, setSecurityInfo] = useState(null);
  const [feeSummary, setFeeSummary] = useState(null);
  const [feeSummaryLoading, setFeeSummaryLoading] = useState(true);
  const [exitPreview, setExitPreview] = useState(null);
  const [feeRefundApplied, setFeeRefundApplied] = useState(false);
  const [successModal, setSuccessModal] = useState({
    show: false,
    refund_amount: 0,
  });
  const [checkoutData, setCheckoutData] = useState({
    checkout_date: new Date().toISOString().split("T")[0],
    reason: "",
    remarks: "",
    refund_amount: "",
    payment_mode: "Cash",
  });

  // Fetch security deposit info
  useEffect(() => {
    if (student?.student_id) {
      fineAPI.getStudentSecurity(student.student_id)
        .then(res => {
          const data = res.data?.data;
          if (data) {
            setSecurityInfo(data);
            // Auto-fill refund amount with remaining security
            if (data.remaining_security > 0) {
              setCheckoutData(prev => ({
                ...prev,
                refund_amount: String(data.remaining_security)
              }));
            }
          }
        })
        .catch(err => console.error("Failed to fetch security info:", err));
    }
  }, [student?.student_id]);

  // Fetch pending/due fee records so the admin can see what's outstanding
  // before checkout writes off any unpaid fees.
  useEffect(() => {
    if (student?.student_id) {
      setFeeSummaryLoading(true);
      feeAPI.getStudentFeeSummary(student.student_id)
        .then(res => setFeeSummary(res.data?.data || null))
        .catch(err => console.error("Failed to fetch fee summary:", err))
        .finally(() => setFeeSummaryLoading(false));
    }
  }, [student?.student_id]);

  // Auto-calculate a refund for unused days already paid for, whenever the
  // checkout date changes.
  useEffect(() => {
    if (student?.student_id && checkoutData.checkout_date) {
      feeAPI.getEarlyExitInvoice(student.student_id, checkoutData.checkout_date)
        .then(res => setExitPreview(res.data?.data || null))
        .catch(err => console.error("Failed to compute exit fee refund:", err));
      setFeeRefundApplied(false);
    }
  }, [student?.student_id, checkoutData.checkout_date]);

  const pendingFeeRows = (feeSummary?.fees || []).filter(f => f.remaining > 0);
  const pendingOtherTotal = toNumber(feeSummary?.summary?.pending_fines) +
    toNumber(feeSummary?.summary?.pending_damages) +
    toNumber(feeSummary?.summary?.pending_money_given);
  const totalPendingDue = pendingFeeRows.reduce((sum, f) => sum + toNumber(f.remaining), 0) +
    pendingOtherTotal;

  const feeRefund = exitPreview?.refund;

  const applyFeeRefund = () => {
    if (!feeRefund?.applicable) return;
    setCheckoutData(prev => ({
      ...prev,
      refund_amount: String(Number(prev.refund_amount || 0) + feeRefund.amount)
    }));
    setFeeRefundApplied(true);
  };

  const checkoutReasons = [
    { value: "", label: "-- Select Reason --" },
    { value: "Course Completed", label: "Course Completed" },
    { value: "Changed Coaching", label: "Changed Coaching" },
    { value: "Personal Reasons", label: "Personal Reasons" },
    { value: "Shifted to Another Hostel", label: "Shifted to Another Hostel" },
    { value: "Going Home", label: "Going Home" },
    { value: "Financial Issues", label: "Financial Issues" },
    { value: "Disciplinary Action", label: "Disciplinary Action" },
    { value: "Health Issues", label: "Health Issues" },
    { value: "Relocation", label: "Relocation" },
    { value: "Other", label: "Other" },
  ];

  const paymentModes = [
    { value: "Cash", label: "Cash" },
    { value: "UPI", label: "UPI" },
    { value: "Bank Transfer", label: "Bank Transfer" },
    { value: "Cheque", label: "Cheque" },
  ];

  const refundAmount = Number(checkoutData.refund_amount || 0);

  // Step 1: Validate and show custom confirm modal
  const handleCheckout = () => {
    setError("");

    if (!checkoutData.reason.trim()) {
      setError("Please select a reason for checkout");
      return;
    }

    if (checkoutData.refund_amount && refundAmount < 0) {
      setError("Refund amount cannot be negative");
      return;
    }

    // Show custom confirmation modal instead of window.confirm
    setShowConfirmModal(true);
  };

  // Step 2: User confirmed - proceed with checkout
  const handleConfirmProceed = async () => {
    setShowConfirmModal(false);
    setLoading(true);
    setError("");

    try {
      await onConfirm({
        ...checkoutData,
        refund_amount: refundAmount,
      });

      // Show success modal
      setSuccessModal({
        show: true,
        refund_amount: refundAmount,
      });
    } catch (err) {
      setError(err.message || "Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Close success modal and notify parent
  const handleSuccessClose = () => {
    setSuccessModal({ show: false, refund_amount: 0 });
    onClose();
  };

  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
  };

  // Calculate duration
  const joinDate = new Date(student.date_of_joining);
  const today = new Date();
  const durationDays = Math.floor(
    (today - joinDate) / (1000 * 60 * 60 * 24)
  );
  const durationMonths = Math.floor(durationDays / 30);
  const remainingDays = durationDays % 30;
  const durationText =
    durationMonths > 0
      ? `${durationMonths} month${durationMonths > 1 ? "s" : ""} ${remainingDays} days`
      : `${durationDays} days`;

  return (
    <>
      {/* Main Checkout Modal */}
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal-content checkout-modal"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="modal-header checkout-header">
            <div className="header-content">
              <div className="header-icon">
                <LogOut size={24} />
              </div>
              <div>
                <h3>Student Checkout</h3>
                <p>{student.student_name}</p>
              </div>
            </div>
            <button className="close-btn" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          <div className="modal-body">
            {/* Student Info */}
            <div className="checkout-student-info">
              <div className="info-row">
                <User size={18} />
                <div>
                  <strong>{student.student_name}</strong>
                  <span>
                    ID: {student.student_id} • D/O:{" "}
                    {student.father_name || "N/A"}
                  </span>
                </div>
              </div>
              <div className="info-row">
                <Home size={18} />
                <div>
                  <strong>Room {student.room_no}</strong>
                  <span>Bed {student.bed_no || "-"}</span>
                </div>
              </div>
              <div className="info-row">
                <Calendar size={18} />
                <div>
                  <strong>
                    Joined:{" "}
                    {joinDate.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </strong>
                  <span>Duration: {durationText}</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="checkout-error">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Checkout Details */}
            <div className="checkout-section">
              <h4>
                <MessageSquare size={18} />
                Checkout Details
              </h4>

              <div className="form-group">
                <label>
                  <Calendar size={16} />
                  Checkout Date <span className="required">*</span>
                </label>
                <DateInput
                  value={checkoutData.checkout_date}
                  onChange={(val) =>
                    setCheckoutData({
                      ...checkoutData,
                      checkout_date: val,
                    })
                  }
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>
                  <MessageSquare size={16} />
                  Reason for Leaving <span className="required">*</span>
                </label>
                <select
                  value={checkoutData.reason}
                  onChange={(e) =>
                    setCheckoutData({
                      ...checkoutData,
                      reason: e.target.value,
                    })
                  }
                  className="form-input"
                >
                  {checkoutReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Additional Remarks</label>
                <textarea
                  value={checkoutData.remarks}
                  onChange={(e) =>
                    setCheckoutData({
                      ...checkoutData,
                      remarks: e.target.value,
                    })
                  }
                  className="form-input"
                  rows="3"
                  placeholder="Any additional notes about the checkout..."
                />
              </div>
            </div>

            {/* Pending / Due Fees Section */}
            <div className="checkout-section refund-section">
              <h4>
                <AlertTriangle size={18} />
                Pending &amp; Due Fees
              </h4>

              {feeSummaryLoading ? (
                <p style={{ fontSize: 13, color: "#64748b" }}>Loading fee records...</p>
              ) : totalPendingDue > 0 ? (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <AlertTriangle size={18} style={{ color: "#dc2626" }} />
                    <strong style={{ color: "#dc2626", fontSize: "14px" }}>
                      ₹{totalPendingDue.toLocaleString("en-IN")} outstanding
                    </strong>
                  </div>
                  {pendingFeeRows.length > 0 && (
                    <div style={{ fontSize: "12px", color: "#64748b" }}>
                      {pendingFeeRows.map((f) => (
                        <div key={f.fee_id} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                          <span>
                            {f.fee_type}
                            {f.fee_month ? ` - ${new Date(f.fee_month).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}` : ""}
                            {" "}({f.fee_status})
                          </span>
                          <span style={{ color: "#dc2626" }}>₹{Number(f.remaining).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {pendingOtherTotal > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#dc2626", padding: "2px 0" }}>
                      <span>Pending fines / damages / money given</span>
                      <span>₹{pendingOtherTotal.toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #fecaca", fontSize: "12px", color: "#991b1b" }}>
                    <Info size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
                    Checking out now will write off this outstanding amount. Collect payment first if it should not be waived.
                  </div>
                </div>
              ) : (
                <div style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  marginBottom: "16px",
                  fontSize: "13px",
                  color: "#166534"
                }}>
                  <CheckCircle size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />
                  No pending or due fees for this student.
                </div>
              )}

              {feeRefund?.applicable && (
                <div style={{
                  background: "#f5f3ff",
                  border: "1px solid #ddd6fe",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
                    <div>
                      <strong style={{ color: "#6d28d9", fontSize: "14px" }}>
                        ₹{feeRefund.amount.toLocaleString("en-IN")} fee refund available
                      </strong>
                      <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                        This period is already fully paid through {new Date(feeRefund.period_end).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} -
                        {" "}{feeRefund.days_remaining} unused day{feeRefund.days_remaining > 1 ? "s" : ""} remain.
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={feeRefundApplied}
                      onClick={applyFeeRefund}
                    >
                      {feeRefundApplied ? "Added" : "Add to Refund"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Security Deposit Refund Section */}
            <div className="checkout-section refund-section">
              <h4>
                <Wallet size={18} />
                Security Deposit Refund
              </h4>

              {/* Security Balance Summary */}
              {securityInfo && (
                <div style={{
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <Shield size={18} style={{ color: "#0369a1" }} />
                    <strong style={{ color: "#0369a1", fontSize: "14px" }}>Security Deposit Balance</strong>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "13px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Original Amount:</span>
                      <strong>₹{(securityInfo.security_paid || 0).toLocaleString("en-IN")}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Total Deductions:</span>
                      <strong style={{ color: securityInfo.total_deductions > 0 ? "#dc2626" : "#333" }}>
                        ₹{(securityInfo.total_deductions || 0).toLocaleString("en-IN")}
                      </strong>
                    </div>
                  </div>
                  <div style={{
                    marginTop: "8px",
                    paddingTop: "8px",
                    borderTop: "1px solid #bae6fd",
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "15px",
                    fontWeight: "700",
                    color: "#0369a1"
                  }}>
                    <span>Available for Refund:</span>
                    <span>₹{(securityInfo.remaining_security || 0).toLocaleString("en-IN")}</span>
                  </div>
                  {securityInfo.deductions && securityInfo.deductions.length > 0 && (
                    <div style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
                      <div style={{ fontWeight: "600", marginBottom: "4px" }}>Deduction History:</div>
                      {securityInfo.deductions.map((d, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
                          <span>{d.type}: {d.description || "N/A"}</span>
                          <span style={{ color: "#dc2626" }}>-₹{Number(d.amount).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="refund-form-row">
                <div className="form-group flex-grow">
                  <label>
                    <IndianRupee size={16} />
                    Refund Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={checkoutData.refund_amount}
                    onChange={(e) =>
                      setCheckoutData({
                        ...checkoutData,
                        refund_amount: e.target.value,
                      })
                    }
                    className="form-input refund-input"
                    min="0"
                    max={securityInfo?.remaining_security || undefined}
                    step="1"
                    placeholder="Enter amount (0 if no refund)"
                  />
                  <span className="input-hint">
                    Enter the security deposit amount to refund. Leave empty or
                    0 if no refund.
                  </span>
                </div>

                <div className="form-group">
                  <label>Payment Mode</label>
                  <select
                    value={checkoutData.payment_mode}
                    onChange={(e) =>
                      setCheckoutData({
                        ...checkoutData,
                        payment_mode: e.target.value,
                      })
                    }
                    className="form-input"
                  >
                    {paymentModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Refund Preview */}
              {refundAmount > 0 && (
                <div className="refund-preview">
                  <div className="preview-header">
                    <IndianRupee size={18} />
                    <span>Refund Summary</span>
                  </div>
                  <div className="preview-content">
                    <div className="preview-row">
                      <span>Refund Amount</span>
                      <span className="amount">
                        ₹{refundAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="preview-row">
                      <span>Payment Mode</span>
                      <span>{checkoutData.payment_mode}</span>
                    </div>
                    <div className="preview-row ledger-entry">
                      <span>Ledger Entry</span>
                      <span className="entry-type">Expense (Debit)</span>
                    </div>
                  </div>
                  <div className="preview-description">
                    <Info size={14} />
                    <span>
                      Description: Security deposit refunded to{" "}
                      <strong>{student.student_name}</strong> D/O{" "}
                      <strong>{student.father_name || "N/A"}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Warning */}
            <div className="checkout-warning">
              <AlertTriangle size={20} />
              <div>
                <strong>Important:</strong> This action will permanently mark
                the student as exited, end the room allocation, and close all
                pending fee records.
                {refundAmount > 0 && (
                  <strong>
                    {" "}
                    A ledger entry of ₹
                    {refundAmount.toLocaleString("en-IN")} will be created for
                    the security deposit refund.
                  </strong>
                )}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <Button variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleCheckout}
              disabled={loading}
            >
              <LogOut size={16} />
              {loading ? "Processing..." : "Confirm Checkout"}
            </Button>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showConfirmModal && (
        <div
          className="confirm-overlay"
          onClick={handleCancelConfirm}
        >
          <div
            className="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-icon-wrapper">
              <ShieldAlert size={48} />
            </div>

            <h3 className="confirm-title">Confirm Checkout</h3>

            <p className="confirm-text">
              Are you sure you want to checkout{" "}
              <strong>{student.student_name}</strong>?
            </p>

            <div className="confirm-details">
              <div className="confirm-detail-item">
                <span className="confirm-label">Student</span>
                <span className="confirm-value">
                  {student.student_name}
                </span>
              </div>
              <div className="confirm-detail-item">
                <span className="confirm-label">Student ID</span>
                <span className="confirm-value">
                  {student.student_id}
                </span>
              </div>
              <div className="confirm-detail-item">
                <span className="confirm-label">Room</span>
                <span className="confirm-value">
                  {student.room_no} (Bed {student.bed_no || "-"})
                </span>
              </div>
              <div className="confirm-detail-item">
                <span className="confirm-label">Checkout Date</span>
                <span className="confirm-value">
                  {new Date(checkoutData.checkout_date).toLocaleDateString(
                    "en-IN",
                    { day: "2-digit", month: "short", year: "numeric" }
                  )}
                </span>
              </div>
              <div className="confirm-detail-item">
                <span className="confirm-label">Reason</span>
                <span className="confirm-value">{checkoutData.reason}</span>
              </div>
              {refundAmount > 0 && (
                <div className="confirm-detail-item confirm-refund-highlight">
                  <span className="confirm-label">Refund</span>
                  <span className="confirm-value confirm-refund-amount">
                    ₹{refundAmount.toLocaleString("en-IN")} via{" "}
                    {checkoutData.payment_mode}
                  </span>
                </div>
              )}
            </div>

            <div className="confirm-impact">
              <AlertTriangle size={16} />
              <span>This will end room allocation, mark student as exited, and close all pending fee records. This action cannot be undone.</span>
            </div>

            <div className="confirm-buttons">
              <button
                className="confirm-btn-no"
                onClick={handleCancelConfirm}
              >
                No, Go Back
              </button>
              <button
                className="confirm-btn-yes"
                onClick={handleConfirmProceed}
              >
                <LogOut size={16} />
                Yes, Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Success Modal */}
      {successModal.show && (
        <div
          className="success-overlay"
          onClick={handleSuccessClose}
        >
          <div
            className="success-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="success-icon-wrapper">
              <CheckCircle size={52} />
            </div>

            <h3 className="success-title">Checkout Successful!</h3>

            <p className="success-text">
              <strong>{student.student_name}</strong> has been checked out
              successfully.
            </p>

            <div className="success-summary">
              <div className="success-summary-item">
                <span>Student ID</span>
                <span>{student.student_id}</span>
              </div>
              <div className="success-summary-item">
                <span>Room Released</span>
                <span>
                  Room {student.room_no} - Bed {student.bed_no || "-"}
                </span>
              </div>
              <div className="success-summary-item">
                <span>Checkout Date</span>
                <span>
                  {new Date(checkoutData.checkout_date).toLocaleDateString(
                    "en-IN",
                    { day: "2-digit", month: "short", year: "numeric" }
                  )}
                </span>
              </div>
              {successModal.refund_amount > 0 && (
                <div className="success-summary-item success-refund-row">
                  <span>Refund Processed</span>
                  <span className="success-refund-value">
                    ₹{successModal.refund_amount.toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>

            {successModal.refund_amount > 0 && (
              <div className="success-ledger-note">
                📝 Ledger entry created for security deposit refund of ₹
                {successModal.refund_amount.toLocaleString("en-IN")}.
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '16px' }}>
              {successModal.refund_amount > 0 && (
                <button
                  className="success-done-btn"
                  style={{ background: '#2563eb' }}
                  onClick={() => setShowRefundReceipt(true)}
                >
                  🧾 Print Refund Receipt
                </button>
              )}
              <button
                className="success-done-btn"
                onClick={handleSuccessClose}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Receipt Modal */}
      {showRefundReceipt && (
        <RefundReceiptModal
          open={showRefundReceipt}
          onClose={() => setShowRefundReceipt(false)}
          student={student}
          refundAmount={successModal.refund_amount}
          paymentMode={checkoutData.payment_mode}
          checkoutDate={checkoutData.checkout_date}
        />
      )}
    </>
  );
};

export default CheckoutStudent;