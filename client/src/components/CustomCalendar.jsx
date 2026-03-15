import React, { useState, useEffect } from 'react';
import './CustomCalendar.css';

const CustomCalendar = ({ selectedDate, onChange, onClose }) => {
    const [date, setDate] = useState(selectedDate ? new Date(selectedDate) : new Date());
    const [viewMonth, setViewMonth] = useState(date.getMonth());
    const [viewYear, setViewYear] = useState(date.getFullYear());

    // Generate years (1900 - Current)
    const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const handleDateClick = (day) => {
        // Create the date in local time using the chosen day
        const newDate = new Date(viewYear, viewMonth, day);
        setDate(newDate);
    };

    const handleConfirm = () => {
        // Build the string manually using the components to avoid timezone shift from toISOString()
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const formattedDate = `${year}-${month}-${day}`;
        onChange(formattedDate);
        onClose();
    };

    const renderDays = () => {
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
        const days = [];

        // Empty slots for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar__date calendar__date--grey"></div>);
        }

        // Days
        for (let i = 1; i <= daysInMonth; i++) {
            const isSelected =
                date.getDate() === i &&
                date.getMonth() === viewMonth &&
                date.getFullYear() === viewYear;

            days.push(
                <div
                    key={i}
                    className={`calendar__date ${isSelected ? 'calendar__date--selected' : ''}`}
                    onClick={() => handleDateClick(i)}
                >
                    <span>{i}</span>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="calendar">
            <div className="calendar__opts">
                <select
                    value={viewMonth}
                    onChange={(e) => setViewMonth(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                >
                    {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
                <select
                    value={viewYear}
                    onChange={(e) => setViewYear(parseInt(e.target.value))}
                    style={{ flex: 1 }}
                >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div className="calendar__body">
                <div className="calendar__days">
                    <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
                </div>
                <div className="calendar__dates">
                    {renderDays()}
                </div>
            </div>

            <div className="calendar__buttons">
                <button className="calendar__button calendar__button--grey" onClick={onClose}>Back</button>
                <button className="calendar__button calendar__button--primary" onClick={handleConfirm}>Apply</button>
            </div>
        </div>
    );
};

export default CustomCalendar;
