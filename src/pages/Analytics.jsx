import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    IndianRupee,
    Users,
    Car,
    PieChart,
    Wallet,
    UserCheck
} from 'lucide-react';

const Analytics = () => {
    const [stats, setStats] = useState({
        todayRevenue: 0,
        yesterdayRevenue: 0,
        weekRevenue: 0,
        monthRevenue: 0,
        prevMonthRevenue: 0,
        totalBookings: 0,
        completedBookings: 0,
        pendingBookings: 0,
        cancelledBookings: 0,
        totalCustomers: 0,
        totalExpenses: 0,
        netProfit: 0,
        averageOrderValue: 0,
        growthRate: 0
    });
    const [serviceBreakdown, setServiceBreakdown] = useState([]);
    const [employeePerformance, setEmployeePerformance] = useState([]);
    const [monthlyComparison, setMonthlyComparison] = useState([]);
    const [dailyRevenue, setDailyRevenue] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            const weekAgo = new Date(today);
            weekAgo.setDate(weekAgo.getDate() - 7);
            const weekAgoStr = weekAgo.toISOString().split('T')[0];

            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthStartStr = monthStart.toISOString().split('T')[0];

            // Fetch all bookings
            const bookingsRef = collection(db, 'bookings');
            const allBookingsSnap = await getDocs(bookingsRef);
            const allBookings = allBookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Today's revenue
            const todayRevenue = allBookings
                .filter(b => b.bookingDate === todayStr && b.status === 'completed')
                .reduce((sum, b) => sum + (b.price || 0), 0);

            // Yesterday's revenue
            const yesterdayRevenue = allBookings
                .filter(b => b.bookingDate === yesterdayStr && b.status === 'completed')
                .reduce((sum, b) => sum + (b.price || 0), 0);

            // Week revenue
            const weekBookings = allBookings.filter(b => b.bookingDate >= weekAgoStr);
            const weekRevenue = weekBookings
                .filter(b => b.status === 'completed')
                .reduce((sum, b) => sum + (b.price || 0), 0);

            // Month revenue
            const monthBookings = allBookings.filter(b => b.bookingDate >= monthStartStr);
            const monthRevenue = monthBookings
                .filter(b => b.status === 'completed')
                .reduce((sum, b) => sum + (b.price || 0), 0);

            // Fetch expenses
            const expensesSnap = await getDocs(collection(db, 'expenses'));
            const allExpenses = expensesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const monthExpenses = allExpenses
                .filter(e => e.date >= monthStartStr)
                .reduce((sum, e) => sum + (e.amount || 0), 0);

            // Service breakdown
            const serviceStats = {};
            monthBookings.filter(b => b.status === 'completed').forEach(b => {
                const name = b.serviceName || 'Unknown';
                if (!serviceStats[name]) {
                    serviceStats[name] = { name, count: 0, revenue: 0 };
                }
                serviceStats[name].count++;
                serviceStats[name].revenue += b.price || 0;
            });
            const serviceList = Object.values(serviceStats)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5);
            setServiceBreakdown(serviceList);

            // Employee performance
            try {
                const empSnap = await getDocs(query(collection(db, 'adminUsers'), where('status', '==', 'approved')));
                const employees = empSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(e => e.role === 'employee');

                const empStats = employees.map(emp => {
                    const empBookings = monthBookings.filter(b => b.assignedEmployee === emp.id && b.status === 'completed');
                    return {
                        name: emp.displayName || emp.email?.split('@')[0] || 'Employee',
                        bookings: empBookings.length,
                        revenue: empBookings.reduce((sum, b) => sum + (b.price || 0), 0)
                    };
                }).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
                setEmployeePerformance(empStats);
            } catch (e) {
                console.log('Employee fetch error:', e);
            }

            // Last 6 months comparison
            const monthlyData = [];
            for (let i = 5; i >= 0; i--) {
                const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthStr = date.toISOString().slice(0, 7);
                const monthName = date.toLocaleDateString('en-US', { month: 'short' });

                const mRevenue = allBookings
                    .filter(b => b.bookingDate?.startsWith(monthStr) && b.status === 'completed')
                    .reduce((sum, b) => sum + (b.price || 0), 0);

                const mExpenses = allExpenses
                    .filter(e => e.date?.startsWith(monthStr))
                    .reduce((sum, e) => sum + (e.amount || 0), 0);

                monthlyData.push({ month: monthName, revenue: mRevenue, expenses: mExpenses });
            }
            setMonthlyComparison(monthlyData);

            // Daily revenue trend (last 14 days)
            const dailyData = [];
            for (let i = 13; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

                const dayRevenue = allBookings
                    .filter(b => b.bookingDate === dateStr && b.status === 'completed')
                    .reduce((sum, b) => sum + (b.price || 0), 0);

                const dayBookings = allBookings.filter(b => b.bookingDate === dateStr && b.status === 'completed').length;

                dailyData.push({ date: dateStr, label: dayLabel, revenue: dayRevenue, bookings: dayBookings });
            }
            setDailyRevenue(dailyData);

            // Previous month revenue for comparison
            const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            const prevMonthStartStr = prevMonthStart.toISOString().split('T')[0];
            const prevMonthEndStr = prevMonthEnd.toISOString().split('T')[0];

            const prevMonthRevenue = allBookings
                .filter(b => b.bookingDate >= prevMonthStartStr && b.bookingDate <= prevMonthEndStr && b.status === 'completed')
                .reduce((sum, b) => sum + (b.price || 0), 0);

            // Booking status breakdown for the month
            const pendingBookings = monthBookings.filter(b => b.status === 'pending_confirmation' || b.status === 'confirmed').length;
            const cancelledBookings = monthBookings.filter(b => b.status === 'cancelled').length;
            const completedCount = monthBookings.filter(b => b.status === 'completed').length;

            // Average order value
            const averageOrderValue = completedCount > 0 ? monthRevenue / completedCount : 0;

            // Growth rate vs previous month
            const growthRate = prevMonthRevenue > 0
                ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue * 100)
                : 0;

            // Customers
            const customersSnap = await getDocs(collection(db, 'customers'));

            setStats({
                todayRevenue,
                yesterdayRevenue,
                weekRevenue,
                monthRevenue,
                prevMonthRevenue,
                totalBookings: monthBookings.length,
                completedBookings: completedCount,
                pendingBookings,
                cancelledBookings,
                totalCustomers: customersSnap.size,
                totalExpenses: monthExpenses,
                netProfit: monthRevenue - monthExpenses,
                averageOrderValue,
                growthRate
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const revenueChange = stats.yesterdayRevenue > 0
        ? ((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue * 100).toFixed(1)
        : 0;

    const maxMonthValue = Math.max(...monthlyComparison.map(m => Math.max(m.revenue, m.expenses)), 1);
    const totalServiceRevenue = serviceBreakdown.reduce((sum, s) => sum + s.revenue, 0);

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader"></div>
            </div>
        );
    }

    return (
        <div className="analytics-page">
            <div className="page-header">
                <div>
                    <h1><BarChart3 size={28} /> Analytics</h1>
                    <p className="subtitle">Business performance overview</p>
                </div>
            </div>

            {/* Revenue Metrics */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-card-icon success">
                        <IndianRupee size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{formatCurrency(stats.todayRevenue)}</div>
                        <div className="metric-card-label">Today's Revenue</div>
                        <div className={`metric-card-trend ${revenueChange >= 0 ? 'up' : 'down'}`}>
                            {revenueChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            <span>{Math.abs(revenueChange)}% vs yesterday</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon info">
                        <IndianRupee size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{formatCurrency(stats.monthRevenue)}</div>
                        <div className="metric-card-label">Month Revenue</div>
                        <div className={`metric-card-trend ${stats.growthRate >= 0 ? 'up' : 'down'}`}>
                            {stats.growthRate >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            <span>{Math.abs(stats.growthRate).toFixed(1)}% vs last month</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon warning">
                        <Wallet size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{formatCurrency(stats.totalExpenses)}</div>
                        <div className="metric-card-label">Month Expenses</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className={`metric-card-icon ${stats.netProfit >= 0 ? 'success' : 'danger'}`}>
                        <TrendingUp size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value" style={{ color: stats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                            {formatCurrency(stats.netProfit)}
                        </div>
                        <div className="metric-card-label">Net Profit</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon purple">
                        <Car size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{formatCurrency(stats.averageOrderValue)}</div>
                        <div className="metric-card-label">Avg Order Value</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-card-icon teal">
                        <Users size={24} />
                    </div>
                    <div className="metric-card-body">
                        <div className="metric-card-value">{stats.totalBookings}</div>
                        <div className="metric-card-label">Bookings (Month)</div>
                        <div className="metric-card-sub">
                            <span className="text-success">{stats.completedBookings} completed</span>
                            <span className="text-warning">{stats.pendingBookings} pending</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Revenue Trend */}
            <div className="analytics-card full-width" style={{ marginBottom: '1.5rem' }}>
                <div className="analytics-card-header">
                    <h3><TrendingUp size={18} /> Daily Revenue Trend (Last 14 Days)</h3>
                </div>
                <div className="daily-chart-container">
                    <div className="daily-revenue-chart">
                        {dailyRevenue.map((day, i) => {
                            const maxDailyRevenue = Math.max(...dailyRevenue.map(d => d.revenue), 1);
                            return (
                                <div key={i} className="daily-bar-group">
                                    <div
                                        className="daily-bar"
                                        style={{ height: `${(day.revenue / maxDailyRevenue) * 100}%` }}
                                        title={`${day.label}: ${formatCurrency(day.revenue)} (${day.bookings} bookings)`}
                                    >
                                        {day.revenue > 0 && (
                                            <span className="daily-bar-value">₹{(day.revenue / 1000).toFixed(0)}k</span>
                                        )}
                                    </div>
                                    <span className="daily-label">{day.label.split(' ')[0]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="analytics-grid">
                {/* Revenue vs Expenses Chart */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><BarChart3 size={18} /> Revenue vs Expenses (6 Months)</h3>
                    </div>
                    <div className="chart-container">
                        <div className="comparison-chart">
                            {monthlyComparison.map((m, i) => (
                                <div key={i} className="comparison-bar-group">
                                    <div className="comparison-bars">
                                        <div
                                            className="comp-bar revenue"
                                            style={{ height: `${(m.revenue / maxMonthValue) * 100}%` }}
                                            title={`Revenue: ${formatCurrency(m.revenue)}`}
                                        />
                                        <div
                                            className="comp-bar expense"
                                            style={{ height: `${(m.expenses / maxMonthValue) * 100}%` }}
                                            title={`Expenses: ${formatCurrency(m.expenses)}`}
                                        />
                                    </div>
                                    <span className="comp-label">{m.month}</span>
                                </div>
                            ))}
                        </div>
                        <div className="chart-legend">
                            <span><span className="dot revenue"></span> Revenue</span>
                            <span><span className="dot expense"></span> Expenses</span>
                        </div>
                    </div>
                </div>

                {/* Service Breakdown */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><PieChart size={18} /> Service Revenue (This Month)</h3>
                    </div>
                    <div className="service-list">
                        {serviceBreakdown.length === 0 ? (
                            <p className="empty-text">No data available</p>
                        ) : (
                            serviceBreakdown.map((service, i) => (
                                <div key={i} className="service-item">
                                    <div className="service-info">
                                        <strong>{service.name}</strong>
                                        <span>{service.count} bookings</span>
                                    </div>
                                    <div className="service-bar-container">
                                        <div
                                            className="service-bar"
                                            style={{ width: `${(service.revenue / totalServiceRevenue) * 100}%` }}
                                        />
                                    </div>
                                    <div className="service-revenue">{formatCurrency(service.revenue)}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Employee Performance */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><UserCheck size={18} /> Employee Performance (This Month)</h3>
                    </div>
                    <div className="performance-list">
                        {employeePerformance.length === 0 ? (
                            <p className="empty-text">No employee data</p>
                        ) : (
                            employeePerformance.map((emp, i) => (
                                <div key={i} className="perf-item">
                                    <div className="perf-rank">#{i + 1}</div>
                                    <div className="perf-info">
                                        <strong>{emp.name}</strong>
                                        <span>{emp.bookings} completed bookings</span>
                                    </div>
                                    <div className="perf-revenue">{formatCurrency(emp.revenue)}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="analytics-card">
                    <div className="analytics-card-header">
                        <h3><Users size={18} /> Quick Stats</h3>
                    </div>
                    <div className="quick-stats-list">
                        <div className="quick-stat-item">
                            <Car size={20} />
                            <div>
                                <strong>{stats.completedBookings}/{stats.totalBookings}</strong>
                                <span>Completed (7 days)</span>
                            </div>
                        </div>
                        <div className="quick-stat-item">
                            <Users size={20} />
                            <div>
                                <strong>{stats.totalCustomers}</strong>
                                <span>Total Customers</span>
                            </div>
                        </div>
                        <div className="quick-stat-item">
                            <IndianRupee size={20} />
                            <div>
                                <strong>{formatCurrency(stats.weekRevenue)}</strong>
                                <span>Week Revenue</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .analytics-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1.5rem;
                }
                
                .analytics-card {
                    background: white;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--navy-100);
                    padding: 1.25rem;
                }
                
                .analytics-card-header {
                    margin-bottom: 1rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--navy-100);
                }
                
                .analytics-card-header h3 {
                    font-size: 0.95rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0;
                }
                
                .chart-container {
                    height: 200px;
                }
                
                .comparison-chart {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    height: 160px;
                    gap: 0.5rem;
                }
                
                .comparison-bar-group {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }
                
                .comparison-bars {
                    display: flex;
                    gap: 4px;
                    height: 140px;
                    align-items: flex-end;
                }
                
                .comp-bar {
                    width: 16px;
                    border-radius: 4px 4px 0 0;
                    min-height: 4px;
                    transition: height 0.3s;
                }
                
                .comp-bar.revenue {
                    background: linear-gradient(180deg, #10b981, #059669);
                }
                
                .comp-bar.expense {
                    background: linear-gradient(180deg, #f59e0b, #d97706);
                }
                
                .comp-label {
                    font-size: 0.7rem;
                    color: var(--navy-500);
                    margin-top: 0.5rem;
                }
                
                .chart-legend {
                    display: flex;
                    justify-content: center;
                    gap: 1.5rem;
                    margin-top: 0.75rem;
                    font-size: 0.75rem;
                }
                
                .chart-legend .dot {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 2px;
                    margin-right: 4px;
                }
                
                .dot.revenue { background: #10b981; }
                .dot.expense { background: #f59e0b; }
                
                .service-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .service-item {
                    display: grid;
                    grid-template-columns: 1fr 100px 80px;
                    gap: 0.75rem;
                    align-items: center;
                }
                
                .service-info strong {
                    display: block;
                    font-size: 0.85rem;
                }
                
                .service-info span {
                    font-size: 0.7rem;
                    color: var(--navy-500);
                }
                
                .service-bar-container {
                    height: 8px;
                    background: var(--navy-100);
                    border-radius: 4px;
                    overflow: hidden;
                }
                
                .service-bar {
                    height: 100%;
                    background: linear-gradient(90deg, var(--primary), var(--primary-dark));
                    border-radius: 4px;
                }
                
                .service-revenue {
                    font-weight: 700;
                    font-size: 0.85rem;
                    text-align: right;
                    color: var(--primary);
                }
                
                .performance-list, .quick-stats-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                
                .perf-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.5rem;
                    background: var(--navy-50);
                    border-radius: var(--radius-md);
                }
                
                .perf-rank {
                    font-weight: 800;
                    color: var(--primary);
                    min-width: 30px;
                }
                
                .perf-info {
                    flex: 1;
                }
                
                .perf-info strong {
                    display: block;
                    font-size: 0.85rem;
                }
                
                .perf-info span {
                    font-size: 0.7rem;
                    color: var(--navy-500);
                }
                
                .perf-revenue {
                    font-weight: 700;
                    color: #10b981;
                }
                
                .quick-stat-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem;
                    background: var(--navy-50);
                    border-radius: var(--radius-md);
                }
                
                .quick-stat-item svg {
                    color: var(--primary);
                }
                
                .quick-stat-item strong {
                    display: block;
                    font-size: 1.1rem;
                }
                
                .quick-stat-item span {
                    font-size: 0.75rem;
                    color: var(--navy-500);
                }
                
                .empty-text {
                    text-align: center;
                    color: var(--navy-400);
                    padding: 2rem;
                }
                
                @media (max-width: 768px) {
                    .analytics-grid {
                        grid-template-columns: 1fr;
                    }
                    
                    .service-item {
                        grid-template-columns: 1fr;
                        gap: 0.25rem;
                    }
                    
                    .service-bar-container {
                        width: 100%;
                    }
                    
                    .daily-revenue-chart {
                        overflow-x: auto;
                    }
                    
                    .daily-bar-value {
                        display: none;
                    }
                }
                
                .full-width {
                    grid-column: 1 / -1;
                }
                
                .daily-chart-container {
                    padding: 1rem 0;
                }
                
                .daily-revenue-chart {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    height: 150px;
                    gap: 0.25rem;
                }
                
                .daily-bar-group {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    height: 100%;
                }
                
                .daily-bar {
                    width: 100%;
                    max-width: 40px;
                    background: linear-gradient(180deg, #6366f1, #4f46e5);
                    border-radius: 4px 4px 0 0;
                    min-height: 4px;
                    position: relative;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    transition: all 0.3s ease;
                }
                
                .daily-bar:hover {
                    opacity: 0.8;
                }
                
                .daily-bar-value {
                    font-size: 0.6rem;
                    color: white;
                    font-weight: 600;
                    padding-top: 3px;
                    white-space: nowrap;
                }
                
                .daily-label {
                    font-size: 0.6rem;
                    color: var(--navy-500);
                    margin-top: 0.375rem;
                }
                
                .metric-card-sub {
                    display: flex;
                    gap: 0.5rem;
                    font-size: 0.7rem;
                    margin-top: 0.25rem;
                }
                
                .metric-card-sub .text-success {
                    color: #10b981;
                }
                
                .metric-card-sub .text-warning {
                    color: #f59e0b;
                }
                
                .metric-card-icon.purple {
                    background: #e0e7ff;
                    color: #6366f1;
                }
                
                .metric-card-icon.teal {
                    background: #ccfbf1;
                    color: #0d9488;
                }
            `}</style>
        </div>
    );
};

export default Analytics;
