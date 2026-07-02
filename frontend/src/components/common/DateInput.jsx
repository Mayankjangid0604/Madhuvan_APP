import React, { useState, useRef } from 'react';

/**
 * DateInput - A text-based date input that allows direct typing in DD-MM-YYYY format.
 * Stores value internally as YYYY-MM-DD (ISO) for backend compatibility.
 * 
 * Props:
 *   value      - ISO date string (YYYY-MM-DD) or empty
 *   onChange   - function(isoDateString) called with YYYY-MM-DD or ''
 *   className  - CSS class for the input
 *   placeholder - placeholder text (default: "DD-MM-YYYY")
 *   ...rest    - any other input props
 */
const DateInput = ({ value, onChange, className = '', placeholder = 'DD-MM-YYYY', ...rest }) => {
    // Convert ISO (YYYY-MM-DD) to display (DD-MM-YYYY)
    const isoToDisplay = (iso) => {
        if (!iso) return '';
        const parts = iso.split('-');
        if (parts.length !== 3) return iso;
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };

    // Convert display (DD-MM-YYYY) to ISO (YYYY-MM-DD)
    const displayToIso = (display) => {
        if (!display) return '';
        const clean = display.replace(/[^0-9]/g, '');
        if (clean.length === 8) {
            const dd = clean.substring(0, 2);
            const mm = clean.substring(2, 4);
            const yyyy = clean.substring(4, 8);
            return `${yyyy}-${mm}-${dd}`;
        }
        return '';
    };

    const [displayValue, setDisplayValue] = useState(isoToDisplay(value));
    const inputRef = useRef(null);

    // Sync when parent value changes
    React.useEffect(() => {
        const newDisplay = isoToDisplay(value);
        if (newDisplay !== displayValue) {
            setDisplayValue(newDisplay);
        }
    }, [value]);

    const formatInput = (raw) => {
        // Remove all non-digits
        const digits = raw.replace(/[^0-9]/g, '');

        // Auto-format with dashes
        let formatted = '';
        for (let i = 0; i < digits.length && i < 8; i++) {
            if (i === 2 || i === 4) formatted += '-';
            formatted += digits[i];
        }
        return formatted;
    };

    const handleChange = (e) => {
        const raw = e.target.value;
        const formatted = formatInput(raw);
        setDisplayValue(formatted);

        // Only call onChange with valid complete date
        const digits = formatted.replace(/[^0-9]/g, '');
        if (digits.length === 8) {
            const iso = displayToIso(formatted);
            // Basic validation
            const dd = parseInt(digits.substring(0, 2));
            const mm = parseInt(digits.substring(2, 4));
            const yyyy = parseInt(digits.substring(4, 8));

            if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900 && yyyy <= 2099) {
                onChange(iso);
            }
        } else if (digits.length === 0) {
            onChange('');
        }
    };

    const handleBlur = () => {
        // On blur, if incomplete, try to keep what we have
        const digits = displayValue.replace(/[^0-9]/g, '');
        if (digits.length > 0 && digits.length < 8) {
            // Incomplete date - keep the formatted display but don't update parent
        }
    };

    return (
        <input
            ref={inputRef}
            type="text"
            value={displayValue}
            onChange={handleChange}
            onBlur={handleBlur}
            className={className}
            placeholder={placeholder}
            maxLength={10}
            inputMode="numeric"
            {...rest}
        />
    );
};

export default DateInput;
