import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { feeAPI } from "../../services/api/fee.api";
import { getFileUrl } from "../../utils/imageSrc";
import {
  ArrowLeft, User, IndianRupee, CheckCircle, AlertCircle, Clock,
  Loader2, Receipt, AlertTriangle, PiggyBank, Home, FileText,
  Calendar, CreditCard, Phone, ChevronDown, ChevronUp, Eye,
  Printer, Download, X
} from "lucide-react";
import FeeInvoiceModal from "../../components/fees/FeeInvoiceModal";
import "./FeeDetails.css";

const FeeDetails = () => {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [expandedFees, setExpandedFees] = useState({});
  const [activeTab, setActiveTab] = useState("fees"); // 'fees' or 'transactions'

  useEffect(() => {
    loadData();
  }, [studentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await feeAPI.getStudentFeeDetails(studentId);
      console.log("📦 Fee details response:", res.data);
      setData(res.data.data);

      // Auto-expand first unpaid fee
      if (res.data.data?.fees) {
        const unpaidFee = res.data.data.fees.find(f => f.fee_status !== 'PAID');
        if (unpaidFee) {
          setExpandedFees({ [unpaidFee.fee_id]: true });
        }
      }
    } catch (err) {
      console.error("Failed to load fee details", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amt) => `₹${(amt || 0).toLocaleString("en-IN")}`;

  const formatDate = (d) => {
    if (!d) return "N/A";
    return new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  const formatMonth = (d, feeType = 'Monthly Rent') => {
    if (!d) return "N/A";
    const date = new Date(d);
    const start = date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    
    if (feeType === 'Half-Yearly Rent') {
      const endDate = new Date(date);
      endDate.setMonth(date.getMonth() + 5);
      const end = endDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      return `${start.split(' ')[0]} - ${end}`;
    }
    
    if (feeType === 'Yearly Rent') {
      const endDate = new Date(date);
      endDate.setMonth(date.getMonth() + 11);
      const end = endDate.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
      return `${start.split(' ')[0]} - ${end}`;
    }

    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  };

  const formatTime = (d) => {
    if (!d) return "";
    return new Date(d).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusConfig = (status) => {
    const configs = {
      PAID: { color: "green", icon: CheckCircle, label: "Paid" },
      PARTIAL: { color: "purple", icon: Clock, label: "Partial" },
      OVERDUE: { color: "red", icon: AlertTriangle, label: "Overdue" },
      DUE: { color: "orange", icon: Clock, label: "Due" }
    };
    return configs[status] || { color: "gray", icon: AlertCircle, label: status };
  };

  const toNum = (v) => Number(v) || 0;

  const toggleFeeExpand = (feeId) => {
    setExpandedFees(prev => ({
      ...prev,
      [feeId]: !prev[feeId]
    }));
  };

  const openInvoice = (payment, fee = null) => {
    let breakdown = null;

    // First try to use the backend-provided breakdown JSON
    try {
      let parsed = payment.breakdown;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        breakdown = parsed;
      }
    } catch (e) {
      console.error("Failed to parse payment breakdown:", e);
    }

    if (!breakdown) {
      // Detect "Pay All" payments - these cover multiple fees
      const isPayAll = payment.notes === 'Pay All Fees' ||
        (fee && toNum(payment.payment_amount) > toNum(fee.total_due || fee.final_amount) + 1);

      if (isPayAll && data?.fees) {
        // For Pay-All payments: build breakdown from ALL fees
        let monthlyFee = 0, secDep = 0, penalty = 0, fine = 0, prevDues = 0, propDamage = 0, moneyGiven = 0;
        data.fees.forEach(f => {
          const rentTypes = ['Monthly Rent', 'Half-Yearly Rent', 'Yearly Rent'];
          if (rentTypes.includes(f.fee_type)) monthlyFee += toNum(f.final_amount);
          else if (f.fee_type === 'Security Deposit') secDep += toNum(f.final_amount);
          penalty += toNum(f.penalty_amount);
          fine += toNum(f.fine_amount);
          prevDues += toNum(f.previous_dues);
          propDamage += toNum(f.property_damage_amount);
          moneyGiven += toNum(f.money_given_amount);
        });
        breakdown = { monthlyFee, securityDue: secDep, penalty, fine, previousDues: prevDues, propertyDamage: propDamage, moneyGiven, advance: 0 };
      } else if (fee) {
        // For single-fee payments
        breakdown = {
          monthlyFee: ['Monthly Rent', 'Half-Yearly Rent', 'Yearly Rent'].includes(fee.fee_type) ? toNum(fee.final_amount) : 0,
          securityDue: fee.fee_type === 'Security Deposit' ? toNum(fee.final_amount) : 0,
          penalty: toNum(fee.penalty_amount),
          fine: toNum(fee.fine_amount),
          previousDues: toNum(fee.previous_dues),
          propertyDamage: toNum(fee.property_damage_amount),
          moneyGiven: toNum(fee.money_given_amount),
          advance: 0
        };
      } else if (data?.fees) {
        let monthlyFee = 0, secDep = 0, penalty = 0, fine = 0, prevDues = 0, propDamage = 0, moneyGiven = 0;
        data.fees.forEach(f => {
          const rentTypes = ['Monthly Rent', 'Half-Yearly Rent', 'Yearly Rent'];
          if (rentTypes.includes(f.fee_type)) monthlyFee += toNum(f.final_amount);
          else if (f.fee_type === 'Security Deposit') secDep += toNum(f.final_amount);
          penalty += toNum(f.penalty_amount);
          fine += toNum(f.fine_amount);
          prevDues += toNum(f.previous_dues);
          propDamage += toNum(f.property_damage_amount);
          moneyGiven += toNum(f.money_given_amount);
        });
        breakdown = { monthlyFee, securityDue: secDep, penalty, fine, previousDues: prevDues, propertyDamage: propDamage, moneyGiven, advance: 0 };
      }
    }

    // Check if the breakdown total closely matches the payment
    if (breakdown && !Array.isArray(breakdown)) {
      const breakdownTotal = Object.values(breakdown).reduce((acc, val) => acc + (toNum(val) || 0), 0);
      // If it's a partial payment, don't show the full itemized breakdown to avoid confusing the user
      // with a breakdown that totals much more than what they paid.
      if (Math.abs(breakdownTotal - toNum(payment.payment_amount)) > 10) {
        breakdown = null;
      }
    }

    setSelectedPayment({
      ...payment,
      fee_info: fee,
      _breakdown: breakdown
    });
    setShowInvoice(true);
  };

  // Get payments for a specific fee
  const getPaymentsForFee = (feeId) => {
    if (!data?.payments) return [];
    return data.payments.filter(p => p.fee_id === feeId);
  };

  // Get all payments sorted by date
  const getAllPaymentsSorted = () => {
    if (!data?.payments) return [];
    return [...data.payments].sort((a, b) =>
      new Date(b.payment_date) - new Date(a.payment_date)
    );
  };

  if (loading) {
    return (
      <div className="fd-page">
        <div className="fd-loading">
          <Loader2 size={48} className="fd-spin" />
          <h3>Loading Fee Details...</h3>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="fd-page">
        <div className="fd-empty">
          <AlertCircle size={48} />
          <h3>Student Not Found</h3>
          <button onClick={() => navigate(-1)}>
            <ArrowLeft size={18} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const student = data.student || {};
  const fees = data.fees || [];
  const payments = data.payments || [];
  const summary = data.summary || {
    total_due: 0,
    total_paid: 0,
    total_remaining: 0,
    advance_balance: 0,
    pending_fines: 0,
    pending_damages: 0
  };

  const allTransactions = getAllPaymentsSorted();

  return (
    <div className="fd-page">
      {/* Header */}
      <div className="fd-header">
        <button className="fd-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </button>
        <div className="fd-header-content">
          <h1>Fee Details</h1>
          <p>Complete fee history and transactions</p>
        </div>
      </div>

      {/* Student Info Card */}
      <div className="fd-student-card">
        <div className="fd-avatar" style={{ overflow: 'hidden' }}>
          {student.photo_url ? (
            <img src={getFileUrl(student.photo_url)} alt={student.student_name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
          ) : (
            <User size={32} />
          )}
        </div>
        <div className="fd-student-info">
          <h2>{student.student_name || "Unknown"}</h2>
          <p className="fd-father-name">S/O {student.father_name || "N/A"}</p>
          <div className="fd-student-meta">
            <span className="fd-meta-item">
              <Home size={14} />
              Room {student.room_no || "N/A"} {student.bed_no ? `• Bed ${student.bed_no}` : ""}
            </span>
            <span className="fd-meta-item">
              <Phone size={14} />
              {student.student_mobile || student.father_mobile || "N/A"}
            </span>
            <span className="fd-meta-item">
              <Calendar size={14} />
              Joined: {formatDate(student.date_of_joining)}
            </span>
          </div>
        </div>
        <div className="fd-student-id">
          <span>ID</span>
          <strong>#{student.student_id || studentId}</strong>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="fd-summary">
        <div className="fd-summary-card">
          <div className="fd-summary-icon">
            <IndianRupee size={24} />
          </div>
          <div className="fd-summary-content">
            <span className="fd-summary-label">Total Fees</span>
            <strong className="fd-summary-value">{formatCurrency(summary.total_due)}</strong>
          </div>
        </div>

        <div className="fd-summary-card fd-card-green">
          <div className="fd-summary-icon">
            <CheckCircle size={24} />
          </div>
          <div className="fd-summary-content">
            <span className="fd-summary-label">Total Paid</span>
            <strong className="fd-summary-value">{formatCurrency(summary.total_paid)}</strong>
          </div>
        </div>

        <div className="fd-summary-card fd-card-orange">
          <div className="fd-summary-icon">
            <Clock size={24} />
          </div>
          <div className="fd-summary-content">
            <span className="fd-summary-label">Remaining</span>
            <strong className="fd-summary-value">{formatCurrency(summary.total_remaining)}</strong>
          </div>
        </div>

        {(summary.advance_balance || 0) > 0 && (
          <div className="fd-summary-card fd-card-purple">
            <div className="fd-summary-icon">
              <PiggyBank size={24} />
            </div>
            <div className="fd-summary-content">
              <span className="fd-summary-label">Advance Balance</span>
              <strong className="fd-summary-value">{formatCurrency(summary.advance_balance)}</strong>
            </div>
          </div>
        )}

        {(summary.pending_fines || 0) > 0 && (
          <div className="fd-summary-card fd-card-red">
            <div className="fd-summary-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="fd-summary-content">
              <span className="fd-summary-label">Pending Fines</span>
              <strong className="fd-summary-value">{formatCurrency(summary.pending_fines)}</strong>
            </div>
          </div>
        )}

        {(summary.pending_damages || 0) > 0 && (
          <div className="fd-summary-card fd-card-orange">
            <div className="fd-summary-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="fd-summary-content">
              <span className="fd-summary-label">Pending Damages</span>
              <strong className="fd-summary-value">{formatCurrency(summary.pending_damages)}</strong>
            </div>
          </div>
        )}

        {(summary.pending_money_given || 0) > 0 && (
          <div className="fd-summary-card fd-card-orange">
            <div className="fd-summary-icon">
              <Clock size={24} />
            </div>
            <div className="fd-summary-content">
              <span className="fd-summary-label">Money Given</span>
              <strong className="fd-summary-value">{formatCurrency(summary.pending_money_given)}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="fd-tabs">
        <button
          className={`fd-tab ${activeTab === 'fees' ? 'active' : ''}`}
          onClick={() => setActiveTab('fees')}
        >
          <Receipt size={18} />
          Fee History
          <span className="fd-tab-count">{fees.length}</span>
        </button>
        <button
          className={`fd-tab ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <FileText size={18} />
          All Transactions
          <span className="fd-tab-count">{allTransactions.length}</span>
        </button>
      </div>

      {/* Content */}
      <div className="fd-content">
        {/* Fee History Tab */}
        {activeTab === 'fees' && (
          <div className="fd-fees-section">
            {fees.length === 0 ? (
              <div className="fd-empty-state">
                <Receipt size={48} />
                <h4>No Fee Records</h4>
                <p>No fees have been generated for this student yet.</p>
              </div>
            ) : (
              <div className="fd-fees-list">
                {fees.map(fee => {
                  const statusConfig = getStatusConfig(fee.fee_status);
                  const StatusIcon = statusConfig.icon;
                  const feePayments = getPaymentsForFee(fee.fee_id);
                  const isExpanded = expandedFees[fee.fee_id];

                  return (
                    <div key={fee.fee_id} className={`fd-fee-card fd-fee-${statusConfig.color}`}>
                      {/* Fee Header */}
                      <div
                        className="fd-fee-header"
                        onClick={() => toggleFeeExpand(fee.fee_id)}
                      >
                        <div className="fd-fee-left">
                          <div className="fd-fee-month-badge">
                            {formatMonth(fee.fee_month, fee.fee_type)}
                          </div>
                          <div className="fd-fee-type-section">
                            <div className="fd-fee-type">{fee.fee_type}</div>
                            {(toNum(fee.fine_amount) > 0 || toNum(fee.penalty_amount) > 0 || toNum(fee.property_damage_amount) > 0 || toNum(fee.money_given_amount) > 0) && (
                              <div className="fd-fee-extras" style={{ display: 'flex', gap: '8px', fontSize: '0.75rem', marginTop: '4px', opacity: 0.9 }}>
                                {toNum(fee.fine_amount) > 0 && <span style={{ color: '#dc2626' }}>Fine: {formatCurrency(fee.fine_amount)}</span>}
                                {toNum(fee.penalty_amount) > 0 && <span style={{ color: '#dc2626' }}>Penalty: {formatCurrency(fee.penalty_amount)}</span>}
                                {toNum(fee.property_damage_amount) > 0 && <span style={{ color: '#d97706' }}>Damage: {formatCurrency(fee.property_damage_amount)}</span>}
                                {toNum(fee.money_given_amount) > 0 && <span style={{ color: '#d97706' }}>Given: {formatCurrency(fee.money_given_amount)}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="fd-fee-right">
                          <div className={`fd-fee-status fd-status-${statusConfig.color}`}>
                            <StatusIcon size={14} />
                            {statusConfig.label}
                          </div>
                          <div className="fd-fee-amount">
                            {formatCurrency(fee.final_amount)}
                          </div>
                          <button className="fd-expand-btn">
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </div>
                      </div>

                      {/* Fee Details (Expanded) */}
                      {isExpanded && (
                        <div className="fd-fee-body">
                          {/* Fee Breakdown */}
                          <div className="fd-fee-breakdown">
                            <h5>Fee Breakdown</h5>
                            <div className="fd-breakdown-grid">
                              <div className="fd-breakdown-row">
                                <span>Base Amount</span>
                                <span>{formatCurrency(fee.fee_amount)}</span>
                              </div>

                              {(fee.discount_amount || 0) > 0 && (
                                <div className="fd-breakdown-row fd-text-green">
                                  <span>Discount</span>
                                  <span>-{formatCurrency(fee.discount_amount)}</span>
                                </div>
                              )}

                              <div className="fd-breakdown-row fd-breakdown-subtotal">
                                <span>Final Amount</span>
                                <span>{formatCurrency(fee.final_amount)}</span>
                              </div>

                              {(fee.previous_dues || 0) > 0 && (
                                <div className="fd-breakdown-row fd-text-orange">
                                  <span>Previous Dues</span>
                                  <span>+{formatCurrency(fee.previous_dues)}</span>
                                </div>
                              )}

                              <div className="fd-breakdown-row fd-text-red">
                                <span>Penalty</span>
                                <span>+{formatCurrency(fee.penalty_amount || 0)}</span>
                              </div>

                              <div className="fd-breakdown-row fd-text-red">
                                <span>Fine</span>
                                <span>+{formatCurrency(fee.fine_amount || 0)}</span>
                              </div>

                              <div className="fd-breakdown-row fd-text-orange">
                                <span>Property Damage</span>
                                <span>+{formatCurrency(fee.property_damage_amount || 0)}</span>
                              </div>

                              <div className="fd-breakdown-row fd-text-orange">
                                <span>Money Given</span>
                                <span>+{formatCurrency(fee.money_given_amount || 0)}</span>
                              </div>

                              <div className="fd-breakdown-divider"></div>

                              <div className="fd-breakdown-row fd-breakdown-total">
                                <span>Total Due</span>
                                <strong>{formatCurrency(fee.total_due)}</strong>
                              </div>

                              <div className="fd-breakdown-row fd-text-green">
                                <span>Paid Amount</span>
                                <span>{formatCurrency(fee.paid_amount)}</span>
                              </div>

                              <div className="fd-breakdown-row fd-breakdown-remaining">
                                <span>Remaining</span>
                                <strong className={(fee.remaining || 0) > 0 ? "fd-text-red" : "fd-text-green"}>
                                  {formatCurrency(fee.remaining)}
                                </strong>
                              </div>
                            </div>

                            <div className="fd-fee-dates">
                              <span><Calendar size={12} /> Due: {formatDate(fee.due_date)}</span>
                              {fee.invoice_number && (
                                <span><FileText size={12} /> Invoice: {fee.invoice_number}</span>
                              )}
                            </div>
                          </div>

                          {/* Payments for this Fee */}
                          <div className="fd-fee-payments">
                            <h5>
                              <CreditCard size={16} />
                              Payments ({feePayments.length})
                            </h5>

                            {feePayments.length === 0 ? (
                              <div className="fd-no-payments" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <AlertCircle size={16} />
                                  <span>No payments received yet</span>
                                </div>
                                {statusConfig.label !== "Paid" && (
                                  <button
                                    style={{
                                      background: '#3b82f6', color: 'white', border: 'none', padding: '6px 14px',
                                      borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate('/fees', { 
                                        state: { 
                                          autoPay: true, 
                                          studentId: student.student_id, 
                                          feeType: fee.fee_type,
                                          feeId: fee.fee_id,
                                          amountToPay: fee.remaining
                                        } 
                                      });
                                    }}
                                  >
                                    <CreditCard size={14} /> Receive Fee
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="fd-payments-list">
                                {feePayments.map((payment, index) => (
                                  <div key={payment.payment_id} className="fd-payment-item">
                                    <div className="fd-payment-number">
                                      #{index + 1}
                                    </div>
                                    <div className="fd-payment-details">
                                      <div className="fd-payment-main">
                                        <strong className="fd-payment-amount">
                                          {formatCurrency(payment.payment_amount)}
                                        </strong>
                                        <span className="fd-payment-mode">
                                          {payment.payment_mode}
                                        </span>
                                      </div>
                                      <div className="fd-payment-meta">
                                        <span>{formatDate(payment.payment_date)}</span>
                                        {payment.reference_no && (
                                          <span>Ref: {payment.reference_no}</span>
                                        )}
                                        {payment.received_by && (
                                          <span>By: {payment.received_by}</span>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      className="fd-view-invoice-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openInvoice(payment, fee);
                                      }}
                                    >
                                      <Eye size={14} />
                                      View Invoice
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* All Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="fd-transactions-section">
            {allTransactions.length === 0 ? (
              <div className="fd-empty-state">
                <CreditCard size={48} />
                <h4>No Transactions</h4>
                <p>No payment transactions found for this student.</p>
              </div>
            ) : (
              <div className="fd-transactions-list">
                <div className="fd-transactions-header">
                  <span className="fd-th-date">Date</span>
                  <span className="fd-th-invoice">Invoice</span>
                  <span className="fd-th-amount">Amount</span>
                  <span className="fd-th-mode">Mode</span>
                  <span className="fd-th-received">Received By</span>
                  <span className="fd-th-action">Action</span>
                </div>

                {allTransactions.map((payment, index) => {
                  // Find the fee this payment belongs to
                  const relatedFee = fees.find(f => f.fee_id === payment.fee_id);

                  return (
                    <div key={payment.payment_id} className="fd-transaction-row">
                      <div className="fd-tx-date">
                        <span className="fd-tx-date-main">{formatDate(payment.payment_date)}</span>
                        <span className="fd-tx-date-time">{formatTime(payment.created_at)}</span>
                      </div>

                      <div className="fd-tx-invoice">
                        <span className="fd-tx-invoice-number">
                          {payment.invoice_number || `TXN-${payment.payment_id}`}
                        </span>
                        {relatedFee && (
                          <span className="fd-tx-fee-type">
                            {relatedFee.fee_type} • {formatMonth(relatedFee.fee_month, relatedFee.fee_type)}
                          </span>
                        )}
                      </div>

                      <div className="fd-tx-amount">
                        <strong>{formatCurrency(payment.payment_amount)}</strong>
                      </div>

                      <div className="fd-tx-mode">
                        <span className={`fd-mode-badge fd-mode-${payment.payment_mode?.toLowerCase()}`}>
                          {payment.payment_mode}
                        </span>
                        {payment.reference_no && (
                          <span className="fd-tx-ref">Ref: {payment.reference_no}</span>
                        )}
                      </div>

                      <div className="fd-tx-received">
                        {payment.received_by || 'ADMIN'}
                      </div>

                      <div className="fd-tx-action">
                        <button
                          className="fd-invoice-btn"
                          onClick={() => openInvoice(payment, relatedFee)}
                          title="View Invoice"
                        >
                          <Eye size={16} />
                          <span>Invoice</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Transaction Summary */}
            {allTransactions.length > 0 && (
              <div className="fd-transactions-summary">
                <div className="fd-tx-summary-item">
                  <span>Total Transactions</span>
                  <strong>{allTransactions.length}</strong>
                </div>
                <div className="fd-tx-summary-item">
                  <span>Total Amount Paid</span>
                  <strong className="fd-text-green">
                    {formatCurrency(allTransactions.reduce((sum, p) => sum + (p.payment_amount || 0), 0))}
                  </strong>
                </div>
                <div className="fd-tx-summary-item">
                  <span>Cash Payments</span>
                  <strong>
                    {formatCurrency(allTransactions.filter(p => p.payment_mode === 'CASH').reduce((sum, p) => sum + (p.payment_amount || 0), 0))}
                  </strong>
                </div>
                <div className="fd-tx-summary-item">
                  <span>Online Payments</span>
                  <strong>
                    {formatCurrency(allTransactions.filter(p => ['UPI', 'BANK', 'ONLINE'].includes(p.payment_mode)).reduce((sum, p) => sum + (p.payment_amount || 0), 0))}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Modal */}
      {showInvoice && selectedPayment && (
        <FeeInvoiceModal
          open={showInvoice}
          onClose={() => setShowInvoice(false)}
          payment={selectedPayment}
          student={student}
          fee={selectedPayment.fee_info}
          breakdown={selectedPayment._breakdown}
        />
      )}
    </div>
  );
};

export default FeeDetails;