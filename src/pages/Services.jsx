import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    serverTimestamp
} from 'firebase/firestore';
import {
    Car,
    Plus,
    Edit,
    Trash2,
    Clock,
    IndianRupee,
    ToggleLeft,
    ToggleRight,
    Package,
    ShieldCheck,
    Database,
    Filter,
    UploadCloud
} from 'lucide-react';
import { seedCeramicServices } from '../utils/seedCeramic';

// Service Catalogue - Default services to seed
// Service Catalogue - Default services to seed
const SERVICE_CATALOGUE = [
    // Detailed Wash Category
    {
        name: 'Quick Strike Wash',
        category: 'Detailed Wash',
        description: 'Foam wash, Undercarriage wash, Floor vacuum, Paper mats, Perfume spray, RO water, Wheel cleaning',
        prices: { hatchback: 499, sedan: 599, suv: 699, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 30,
        sortOrder: 1
    },
    {
        name: 'Tactical Wash',
        category: 'Detailed Wash',
        description: 'All of Quick Strike Wash included, Windshield protection, Dashboard clean & polish, Engine bay (optional), Pre-clean, Wheel polish',
        prices: { hatchback: 699, sedan: 799, suv: 899, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 45,
        sortOrder: 2
    },
    {
        name: 'Commando Clean',
        category: 'Detailed Wash',
        description: 'All of Tactical Wash included, Interior vacuum, Dashboard/Console polish, Tire & rim enrichment, Exterior plastic polish, Panel wipe',
        prices: { hatchback: 799, sedan: 899, suv: 999, luxury_suv: 1199, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 60,
        sortOrder: 3
    },
    {
        name: 'Counter Ceramic Wash',
        category: 'Detailed Wash',
        description: 'All of Commando Clean included, Ceramic shampoo, Ceramic foam wash, Rainwater repellent, Ceramic spray, Anti-bacterial protection',
        prices: { hatchback: 1799, sedan: 1899, suv: 1999, luxury_suv: 2099, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 90,
        sortOrder: 4
    },
    {
        name: 'Gear Guard', // (Interior & Exterior Revival)
        category: 'Detailed Wash',
        description: 'Headliner revive, Interior blowout, Interior glow-up, Dashboard makeover, Exterior reboot, AC vent revival',
        prices: { hatchback: 2799, sedan: 2899, suv: 3199, luxury_suv: 3499, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 120,
        sortOrder: 5
    },
    // Paint Correction & Polish Category
    {
        name: 'Cadet Shine', // (Basic Polish)
        category: 'Paint Correction (Polish)',
        description: 'Single-stage machine polish, Light swirl reduction, Enhanced gloss',
        prices: { hatchback: 3799, sedan: 4199, suv: 4599, luxury_suv: 0, scooter: 0, bike: 1799, superbike: 0 }, // Bike price mapped to 'bike'
        durationMinutes: 180,
        sortOrder: 6
    },
    {
        name: 'Sergeant Polish', // (Intermediate Correction)
        category: 'Paint Correction (Polish)',
        description: '3-stage polish, Moderate scratch removal, Deep gloss',
        prices: { hatchback: 5499, sedan: 5999, suv: 6399, luxury_suv: 0, scooter: 0, bike: 2499, superbike: 0 }, // Bike price mapped to 'bike'
        durationMinutes: 240,
        sortOrder: 7
    },
    {
        name: "Commander's Finish", // (Premium Correction)
        category: 'Paint Correction (Polish)',
        description: 'Multi-stage correction, Heavy scratch & oxidation removal, Showroom finish',
        prices: { hatchback: 7399, sedan: 7899, suv: 8299, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 360,
        sortOrder: 8
    },
    {
        name: 'Counter Patch Removal', // (60×60 cm)
        category: 'Paint Correction (Polish)',
        description: 'Moderate scratch removal, 2-stage machine polish (60x60 cm)',
        prices: { hatchback: 1499, sedan: 1499, suv: 1499, luxury_suv: 1499, scooter: 0, bike: 0, superbike: 0 }, // Flat price for area
        durationMinutes: 60,
        sortOrder: 9
    },
    {
        name: 'Single Side Guard',
        category: 'Paint Correction (Polish)',
        description: 'Moderate scratch removal, 2-stage polish, Single side/front/back',
        prices: { hatchback: 2999, sedan: 3299, suv: 3499, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 120,
        sortOrder: 10
    },
    {
        name: 'Bullet Shield Teflon Armor',
        category: 'Paint Correction (Polish)',
        description: 'Paint protection, Enhanced gloss, Scratch & fade resistance',
        prices: { hatchback: 3899, sedan: 4199, suv: 4399, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 120,
        sortOrder: 11
    },
    {
        name: 'Counter Salt Eliminator',
        category: 'Paint Correction (Polish)',
        description: 'Hard water removal, Two-stage solution, Machine polish',
        prices: { hatchback: 1199, sedan: 3499, suv: 4499, luxury_suv: 5499, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 90,
        sortOrder: 12
    },
    // Mechanical / Restore Your Ride
    {
        name: 'Operation Chill Storm', // A/C Gas Filling
        category: 'Mechanical',
        description: 'Full gas refill, Leak check, Vent temperature test (R134a/R1234yf)',
        prices: { hatchback: 899, sedan: 899, suv: 1099, luxury_suv: 1099, scooter: 0, bike: 0, superbike: 0 }, // Using R134a base for hatch/sedan, Large for SUV fallback logic might be needed or just avg
        durationMinutes: 60,
        sortOrder: 13
    },
    {
        name: 'Line of Fire', // Wheel Alignment
        category: 'Mechanical',
        description: '3D Wheel Alignment',
        prices: { hatchback: 449, sedan: 449, suv: 449, luxury_suv: 449, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 45,
        sortOrder: 14
    },
    {
        name: 'Mission: Spin Sync', // Wheel Balancing
        category: 'Mechanical',
        description: 'Computerized Balancing',
        prices: { hatchback: 349, sedan: 349, suv: 349, luxury_suv: 349, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 45,
        sortOrder: 15
    },
    {
        name: 'Underbody Armor', // Paint Protection
        category: 'Mechanical', // Or keep in Paint/Detailing? User grouped under "Restore Your Ride"
        description: 'Underbody Paint Protection / Anti-rust',
        prices: { hatchback: 2749, sedan: 3249, suv: 3749, luxury_suv: 0, scooter: 0, bike: 0, superbike: 0 },
        durationMinutes: 90,
        sortOrder: 16
    },
    // 2-Wheeler Specific
    {
        name: "Rider's Regiment Cleanse",
        category: 'Detailed Wash',
        description: 'Foam wash, Spray polish, Pre-clean, Wheel clean & polish',
        prices: { hatchback: 0, sedan: 0, suv: 0, luxury_suv: 0, scooter: 199, bike: 249, superbike: 299 },
        durationMinutes: 20,
        sortOrder: 17
    },
    {
        name: 'Battle Glide',
        category: 'Detailed Wash',
        description: 'Chain Lubrication',
        prices: { hatchback: 0, sedan: 0, suv: 0, luxury_suv: 0, scooter: 69, bike: 69, superbike: 69 },
        durationMinutes: 10,
        sortOrder: 18
    }
];

const CATEGORIES = ['All', 'Detailed Wash', 'Paint Correction (Polish)', 'Ceramic', 'Mechanical'];

const Services = () => {
    const { hasPermission } = useAuth();
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [seeding, setSeeding] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const snapshot = await getDocs(collection(db, 'services'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            data.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            setServices(data);
        } catch (error) {
            console.error('Error fetching services:', error);
        } finally {
            setLoading(false);
        }
    };

    // Seed all services from catalogue
    const seedServices = async () => {
        if (!window.confirm('This will sync your database with the catalogue. Existing services will be updated with new vehicle types/prices. manual changes to existing prices might be overwritten if not carefully merged (we preserve existing if key exists). Continue?')) return;

        setSeeding(true);
        try {
            for (const service of SERVICE_CATALOGUE) {
                // Check if service already exists by name
                const existingQuery = query(collection(db, 'services'), where('name', '==', service.name));
                const existing = await getDocs(existingQuery);

                if (existing.empty) {
                    await addDoc(collection(db, 'services'), {
                        ...service,
                        isActive: true,
                        materials: [],
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                } else {
                    // Update existing service with new prices (merge)
                    const docId = existing.docs[0].id;
                    const currentData = existing.docs[0].data();

                    // Merge prices: catalogue is base, current overrides it. 
                    // BUT for new keys (bike, etc) which are missing in current, catalogue values will take effect.
                    // Wait, if I want to ADD missing keys, I should do:
                    // newPrices = { ...service.prices, ...currentData.prices }
                    // However, if currentData.prices is missing 'bike', it will take from service.prices.
                    // If currentData.prices has 'sedan', it keeps it. Perfect.

                    const updatedPrices = {
                        ...service.prices,
                        ...(currentData.prices || {})
                    };

                    await updateDoc(doc(db, 'services', docId), {
                        prices: updatedPrices,
                        category: service.category, // Sync category/sortOrder too if needed
                        sortOrder: service.sortOrder,
                        updatedAt: serverTimestamp()
                    });
                }
            }
            alert('Services synced successfully! Please refresh.');
            fetchServices();
        } catch (error) {
            console.error('Error seeding services:', error);
            alert('Error seeding services: ' + error.message);
        } finally {
            setSeeding(false);
        }
    };

    const handleSeedCeramic = async () => {
        if (!window.confirm('Add Ceramic Coating services?')) return;
        setSeeding(true);
        try {
            const res = await seedCeramicServices(db, { email: 'Admin' });
            alert(`Ceramic Seeding: Added ${res.addedCount} services.`);
            fetchServices();
        } catch (error) {
            console.error(error);
            alert('Failed: ' + error.message);
        } finally {
            setSeeding(false);
        }
    };

    const toggleServiceActive = async (serviceId, currentActive) => {
        try {
            await updateDoc(doc(db, 'services', serviceId), {
                isActive: !currentActive,
                updatedAt: serverTimestamp()
            });
            setServices(prev => prev.map(s =>
                s.id === serviceId ? { ...s, isActive: !currentActive } : s
            ));
        } catch (error) {
            console.error('Error toggling service:', error);
        }
    };

    const deleteService = async (serviceId) => {
        if (!window.confirm('Are you sure you want to delete this service?')) return;

        try {
            await deleteDoc(doc(db, 'services', serviceId));
            setServices(prev => prev.filter(s => s.id !== serviceId));
        } catch (error) {
            console.error('Error deleting service:', error);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatDuration = (minutes) => {
        if (!minutes) return '-';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    };

    // Filter services by category
    const filteredServices = selectedCategory === 'All'
        ? services
        : services.filter(s => s.category === selectedCategory);

    // Group services by category for display
    const groupedServices = filteredServices.reduce((acc, service) => {
        const cat = service.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(service);
        return acc;
    }, {});

    return (
        <div className="services-page">
            <div className="page-header">
                <div>
                    <h1><Car size={28} /> Services</h1>
                    <p className="subtitle">Manage your car wash services</p>
                </div>
                <div className="header-actions">
                    {hasPermission('services', 'create') && (
                        <>
                            <Link to="/amc-plans" className="btn btn-secondary">
                                <ShieldCheck size={18} /> Manage AMC Packages
                            </Link>
                            <button className="btn btn-secondary" onClick={handleSeedCeramic} disabled={seeding}>
                                <UploadCloud size={18} /> Seed Ceramic
                            </button>
                            <button className="btn btn-secondary" onClick={seedServices} disabled={seeding}>
                                {seeding ? 'Syncing...' : 'Sync / Seed Services'}
                            </button>
                            <button className="btn btn-primary" onClick={() => { setEditingService(null); setShowModal(true); }}>
                                <Plus size={18} /> Add Service
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Category Filter */}
            <div className="category-filter" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedCategory(cat)}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <Car size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{services.length}</span>
                        <span className="stat-label">Total Services</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <ToggleRight size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{services.filter(s => s.isActive).length}</span>
                        <span className="stat-label">Active</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Filter size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{Object.keys(groupedServices).length}</span>
                        <span className="stat-label">Categories</span>
                    </div>
                </div>
            </div>

            {/* Services by Category */}
            {loading ? (
                <div className="empty-state">
                    <div className="loader"></div>
                    <p>Loading services...</p>
                </div>
            ) : Object.keys(groupedServices).length === 0 ? (
                <div className="empty-state">
                    <Car size={48} />
                    <p>No services found</p>
                    <p style={{ color: 'var(--navy-400)', marginBottom: '1rem' }}>
                        Click "Seed All Services" to add the complete service catalogue
                    </p>
                    {hasPermission('services', 'create') && (
                        <button className="btn btn-primary" onClick={seedServices} disabled={seeding}>
                            <Database size={18} /> {seeding ? 'Seeding...' : 'Seed All Services'}
                        </button>
                    )}
                </div>
            ) : (
                Object.entries(groupedServices).map(([category, categoryServices]) => (
                    <div key={category} className="category-section" style={{ marginBottom: '2rem' }}>
                        <h2 style={{
                            fontSize: '1.25rem',
                            fontWeight: '600',
                            color: 'var(--navy-800)',
                            marginBottom: '1rem',
                            paddingBottom: '0.5rem',
                            borderBottom: '2px solid var(--primary)'
                        }}>
                            {category} ({categoryServices.length})
                        </h2>
                        <div className="services-grid">
                            {categoryServices.map(service => (
                                <div key={service.id} className={`service-card ${!service.isActive ? 'inactive' : ''}`}>
                                    <div className="service-card-header">
                                        <h3>{service.name}</h3>
                                        {hasPermission('services', 'edit') && (
                                            <button
                                                className="btn-icon"
                                                onClick={() => toggleServiceActive(service.id, service.isActive)}
                                                title={service.isActive ? 'Deactivate' : 'Activate'}
                                            >
                                                {service.isActive ? <ToggleRight size={20} color="var(--success)" /> : <ToggleLeft size={20} />}
                                            </button>
                                        )}
                                    </div>
                                    <p className="service-description">{service.description || 'No description'}</p>

                                    {/* Vehicle Type Pricing */}
                                    {service.prices ? (
                                        <div className="vehicle-prices" style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
                                            gap: '0.5rem',
                                            marginBottom: '1rem',
                                            padding: '0.75rem',
                                            background: 'var(--navy-50)',
                                            borderRadius: '8px'
                                        }}>
                                            {/* Render all non-zero prices dynamically */}
                                            {['scooter', 'bike', 'superbike', 'hatchback', 'sedan', 'suv', 'luxury_suv'].map(type => (
                                                service.prices[type] > 0 && (
                                                    <div key={type} style={{ textAlign: 'center' }}>
                                                        <small style={{ color: 'var(--navy-500)', display: 'block', fontSize: '0.7rem', textTransform: 'capitalize' }}>
                                                            {type.replace('_', ' ')}
                                                        </small>
                                                        <strong style={{ color: 'var(--navy-800)', fontSize: '0.9rem' }}>
                                                            ₹{service.prices[type]}
                                                        </strong>
                                                    </div>
                                                )
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="service-meta">
                                            <span><IndianRupee size={16} /> {formatCurrency(service.price)}</span>
                                        </div>
                                    )}

                                    <div className="service-meta">
                                        <span><Clock size={16} /> {formatDuration(service.durationMinutes)}</span>
                                    </div>

                                    {service.materials?.length > 0 && (
                                        <div className="service-materials-badge">
                                            <Package size={14} />
                                            <span>{service.materials.length} material{service.materials.length > 1 ? 's' : ''}</span>
                                        </div>
                                    )}

                                    {hasPermission('services', 'edit') && (
                                        <div className="service-actions">
                                            <button
                                                className="btn btn-sm btn-secondary"
                                                onClick={() => { setEditingService(service); setShowModal(true); }}
                                            >
                                                <Edit size={14} /> Edit
                                            </button>
                                            {hasPermission('services', 'delete') && (
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => deleteService(service.id)}
                                                    style={{ color: 'var(--danger)' }}
                                                >
                                                    <Trash2 size={14} /> Delete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}

            {showModal && (
                <ServiceModal
                    service={editingService}
                    onClose={() => { setShowModal(false); setEditingService(null); }}
                    onSuccess={fetchServices}
                />
            )}

            <style>{`
        .services-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
        }
        
        .service-card {
          background: white;
          border-radius: var(--radius-lg);
          padding: 1.25rem;
          border: 1px solid var(--navy-100);
          box-shadow: var(--shadow-sm);
        }
        
        .service-card.inactive {
          opacity: 0.6;
          background: var(--navy-50);
        }
        
        .service-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.5rem;
        }
        
        .service-card-header h3 {
          font-size: 1.1rem;
          font-weight: 600;
        }
        
        .service-description {
          color: var(--navy-500);
          font-size: 0.875rem;
          margin-bottom: 1rem;
          min-height: 2.5rem;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .service-meta {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.75rem;
          color: var(--navy-700);
          font-weight: 600;
        }
        
        .service-meta span {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }
        
        .service-actions {
          display: flex;
          gap: 0.5rem;
        }

        .service-materials-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          background: var(--primary-light);
          color: var(--primary);
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }
      `}</style>
        </div>
    );
};

const ServiceModal = ({ service, onClose, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [selectedMaterials, setSelectedMaterials] = useState(service?.materials || []);
    const [showMaterialPicker, setShowMaterialPicker] = useState(false);

    // Vehicle type pricing
    const [priceHatchback, setPriceHatchback] = useState(service?.prices?.hatchback || service?.price || 0);
    const [priceSedan, setPriceSedan] = useState(service?.prices?.sedan || service?.price || 0);
    const [priceSuv, setPriceSuv] = useState(service?.prices?.suv || service?.price || 0);
    const [priceLuxurySuv, setPriceLuxurySuv] = useState(service?.prices?.luxury_suv || 0);
    const [priceScooter, setPriceScooter] = useState(service?.prices?.scooter || 0);
    const [priceBike, setPriceBike] = useState(service?.prices?.bike || 0);
    const [priceSuperBike, setPriceSuperBike] = useState(service?.prices?.superbike || 0);

    const [category, setCategory] = useState(service?.category || 'Detailed Wash');

    useEffect(() => {
        fetchMaterials();
    }, []);

    const fetchMaterials = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'materials'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(data);
        } catch (error) {
            console.error('Error fetching materials:', error);
        }
    };

    const unitOptions = [
        { value: 'ml', label: 'ml' },
        { value: 'liters', label: 'Liters' },
        { value: 'grams', label: 'g' },
        { value: 'kg', label: 'kg' },
        { value: 'pieces', label: 'Pieces' },
        { value: 'units', label: 'Units' },
        { value: 'sheets', label: 'Sheets' }
    ];

    const addMaterial = (material) => {
        if (selectedMaterials.find(m => m.materialId === material.id)) return;
        setSelectedMaterials([...selectedMaterials, {
            materialId: material.id,
            materialName: material.name,
            quantity: 1,
            unit: material.unit,
            baseUnit: material.unit,
            costPerUnit: material.costPerUnit
        }]);
        setShowMaterialPicker(false);
    };

    const updateMaterialQuantity = (materialId, quantity) => {
        setSelectedMaterials(prev => prev.map(m =>
            m.materialId === materialId ? { ...m, quantity: Number(quantity) } : m
        ));
    };

    const updateMaterialUnit = (materialId, unit) => {
        setSelectedMaterials(prev => prev.map(m =>
            m.materialId === materialId ? { ...m, unit } : m
        ));
    };

    const removeMaterial = (materialId) => {
        setSelectedMaterials(prev => prev.filter(m => m.materialId !== materialId));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const form = e.target;
        const formData = new FormData(form);

        const data = {
            name: formData.get('name'),
            description: formData.get('description'),
            category: category,
            prices: {
                hatchback: Number(priceHatchback),
                sedan: Number(priceSedan),
                suv: Number(priceSuv),
                luxury_suv: Number(priceLuxurySuv),
                scooter: Number(priceScooter),
                bike: Number(priceBike),
                superbike: Number(priceSuperBike)
            },
            price: Number(priceSedan), // Keep legacy price field for backward compatibility
            durationMinutes: Number(formData.get('duration')),
            sortOrder: Number(formData.get('sortOrder') || 0),
            materials: selectedMaterials,
            isActive: true,
            updatedAt: serverTimestamp()
        };

        try {
            if (service) {
                await updateDoc(doc(db, 'services', service.id), data);
            } else {
                data.createdAt = serverTimestamp();
                await addDoc(collection(db, 'services'), data);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error saving service:', error);
        } finally {
            setLoading(false);
        }
    };

    // Unit conversion ratios (convert to base unit)
    const convertToBaseUnit = (quantity, fromUnit, baseUnit) => {
        // If same unit, no conversion needed
        if (fromUnit === baseUnit) return quantity;

        // Conversion factors
        const conversions = {
            // Volume
            'ml_to_liters': 0.001,
            'liters_to_ml': 1000,
            // Weight
            'grams_to_kg': 0.001,
            'kg_to_grams': 1000,
        };

        const key = `${fromUnit}_to_${baseUnit}`;
        if (conversions[key]) {
            return quantity * conversions[key];
        }

        // Check reverse conversion
        const reverseKey = `${baseUnit}_to_${fromUnit}`;
        if (conversions[reverseKey]) {
            return quantity / conversions[reverseKey];
        }

        return quantity; // No conversion found, return as-is
    };

    const calculateMaterialCost = () => {
        return selectedMaterials.reduce((sum, m) => {
            const convertedQty = convertToBaseUnit(m.quantity, m.unit, m.baseUnit || m.unit);
            return sum + (convertedQty * (m.costPerUnit || 0));
        }, 0);
    };

    const calculateItemCost = (mat) => {
        const convertedQty = convertToBaseUnit(mat.quantity, mat.unit, mat.baseUnit || mat.unit);
        return convertedQty * (mat.costPerUnit || 0);
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2>{service ? 'Edit Service' : 'Add Service'}</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group" style={{ flex: 2 }}>
                                <label>Service Name *</label>
                                <input name="name" defaultValue={service?.name} required placeholder="Premium Wash" />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Category *</label>
                                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                                    <option value="Detailed Wash">Detailed Wash</option>
                                    <option value="Paint Correction (Polish)">Paint Correction (Polish)</option>
                                    <option value="Mechanical">Mechanical (Restore Your Ride)</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Description</label>
                            <textarea name="description" defaultValue={service?.description} rows="2" placeholder="Full exterior and interior cleaning..." />
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

                            <h5 style={{ fontSize: '0.85rem', color: 'var(--navy-600)', margin: '0 0 0.5rem 0', fontWeight: '600' }}>Four Wheelers</h5>
                            <div className="form-row" style={{ gap: '1rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Hatchback</label>
                                    <input type="number" value={priceHatchback || ''} onChange={(e) => setPriceHatchback(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Sedan</label>
                                    <input type="number" value={priceSedan || ''} onChange={(e) => setPriceSedan(e.target.value)} placeholder="0" style={{ fontWeight: '600', borderColor: 'var(--primary)' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>SUV</label>
                                    <input type="number" value={priceSuv || ''} onChange={(e) => setPriceSuv(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>L-SUV</label>
                                    <input type="number" value={priceLuxurySuv || ''} onChange={(e) => setPriceLuxurySuv(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                            </div>

                            <h5 style={{ fontSize: '0.85rem', color: 'var(--navy-600)', margin: '0 0 0.5rem 0', fontWeight: '600' }}>Two Wheelers</h5>
                            <div className="form-row" style={{ gap: '1rem' }}>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Scooter</label>
                                    <input type="number" value={priceScooter || ''} onChange={(e) => setPriceScooter(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Bike / Standard</label>
                                    <input type="number" value={priceBike || ''} onChange={(e) => setPriceBike(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                                <div className="form-group">
                                    <label style={{ fontSize: '0.85rem' }}>Super Bike / Sports</label>
                                    <input type="number" value={priceSuperBike || ''} onChange={(e) => setPriceSuperBike(e.target.value)} placeholder="0" style={{ fontWeight: '600' }} />
                                </div>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>Duration (minutes) *</label>
                                <input name="duration" type="number" defaultValue={service?.durationMinutes} required placeholder="45" />
                            </div>
                            <div className="form-group">
                                <label>Sort Order</label>
                                <input name="sortOrder" type="number" defaultValue={service?.sortOrder || 0} placeholder="0" />
                            </div>
                        </div>

                        {/* Materials Section */}
                        <div className="form-group" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--navy-200)', paddingTop: '1.5rem' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Materials Used</span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setShowMaterialPicker(!showMaterialPicker)}
                                >
                                    + Add Material
                                </button>
                            </label>

                            {showMaterialPicker && (
                                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--navy-50)', borderRadius: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                                    {materials.filter(m => !selectedMaterials.find(s => s.materialId === m.id)).map(material => (
                                        <div
                                            key={material.id}
                                            onClick={() => addMaterial(material)}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                cursor: 'pointer',
                                                borderRadius: '6px',
                                                marginBottom: '0.25rem',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                background: 'white'
                                            }}
                                        >
                                            <span>{material.name}</span>
                                            <span style={{ color: 'var(--navy-400)', fontSize: '0.8rem' }}>
                                                {material.category} • ₹{material.costPerUnit}/{material.unit}
                                            </span>
                                        </div>
                                    ))}
                                    {materials.filter(m => !selectedMaterials.find(s => s.materialId === m.id)).length === 0 && (
                                        <p style={{ color: 'var(--navy-400)', textAlign: 'center', padding: '1rem' }}>No more materials available</p>
                                    )}
                                </div>
                            )}

                            {selectedMaterials.length > 0 ? (
                                <div style={{ marginTop: '0.75rem' }}>
                                    {selectedMaterials.map(mat => (
                                        <div key={mat.materialId} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: 'var(--navy-50)',
                                            borderRadius: '8px',
                                            marginBottom: '0.5rem'
                                        }}>
                                            <span style={{ flex: 1, fontWeight: '500' }}>{mat.materialName}</span>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                value={mat.quantity}
                                                onChange={(e) => updateMaterialQuantity(mat.materialId, e.target.value)}
                                                style={{ width: '70px', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)' }}
                                            />
                                            <select
                                                value={mat.unit}
                                                onChange={(e) => updateMaterialUnit(mat.materialId, e.target.value)}
                                                style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--navy-200)', minWidth: '70px' }}
                                            >
                                                {unitOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                            <span style={{ color: 'var(--navy-400)', fontSize: '0.8rem', minWidth: '50px' }}>
                                                ₹{calculateItemCost(mat).toFixed(2)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => removeMaterial(mat.materialId)}
                                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '0.25rem' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <div style={{ textAlign: 'right', marginTop: '0.5rem', fontWeight: '600', color: 'var(--navy-700)' }}>
                                        Material Cost: ₹{calculateMaterialCost().toFixed(2)}
                                    </div>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--navy-400)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                                    No materials added. Click "Add Material" to select materials used for this service.
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : (service ? 'Update Service' : 'Add Service')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Services;
