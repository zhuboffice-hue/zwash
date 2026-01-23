import { useState, useEffect } from 'react';
import { useAuth, ROLES, PERMISSIONS } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { logAction } from '../utils/logger';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import {
    UserCog,
    Plus,
    Search,
    Mail,
    Phone,
    Star,
    Check,
    X,
    Clock,
    Eye,
    Edit,
    Trash2,
    AlertTriangle
} from 'lucide-react';

const Employees = () => {
    const { hasPermission, isAdmin, userProfile } = useAuth();
    const canCreate = hasPermission('employees', 'create');
    const canEdit = hasPermission('employees', 'edit');
    const canDelete = hasPermission('employees', 'delete');

    const [employees, setEmployees] = useState([]);
    const [pendingUsers, setPendingUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            setLoading(true);

            // Fetch approved employees
            const usersRef = collection(db, 'adminUsers');
            const approvedQuery = query(usersRef, where('status', '==', 'approved'));
            const approvedSnapshot = await getDocs(approvedQuery);
            const approved = approvedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Fetch pending users for admin/manager
            if (isAdmin || canEdit) {
                const pendingQuery = query(usersRef, where('status', '==', 'pending'));
                const pendingSnapshot = await getDocs(pendingQuery);
                const pending = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setPendingUsers(pending);
            }

            setEmployees(approved);
        } catch (error) {
            console.error('Error fetching employees:', error);
        } finally {
            setLoading(false);
        }
    };

    const approveUser = async (userId, role) => {
        try {
            await updateDoc(doc(db, 'adminUsers', userId), {
                status: 'approved',
                role: role,
                approvedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            await logAction(userProfile, 'update', 'employees', `Approved user with role ${role}`, { userId, role });
            fetchEmployees();
        } catch (error) {
            console.error('Error approving user:', error);
        }
    };

    const rejectUser = async (userId) => {
        if (!window.confirm('Reject this user?')) return;
        try {
            await updateDoc(doc(db, 'adminUsers', userId), {
                status: 'rejected',
                updatedAt: serverTimestamp()
            });
            await logAction(userProfile, 'update', 'employees', `Rejected user registration`, { userId });
            fetchEmployees();
        } catch (error) {
            console.error('Error rejecting user:', error);
        }
    };

    const deleteUser = async (userId, userName) => {
        if (!window.confirm(`Are you sure you want to permanently delete "${userName}"? This action cannot be undone.`)) return;
        try {
            await deleteDoc(doc(db, 'adminUsers', userId));
            await logAction(userProfile, 'delete', 'employees', `Deleted employee: ${userName}`, { userId, userName });
            fetchEmployees();
            alert('User deleted successfully');
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Error deleting user. Please try again.');
        }
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = !searchTerm ||
            emp.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filter === 'all' || emp.role === filter;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="employees-page">
            <div className="page-header">
                <div>
                    <h1><UserCog size={28} /> Employees</h1>
                    <p className="subtitle">Manage team members and access</p>
                </div>
                <div className="header-actions">
                    {canCreate && (
                        <button className="btn btn-primary" onClick={() => setShowInviteModal(true)}>
                            <Plus size={18} /> Invite Employee
                        </button>
                    )}
                </div>
            </div>

            {/* Pending Approvals */}
            {(isAdmin || canEdit) && pendingUsers.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
                    <div className="card-header">
                        <h3>Pending Approvals ({pendingUsers.length})</h3>
                    </div>
                    <div className="card-body">
                        {pendingUsers.map(user => (
                            <div key={user.id} className="pending-user-item">
                                <div className="user-info-row">
                                    {user.photoURL && <img src={user.photoURL} alt="" className="user-thumb" />}
                                    <div className="user-details">
                                        <strong>{user.displayName || 'No Name'}</strong>
                                        <span className="user-email">{user.email}</span>
                                        {user.phone && <span className="user-phone"><Phone size={12} /> {user.phone}</span>}
                                    </div>
                                </div>
                                <div className="pending-actions">
                                    <select
                                        className="role-select"
                                        defaultValue={ROLES.EMPLOYEE}
                                        id={`role-${user.id}`}
                                    >
                                        <option value={ROLES.EMPLOYEE}>Employee</option>
                                        <option value={ROLES.SENIOR_EMPLOYEE}>Senior Employee</option>
                                        <option value={ROLES.MANAGER}>Manager</option>
                                        <option value={ROLES.ADMIN}>Admin</option>
                                    </select>
                                    <button
                                        className="btn btn-sm btn-success"
                                        onClick={() => {
                                            const role = document.getElementById(`role-${user.id}`).value;
                                            approveUser(user.id, role);
                                        }}
                                    >
                                        <Check size={14} /> Approve
                                    </button>
                                    <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => rejectUser(user.id)}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <UserCog size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{employees.length}</span>
                        <span className="stat-label">Total Employees</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Star size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{employees.filter(e => e.role === ROLES.SENIOR_EMPLOYEE).length}</span>
                        <span className="stat-label">Senior Employees</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <UserCog size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{employees.filter(e => e.role === ROLES.MANAGER).length}</span>
                        <span className="stat-label">Managers</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{pendingUsers.length}</span>
                        <span className="stat-label">Pending</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="search-filter-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search employees..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="filter-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    <option value="all">All Roles</option>
                    <option value={ROLES.ADMIN}>Admin</option>
                    <option value={ROLES.MANAGER}>Manager</option>
                    <option value={ROLES.SENIOR_EMPLOYEE}>Senior Employee</option>
                    <option value={ROLES.EMPLOYEE}>Employee</option>
                </select>
            </div>

            {/* Employees Grid */}
            <div className="employees-grid">
                {loading ? (
                    <div className="empty-state">
                        <div className="loader"></div>
                    </div>
                ) : filteredEmployees.length === 0 ? (
                    <div className="empty-state">
                        <UserCog size={48} />
                        <p>No employees found</p>
                    </div>
                ) : (
                    filteredEmployees.map(employee => (
                        <div key={employee.id} className="employee-card">
                            <div className="employee-card-header">
                                {employee.photoURL ? (
                                    <img src={employee.photoURL} alt="" className="employee-avatar" />
                                ) : (
                                    <div className="employee-avatar-placeholder">
                                        {employee.displayName?.charAt(0) || '?'}
                                    </div>
                                )}
                                <span className={`badge badge-${employee.role}`}>{employee.role}</span>
                            </div>
                            <div className="employee-card-body">
                                <h3>{employee.displayName}</h3>
                                <p><Mail size={14} /> {employee.email}</p>
                                {employee.phone && <p><Phone size={14} /> {employee.phone}</p>}
                            </div>
                            <div className="employee-card-footer">
                                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedEmployee(employee)}>
                                    <Eye size={14} /> View
                                </button>
                                {canEdit && (
                                    <button className="btn btn-sm btn-primary" onClick={() => setSelectedEmployee(employee)}>
                                        <Edit size={14} /> Edit Role
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Invite Modal */}
            {showInviteModal && (
                <InviteModal onClose={() => setShowInviteModal(false)} onSuccess={fetchEmployees} />
            )}

            {/* Employee Details Modal */}
            {selectedEmployee && (
                <EmployeeDetailsModal
                    employee={selectedEmployee}
                    onClose={() => setSelectedEmployee(null)}
                    isAdmin={isAdmin}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onUpdate={fetchEmployees}
                    onDelete={deleteUser}
                />
            )}

            <style>{`
        .employees-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1rem;
        }
        
        .employee-card {
          background: white;
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--navy-100);
        }
        
        .employee-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        
        .employee-avatar {
          width: 56px;
          height: 56px;
          border-radius: 50%;
        }
        
        .employee-avatar-placeholder {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--primary-light);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 600;
        }
        
        .badge-admin { background: #e9d5ff; color: #7c3aed; }
        .badge-manager { background: #dbeafe; color: #2563eb; }
        .badge-senior_employee { background: #fef3c7; color: #d97706; }
        .badge-employee { background: #d1fae5; color: #059669; }
        
        .employee-card-body h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
        .employee-card-body p { 
          font-size: 0.875rem; 
          color: var(--navy-500); 
          margin: 0.25rem 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .employee-card-footer { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--navy-100); }
        
        .pending-user-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          background: var(--navy-50);
          border-radius: var(--radius-md);
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .user-info-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .user-thumb { width: 40px; height: 40px; border-radius: 50%; }
        .user-details { display: flex; flex-direction: column; }
        .user-email { font-size: 0.8rem; color: var(--navy-500); }
        .user-phone { font-size: 0.8rem; color: var(--navy-500); display: flex; align-items: center; gap: 0.25rem; }
        
        .pending-actions { display: flex; align-items: center; gap: 0.5rem; }
        .role-select { 
          padding: 0.375rem 0.5rem; 
          border: 1px solid var(--navy-200); 
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
        }
        
        @media (max-width: 768px) {
          .employees-grid {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }
          
          .employee-card {
            padding: 1rem;
          }
          
          .employee-avatar,
          .employee-avatar-placeholder {
            width: 48px;
            height: 48px;
            font-size: 1.25rem;
          }
          
          .employee-card-footer {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap; /* Added: allow wrapping if needed */
          }
          
          .employee-card-footer .btn {
            flex: 1;
            justify-content: center;
            padding: 0.625rem 0.5rem;
            font-size: 0.8rem;
            min-width: 0; /* Added: prevent overflow */
            white-space: nowrap;
          }

          .employee-card-body h3 {
            font-size: 1rem;
          }
          
          .employee-card-body p {
            font-size: 0.8rem;
          }
          
          .employee-card-footer {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap; /* Added: allow wrapping if needed */
          }
          
          .employee-card-footer .btn {
            flex: 1;
            justify-content: center;
            padding: 0.625rem 0.5rem;
            font-size: 0.8rem;
            min-width: 0; /* Added: prevent overflow */
            white-space: nowrap;
          }
          
          .pending-user-item {
            flex-direction: column;
            align-items: stretch;
            gap: 0.75rem;
          }
          
          .pending-actions {
            width: 100%;
            justify-content: flex-end;
          }
        }
        
        /* Delete Confirmation Styles */
        .delete-confirm-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-lg);
          z-index: 10;
        }
        
        .delete-confirm-box {
          background: white;
          padding: 2rem;
          border-radius: var(--radius-lg);
          text-align: center;
          max-width: 320px;
          box-shadow: var(--shadow-xl);
        }
        
        .delete-confirm-box h3 {
          margin: 1rem 0 0.5rem;
          color: var(--navy-800);
        }
        
        .delete-confirm-box p {
          color: var(--navy-600);
          font-size: 0.9rem;
          margin-bottom: 0.5rem;
        }
        
        .delete-confirm-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 1.5rem;
          justify-content: center;
        }
        
        .btn-danger {
          background: #ef4444;
          color: white;
        }
        
        .btn-danger:hover {
          background: #dc2626;
        }
      `}</style>
        </div>
    );
};

const InviteModal = ({ onClose, onSuccess }) => {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [selectedRole, setSelectedRole] = useState(ROLES.EMPLOYEE);
    const [customPermissions, setCustomPermissions] = useState({});

    // Initialize permissions based on role
    useEffect(() => {
        const defaultPerms = PERMISSIONS[selectedRole] || {};
        setCustomPermissions(JSON.parse(JSON.stringify(defaultPerms)));
    }, [selectedRole]);

    const handlePermissionChange = (resource, action, value) => {
        setCustomPermissions(prev => {
            const next = { ...prev };

            if (action === null) {
                // Boolean permission
                next[resource] = value;
            } else {
                // Object permission
                if (typeof next[resource] !== 'object') {
                    next[resource] = {};
                }
                next[resource][action] = value;
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const form = e.target;
        const formData = new FormData(form);
        const email = formData.get('email').toLowerCase();

        try {
            await addDoc(collection(db, 'employeeInvites'), {
                email: email,
                role: selectedRole, // Use state instead of form data for consistency
                permissions: customPermissions, // Save custom permissions
                invitedBy: userProfile?.email,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            await logAction(userProfile, 'create', 'employees', `Invited user: ${email}`, { email, role: selectedRole });

            alert(`Invitation sent to ${email}`);
            onClose();
        } catch (error) {
            console.error('Error sending invite:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderPermissionToggle = (resource, label) => {
        const perms = customPermissions[resource];

        // If undefined in current role standard, assume false/empty but allow enabling?
        // Better to use ADMIN permissions as the "available" set
        const availableOptions = PERMISSIONS[ROLES.ADMIN][resource];

        if (availableOptions === undefined) return null;

        const isBoolean = typeof availableOptions === 'boolean';

        return (
            <div className="permission-item" key={resource} style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <strong>{label}</strong>
                    {isBoolean && (
                        <input
                            type="checkbox"
                            checked={perms === true}
                            onChange={(e) => handlePermissionChange(resource, null, e.target.checked)}
                        />
                    )}
                </div>

                {!isBoolean && (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {Object.keys(availableOptions).map(action => (
                            <label key={action} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}>
                                <input
                                    type="checkbox"
                                    checked={perms?.[action] === true}
                                    onChange={(e) => handlePermissionChange(resource, action, e.target.checked)}
                                />
                                {action.charAt(0).toUpperCase() + action.slice(1)}
                            </label>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Mail size={20} /> Invite Employee</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <div className="form-group">
                            <label>Email Address *</label>
                            <input name="email" type="email" required placeholder="employee@example.com" />
                        </div>
                        <div className="form-group">
                            <label>Role *</label>
                            <select
                                name="role"
                                required
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                            >
                                <option value={ROLES.EMPLOYEE}>Employee</option>
                                <option value={ROLES.SENIOR_EMPLOYEE}>Senior Employee</option>
                                <option value={ROLES.MANAGER}>Manager</option>
                                <option value={ROLES.ADMIN}>Admin</option>
                            </select>
                        </div>

                        <div className="permissions-section" style={{ marginTop: '1.5rem' }}>
                            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Customize Permissions</h3>
                            {renderPermissionToggle('dashboard', 'Dashboard')}
                            {renderPermissionToggle('bookings', 'Bookings')}
                            {renderPermissionToggle('services', 'Services')}
                            {renderPermissionToggle('customers', 'Customers')}
                            {renderPermissionToggle('employees', 'Employees')}
                            {renderPermissionToggle('invoices', 'Invoices')}
                            {renderPermissionToggle('expenses', 'Expenses')}
                            {renderPermissionToggle('payroll', 'Payroll')}
                            {renderPermissionToggle('attendance', 'Attendance')}
                            {renderPermissionToggle('analytics', 'Analytics')}
                            {renderPermissionToggle('settings', 'Settings')}
                        </div>

                        <div className="alert alert-info">
                            The invited user will be able to sign in and complete their profile. You'll need to approve them before they can access the system.
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EmployeeDetailsModal = ({ employee, onClose, isAdmin, canEdit, canDelete, onUpdate, onDelete }) => {
    const [role, setRole] = useState(employee.role);
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');

    // Additional employee details
    const [address, setAddress] = useState(employee.address || '');
    const [emergencyContact, setEmergencyContact] = useState(employee.emergencyContact || '');
    const [dateOfJoining, setDateOfJoining] = useState(employee.dateOfJoining || '');

    // KPI Stats
    const [kpiStats, setKpiStats] = useState({ totalBookings: 0, thisMonth: 0, completedServices: 0 });
    const [attendanceRecords, setAttendanceRecords] = useState([]);
    const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, late: 0 });
    const [payrollData, setPayrollData] = useState(null);
    const [loadingData, setLoadingData] = useState(false);

    useEffect(() => {
        if (activeTab === 'overview') fetchKPIs();
        if (activeTab === 'attendance') fetchAttendance();
        if (activeTab === 'payroll' && isAdmin) fetchPayroll();
    }, [activeTab]);

    const fetchKPIs = async () => {
        setLoadingData(true);
        try {
            const bookingsQuery = query(
                collection(db, 'bookings'),
                where('createdBy', '==', employee.id)
            );
            const snapshot = await getDocs(bookingsQuery);
            const bookings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            const thisMonth = new Date().toISOString().slice(0, 7);
            const thisMonthBookings = bookings.filter(b => b.bookingDate?.startsWith(thisMonth));
            const completed = bookings.filter(b => b.status === 'completed');

            setKpiStats({
                totalBookings: bookings.length,
                thisMonth: thisMonthBookings.length,
                completedServices: completed.length
            });
        } catch (error) {
            console.error('Error fetching KPIs:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchAttendance = async () => {
        setLoadingData(true);
        try {
            const attendanceQuery = query(
                collection(db, 'attendance'),
                where('userId', '==', employee.id),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(attendanceQuery);
            const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setAttendanceRecords(records.slice(0, 30)); // Last 30 records

            const present = records.filter(r => r.status === 'present' || r.checkIn).length;
            const absent = records.filter(r => r.status === 'absent').length;
            const late = records.filter(r => r.isLate).length;
            setAttendanceStats({ present, absent, late });
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const fetchPayroll = async () => {
        setLoadingData(true);
        try {
            const payrollQuery = query(
                collection(db, 'payroll'),
                where('employeeId', '==', employee.id)
            );
            const snapshot = await getDocs(payrollQuery);
            if (!snapshot.empty) {
                setPayrollData(snapshot.docs[0].data());
            }
        } catch (error) {
            console.error('Error fetching payroll:', error);
        } finally {
            setLoadingData(false);
        }
    };

    const updateEmployeeDetails = async () => {
        setLoading(true);
        try {
            await updateDoc(doc(db, 'adminUsers', employee.id), {
                role: role,
                address: address,
                emergencyContact: emergencyContact,
                dateOfJoining: dateOfJoining,
                updatedAt: serverTimestamp()
            });
            onUpdate();
            onClose();
        } catch (error) {
            console.error('Error updating employee:', error);
            alert('Error updating employee details');
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '-';
        if (timestamp.toDate) return timestamp.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        return new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date) => {
        if (!date) return '-';
        return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg" style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                <div className="modal-header">
                    <h2>Employee Details</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>

                {/* Employee Header */}
                <div style={{ padding: '1rem 1.5rem', background: 'var(--navy-50)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {employee.photoURL ? (
                        <img src={employee.photoURL} alt="" style={{ width: 60, height: 60, borderRadius: '50%' }} />
                    ) : (
                        <div style={{
                            width: 60, height: 60, borderRadius: '50%',
                            background: 'var(--primary)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.5rem', fontWeight: 600
                        }}>
                            {employee.displayName?.charAt(0) || '?'}
                        </div>
                    )}
                    <div>
                        <h3 style={{ margin: 0 }}>{employee.displayName}</h3>
                        <p style={{ margin: 0, color: 'var(--navy-500)', fontSize: '0.85rem' }}>
                            <Mail size={12} /> {employee.email}
                        </p>
                        <span className={`badge badge-${employee.role}`} style={{ marginTop: '0.25rem' }}>
                            {employee.role?.replace('_', ' ').toUpperCase()}
                        </span>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--navy-100)', padding: '0 1rem' }}>
                    {['overview', 'attendance', ...(isAdmin ? ['payroll'] : [])].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '0.75rem 1.5rem',
                                border: 'none',
                                background: 'transparent',
                                borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent',
                                color: activeTab === tab ? 'var(--primary)' : 'var(--navy-500)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                textTransform: 'capitalize'
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', minHeight: '300px' }}>
                    {loadingData && <div className="loader" style={{ margin: '2rem auto' }}></div>}

                    {/* Overview Tab */}
                    {activeTab === 'overview' && !loadingData && (
                        <div>
                            {/* KPI Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary)' }}>{kpiStats.totalBookings}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Total Bookings</div>
                                </div>
                                <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--success)' }}>{kpiStats.thisMonth}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>This Month</div>
                                </div>
                                <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#10b981' }}>{kpiStats.completedServices}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Completed</div>
                                </div>
                            </div>

                            {/* Contact Info */}
                            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
                                <p><Mail size={16} /> {employee.email}</p>
                                {employee.phone && <p><Phone size={16} /> {employee.phone}</p>}
                            </div>

                            {/* Editable Fields (Admin/Manager) */}
                            {canEdit && (
                                <>
                                    <div className="form-group">
                                        <label>Role</label>
                                        <select value={role} onChange={(e) => setRole(e.target.value)}>
                                            <option value={ROLES.EMPLOYEE}>Employee</option>
                                            <option value={ROLES.SENIOR_EMPLOYEE}>Senior Employee</option>
                                            <option value={ROLES.MANAGER}>Manager</option>
                                            <option value={ROLES.ADMIN}>Admin</option>
                                        </select>
                                    </div>
                                    <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', marginTop: '1rem' }}>
                                        <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem' }}>Additional Details</h4>
                                        <div className="form-group" style={{ margin: '0 0 0.5rem' }}>
                                            <label style={{ fontSize: '0.75rem' }}>Address</label>
                                            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Employee address..." />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.75rem' }}>Emergency Contact</label>
                                                <input type="text" value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} placeholder="Phone..." />
                                            </div>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label style={{ fontSize: '0.75rem' }}>Date of Joining</label>
                                                <input type="date" value={dateOfJoining} onChange={(e) => setDateOfJoining(e.target.value)} />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Attendance Tab */}
                    {activeTab === 'attendance' && !loadingData && (
                        <div>
                            {/* Attendance Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ padding: '1rem', background: '#dcfce7', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#16a34a' }}>{attendanceStats.present}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#166534' }}>Present</div>
                                </div>
                                <div style={{ padding: '1rem', background: '#fee2e2', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#dc2626' }}>{attendanceStats.absent}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Absent</div>
                                </div>
                                <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#d97706' }}>{attendanceStats.late}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Late</div>
                                </div>
                            </div>

                            {/* Attendance History */}
                            {attendanceRecords.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--navy-400)' }}>No attendance records found</p>
                            ) : (
                                <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Check In</th>
                                                <th>Check Out</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attendanceRecords.map(record => (
                                                <tr key={record.id}>
                                                    <td>{record.date}</td>
                                                    <td>{formatTime(record.checkIn)}</td>
                                                    <td>{formatTime(record.checkOut)}</td>
                                                    <td>
                                                        <span className={`badge ${record.isLate ? 'badge-pending' : 'badge-confirmed'}`}>
                                                            {record.isLate ? 'Late' : 'On Time'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payroll Tab (Admin Only) */}
                    {activeTab === 'payroll' && isAdmin && !loadingData && (
                        <div>
                            {payrollData ? (
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    <div style={{ padding: '1.5rem', background: 'var(--navy-50)', borderRadius: '8px' }}>
                                        <h4 style={{ marginBottom: '1rem' }}>Salary Information</h4>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Base Salary</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>₹{payrollData.baseSalary?.toLocaleString() || 'N/A'}</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Last Paid</div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatDate(payrollData.lastPaidDate)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <p style={{ color: 'var(--navy-400)' }}>No payroll data available</p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--navy-400)' }}>Set up payroll in the Payroll section</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    {canDelete && (
                        <button
                            className="btn btn-danger"
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{ marginRight: 'auto' }}
                        >
                            <Trash2 size={16} /> Delete
                        </button>
                    )}
                    {canEdit && (
                        <button className="btn btn-primary" onClick={updateEmployeeDetails} disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>

                {/* Delete Confirmation */}
                {showDeleteConfirm && (
                    <div className="delete-confirm-overlay">
                        <div className="delete-confirm-box">
                            <AlertTriangle size={48} color="#ef4444" />
                            <h3>Delete Employee?</h3>
                            <p>Are you sure you want to permanently delete <strong>{employee.displayName}</strong>?</p>
                            <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>This action cannot be undone.</p>
                            <div className="delete-confirm-actions">
                                <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                                <button
                                    className="btn btn-danger"
                                    onClick={() => {
                                        onDelete(employee.id, employee.displayName);
                                        onClose();
                                    }}
                                >
                                    <Trash2 size={16} /> Delete Permanently
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Employees;
