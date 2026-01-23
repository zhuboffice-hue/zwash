import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../config/firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import {
    ArrowLeft,
    BarChart3,
    Package,
    Car,
    Droplets,
    Beaker,
    FileText,
    Download,
    IndianRupee
} from 'lucide-react';
import * as XLSX from 'xlsx';

const MaterialUsageAnalytics = () => {
    const navigate = useNavigate();
    const [materials, setMaterials] = useState([]);
    const [services, setServices] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedService, setSelectedService] = useState('all');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Fetch materials
            const materialsRef = collection(db, 'materials');
            const matQuery = query(materialsRef, orderBy('name', 'asc'));
            const matSnapshot = await getDocs(matQuery);
            const matData = matSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(matData);

            // Fetch services with materials
            const servicesSnapshot = await getDocs(collection(db, 'services'));
            const servicesData = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServices(servicesData.filter(s => s.materials?.length > 0 || s.price));

            // Fetch completed bookings for usage tracking
            const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
            const bookingsData = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setBookings(bookingsData.filter(b => b.status === 'completed'));

        } catch (error) {
            console.error('Error fetching data:', error);
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

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'chemicals': return <Beaker size={16} />;
            case 'water': return <Droplets size={16} />;
            case 'consumables': return <FileText size={16} />;
            default: return <Package size={16} />;
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

    // Calculate service cost breakdown with materials
    const getServiceAnalytics = () => {
        return services.map(service => {
            const materialsUsed = service.materials || [];
            let materialCost = 0;

            const materialDetails = materialsUsed.map(mat => {
                const material = materials.find(m => m.id === mat.materialId);
                if (material) {
                    let quantity = mat.quantity || 0;

                    // Unit conversion logic
                    if ((material.unit === 'liters' || material.unit === 'l') && (mat.unit === 'ml')) {
                        quantity = quantity / 1000;
                    } else if ((material.unit === 'kg' || material.unit === 'kilograms') && (mat.unit === 'g' || mat.unit === 'grams')) {
                        quantity = quantity / 1000;
                    }

                    const cost = (material.costPerUnit || 0) * quantity;
                    materialCost += cost;
                    return {
                        name: material.name,
                        category: material.category,
                        quantity: mat.quantity,
                        unit: mat.unit || material.unit,
                        costPerUnit: material.costPerUnit,
                        totalCost: cost
                    };
                }
                return null;
            }).filter(Boolean);

            const servicePrice = service.price || 0;
            const profit = servicePrice - materialCost;
            const profitMargin = servicePrice > 0 ? ((profit / servicePrice) * 100).toFixed(1) : 0;

            // Count completed bookings for this service
            const completedBookings = bookings.filter(b => b.serviceId === service.id).length;

            return {
                id: service.id,
                name: service.name,
                price: servicePrice,
                materialCost,
                profit,
                profitMargin,
                materials: materialDetails,
                bookingsCount: completedBookings,
                totalRevenue: servicePrice * completedBookings,
                totalMaterialCost: materialCost * completedBookings
            };
        });
    };

    // Get material usage summary across all services
    const getMaterialSummary = () => {
        const summary = {};

        services.forEach(service => {
            (service.materials || []).forEach(mat => {
                const material = materials.find(m => m.id === mat.materialId);
                if (material) {
                    if (!summary[material.id]) {
                        summary[material.id] = {
                            id: material.id,
                            name: material.name,
                            category: material.category,
                            costPerUnit: material.costPerUnit,
                            unit: material.unit,
                            usedInServices: [],
                            totalQuantity: 0,
                            totalCost: 0
                        };
                    }

                    const bookingsCount = bookings.filter(b => b.serviceId === service.id).length;

                    let quantityPerService = mat.quantity || 0;
                    // Normalize to material's base unit for cost and total tracking
                    if ((material.unit === 'liters' || material.unit === 'l') && (mat.unit === 'ml')) {
                        quantityPerService = quantityPerService / 1000;
                    } else if ((material.unit === 'kg' || material.unit === 'kilograms') && (mat.unit === 'g' || mat.unit === 'grams')) {
                        quantityPerService = quantityPerService / 1000;
                    }

                    const quantityUsed = quantityPerService * bookingsCount;
                    const cost = (material.costPerUnit || 0) * quantityUsed;

                    summary[material.id].usedInServices.push({
                        serviceName: service.name,
                        quantityPerService: mat.quantity + ' ' + (mat.unit || material.unit), // Display original
                        bookingsCount,
                        totalQuantity: quantityUsed
                    });
                    summary[material.id].totalQuantity += quantityUsed;
                    summary[material.id].totalCost += cost;
                }
            });
        });

        return Object.values(summary).sort((a, b) => b.totalCost - a.totalCost);
    };

    const exportToExcel = () => {
        const serviceAnalytics = getServiceAnalytics();
        const materialSummary = getMaterialSummary();

        // Service Cost Sheet
        const serviceData = serviceAnalytics.map(s => ({
            'Service Name': s.name,
            'Service Price (₹)': s.price,
            'Material Cost (₹)': s.materialCost,
            'Profit (₹)': s.profit,
            'Profit Margin (%)': s.profitMargin,
            'Completed Bookings': s.bookingsCount,
            'Total Revenue (₹)': s.totalRevenue,
            'Total Material Cost (₹)': s.totalMaterialCost
        }));

        // Material Usage Sheet
        const materialData = materialSummary.map(m => ({
            'Material Name': m.name,
            'Category': m.category,
            'Cost Per Unit (₹)': m.costPerUnit,
            'Unit': m.unit,
            'Total Quantity Used': m.totalQuantity,
            'Total Cost (₹)': m.totalCost,
            'Used In Services': m.usedInServices.map(s => s.serviceName).join(', ')
        }));

        const wb = XLSX.utils.book_new();

        const ws1 = XLSX.utils.json_to_sheet(serviceData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Service Analytics');

        const ws2 = XLSX.utils.json_to_sheet(materialData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Material Usage');

        XLSX.writeFile(wb, `material_usage_analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const serviceAnalytics = getServiceAnalytics();
    const materialSummary = getMaterialSummary();
    const filteredServices = selectedService === 'all'
        ? serviceAnalytics
        : serviceAnalytics.filter(s => s.id === selectedService);

    // Calculate totals
    const totalRevenue = serviceAnalytics.reduce((sum, s) => sum + s.totalRevenue, 0);
    const totalMaterialCost = serviceAnalytics.reduce((sum, s) => sum + s.totalMaterialCost, 0);
    const totalProfit = totalRevenue - totalMaterialCost;

    if (loading) {
        return (
            <div className="usage-analytics-page">
                <div className="page-loader">
                    <div className="loader"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="usage-analytics-page">
            {/* Header */}
            <div className="analytics-header">
                <button className="back-btn" onClick={() => navigate('/materials')}>
                    <ArrowLeft size={20} />
                </button>
                <div className="header-content">
                    <h1><BarChart3 size={28} /> Material Usage Analytics</h1>
                    <p>Complete analytics of products used in each service</p>
                </div>
                <button className="btn btn-primary" onClick={exportToExcel}>
                    <Download size={18} /> Export
                </button>
            </div>

            {/* Summary Stats */}
            <div className="analytics-stats">
                <div className="stat-card blue">
                    <IndianRupee size={24} />
                    <div>
                        <span className="value">{formatCurrency(totalRevenue)}</span>
                        <span className="label">Total Revenue</span>
                    </div>
                </div>
                <div className="stat-card orange">
                    <Package size={24} />
                    <div>
                        <span className="value">{formatCurrency(totalMaterialCost)}</span>
                        <span className="label">Total Material Cost</span>
                    </div>
                </div>
                <div className="stat-card green">
                    <BarChart3 size={24} />
                    <div>
                        <span className="value">{formatCurrency(totalProfit)}</span>
                        <span className="label">Total Profit</span>
                    </div>
                </div>
            </div>

            {/* Service Filter */}
            <div className="filter-section">
                <select
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="filter-select"
                >
                    <option value="all">All Services</option>
                    {services.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>

            {/* Service-wise Analytics */}
            <div className="analytics-section">
                <h2><Car size={20} /> Service-wise Cost Breakdown</h2>
                <div className="service-cards">
                    {filteredServices.map(service => (
                        <div key={service.id} className="service-card">
                            <div className="service-header">
                                <h3>{service.name}</h3>
                                <span className="price">{formatCurrency(service.price)}</span>
                            </div>
                            <div className="service-stats">
                                <div className="stat">
                                    <span className="label">Material Cost</span>
                                    <span className="value cost">{formatCurrency(service.materialCost)}</span>
                                </div>
                                <div className="stat">
                                    <span className="label">Profit</span>
                                    <span className="value profit">{formatCurrency(service.profit)}</span>
                                </div>
                                <div className="stat">
                                    <span className="label">Margin</span>
                                    <span className="value margin">{service.profitMargin}%</span>
                                </div>
                                <div className="stat">
                                    <span className="label">Completed</span>
                                    <span className="value bookings">{service.bookingsCount}</span>
                                </div>
                            </div>

                            {service.materials.length > 0 && (
                                <div className="materials-breakdown">
                                    <h4>Materials Used</h4>
                                    <div className="materials-list">
                                        {service.materials.map((mat, idx) => (
                                            <div key={idx} className="material-row">
                                                <div className="material-info">
                                                    <span
                                                        className="icon"
                                                        style={{
                                                            background: `${getCategoryColor(mat.category)}20`,
                                                            color: getCategoryColor(mat.category)
                                                        }}
                                                    >
                                                        {getCategoryIcon(mat.category)}
                                                    </span>
                                                    <span className="name">{mat.name}</span>
                                                </div>
                                                <div className="material-qty">
                                                    {mat.quantity} {mat.unit}
                                                </div>
                                                <div className="material-cost">
                                                    {formatCurrency(mat.totalCost)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Material Usage Summary */}
            <div className="analytics-section">
                <h2><Package size={20} /> Material Usage Summary</h2>
                <div className="material-summary-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Material</th>
                                <th>Category</th>
                                <th>Cost/Unit</th>
                                <th>Total Used</th>
                                <th>Total Cost</th>
                                <th>Used In</th>
                            </tr>
                        </thead>
                        <tbody>
                            {materialSummary.map(material => (
                                <tr key={material.id}>
                                    <td>
                                        <div className="material-name">
                                            <span
                                                className="icon"
                                                style={{
                                                    background: `${getCategoryColor(material.category)}20`,
                                                    color: getCategoryColor(material.category)
                                                }}
                                            >
                                                {getCategoryIcon(material.category)}
                                            </span>
                                            {material.name}
                                        </div>
                                    </td>
                                    <td className="capitalize">{material.category}</td>
                                    <td>{formatCurrency(material.costPerUnit)}</td>
                                    <td>{material.totalQuantity.toFixed(2)} {material.unit}</td>
                                    <td className="cost">{formatCurrency(material.totalCost)}</td>
                                    <td>
                                        <div className="services-tags">
                                            {material.usedInServices.map((s, idx) => (
                                                <span key={idx} className="tag">{s.serviceName}</span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .usage-analytics-page {
                    min-height: 100vh;
                    background: linear-gradient(135deg, var(--navy-50) 0%, #e9eef6 100%);
                    padding: 1.5rem;
                }
                
                .analytics-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    background: white;
                    padding: 1.25rem 1.5rem;
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-md);
                }
                
                .back-btn {
                    width: 44px;
                    height: 44px;
                    border-radius: var(--radius-md);
                    background: var(--navy-100);
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                
                .back-btn:hover {
                    background: var(--navy-200);
                }
                
                .header-content {
                    flex: 1;
                }
                
                .header-content h1 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    color: var(--navy-900);
                    margin: 0;
                }
                
                .header-content p {
                    color: var(--navy-500);
                    font-size: 0.9rem;
                    margin: 0.25rem 0 0;
                }
                
                .analytics-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }
                
                .stat-card {
                    background: white;
                    padding: 1.25rem;
                    border-radius: var(--radius-lg);
                    box-shadow: var(--shadow-sm);
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }
                
                .stat-card.blue { border-left: 4px solid #3b82f6; }
                .stat-card.blue svg { color: #3b82f6; }
                .stat-card.orange { border-left: 4px solid #f59e0b; }
                .stat-card.orange svg { color: #f59e0b; }
                .stat-card.green { border-left: 4px solid #10b981; }
                .stat-card.green svg { color: #10b981; }
                
                .stat-card .value {
                    display: block;
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--navy-900);
                }
                
                .stat-card .label {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--navy-500);
                }
                
                .filter-section {
                    margin-bottom: 1.5rem;
                }
                
                .analytics-section {
                    background: white;
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                    box-shadow: var(--shadow-sm);
                }
                
                .analytics-section h2 {
                    font-size: 1.1rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin: 0 0 1rem;
                    color: var(--navy-800);
                }
                
                .service-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 1rem;
                }
                
                .service-card {
                    background: var(--navy-50);
                    border-radius: var(--radius-md);
                    padding: 1rem;
                    border: 1px solid var(--navy-100);
                }
                
                .service-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                    padding-bottom: 0.75rem;
                    border-bottom: 1px solid var(--navy-200);
                }
                
                .service-header h3 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 600;
                }
                
                .service-header .price {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--primary);
                }
                
                .service-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }
                
                .service-stats .stat {
                    text-align: center;
                    padding: 0.5rem;
                    background: white;
                    border-radius: 6px;
                }
                
                .service-stats .label {
                    display: block;
                    font-size: 0.65rem;
                    color: var(--navy-500);
                    text-transform: uppercase;
                }
                
                .service-stats .value {
                    display: block;
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                
                .service-stats .cost { color: #f59e0b; }
                .service-stats .profit { color: #10b981; }
                .service-stats .margin { color: var(--primary); }
                .service-stats .bookings { color: var(--navy-700); }
                
                .materials-breakdown h4 {
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: var(--navy-600);
                    margin: 0 0 0.5rem;
                }
                
                .materials-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .material-row {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.5rem;
                    background: white;
                    border-radius: 6px;
                    font-size: 0.85rem;
                }
                
                .material-info {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .material-info .icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .material-qty {
                    color: var(--navy-500);
                    font-size: 0.8rem;
                }
                
                .material-cost {
                    font-weight: 600;
                    color: #f59e0b;
                }
                
                /* Material Summary Table */
                .material-summary-table {
                    overflow-x: auto;
                }
                
                .material-summary-table table {
                    width: 100%;
                    border-collapse: collapse;
                }
                
                .material-summary-table th {
                    text-align: left;
                    padding: 0.75rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    color: var(--navy-500);
                    background: var(--navy-50);
                    border-bottom: 2px solid var(--navy-200);
                }
                
                .material-summary-table td {
                    padding: 0.75rem;
                    border-bottom: 1px solid var(--navy-100);
                    font-size: 0.85rem;
                }
                
                .material-name {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                
                .material-name .icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                
                .capitalize { text-transform: capitalize; }
                .cost { color: #f59e0b; font-weight: 600; }
                
                .services-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.25rem;
                }
                
                .tag {
                    display: inline-block;
                    padding: 0.2rem 0.5rem;
                    background: var(--primary-light);
                    color: var(--primary);
                    border-radius: 4px;
                    font-size: 0.7rem;
                    font-weight: 500;
                }
                
                @media (max-width: 768px) {
                    .usage-analytics-page {
                        padding: 1rem;
                        padding-bottom: 100px;
                    }
                    
                    .analytics-header {
                        flex-wrap: wrap;
                        padding: 1rem;
                    }
                    
                    .analytics-header .btn {
                        width: 100%;
                        margin-top: 0.5rem;
                    }
                    
                    .header-content h1 {
                        font-size: 1.25rem;
                    }
                    
                    .service-stats {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    
                    .service-cards {
                        grid-template-columns: 1fr;
                    }
                    
                    .stat-card .value {
                        font-size: 1rem;
                    }
                    
                    .material-summary-table {
                        margin: 0 -1rem;
                        padding: 0 1rem;
                    }
                }
                
                @media (max-width: 480px) {
                    .analytics-stats {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
};

export default MaterialUsageAnalytics;
