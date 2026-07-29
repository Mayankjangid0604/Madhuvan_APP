import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail, MessageSquare, MessagesSquare, CheckCircle, XCircle, X, Save, Send,
  Settings as SettingsIcon, ArrowLeft, ScrollText, Eye, EyeOff
} from "lucide-react";
import Button from "../../../components/buttons/Button";
import Card from "../../../components/cards/Card";
import { communicationAPI } from "../../../services/api/communication.api";
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
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [configModalChannel, setConfigModalChannel] = useState(null);
  const [testModalChannel, setTestModalChannel] = useState(null);

  const showSuccess = (msg) => { setSuccessMessage(msg); setTimeout(() => setSuccessMessage(""), 4000); };
  const showError = (msg) => { setErrorMessage(msg); setTimeout(() => setErrorMessage(""), 6000); };

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
              <div className={`status-badge ${isActive ? "ok" : "warn"}`} style={{
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
