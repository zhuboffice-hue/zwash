import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp,
    where,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import {
    ShieldCheck,
    Plus,
    Search,
    Check,
    X,
    UserCheck,
    Calendar,
    CreditCard,
    Users,
    Eye,
    CheckCircle,
    Circle,
    Car,
    Edit,
    Trash2
} from 'lucide-react';

// Default AMC Plans with services
const DEFAULT_AMC_PLANS = {
    compact: {
        name: 'Compact Package',
        planType: 'compact',
        validityMonths: 12,
        prices: { suv: 19999, sedan: 16999, hatchback: 14999 },
        services: [
            { name: 'Commando Cleaning', quantity: 12, description: '12 Washes Included' },
            { name: "Commander's Finish", quantity: 1, description: 'Multi Stage Polish' },
            { name: 'Gear Guard Interior', quantity: 1, description: 'Deep Cleaning' },
            { name: 'Salt Mark Stain Remover', quantity: 1, description: 'All Glasses' }
        ]
    },
    premium: {
        name: 'Premium Package',
        planType: 'premium',
        validityMonths: 12,
        prices: { suv: 49999, sedan: 37999, hatchback: 29999 },
        services: [
            { name: 'Commando Cleaning', quantity: 48, description: 'Unlimited Wash' },
            { name: "Commander's Finish", quantity: 1, description: 'Multi Stage Polish' },
            { name: 'Underbody Armor', quantity: 1, description: 'Under Change Coating' },
            { name: 'Silver Coating / Salt Mark', quantity: 2, description: 'Stain Remove All Glass' },
            { name: 'Gear Guard Interior', quantity: 2, description: 'Deep Cleaning (2 Times)' },
            { name: 'AC Gas Check', quantity: 1, description: 'Free', isFree: true }
        ]
    }
};

