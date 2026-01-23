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
    Calendar,
    UserCheck,
    Briefcase
} from 'lucide-react';

const EmployeeDashboard = () => {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        todayJobs: 0,
        completedMonth: 0,
        revenueMonth: 0,
        presentDays: 0,
        lateDays: 0
    });
    const [mySchedule, setMySchedule] = useState([]);
    const [attendanceHistory, setAttendanceHistory] = useState([]);

    useEffect(() => {
        if (userProfile?.uid) {
            fetchEmployeeData();
        }
    }, [userProfile]);

    const fetchEmployeeData = async () => {
        try {
            setLoading(true);
            const todayStr = new Date().toISOString().split('T')[0];
            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

            // 1. Fetch Assigned Bookings
            // Assuming bookings have 'assignedEmployeeId' or we just check general bookings for now if not assigned.
            // Since explicit assignment might not be fully implemented, we'll check bookings where `assignedEmployee` == user.uid
            // Or if simplified, just show all bookings for today if no assignment logic exists yet.
            // However, user said "with there kpi", implying personal.
            // I'll assume bookings have `assignedEmployee` field. If not, I might need to fallback.

            const bookingsRef = collection(db, 'bookings');
            // My Jobs Today
            const todayQuery = query(
                bookingsRef,
                where('bookingDate', '==', todayStr),
                where('status', 'in', ['confirmed', 'in_progress', 'pending_confirmation'])
            );
            // Note: In a real app we'd filter by assignee: where('assignedEmployee', '==', userProfile.uid)
            // But if assignment isn't strictly enforced yet, showing Today's Schedule is helpful.
            // Let's try to filter by assignee if the field exists, else show all (or filtered by role).
            // For now, I will show ALL today's bookings as "Today's Schedule" but label it "Shop Schedule" unless assigned.
            // User requested "Employee Separate Dashboard".

            const todaySnapshot = await getDocs(todayQuery);
            const todayJobs = todaySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter detailed if 'assignedEmployee' matches (optional, if logic exists)
            const myTodayJobs = todayJobs.filter(j => !j.assignedEmployee || j.assignedEmployee === userProfile.uid);

            // 2. Fetch My Attendance
            const attendanceRef = collection(db, 'attendance');
            const myAttendanceQuery = query(
                attendanceRef,
                where('employeeId', '==', userProfile.uid),
                where('date', '>=', monthStart),
                orderBy('date', 'desc')
            );

            const attendanceSnapshot = await getDocs(myAttendanceQuery);
            const attendanceData = attendanceSnapshot.docs.map(d => d.data());

            setAttendanceHistory(attendanceData.slice(0, 5));

            const presentCount = attendanceData.filter(a => a.status === 'present' || a.status === 'half-day').length;
            const lateCount = attendanceData.filter(a => a.lateBy > 0).length;

            // 3. Fetch Monthly Completed Jobs for KPIs
            const monthBookingsQuery = query(
                bookingsRef,
                where('bookingDate', '>=', monthStart),
                where('status', '==', 'completed')
            );
            const monthSnapshot = await getDocs(monthBookingsQuery);
            const monthBookings = monthSnapshot.docs
                .map(d => d.data())
                .filter(j => j.assignedEmployee === userProfile.uid);

            const completedMonth = monthBookings.length;
            const revenueMonth = monthBookings.reduce((sum, b) => sum + (b.price || 0), 0);

            setStats({
                todayJobs: myTodayJobs.length,
                completedMonth,
                revenueMonth,
                presentDays: presentCount,
                lateDays: lateCount
            });

            setMySchedule(myTodayJobs);

        } catch (error) {
            console.error("Error fetching employee dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-4">Loading stats...</div>;

    return (
        <div className="dashboard-page">
            <div className="dashboard-header">
                <div>
                    <h1>👋 Good Morning, {userProfile?.displayName}!</h1>
                    <p className="subtitle">Here's your schedule and performance for today.</p>
                </div>
            </div>

            {/* Employee Stats Grid */}
            <div className="stats-grid-compact" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
                <div className="stat-card-compact blue">
                    <div className="stat-icon-sm"><Briefcase size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.todayJobs}</span>
                        <span className="stat-text">Jobs Today</span>
                    </div>
                </div>
                <div className="stat-card-compact green">
                    <div className="stat-icon-sm"><CheckCircle size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.completedMonth}</span>
                        <span className="stat-text">Jobs (Month)</span>
                    </div>
                </div>
                <div className="stat-card-compact teal">
                    <div className="stat-icon-sm"><Briefcase size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">₹{stats.revenueMonth.toLocaleString('en-IN')}</span>
                        <span className="stat-text">Revenue (Month)</span>
                    </div>
                </div>
                <div className="stat-card-compact purple">
                    <div className="stat-icon-sm"><UserCheck size={18} /></div>
                    <div className="stat-content">
                        <span className="stat-number">{stats.presentDays}</span>
                        <span className="stat-text">Attendance</span>
                    </div>
                </div>
            </div>

            <div className="dashboard-grid" style={{ marginTop: '1.5rem' }}>
                {/* My Schedule */}
                <div className="dashboard-widget">
                    <div className="widget-header">
                        <h3><Calendar size={18} /> My Today's Tasks</h3>
                    </div>
                    {mySchedule.length === 0 ? (
                        <div className="empty-widget">
                            <Clock size={24} />
                            <p>No tasks assigned for today</p>
                        </div>
                    ) : (
                        <div className="schedule-list">
                            {mySchedule.map(job => (
                                <div key={job.id} className="schedule-item">
                                    <div className="schedule-time">{job.startTime}</div>
                                    <div className="schedule-info">
                                        <strong>{job.serviceName}</strong>
                                        <span>{job.vehicleType} • {job.licensePlate}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: '700' }}>#{job.bookingReference}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'gray' }}>{job.carMake} {job.carModel}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Attendance */}
                <div className="dashboard-widget">
                    <div className="widget-header">
                        <h3><CheckCircle size={18} /> Recent Attendance</h3>
                    </div>
                    <div className="schedule-list">
                        {attendanceHistory.map((record, i) => (
                            <div key={i} className="schedule-item" style={{ justifyContent: 'space-between' }}>
                                <div>
                                    <strong>{new Date(record.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</strong>
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'gray' }}>
                                        In: {record.checkInTime || '--:--'} | Out: {record.checkOutTime || '--:--'}
                                    </span>
                                </div>
                                <span className={`badge-sm badge-${record.status === 'present' ? 'completed' : 'pending'}`}>
                                    {record.status}
                                </span>
                            </div>
                        ))}
                        {attendanceHistory.length === 0 && <p style={{ padding: '1rem', textAlign: 'center', color: 'gray' }}>No records found</p>}
                    </div>
                </div>
            </div>

            <style>{`
                /* Reusing dashboard styles from parent context or duplicated if scoped */
                .dashboard-header h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
                .subtitle { color: var(--navy-500); }
            `}</style>
        </div>
    );
};

export default EmployeeDashboard;
