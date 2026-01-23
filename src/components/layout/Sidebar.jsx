import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    LayoutDashboard,
    CalendarDays,
    ClipboardList,
    Car,
    Users,
    UserCog,
    DollarSign,
    FileText,
    Receipt,
    BarChart3,
    Settings,
    LogOut,
    Menu,
    X,
    Package,
    CalendarCheck,
    Database,
    Shield
} from 'lucide-react';
import { useState, useEffect } from 'react';

const Sidebar = () => {
    const { userProfile, logout, hasPermission } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);
    const location = useLocation();

    // Close sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard', permission: 'dashboard' },
        { path: '/superadmin', icon: Shield, label: 'Super Admin', permission: 'superadmin' },
        { path: '/bookings', icon: ClipboardList, label: 'Bookings', permission: 'bookings' },

        { path: '/calendar', icon: CalendarDays, label: 'Calendar', permission: 'bookings' },
        { path: '/services', icon: Car, label: 'Services', permission: 'services' },
        { path: '/customers', icon: Users, label: 'Customers', permission: 'customers' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics', permission: 'analytics' },
        { path: '/invoices', icon: FileText, label: 'Invoices', permission: 'invoices' },
        { path: '/employees', icon: UserCog, label: 'Employees', permission: 'employees' },
        { path: '/payroll', icon: Receipt, label: 'Payroll', permission: 'payroll' },
        { path: '/attendance', icon: CalendarCheck, label: 'Attendance', permission: 'payroll' },
        { path: '/expenses', icon: DollarSign, label: 'Expenses', permission: 'expenses' },
        { path: '/materials', icon: Package, label: 'Materials', permission: 'expenses' },
        { path: '/crm-history', icon: Database, label: 'CRM History', permission: 'customers' },
        { path: '/audit-log', icon: Shield, label: 'Audit Log', permission: 'audit' },
        { path: '/settings', icon: Settings, label: 'Settings', permission: 'settings' },
    ];

    const visibleNavItems = navItems.filter(item => hasPermission(item.permission, 'view') || hasPermission(item.permission));

    const handleLogout = async () => {
        await logout();
    };

    return (
        <>
            {/* Mobile Top Navigation Bar */}
            <header className="mobile-top-nav">
                <button
                    className="mobile-burger-btn"
                    onClick={() => setMobileOpen(!mobileOpen)}
                    aria-label="Open menu"
                >
                    {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
                <div className="mobile-top-logo">
                    <Car size={20} />
                    <span>ZWash Admin</span>
                </div>
                <div className="mobile-top-spacer" />
            </header>

            {/* Desktop Sidebar */}
            <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <Car size={24} />
                    <h2>ZWash Admin</h2>
                </div>

                <nav className="sidebar-nav">
                    {visibleNavItems.map(item => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setMobileOpen(false)}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        {userProfile?.photoURL ? (
                            <img src={userProfile.photoURL} alt="" className="user-avatar" />
                        ) : (
                            <div className="user-avatar-placeholder">
                                {userProfile?.displayName?.charAt(0) || 'U'}
                            </div>
                        )}
                        <div className="user-details">
                            <span className="user-name">{userProfile?.displayName || 'User'}</span>
                            <span className="user-role">{userProfile?.role}</span>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Sidebar Overlay */}
            {mobileOpen && (
                <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />
            )}
        </>
    );
};

export default Sidebar;
