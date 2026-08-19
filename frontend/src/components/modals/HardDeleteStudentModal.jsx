import { useState, useEffect } from "react";
import Button from "../buttons/Button";
import { AlertTriangle, X } from "lucide-react";
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import "./hardDeleteStudentModal.css";

const HardDeleteStudentModal = ({ student, onClose, onConfirm }) => {
  const [confirmText, setConfirmText] = useState("");
  useBodyScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const isConfirmed = confirmText === "DELETE STUDENT";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content danger-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Permanent Delete"
      >
        <div className="modal-header danger">
          <h3>
            <AlertTriangle size={20} />
            Permanent Delete
          </h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="danger-text">
            You are about to <strong>permanently delete</strong>:
          </p>

          <div className="student-highlight">
            {student.student_name} (ID: {student.student_id})
          </div>

          <p className="danger-warning">
            This will delete <strong>ALL records</strong> including fees, ledger,
            room history and uploaded documents.
            <br />
            <strong>This action CANNOT be undone.</strong>
          </p>

          <label className="confirm-label">
            Type <strong>DELETE STUDENT</strong> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE STUDENT"
            className="confirm-input"
          />
        </div>

        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!isConfirmed}
            onClick={onConfirm}
          >
            Permanently Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HardDeleteStudentModal;
