import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import Button from "../../../components/buttons/Button";
import Card from "../../../components/cards/Card";
import { communicationAPI } from "../../../services/api/communication.api";
import "../settings.css";
import "./communication.css";

const PAGE_SIZE = 25;

const emptyFilters = { channel: "", provider: "", status: "", from_date: "", to_date: "" };

const CommunicationLogs = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (currentOffset = offset) => {
    setLoading(true);
    setError("");
    try {
      const params = { ...filters, limit: PAGE_SIZE, offset: currentOffset };
      Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });
      const res = await communicationAPI.getLogs(params);
      setRows(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => { setOffset(0); load(0); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const goPrev = () => { const next = Math.max(0, offset - PAGE_SIZE); setOffset(next); load(next); };
  const goNext = () => { const next = offset + PAGE_SIZE; setOffset(next); load(next); };

  const formatDate = (iso) => {
    if (!iso) return "-";
    try {
      return new Date(iso.replace(" ", "T")).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <Button variant="outline" size="sm" onClick={() => navigate("/settings/communication")}>
          <ArrowLeft size={14} /> Back to Communication
        </Button>
        <h1>Communication Logs</h1>
        <p>Every email, SMS and WhatsApp message the system has attempted to send.</p>
      </div>

      <Card>
        <div className="logs-filters">
          <div className="form-group">
            <label>Type</label>
            <select className="form-input" value={filters.channel} onChange={(e) => applyFilter("channel", e.target.value)}>
              <option value="">All</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
          <div className="form-group">
            <label>Provider</label>
            <select className="form-input" value={filters.provider} onChange={(e) => applyFilter("provider", e.target.value)}>
              <option value="">All</option>
              <option value="gmail">Gmail</option>
              <option value="msg91">MSG91</option>
              <option value="smtp">SMTP</option>
              <option value="twilio">Twilio</option>
              <option value="custom">Custom</option>
              <option value="meta">Meta</option>
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="form-input" value={filters.status} onChange={(e) => applyFilter("status", e.target.value)}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="form-group">
            <label>From Date</label>
            <input type="date" className="form-input" value={filters.from_date} onChange={(e) => applyFilter("from_date", e.target.value)} />
          </div>
          <div className="form-group">
            <label>To Date</label>
            <input type="date" className="form-input" value={filters.to_date} onChange={(e) => applyFilter("to_date", e.target.value)} />
          </div>
          <div className="form-group">
            <label>&nbsp;</label>
            <Button variant="outline" size="sm" onClick={() => setFilters(emptyFilters)}>Reset</Button>
          </div>
          <div className="form-group">
            <label>&nbsp;</label>
            <Button variant="secondary" size="sm" onClick={() => load(offset)} disabled={loading}>
              <RefreshCw size={14} /> Refresh
            </Button>
          </div>
        </div>

        {error && <div className="alert-banner error">{error}</div>}

        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Provider</th>
                <th>Recipient</th>
                <th>Status</th>
                <th>Error</th>
                <th>Sent By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}>No communication logs found.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td className="capitalize">{row.channel}</td>
                    <td>{row.provider || "-"}</td>
                    <td>{row.recipient || "-"}</td>
                    <td>
                      <span className={`status-pill ${row.status === "success" ? "ok" : "fail"}`}>
                        {row.status === "success" ? "Success" : "Failed"}
                      </span>
                    </td>
                    <td className="error-cell">{row.error || "-"}</td>
                    <td>{row.sent_by || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="logs-pagination">
          <span>{total === 0 ? "0" : `${offset + 1}-${Math.min(offset + PAGE_SIZE, total)}`} of {total}</span>
          <div className="button-group">
            <Button variant="outline" size="sm" onClick={goPrev} disabled={offset === 0 || loading}>
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} disabled={offset + PAGE_SIZE >= total || loading}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CommunicationLogs;
