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
    doc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import { Receipt, Download, Users, Edit, Check, X, IndianRupee, TrendingUp, CreditCard, History, AlertCircle, Calendar, CheckCircle, PlusSquare, Calculator } from 'lucide-react';
import * as XLSX from 'xlsx';

const Payroll = () => {
    const { hasPermission } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [payrollRecords, setPayrollRecords] = useState({});
    const [paymentHistory, setPaymentHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Modal States
    const [showPayrollModal, setShowPayrollModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showManualEntryModal, setShowManualEntryModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        fetchPayrollData();
    }, [month]);

    const fetchPayrollData = async () => {
        try {
            setLoading(true);
            // Fetch approved employees
            const q = query(collection(db, 'adminUsers'), where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            const employeeList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Fetch payroll records for the selected month
            const payrollRef = collection(db, 'payroll');
            const payrollQuery = query(payrollRef, where('month', '==', month));
            const payrollSnapshot = await getDocs(payrollQuery);

            const records = {};
            payrollSnapshot.docs.forEach(doc => {
                const data = doc.data();
                records[data.employeeId] = { id: doc.id, ...data };
            });

            // Combine employee data with payroll
            const payrollData = employeeList.map(emp => {
                const record = records[emp.id] || {
                    baseSalary: emp.baseSalary || 15000,
                    bonus: 0,
                    deductions: 0
                };
                return {
                    ...emp,
                    payrollId: record.id,
                    baseSalary: record.baseSalary || emp.baseSalary || 15000,
                    bonus: record.bonus || 0,
                    deductions: record.deductions || 0,
                    netPay: (record.baseSalary || emp.baseSalary || 15000) + (record.bonus || 0) - (record.deductions || 0),
                    notes: record.notes || '',
                    processedToExpenses: record.processedToExpenses || false
                };
            });

            setEmployees(payrollData);
            setPayrollRecords(records);

            // Fetch payment history - simplified mainly for expenses view reference
            // We'll just keep the existing query if needed, or we can query 'expenses' 
            // but for now let's leave the 'salaryPayments' logic alone or remove it if unused.
            // Since we are moving to single payments, the batch 'salaryPayments' might be legacy.
            // Leaving it as empty for now to clean up UI.
            setPaymentHistory([]);

        } catch (error) {
            console.error('Error fetching payroll:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (emp) => {
        setSelectedEmployee(emp);
        setShowPayrollModal(true);
    };

    const handleViewHistoryClick = (emp) => {
        setSelectedEmployee(emp);
        setShowHistoryModal(true);
    };

    const handleProcessClick = (emp) => {
        setSelectedEmployee(emp);
        setShowConfirmModal(true);
    };

    const handleManualEntryClick = (emp) => {
        setSelectedEmployee(emp);
        setShowManualEntryModal(true);
    };

    // Process Single Employee Salary
    const processEmployeeSalary = async () => {
        if (!selectedEmployee) return;

        try {
            setProcessing(true);
            const monthName = new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            const emp = selectedEmployee;

            // 1. Create Expense Entry
            await addDoc(collection(db, 'expenses'), {
                title: `Salary - ${emp.displayName} (${monthName})`,
                amount: emp.netPay,
                category: 'salary',
                date: new Date().toISOString().split('T')[0],
                paymentMode: 'bank_transfer',
                note: `Monthly salary payment for ${monthName}. Base: ₹${emp.baseSalary}, Bonus: ₹${emp.bonus}, Deductions: ₹${emp.deductions}`,
                employeeId: emp.id,
                month: month,
                isAutoGenerated: true,
                createdAt: serverTimestamp()
            });

            // 2. Update or Create Payroll Record with processed status
            if (emp.payrollId) {
                await updateDoc(doc(db, 'payroll', emp.payrollId), {
                    processedToExpenses: true,
                    processedAt: serverTimestamp()
                });
            } else {
                // If it doesn't exist yet (no edits made), create it now
                await addDoc(collection(db, 'payroll'), {
                    employeeId: emp.id,
                    month: month,
                    baseSalary: emp.baseSalary,
                    bonus: emp.bonus,
                    deductions: emp.deductions,
                    notes: emp.notes || '',
                    netPay: emp.netPay,
                    processedToExpenses: true,
                    processedAt: serverTimestamp(),
                    createdAt: serverTimestamp()
                });
            }

            setShowConfirmModal(false);
            fetchPayrollData();
            // alert(`✅ Salary processed for ${emp.displayName}`);

        } catch (error) {
            console.error('Error processing salary:', error);
            alert('Error processing salary. Please try again.');
        } finally {
            setProcessing(false);
            setSelectedEmployee(null);
        }
    };

    const exportToExcel = () => {
        const exportData = employees.map(emp => ({
            Name: emp.displayName,
            Email: emp.email,
            Role: emp.role,
            'Base Salary': emp.baseSalary,
            Bonus: emp.bonus,
            Deductions: emp.deductions,
            'Net Pay': emp.netPay,
            Status: emp.processedToExpenses ? 'Paid' : 'Pending',
            Notes: emp.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payroll');
        XLSX.writeFile(wb, `payroll_${month}.xlsx`);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const totalPayroll = employees.reduce((sum, emp) => sum + (emp.netPay || 0), 0);
    const totalBonus = employees.reduce((sum, emp) => sum + (emp.bonus || 0), 0);
    const totalDeductions = employees.reduce((sum, emp) => sum + (emp.deductions || 0), 0);

    return (
        <div className="payroll-page">
            <div className="page-header">
                <div>
                    <h1><Receipt size={28} /> Payroll</h1>
                    <p className="subtitle">Employee payroll management</p>
                </div>
                <div className="header-actions">
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="filter-select"
                    />
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <Download size={18} /> Export
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Users size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{employees.length}</span>
                        <span className="stat-label">Employees</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <Receipt size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(totalPayroll)}</span>
                        <span className="stat-label">Total Payroll</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <TrendingUp size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(totalBonus)}</span>
                        <span className="stat-label">Total Bonus</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <IndianRupee size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(totalDeductions)}</span>
                        <span className="stat-label">Deductions</span>
                    </div>
                </div>
            </div>

            {/* Payroll Table */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state"><div className="loader"></div></div>
                    ) : employees.length === 0 ? (
                        <div className="empty-state">
                            <Receipt size={48} />
                            <p>No employees found</p>
                        </div>
                    ) : (
                        <div className="table-container desktop-table">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Employee</th>
                                        <th>Role</th>
                                        <th>Base Salary</th>
                                        <th>Bonus</th>
                                        <th>Deductions</th>
                                        <th>Net Pay</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => (
                                        <tr key={emp.id}>
                                            <td>
                                                <strong>{emp.displayName}</strong>
                                                <br />
                                                <small>{emp.email}</small>
                                            </td>
                                            <td>{emp.role}</td>
                                            <td>{formatCurrency(emp.baseSalary)}</td>
                                            <td>
                                                <span style={{ color: emp.bonus > 0 ? '#10b981' : 'inherit' }}>
                                                    {formatCurrency(emp.bonus)}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ color: emp.deductions > 0 ? '#ef4444' : 'inherit' }}>
                                                    {formatCurrency(emp.deductions)}
                                                </span>
                                            </td>
                                            <td>
                                                <strong>{formatCurrency(emp.netPay)}</strong>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleViewHistoryClick(emp)}
                                                        title="View Salary History"
                                                    >
                                                        <Calendar size={16} />
                                                    </button>

                                                    {hasPermission('payroll', 'edit') && !emp.processedToExpenses && (
                                                        <button
                                                            className="btn-icon"
                                                            onClick={() => handleEditClick(emp)}
                                                            title="Edit Details"
                                                        >
                                                            <Edit size={16} />
                                                        </button>
                                                    )}

                                                    {emp.processedToExpenses && (
                                                        <span className="badge badge-completed" title="Payment Processed" style={{ marginLeft: '4px' }}>
                                                            <CheckCircle size={14} style={{ marginRight: '4px' }} /> Paid
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}


                    {/* Mobile Cards */}
                    <div className="mobile-cards">
                        {employees.map(emp => (
                            <div key={emp.id} className="booking-card">
                                <div className="booking-card-header">
                                    <strong>{emp.displayName}</strong>
                                    <span className="badge badge-completed">{emp.role}</span>
                                </div>
                                <div className="booking-card-body">
                                    <p>Base: {formatCurrency(emp.baseSalary)}</p>
                                    <p style={{ color: '#10b981' }}>Bonus: {formatCurrency(emp.bonus)}</p>
                                    <p style={{ color: '#ef4444' }}>Deductions: {formatCurrency(emp.deductions)}</p>
                                    <p><strong>Net: {formatCurrency(emp.netPay)}</strong></p>
                                </div>
                                <div className="booking-card-footer">
                                    {emp.processedToExpenses && (
                                        <button className="btn btn-sm btn-success" disabled>
                                            <CheckCircle size={14} /> Paid
                                        </button>
                                    )}
                                    {hasPermission('payroll', 'edit') && (
                                        <button className="btn btn-sm btn-secondary" onClick={() => handleViewHistoryClick(emp)}>
                                            <Calendar size={14} />
                                        </button>
                                    )}
                                    {hasPermission('payroll', 'edit') && !emp.processedToExpenses && (
                                        <button className="btn btn-sm btn-primary" onClick={() => handleEditClick(emp)}>
                                            <Edit size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && selectedEmployee && (
                <div className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2><AlertCircle size={20} /> Confirm Payment Processing</h2>
                            <button className="modal-close" onClick={() => setShowConfirmModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '1rem' }}>
                                Process salary payment for <strong>{selectedEmployee.displayName}</strong> for <strong>{new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>?
                            </p>
                            <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Net Pay:</span>
                                    <strong>{formatCurrency(selectedEmployee.netPay)}</strong>
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                    Base: {formatCurrency(selectedEmployee.baseSalary)}
                                    {selectedEmployee.bonus > 0 && ` + Bonus: ${formatCurrency(selectedEmployee.bonus)}`}
                                    {selectedEmployee.deductions > 0 && ` - Ded: ${formatCurrency(selectedEmployee.deductions)}`}
                                </div>
                            </div>
                            <p style={{ color: '#666', fontSize: '0.9rem' }}>
                                This will add an expense record and mark the salary as paid.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={processEmployeeSalary}
                                disabled={processing}
                            >
                                {processing ? 'Processing...' : 'Confirm & Pay'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payroll Edit Modal */}
            {showPayrollModal && selectedEmployee && (
                <PayrollModal
                    employee={selectedEmployee}
                    month={month}
                    onClose={() => setShowPayrollModal(false)}
                    onSuccess={() => {
                        setShowPayrollModal(false);
                        fetchPayrollData();
                    }}
                />
            )}

            {/* Manual Payroll Entry Modal */}
            {showManualEntryModal && selectedEmployee && (
                <ManualPayrollModal
                    employee={selectedEmployee}
                    initialMonth={month}
                    onClose={() => setShowManualEntryModal(false)}
                    onSuccess={() => {
                        setShowManualEntryModal(false);
                        fetchPayrollData();
                    }}
                />
            )}

            {/* Employee History Modal */}
            {showHistoryModal && selectedEmployee && (
                <EmployeePayrollHistoryModal
                    employee={selectedEmployee}
                    onClose={() => setShowHistoryModal(false)}
                    onManualEntry={() => {
                        setShowHistoryModal(false);
                        setShowManualEntryModal(true);
                    }}
                    hasEditPermission={hasPermission('payroll', 'edit')}
                />
            )}

            <style>{`
                .process-salary-section {
                    margin-bottom: 1.5rem;
                }
                .btn-success {
                    background-color: #10b981;
                    color: white;
                }
                .btn-success:hover {
                    background-color: #059669;
                }
            `}</style>
        </div>
    );
};

const PayrollModal = ({ employee, month, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        baseSalary: employee.baseSalary,
        bonus: employee.bonus,
        deductions: employee.deductions,
        notes: employee.notes || ''
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const data = {
                employeeId: employee.id,
                month: month,
                baseSalary: Number(formData.baseSalary) || 0,
                bonus: Number(formData.bonus) || 0,
                deductions: Number(formData.deductions) || 0,
                notes: formData.notes || '',
                netPay: Number(formData.baseSalary) + Number(formData.bonus) - Number(formData.deductions),
                updatedAt: serverTimestamp()
            };

            if (employee.payrollId) {
                await updateDoc(doc(db, 'payroll', employee.payrollId), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'payroll'), data);
            }

            onSuccess();
        } catch (error) {
            console.error('Error saving payroll:', error);
            alert('Error saving payroll. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const netPay = Number(formData.baseSalary) + Number(formData.bonus) - Number(formData.deductions);

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Edit size={20} /> Edit Payroll</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--navy-50)', borderRadius: '8px' }}>
                            <strong>{employee.displayName}</strong>
                            <div style={{ fontSize: '0.85rem', color: 'var(--navy-500)' }}>
                                {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Base Salary</label>
                            <input
                                type="number"
                                name="baseSalary"
                                value={formData.baseSalary}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Bonus</label>
                                <input
                                    type="number"
                                    name="bonus"
                                    value={formData.bonus}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Deductions</label>
                                <input
                                    type="number"
                                    name="deductions"
                                    value={formData.deductions}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Notes</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Reason for bonus/deduction..."
                            ></textarea>
                        </div>

                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: '500' }}>Net Pay:</span>
                            <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#166534' }}>
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(netPay)}
                            </span>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EmployeePayrollHistoryModal = ({ employee, onClose, onManualEntry, hasEditPermission }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const q = query(
                    collection(db, 'payroll'),
                    where('employeeId', '==', employee.id),
                    orderBy('month', 'desc')
                );
                const snapshot = await getDocs(q);
                setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error('Error fetching history:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [employee.id]);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const totalEarnings = history.reduce((sum, record) => sum + (record.netPay || 0), 0);

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><Receipt size={20} /> Payroll History</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{employee.displayName}</h3>
                            <p style={{ color: 'var(--navy-500)' }}>{employee.role}</p>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--navy-500)' }}>Total Earnings</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--primary)' }}>
                                    {formatCurrency(totalEarnings)}
                                </div>
                            </div>
                            {hasEditPermission && (
                                <button
                                    className="btn btn-primary"
                                    onClick={onManualEntry}
                                    style={{ height: 'fit-content' }}
                                >
                                    <Calculator size={18} style={{ marginRight: '0.5rem' }} />
                                    Add Manual Entry
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="loader" style={{ margin: '2rem auto' }}></div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <p>No payroll history found</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th>Base</th>
                                        <th>Bonus</th>
                                        <th>Deductions</th>
                                        <th>Net Pay</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(record => (
                                        <tr key={record.id}>
                                            <td>
                                                {new Date(record.month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                            </td>
                                            <td>{formatCurrency(record.baseSalary)}</td>
                                            <td style={{ color: record.bonus > 0 ? '#10b981' : 'inherit' }}>
                                                {formatCurrency(record.bonus)}
                                            </td>
                                            <td style={{ color: record.deductions > 0 ? '#ef4444' : 'inherit' }}>
                                                {formatCurrency(record.deductions)}
                                            </td>
                                            <td><strong>{formatCurrency(record.netPay)}</strong></td>
                                            <td>
                                                {record.processedToExpenses ? (
                                                    <span className="badge badge-completed">Paid</span>
                                                ) : (
                                                    <span className="badge badge-pending">Pending</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

const ManualPayrollModal = ({ employee, initialMonth, onClose, onSuccess }) => {
    const [selectedMonth, setSelectedMonth] = useState(initialMonth);
    const [attendanceStats, setAttendanceStats] = useState({
        present: 0,
        absent: 0,
        halfDay: 0,
        paidLeave: 0,
        unpaidLeave: 0,
        overtime: 0,
        overtimeHours: 0,
        totalDays: 0
    });
    const [loadingStats, setLoadingStats] = useState(false);
    const [formData, setFormData] = useState({
        baseSalary: employee.baseSalary,
        bonus: 0,
        deductions: 0,
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchAttendanceStats();
    }, [selectedMonth, employee.id]);

    const fetchAttendanceStats = async () => {
        setLoadingStats(true);
        try {
            const year = parseInt(selectedMonth.split('-')[0]);
            const month = parseInt(selectedMonth.split('-')[1]) - 1; // 0-indexed

            // Calculate start and end date for the month
            const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const q = query(
                collection(db, 'attendance'),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );

            const snapshot = await getDocs(q);
            const empAttendance = snapshot.docs
                .map(doc => doc.data())
                .filter(doc => doc.userId === employee.id);

            const stats = {
                present: empAttendance.filter(a => a.status === 'present').length,
                absent: empAttendance.filter(a => a.status === 'absent').length,
                halfDay: empAttendance.filter(a => a.status === 'half-day').length,
                leave: empAttendance.filter(a => a.status === 'leave').length,
                totalDays: lastDay
            };
            setAttendanceStats(stats);

            // Check if there's already a payroll record for this month to pre-fill
            // Note: The parent component passes 'employee' which might have data for the *viewed* month, 
            // but if user changes month in this modal, we might want to fetch that month's payroll.
            // For simplicity, we stick to entering new data or editing if we add that logic, 
            // but the requirement implies "entering" a record.
        } catch (error) {
            console.error("Error fetching attendance:", error);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            // 1. Calculate Net Pay
            const netPay = Number(formData.baseSalary) + Number(formData.bonus) - Number(formData.deductions);
            const monthName = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            // 2. Create Payroll Record
            // Check if exists first to update or create
            const payrollRef = collection(db, 'payroll');
            const q = query(payrollRef, where('employeeId', '==', employee.id), where('month', '==', selectedMonth));
            const snapshot = await getDocs(q);

            let payrollId;
            const payrollData = {
                employeeId: employee.id,
                month: selectedMonth,
                baseSalary: Number(formData.baseSalary),
                bonus: Number(formData.bonus),
                deductions: Number(formData.deductions),
                notes: formData.notes,
                netPay: netPay,
                processedToExpenses: true, // Auto-mark as processed for manual entry
                processedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            if (!snapshot.empty) {
                const docId = snapshot.docs[0].id;
                await updateDoc(doc(db, 'payroll', docId), payrollData);
                payrollId = docId;
            } else {
                payrollData.createdAt = serverTimestamp();
                const docRef = await addDoc(payrollRef, payrollData);
                payrollId = docRef.id;
            }

            // 3. Create Expense Entry
            await addDoc(collection(db, 'expenses'), {
                title: `Salary - ${employee.displayName} (${monthName})`,
                amount: netPay,
                category: 'salary',
                date: new Date().toISOString().split('T')[0],
                paymentMode: 'bank_transfer', // Default or add selector
                note: `Manual Entry. Base: ${formData.baseSalary}, Bonus: ${formData.bonus}, Ded: ${formData.deductions}. ${formData.notes}`,
                employeeId: employee.id,
                payrollId: payrollId,
                month: selectedMonth,
                isAutoGenerated: true,
                createdAt: serverTimestamp()
            });

            onSuccess();
        } catch (error) {
            console.error('Error submitting manual payroll:', error);
            alert('Failed to submit payroll. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const netPay = Number(formData.baseSalary) + Number(formData.bonus) - Number(formData.deductions);

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><Calculator size={20} /> Manual Payroll Entry</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Header Info */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', marginBottom: '1.5rem' }}>
                            <div>
                                <h3 style={{ margin: 0 }}>{employee.displayName}</h3>
                                <p style={{ color: 'var(--navy-500)', fontSize: '0.9rem' }}>{employee.role}</p>
                            </div>
                            <div>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="filter-select"
                                    required
                                />
                            </div>
                        </div>

                        {/* Attendance Summary Panel */}
                        <div style={{
                            background: 'var(--navy-50)',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            marginBottom: '1.5rem',
                            border: '1px solid var(--navy-100)'
                        }}>
                            <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Calendar size={16} /> Attendance Summary ({selectedMonth})
                            </h4>
                            {loadingStats ? (
                                <div className="loader is-small"></div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem' }}>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{attendanceStats.present}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Present</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>{attendanceStats.absent}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Absent</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{attendanceStats.halfDay}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Half-day</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>{attendanceStats.paidLeave}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Paid Leave</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fca5a5' }}>{attendanceStats.unpaidLeave}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Unpaid Leave</div>
                                    </div>
                                    <div className="stat-item" style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#8b5cf6' }}>{attendanceStats.overtimeHours}h</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>Overtime</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Salary Inputs */}
                        <div style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '8px' }}>
                            <div className="form-group">
                                <label>Base Salary</label>
                                <input
                                    type="number"
                                    name="baseSalary"
                                    value={formData.baseSalary}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Bonus</label>
                                    <input
                                        type="number"
                                        name="bonus"
                                        value={formData.bonus}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Deductions</label>
                                    <input
                                        type="number"
                                        name="deductions"
                                        value={formData.deductions}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Notes</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    placeholder="Add notes about payment, overtime, etc..."
                                    rows="2"
                                ></textarea>
                            </div>
                        </div>

                        {/* Net Pay */}
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0fdf4', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontWeight: '500', display: 'block' }}>Net Pay</span>
                                <span style={{ fontSize: '0.8rem', color: '#666' }}>Amount to be paid</span>
                            </div>
                            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: '#166534' }}>
                                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(netPay)}
                            </span>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Processing...' : 'Confirm & Pay'}
                        </button>
                    </div>
                </form>
                <style>{`
                    .stat-card-mini {
                        padding: 0.75rem;
                        border-radius: 6px;
                        text-align: center;
                    }
                    .stat-card-mini .label {
                        font-size: 0.75rem;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 0.25rem;
                        opacity: 0.8;
                    }
                    .stat-card-mini .value {
                        font-size: 1.25rem;
                        font-weight: 700;
                    }
                `}</style>
            </div>
        </div>
    );
};

export default Payroll;
