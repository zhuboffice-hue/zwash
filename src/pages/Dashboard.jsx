import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
    Trophy,
    Users,
    Car,
    Star,
    DollarSign,
    AlertTriangle,
    Package,
    TrendingUp,
    Calendar
} from 'lucide-react';

const Dashboard = () => {
    const { userProfile, hasPermission } = useAuth();
    const [stats, setStats] = useState({
        pending: 0,
        confirmed: 0,
        inProgress: 0,
        completed: 0,
        todayRevenue: 0,
        totalCustomers: 0,
        activeServices: 0,
        avgRating: 4.5
    });
    const [recentBookings, setRecentBookings] = useState([]);
    const [todaySchedule, setTodaySchedule] = useState([]);
    const [weeklyRevenue, setWeeklyRevenue] = useState([]);
    const [lowStockItems, setLowStockItems] = useState([]);
    const [employeePerformance, setEmployeePerformance] = useState([]);
    const [loading, setLoading] = useState(true);
    const [comparison, setComparison] = useState({ revenue: 0, bookings: 0 });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayStr = today.toISOString().split('T')[0];

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // Fetch all bookings for stats
            const bookingsRef = collection(db, 'bookings');
            const allBookingsSnapshot = await getDocs(bookingsRef);
            const allBookings = allBookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // SUPER ADMIN FETCH LOGIC
            if (userProfile?.role === 'superadmin') {
                const usersRef = collection(db, 'adminUsers');
                const adminsQuery = query(usersRef, where('role', '==', 'admin'));
                const adminsSnapshot = await getDocs(adminsQuery);
                const admins = adminsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setStats({
                    uniqueShops: admins.length, // Assuming 1 Admin = 1 Shop for now
                    totalAdmins: admins.length,
                    totalBookingsCount: allBookings.length,
                    shopList: admins
                });
                setLoading(false);
                return; // Stop execution here for superadmin
            }

            // Today's stats
            const todayBookings = allBookings.filter(b => b.bookingDate === todayStr);
            let pending = 0, confirmed = 0, inProgress = 0, completed = 0, todayRevenue = 0;
            todayBookings.forEach(booking => {
                switch (booking.status) {
                    case 'pending_confirmation': pending++; break;
                    case 'confirmed': confirmed++; break;
                    case 'in_progress': inProgress++; break;
                    case 'completed':
                        completed++;
                        todayRevenue += booking.price || 0;
                        break;
                }
            });

            // Calculate weekly revenue (last 7 days)
            const weekData = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayBookings = allBookings.filter(b => b.bookingDate === dateStr && b.status === 'completed');
                const dayRevenue = dayBookings.reduce((sum, b) => sum + (b.price || 0), 0);
                weekData.push({
                    day: date.toLocaleDateString('en-US', { weekday: 'short' }),
                    date: dateStr,
                    revenue: dayRevenue,
                    bookings: dayBookings.length
                });
            }
            setWeeklyRevenue(weekData);

            // Yesterday comparison
            const yesterdayBookings = allBookings.filter(b => b.bookingDate === yesterdayStr);
            let yesterdayRevenue = 0;
            yesterdayBookings.forEach(b => {
                if (b.status === 'completed') yesterdayRevenue += b.price || 0;
            });
            const revenueChange = yesterdayRevenue > 0
                ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(1)
                : 0;

            // Today's schedule (confirmed + in_progress bookings sorted by time)
            const schedule = todayBookings
                .filter(b => ['confirmed', 'in_progress', 'pending_confirmation'].includes(b.status))
                .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
            setTodaySchedule(schedule.slice(0, 5));

            // Fetch customers and services
            const customersSnapshot = await getDocs(collection(db, 'customers'));
            const servicesQuery = query(collection(db, 'services'), where('isActive', '==', true));
            const servicesSnapshot = await getDocs(servicesQuery);

            // Fetch recent bookings
            const recent = allBookings
                .sort((a, b) => {
                    const aTime = a.createdAt?.seconds || 0;
                    const bTime = b.createdAt?.seconds || 0;
                    return bTime - aTime;
                })
                .slice(0, 5);
            setRecentBookings(recent);

            // Fetch low stock materials
            try {
                const materialsSnapshot = await getDocs(collection(db, 'materials'));
                const lowStock = materialsSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(m => m.isActive && m.currentStock <= (m.reorderLevel || 10))
                    .slice(0, 3);
                setLowStockItems(lowStock);
            } catch (e) {
                console.log('Materials collection not found');
            }

            // Calculate employee performance (bookings completed this month)
            try {
                const empSnapshot = await getDocs(collection(db, 'adminUsers'));
                const employees = empSnapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(e => e.role === 'employee' && e.status === 'approved');

                const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                const monthBookings = allBookings.filter(b => b.bookingDate >= monthStart && b.status === 'completed');

                const perfData = employees.map(emp => {
                    const empBookings = monthBookings.filter(b => b.assignedEmployee === emp.id);
                    return {
                        name: emp.displayName || emp.email?.split('@')[0] || 'Employee',
                        bookings: empBookings.length,
                        revenue: empBookings.reduce((sum, b) => sum + (b.price || 0), 0)
                    };
                }).sort((a, b) => b.bookings - a.bookings).slice(0, 3);
                setEmployeePerformance(perfData);
            } catch (e) {
                console.log('Employee performance error:', e);
            }

            setStats({
                pending, confirmed, inProgress, completed, todayRevenue,
                totalCustomers: customersSnapshot.size,
                activeServices: servicesSnapshot.size,
                avgRating: 4.5
            });

            setComparison({ revenue: Number(revenueChange), bookings: 0 });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
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

    const maxRevenue = Math.max(...weeklyRevenue.map(d => d.revenue), 1);

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    // SUPER ADMIN DASHBOARD VIEW
    if (userProfile?.role === 'superadmin') {
        return (
            <div className="dashboard-page">
                <div className="dashboard-header">
                    <div className="header-info">
                        <h1><Trophy size={28} /> Super Admin Overview</h1>
                        <p className="welcome-text">Network Statistics</p>
                    </div>
                </div>

                <div className="stats-grid-compact">
                    <div className="stat-card-compact purple">
                        <div className="stat-icon-sm"><TrendingUp size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{stats.uniqueShops || 0}</span>
                            <span className="stat-text">Total Shops</span>
                        </div>
                    </div>
                    <div className="stat-card-compact blue">
                        <div className="stat-icon-sm"><Users size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{stats.totalAdmins || 0}</span>
                            <span className="stat-text">Shop Admins</span>
                        </div>
                    </div>
                    <div className="stat-card-compact green">
                        <div className="stat-icon-sm"><Car size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{stats.totalBookingsCount || 0}</span>
                            <span className="stat-text">Total Bookings</span>
                        </div>
                    </div>
                </div>

                <div className="dashboard-widget" style={{ marginTop: '1.5rem' }}>
                    <div className="widget-header">
                        <h3><TrendingUp size={18} /> Shop Performance</h3>
                    </div>
                    {loading ? <div className="loader"></div> : (
                        <div className="table-container-compact">
                            <table className="data-table-compact">
                                <thead>
                                    <tr>
                                        <th>Shop Name (Admin)</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.shopList?.map(shop => (
                                        <tr key={shop.id}>
                                            <td><strong>{shop.displayName}</strong></td>
                                            <td>{shop.email}</td>
                                            <td><span className="badge-sm badge-completed">Active</span></td>
                                            <td>
                                                <Link to="/superadmin" className="btn btn-sm btn-primary">Manage</Link>
                                            </td>
                                        </tr>
                                    ))}
                                    {(!stats.shopList || stats.shopList.length === 0) && (
                                        <tr><td colSpan="4" style={{ textAlign: 'center' }}>No shops found</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-page">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-info">
                    <h1>Dashboard</h1>
                    <p className="welcome-text">Welcome back, {userProfile?.displayName || 'Admin'}!</p>
                </div>
            </div>

            {/* Stats Grid - 2x4 on mobile */}
            <div className="stats-grid-compact">
                <div className="stat-card-compact orange">
                    <div className="stat-icon-sm"><ClipboardList size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.pending}</span>
                        <span className="stat-text">Pending</span>
                    </div>
                </div>
                <div className="stat-card-compact green">
                    <div className="stat-icon-sm"><CheckCircle size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.confirmed}</span>
                        <span className="stat-text">Confirmed</span>
                    </div>
                </div>
                <div className="stat-card-compact blue">
                    <div className="stat-icon-sm"><Clock size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.inProgress}</span>
                        <span className="stat-text">In Progress</span>
                    </div>
                </div>
                <div className="stat-card-compact teal">
                    <div className="stat-icon-sm"><Trophy size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.completed}</span>
                        <span className="stat-text">Completed</span>
                    </div>
                </div>
                {hasPermission('finance') && (
                    <div className="stat-card-compact purple">
                        <div className="stat-icon-sm"><DollarSign size={18} /></div>
                        <div className="stat-content">
                            <span className="stat-number">{formatCurrency(stats.todayRevenue)}</span>
                            <span className="stat-text">Today Revenue</span>
                        </div>
                        {comparison.revenue !== 0 && (
                            <span className={`trend ${comparison.revenue >= 0 ? 'up' : 'down'}`}>
                                {comparison.revenue >= 0 ? '↑' : '↓'} {Math.abs(comparison.revenue)}%
                            </span>
                        )}
                    </div>
                )}
                <div className="stat-card-compact indigo">
                    <div className="stat-icon-sm"><Users size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.totalCustomers}</span>
                        <span className="stat-text">Customers</span>
                    </div>
                </div>
                <div className="stat-card-compact pink">
                    <div className="stat-icon-sm"><Car size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.activeServices}</span>
                        <span className="stat-text">Services</span>
                    </div>
                </div>
                <div className="stat-card-compact amber">
                    <div className="stat-icon-sm"><Star size={18} fill="#f59e0b" /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.avgRating}</span>
                        <span className="stat-text">Rating</span>
                    </div>
                </div>
            </div>

            {/* Dashboard Grid - Charts and Widgets */}
            <div className="dashboard-grid">
                {/* Weekly Revenue Chart */}
                {hasPermission('finance') && (
                    <div className="dashboard-widget">
                        <div className="widget-header">
                            <h3><TrendingUp size={18} /> Weekly Revenue</h3>
                        </div>
                        <div className="chart-container">
                            <div className="bar-chart">
                                {weeklyRevenue.map((day, i) => (
                                    <div key={i} className="bar-container">
                                        <div
                                            className="bar"
                                            style={{ height: `${(day.revenue / maxRevenue) * 100}%` }}
                                            title={`${day.day}: ${formatCurrency(day.revenue)}`}
                                        >
                                            <span className="bar-value">{day.revenue > 0 ? `₹${(day.revenue / 1000).toFixed(0)}k` : ''}</span>
                                        </div>
                                        <span className="bar-label">{day.day}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Today's Schedule */}
                <div className="dashboard-widget">
                    <div className="widget-header">
                        <h3><Calendar size={18} /> Today's Schedule</h3>
                        <Link to="/bookings" className="view-all-link">View All</Link>
                    </div>
                    {todaySchedule.length === 0 ? (
                        <div className="empty-widget">
                            <Clock size={24} />
                            <p>No scheduled bookings today</p>
                        </div>
                    ) : (
                        <div className="schedule-list">
                            {todaySchedule.map(booking => (
                                <div key={booking.id} className="schedule-item">
                                    <div className="schedule-time">{booking.startTime}</div>
                                    <div className="schedule-info">
                                        <strong>{booking.serviceName}</strong>
                                        <span>{booking.licensePlate}</span>
                                    </div>
                                    <span className={`badge-sm ${getStatusBadge(booking.status).class}`}>
                                        {getStatusBadge(booking.status).label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Low Inventory Alerts */}
                {hasPermission('expenses') && lowStockItems.length > 0 && (
                    <div className="dashboard-widget alert-widget">
                        <div className="widget-header">
                            <h3><AlertTriangle size={18} /> Low Stock Alerts</h3>
                            <Link to="/materials" className="view-all-link">View All</Link>
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

                {/* Employee Performance */}
                {hasPermission('employees') && employeePerformance.length > 0 && (
                    <div className="dashboard-widget">
                        <div className="widget-header">
                            <h3><Users size={18} /> Employee Performance</h3>
                            <span className="subtitle">This Month</span>
                        </div>
                        <div className="performance-list">
                            {employeePerformance.map((emp, i) => (
                                <div key={i} className="performance-item">
                                    <span className="rank">#{i + 1}</span>
                                    <div className="emp-info">
                                        <strong>{emp.name}</strong>
                                        <span>{emp.bookings} bookings • {formatCurrency(emp.revenue)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Recent Bookings Table */}
            <div className="bookings-section">
                <div className="section-header">
                    <h2><ClipboardList size={18} /> Recent Bookings</h2>
                    <Link to="/bookings" className="view-all-link">View All →</Link>
                </div>
                {recentBookings.length === 0 ? (
                    <div className="empty-state-compact">
                        <ClipboardList size={32} />
                        <p>No recent bookings</p>
                    </div>
                ) : (
                    <div className="table-container-compact">
                        <table className="data-table-compact">
                            <thead>
                                <tr>
                                    <th>Reference</th>
                                    <th>Service</th>
                                    <th>Date & Time</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentBookings.map(booking => {
                                    const badge = getStatusBadge(booking.status);
                                    return (
                                        <tr key={booking.id}>
                                            <td><strong>{booking.bookingReference || booking.id.slice(0, 8)}</strong></td>
                                            <td>{booking.serviceName}</td>
                                            <td className="date-cell">{booking.bookingDate} • {booking.startTime}</td>
                                            <td><span className={`badge-sm ${badge.class}`}>{badge.label}</span></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style>{`
                .dashboard-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .dashboard-widget {
                    background: white;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                    box-shadow: var(--shadow-sm);
                    overflow: hidden;
                }
                
                .widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    border-bottom: 1px solid var(--navy-100);
                    background: var(--navy-50);
                }
                
                .widget-header h3 {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--navy-800);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                }
                
                .widget-header .subtitle {
                    font-size: 0.75rem;
                    color: var(--navy-500);
                }
                
                .chart-container {
                    height: 140px;
                    display: flex;
                    align-items: flex-end;
                    padding: 1rem;
                }
                
                .bar-chart {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    width: 100%;
                    height: 100%;
                    gap: 0.25rem;
                }
                
                .bar-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                }
                
                .bar {
                    width: 100%;
                    max-width: 36px;
                    background: linear-gradient(180deg, var(--primary) 0%, var(--primary-dark) 100%);
                    border-radius: 4px 4px 0 0;
                    min-height: 4px;
                    position: relative;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    transition: all 0.3s ease;
                }
                
                .bar:hover {
                    opacity: 0.8;
                }
                
                .bar-value {
                    font-size: 0.6rem;
                    color: white;
                    font-weight: 600;
                    padding-top: 3px;
                    white-space: nowrap;
                }
                
                .bar-label {
                    font-size: 0.65rem;
                    color: var(--navy-500);
                    margin-top: 0.375rem;
                }
                
                .schedule-list, .alert-list, .performance-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    padding: 0.75rem;
                }
                
                .schedule-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.625rem;
                    background: var(--navy-50);
                    border-radius: var(--radius-sm);
                }
                
                .schedule-time {
                    font-weight: 700;
                    color: var(--primary);
                    font-size: 0.8rem;
                    min-width: 45px;
                }
                
                .schedule-info {
                    flex: 1;
                    min-width: 0;
                }
                
                .schedule-info strong {
                    font-size: 0.8rem;
                    display: block;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .schedule-info span {
                    font-size: 0.7rem;
                    color: var(--navy-500);
                }
                
                .alert-widget {
                    border-color: #fed7aa;
                    background: #fffbeb;
                }
                
                .alert-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.625rem;
                    background: white;
                    border-radius: var(--radius-sm);
                    border: 1px solid #fed7aa;
                }
                
                .alert-item svg {
                    color: #ea580c;
                    flex-shrink: 0;
                }
                
                .alert-info strong {
                    display: block;
                    font-size: 0.8rem;
                }
                
                .alert-info span {
                    font-size: 0.7rem;
                }
                
                .performance-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.625rem;
                    background: var(--navy-50);
                    border-radius: var(--radius-sm);
                }
                
                .performance-item .rank {
                    font-weight: 800;
                    color: var(--primary);
                    font-size: 0.85rem;
                    min-width: 28px;
                }
                
                .emp-info {
                    min-width: 0;
                    flex: 1;
                }
                
                .emp-info strong {
                    display: block;
                    font-size: 0.8rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .emp-info span {
                    font-size: 0.7rem;
                    color: var(--navy-500);
                }
                
                .empty-widget {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 2rem 1rem;
                    color: var(--navy-400);
                    gap: 0.5rem;
                }
                
                .empty-widget p {
                    font-size: 0.8rem;
                    margin: 0;
                }
                
                @media (max-width: 768px) {
                    .dashboard-grid {
                        grid-template-columns: 1fr;
                        gap: 0.75rem;
                    }
                    
                    .chart-container {
                        height: 120px;
                        padding: 0.75rem;
                    }
                    
                    .bar-value {
                        display: none;
                    }
                    
                    .widget-header {
                        padding: 0.75rem;
                    }
                    
                    .widget-header h3 {
                        font-size: 0.85rem;
                    }
                    
                    .schedule-list, .alert-list, .performance-list {
                        padding: 0.5rem;
                    }
                }
                
                @media (max-width: 480px) {
                    .schedule-item, .alert-item, .performance-item {
                        padding: 0.5rem;
                    }
                    
                    .schedule-time {
                        font-size: 0.75rem;
                        min-width: 40px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Dashboard;
