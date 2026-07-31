import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { memberAPI } from "../../services/api/member.api";
import SalaryReceipt from "./SalaryReceipt";
import SalaryPayment from "./SalaryPayment";
import MemberForm from "./MemberForm";
import ConfirmModal from "../../components/modals/ConfirmModal";
import { getFileUrl } from "../../utils/imageSrc";
import "./member.css";

const Icons = {
  close: "✕",
  edit: "✏️",
  delete: "🗑️",
  money: "💰",
  phone: "📱",
  calendar: "📅",
  father: "👨",
  id: "🪪",
  print: "🖨️",
  user: "👤",
  back: "←"
};

const ID_TYPE_LABELS = {
  aadhar: "Aadhar Card",
  pan: "PAN Card",
  passport: "Passport",
  driving_license: "Driving License",
  voter_id: "Voter ID",
  other: "Other"
};

const MemberDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [activeTab, setActiveTab] = useState("info");
  const [transactions, setTransactions] = useState([]);
  const [salaryHistory, setSalaryHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceipt, setShowReceipt] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [toast, setToast] = useState(null);
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);

  const [salaryDeleteConfirm, setSalaryDeleteConfirm] = useState({
    isOpen: false,
    paymentId: null
  });
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false });

  useEffect(() => {
    loadMember();
  }, [id]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const loadMember = async () => {
    try {
      setLoading(true);
      const res = await memberAPI.getAll();
      const allMembers = res.data.data || [];
      const found = allMembers.find(m => m.member_id === Number(id));
      if (found) {
        setMember(found);
        await loadData(found.member_id);
      }
    } catch {
      showToast("Failed to load member", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async (memberId) => {
    try {
      const [txRes, sumRes, salaryRes] = await Promise.all([
        memberAPI.getTransactions(memberId),
        memberAPI.getSummary(memberId),
        memberAPI.getSalaryHistory(memberId)
      ]);
      setTransactions(txRes.data.data || []);
      setSummary(sumRes.data.data || {});
      setSalaryHistory(salaryRes.data.data || []);
    } catch {
      showToast("Failed to load member details", "error");
    }
  };

  const handleViewReceipt = (payment) => {
    setSelectedPayment(payment);
    setShowReceipt(true);
  };

  const handleDeleteSalary = (paymentId) => {
    setSalaryDeleteConfirm({ isOpen: true, paymentId });
  };

  const executeDeleteSalary = async () => {
    try {
      await memberAPI.deleteSalaryPayment(salaryDeleteConfirm.paymentId);
      showToast("Salary payment deleted");
      setSalaryDeleteConfirm({ isOpen: false, paymentId: null });
      if (member) await loadData(member.member_id);
    } catch {
      showToast("Failed to delete salary payment", "error");
    }
  };

  const handleDeleteMember = async () => {
    try {
      await memberAPI.deactivate(member.member_id);
      showToast("Member deleted successfully");
      navigate("/members");
    } catch {
      showToast("Failed to delete member", "error");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR', minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || "??";
  };

  if (showReceipt && selectedPayment && member) {
    return (
      <SalaryReceipt
        payment={selectedPayment}
        member={member}
        onClose={() => setShowReceipt(false)}
      />
    );
  }

  if (loading) {
    return (
      <div className="member-page">
        <div className="empty-state">
          <div className="empty-state-icon">Loading...</div>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="member-page">
        <div className="empty-state">
          <div className="empty-state-icon">{Icons.user}</div>
          <h3>Member not found</h3>
          <button className="btn btn-primary" onClick={() => navigate("/members")}>
            {Icons.back} Back to Members
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="member-page">
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="toast-icon">{toast.type === "success" ? "✓" : "✕"}</span>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={salaryDeleteConfirm.isOpen}
        title="Delete Salary Payment"
        message="Are you sure you want to delete this salary payment? This action cannot be undone."
        onConfirm={executeDeleteSalary}
        onCancel={() => setSalaryDeleteConfirm({ isOpen: false, paymentId: null })}
        type="danger"
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Member"
        message={`Are you sure you want to delete "${member.name}"? This action cannot be undone.`}
        onConfirm={handleDeleteMember}
        onCancel={() => setDeleteConfirm({ isOpen: false })}
        type="danger"
      />

      {/* Page Header */}
      <div className="member-header">
        <div className="member-header-left">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate("/members")} style={{ marginRight: 12 }}>
            {Icons.back} Back
          </button>
          <div>
            <h2>{member.name}</h2>
            <p>{Icons.phone} {member.mobile || 'No mobile'} | ID: {member.member_id}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFormModal(true)}>{Icons.edit} Edit</button>
          <button className="btn btn-success btn-sm" onClick={() => setShowSalaryModal(true)}>{Icons.money} Pay Salary</button>
          <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm({ isOpen: true })}>{Icons.delete} Delete</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="member-stats">
        <div className="stat-card paid">
          <div className="stat-value">{formatCurrency((summary?.total_fee_collected || 0) + (summary?.total_manual_paid || 0))}</div>
          <div className="stat-label">Total Salary Paid</div>
        </div>
        <div className="stat-card salary">
          <div className="stat-value">{formatCurrency(member.salary || 0)}</div>
          <div className="stat-label">Monthly Salary</div>
        </div>
        <div className="stat-card total">
          <div className="stat-value">{summary?.salary_payment_count || 0}</div>
          <div className="stat-label">Salary Payments</div>
        </div>
        <div className="stat-card" style={{ borderTop: '3px solid #f59e0b' }}>
          <div className="stat-value" style={{ color: summary?.remaining_this_month > 0 ? '#d97706' : '#16a34a' }}>
            {formatCurrency(summary?.remaining_this_month)}
          </div>
          <div className="stat-label">Remaining This Month</div>
        </div>
        {summary?.total_remaining_salary > 0 && (
          <div className="stat-card" style={{ borderTop: '3px solid #ef4444' }}>
            <div className="stat-value" style={{ color: '#dc2626' }}>
              {formatCurrency(summary?.total_remaining_salary)}
            </div>
            <div className="stat-label">Total Salary Pending</div>
          </div>
        )}
        {summary?.advance_paid > 0 && (
          <div className="stat-card" style={{ borderTop: '3px solid #7c3aed' }}>
            <div className="stat-value" style={{ color: '#7c3aed' }}>
              {formatCurrency(summary?.advance_paid)}
            </div>
            <div className="stat-label">Advance Given</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="member-toolbar" style={{ marginBottom: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`btn btn-sm ${activeTab === 'info' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('info')}
          >{Icons.user} Info</button>
          <button
            className={`btn btn-sm ${activeTab === 'salary' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('salary')}
          >{Icons.money} Manual Salary Payments</button>
          <button
            className={`btn btn-sm ${activeTab === 'transactions' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('transactions')}
          >Fees Collected</button>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ marginTop: 16 }}>
        {activeTab === "info" && (
          <div className="member-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            <div className="member-card">
              <div className="member-info">
                <div className="member-detail"><span className="icon">{Icons.user}</span><strong>Full Name:</strong> {member.name || 'N/A'}</div>
                <div className="member-detail"><span className="icon">{Icons.father}</span><strong>Father:</strong> {member.father_name || 'N/A'}</div>
                <div className="member-detail"><span className="icon">{Icons.phone}</span><strong>Mobile:</strong> {member.mobile || 'N/A'}</div>
                <div className="member-detail"><span className="icon">{Icons.calendar}</span><strong>DOB:</strong> {member.dob ? `${formatDate(member.dob)} (${calculateAge(member.dob)} yrs)` : 'N/A'}</div>
                <div className="member-detail"><span className="icon">{Icons.calendar}</span><strong>Joined:</strong> {member.date_of_joining ? formatDate(member.date_of_joining) : 'N/A'}</div>
                <div className="member-detail"><span className="icon">{Icons.id}</span><strong>{ID_TYPE_LABELS[member.id_type] || 'ID'}:</strong> {member.id_number || 'N/A'}</div>
                <div className="member-detail"><span className="icon">🏠</span><strong>Address:</strong> {member.address || 'N/A'}</div>
                <div className="member-detail"><span className="icon">{Icons.money}</span><strong>Last Salary:</strong> {summary?.last_salary_payment ? formatDate(summary.last_salary_payment) : 'Never'}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "salary" && (
          <div>
            {salaryHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">{Icons.money}</div>
                <h3>No salary payments</h3>
                <p>Click "Pay Salary" to make the first payment</p>
              </div>
            ) : (
              <div className="table-container" style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Month/Year</th>
                      <th>Amount</th>
                      <th>Date</th>
                      <th>Mode</th>
                      <th>Receipt</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryHistory.map(payment => (
                      <tr key={payment.payment_id}>
                        <td><strong>{payment.payment_month} {payment.payment_year}</strong></td>
                        <td className="amount">{formatCurrency(payment.amount)}</td>
                        <td>{formatDate(payment.payment_date)}</td>
                        <td>{payment.payment_mode}</td>
                        <td><code>{payment.receipt_number}</code></td>
                        <td>
                          <div className="table-actions">
                            <button className="btn btn-sm btn-primary" onClick={() => handleViewReceipt(payment)}>
                              {Icons.print}
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSalary(payment.payment_id)}>
                              {Icons.delete}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === "transactions" && (
          <div>
            {transactions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <h3>No fee collections</h3>
                <p>This member hasn't collected any fees yet</p>
              </div>
            ) : (
              <div className="table-container" style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Student</th>
                      <th>Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx.id}>
                        <td>{formatDate(tx.created_at)}</td>
                        <td className="amount">{formatCurrency(tx.amount)}</td>
                        <td>
                          <div className="student-info">
                            <span className="student-name">{tx.student_name}</span>
                            {tx.father_name && <span className="student-parent">S/O {tx.father_name}</span>}
                          </div>
                        </td>
                        <td>{tx.reference_no || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {showSalaryModal && member && (
        <SalaryPayment
          member={member}
          onClose={() => setShowSalaryModal(false)}
          onSuccess={() => {
            setShowSalaryModal(false);
            loadMember();
            showToast("Salary paid successfully");
          }}
          showToast={showToast}
        />
      )}

      {showFormModal && (
        <MemberForm
          member={member}
          isEditing={true}
          onClose={() => setShowFormModal(false)}
          onSuccess={() => {
            setShowFormModal(false);
            loadMember();
            showToast("Member updated successfully");
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
};

export default MemberDetailsPage;
