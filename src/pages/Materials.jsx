import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { logAction } from '../utils/logger';
import {
    collection,
    query,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    serverTimestamp
} from 'firebase/firestore';
import {
    Package,
    Plus,
    Search,
    Edit,
    Trash2,
    AlertTriangle,
    Droplets,
    Beaker,
    FileText,
    Download,
    TrendingDown,
    BarChart3,
    Car,
    Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Materials = () => {
    const { hasPermission, userProfile } = useAuth();
    const [materials, setMaterials] = useState([]);
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingMaterial, setEditingMaterial] = useState(null);
    const [viewingMaterial, setViewingMaterial] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }

    useEffect(() => {
        fetchMaterials();
        fetchServices();
    }, []);

    const fetchMaterials = async () => {
        try {
            setLoading(true);
            const materialsRef = collection(db, 'materials');
            const q = query(materialsRef, orderBy('name', 'asc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(data);
        } catch (error) {
            console.error('Error fetching materials:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchServices = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'services'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServices(data.filter(s => s.materials?.length > 0));
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    // Calculate material usage across services
    const getMaterialUsage = (materialId) => {
        const usage = [];
        services.forEach(service => {
            const mat = service.materials?.find(m => m.materialId === materialId);
            if (mat) {
                usage.push({
                    serviceName: service.name,
                    quantity: mat.quantity,
                    unit: mat.unit
                });
            }
        });
        return usage;
    };

    const deleteMaterial = async (id) => {
        try {
            const material = materials.find(m => m.id === id);
            await deleteDoc(doc(db, 'materials', id));
            await logAction(userProfile, 'delete', 'materials', `Deleted material: ${material?.name}`, { materialId: id, name: material?.name });
            setMaterials(prev => prev.filter(m => m.id !== id));
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Error deleting material:', error);
            alert('Error deleting material');
        }
    };

    const exportToExcel = () => {
        const exportData = materials.map(m => ({
            Name: m.name,
            Category: m.category,
            'Current Stock': m.currentStock,
            Unit: m.unit,
            'Min Stock Level': m.minStockLevel,
            'Cost Per Unit (₹)': m.costPerUnit,
            Status: m.currentStock <= m.minStockLevel ? 'Low Stock' : 'OK'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Materials');
        XLSX.writeFile(wb, `materials_inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'chemicals': return <Beaker size={18} />;
            case 'water': return <Droplets size={18} />;
            case 'consumables': return <FileText size={18} />;
            default: return <Package size={18} />;
        }
    };

    const getCategoryColor = (category) => {
        switch (category) {
            case 'chemicals': return '#8b5cf6';
            case 'water': return '#3b82f6';
            case 'consumables': return '#f59e0b';
            default: return '#6b7280';
        }
    };

    // Calculate stats
    const totalItems = materials.length;
    const lowStockItems = materials.filter(m => m.currentStock <= m.minStockLevel).length;
    const totalValue = materials.reduce((sum, m) => sum + (m.currentStock * m.costPerUnit || 0), 0);

    const filteredMaterials = materials.filter(material => {
        const matchesSearch = !searchTerm ||
            material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            material.category?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !categoryFilter || material.category === categoryFilter;
        const matchesStock = !showLowStock || material.currentStock <= material.minStockLevel;
        return matchesSearch && matchesCategory && matchesStock;
    });

    return (
        <div className="materials-page">
            <div className="page-header">
                <div>
                    <h1><Package size={28} /> Materials & Inventory</h1>
                    <p className="subtitle">Manage raw materials and supplies</p>
                </div>
                <div className="header-actions">
                    <Link to="/material-usage" className="btn btn-secondary">
                        <BarChart3 size={18} /> View Usage
                    </Link>
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <Download size={18} /> Export
                    </button>
                    <button className="btn btn-primary" onClick={() => { setEditingMaterial(null); setShowModal(true); }}>
                        <Plus size={18} /> Add Material
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <Package size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{totalItems}</span>
                        <span className="stat-label">Total Items</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{lowStockItems}</span>
                        <span className="stat-label">Low Stock</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <TrendingDown size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{formatCurrency(totalValue)}</span>
                        <span className="stat-label">Inventory Value</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="search-filter-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search materials..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button 
                        className={`btn ${showLowStock ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => setShowLowStock(!showLowStock)}
                        style={{ whiteSpace: 'nowrap' }}
                    >
                        <AlertTriangle size={16} /> 
                        {showLowStock ? 'Show All' : 'Low Stock Only'}
                    </button>
                    <select
                        className="filter-select"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="">All Categories</option>
                        <option value="chemicals">Chemicals & Liquids</option>
                        <option value="water">Water</option>
                        <option value="consumables">Consumables</option>
                        <option value="equipment">Equipment</option>
                        <option value="other">Other</option>
                    </select>
                </div>
            </div>

            {/* Materials List */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state">
                            <div className="loader"></div>
                        </div>
                    ) : filteredMaterials.length === 0 ? (
                        <div className="empty-state">
                            <Package size={48} />
                            <p>No materials found</p>
                            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                                <Plus size={18} /> Add First Material
                            </button>
                        </div>
                    ) : (
                        <div className="materials-list">
                            {filteredMaterials.map(material => {
                                const isLowStock = material.currentStock <= material.minStockLevel;
                                return (
                                    <div key={material.id} className={`material-item ${isLowStock ? 'low-stock' : ''}`}>
                                        <div
                                            className="material-icon"
                                            style={{ background: `${getCategoryColor(material.category)}20`, color: getCategoryColor(material.category) }}
                                        >
                                            {getCategoryIcon(material.category)}
                                        </div>
                                        <div className="material-details">
                                            <div className="material-header">
                                                <h4>{material.name}</h4>
                                                {isLowStock && (
                                                    <span className="badge badge-warning">
                                                        <AlertTriangle size={12} /> Low Stock
                                                    </span>
                                                )}
                                            </div>
                                            <div className="material-meta">
                                                <span className="category">{material.category}</span>
                                                <span className="separator">•</span>
                                                <span className="cost">{formatCurrency(material.costPerUnit)} / {material.unit}</span>
                                            </div>
                                        </div>
                                        <div className="material-stock">
                                            <span className="stock-value">{material.currentStock}</span>
                                            <span className="stock-unit">{material.unit}</span>
                                            <span className="stock-min">Min: {material.minStockLevel}</span>
                                        </div>
                                        <div className="material-actions">
                                            <button
                                                className="btn-icon"
                                                onClick={() => setViewingMaterial(material)}
                                                title="View"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            {hasPermission('expenses', 'edit') && (
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => { setEditingMaterial(material); setShowModal(true); }}
                                                    title="Edit"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                            )}
                                            {hasPermission('expenses', 'delete') && (
                                                <button
                                                    className="btn-icon danger"
                                                    onClick={() => setDeleteConfirm({ id: material.id, name: material.name })}
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <MaterialModal
                    material={editingMaterial}
                    onClose={() => { setShowModal(false); setEditingMaterial(null); }}
                    onSuccess={fetchMaterials}
                />
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="modal">
                    <div className="modal-content" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h2><AlertTriangle size={20} color="#ef4444" /> Confirm Delete</h2>
                            <button className="modal-close" onClick={() => setDeleteConfirm(null)}>&times;</button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            <AlertTriangle size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                            <h3 style={{ marginBottom: '0.5rem' }}>Delete "{deleteConfirm.name}"?</h3>
                            <p style={{ color: 'var(--navy-500)' }}>
                                This action cannot be undone. This will permanently delete this material from inventory.
                            </p>
                        </div>
                        <div className="modal-footer" style={{ justifyContent: 'center' }}>
                            <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                            <button
                                className="btn"
                                style={{ background: '#ef4444', color: 'white' }}
                                onClick={() => deleteMaterial(deleteConfirm.id)}
                            >
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* View Material Modal */}
            {viewingMaterial && (
                <div className="modal">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2><Package size={20} /> {viewingMaterial.name}</h2>
                            <button className="modal-close" onClick={() => setViewingMaterial(null)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: viewingMaterial.currentStock <= viewingMaterial.minStockLevel ? '#ef4444' : 'var(--primary)' }}>
                                        {viewingMaterial.currentStock}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Current Stock ({viewingMaterial.unit})</div>
                                </div>
                                <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{viewingMaterial.minStockLevel}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>Minimum Level</div>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <p><strong>Category:</strong> {viewingMaterial.category}</p>
                                <p><strong>Cost per {viewingMaterial.unit}:</strong> ₹{viewingMaterial.costPerUnit}</p>
                                <p><strong>Total Value:</strong> ₹{(viewingMaterial.currentStock * viewingMaterial.costPerUnit).toLocaleString()}</p>
                                {viewingMaterial.linkedServiceIds?.length > 0 && (
                                    <div>
                                        <strong>Linked Services:</strong>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            {viewingMaterial.linkedServiceIds.map(sId => {
                                                const svc = services.find(s => s.id === sId);
                                                return svc ? (
                                                    <span key={sId} className="badge badge-confirmed">{svc.name}</span>
                                                ) : null;
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            {hasPermission('expenses', 'edit') && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { setEditingMaterial(viewingMaterial); setShowModal(true); setViewingMaterial(null); }}
                                >
                                    <Edit size={16} /> Edit
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setViewingMaterial(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .materials-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .material-item {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1rem;
                    background: var(--navy-50);
                    border-radius: var(--radius-md);
                    transition: all 0.2s ease;
                    position: relative;
                }

                .material-item:hover {
                    background: var(--navy-100);
                }

                .material-item.low-stock {
                    background: #fef3c7;
                    border: 1px solid #f59e0b;
                }

                .material-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: var(--radius-md);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .material-details {
                    flex: 1;
                    min-width: 0;
                }

                .material-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .material-header h4 {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 600;
                }

                .material-meta {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-top: 0.25rem;
                    font-size: 0.8rem;
                    color: var(--navy-500);
                }

                .material-meta .category {
                    text-transform: capitalize;
                }

                .material-meta .separator {
                    opacity: 0.5;
                }

                .material-stock {
                    text-align: right;
                    padding: 0.5rem 1rem;
                    background: white;
                    border-radius: var(--radius-sm);
                    min-width: 90px;
                }

                .material-stock .stock-value {
                    display: block;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--navy-900);
                }

                .material-stock .stock-unit {
                    font-size: 0.75rem;
                    color: var(--navy-500);
                    text-transform: lowercase;
                }

                .material-stock .stock-min {
                    display: block;
                    font-size: 0.7rem;
                    color: var(--navy-400);
                    margin-top: 0.25rem;
                }

                .material-actions {
                    display: flex;
                    gap: 0.25rem;
                }

                .badge-warning {
                    background: #f59e0b;
                    color: white;
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    font-size: 0.7rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                }

                .material-usage {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                    padding: 0.5rem 1rem;
                    min-width: 180px;
                }

                .usage-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.25rem;
                    padding: 0.25rem 0.5rem;
                    background: var(--primary-light);
                    color: var(--primary);
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 500;
                }

                .no-usage {
                    color: var(--navy-400);
                    font-size: 0.75rem;
                    font-style: italic;
                }

                @media (max-width: 640px) {
                    .material-item {
                        flex-wrap: wrap;
                        padding-bottom: 3.5rem; /* Make space for actions at bottom if absolute, OR we change strategy completely */
                        /* Better strategy: Flex flow column-ish for actions at bottom */
                        padding: 1rem;
                    }

                    /* Let's revamp the mobile layout to be cleaner */
                    .material-item {
                        display: grid;
                        grid-template-columns: auto 1fr;
                        grid-template-areas: 
                            "icon details"
                            "stock stock"
                            "actions actions";
                        gap: 0.75rem;
                        align-items: start;
                    }

                    .material-icon {
                        grid-area: icon;
                    }

                    .material-details {
                        grid-area: details;
                    }

                    .material-stock {
                        grid-area: stock;
                        width: 100%;
                        text-align: left;
                        display: flex;
                        align-items: center;
                        gap: 1rem;
                        background: rgba(255,255,255,0.5);
                        margin: 0;
                        justify-content: space-between;
                    }
                    
                    .material-stock .stock-value {
                        font-size: 1.1rem;
                        display: inline-block;
                        margin-right: 0.25rem;
                    }
                    
                    .material-stock .stock-unit {
                        display: inline-block;
                    }

                    .material-stock .stock-min {
                        margin: 0;
                    }

                    .material-actions {
                        grid-area: actions;
                        position: static; /* Remove absolute */
                        width: 100%;
                        justify-content: flex-end;
                        border-top: 1px solid rgba(0,0,0,0.05);
                        padding-top: 0.75rem;
                        margin-top: 0;
                        gap: 1rem;
                    }
                    
                    /* Make buttons bigger/easier to tap on mobile */
                    .material-actions .btn-icon {
                        width: auto;
                        height: 32px;
                        padding: 0 0.75rem;
                        border-radius: 4px;
                        background: white;
                        border: 1px solid var(--navy-200);
                        display: flex;
                        gap: 0.5rem;
                        font-size: 0.8rem;
                    }
                    
                    .material-actions .btn-icon::after {
                        content: attr(title); /* Show label on mobile */
                    }
                }
            `}</style>
        </div>
    );
};

// Material Add/Edit Modal
const MaterialModal = ({ material, onClose, onSuccess }) => {
    const { userProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const form = e.target;
        const formData = new FormData(form);

        const data = {
            name: formData.get('name'),
            category: formData.get('category'),
            unit: formData.get('unit'),
            currentStock: Number(formData.get('currentStock')),
            minStockLevel: Number(formData.get('minStockLevel')),
            costPerUnit: Number(formData.get('costPerUnit')),
            isActive: true,
            updatedAt: serverTimestamp()
        };

        try {
            if (material) {
                await updateDoc(doc(db, 'materials', material.id), data);
                await logAction(userProfile, 'update', 'materials', `Updated material: ${data.name}`, { materialId: material.id, ...data });
            } else {
                data.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'materials'), data);
                await logAction(userProfile, 'create', 'materials', `Added new material: ${data.name}`, { materialId: docRef.id, ...data });
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving material:', error);
            alert('Error saving material. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2>{material ? 'Edit Material' : 'Add Material'}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Material Name *</label>
                            <input name="name" defaultValue={material?.name} required placeholder="e.g., Car Shampoo" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Category *</label>
                                <select name="category" defaultValue={material?.category || ''} required>
                                    <option value="">Select Category</option>
                                    <option value="chemicals">Chemicals & Liquids</option>
                                    <option value="water">Water</option>
                                    <option value="consumables">Consumables</option>
                                    <option value="equipment">Equipment</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Unit *</label>
                                <select name="unit" defaultValue={material?.unit || ''} required>
                                    <option value="">Select Unit</option>
                                    <option value="liters">Liters</option>
                                    <option value="ml">Milliliters (ml)</option>
                                    <option value="pieces">Pieces</option>
                                    <option value="sheets">Sheets</option>
                                    <option value="kg">Kilograms</option>
                                    <option value="grams">Grams</option>
                                    <option value="units">Units</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Current Stock *</label>
                                <input
                                    name="currentStock"
                                    type="number"
                                    step="0.01"
                                    defaultValue={material?.currentStock || 0}
                                    required
                                    placeholder="50"
                                />
                            </div>
                            <div className="form-group">
                                <label>Minimum Stock Level *</label>
                                <input
                                    name="minStockLevel"
                                    type="number"
                                    step="0.01"
                                    defaultValue={material?.minStockLevel || 0}
                                    required
                                    placeholder="10"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Cost Per Unit (₹) *</label>
                            <input
                                name="costPerUnit"
                                type="number"
                                step="0.01"
                                defaultValue={material?.costPerUnit || 0}
                                required
                                placeholder="150"
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : (material ? 'Update' : 'Add Material')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Materials;