const AMCPlans = () => {
    const { hasPermission, userProfile, isAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState('plans');
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showTrackingModal, setShowTrackingModal] = useState(false);
    const [showEditSubModal, setShowEditSubModal] = useState(false);
    const [deleteSubConfirm, setDeleteSubConfirm] = useState(null);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedSubscription, setSelectedSubscription] = useState(null);
    const [subscriptions, setSubscriptions] = useState([]);
    const [seeding, setSeeding] = useState(false);

    useEffect(() => {
        if (activeTab === 'plans') {
            fetchPlans();
        } else {
            fetchSubscriptions();
        }
    }, [activeTab]);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'amc_plans'), where('isActive', '==', true));
            const snapshot = await getDocs(q);
            setPlans(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error('Error fetching plans:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubscriptions = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'customer_amc_subscriptions'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort client-side to avoid index issues, with null safety
            data.sort((a, b) => {
                const dateA = a.startDate?.seconds || (a.startDate ? new Date(a.startDate).getTime() / 1000 : 0);
                const dateB = b.startDate?.seconds || (b.startDate ? new Date(b.startDate).getTime() / 1000 : 0);
                return dateB - dateA;
            });
            setSubscriptions(data);
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
        } finally {
            setLoading(false);
        }
    };

    const togglePlanStatus = async (planId, currentStatus) => {
        if (!window.confirm(`Are you sure you want to ${currentStatus ? 'deactivate' : 'activate'} this plan?`)) return;
        try {
            await updateDoc(doc(db, 'amc_plans', planId), {
                isActive: !currentStatus,
                updatedAt: serverTimestamp()
            });
            fetchPlans();
        } catch (error) {
            console.error('Error updating plan:', error);
        }
    };

    const getServiceUsageCount = (sub, serviceName) => {
        if (!sub.serviceTracking) return { used: 0, total: 0 };
        const service = sub.serviceTracking.find(s => s.serviceType === serviceName);
        return {
            used: service?.usages?.length || 0,
            total: service?.totalAllowed || 0
        };
    };

    const seedAMCPlans = async () => {
        if (!window.confirm('This will add Compact and Premium AMC plans. Continue?')) return;

        setSeeding(true);
        try {
            // Seed Compact Plan
            await addDoc(collection(db, 'amc_plans'), {
                ...DEFAULT_AMC_PLANS.compact,
                isActive: true,
                createdAt: serverTimestamp()
            });

            // Seed Premium Plan
            await addDoc(collection(db, 'amc_plans'), {
                ...DEFAULT_AMC_PLANS.premium,
                isActive: true,
                createdAt: serverTimestamp()
            });

            alert('AMC Plans seeded successfully!');
            fetchPlans();
        } catch (error) {
            console.error('Error seeding plans:', error);
            alert('Error: ' + error.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleDeletePlan = async (planId) => {
        if (!window.confirm('Are you sure you want to delete this AMC plan?')) return;

        try {
            await updateDoc(doc(db, 'amc_plans', planId), {
                isActive: false,
                deletedAt: serverTimestamp()
            });
            alert('Plan deleted successfully');
            fetchPlans();
        } catch (error) {
            console.error('Error deleting plan:', error);
            alert('Error: ' + error.message);
        }
    };

    const deleteSubscription = async (subId) => {
        try {
            await deleteDoc(doc(db, 'customer_amc_subscriptions', subId));
            setSubscriptions(prev => prev.filter(s => s.id !== subId));
            setDeleteSubConfirm(null);
        } catch (error) {
            console.error('Error deleting subscription:', error);
            alert('Error deleting subscription');
        }
    };

    const formatDate = (date) => {
        if (!date) return '-';
        if (date.toDate) return date.toDate().toLocaleDateString();
        if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
        return new Date(date).toLocaleDateString();
    };

    return (
        <div className="amc-page">
            <div className="page-header">
                <div>
                    <h1><ShieldCheck size={28} /> AMC Management</h1>
                    <p className="subtitle">Manage annual maintenance contracts</p>
                </div>
                <div className="header-actions">
                    <div className="tab-group">
                        <button
                            className={`tab-btn ${activeTab === 'plans' ? 'active' : ''}`}
                            onClick={() => setActiveTab('plans')}
                        >
                            <ShieldCheck size={16} /> Packages
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'subscriptions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('subscriptions')}
                        >
                            <UserCheck size={16} /> Subscriptions
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'plans' ? (
                <div className="plans-section">
                    <div className="section-header">
                        <h3>Available Packages</h3>
                        {hasPermission('services', 'create') && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-primary" onClick={() => setShowPlanModal(true)}>
                                    <Plus size={18} /> Create New Plan
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="plans-grid">
                        {loading ? (
                            <div className="loader-container"><div className="loader"></div></div>
                        ) : plans.length === 0 ? (
                            <div className="empty-state">
                                <ShieldCheck size={48} />
                                <p>No active AMC plans found</p>
                                <p style={{ color: 'var(--navy-400)', marginTop: '0.5rem' }}>
                                    Create Compact or Premium packages to get started
                                </p>
                            </div>
                        ) : (
                            plans.map(plan => (
                                <div key={plan.id} className={`plan-card ${plan.planType === 'premium' ? 'premium' : 'compact'}`}>
                                    <div className="plan-header">
                                        <div>
                                            <span className="plan-type-badge">{plan.planType?.toUpperCase() || 'STANDARD'}</span>
                                            <h3>{plan.name}</h3>
                                        </div>
                                    </div>
                                    <div className="plan-pricing">
                                        {plan.prices ? (
                                            <div className="vehicle-prices">
                                                <div><small>Hatchback</small><strong>₹{plan.prices.hatchback?.toLocaleString()}</strong></div>
                                                <div><small>Sedan</small><strong>₹{plan.prices.sedan?.toLocaleString()}</strong></div>
                                                <div><small>SUV</small><strong>₹{plan.prices.suv?.toLocaleString()}</strong></div>
                                            </div>
                                        ) : (
                                            <span className="plan-price">₹{plan.price?.toLocaleString()}</span>
                                        )}
                                    </div>
                                    <div className="plan-body">
                                        <div className="plan-feature">
                                            <Calendar size={16} />
                                            <span>{plan.validityMonths} Months Validity</span>
                                        </div>
                                        {plan.services?.map((service, idx) => (
                                            <div key={idx} className="plan-feature service-item">
                                                <Check size={16} />
                                                <span>{service.name} {service.quantity > 1 ? `(${service.quantity}x)` : ''}</span>
                                            </div>
                                        ))}
                                        {!plan.services && plan.serviceCount && (
                                            <div className="plan-feature">
                                                <Check size={16} />
                                                <span>{plan.serviceCount} Washes Included</span>
                                            </div>
                                        )}
                                        {plan.description && <p className="plan-desc">{plan.description}</p>}
                                    </div>
                                    <div className="plan-footer">
                                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => { setSelectedPlan(plan); setShowPlanModal(true); }}
                                                style={{ flex: 1 }}
                                            >
                                                <Edit size={14} /> Edit
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDeletePlan(plan.id)}
                                                style={{ flex: 1 }}
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                        <button
                                            className="btn btn-outline-primary w-100"
                                            onClick={() => { setSelectedPlan(plan); setShowAssignModal(true); }}
                                        >
                                            Assign to Customer
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            ) : (
                <div className="subscriptions-section">
                    <div className="card">
                        <div className="card-body">
                            {loading ? (
                                <div className="loader-container"><div className="loader"></div></div>
                            ) : subscriptions.length === 0 ? (
                                <div className="empty-state">
                                    <Users size={48} />
                                    <p>No active subscriptions</p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Customer</th>
                                                <th>Plan</th>
                                                <th>Vehicle</th>
                                                <th>Start Date</th>
                                                <th>Expiry</th>
                                                <th>Services Used</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {subscriptions.map(sub => {
                                                const washUsage = getServiceUsageCount(sub, 'Commando Cleaning');
                                                return (
                                                    <tr key={sub.id}>
                                                        <td>
                                                            <strong>{sub.customerName}</strong>
                                                            <br />
                                                            <small>{sub.customerPhone}</small>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${sub.planType === 'premium' ? 'badge-progress' : 'badge-confirmed'}`}>
                                                                {sub.planType?.toUpperCase() || 'STANDARD'}
                                                            </span>
                                                            <br />
                                                            <small>{sub.planName}</small>
                                                        </td>
                                                        <td>
                                                            <strong>{sub.vehicleNumber}</strong>
                                                            <br />
                                                            <small style={{ textTransform: 'capitalize' }}>{sub.vehicleType}</small>
                                                        </td>
                                                        <td>{formatDate(sub.startDate)}</td>
                                                        <td>{formatDate(sub.expiryDate)}</td>
                                                        <td>
                                                            <div className="usage-bar-wrapper">
                                                                <div className="usage-text">
                                                                    {washUsage.used} / {washUsage.total} washes
                                                                </div>
                                                                <div className="usage-progress">
                                                                    <div
                                                                        className="usage-fill"
                                                                        style={{ width: `${washUsage.total ? (washUsage.used / washUsage.total) * 100 : 0}%` }}
                                                                    ></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <span className={`badge ${sub.status === 'active' ? 'badge-confirmed' : 'badge-cancelled'}`}>
                                                                {sub.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                                <button
                                                                    className="btn btn-sm btn-primary"
                                                                    onClick={() => { setSelectedSubscription(sub); setShowTrackingModal(true); }}
                                                                    title="Track Services"
                                                                >
                                                                    <Eye size={14} /> Track
                                                                </button>
                                                                {hasPermission('services', 'edit') && (
                                                                    <button
                                                                        className="btn btn-sm btn-secondary"
                                                                        onClick={() => { setSelectedSubscription(sub); setShowEditSubModal(true); }}
                                                                        title="Edit Subscription"
                                                                    >
                                                                        <Edit size={14} />
                                                                    </button>
                                                                )}
                                                                {isAdmin && (
                                                                    <button
                                                                        className="btn btn-sm"
                                                                        style={{ background: '#ef4444', color: 'white' }}
                                                                        onClick={() => setDeleteSubConfirm({ id: sub.id, name: sub.customerName })}
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showPlanModal && (
                <CreatePlanModal onClose={() => setShowPlanModal(false)} onSuccess={fetchPlans} />
            )}

            {showAssignModal && selectedPlan && (
                <AssignPlanModal
                    plan={selectedPlan}
                    onClose={() => { setShowAssignModal(false); setSelectedPlan(null); }}
                    onSuccess={() => {
                        fetchSubscriptions();
                        setActiveTab('subscriptions');
                        alert('Plan assigned successfully!');
                    }}
                />
            )}

            {showTrackingModal && selectedSubscription && (
                <ServiceTrackingModal
                    subscription={selectedSubscription}
                    onClose={() => { setShowTrackingModal(false); setSelectedSubscription(null); }}
                    onUpdate={fetchSubscriptions}
                />
            )}

            {showEditSubModal && selectedSubscription && (
                <EditSubscriptionModal
                    subscription={selectedSubscription}
                    onClose={() => { setShowEditSubModal(false); setSelectedSubscription(null); }}
                    onSuccess={fetchSubscriptions}
                />
            )}

            {/* Subscription Delete Confirmation Modal */}
            {deleteSubConfirm && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2><Trash2 size={20} color="#ef4444" /> Delete Subscription</h2>
                            <button className="modal-close" onClick={() => setDeleteSubConfirm(null)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <Trash2 size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>Delete subscription for "{deleteSubConfirm.name}"?</h3>
                            <p style={{ color: 'var(--navy-500)' }}>
                                This will permanently remove this AMC subscription and all tracking data.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteSubConfirm(null)}>Cancel</button>
                            <button
                                className="btn"
                                style={{ background: '#ef4444', color: 'white' }}
                                onClick={() => deleteSubscription(deleteSubConfirm.id)}
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .amc-page { padding-bottom: 2rem; }
                
                .tab-group {
                    display: flex;
                    background: var(--navy-800);
                    padding: 4px;
                    border-radius: 8px;
                    gap: 4px;
                }
                
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border: none;
                    background: transparent;
                    color: rgba(255,255,255,0.6);
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                
                .tab-btn.active {
                    background: var(--primary);
                    color: white;
                }
                
                .section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .plans-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }
                
                .plan-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                    border: 2px solid var(--navy-100);
                    overflow: hidden;
                    transition: transform 0.2s;
                }
                
                .plan-card.premium {
                    border-color: #d4af37;
                }
                
                .plan-card.compact {
                    border-color: #2d5a27;
                }
                
                .plan-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.1);
                }
                
                .plan-header {
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    color: white;
                    padding: 20px;
                }
                
                .plan-card.premium .plan-header {
                    background: linear-gradient(135deg, #1a1a2e, #2d2d44);
                    border-bottom: 3px solid #d4af37;
                }
                
                .plan-card.compact .plan-header {
                    background: linear-gradient(135deg, #1a3a1a, #2d5a27);
                }
                
                .plan-type-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    margin-bottom: 8px;
                }
                
                .plan-card.premium .plan-type-badge {
                    background: linear-gradient(135deg, #d4af37, #c9a227);
                    color: #1a1a2e;
                }
                
                .plan-header h3 { margin: 0; font-size: 1.25rem; }
                
                .plan-pricing {
                    padding: 15px 20px;
                    background: var(--navy-50);
                    border-bottom: 1px solid var(--navy-100);
                }
                
                .vehicle-prices {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    text-align: center;
                }
                
                .vehicle-prices > div small {
                    display: block;
                    color: var(--navy-500);
                    font-size: 0.75rem;
                    margin-bottom: 2px;
                }
                
                .vehicle-prices > div strong {
                    color: var(--primary);
                    font-size: 1rem;
                }
                
                .plan-body { padding: 20px; }
                
                .plan-feature {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 10px;
                    color: var(--navy-700);
                    font-weight: 500;
                }
                
                .plan-feature.service-item {
                    font-size: 0.9rem;
                    color: var(--navy-600);
                }
                
                .plan-feature svg {
                    color: var(--success);
                    flex-shrink: 0;
                }
                
                .plan-desc {
                    margin-top: 16px;
                    font-size: 0.9rem;
                    color: var(--navy-500);
                    line-height: 1.5;
                }
                
                .plan-footer {
                    padding: 20px;
                    border-top: 1px solid var(--navy-50);
                    background: var(--navy-50);
                }
                
                .usage-bar-wrapper { min-width: 140px; }
                .usage-text { font-size: 0.8rem; margin-bottom: 4px; }
                
                .usage-progress {
                    height: 6px;
                    background: var(--navy-100);
                    border-radius: 3px;
                    overflow: hidden;
                }
                
                .usage-fill {
                    height: 100%;
                    background: var(--success);
                    border-radius: 3px;
                    transition: width 0.3s;
                }
                
                @media (max-width: 768px) {
                    .section-header { flex-direction: column; gap: 1rem; align-items: stretch; }
                    .tab-btn span { display: none; }
                }
            `}</style>
        </div>
    );
};

const CreatePlanModal = ({ onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [planType, setPlanType] = useState('compact');
    const [vehiclePrices, setVehiclePrices] = useState({ hatchback: '', sedan: '', suv: '' });
    const [services, setServices] = useState([
        { name: '', quantity: 1, description: '' }
    ]);

    // Load default plan data when type changes
    useEffect(() => {
        const defaults = DEFAULT_AMC_PLANS[planType];
        if (defaults) {
            setVehiclePrices(defaults.prices);
            setServices(defaults.services);
        }
    }, [planType]);

    const addService = () => {
        setServices([...services, { name: '', quantity: 1, description: '' }]);
    };

    const updateService = (index, field, value) => {
        const updated = [...services];
        updated[index][field] = field === 'quantity' ? Number(value) : value;
        setServices(updated);
    };

    const removeService = (index) => {
        setServices(services.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const formData = new FormData(e.target);

        try {
            await addDoc(collection(db, 'amc_plans'), {
                name: formData.get('name'),
                planType: planType,
                prices: {
                    hatchback: Number(vehiclePrices.hatchback),
                    sedan: Number(vehiclePrices.sedan),
                    suv: Number(vehiclePrices.suv)
                },
                validityMonths: Number(formData.get('validity')),
                services: services.filter(s => s.name.trim()),
                description: formData.get('description'),
                isActive: true,
                createdAt: serverTimestamp()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error creating plan: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2>Create AMC Package</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Plan Type Selection */}
                        <div className="form-group">
                            <label>Plan Type *</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                {['compact', 'premium'].map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setPlanType(type)}
                                        style={{
                                            flex: 1,
                                            padding: '1rem',
                                            border: planType === type ? '2px solid var(--primary)' : '2px solid var(--navy-200)',
                                            borderRadius: '8px',
                                            background: planType === type ? 'var(--primary-light)' : 'white',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            textTransform: 'uppercase'
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label>Package Name *</label>
                                <input
                                    name="name"
                                    required
                                    defaultValue={DEFAULT_AMC_PLANS[planType]?.name}
                                    placeholder="e.g. Compact Package"
                                />
                            </div>
                            <div className="form-group">
                                <label>Validity (Months) *</label>
                                <input name="validity" type="number" required defaultValue={12} placeholder="12" />
                            </div>
                        </div>

                        {/* Vehicle Type Pricing */}
                        <div className="form-group" style={{
                            padding: '1rem',
                            background: 'var(--navy-50)',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                        }}>
                            <label style={{ marginBottom: '0.75rem', display: 'block', fontWeight: '600' }}>
                                Vehicle Type Pricing (₹)
                            </label>
                            <div className="form-row" style={{ gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Hatchback</label>
                                    <input
                                        type="number"
                                        value={vehiclePrices.hatchback}
                                        onChange={(e) => setVehiclePrices({ ...vehiclePrices, hatchback: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Sedan</label>
                                    <input
                                        type="number"
                                        value={vehiclePrices.sedan}
                                        onChange={(e) => setVehiclePrices({ ...vehiclePrices, sedan: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>SUV</label>
                                    <input
                                        type="number"
                                        value={vehiclePrices.suv}
                                        onChange={(e) => setVehiclePrices({ ...vehiclePrices, suv: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Services Included */}
                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Services Included</span>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={addService}>
                                    + Add Service
                                </button>
                            </label>
                            <div style={{ marginTop: '0.75rem' }}>
                                {services.map((service, idx) => (
                                    <div key={idx} style={{
                                        display: 'flex',
                                        gap: '0.5rem',
                                        marginBottom: '0.5rem',
                                        padding: '0.75rem',
                                        background: 'var(--navy-50)',
                                        borderRadius: '8px'
                                    }}>
                                        <input
                                            placeholder="Service Name"
                                            value={service.name}
                                            onChange={(e) => updateService(idx, 'name', e.target.value)}
                                            style={{ flex: 2 }}
                                        />
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={service.quantity}
                                            onChange={(e) => updateService(idx, 'quantity', e.target.value)}
                                            style={{ width: '70px' }}
                                            min="1"
                                        />
                                        <input
                                            placeholder="Description"
                                            value={service.description}
                                            onChange={(e) => updateService(idx, 'description', e.target.value)}
                                            style={{ flex: 1 }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeService(idx)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: 'var(--danger)',
                                                cursor: 'pointer',
                                                padding: '0.5rem'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea name="description" placeholder="Package details..." rows="2"></textarea>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Package'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AssignPlanModal = ({ plan, onClose, onSuccess }) => {
    const [activeTab, setActiveTab] = useState('existing'); // existing | new
    const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', vehicleNumber: '' });
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [vehicleType, setVehicleType] = useState('hatchback');
    const [salePrice, setSalePrice] = useState(0);

    // Filter customers
    const filteredCustomers = customers.filter(c => 
        (c.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
        (c.phone || '').includes(searchTerm) || 
        (c.licensePlate?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const customersLoading = false; // Placeholder if used in render

    useEffect(() => {
        const fetchCustomers = async () => {
            const snap = await getDocs(collection(db, 'customers'));
            setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };
        fetchCustomers();
    }, []);

    const getPrice = () => {
        return plan.prices?.[vehicleType] || plan.price || 0;
    };

    // Update sale price when vehicle type changes
    useEffect(() => {
        setSalePrice(getPrice());
    }, [vehicleType, plan]);

    const handleAssign = async () => {
        setLoading(true);
        try {
            let customerId = selectedCustomer?.id;
            let custName = selectedCustomer?.name;
            let custPhone = selectedCustomer?.phone;
            let custVehicle = selectedCustomer?.licensePlate;

            // If creating new customer
            if (activeTab === 'new') {
                if (!newCustomer.name || !newCustomer.phone || !newCustomer.vehicleNumber) {
                    alert('Please fill all customer details');
                    setLoading(false);
                    return;
                }

                // Add new customer
                const custRef = await addDoc(collection(db, 'customers'), {
                    name: newCustomer.name,
                    phone: newCustomer.phone,
                    licensePlate: newCustomer.vehicleNumber,
                    vehicleType: vehicleType,
                    createdAt: serverTimestamp()
                });
                customerId = custRef.id;
                custName = newCustomer.name;
                custPhone = newCustomer.phone;
                custVehicle = newCustomer.vehicleNumber;
            } else {
                if (!selectedCustomer) return;
            }

            const startDate = new Date();
            const expiryDate = new Date();
            expiryDate.setMonth(startDate.getMonth() + plan.validityMonths);

            // Build service tracking structure
            const serviceTracking = (plan.services || []).map(service => ({
                serviceType: service.name,
                description: service.description,
                totalAllowed: service.quantity,
                usages: []
            }));

            // If no services defined, create default wash tracking
            if (serviceTracking.length === 0 && plan.serviceCount) {
                serviceTracking.push({
                    serviceType: 'Wash',
                    totalAllowed: plan.serviceCount,
                    usages: []
                });
            }

            // Create Subscription
            const subscriptionData = {
                customerId: customerId,
                customerName: custName || custPhone || 'Unknown',
                customerPhone: custPhone,
                vehicleNumber: custVehicle || 'N/A',
                vehicleType: vehicleType,
                planId: plan.id,
                planName: plan.name,
                price: Number(salePrice),
                startDate: startDate,
                expiryDate: expiryDate,
                status: 'active',
                remainingServices: plan.serviceCount, // Legacy support
                services: serviceTracking,
                createdAt: serverTimestamp()
            };
            
            await addDoc(collection(db, 'customer_amc_subscriptions'), subscriptionData);

            // Create Invoice
            const invoiceData = {
                invoiceNumber: `INV-AMC-${Date.now()}`,
                customerId: customerId,
                customerName: custName || custPhone || 'Unknown',
                customerPhone: custPhone,
                vehicleNumber: custVehicle || 'N/A',
                type: 'AMC Subscription',
                items: [
                    {
                        description: `AMC Plan: ${plan.name} (${vehicleType})`,
                        quantity: 1,
                        price: Number(salePrice),
                        total: Number(salePrice)
                    }
                ],
                subtotal: Number(salePrice),
                total: Number(salePrice),
                amountPaid: Number(salePrice),
                balance: 0,
                status: 'paid',
                date: serverTimestamp(),
                createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'invoices'), invoiceData);

            alert('Plan assigned and invoice generated successfully!');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error("Error assigning plan: ", error);
            alert("Error assigning plan");
        }
        setLoading(false);
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Assign {plan.name}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {/* Vehicle Type Selection */}
                    <div className="form-group">
                        <label>Vehicle Type *</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {['hatchback', 'sedan', 'suv'].map(type => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setVehicleType(type)}
                                    style={{
                                        flex: 1,
                                        padding: '0.75rem',
                                        border: vehicleType === type ? '2px solid var(--primary)' : '2px solid var(--navy-200)',
                                        borderRadius: '8px',
                                        background: vehicleType === type ? 'var(--primary-light)' : 'white',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        textTransform: 'capitalize'
                                    }}
                                >
                                    {type === 'suv' ? 'SUV' : type}
                                    <br />
                                    <small style={{ fontWeight: 'normal', color: 'var(--primary)' }}>
                                        ₹{plan.prices?.[type]?.toLocaleString() || plan.price}
                                    </small>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Price Override */}
                    <div className="form-group">
                        <label>Sale Price (₹)</label>
                        <input
                            type="number"
                            value={salePrice}
                            onChange={e => setSalePrice(e.target.value)}
                            style={{ 
                                fontWeight: 'bold', 
                                fontSize: '1.1rem', 
                                color: 'var(--primary)',
                                padding: '0.75rem',
                                width: '100%',
                                boxSizing: 'border-box',
                                border: '1px solid var(--navy-200)',
                                borderRadius: '8px'
                            }}
                        />
                        <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--navy-500)' }}>
                            Standard Price: ₹{getPrice().toLocaleString()}
                        </div>
                    </div>

                    {/* Customer Selection Tabs */}
                    <div style={{ display: 'flex', borderBottom: '1px solid var(--navy-100)', marginBottom: '1rem' }}>
                        <button
                            type="button"
                            onClick={() => setActiveTab('existing')}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderBottom: activeTab === 'existing' ? '2px solid var(--primary)' : 'none',
                                color: activeTab === 'existing' ? 'var(--primary)' : 'var(--navy-500)',
                                fontWeight: '600',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            Existing Customer
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('new')}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                borderBottom: activeTab === 'new' ? '2px solid var(--primary)' : 'none',
                                color: activeTab === 'new' ? 'var(--primary)' : 'var(--navy-500)',
                                fontWeight: '600',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            + New Customer
                        </button>
                    </div>

                    {activeTab === 'existing' ? (
                        <div className="form-group">
                            <div className="search-box mb-2">
                                <Search size={16} />
                                <input
                                    placeholder="Search by name, phone or number plate..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--navy-200)', borderRadius: '8px', minHeight: '100px' }}>
                                {customersLoading ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--navy-400)' }}>
                                        Loading customers...
                                    </div>
                                ) : customers.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--navy-400)' }}>
                                        No customers in database.
                                    </div>
                                ) : filteredCustomers.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--navy-400)' }}>
                                        No customers found for "{searchTerm}"
                                    </div>
                                ) : (
                                    filteredCustomers.map(c => (
                                        <div
                                            key={c.id}
                                            onClick={() => setSelectedCustomer(c)}
                                            style={{
                                                padding: '12px',
                                                borderBottom: '1px solid #eee',
                                                background: selectedCustomer?.id === c.id ? 'var(--primary-light)' : 'white',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <strong>{c.name || 'N/A'}</strong> - {c.phone}
                                            <br />
                                            <small style={{ color: 'var(--primary)', fontWeight: '600' }}>{c.licensePlate}</small>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="form-column" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label>Customer Name *</label>
                                <input
                                    value={newCustomer.name}
                                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    placeholder="Enter full name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone Number *</label>
                                <input
                                    value={newCustomer.phone}
                                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                    placeholder="Enter phone number"
                                    type="tel"
                                />
                            </div>
                            <div className="form-group">
                                <label>Vehicle Number (License Plate) *</label>
                                <input
                                    value={newCustomer.vehicleNumber}
                                    onChange={e => setNewCustomer({ ...newCustomer, vehicleNumber: e.target.value.toUpperCase() })}
                                    placeholder="e.g. TN01AB1234"
                                />
                            </div>
                        </div>
                    )}

                    {(selectedCustomer || (activeTab === 'new' && newCustomer.name)) && (
                        <div style={{
                            padding: '1rem',
                            background: 'var(--primary-light)',
                            borderRadius: '8px',
                            marginTop: '1rem'
                        }}>
                            <strong>Summary:</strong>
                            <p style={{ margin: '0.5rem 0 0' }}>
                                {activeTab === 'existing' ? selectedCustomer.name : newCustomer.name} - {plan.name} ({vehicleType.toUpperCase()})
                                <br />
                                <strong style={{ color: 'var(--primary)', fontSize: '1.25rem' }}>
                                    ₹{Number(salePrice).toLocaleString()}
                                </strong>
                            </p>
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleAssign}
                        disabled={loading || (activeTab === 'existing' && !selectedCustomer) || (activeTab === 'new' && (!newCustomer.name || !newCustomer.phone || !newCustomer.vehicleNumber))}
                    >
                        {loading ? 'Assigning...' : 'Confirm Assignment'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EditSubscriptionModal = ({ subscription, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [expiryDate, setExpiryDate] = useState(
        subscription.expiryDate?.toDate ? subscription.expiryDate.toDate().toISOString().split('T')[0] :
            new Date(subscription.expiryDate.seconds * 1000).toISOString().split('T')[0]
    );
    const [status, setStatus] = useState(subscription.status);
    const [vehicleNumber, setVehicleNumber] = useState(subscription.vehicleNumber);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateDoc(doc(db, 'customer_amc_subscriptions', subscription.id), {
                expiryDate: Timestamp.fromDate(new Date(expiryDate)),
                status,
                vehicleNumber,
                updatedAt: serverTimestamp()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Error updating subscription');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Edit Subscription</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleUpdate}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Customer</label>
                            <input value={subscription.customerName} disabled style={{ background: '#f5f5f5' }} />
                        </div>
                        <div className="form-group">
                            <label>Vehicle Number</label>
                            <input
                                value={vehicleNumber}
                                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Expiry Date</label>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Status</label>
                            <select value={status} onChange={(e) => setStatus(e.target.value)}>
                                <option value="active">Active</option>
                                <option value="expired">Expired</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Updating...' : 'Update Subscription'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Service Tracking Modal - Track individual service usage with tick boxes
const ServiceTrackingModal = ({ subscription, onClose, onUpdate }) => {
    const [serviceTracking, setServiceTracking] = useState(subscription.serviceTracking || []);
    const [saving, setSaving] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [showAddUsage, setShowAddUsage] = useState(false);
    const [usageDate, setUsageDate] = useState(new Date().toISOString().split('T')[0]);
    const [usageNotes, setUsageNotes] = useState('');

    const addUsage = async (serviceIndex) => {
        if (!usageDate) return;

        setSaving(true);
        const updated = [...serviceTracking];
        updated[serviceIndex].usages.push({
            date: usageDate,
            notes: usageNotes,
            addedAt: new Date().toISOString()
        });

        try {
            await updateDoc(doc(db, 'customer_amc_subscriptions', subscription.id), {
                serviceTracking: updated,
                updatedAt: serverTimestamp()
            });
            setServiceTracking(updated);
            setShowAddUsage(false);
            setSelectedService(null);
            setUsageNotes('');
            onUpdate();
        } catch (error) {
            console.error('Error updating usage:', error);
            alert('Error saving: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const removeUsage = async (serviceIndex, usageIndex) => {
        if (!window.confirm('Remove this service usage?')) return;

        setSaving(true);
        const updated = [...serviceTracking];
        updated[serviceIndex].usages.splice(usageIndex, 1);

        try {
            await updateDoc(doc(db, 'customer_amc_subscriptions', subscription.id), {
                serviceTracking: updated,
                updatedAt: serverTimestamp()
            });
            setServiceTracking(updated);
            onUpdate();
        } catch (error) {
            console.error('Error removing usage:', error);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2>
                        <ShieldCheck size={20} /> Service Tracking
                    </h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {/* Customer Info */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: subscription.planType === 'premium' ? 'linear-gradient(135deg, #1a1a2e, #2d2d44)' : 'linear-gradient(135deg, #1a3a1a, #2d5a27)',
                        borderRadius: '8px',
                        color: 'white',
                        marginBottom: '1.5rem'
                    }}>
                        <div>
                            <strong style={{ fontSize: '1.25rem' }}>{subscription.customerName}</strong>
                            <p style={{ margin: '0.25rem 0', opacity: 0.8 }}>{subscription.vehicleNumber}</p>
                            <span style={{
                                display: 'inline-block',
                                padding: '4px 12px',
                                background: subscription.planType === 'premium' ? '#d4af37' : 'rgba(255,255,255,0.2)',
                                color: subscription.planType === 'premium' ? '#1a1a2e' : 'white',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                textTransform: 'uppercase'
                            }}>
                                {subscription.planType || 'Standard'}
                            </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, opacity: 0.8 }}>Plan: {subscription.planName}</p>
                            <p style={{ margin: '0.25rem 0', opacity: 0.8 }}>
                                Vehicle: {subscription.vehicleType?.toUpperCase()}
                            </p>
                        </div>
                    </div>

                    {/* Service Tracking */}
                    {serviceTracking.map((service, serviceIndex) => (
                        <div key={serviceIndex} style={{
                            marginBottom: '1.5rem',
                            border: '1px solid var(--navy-200)',
                            borderRadius: '8px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                background: 'var(--navy-50)'
                            }}>
                                <div>
                                    <strong>{service.serviceType}</strong>
                                    {service.description && (
                                        <span style={{ color: 'var(--navy-500)', marginLeft: '0.5rem' }}>
                                            - {service.description}
                                        </span>
                                    )}
                                    <br />
                                    <small style={{ color: 'var(--navy-500)' }}>
                                        {service.usages?.length || 0} / {service.totalAllowed} used
                                    </small>
                                </div>
                                <button
                                    className="btn btn-sm btn-primary"
                                    onClick={() => { setSelectedService(serviceIndex); setShowAddUsage(true); }}
                                    disabled={(service.usages?.length || 0) >= service.totalAllowed}
                                >
                                    + Add Usage
                                </button>
                            </div>

                            {/* Tick Boxes */}
                            <div style={{ padding: '1rem' }}>
                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '0.5rem'
                                }}>
                                    {Array.from({ length: service.totalAllowed }).map((_, idx) => {
                                        const usage = service.usages?.[idx];
                                        const isUsed = !!usage;
                                        return (
                                            <div
                                                key={idx}
                                                title={isUsed ? `Used on ${usage.date}${usage.notes ? ': ' + usage.notes : ''}` : `Service ${idx + 1}`}
                                                onClick={() => isUsed && removeUsage(serviceIndex, idx)}
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: isUsed ? 'var(--success)' : 'var(--navy-100)',
                                                    color: isUsed ? 'white' : 'var(--navy-400)',
                                                    cursor: isUsed ? 'pointer' : 'default',
                                                    transition: 'all 0.2s',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {isUsed ? <Check size={18} /> : idx + 1}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Usage Details */}
                                {service.usages?.length > 0 && (
                                    <div style={{ marginTop: '1rem' }}>
                                        <small style={{ color: 'var(--navy-500)', display: 'block', marginBottom: '0.5rem' }}>
                                            Usage History:
                                        </small>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {service.usages.map((usage, idx) => (
                                                <span
                                                    key={idx}
                                                    style={{
                                                        padding: '4px 8px',
                                                        background: 'var(--success-light)',
                                                        borderRadius: '4px',
                                                        fontSize: '0.75rem',
                                                        color: 'var(--success-dark)'
                                                    }}
                                                >
                                                    #{idx + 1}: {usage.date}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Add Usage Modal */}
                    {showAddUsage && selectedService !== null && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1001
                        }}>
                            <div style={{
                                background: 'white',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                width: '90%',
                                maxWidth: '400px'
                            }}>
                                <h3 style={{ margin: '0 0 1rem' }}>
                                    Add Usage - {serviceTracking[selectedService]?.serviceType}
                                </h3>
                                <div className="form-group">
                                    <label>Date *</label>
                                    <input
                                        type="date"
                                        value={usageDate}
                                        onChange={(e) => setUsageDate(e.target.value)}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Notes (Optional)</label>
                                    <input
                                        type="text"
                                        value={usageNotes}
                                        onChange={(e) => setUsageNotes(e.target.value)}
                                        placeholder="e.g., Regular wash, Employee name..."
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => { setShowAddUsage(false); setSelectedService(null); }}
                                        style={{ flex: 1 }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => addUsage(selectedService)}
                                        disabled={saving || !usageDate}
                                        style={{ flex: 1 }}
                                    >
                                        {saving ? 'Saving...' : 'Add Usage'}
                                    </button>
                                </div>
                            </div>
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

export default AMCPlans;
