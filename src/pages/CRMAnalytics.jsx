import { useState, useEffect } from 'react';
import {
    BarChart3,
    PieChart,
    TrendingUp,
    Users,
    Car,
    MapPin,
    Phone,
    Calendar,
    FileSpreadsheet,
    ArrowUpRight,
    ArrowDownRight,
    Loader
} from 'lucide-react';
import * as XLSX from 'xlsx';

const CRMAnalytics = () => {
    const [loading, setLoading] = useState(true);
    const [workbook, setWorkbook] = useState(null);
    const [allData, setAllData] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        loadExcelFile();
    }, []);

    const loadExcelFile = async () => {
        try {
            setLoading(true);
            const response = await fetch('/crm_old_data.xlsx');
            if (!response.ok) throw new Error('Failed to load Excel file');

            const arrayBuffer = await response.arrayBuffer();
            const wb = XLSX.read(arrayBuffer, { type: 'array' });
            setWorkbook(wb);

            // Process all sheets
            const sheetsData = {};
            wb.SheetNames.forEach(sheetName => {
                const worksheet = wb.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                if (jsonData.length > 1) {
                    sheetsData[sheetName] = {
                        headers: jsonData[0],
                        data: jsonData.slice(1).filter(row => row.some(cell => cell !== '' && cell !== null))
                    };
                }
            });
            setAllData(sheetsData);
            setError(null);
        } catch (err) {
            console.error('Error loading Excel file:', err);
            setError('Failed to load CRM data file.');
        } finally {
            setLoading(false);
        }
    };

    const getMainSheetData = () => {
        return allData['CUSTOMER CONTACT'] || { headers: [], data: [] };
    };

    const getVehicleTypeStats = () => {
        const { headers, data } = getMainSheetData();
        const typeIdx = headers.findIndex(h => h?.toString().toLowerCase().includes('vehi type'));
        if (typeIdx < 0) return [];

        const counts = {};
        data.forEach(row => {
            const type = row[typeIdx]?.toString().toUpperCase() || 'Unknown';
            counts[type] = (counts[type] || 0) + 1;
        });

        const typeLabels = {
            'HA': 'Hatchback',
            'SE': 'Sedan',
            'SU': 'SUV',
            'PS': 'Pre-SUV'
        };

        return Object.entries(counts)
            .map(([type, count]) => ({
                type: typeLabels[type] || type,
                count,
                percentage: Math.round((count / data.length) * 100)
            }))
            .sort((a, b) => b.count - a.count);
    };

    const getLocationStats = () => {
        const { headers, data } = getMainSheetData();
        const placeIdx = headers.findIndex(h => h?.toString().toLowerCase().includes('place'));
        if (placeIdx < 0) return [];

        const counts = {};
        data.forEach(row => {
            const place = row[placeIdx]?.toString().toUpperCase() || 'Unknown';
            if (place && place.trim()) {
                counts[place] = (counts[place] || 0) + 1;
            }
        });

        return Object.entries(counts)
            .map(([location, count]) => ({ location, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    };

    const getSheetComparison = () => {
        return Object.entries(allData).map(([name, { data }]) => ({
            name: name.length > 20 ? name.substring(0, 20) + '...' : name,
            fullName: name,
            count: data.length
        })).sort((a, b) => b.count - a.count);
    };

    const getUniqueCustomers = () => {
        const { headers, data } = getMainSheetData();
        const phoneIdx = headers.findIndex(h =>
            h?.toString().toLowerCase().includes('mobile') || h?.toString().toLowerCase().includes('phone')
        );
        if (phoneIdx < 0) return 0;

        const phones = new Set();
        data.forEach(row => {
            if (row[phoneIdx]) phones.add(row[phoneIdx].toString());
        });
        return phones.size;
    };

    const getUniqueVehicles = () => {
        const { headers, data } = getMainSheetData();
        const vehicleIdx = headers.findIndex(h =>
            h?.toString().toLowerCase().includes('vehicle number')
        );
        if (vehicleIdx < 0) return 0;

        const vehicles = new Set();
        data.forEach(row => {
            if (row[vehicleIdx]) vehicles.add(row[vehicleIdx].toString().toUpperCase());
        });
        return vehicles.size;
    };

    const getTotalRecords = () => {
        return Object.values(allData).reduce((sum, { data }) => sum + data.length, 0);
    };

    const vehicleStats = getVehicleTypeStats();
    const locationStats = getLocationStats();
    const sheetStats = getSheetComparison();
    const maxVehicleCount = Math.max(...vehicleStats.map(v => v.count), 1);
    const maxLocationCount = Math.max(...locationStats.map(l => l.count), 1);
    const maxSheetCount = Math.max(...sheetStats.map(s => s.count), 1);

    const colorPalette = ['#047857', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

    if (loading) {
        return (
            <div className="crm-analytics-page">
                <div className="page-header">
                    <div>
                        <h1><BarChart3 size={28} /> CRM Analytics</h1>
                        <p className="subtitle">Loading analytics data...</p>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <Loader size={48} className="spin" />
                            <p>Analyzing CRM data...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="crm-analytics-page">
                <div className="page-header">
                    <div>
                        <h1><BarChart3 size={28} /> CRM Analytics</h1>
                        <p className="subtitle">Historical data analysis</p>
                    </div>
                </div>
                <div className="card">
                    <div className="card-body">
                        <div className="empty-state">
                            <FileSpreadsheet size={48} />
                            <p>{error}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="crm-analytics-page">
            <div className="page-header">
                <div>
                    <h1><BarChart3 size={28} /> CRM Analytics</h1>
                    <p className="subtitle">Historical customer data insights</p>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="analytics-summary-grid">
                <div className="analytics-summary-card gradient-blue">
                    <div className="summary-icon">
                        <FileSpreadsheet size={24} />
                    </div>
                    <div className="summary-content">
                        <span className="summary-value">{getTotalRecords().toLocaleString()}</span>
                        <span className="summary-label">Total Records</span>
                    </div>
                    <div className="summary-trend positive">
                        <ArrowUpRight size={16} />
                        <span>All Sheets</span>
                    </div>
                </div>
                <div className="analytics-summary-card gradient-green">
                    <div className="summary-icon">
                        <Users size={24} />
                    </div>
                    <div className="summary-content">
                        <span className="summary-value">{getUniqueCustomers().toLocaleString()}</span>
                        <span className="summary-label">Unique Customers</span>
                    </div>
                    <div className="summary-trend positive">
                        <Phone size={16} />
                        <span>By Phone</span>
                    </div>
                </div>
                <div className="analytics-summary-card gradient-purple">
                    <div className="summary-icon">
                        <Car size={24} />
                    </div>
                    <div className="summary-content">
                        <span className="summary-value">{getUniqueVehicles().toLocaleString()}</span>
                        <span className="summary-label">Unique Vehicles</span>
                    </div>
                    <div className="summary-trend positive">
                        <TrendingUp size={16} />
                        <span>Registered</span>
                    </div>
                </div>
                <div className="analytics-summary-card gradient-orange">
                    <div className="summary-icon">
                        <MapPin size={24} />
                    </div>
                    <div className="summary-content">
                        <span className="summary-value">{locationStats.length}</span>
                        <span className="summary-label">Service Areas</span>
                    </div>
                    <div className="summary-trend positive">
                        <ArrowUpRight size={16} />
                        <span>Locations</span>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="analytics-charts-grid">
                {/* Vehicle Type Distribution */}
                <div className="analytics-chart-card">
                    <div className="chart-header">
                        <h3><PieChart size={20} /> Vehicle Type Distribution</h3>
                    </div>
                    <div className="chart-body">
                        <div className="donut-chart-container">
                            <div className="donut-chart">
                                {vehicleStats.map((item, idx) => {
                                    const rotation = vehicleStats.slice(0, idx).reduce((sum, v) => sum + v.percentage, 0) * 3.6;
                                    return (
                                        <div
                                            key={item.type}
                                            className="donut-segment"
                                            style={{
                                                '--rotation': `${rotation}deg`,
                                                '--percentage': item.percentage,
                                                '--color': colorPalette[idx % colorPalette.length]
                                            }}
                                        />
                                    );
                                })}
                                <div className="donut-hole">
                                    <span className="donut-total">{getMainSheetData().data.length}</span>
                                    <span className="donut-label">Total</span>
                                </div>
                            </div>
                        </div>
                        <div className="chart-legend">
                            {vehicleStats.map((item, idx) => (
                                <div key={item.type} className="legend-item">
                                    <span className="legend-color" style={{ background: colorPalette[idx % colorPalette.length] }} />
                                    <span className="legend-label">{item.type}</span>
                                    <span className="legend-value">{item.count} ({item.percentage}%)</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sheet Comparison */}
                <div className="analytics-chart-card">
                    <div className="chart-header">
                        <h3><BarChart3 size={20} /> Data by Sheet</h3>
                    </div>
                    <div className="chart-body">
                        <div className="horizontal-bar-chart">
                            {sheetStats.map((sheet, idx) => (
                                <div key={sheet.fullName} className="bar-row">
                                    <div className="bar-label" title={sheet.fullName}>{sheet.name}</div>
                                    <div className="bar-container">
                                        <div
                                            className="bar-fill"
                                            style={{
                                                width: `${(sheet.count / maxSheetCount) * 100}%`,
                                                background: colorPalette[idx % colorPalette.length]
                                            }}
                                        >
                                            <span className="bar-value">{sheet.count}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Location Analysis */}
            <div className="analytics-location-card">
                <div className="chart-header">
                    <h3><MapPin size={20} /> Top Service Locations</h3>
                </div>
                <div className="chart-body">
                    <div className="location-grid">
                        {locationStats.map((loc, idx) => (
                            <div key={loc.location} className="location-item">
                                <div className="location-rank">{idx + 1}</div>
                                <div className="location-info">
                                    <span className="location-name">{loc.location}</span>
                                    <div className="location-bar-container">
                                        <div
                                            className="location-bar"
                                            style={{
                                                width: `${(loc.count / maxLocationCount) * 100}%`,
                                                background: `linear-gradient(90deg, ${colorPalette[idx % colorPalette.length]} 0%, ${colorPalette[(idx + 1) % colorPalette.length]} 100%)`
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="location-count">{loc.count}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Vehicle Types Breakdown */}
            <div className="analytics-vehicle-breakdown">
                <div className="chart-header">
                    <h3><Car size={20} /> Vehicle Categories Breakdown</h3>
                </div>
                <div className="chart-body">
                    <div className="vehicle-cards-grid">
                        {vehicleStats.map((item, idx) => (
                            <div key={item.type} className="vehicle-stat-card" style={{ borderColor: colorPalette[idx % colorPalette.length] }}>
                                <div className="vehicle-stat-icon" style={{ background: colorPalette[idx % colorPalette.length] }}>
                                    <Car size={24} />
                                </div>
                                <div className="vehicle-stat-info">
                                    <span className="vehicle-stat-type">{item.type}</span>
                                    <span className="vehicle-stat-count">{item.count.toLocaleString()}</span>
                                    <div className="vehicle-stat-bar">
                                        <div
                                            className="vehicle-stat-progress"
                                            style={{
                                                width: `${item.percentage}%`,
                                                background: colorPalette[idx % colorPalette.length]
                                            }}
                                        />
                                    </div>
                                    <span className="vehicle-stat-percentage">{item.percentage}% of total</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CRMAnalytics;
