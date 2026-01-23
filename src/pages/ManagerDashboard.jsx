import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit
} from 'firebase/firestore';
import {
    ClipboardList,
    CheckCircle,
    Clock,
    Users,
    Package,
    AlertTriangle,
    Calendar,
    Briefcase
} from 'lucide-react';
import { Link } from 'react-router-dom';

const ManagerDashboard = () => {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        pending: 0,
        confirmed: 0,
        inProgress: 0,
        completed: 0,
        staffPresent: 0,
        totalStaff: 0
    });
    const [todaysBookings, setTodaysBookings] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [staffAttendance, setStaffAttendance] = useState([]);

    useEffect(() => {
        fetchManagerData();
    }, []);

    const fetchManagerData = async () => {
        try {
            setLoading(true);
            const todayStr = new Date().toISOString().split('T')[0];

            // 1. Fetch Today's Bookings
            const bookingsRef = collection(db, 'bookings');
            const todayQuery = query(bookingsRef, where('bookingDate', '==', todayStr));
            const todaySnapshot = await getDocs(todayQuery);
            const bookings = todaySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            let pending = 0, confirmed = 0, inProgress = 0, completed = 0;
            bookings.forEach(b => {
                if (b.status === 'pending_confirmation') pending++;
                else if (b.status === 'confirmed') confirmed++;
                else if (b.status === 'in_progress') inProgress++;
                else if (b.status === 'completed') completed++;
            });

            setTodaysBookings(bookings.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));

            // 2. Fetch Staff Attendance Today
            const attendanceRef = collection(db, 'attendance');
            const attendanceQuery = query(attendanceRef, where('date', '==', todayStr));
            const attSnapshot = await getDocs(attendanceQuery);
            const attendanceRecords = attSnapshot.docs.map(d => d.data());

            // Fetch total active employees
            const usersRef = collection(db, 'adminUsers');
            const usersSnapshot = await getDocs(query(usersRef, where('role', '==', 'employee'), where('status', '==', 'approved')));
            const totalStaff = usersSnapshot.size;
            const staffPresent = attendanceRecords.filter(a => a.status === 'present' || a.status === 'half-day').length;

            setStaffAttendance(attendanceRecords);

            // 3. Low Stock Items
            try {
                const materialsRef = collection(db, 'materials');
                const matSnapshot = await getDocs(materialsRef);
                const lowStock = matSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(m => m.isActive && m.currentStock <= (m.reorderLevel || 10))
                    .slice(0, 5);
                setLowStockItems(lowStock);
            } catch (e) {
                console.log('Materials error', e);
            }

            setStats({
                pending, confirmed, inProgress, completed,
                staffPresent,
                totalStaff
            });

        } catch (error) {
            console.error("Error fetching manager dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const badges = {
            'pending_confirmation': { class: 'badge-pending', label: 'Pending' },
            'confirmed': { class: 'badge-confirmed', label: 'Confirmed' },
            'in_progress': { class: 'badge-progress', label: 'In Progress' },
            'completed': { class: 'badge-completed', label: 'Completed' },
            'cancelled': { class: 'badge-cancelled', label: 'Cancelled' }
        };
        return badges[status] || { class: 'badge-pending', label: status };
    };

    if (loading) return <div className="p-4">Loading dashboard...</div>;

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div>
                    <h1>Manager Dashboard</h1>
                    <p className="subtitle">Operational Overview for {new Date().toLocaleDateString()}</p>
                </div>
                <div className="action-buttons" style={{ display: 'flex', gap: '1rem' }}>
                    <Link to="/bookings" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '6px', background: 'var(--primary)' }}>
                        <ClipboardList size={18} /> Manage Bookings
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="stats-grid-compact">
                <div className="stat-card-compact orange">
                    <div className="stat-icon-sm"><ClipboardList size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.pending}</span>
                        <span className="stat-text">Pending</span>
                    </div>
                </div>
                <div className="stat-card-compact blue">
                    <div className="stat-icon-sm"><Clock size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.inProgress}</span>
                        <span className="stat-text">In Progress</span>
                    </div>
                </div>
                <div className="stat-card-compact green">
                    <div className="stat-icon-sm"><Users size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.staffPresent} / {stats.totalStaff}</span>
                        <span className="stat-text">Staff Present</span>
                    </div>
                </div>
                <div className="stat-card-compact pink">
                    <div className="stat-icon-sm"><AlertTriangle size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{lowStockItems.length}</span>
                        <span className="stat-text">Low Stock</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
                {/* Today's Schedule */}
                <div className="dashboard-widget">
                    <div className="widget-header">
                        <h3><Calendar size={18} /> Today's Operations</h3>
                        <Link to="/bookings" className="view-all-link">View All</Link>
                    </div>
                    {todaysBookings.length === 0 ? (
                        <div className="empty-widget">
                            <Clock size={24} />
                            <p>No bookings today</p>
                        </div>
                    ) : (
                        <div className="schedule-list">
                            {todaysBookings.map(booking => (
                                <div key={booking.id} className="schedule-item">
                                    <div className="schedule-time">{booking.startTime}</div>
                                    <div className="schedule-info">
                                        <strong>{booking.serviceName}</strong>
                                        <span>{booking.vehicleType} • {booking.licensePlate}</span>
                                    </div>
                                    <span className={`badge-sm ${getStatusBadge(booking.status).class}`}>
                                        {getStatusBadge(booking.status).label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Low Stock & Staff Check */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Low Stock Widget */}
                    {lowStockItems.length > 0 && (
                        <div className="dashboard-widget alert-widget">
                            <div className="widget-header">
                                <h3><AlertTriangle size={18} /> Inventory Alerts</h3>
                                <Link to="/materials" className="view-all-link">Manage</Link>
                            </div>
                            <div className="alert-list">
                                {lowStockItems.map(item => (
                                    <div key={item.id} className="alert-item">
                                        <Package size={16} />
                                        <div className="alert-info">
                                            <strong>{item.name}</strong>
                                            <span className="text-danger">{item.currentStock} {item.unit} left</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quick Staff View */}
                    <div className="dashboard-widget">
                        <div className="widget-header">
                            <h3><Users size={18} /> Staff Attendance</h3>
                            <Link to="/attendance" className="view-all-link">View Full</Link>
                        </div>
                        <div className="schedule-list">
                            <div className="attendance-summary" style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span>Total Staff:</span> <strong>{stats.totalStaff}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Present Today:</span> <strong className="text-success">{stats.staffPresent}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                /* Reusing dashboard styles + specific tweaks */
                .text-success { color: var(--success); }
                .text-danger { color: var(--danger); }
            `}</style>
        </div>
    );
};

export default ManagerDashboard;
