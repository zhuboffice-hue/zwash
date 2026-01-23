import { useState, useEffect } from 'react';
import { useAuth, ROLES } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { logAction } from '../utils/logger';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
    orderBy
} from 'firebase/firestore';
import {
    Shield,
    Plus,
    Search,
    Mail,
    Phone,
    UserCog,
    Store
} from 'lucide-react';

const SuperAdminDashboard = () => {
    const { userProfile, isSuperAdmin } = useAuth();
    const [shopAdmins, setShopAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isSuperAdmin) {
            fetchShopAdmins();
        }
    }, [isSuperAdmin]);

    const fetchShopAdmins = async () => {
        try {
            setLoading(true);
            const usersRef = collection(db, 'adminUsers');
            const q = query(usersRef, where('role', '==', ROLES.ADMIN));
            const snapshot = await getDocs(q);
            const admins = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setShopAdmins(admins);
        } catch (error) {
            console.error('Error fetching shop admins:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredAdmins = shopAdmins.filter(admin =>
        admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        admin.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isSuperAdmin) return <div className="p-4">Access Denied</div>;

    return (
        <div className="employees-page">
            <div className="page-header">
                <div>
                    <h1><Shield size={28} /> Super Admin Dashboard</h1>
                    <p className="subtitle">Manage Shop Admins and Stores</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus size={18} /> Add Shop Admin
                    </button>
                </div>
            </div>

            <div className="search-filter-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search admins..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="employees-grid">
                {loading ? (
                    <div className="loader"></div>
                ) : filteredAdmins.length === 0 ? (
                    <div className="empty-state">
                        <UserCog size={48} />
                        <p>No shop admins found</p>
                    </div>
                ) : (
                    filteredAdmins.map(admin => (
                        <div key={admin.id} className="employee-card">
                            <div className="employee-card-header">
                                <div className="employee-avatar-placeholder" style={{ background: '#7c3aed' }}>
                                    {admin.displayName?.charAt(0) || 'A'}
                                </div>
                                <span className="badge badge-admin">Shop Admin</span>
                            </div>
                            <div className="employee-card-body">
                                <h3>{admin.displayName || 'Unnamed Admin'}</h3>
                                <p><Mail size={14} /> {admin.email}</p>
                                {admin.phone && <p><Phone size={14} /> {admin.phone}</p>}
                                <p><Store size={14} /> Shop ID: {admin.shopId || 'Default'}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {showAddModal && (
                <AddAdminModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={fetchShopAdmins}
                    userProfile={userProfile}
                />
            )}
        </div>
    );
};

const AddAdminModal = ({ onClose, onSuccess, userProfile }) => {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.target);
        const email = formData.get('email').toLowerCase();

        try {
            await addDoc(collection(db, 'employeeInvites'), {
                email,
                role: ROLES.ADMIN,
                invitedBy: userProfile.email,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            await logAction(userProfile, 'create', 'superadmin', `Invited Shop Admin: ${email}`, { email });
            alert(`Invitation sent to ${email}`);
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error inviting admin:', error);
            alert('Error sending invitation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Add Shop Admin</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Email Address</label>
                            <input name="email" type="email" required placeholder="admin@shop.com" />
                        </div>
                        <div className="alert alert-info">
                            User will receive an invite to join as a Shop Admin.
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Sending...' : 'Send Invite'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
