import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    ClipboardList,
    Car,
    Users,
    MoreHorizontal,
    CalendarDays,
    BarChart3,
    FileText,
    UserCog,
    Receipt,
    CalendarCheck,
    DollarSign,
    Package,
    Settings,
    LogOut,
    X,
    ChevronRight
} from 'lucide-react';

const MobileNav = () => {
    const { hasPermission, userProfile, logout } = useAuth();
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const location = useLocation();

    // Close more menu on route change
    useEffect(() => {
        setMoreMenuOpen(false);
    }, [location.pathname]);

    // Primary nav items (shown in bottom bar)
    const primaryItems = [
        { path: '/', icon: LayoutDashboard, label: 'Home', permission: 'dashboard' },
        { path: '/bookings', icon: ClipboardList, label: 'Bookings', permission: 'bookings' },
        { path: '/calendar', icon: CalendarDays, label: 'Calendar', permission: 'bookings' },
        { path: '/customers', icon: Users, label: 'Customers', permission: 'customers' },
    ];

    // Secondary items (shown in more menu)
    const secondaryItems = [
        { path: '/services', icon: Car, label: 'Services', permission: 'services' },
        { path: '/analytics', icon: BarChart3, label: 'Analytics', permission: 'analytics' },
        { path: '/invoices', icon: FileText, label: 'Invoices', permission: 'invoices' },
        { path: '/employees', icon: UserCog, label: 'Employees', permission: 'employees' },
        { path: '/payroll', icon: Receipt, label: 'Payroll', permission: 'payroll' },
        { path: '/attendance', icon: CalendarCheck, label: 'Attendance', permission: 'payroll' },
        { path: '/expenses', icon: DollarSign, label: 'Expenses', permission: 'expenses' },
        { path: '/materials', icon: Package, label: 'Materials', permission: 'expenses' },
        { path: '/settings', icon: Settings, label: 'Settings', permission: 'settings' },
    ];

    const visiblePrimaryItems = primaryItems.filter(item =>
        hasPermission(item.permission, 'view') || hasPermission(item.permission)
    );

    const visibleSecondaryItems = secondaryItems.filter(item =>
        hasPermission(item.permission, 'view') || hasPermission(item.permission)
    );

    // Check if any secondary item is active
    const isSecondaryActive = visibleSecondaryItems.some(item => location.pathname === item.path);

    const handleLogout = async () => {
        setMoreMenuOpen(false);
        await logout();
    };

    return (
        <>
            {/* Mobile Bottom Navigation Bar */}
            <nav className="mobile-bottom-nav">
                {visiblePrimaryItems.slice(0, 4).map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                    >
                        <item.icon size={22} />
                        <span>{item.label}</span>
                    </NavLink>
                ))}
                {visibleSecondaryItems.length > 0 && (
                    <button
                        className={`mobile-nav-item more-btn ${moreMenuOpen || isSecondaryActive ? 'active' : ''}`}
                        onClick={() => setMoreMenuOpen(true)}
                    >
                        <MoreHorizontal size={22} />
                        <span>More</span>
                    </button>
                )}
            </nav>

            {/* More Menu Overlay */}
            {moreMenuOpen && (
                <div className="more-menu-overlay" onClick={() => setMoreMenuOpen(false)} />
            )}

            {/* More Menu Panel */}
            {moreMenuOpen && (
                <div className="more-menu-panel">
                    <div className="more-menu-header">
                        <h3>More Options</h3>
                        <button className="more-menu-close" onClick={() => setMoreMenuOpen(false)}>
                            <X size={20} />
                        </button>
                    </div>
                    <div className="more-menu-content">
                        {/* User Profile Section */}
                        <div className="more-menu-user">
                            {userProfile?.photoURL ? (
                                <img src={userProfile.photoURL} alt="" className="more-menu-avatar" />
                            ) : (
                                <div className="more-menu-avatar-placeholder">
                                    {userProfile?.displayName?.charAt(0) || 'U'}
                                </div>
                            )}
                            <div className="more-menu-user-info">
                                <span className="more-menu-user-name">{userProfile?.displayName || 'User'}</span>
                                <span className="more-menu-user-role">{userProfile?.role}</span>
                            </div>
                        </div>

                        {/* Quick Access Grid */}
                        <div className="more-menu-quick-grid">
                            {visibleSecondaryItems.slice(0, 6).map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => `quick-grid-item ${isActive ? 'active' : ''}`}
                                    onClick={() => setMoreMenuOpen(false)}
                                >
                                    <div className="quick-grid-icon">
                                        <item.icon size={22} />
                                    </div>
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </div>

                        {/* Additional Navigation Items */}
                        {visibleSecondaryItems.length > 6 && (
                            <div className="more-menu-nav">
                                {visibleSecondaryItems.slice(6).map(item => (
                                    <NavLink
                                        key={item.path}
                                        to={item.path}
                                        className={({ isActive }) => `more-menu-item ${isActive ? 'active' : ''}`}
                                        onClick={() => setMoreMenuOpen(false)}
                                    >
                                        <item.icon size={20} />
                                        <span>{item.label}</span>
                                        <ChevronRight size={16} className="more-menu-chevron" />
                                    </NavLink>
                                ))}
                            </div>
                        )}

                        {/* Logout Button */}
                        <button className="more-menu-logout" onClick={handleLogout}>
                            <LogOut size={20} />
                            <span>Logout</span>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default MobileNav;
