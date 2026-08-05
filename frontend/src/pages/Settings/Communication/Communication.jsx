import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail, MessageSquare, MessagesSquare, CheckCircle, XCircle, X, Save, Send,
  Settings as SettingsIcon, ArrowLeft, ScrollText, Eye, EyeOff, Edit, Bell
} from "lucide-react";
import Button from "../../../components/buttons/Button";
import Card from "../../../components/cards/Card";
import { communicationAPI } from "../../../services/api/communication.api";
import { settingsAPI } from "../../../services/api/settings.api";
import { fieldMeta } from "./fieldMeta";
import "../settings.css";
import "./communication.css";

const CHANNELS = [
  { key: "email", label: "Email", icon: Mail, testLabel: "Test Email" },
  { key: "sms", label: "SMS", icon: MessageSquare, testLabel: "Test SMS" },
  { key: "whatsapp", label: "WhatsApp", icon: MessagesSquare, testLabel: "Test WhatsApp" }
];

const formatTimestamp = (iso) => {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
};


const Communication = () => {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [configModalChannel, setConfigModalChannel] = useState(null);
  const [testModalChannel, setTestModalChannel] = useState(null);

  // Message template modals
  const [showInvoiceEmailModal, setShowInvoiceEmailModal] = useState(false);
  const [showSmsTemplateModal, setShowSmsTemplateModal] = useState(false);
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [showReceiptEmailModal, setShowReceiptEmailModal] = useState(false);

  const [emailTemplate, setEmailTemplate] = useState({
    subject: "Fee Payment Reminder - {student_name}",
    body: "Dear {father_name},\n\nThis is a reminder that the hostel fee for {student_name} is due.\n\nFee Details:\n- Amount: ₹{fee_amount}\n- Due Date: {due_date}\n- Status: {fee_status}\n\nPlease make the payment at the earliest.\n\nThank you,\n{hostel_name}"
  });
  const [invoiceEmailTemplate, setInvoiceEmailTemplate] = useState({
    subject: "Invoice #{invoice_number} - {student_name}",
    body: "Dear {father_name},\n\nPlease find attached the invoice for {student_name} for the period {period}.\n\nAmount Payable: ₹{fee_amount}\nDue Date: {due_date}\n\nKindly make the payment on or before the due date.\n\nRegards,\n{hostel_name}"
  });
  const [receiptEmailTemplate, setReceiptEmailTemplate] = useState({
    subject: "Payment Receipt #{receipt_number} - {student_name}",
    body: "Dear {father_name},\n\nWe have received your payment of ₹{amount_paid} for {student_name}.\n\nReceipt No: {receipt_number}\nPayment Date: {payment_date}\nFor Period: {period}\n\nPlease retain this receipt for your records.\n\nThank you,\n{hostel_name}"
  });
  const [smsTemplate, setSmsTemplate] = useState({
    message: "Dear {contact_name}, admission of {student_name} at {hostel_name} is confirmed. Fee Rs.{fee_amount} due on {due_date}. - {hostel_name}"
  });

  const DEFAULT_NOTIF_PREFS = {
    email: {
      on_admission: { enabled: false, recipient: 'father' },
      on_fee_payment: { enabled: false, recipient: 'father' },
      monthly_invoice: { enabled: false, recipient: 'father', day_of_month: 1 },
      due_reminder: { enabled: false, recipient: 'father', days_before: 5 },
      overdue_reminder: { enabled: false, recipient: 'father', days_after: 3 },
    },
    sms: {
      on_admission: { enabled: false, recipient: 'father' },
      on_fee_payment: { enabled: false, recipient: 'father' },
      monthly_invoice: { enabled: false, recipient: 'father', day_of_month: 1 },
      due_reminder: { enabled: false, recipient: 'father', days_before: 5 },
      overdue_reminder: { enabled: false, recipient: 'father', days_after: 3 },
    },
    whatsapp: {
      on_admission: { enabled: false, recipient: 'father' },
      on_fee_payment: { enabled: false, recipient: 'father' },
      monthly_invoice: { enabled: false, recipient: 'father', day_of_month: 1 },
      due_reminder: { enabled: false, recipient: 'father', days_before: 5 },
      overdue_reminder: { enabled: false, recipient: 'father', days_after: 3 },
    }
  };
  const [notifPrefs, setNotifPrefs] = useState(DEFAULT_NOTIF_PREFS);
  const [savingNotifPrefs, setSavingNotifPrefs] = useState(false);

  const loadNotifPrefs = async () => {
    try {
      const r = await settingsAPI.getNotificationPreferences();
      if (r.data.success && r.data.data) setNotifPrefs(r.data.data);
    } catch { /* silent */ }
  };

  const handleSaveNotifPrefs = async () => {
    setSavingNotifPrefs(true);
    try {
      await settingsAPI.saveNotificationPreferences(notifPrefs);
      showSuccess("Notification preferences saved!");
    } catch (err) {
      showError("Save failed: " + (err.response?.data?.message || err.message));
    } finally {
      setSavingNotifPrefs(false);
    }
  };

  const updateNotifPref = (channel, event, field, value) => {
    setNotifPrefs(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [event]: { ...prev[channel][event], [field]: value }
      }
    }));
  };

  const showSuccess = (msg) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(""), 4000); };
  const showError = (msg) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(""), 6000); };

  const loadTemplates = async () => {
    try {
      const response = await settingsAPI.getTemplates();
      if (response.data.success && response.data.data) {
        if (response.data.data.due_reminder_email) setEmailTemplate(prev => ({ ...prev, ...response.data.data.due_reminder_email }));
        if (response.data.data.admission_sms) setSmsTemplate(prev => ({ ...prev, ...response.data.data.admission_sms }));
        if (response.data.data.admission_email) setInvoiceEmailTemplate(prev => ({ ...prev, ...response.data.data.admission_email }));
        if (response.data.data.receipt_email) setReceiptEmailTemplate(prev => ({ ...prev, ...response.data.data.receipt_email }));
      }
    } catch { /* silent */ }
  };

  const handleSaveTemplate = async (key, data, setModal) => {
    setSaving(true);
    try {
      await settingsAPI.saveTemplate(key, data);
      showSuccess("Template saved successfully!");
      setModal(false);
    } catch (err) {
      showError("Save failed: " + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const catalogRes = await communicationAPI.getProviderCatalog();
      setCatalog(catalogRes.data.data);

      const entries = await Promise.all(
        CHANNELS.map(async (c) => {
          const res = await communicationAPI.getConfig(c.key);
          return [c.key, res.data.data];
        })
      );
      setConfigs(Object.fromEntries(entries));
      await loadTemplates();
      await loadNotifPrefs();
    } catch (err) {
      showError(err.response?.data?.message || "Failed to load communication settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const refreshChannel = async (channel) => {
    const res = await communicationAPI.getConfig(channel);
    setConfigs((prev) => ({ ...prev, [channel]: res.data.data }));
  };

  if (loading) {
    return <div className="settings-page"><p>Loading communication settings...</p></div>;
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
          <ArrowLeft size={14} /> Back to Settings
        </Button>
        <h1>Communication</h1>
        <p>Configure independent Email, SMS and WhatsApp providers.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/settings/communication/logs")}>
          <ScrollText size={14} /> View Communication Logs
        </Button>
      </div>

      {successMessage && <div className="alert-banner success">{successMessage}</div>}
      {errorMessage && <div className="alert-banner error">{errorMessage}</div>}

      <div className="settings-grid comm-grid">
        {CHANNELS.map(({ key, label, icon: Icon, testLabel }) => {
          const cfg = configs[key] || { activeProvider: null, providers: {} };
          const activeProviderMeta = cfg.activeProvider ? catalog[key][cfg.activeProvider] : null;
          const activeProviderState = cfg.activeProvider ? cfg.providers[cfg.activeProvider] : null;
          const isActive = !!(activeProviderState && activeProviderState.enabled);

          return (
            <Card key={key}>
              <div className="card-icon" style={{ backgroundColor: "#3b82f615" }}>
                <Icon size={24} color="#3b82f6" />
              </div>
              <h3>{label}</h3>
              <p>Current Provider: {activeProviderMeta ? activeProviderMeta.label : "Not configured"}</p>
              <div className={`comm-status-badge ${isActive ? "ok" : "warn"}`} style={{
                backgroundColor: isActive ? "#d1fae5" : "#fee2e2",
                color: isActive ? "#065f46" : "#991b1b"
              }}>
                {isActive ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {isActive ? "Active" : "Not Active"}
              </div>
              <div className="button-group">
                <Button onClick={() => setConfigModalChannel(key)} variant="outline" size="sm">
                  <SettingsIcon size={14} /> Configure
                </Button>
                <Button
                  onClick={() => setTestModalChannel(key)}
                  variant="secondary"
                  size="sm"
                  disabled={!isActive}
                >
                  <Send size={14} /> {testLabel}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}>Message Templates</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>Customize the email and SMS templates sent to parents/guardians.</p>

      <div className="settings-grid comm-grid">
        <Card>
          <div className="card-icon" style={{ backgroundColor: "#3b82f615" }}>
            <Mail size={24} color="#3b82f6" />
          </div>
          <h3>Admission Email</h3>
          <p>Email sent on admission with invoice</p>
          <Button variant="outline" size="sm" onClick={() => setShowInvoiceEmailModal(true)}>
            <Edit size={14} /> Edit Template
          </Button>
        </Card>

        <Card>
          <div className="card-icon" style={{ backgroundColor: "#10b98115" }}>
            <MessageSquare size={24} color="#10b981" />
          </div>
          <h3>Admission SMS</h3>
          <p>SMS sent on student admission</p>
          <Button variant="outline" size="sm" onClick={() => setShowSmsTemplateModal(true)}>
            <Edit size={14} /> Edit Template
          </Button>
        </Card>

        <Card>
          <div className="card-icon" style={{ backgroundColor: "#f59e0b15" }}>
            <Mail size={24} color="#f59e0b" />
          </div>
          <h3>Due Reminder</h3>
          <p>Fee payment reminder email</p>
          <Button variant="outline" size="sm" onClick={() => setShowEmailTemplateModal(true)}>
            <Edit size={14} /> Edit Template
          </Button>
        </Card>

        <Card>
          <div className="card-icon" style={{ backgroundColor: "#8b5cf615" }}>
            <Mail size={24} color="#8b5cf6" />
          </div>
          <h3>Receipt Email</h3>
          <p>Email sent after fee payment</p>
          <Button variant="outline" size="sm" onClick={() => setShowReceiptEmailModal(true)}>
            <Edit size={14} /> Edit Template
          </Button>
        </Card>
      </div>

      {/* Due Reminder Email Template Modal */}
      {showEmailTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowEmailTemplateModal(false)}>
          <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Mail size={20} /> Edit Due Reminder Email Template</h3>
              <button className="close-btn" onClick={() => setShowEmailTemplateModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="template-info">
                <strong>Available Variables:</strong>
                <div className="variables-list">
                  <span className="variable">{'{student_name}'}</span>
                  <span className="variable">{'{contact_name}'}</span>
                  <span className="variable">{'{fee_amount}'}</span>
                  <span className="variable">{'{due_date}'}</span>
                  <span className="variable">{'{hostel_name}'}</span>
                </div>
                <small className="help-text">{'{contact_name}'} resolves to father, then mother, then guardian.</small>
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input type="text" value={emailTemplate.subject} onChange={(e) => setEmailTemplate({ ...emailTemplate, subject: e.target.value })} className="form-input" />
              </div>
              <div className="form-group">
                <label>Message Body *</label>
                <textarea value={emailTemplate.body} onChange={(e) => setEmailTemplate({ ...emailTemplate, body: e.target.value })} className="form-textarea" rows={12} />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setShowEmailTemplateModal(false)}>Cancel</Button>
              <Button variant="success" onClick={() => handleSaveTemplate('due_reminder_email', emailTemplate, setShowEmailTemplateModal)} loading={saving} disabled={saving}>
                <Save size={16} /> Save Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admission Invoice Email Template Modal */}
      {showInvoiceEmailModal && (
        <div className="modal-overlay" onClick={() => setShowInvoiceEmailModal(false)}>
          <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Mail size={20} /> Edit Admission Invoice Email Template</h3>
              <button className="close-btn" onClick={() => setShowInvoiceEmailModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="template-info">
                <strong>Available Variables:</strong>
                <div className="variables-list">
                  <span className="variable">{'{student_name}'}</span>
                  <span className="variable">{'{contact_name}'}</span>
                  <span className="variable">{'{fee_amount}'}</span>
                  <span className="variable">{'{due_date}'}</span>
                  <span className="variable">{'{hostel_name}'}</span>
                </div>
                <small className="help-text">Sent at admission with the admission form and fee invoice attached.</small>
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input type="text" value={invoiceEmailTemplate.subject} onChange={(e) => setInvoiceEmailTemplate({ ...invoiceEmailTemplate, subject: e.target.value })} className="form-input" />
              </div>
              <div className="form-group">
                <label>Message Body *</label>
                <textarea value={invoiceEmailTemplate.body} onChange={(e) => setInvoiceEmailTemplate({ ...invoiceEmailTemplate, body: e.target.value })} className="form-textarea" rows={12} />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setShowInvoiceEmailModal(false)}>Cancel</Button>
              <Button variant="success" onClick={() => handleSaveTemplate('admission_email', invoiceEmailTemplate, setShowInvoiceEmailModal)} loading={saving} disabled={saving}>
                <Save size={16} /> Save Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Email Template Modal */}
      {showReceiptEmailModal && (
        <div className="modal-overlay" onClick={() => setShowReceiptEmailModal(false)}>
          <div className="modal-content template-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Mail size={20} /> Edit Receipt Email Template</h3>
              <button className="close-btn" onClick={() => setShowReceiptEmailModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="template-info">
                <strong>Available Variables:</strong>
                <div className="variables-list">
                  <span className="variable">{'{student_name}'}</span>
                  <span className="variable">{'{contact_name}'}</span>
                  <span className="variable">{'{receipt_number}'}</span>
                  <span className="variable">{'{fee_amount}'}</span>
                  <span className="variable">{'{payment_date}'}</span>
                  <span className="variable">{'{hostel_name}'}</span>
                </div>
              </div>
              <div className="form-group">
                <label>Subject *</label>
                <input type="text" value={receiptEmailTemplate.subject} onChange={(e) => setReceiptEmailTemplate({ ...receiptEmailTemplate, subject: e.target.value })} className="form-input" />
              </div>
              <div className="form-group">
                <label>Message Body *</label>
                <textarea value={receiptEmailTemplate.body} onChange={(e) => setReceiptEmailTemplate({ ...receiptEmailTemplate, body: e.target.value })} className="form-textarea" rows={12} />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setShowReceiptEmailModal(false)}>Cancel</Button>
              <Button variant="success" onClick={() => handleSaveTemplate('receipt_email', receiptEmailTemplate, setShowReceiptEmailModal)} loading={saving} disabled={saving}>
                <Save size={16} /> Save Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Admission SMS Template Modal */}
      {showSmsTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowSmsTemplateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><MessageSquare size={20} /> Edit Admission SMS Template</h3>
              <button className="close-btn" onClick={() => setShowSmsTemplateModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="template-info">
                <strong>Available Variables:</strong>
                <div className="variables-list">
                  <span className="variable">{'{student_name}'}</span>
                  <span className="variable">{'{contact_name}'}</span>
                  <span className="variable">{'{fee_amount}'}</span>
                  <span className="variable">{'{due_date}'}</span>
                  <span className="variable">{'{hostel_name}'}</span>
                </div>
                <small className="help-text">Sent through whichever SMS provider is active. Keep it short.</small>
              </div>
              <div className="form-group">
                <label>SMS Message * ({smsTemplate.message.length}/160)</label>
                <textarea value={smsTemplate.message} onChange={(e) => setSmsTemplate({ ...smsTemplate, message: e.target.value })} className="form-textarea" rows={5} maxLength={160} />
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="secondary" onClick={() => setShowSmsTemplateModal(false)}>Cancel</Button>
              <Button variant="success" onClick={() => handleSaveTemplate('admission_sms', smsTemplate, setShowSmsTemplateModal)} loading={saving} disabled={saving}>
                <Save size={16} /> Save Template
              </Button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ marginTop: '2rem', marginBottom: '0.5rem' }}><Bell size={20} style={{ verticalAlign: 'middle', marginRight: 6 }} />Notification Preferences</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Configure when and to whom notifications are sent automatically.
      </p>

      <div className="notif-prefs-table-wrap" style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table className="notif-prefs-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary, #f8fafc)', textAlign: 'left' }}>
              <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--border, #e2e8f0)' }}>Trigger Event</th>
              {['email', 'sms', 'whatsapp'].map(ch => (
                <th key={ch} style={{ padding: '10px 12px', borderBottom: '2px solid var(--border, #e2e8f0)', textAlign: 'center' }}>
                  {ch === 'email' ? <Mail size={14} style={{ marginRight: 4 }} /> : ch === 'sms' ? <MessageSquare size={14} style={{ marginRight: 4 }} /> : <MessagesSquare size={14} style={{ marginRight: 4 }} />}
                  {ch.charAt(0).toUpperCase() + ch.slice(1)}
                </th>
              ))}
              <th style={{ padding: '10px 12px', borderBottom: '2px solid var(--border, #e2e8f0)' }}>Recipient</th>
            </tr>
          </thead>
          <tbody>
            {[
              { key: 'on_admission', label: 'On Admission (with first invoice)' },
              { key: 'on_fee_payment', label: 'On Fee Payment (receipt)' },
              { key: 'monthly_invoice', label: 'Monthly Invoice (1st of month)', extra: 'day_of_month' },
              { key: 'due_reminder', label: 'Due Reminder (before due date)', extra: 'days_before' },
              { key: 'overdue_reminder', label: 'Overdue Reminder (after due date)', extra: 'days_after' },
            ].map(evt => (
              <tr key={evt.key} style={{ borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                <td style={{ padding: '10px 12px' }}>
                  <strong>{evt.label}</strong>
                  {evt.extra === 'day_of_month' && notifPrefs.email[evt.key]?.enabled && (
                    <div style={{ marginTop: 4, fontSize: '0.8rem' }}>
                      Day of month: <input type="number" min={1} max={28} value={notifPrefs.email[evt.key]?.day_of_month || 1} onChange={(e) => { const v = parseInt(e.target.value) || 1; ['email','sms','whatsapp'].forEach(ch => updateNotifPref(ch, evt.key, 'day_of_month', v)); }} style={{ width: 50, padding: '2px 4px' }} className="form-input" />
                    </div>
                  )}
                  {evt.extra === 'days_before' && notifPrefs.email[evt.key]?.enabled && (
                    <div style={{ marginTop: 4, fontSize: '0.8rem' }}>
                      Days before: <input type="number" min={1} max={30} value={notifPrefs.email[evt.key]?.days_before || 5} onChange={(e) => { const v = parseInt(e.target.value) || 5; ['email','sms','whatsapp'].forEach(ch => updateNotifPref(ch, evt.key, 'days_before', v)); }} style={{ width: 50, padding: '2px 4px' }} className="form-input" />
                    </div>
                  )}
                  {evt.extra === 'days_after' && notifPrefs.email[evt.key]?.enabled && (
                    <div style={{ marginTop: 4, fontSize: '0.8rem' }}>
                      Days after: <input type="number" min={1} max={30} value={notifPrefs.email[evt.key]?.days_after || 3} onChange={(e) => { const v = parseInt(e.target.value) || 3; ['email','sms','whatsapp'].forEach(ch => updateNotifPref(ch, evt.key, 'days_after', v)); }} style={{ width: 50, padding: '2px 4px' }} className="form-input" />
                    </div>
                  )}
                </td>
                {['email', 'sms', 'whatsapp'].map(ch => (
                  <td key={ch} style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="checkbox" checked={notifPrefs[ch]?.[evt.key]?.enabled || false} onChange={(e) => updateNotifPref(ch, evt.key, 'enabled', e.target.checked)} />
                    </label>
                  </td>
                ))}
                <td style={{ padding: '10px 12px' }}>
                  <select value={notifPrefs.email[evt.key]?.recipient || 'father'} onChange={(e) => { ['email','sms','whatsapp'].forEach(ch => updateNotifPref(ch, evt.key, 'recipient', e.target.value)); }} className="form-input" style={{ fontSize: '0.8rem', padding: '4px 6px' }}>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="both">Both</option>
                    <option value="guardian">Guardian</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
        <Button variant="success" onClick={handleSaveNotifPrefs} loading={savingNotifPrefs} disabled={savingNotifPrefs}>
          <Save size={16} /> Save Notification Preferences
        </Button>
      </div>

      {configModalChannel && (
        <ProviderConfigModal
          channel={configModalChannel}
          catalog={catalog[configModalChannel]}
          config={configs[configModalChannel]}
          onClose={() => setConfigModalChannel(null)}
          onChanged={() => refreshChannel(configModalChannel)}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}

      {testModalChannel && (
        <TestSendModal
          channel={testModalChannel}
          onClose={() => setTestModalChannel(null)}
          showSuccess={showSuccess}
          showError={showError}
        />
      )}
    </div>
  );
};

const ProviderConfigModal = ({ channel, catalog, config, onClose, onChanged, showSuccess, showError }) => {
  const providerKeys = Object.keys(catalog);
  const [selected, setSelected] = useState(config?.activeProvider || providerKeys[0]);
  const [form, setForm] = useState(config?.providers?.[selected] || {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);

  useEffect(() => {
    setForm(config?.providers?.[selected] || {});
  }, [selected, config]);

  const meta = catalog[selected];
  const state = config?.providers?.[selected] || {};
  const isActiveProvider = config?.activeProvider === selected;
  const canActivate = state.lastTestStatus === "success";

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await communicationAPI.saveProviderConfig(channel, selected, form);
      showSuccess(`${meta.label} configuration saved`);
      onChanged();
      const updated = res.data.data.providers[selected];
      setForm(updated);
    } catch (err) {
      showError(err.response?.data?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await communicationAPI.testConnection(channel, selected, form);
      if (res.data.data.success) showSuccess(res.data.data.message || "Connection test succeeded");
      else showError(res.data.data.message || "Connection test failed");
      onChanged();
    } catch (err) {
      showError(err.response?.data?.message || "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleActivate = async () => {
    setActivating(true);
    try {
      await communicationAPI.setActiveProvider(channel, selected);
      showSuccess(`${meta.label} is now the active ${channel} provider`);
      onChanged();
    } catch (err) {
      showError(err.response?.data?.message || "Activation failed");
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setActivating(true);
    try {
      await communicationAPI.deactivateChannel(channel);
      showSuccess(`${channel} disabled`);
      onChanged();
    } catch (err) {
      showError(err.response?.data?.message || "Failed to disable");
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><SettingsIcon size={20} /> Configure {channel[0].toUpperCase() + channel.slice(1)}</h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="modal-body">
          <div className="provider-tabs">
            {providerKeys.map((key) => (
              <button
                key={key}
                type="button"
                className={`provider-tab ${selected === key ? "active" : ""} ${config?.activeProvider === key ? "is-live" : ""}`}
                onClick={() => setSelected(key)}
              >
                {catalog[key].label}
                {config?.activeProvider === key && <CheckCircle size={12} />}
              </button>
            ))}
          </div>

          <div className="provider-status-row">
            <span className={`status-pill ${state.lastTestStatus === "success" ? "ok" : state.lastTestStatus === "failed" ? "fail" : "unknown"}`}>
              {state.lastTestStatus === "success" ? "✅ Verified" : state.lastTestStatus === "failed" ? "❌ Failed" : "⏳ Not tested"}
            </span>
            <span className="last-tested">Last tested: {formatTimestamp(state.lastTestedAt)}</span>
            {state.lastTestMessage && <span className="test-message">{state.lastTestMessage}</span>}
          </div>

          <div className="form-fields-toggle">
            <button type="button" className="toggle-secrets" onClick={() => setShowSecrets((s) => !s)}>
              {showSecrets ? <EyeOff size={14} /> : <Eye size={14} />} {showSecrets ? "Hide" : "Show"} secret fields
            </button>
          </div>

          {meta.requiredFields.map((field) => {
            const isSecret = meta.secretFields.includes(field);
            const { label, type } = fieldMeta(field);
            const inputType = isSecret && !showSecrets ? "password" : (isSecret ? "text" : type);
            return (
              <div className="form-group" key={field}>
                <label>{label} <span className="required">*</span></label>
                <input
                  type={inputType}
                  className="form-input"
                  value={form[field] ?? ""}
                  onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                  placeholder={isSecret && form[field] === "********" ? "Saved (hidden)" : ""}
                />
              </div>
            );
          })}

          <div className="info-box">
            Save your credentials, then run <strong>Test Connection</strong>. Once it passes, you can
            activate this provider - only one provider per channel can be active at a time.
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={handleTest} loading={testing} disabled={testing}>
            Test Connection
          </Button>
          <Button variant="success" onClick={handleSave} loading={saving} disabled={saving}>
            <Save size={16} /> Save
          </Button>
          {isActiveProvider ? (
            <Button variant="danger" onClick={handleDeactivate} loading={activating} disabled={activating}>
              Deactivate
            </Button>
          ) : (
            <Button variant="primary" onClick={handleActivate} loading={activating} disabled={activating || !canActivate}>
              Activate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const TEST_FIELDS = {
  email: [{ name: "to", label: "Recipient Email", type: "email" }, { name: "subject", label: "Subject", type: "text" }, { name: "message", label: "Message", type: "textarea" }],
  sms: [{ name: "mobile", label: "Mobile Number", type: "text" }, { name: "message", label: "Message", type: "textarea" }],
  whatsapp: [{ name: "mobile", label: "Mobile Number", type: "text" }, { name: "message", label: "Message", type: "textarea" }]
};

const TestSendModal = ({ channel, onClose, showSuccess, showError }) => {
  const [form, setForm] = useState({ to: "", subject: "Test Email", mobile: "", message: `Test ${channel} message from Madhuvan.` });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const send = async () => {
    setSending(true);
    setResult(null);
    try {
      let res;
      if (channel === "email") res = await communicationAPI.testSendEmail({ to: form.to, subject: form.subject, message: form.message });
      else if (channel === "sms") res = await communicationAPI.testSendSms({ mobile: form.mobile, message: form.message });
      else res = await communicationAPI.testSendWhatsapp({ mobile: form.mobile, message: form.message });

      setResult(res.data.data);
      if (res.data.data.success) showSuccess(`Test ${channel} sent successfully`);
      else showError(res.data.data.error || res.data.data.reason || "Send failed");
    } catch (err) {
      const data = err.response?.data?.data;
      setResult(data || { success: false, error: err.response?.data?.message || err.message });
      showError(err.response?.data?.message || "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3><Send size={20} /> Test {channel[0].toUpperCase() + channel.slice(1)}</h3>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body">
          {TEST_FIELDS[channel].map((f) => (
            <div className="form-group" key={f.name}>
              <label>{f.label}</label>
              {f.type === "textarea" ? (
                <textarea
                  className="form-textarea"
                  rows={4}
                  value={form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              ) : (
                <input
                  type={f.type}
                  className="form-input"
                  value={form[f.name]}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              )}
            </div>
          ))}

          {result && (
            <div className={`test-result ${result.success ? "ok" : "fail"}`}>
              <strong>{result.success ? "✅ Success" : "❌ Failed"}</strong>
              {result.provider && <div>Provider: {result.provider}</div>}
              {result.error && <div>Error: {result.error}</div>}
              {result.reason && <div>{result.reason}</div>}
              {result.providerResponse && (
                <pre className="provider-response">{JSON.stringify(result.providerResponse, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button variant="success" onClick={send} loading={sending} disabled={sending}>
            <Send size={16} /> Send
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Communication;
