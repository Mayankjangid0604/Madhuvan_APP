import React, { useEffect, useRef } from 'react';
import { AlertCircle, X, AlertTriangle } from 'lucide-react';
import Button from '../buttons/Button';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import './confirmModal.css';

const ConfirmModal = ({
    isOpen,
    title = "Confirm Action",
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirm",
    cancelText = "Cancel",
    type = "warning"
}) => {
    useBodyScrollLock(isOpen);
    const modalRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onCancel();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <AlertTriangle size={20} />;
            case 'warning':
            case 'info':
            default:
                return <AlertCircle size={20} />;
        }
    };

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div
                className={`modal-content confirm-modal ${type}`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                ref={modalRef}
            >
                <div className={`modal-header ${type}`}>
                    <h3>
                        {getIcon()}
                        {title}
                    </h3>
                    <button className="close-btn" onClick={onCancel} aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <p className="confirm-message">{message}</p>
                </div>

                <div className="modal-footer">
                    {cancelText && (
                        <Button variant="secondary" onClick={onCancel}>
                            {cancelText}
                        </Button>
                    )}
                    <Button
                        variant={type === 'danger' ? 'danger' : 'primary'}
                        onClick={() => {
                            onConfirm();
                        }}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
