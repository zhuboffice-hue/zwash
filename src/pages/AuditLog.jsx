import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import {
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    where,
    Timestamp
} from 'firebase/firestore';
import {
    Shield,
    Search,
    Filter,
    Calendar,
    User,
    RefreshCw,
    Activity
} from 'lucide-react';

const AuditLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [userFilter, setUserFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [limitCount, setLimitCount] = useState(50);

    useEffect(() => {
        fetchLogs();
        fetchUsers();
    }, [limitCount, userFilter, actionFilter, dateFilter]);

    const fetchUsers = async () => {
        try {
            const usersRef = collection(db, 'adminUsers');
            const snapshot = await getDocs(usersRef);
            const userList = snapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().displayName || doc.data().email
            }));
            setUsers(userList);
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const logsRef = collection(db, 'auditLogs');
            let q = query(logsRef, orderBy('timestamp', 'desc'), limit(limitCount));

            if (userFilter) {
                // If filtering by user, we might need a composite index or do client-side filtering if volume is low.
                // For simplicity and to avoid index errors initially, let's fetch and filter client side or use simple queries.
                // Since firestore composite indexes are required for multi-field queries with sort, 
                // we'll stick to client side filtering for specific fields if composite index is missing, 
                // but "where + orderBy" usually works if indexed.
                // Let's rely on client side filtering for flexible partial text search and combination.
                // Revert query to just basic sort for now to ensure data loads.
                q = query(logsRef, orderBy('timestamp', 'desc'), limit(200)); 
            }

            // Note: For a production app with millions of logs, you'd want server-side fitlering with Indexes.
            // For now, fetching latest 200-500 is usually enough for an admin dashboard.
            
            const snapshot = await getDocs(q);
            let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Client-side filtering
            if (userFilter) {
                data = data.filter(log => log.userId === userFilter);
            }

            if (actionFilter) {
                data = data.filter(log => log.action === actionFilter);
            }

            if (dateFilter) {
                const filterDate = new Date(dateFilter).toDateString();
                data = data.filter(log => {
                    const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                    return logDate.toDateString() === filterDate;
                });
            }

            setLogs(data);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const searchLower = searchTerm.toLowerCase();
        return (
            log.userName?.toLowerCase().includes(searchLower) ||
            log.action?.toLowerCase().includes(searchLower) ||
            log.resource?.toLowerCase().includes(searchLower) ||
            log.details?.toLowerCase().includes(searchLower)
        );
    });

    const formatTime = (timestamp) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const getActionColor = (action) => {
        switch (action) {
            case 'create': return 'text-green-600 bg-green-50';
            case 'update': return 'text-blue-600 bg-blue-50';
            case 'delete': return 'text-red-600 bg-red-50';
            case 'login': return 'text-purple-600 bg-purple-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    return (
        <div className="audit-page">
            <div className="page-header">
                <div>
                    <h1><Shield size={28} /> Audit Log</h1>
                    <p className="subtitle">Track system activity and user actions</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={fetchLogs}>
                        <RefreshCw size={18} /> Refresh
                    </button>
                    <div className="limit-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem', color: 'var(--navy-600)' }}>Show:</span>
                        <select 
                            value={limitCount} 
                            onChange={(e) => setLimitCount(Number(e.target.value))}
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                        >
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                            <option value={200}>200</option>
                            <option value={500}>500</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-body" style={{ padding: '1rem' }}>
                    <div className="search-filter-bar" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div className="search-box">
                            <Search size={18} />
                            <input
                                type="text"
                                placeholder="Search logs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <User size={16} className="text-gray-400" />
                            <select
                                className="filter-select"
                                style={{ width: '100%' }}
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                            >
                                <option value="">All Users</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Activity size={16} className="text-gray-400" />
                            <select
                                className="filter-select"
                                style={{ width: '100%' }}
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value)}
                            >
                                <option value="">All Actions</option>
                                <option value="create">Create</option>
                                <option value="update">Update</option>
                                <option value="delete">Delete</option>
                                <option value="login">Login</option>
                            </select>
                        </div>

                        <div className="filter-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Calendar size={16} className="text-gray-400" />
                            <input
                                type="date"
                                className="filter-select"
                                style={{ width: '100%' }}
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="card">
                <div className="card-body" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th>Resource</th>
                                    <th>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                                            <div className="loader" style={{ margin: '0 auto' }}></div>
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                                            <p style={{ color: 'var(--navy-500)' }}>No logs found matching your criteria</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map(log => (
                                        <tr key={log.id}>
                                            <td style={{ whiteSpace: 'nowrap', color: 'var(--navy-600)', fontSize: '0.85rem' }}>
                                                {formatTime(log.timestamp)}
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 500 }}>{log.userName}</span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--navy-400)' }}>{log.userRole}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span 
                                                    style={{ 
                                                        padding: '0.25rem 0.5rem', 
                                                        borderRadius: '4px', 
                                                        fontSize: '0.75rem', 
                                                        fontWeight: 600,
                                                        textTransform: 'uppercase'
                                                    }}
                                                    className={getActionColor(log.action)}
                                                >
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td style={{ textTransform: 'capitalize' }}>
                                                {log.resource}
                                            </td>
                                            <td style={{ color: 'var(--navy-700)' }}>
                                                {log.details}
                                                {log.metadata && log.metadata.name && (
                                                    <span style={{ color: 'var(--navy-500)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                                                        ({log.metadata.name})
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                .text-green-600 { color: #059669; }
                .bg-green-50 { background-color: #ecfdf5; }
                .text-blue-600 { color: #2563eb; }
                .bg-blue-50 { background-color: #eff6ff; }
                .text-red-600 { color: #dc2626; }
                .bg-red-50 { background-color: #fef2f2; }
                .text-purple-600 { color: #7c3aed; }
                .bg-purple-50 { background-color: #f5f3ff; }
                .text-gray-600 { color: #4b5563; }
                .bg-gray-50 { background-color: #f9fafb; }
            `}</style>
        </div>
    );
};

export default AuditLog;
