import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from 'firebase/firestore';
import {
    Calendar,
    Users,
    Check,
    X,
    Clock,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    UserCheck,
    UserX
} from 'lucide-react';

const Attendance = () => {
    const { hasPermission, isEmployee, userProfile } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedEmployee, setSelectedEmployee] = useState('all');
    const [showMarkModal, setShowMarkModal] = useState(false);

    useEffect(() => {
        fetchData();
    }, [currentDate]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch employees
            const empQuery = query(collection(db, 'adminUsers'), where('status', '==', 'approved'));
            const empSnapshot = await getDocs(empQuery);
            const empList = empSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setEmployees(empList);

            // Fetch attendance for current month
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth();
            // Use YYYY-MM-DD format with local dates
            const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

            const attQuery = query(
                collection(db, 'attendance'),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );
            const attSnapshot = await getDocs(attQuery);
            const attList = attSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAttendance(attList);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getMonthDays = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        // Add empty cells for days before the first day of the month
        for (let i = 0; i < firstDay.getDay(); i++) {
            days.push(null);
        }

        // Add all days of the month
        for (let i = 1; i <= lastDay.getDate(); i++) {
            days.push(new Date(year, month, i));
        }

        return days;
    };

    const getAttendanceForDate = (date, employeeId) => {
        if (!date) return null;
        // Format date as YYYY-MM-DD without timezone conversion
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        return attendance.find(a => a.date === dateStr && a.userId === employeeId);
    };

    const markAttendance = async (employeeId, dateStr, status, extraData = {}) => {
        try {
            // dateStr is already in YYYY-MM-DD format
            const existing = attendance.find(a => a.date === dateStr && a.userId === employeeId);

            if (existing) {
                if (status === 'delete') {
                    await deleteDoc(doc(db, 'attendance', existing.id));
                } else {
                    await updateDoc(doc(db, 'attendance', existing.id), {
                        status: status,
                        updatedAt: serverTimestamp(),
                        ...extraData
                    });
                }
            } else if (status !== 'delete') {
                await addDoc(collection(db, 'attendance'), {
                    userId: employeeId,
                    date: dateStr,
                    status: status,
                    createdAt: serverTimestamp(),
                    ...extraData
                });
            }

            fetchData();
        } catch (error) {
            console.error('Error marking attendance:', error);
        }
    };

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'present': return '#10b981';
            case 'absent': return '#ef4444';
            case 'half-day': return '#f59e0b';
            case 'paid_leave': return '#3b82f6';
            case 'unpaid_leave': return '#fca5a5';
            case 'overtime': return '#8b5cf6';
            default: return '#e5e7eb';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'present': return <Check size={14} />;
            case 'absent': return <X size={14} />;
            case 'half-day': return <Clock size={14} />;
            case 'paid_leave': return <UserCheck size={14} />;
            case 'unpaid_leave': return <UserX size={14} />;
            case 'overtime': return <Clock size={14} />;
            default: return null;
        }
    };

    // Calculate stats - use local date format
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayAttendance = attendance.filter(a => a.date === today);
    const presentToday = todayAttendance.filter(a => a.status === 'present' || a.status === 'overtime').length;
    const absentToday = todayAttendance.filter(a => a.status === 'absent' || a.status === 'unpaid_leave').length;

    const monthDays = getMonthDays();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    // For employees: only show their own attendance
    // For managers/admins: show all employees (or filtered if selected)
    const filteredEmployees = isEmployee
        ? employees.filter(e => e.id === userProfile?.uid)
        : selectedEmployee === 'all'
            ? employees
            : employees.filter(e => e.id === selectedEmployee);

    return (
        <div className="attendance-page">
            <div className="page-header">
                <div>
                    <h1><Calendar size={28} /> {isEmployee ? 'My Attendance' : 'Attendance'}</h1>
                    <p className="subtitle">{isEmployee ? 'View your attendance records' : 'Track employee attendance'}</p>
                </div>
                <div className="header-actions">
                    {hasPermission('attendance') && (
                        <button className="btn btn-primary" onClick={() => setShowMarkModal(true)}>
                            <UserCheck size={18} /> Mark Attendance
                        </button>
                    )}
                </div>
            </div>

            {/* Stats - Show employee-specific stats for employees */}
            {isEmployee ? (
                <div className="quick-stats-row">
                    <div className="quick-stat-card">
                        <div className="stat-icon green">
                            <UserCheck size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{attendance.filter(a => a.userId === userProfile?.uid && a.status === 'present').length}</span>
                            <span className="stat-label">Days Present</span>
                        </div>
                    </div>
                    <div className="quick-stat-card">
                        <div className="stat-icon red">
                            <UserX size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{attendance.filter(a => a.userId === userProfile?.uid && a.status === 'absent').length}</span>
                            <span className="stat-label">Days Absent</span>
                        </div>
                    </div>
                    <div className="quick-stat-card">
                        <div className="stat-icon purple">
                            <Clock size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{attendance.filter(a => a.userId === userProfile?.uid).reduce((sum, a) => sum + (Number(a.overtimeHours) || 0), 0)}h</span>
                            <span className="stat-label">Overtime</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="quick-stats-row">
                    <div className="quick-stat-card">
                        <div className="stat-icon blue">
                            <Users size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{employees.length}</span>
                            <span className="stat-label">Total Employees</span>
                        </div>
                    </div>
                    <div className="quick-stat-card">
                        <div className="stat-icon green">
                            <UserCheck size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{presentToday}</span>
                            <span className="stat-label">Present Today</span>
                        </div>
                    </div>
                    <div className="quick-stat-card">
                        <div className="stat-icon red">
                            <UserX size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{absentToday}</span>
                            <span className="stat-label">Absent Today</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Calendar Header */}
            <div className="calendar-header">
                <button className="btn btn-secondary" onClick={prevMonth}>
                    <ChevronLeft size={20} />
                </button>
                <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                <button className="btn btn-secondary" onClick={nextMonth}>
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Employee Filter - Only show for managers/admins */}
            {!isEmployee && (
                <div className="search-filter-bar">
                    <select
                        className="filter-select"
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                    >
                        <option value="all">All Employees</option>
                        {employees.map(emp => (
                            <option key={emp.id} value={emp.id}>{emp.displayName}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Calendar Grid */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state"><div className="loader"></div></div>
                    ) : (
                        <>
                            {/* Day Headers */}
                            <div className="calendar-grid">
                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                                    <div key={day} className="calendar-day-header">{day}</div>
                                ))}

                                {/* Calendar Days */}
                                {monthDays.map((day, index) => (
                                    <div
                                        key={index}
                                        className={`calendar-day ${!day ? 'empty' : ''} ${day?.toDateString() === new Date().toDateString() ? 'today' : ''}`}
                                    >
                                        {day && (
                                            <>
                                                <span className="day-number">{day.getDate()}</span>
                                                <div className="day-attendance">
                                                    {filteredEmployees.map(emp => {
                                                        const att = getAttendanceForDate(day, emp.id);
                                                        if (!att) return null;
                                                        return (
                                                            <div
                                                                key={emp.id}
                                                                className="attendance-dot"
                                                                style={{ background: getStatusColor(att.status) }}
                                                                title={`${emp.displayName}: ${att.status} ${att.overtimeHours ? `(${att.overtimeHours}h OT)` : ''}`}
                                                            >
                                                                {getStatusIcon(att.status)}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="attendance-legend">
                                <span><span className="legend-dot" style={{ background: '#10b981' }}></span> Present</span>
                                <span><span className="legend-dot" style={{ background: '#ef4444' }}></span> Absent</span>
                                <span><span className="legend-dot" style={{ background: '#f59e0b' }}></span> Half-day</span>
                                <span><span className="legend-dot" style={{ background: '#3b82f6' }}></span> Paid Leave</span>
                                <span><span className="legend-dot" style={{ background: '#fca5a5' }}></span> Unpaid Leave</span>
                                <span><span className="legend-dot" style={{ background: '#8b5cf6' }}></span> Overtime</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Employee Attendance Summary */}
            <div className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                    <h3>{isEmployee ? 'My Monthly Summary' : 'Monthly Summary'}</h3>
                </div>
                <div className="card-body">
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    {!isEmployee && <th>Employee</th>}
                                    <th>Present</th>
                                    <th>Absent</th>
                                    <th>Half-day</th>
                                    <th>Paid Leave</th>
                                    <th>Unpaid Leave</th>
                                    <th>Overtime (Hrs)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(isEmployee ? employees.filter(e => e.id === userProfile?.uid) : employees).map(emp => {
                                    const empAtt = attendance.filter(a => a.userId === emp.id);
                                    const otHours = empAtt.reduce((sum, a) => sum + (Number(a.overtimeHours) || 0), 0);

                                    return (
                                        <tr key={emp.id}>
                                            {!isEmployee && <td><strong>{emp.displayName}</strong></td>}
                                            <td style={{ color: '#10b981' }}>{empAtt.filter(a => a.status === 'present').length}</td>
                                            <td style={{ color: '#ef4444' }}>{empAtt.filter(a => a.status === 'absent').length}</td>
                                            <td style={{ color: '#f59e0b' }}>{empAtt.filter(a => a.status === 'half-day').length}</td>
                                            <td style={{ color: '#3b82f6' }}>{empAtt.filter(a => a.status === 'paid_leave').length}</td>
                                            <td style={{ color: '#fca5a5' }}>{empAtt.filter(a => a.status === 'unpaid_leave').length}</td>
                                            <td style={{ color: '#8b5cf6' }}>{otHours}h</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Mark Attendance Modal */}
            {showMarkModal && (
                <MarkAttendanceModal
                    employees={isEmployee ? filteredEmployees : employees}
                    attendance={attendance}
                    onClose={() => setShowMarkModal(false)}
                    onMark={markAttendance}
                />
            )}

            <style>{`
                .calendar-header {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 1.5rem;
                    margin-bottom: 1rem;
                }
                
                .calendar-header h2 {
                    margin: 0;
                    min-width: 200px;
                    text-align: center;
                }
                
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 4px;
                }
                
                .calendar-day-header {
                    padding: 0.75rem;
                    text-align: center;
                    font-weight: 600;
                    color: var(--navy-500);
                    font-size: 0.85rem;
                }
                
                .calendar-day {
                    min-height: 70px;
                    padding: 0.5rem;
                    background: var(--navy-50);
                    border-radius: var(--radius-sm);
                    position: relative;
                }
                
                .calendar-day.empty {
                    background: transparent;
                }
                
                .calendar-day.today {
                    background: var(--primary-light);
                    border: 2px solid var(--primary);
                }
                
                .day-number {
                    font-weight: 600;
                    font-size: 0.9rem;
                }
                
                .day-attendance {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 3px;
                    margin-top: 0.5rem;
                }
                
                .attendance-dot {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }
                
                .attendance-legend {
                    display: flex;
                    gap: 1.5rem;
                    justify-content: center;
                    margin-top: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid var(--navy-100);
                }
                
                .legend-dot {
                    display: inline-block;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    margin-right: 0.5rem;
                }
                
                .stat-icon.red { background: #fee2e2; color: #ef4444; }
                .stat-icon.purple { background: linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%); color: #8b5cf6; }
                
                @media (max-width: 768px) {
                    .calendar-day {
                        min-height: 50px;
                        padding: 0.25rem;
                    }
                    
                    .day-number {
                        font-size: 0.75rem;
                    }
                    
                    .attendance-dot {
                        width: 16px;
                        height: 16px;
                    }
                    
                    .attendance-legend {
                        flex-wrap: wrap;
                        gap: 0.75rem;
                    }
                }
            `}</style>
        </div>
    );
};

// Mark Attendance Modal - Updated to allow Present + Overtime together
const MarkAttendanceModal = ({ employees, attendance, onClose, onMark }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [statuses, setStatuses] = useState({});
    const [overtimeEnabled, setOvertimeEnabled] = useState({}); // Separate toggle for overtime
    const [overtimeHours, setOvertimeHours] = useState({});

    useEffect(() => {
        // Pre-fill with existing attendance
        const existing = {};
        const existingOt = {};
        const existingOtEnabled = {};
        attendance.filter(a => a.date === selectedDate).forEach(a => {
            existing[a.userId] = a.status;
            if (a.overtimeHours) {
                existingOt[a.userId] = a.overtimeHours;
                existingOtEnabled[a.userId] = true;
            }
        });
        setStatuses(existing);
        setOvertimeHours(existingOt);
        setOvertimeEnabled(existingOtEnabled);
    }, [selectedDate, attendance]);

    const handleStatusChange = (empId, status) => {
        setStatuses({ ...statuses, [empId]: status });
    };

    const handleOvertimeToggle = (empId) => {
        setOvertimeEnabled({ ...overtimeEnabled, [empId]: !overtimeEnabled[empId] });
    };

    const handleOtHoursChange = (empId, hours) => {
        setOvertimeHours({ ...overtimeHours, [empId]: hours });
    };

    const handleSave = async () => {
        for (const [empId, status] of Object.entries(statuses)) {
            if (status) {
                // Include overtime data if overtime is enabled for this employee
                const extraData = overtimeEnabled[empId] ? { overtimeHours: overtimeHours[empId] || 0 } : { overtimeHours: 0 };
                await onMark(empId, selectedDate, status, extraData);
            }
        }
        onClose();
    };

    // Base statuses (excluding standalone overtime)
    const baseStatuses = [
        { id: 'present', label: 'Present', color: '#10b981' },
        { id: 'half-day', label: 'Half-day', color: '#f59e0b' },
        { id: 'paid_leave', label: 'Paid Leave', color: '#3b82f6' },
        { id: 'unpaid_leave', label: 'Unpaid Leave', color: '#fca5a5' }
    ];

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><UserCheck size={20} /> Mark Attendance</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label>Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>

                    <div className="attendance-list" style={{ marginTop: '1rem', maxHeight: '60vh', overflowY: 'auto' }}>
                        {employees.map(emp => (
                            <div key={emp.id} className="attendance-row" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '1rem',
                                background: 'var(--navy-50)',
                                borderRadius: 'var(--radius-sm)',
                                marginBottom: '0.5rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <strong>{emp.displayName}</strong>
                                </div>

                                {/* Base Status Buttons */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                    {baseStatuses.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={`btn btn-sm`}
                                            onClick={() => handleStatusChange(emp.id, opt.id)}
                                            style={{
                                                background: statuses[emp.id] === opt.id ? opt.color : 'white',
                                                color: statuses[emp.id] === opt.id ? 'white' : 'var(--navy-600)',
                                                border: `1px solid ${opt.color}`,
                                                flex: '1',
                                                minWidth: '80px'
                                            }}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Overtime Add-on (can be combined with Present) */}
                                {(statuses[emp.id] === 'present' || statuses[emp.id] === 'half-day') && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem',
                                        padding: '0.75rem',
                                        background: overtimeEnabled[emp.id] ? 'rgba(139, 92, 246, 0.1)' : 'white',
                                        borderRadius: 'var(--radius-sm)',
                                        border: `1px solid ${overtimeEnabled[emp.id] ? '#8b5cf6' : 'var(--navy-200)'}`
                                    }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
                                            <input
                                                type="checkbox"
                                                checked={overtimeEnabled[emp.id] || false}
                                                onChange={() => handleOvertimeToggle(emp.id)}
                                                style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }}
                                            />
                                            <span style={{ fontWeight: '500', color: '#8b5cf6' }}>+ Overtime</span>
                                        </label>

                                        {overtimeEnabled[emp.id] && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.5"
                                                    value={overtimeHours[emp.id] || ''}
                                                    onChange={(e) => handleOtHoursChange(emp.id, e.target.value)}
                                                    placeholder="Hrs"
                                                    style={{ width: '70px', padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid #8b5cf6' }}
                                                />
                                                <span style={{ fontSize: '0.875rem', color: 'var(--navy-500)' }}>hours</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleSave}>Save Attendance</button>
                </div>
            </div>
        </div>
    );
};

const getStatusColor = (status) => {
    switch (status) {
        case 'present': return '#10b981';
        case 'absent': return '#ef4444';
        case 'half-day': return '#f59e0b';
        case 'paid_leave': return '#3b82f6';
        case 'unpaid_leave': return '#fca5a5';
        case 'overtime': return '#8b5cf6';
        default: return '#e5e7eb';
    }
};

export default Attendance;
