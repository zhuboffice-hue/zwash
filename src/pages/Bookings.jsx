import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    orderBy,
    serverTimestamp,
    increment,
    writeBatch,
    deleteDoc
} from 'firebase/firestore';
import {
    generateAvailableStartTimes,
    getSettings,
    formatTime12Hour as formatTimeEngine
} from '../utils/schedulingEngine';
import {
    ClipboardList,
    Plus,
    Search,
    Filter,
    Eye,
    Edit,
    Check,
    Clock,
    X,
    Phone,
    Car as CarIcon,
    Droplets,
    CheckCircle,
    Trash2,
    Archive
} from 'lucide-react';

const Bookings = () => {
    const { hasPermission, userProfile } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completingBooking, setCompletingBooking] = useState(null);

    // Filter view: active vs archived
    const [viewMode, setViewMode] = useState('active'); // 'active' | 'archived'

    useEffect(() => {
        fetchBookings();
    }, [filter, viewMode]);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            const collectionName = viewMode === 'archived' ? 'archived_bookings' : 'bookings';
            const bookingsRef = collection(db, collectionName);

            // Fetch all bookings to avoid composite index requirement
            const q = query(bookingsRef);
            const snapshot = await getDocs(q);

            let data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort by createdAt client-side (newest first)
            data.sort((a, b) => {
                const aTime = a.createdAt?.toMillis?.() || a.createdAt?.seconds * 1000 || 0;
                const bTime = b.createdAt?.toMillis?.() || b.createdAt?.seconds * 1000 || 0;
                return bTime - aTime;
            });

            // Filter by status client-side if needed
            if (filter !== 'all') {
                data = data.filter(b => b.status === filter);
            }

            setBookings(data);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateBookingStatus = async (bookingId, newStatus, additionalData = {}) => {
        try {
            await updateDoc(doc(db, 'bookings', bookingId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
                ...additionalData
            });

            setBookings(prev => prev.map(b =>
                b.id === bookingId ? { ...b, status: newStatus, ...additionalData } : b
            ));
        } catch (error) {
            console.error('Error updating booking:', error);
        }
    };

    const handleDeleteBooking = async (booking) => {
        if (!window.confirm('Are you sure you want to delete this booking? This will archive it and revert any material usage.')) return;

        try {
            setLoading(true);

            // 1. Fetch Material Usage to Revert
            const usageRef = collection(db, 'materialUsage');
            const q = query(usageRef, where('bookingId', '==', booking.id));
            const usageSnapshot = await getDocs(q);

            const batch = writeBatch(db);

            // 2. Revert Inventory
            usageSnapshot.docs.forEach(docSnap => {
                const usage = docSnap.data();
                if (usage.materialId && usage.quantityUsed) {
                    const materialRef = doc(db, 'materials', usage.materialId);
                    batch.update(materialRef, {
                        currentStock: increment(Number(usage.quantityUsed)),
                        updatedAt: serverTimestamp()
                    });
                }
                // Optional: Delete usage record or keep it? Archive it? 
                // Let's delete it from active usage collection to avoid double counting if restored? 
                // Or just keep it but since booking is gone, it's orphaned.
                // Better to delete usage record so analytics don't count it active.
                batch.delete(docSnap.ref);
            });

            // 3. Archive Booking (Only if not already archived)
            if (viewMode !== 'archived') {
                const archiveRef = doc(collection(db, 'archived_bookings'), booking.id);
                batch.set(archiveRef, {
                    ...booking,
                    archivedAt: serverTimestamp(),
                    archivedBy: userProfile?.email || 'unknown',
                    originalId: booking.id
                });
            }

            // 4. Delete Booking from current view's collection
            // If in active view: delete from 'bookings' (and it was moved to archive above)
            // If in archived view: delete from 'archived_bookings' (permanent delete)
            const collectionName = viewMode === 'archived' ? 'archived_bookings' : 'bookings';
            const bookingRef = doc(db, collectionName, booking.id);
            batch.delete(bookingRef);

            await batch.commit();

            setBookings(prev => prev.filter(b => b.id !== booking.id));
            alert(viewMode === 'archived' ? 'Booking permanently deleted.' : 'Booking deleted and archived. Inventory usage reverted.');
        } catch (error) {
            console.error('Error deleting booking:', error);
            alert('Failed to delete booking: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Handle completion - open modal for water usage
    const handleCompleteClick = (booking) => {
        setCompletingBooking(booking);
        setShowCompletionModal(true);
    };

    const getStatusBadge = (status) => {
        const badges = {
            'pending_confirmation': { class: 'badge-pending', label: 'Pending' },
            'confirmed': { class: 'badge-confirmed', label: 'Confirmed' },
            'in_progress': { class: 'badge-progress', label: 'In Progress' },
            'completed': { class: 'badge-completed', label: 'Completed' },
            'cancelled': { class: 'badge-cancelled', label: 'Cancelled' }
        };
        return badges[status] || { class: 'badge-pending', label: status };
    };

    const filteredBookings = bookings.filter(booking => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            booking.bookingReference?.toLowerCase().includes(search) ||
            booking.serviceName?.toLowerCase().includes(search) ||
            booking.contactPhone?.includes(search) ||
            booking.licensePlate?.toLowerCase().includes(search)
        );
    });

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    return (
        <div className="bookings-page">
            <div className="page-header">
                <div>
                    <h1><ClipboardList size={28} /> Bookings</h1>
                    <p className="subtitle">Manage all booking requests</p>
                </div>
                <div className="header-actions">
                    {hasPermission('bookings', 'create') && (
                        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                            <Plus size={18} /> Add Walk-in
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    className={`btn ${viewMode === 'active' ? 'btn-primary' : ''}`}
                    style={viewMode !== 'active' ? { background: '#f8f9fa', border: '1px solid #ddd', color: '#333' } : {}}
                    onClick={() => setViewMode('active')}
                >
                    <ClipboardList size={16} style={{ marginBottom: '-2px', marginRight: '6px' }} />
                    Active Bookings
                </button>
                <button
                    className={`btn ${viewMode === 'archived' ? 'btn-primary' : ''}`}
                    style={viewMode !== 'archived' ? { background: '#f8f9fa', border: '1px solid #ddd', color: '#333' } : { background: '#6c757d', borderColor: '#6c757d' }}
                    onClick={() => setViewMode('archived')}
                >
                    <Archive size={16} style={{ marginBottom: '-2px', marginRight: '6px' }} />
                    Archived Bookings
                </button>
            </div>

            {/* Filters */}
            <div className="search-filter-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search by reference, phone, plate..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="filter-select"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                >
                    <option value="all">All Status</option>
                    <option value="pending_confirmation">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                </select>
            </div>

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon orange">
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'pending_confirmation').length}
                        </span>
                        <span className="stat-label">Pending</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon blue">
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'confirmed').length}
                        </span>
                        <span className="stat-label">Confirmed</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon purple">
                        <Clock size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'in_progress').length}
                        </span>
                        <span className="stat-label">In Progress</span>
                    </div>
                </div>
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <Check size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">
                            {bookings.filter(b => b.status === 'completed').length}
                        </span>
                        <span className="stat-label">Completed</span>
                    </div>
                </div>
            </div>

            {/* Bookings Table */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state">
                            <div className="loader"></div>
                            <p>Loading bookings...</p>
                        </div>
                    ) : filteredBookings.length === 0 ? (
                        <div className="empty-state">
                            <ClipboardList size={48} />
                            <p>No bookings found</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="table-container desktop-table">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Reference</th>
                                            <th>Service</th>
                                            <th>Vehicle</th>
                                            <th>Date & Time</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map(booking => {
                                            const badge = getStatusBadge(booking.status);
                                            return (
                                                <tr key={booking.id}>
                                                    <td>
                                                        <strong>{booking.bookingReference || booking.id.slice(0, 8)}</strong>
                                                        <br />
                                                        <small style={{ fontSize: '0.7em', color: 'var(--navy-400)' }}>
                                                            {booking.createdByName ? `By: ${booking.createdByName.split(' ')[0]}` : ''}
                                                        </small>
                                                        <br />
                                                        <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--navy-700)' }}>
                                                            {booking.customerName || 'N/A'}
                                                        </span>
                                                        <br />
                                                        <small style={{ color: 'var(--navy-500)' }}>
                                                            <Phone size={12} /> {booking.contactPhone}
                                                        </small>
                                                    </td>
                                                    <td>{booking.serviceName}</td>
                                                    <td>
                                                        {booking.carMake} {booking.carModel}
                                                        <br />
                                                        <small>{booking.licensePlate}</small>
                                                    </td>
                                                    <td>{booking.bookingDate}<br />{booking.startTime}</td>
                                                    <td>{formatCurrency(booking.price)}</td>
                                                    <td>
                                                        <span className={`badge ${badge.class}`}>{badge.label}</span>
                                                        {booking.completedByName && booking.status === 'completed' && (
                                                            <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '4px', whiteSpace: 'nowrap' }}>
                                                                Done: {booking.completedByName.split(' ')[0]}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                            <button
                                                                className="btn-icon"
                                                                title="View"
                                                                onClick={() => setSelectedBooking(booking)}
                                                            >
                                                                <Eye size={16} />
                                                            </button>
                                                            {viewMode !== 'archived' && (
                                                                <>
                                                                    {hasPermission('bookings', 'edit') && booking.status === 'pending_confirmation' && (
                                                                        <button
                                                                            className="btn-icon"
                                                                            title="Confirm"
                                                                            onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                                                        >
                                                                            <Check size={16} />
                                                                        </button>
                                                                    )}
                                                                    {hasPermission('bookings', 'edit') && booking.status === 'confirmed' && (
                                                                        <button
                                                                            className="btn-icon"
                                                                            title="Start"
                                                                            onClick={() => updateBookingStatus(booking.id, 'in_progress')}
                                                                        >
                                                                            <Clock size={16} />
                                                                        </button>
                                                                    )}
                                                                    {hasPermission('bookings', 'edit') && booking.status === 'in_progress' && (
                                                                        <button
                                                                            className="btn-icon"
                                                                            title="Complete"
                                                                            onClick={() => handleCompleteClick(booking)}
                                                                            style={{ color: 'var(--success)' }}
                                                                        >
                                                                            <Check size={16} />
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                            {hasPermission('bookings', 'delete') && (
                                                                <button
                                                                    className="btn-icon header-actions"
                                                                    title={viewMode === 'archived' ? "Delete Permanently" : "Archive"}
                                                                    onClick={() => handleDeleteBooking(booking)}
                                                                    style={{ color: 'var(--danger)' }}
                                                                >
                                                                    <Trash2 size={16} />
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

                            {/* Mobile Cards */}
                            <div className="mobile-cards">
                                {filteredBookings.map(booking => {
                                    const badge = getStatusBadge(booking.status);
                                    return (
                                        <div key={booking.id} className="booking-card">
                                            <div className="booking-card-header">
                                                <div>
                                                    <strong>{booking.bookingReference || booking.id.slice(0, 8)}</strong>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)', marginTop: '2px' }}>
                                                        {booking.customerName || 'N/A'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--navy-500)' }}>
                                                        {booking.createdByName ? `By: ${booking.createdByName.split(' ')[0]}` : ''}
                                                    </div>
                                                </div>
                                                <span className={`badge ${badge.class}`}>{badge.label}</span>
                                            </div>
                                            <div className="booking-card-body">
                                                <p><CarIcon size={14} /> {booking.serviceName}</p>
                                                <p>{booking.carMake} {booking.carModel} - {booking.licensePlate}</p>
                                                <p>{booking.bookingDate} at {booking.startTime}</p>
                                                <p><strong>{formatCurrency(booking.price)}</strong></p>
                                            </div>
                                            <div className="booking-card-footer">
                                                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedBooking(booking)}>
                                                    View Details
                                                </button>
                                                {viewMode !== 'archived' && hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => {
                                                            if (booking.status === 'in_progress') {
                                                                handleCompleteClick(booking);
                                                            } else {
                                                                const nextStatus = {
                                                                    'pending_confirmation': 'confirmed',
                                                                    'confirmed': 'in_progress'
                                                                };
                                                                updateBookingStatus(booking.id, nextStatus[booking.status]);
                                                            }
                                                        }}
                                                    >
                                                        {booking.status === 'pending_confirmation' ? 'Confirm' :
                                                            booking.status === 'confirmed' ? 'Start' : 'Complete'}
                                                    </button>
                                                )}
                                                {hasPermission('bookings', 'delete') && (
                                                    <button
                                                        className="btn btn-sm btn-danger icon-only"
                                                        onClick={() => handleDeleteBooking(booking)}
                                                        title={viewMode === 'archived' ? "Delete Permanently" : "Archive"}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Walk-in Modal - placeholder */}
            {showModal && (
                <WalkInModal onClose={() => setShowModal(false)} onSuccess={fetchBookings} />
            )}

            {/* Booking Details Modal */}
            {selectedBooking && (
                <BookingDetailsModal
                    booking={selectedBooking}
                    onClose={() => setSelectedBooking(null)}
                    onStatusChange={updateBookingStatus}
                    onCompleteClick={handleCompleteClick}
                />
            )}

            {/* Completion Modal */}
            {showCompletionModal && completingBooking && (
                <CompletionModal
                    booking={completingBooking}
                    onClose={() => { setShowCompletionModal(false); setCompletingBooking(null); }}
                    onComplete={async (data) => {
                        // 1. Update Booking
                        await updateBookingStatus(completingBooking.id, 'completed', data);
                        
                        // 2. Generate Invoice
                        try {
                            const materialItems = (data.materialsUsed || []).map(m => ({
                                description: `Material: ${m.name}`,
                                quantity: m.quantity,
                                price: (m.cost / (m.quantity || 1)),
                                total: m.cost
                            }));

                            const invoiceItems = [
                                {
                                    description: completingBooking.serviceName,
                                    quantity: 1,
                                    price: Number(completingBooking.price || 0),
                                    total: Number(completingBooking.price || 0)
                                },
                                ...materialItems
                            ];

                            const finalTotal = Number(completingBooking.price || 0) + (data.totalMaterialCost || 0);

                             await addDoc(collection(db, 'invoices'), {
                                invoiceNumber: `INV-${Date.now()}`,
                                bookingId: completingBooking.id,
                                customerId: completingBooking.customerId || 'walk-in',
                                customerName: completingBooking.customerName || 'Guest',
                                customerPhone: completingBooking.contactPhone || '',
                                vehicleNumber: completingBooking.licensePlate || '',
                                type: 'Service',
                                items: invoiceItems,
                                subtotal: finalTotal,
                                total: finalTotal,
                                amountPaid: finalTotal, // Assuming settled on completion
                                balance: 0,
                                status: 'paid',
                                date: serverTimestamp(),
                                createdAt: serverTimestamp()
                             });
                        } catch (err) {
                            console.error("Error generating invoice:", err);
                        }

                        setShowCompletionModal(false);
                        setCompletingBooking(null);
                        fetchBookings();
                    }}
                />
            )}

            <style>{`
{/* Styles for booking card specific overrides if needed */}
        
        .booking-card {
          background: white;
          border: 1px solid var(--navy-100);
          border-radius: var(--radius-lg);
          padding: 1rem;
          margin-bottom: 0.75rem;
          box-shadow: var(--shadow-sm);
        }
        
        .booking-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--navy-100);
        }
        
        .booking-card-header strong {
          font-size: 1rem;
          color: var(--navy-800);
        }
        
        .booking-card-body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        
        .booking-card-body p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--navy-600);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .booking-card-body p svg {
          color: var(--navy-400);
          flex-shrink: 0;
        }
        
        .booking-card-footer {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 0.75rem;
          border-top: 1px solid var(--navy-100);
        }
        
        .booking-card-footer .btn {
          flex: 1;
          justify-content: center;
        }
      `}</style>
        </div>
    );
};

// Walk-in Booking Modal
const WalkInModal = ({ onClose, onSuccess }) => {
    const { user, userProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState([]);
    const [vehicleType, setVehicleType] = useState('sedan');

    // Multi-service selection state
    const [selectedServices, setSelectedServices] = useState([]); // Array of full service objects
    const [currentServiceId, setCurrentServiceId] = useState(''); // Control for the dropdown
    const [extraTime, setExtraTime] = useState(0); // Manually added extra time in minutes
    
    // Custom Service State
    const [isCustomService, setIsCustomService] = useState(false);
    const [customServiceData, setCustomServiceData] = useState({ name: '', price: '', category: 'Custom' });

    // Duration-based scheduling states
    const [availableSlots, setAvailableSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [settings, setSettings] = useState(null);

    // Customer search states
    const [customers, setCustomers] = useState([]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [showAddCustomer, setShowAddCustomer] = useState(false); // Toggle for adding new customer
    const [formData, setFormData] = useState({
        customerName: '',
        carMake: '',
        carModel: '',
        licensePlate: '',
        phone: '',
        bookingDate: new Date().toISOString().split('T')[0],
        startTime: ''
    });

    useEffect(() => {
        fetchServices();
        fetchCustomers();
        loadSettings();
    }, []);

    // Load settings once
    const loadSettings = async () => {
        const s = await getSettings(db);
        setSettings(s);
    };



    // Regenerate slots when date OR selected services change
    useEffect(() => {
        if (formData.bookingDate && selectedServices.length > 0) {
            generateDynamicSlots();
        } else if (selectedServices.length === 0) {
            setAvailableSlots([]);
        }
    }, [formData.bookingDate, selectedServices, settings, extraTime]); // Deep dependency on selectedServices length/content, added extraTime

    // Helper: Get price for a specific service and current vehicle type
    const getServicePrice = (service) => {
        if (!service) return 0;
        const price = service.prices?.[vehicleType];
        return price !== undefined ? Number(price) : Number(service.price || 0);
    };

    // Derived totals
    const totalPrice = selectedServices.reduce((sum, s) => sum + getServicePrice(s), 0);
    const baseDuration = selectedServices.reduce((sum, s) => sum + (Number(s.durationMinutes) || 30), 0);
    const hasMultiServiceBuffer = selectedServices.length > 1;
    const multiServiceBuffer = hasMultiServiceBuffer ? 30 : 0; // 30 min lock for multi-service
    const totalDuration = baseDuration + multiServiceBuffer + extraTime;

    // Generate slots using the duration-based scheduling engine
    const generateDynamicSlots = async () => {
        if (!formData.bookingDate || selectedServices.length === 0) {
            setAvailableSlots([]);
            return;
        }

        try {
            setSlotsLoading(true);

            // Create a "composite" service object to represent the combined booking
            const compositeService = {
                name: selectedServices.map(s => s.name).join(' + '),
                durationMinutes: totalDuration,
                // Use the category of the first service for conflict resolution rule (e.g. blocking same category)
                category: selectedServices[0].category || 'Detailed Wash'
            };

            // Use the scheduling engine to generate available times
            const slots = await generateAvailableStartTimes({
                db,
                dateStr: formData.bookingDate,
                service: compositeService,
                settings: settings
            });

            setAvailableSlots(slots);

            // Clear selected time if it's no longer available
            if (formData.startTime && !slots.find(s => s.time === formData.startTime && s.available)) {
                setFormData(prev => ({ ...prev, startTime: '' }));
            }
        } catch (error) {
            console.error('Error generating available slots:', error);
            setAvailableSlots([]);
        } finally {
            setSlotsLoading(false);
        }
    };

    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    const fetchServices = async () => {
        try {
            const servicesRef = collection(db, 'services');
            const q = query(servicesRef, where('isActive', '==', true));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
            setServices(data);
        } catch (error) {
            console.error('Error fetching services:', error);
        }
    };

    const fetchCustomers = async () => {
        try {
            const snap = await getDocs(collection(db, 'customers'));
            setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    // Filter customers by search term
    const filteredCustomers = customers.filter(c =>
        c.phone?.includes(customerSearch) ||
        c.licensePlate?.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.name?.toLowerCase().includes(customerSearch.toLowerCase())
    );

    const selectCustomer = (customer) => {
        setFormData({
            customerId: customer.id,
            customerName: customer.name || '',
            carMake: customer.carMake || '',
            carModel: customer.carModel || '',
            licensePlate: customer.licensePlate || '',
            phone: customer.phone || ''
        });
        setCustomerSearch('');
        setShowCustomerDropdown(false);
    };

    // Group services by category (Filtered by availability for vehicle type)
    const groupedServices = services
        .filter(service => getServicePrice(service) > 0) // Only show services with valid price for selected info
        .reduce((acc, service) => {
            const cat = service.category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(service);
            return acc;
        }, {});

    const handleAddService = (serviceId) => {
        if (serviceId === 'custom') {
            setIsCustomService(true);
            setCurrentServiceId('custom');
            return;
        }
        
        if (!serviceId) return;

        // Prevent duplicates
        if (selectedServices.find(s => s.id === serviceId)) {
            alert('Service already added');
            return;
        }

        const service = services.find(s => s.id === serviceId);
        if (service) {
            setSelectedServices(prev => [...prev, service]);
            setCurrentServiceId(''); // Reset dropdown
        }
    };

    const handleAddCustomService = () => {
        if (!customServiceData.name || !customServiceData.price) {
            alert('Please enter service name and price');
            return;
        }

        const newService = {
            id: `custom-${Date.now()}`,
            name: customServiceData.name,
            price: Number(customServiceData.price),
            durationMinutes: 30, // Default duration
            isCustom: true,
            category: 'Custom'
        };

        setSelectedServices(prev => [...prev, newService]);
        setCustomServiceData({ name: '', price: '', category: 'Custom' });
        setIsCustomService(false);
        setCurrentServiceId('');
    };

    const handleRemoveService = (serviceId) => {
        setSelectedServices(prev => prev.filter(s => s.id !== serviceId));
    };

    const saveNewCustomer = async () => {
        if (!formData.customerName || !formData.phone || !formData.licensePlate) {
            alert('Please fill in Name, Phone and License Plate to save customer.');
            return;
        }

        try {
            setLoading(true);
            const customerRef = await addDoc(collection(db, 'customers'), {
                name: formData.customerName,
                phone: formData.phone,
                licensePlate: formData.licensePlate.toUpperCase(),
                carMake: formData.carMake,
                carModel: formData.carModel,
                createdAt: serverTimestamp(),
                vehicleType: vehicleType
            });
            
            // Refresh customers list
            fetchCustomers();
            
            alert('Customer added to database successfully!');
            setShowAddCustomer(false);
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Failed to save customer');
        } finally {
            setLoading(false);
        }
    };

    // Update prices when vehicle type changes (re-calculate totals automatically via derived state)
    // No explicit effect needed since we calculate total on render using vehicleType state

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedServices.length === 0) {
            alert('Please select at least one service');
            return;
        }
        if (!formData.startTime) {
            alert('Please select a start time');
            return;
        }

        setLoading(true);

        // Generate service short code from first service name
        const getServiceCode = (serviceName) => {
            if (!serviceName) return 'XX';
            // Map common service names to short codes
            const codeMap = {
                'commando clean': 'CC',
                'commando cleaning': 'CC',
                'quick strike wash': 'QSW',
                "commander's finish": 'CF',
                'bullet shield teflon armor': 'BST',
                'gear guard interior': 'GGI',
                'underbody armor': 'UBA',
                "rider's regiment cleanse": 'RRC',
                'salt mark stain remover': 'SMS',
                'silver coating': 'SC',
                'ac gas check': 'AGC'
            };
            const lowerName = serviceName.toLowerCase();
            if (codeMap[lowerName]) return codeMap[lowerName];
            // Generate code from first letters of words
            return serviceName.split(' ').map(w => w[0]?.toUpperCase() || '').join('').slice(0, 3);
        };

        const dateStr = formData.bookingDate.replace(/-/g, '');
        const serviceCode = selectedServices.length > 1
            ? 'MX' // Multiple services
            : getServiceCode(selectedServices[0]?.name || 'SVC');
        const counter = Math.floor(Math.random() * 99) + 1; // Add small random to avoid duplicates
        const bookingRef = `DC-${dateStr}-${serviceCode}${counter.toString().padStart(2, '0')}`;

        try {
            await addDoc(collection(db, 'bookings'), {
                bookingReference: bookingRef,
                createdBy: user?.uid || 'unknown',
                createdByName: userProfile?.displayName || user?.email || 'Staff',
                // Store primary service ID for legacy support/simple queries (first one)
                serviceId: selectedServices[0].id,
                // New field: store ALL service IDs
                serviceIds: selectedServices.map(s => s.id),

                // Combined name
                serviceName: selectedServices.map(s => s.name).join(' + '),
                serviceCategory: selectedServices[0].category || 'Detailed Wash',

                // Totals
                serviceDuration: totalDuration,
                extraTime: extraTime,
                price: totalPrice,

                vehicleType: vehicleType,
                bookingDate: formData.bookingDate,
                startTime: formData.startTime || new Date().toTimeString().slice(0, 5),
                customerId: formData.customerId || null, // Link to customer if selected
                customerName: formData.customerName,
                carMake: formData.carMake,
                carModel: formData.carModel,
                licensePlate: formData.licensePlate.toUpperCase(),
                contactPhone: formData.phone,
                status: 'in_progress',
                isWalkIn: true,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating walk-in booking:', error);
            alert('Error creating booking: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Plus size={20} /> Add Walk-in Booking</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {/* Vehicle Type Selection */}
                        <div className="form-group">
                            <label>Vehicle Type *</label>
                            <div className="vehicle-type-sections">
                                <div style={{ marginBottom: '0.75rem' }}>
                                    <small style={{ fontWeight: '600', color: 'var(--navy-500)', display: 'block', marginBottom: '0.25rem' }}>Four Wheelers</small>
                                    <div className="vehicle-type-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        {['hatchback', 'sedan', 'suv', 'luxury_suv'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`vehicle-type-btn ${vehicleType === type ? 'active' : ''}`}
                                                onClick={() => setVehicleType(type)}
                                                style={{
                                                    padding: '0.6rem',
                                                    border: vehicleType === type ? '2px solid var(--primary)' : '1px solid var(--navy-200)',
                                                    borderRadius: '8px',
                                                    background: vehicleType === type ? 'var(--primary-light)' : 'white',
                                                    color: vehicleType === type ? 'var(--primary)' : 'var(--navy-600)',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    textTransform: 'capitalize',
                                                    transition: 'all 0.2s ease',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {type.replace('_', ' ').replace('luxury suv', 'L-SUV')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <small style={{ fontWeight: '600', color: 'var(--navy-500)', display: 'block', marginBottom: '0.25rem' }}>Two Wheelers</small>
                                    <div className="vehicle-type-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem' }}>
                                        {['scooter', 'bike', 'superbike'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                className={`vehicle-type-btn ${vehicleType === type ? 'active' : ''}`}
                                                onClick={() => setVehicleType(type)}
                                                style={{
                                                    padding: '0.6rem',
                                                    border: vehicleType === type ? '2px solid var(--primary)' : '1px solid var(--navy-200)',
                                                    borderRadius: '8px',
                                                    background: vehicleType === type ? 'var(--primary-light)' : 'white',
                                                    color: vehicleType === type ? 'var(--primary)' : 'var(--navy-600)',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    textTransform: 'capitalize',
                                                    transition: 'all 0.2s ease',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                {type.replace('_', ' ')}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Multi-Service Selection */}
                        <div className="form-group">
                            <label>Services *</label>

                            {/* Extra Time Input moved to top as per request (though implementation keeps logical flow, UI shows "Add Extra Time" button near time field now) */}
                            {/* Keeping the legacy/full extra time selector if user wants granular control for extensive work */}
                            <div className="form-group" style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--navy-50)', borderRadius: '6px' }}>
                                <label style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>Add Extra Time (for extensive work)</label>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {[0, 30, 60, 90, 120, 180, 240].map(mins => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setExtraTime(mins)}
                                            className={extraTime === mins ? 'btn-primary' : 'btn-secondary'}
                                            style={{ 
                                                fontSize: '0.8rem', 
                                                padding: '4px 8px',
                                                background: extraTime === mins ? 'var(--primary)' : 'white'
                                            }}
                                        >
                                            {mins === 0 ? 'None' : mins >= 60 ? `${mins/60}h` : `${mins}m`}
                                        </button>
                                    ))}
                                    <input 
                                       type="number"
                                       placeholder="Custom"
                                       value={extraTime}
                                       onChange={e => setExtraTime(Number(e.target.value))}
                                       style={{ width: '80px', padding: '4px 8px', fontSize: '0.8rem' }}
                                    />
                                </div>
                            </div>

                            {/* Selected Services List */}
                            {selectedServices.length > 0 && (
                                <div className="selected-services-list" style={{ marginBottom: '1rem' }}>
                                    {selectedServices.map((service, index) => (
                                        <div key={`${service.id}-${index}`} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '0.5rem 0.75rem',
                                            background: 'var(--navy-50)',
                                            borderRadius: '6px',
                                            marginBottom: '0.5rem',
                                            border: '1px solid var(--navy-100)'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{service.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--navy-500)' }}>
                                                    {service.durationMinutes || 30} mins • ₹{getServicePrice(service)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveService(service.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: 'var(--danger)',
                                                    cursor: 'pointer',
                                                    padding: '4px'
                                                }}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Totals Summary */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '0.75rem',
                                        background: 'var(--primary-light)',
                                        borderRadius: '6px',
                                        fontWeight: '600',
                                        color: 'var(--primary-dark)',
                                        marginTop: '0.5rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>Total</span>
                                            <span style={{ textAlign: 'right' }}>
                                                {totalDuration} mins • ₹{totalPrice}
                                            </span>
                                        </div>
                                        {hasMultiServiceBuffer && (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                marginTop: '0.25rem',
                                                fontWeight: '400',
                                                color: 'var(--navy-600)'
                                            }}>
                                                ⏱️ Includes 30 min buffer for multi-service booking
                                            </div>
                                        )}
                                        {extraTime > 0 && (
                                            <div style={{
                                                fontSize: '0.75rem',
                                                marginTop: '0.1rem',
                                                fontWeight: '400',
                                                color: 'var(--navy-600)'
                                            }}>
                                                ➕ Includes {extraTime} min extra time
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Service Adder Dropdown */}
                            {!isCustomService ? (
                                <select
                                    value={currentServiceId}
                                    onChange={(e) => handleAddService(e.target.value)}
                                    style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--navy-200)' }}
                                >
                                    <option value="">+ Add Service</option>
                                    <option value="custom">✨ Add Custom Service (Manual Entry)</option>
                                    {Object.entries(groupedServices).map(([category, categoryServices]) => {
                                        // Filter services valid for this vehicle type
                                        const validServices = categoryServices.filter(s => {
                                            if (s.prices && s.prices[vehicleType] !== undefined) {
                                                return s.prices[vehicleType] > 0;
                                            }
                                            return true;
                                        });

                                        if (validServices.length === 0) return null;

                                        return (
                                            <optgroup key={category} label={category}>
                                                {validServices.map(service => {
                                                    const isSelected = selectedServices.some(s => s.id === service.id);
                                                    return (
                                                        <option
                                                            key={service.id}
                                                            value={service.id}
                                                            disabled={isSelected}
                                                        >
                                                            {service.name} ({service.durationMinutes || 30}m - ₹{getServicePrice(service)}) {isSelected ? '✓' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                            ) : (
                                <div className="custom-service-form" style={{ 
                                    padding: '1rem', 
                                    background: 'var(--navy-50)', 
                                    borderRadius: '8px',
                                    border: '1px solid var(--primary)'
                                }}>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary)' }}>Add Custom Service</h4>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input 
                                            placeholder="Service Name"
                                            value={customServiceData.name}
                                            onChange={e => setCustomServiceData({...customServiceData, name: e.target.value})}
                                            style={{ flex: 2 }}
                                            autoFocus
                                        />
                                        <input 
                                            placeholder="Price (₹)"
                                            type="number"
                                            value={customServiceData.price}
                                            onChange={e => setCustomServiceData({...customServiceData, price: e.target.value})}
                                            style={{ flex: 1 }}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button 
                                            type="button" 
                                            className="btn btn-primary btn-sm" 
                                            onClick={handleAddCustomService}
                                            style={{ flex: 1 }}
                                        >
                                            Add Service
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn btn-secondary btn-sm" 
                                            onClick={() => { setIsCustomService(false); setCurrentServiceId(''); }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>


                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={formData.bookingDate}
                                    onChange={(e) => setFormData({ ...formData, bookingDate: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    Time
                                    <button 
                                        type="button" 
                                        className="btn-link"
                                        onClick={() => {
                                            const currentVal = prompt("Add extra duration (minutes):", "0");
                                            if (currentVal && !isNaN(currentVal)) {
                                                setExtraTime(Number(currentVal));
                                            }
                                        }}
                                        style={{ 
                                            background: 'none', border: 'none', color: 'var(--primary)', 
                                            fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' 
                                        }}
                                    >
                                        + Extra Time {extraTime > 0 ? `(${extraTime}m)` : ''}
                                    </button>
                                </label>
                                <input
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Dynamic Available Slots - Duration Based */}
                        <div className="slots-container" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                                Available Times {selectedServices.length > 0 && <span style={{ fontWeight: '400', color: 'var(--navy-500)' }}>({totalDuration} min service)</span>}
                            </label>

                            {selectedServices.length === 0 ? (
                                <div style={{ padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px', textAlign: 'center', color: 'var(--navy-500)' }}>
                                    ⬆️ Please select a service first to see available times
                                </div>
                            ) : slotsLoading ? (
                                <div style={{ padding: '1rem', textAlign: 'center' }}>
                                    <div className="loader is-small"></div>
                                    <p style={{ marginTop: '0.5rem', color: 'var(--navy-500)' }}>Calculating available times...</p>
                                </div>
                            ) : availableSlots.length === 0 ? (
                                <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', textAlign: 'center', color: '#991b1b' }}>
                                    ❌ No available time slots for this date and service duration
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                                    {availableSlots.map((slot, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            disabled={!slot.available}
                                            onClick={() => slot.available && setFormData({ ...formData, startTime: slot.time })}
                                            style={{
                                                padding: '0.6rem 0.4rem',
                                                borderRadius: '8px',
                                                border: '2px solid',
                                                fontSize: '0.85rem',
                                                fontWeight: '500',
                                                cursor: slot.available ? 'pointer' : 'not-allowed',
                                                background: !slot.available
                                                    ? '#fee2e2' // Light red for booked
                                                    : formData.startTime === slot.time ? 'var(--success)' : 'white',
                                                borderColor: !slot.available
                                                    ? '#ef4444' // Red border
                                                    : formData.startTime === slot.time ? 'var(--success)' : 'var(--navy-200)',
                                                color: !slot.available
                                                    ? '#b91c1c' // Dark red text
                                                    : formData.startTime === slot.time ? 'white' : 'var(--navy-700)',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title={!slot.available ? (slot.reason || 'Unavailable') : `Blocks until ${slot.blockedUntil}`}
                                        >
                                            {slot.display}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {selectedServices.length > 0 && availableSlots.length > 0 && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--navy-500)' }}>
                                    ℹ️ Showing {availableSlots.length} available start times. Times account for service duration + buffer.
                                </div>
                            )}
                        </div>

                        {/* Customer Search & Management */}
                        <div className="form-group" style={{ position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <label style={{ marginBottom: 0 }}>Search Existing Customer</label>
                                <button 
                                    type="button" 
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setShowAddCustomer(!showAddCustomer)}
                                    style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                                >
                                    {showAddCustomer ? 'Hide Options' : '+ Save to Database'}
                                </button>
                            </div>
                            
                            <input
                                type="text"
                                value={customerSearch}
                                onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                    setShowCustomerDropdown(true);
                                }}
                                onFocus={() => setShowCustomerDropdown(true)}
                                placeholder="Search by phone or number plate..."
                            />
                            {showCustomerDropdown && customerSearch && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    background: 'white',
                                    border: '1px solid var(--navy-200)',
                                    borderRadius: '8px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    zIndex: 10,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                }}>
                                    {filteredCustomers.length === 0 ? (
                                        <div style={{ padding: '12px', color: 'var(--navy-400)', textAlign: 'center' }}>
                                            No customers found
                                        </div>
                                    ) : (
                                        filteredCustomers.slice(0, 5).map(c => (
                                            <div
                                                key={c.id}
                                                onClick={() => selectCustomer(c)}
                                                style={{
                                                    padding: '10px 12px',
                                                    borderBottom: '1px solid #eee',
                                                    cursor: 'pointer'
                                                }}
                                                onMouseOver={(e) => e.target.style.background = 'var(--navy-50)'}
                                                onMouseOut={(e) => e.target.style.background = 'white'}
                                            >
                                                <strong>{c.name || 'N/A'}</strong> - {c.phone}
                                                <br />
                                                <small style={{ color: 'var(--primary)' }}>{c.licensePlate}</small>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {showAddCustomer && (
                             <div style={{ 
                                 marginBottom: '1rem', 
                                 padding: '0.75rem', 
                                 background: '#f0fdf4', 
                                 borderRadius: '6px', 
                                 border: '1px solid #bbf7d0',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'space-between'
                             }}>
                                 <div style={{ fontSize: '0.85rem', color: '#166534' }}>
                                     Fill the details below to add this customer to database
                                 </div>
                                 <button
                                     type="button"
                                     className="btn btn-sm"
                                     onClick={saveNewCustomer}
                                     style={{ background: '#166534', color: 'white', border: 'none' }}
                                 >
                                     Save Customer
                                 </button>
                             </div>
                        )}

                        <div className="form-group">
                            <label>Customer Name</label>
                            <input
                                value={formData.customerName}
                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                placeholder="Customer name (for invoice)"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Car Make *</label>
                                <input
                                    value={formData.carMake}
                                    onChange={(e) => setFormData({ ...formData, carMake: e.target.value })}
                                    required
                                    placeholder="Toyota"
                                />
                            </div>
                            <div className="form-group">
                                <label>Car Model *</label>
                                <input
                                    value={formData.carModel}
                                    onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
                                    required
                                    placeholder="Camry"
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>License Plate *</label>
                                <input
                                    value={formData.licensePlate}
                                    onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                                    required
                                    placeholder="TN-01-AB-1234"
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Phone *</label>
                                <input
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    type="tel"
                                    required
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Creating...' : 'Create Booking'}
                        </button>
                    </div>
                </form >
            </div >
        </div >
    );
};

// Booking Details Modal - Enhanced with Employee Assignment, Reschedule, Notes, WhatsApp
const BookingDetailsModal = ({ booking, onClose, onStatusChange, onCompleteClick, onRefresh }) => {
    const { hasPermission } = useAuth();
    const [employees, setEmployees] = useState([]);
    const [assignedEmployee, setAssignedEmployee] = useState(booking.assignedEmployee || '');
    const [notes, setNotes] = useState(booking.notes || '');
    const [showReschedule, setShowReschedule] = useState(false);
    const [newDate, setNewDate] = useState(booking.bookingDate || '');
    const [newTime, setNewTime] = useState(booking.startTime || '');
    const [saving, setSaving] = useState(false);

    const badge = {
        'pending_confirmation': { class: 'badge-pending', label: 'Pending' },
        'confirmed': { class: 'badge-confirmed', label: 'Confirmed' },
        'in_progress': { class: 'badge-progress', label: 'In Progress' },
        'completed': { class: 'badge-completed', label: 'Completed' },
        'cancelled': { class: 'badge-cancelled', label: 'Cancelled' }
    }[booking.status] || { class: 'badge-pending', label: booking.status };

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        try {
            const q = query(collection(db, 'adminUsers'), where('status', '==', 'approved'));
            const snapshot = await getDocs(q);
            const empList = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .filter(e => e.role === 'employee');
            setEmployees(empList);
        } catch (error) {
            console.error('Error fetching employees:', error);
        }
    };

    const saveAssignment = async () => {
        try {
            setSaving(true);
            await updateDoc(doc(db, 'bookings', booking.id), {
                assignedEmployee: assignedEmployee,
                assignedEmployeeName: employees.find(e => e.id === assignedEmployee)?.displayName || '',
                updatedAt: serverTimestamp()
            });
            alert('Employee assigned successfully!');
        } catch (error) {
            console.error('Error assigning employee:', error);
        } finally {
            setSaving(false);
        }
    };

    const saveNotes = async () => {
        try {
            setSaving(true);
            await updateDoc(doc(db, 'bookings', booking.id), {
                notes: notes,
                updatedAt: serverTimestamp()
            });
            alert('Notes saved!');
        } catch (error) {
            console.error('Error saving notes:', error);
        } finally {
            setSaving(false);
        }
    };

    const rescheduleBooking = async () => {
        try {
            setSaving(true);
            await updateDoc(doc(db, 'bookings', booking.id), {
                bookingDate: newDate,
                startTime: newTime,
                updatedAt: serverTimestamp()
            });
            alert('Booking rescheduled successfully!');
            setShowReschedule(false);
            if (onRefresh) onRefresh();
        } catch (error) {
            console.error('Error rescheduling:', error);
        } finally {
            setSaving(false);
        }
    };

    const sendWhatsAppReminder = () => {
        const phone = booking.contactPhone?.replace(/\D/g, '') || '';
        const message = `Hi! This is a reminder for your car wash appointment:\n\n` +
            `📅 Date: ${booking.bookingDate}\n` +
            `⏰ Time: ${booking.startTime}\n` +
            `🚗 Service: ${booking.serviceName}\n` +
            `💰 Amount: ₹${booking.price}\n\n` +
            `We look forward to seeing you!\n- ZWash`;
        const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    return (
        <div className="modal">
            <div className="modal-content modal-lg">
                <div className="modal-header">
                    <h2><ClipboardList size={20} /> Booking Details</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div>
                            <strong style={{ fontSize: '1.25rem' }}>{booking.bookingReference || booking.id.slice(0, 8)}</strong>
                            <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '4px' }}>
                                {booking.customerName || 'N/A'}
                            </div>
                            {booking.isWalkIn && <span className="badge badge-progress" style={{ marginTop: '0.5rem' }}>Walk-in</span>}
                        </div>
                        <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--navy-600)' }}>Service</h4>
                            <p><strong>{booking.serviceName}</strong></p>
                            <p>₹{booking.price}</p>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--navy-600)' }}>Schedule</h4>
                            <p>{booking.bookingDate}</p>
                            <p>{booking.startTime}</p>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--navy-600)' }}>Vehicle</h4>
                            <p>{booking.carMake} {booking.carModel}</p>
                            <p><strong>{booking.licensePlate}</strong></p>
                        </div>
                        <div>
                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--navy-600)' }}>Contact</h4>
                            <p>{booking.contactPhone}</p>
                        </div>
                    </div>

                    {/* Assign Employee */}
                    {hasPermission('bookings', 'edit') && booking.status !== 'completed' && (
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--navy-50)', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.5rem' }}>Assign Employee</h4>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <select
                                    value={assignedEmployee}
                                    onChange={(e) => setAssignedEmployee(e.target.value)}
                                    style={{ flex: 1 }}
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.displayName}</option>
                                    ))}
                                </select>
                                <button className="btn btn-primary btn-sm" onClick={saveAssignment} disabled={saving}>
                                    {saving ? '...' : 'Assign'}
                                </button>
                            </div>
                            {booking.assignedEmployeeName && (
                                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--success)' }}>
                                    Currently assigned to: <strong>{booking.assignedEmployeeName}</strong>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Reschedule Section */}
                    {hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                        <div style={{ marginBottom: '1rem' }}>
                            {!showReschedule ? (
                                <button className="btn btn-secondary btn-sm" onClick={() => setShowReschedule(true)}>
                                    📅 Reschedule Booking
                                </button>
                            ) : (
                                <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px' }}>
                                    <h4 style={{ marginBottom: '0.5rem' }}>Reschedule</h4>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                                        <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-primary btn-sm" onClick={rescheduleBooking} disabled={saving}>
                                            {saving ? 'Saving...' : 'Confirm Reschedule'}
                                        </button>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setShowReschedule(false)}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notes Section */}
                    <div style={{ marginBottom: '1rem' }}>
                        <h4 style={{ marginBottom: '0.5rem' }}>Notes</h4>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Add notes about this booking..."
                            rows={3}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--navy-200)' }}
                            disabled={!hasPermission('bookings', 'edit')}
                        />
                        {hasPermission('bookings', 'edit') && (
                            <button className="btn btn-secondary btn-sm" onClick={saveNotes} disabled={saving} style={{ marginTop: '0.5rem' }}>
                                Save Notes
                            </button>
                        )}
                    </div>
                </div>
                <div className="modal-footer">
                    {/* WhatsApp Reminder */}
                    <button className="btn btn-secondary" onClick={sendWhatsAppReminder} style={{ background: '#25d366', color: 'white', border: 'none' }}>
                        📱 WhatsApp Reminder
                    </button>

                    {hasPermission('bookings', 'edit') && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                        <>
                            {booking.status === 'pending_confirmation' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { onStatusChange(booking.id, 'confirmed'); onClose(); }}
                                >
                                    Confirm Booking
                                </button>
                            )}
                            {booking.status === 'confirmed' && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => { onStatusChange(booking.id, 'in_progress'); onClose(); }}
                                >
                                    Start Service
                                </button>
                            )}
                            {booking.status === 'in_progress' && (
                                <button
                                    className="btn btn-success"
                                    onClick={() => { onCompleteClick(booking); onClose(); }}
                                >
                                    Mark Complete
                                </button>
                            )}
                        </>
                    )}
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

// Completion Modal with Water Usage & Material Deduction
const CompletionModal = ({ booking, onClose, onComplete }) => {
    const { user, userProfile } = useAuth();
    const [waterUsage, setWaterUsage] = useState('');
    const [notes, setNotes] = useState('');
    const [materials, setMaterials] = useState([]);
    const [selectedMaterials, setSelectedMaterials] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetchingMaterials, setFetchingMaterials] = useState(true);

    useEffect(() => {
        fetchMaterials();
    }, []);

    const fetchMaterials = async () => {
        try {
            const materialsRef = collection(db, 'materials');
            const q = query(materialsRef, where('isActive', '==', true));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMaterials(data);
        } catch (error) {
            console.error('Error fetching materials:', error);
        } finally {
            setFetchingMaterials(false);
        }
    };

    const addMaterial = () => {
        setSelectedMaterials([...selectedMaterials, { materialId: '', quantity: 0 }]);
    };

    const updateSelectedMaterial = (index, field, value) => {
        const updated = [...selectedMaterials];
        updated[index][field] = value;
        if (field === 'materialId') {
            const material = materials.find(m => m.id === value);
            if (material) {
                updated[index].materialName = material.name;
                updated[index].costPerUnit = material.costPerUnit;
                updated[index].unit = material.unit;
            }
        }
        setSelectedMaterials(updated);
    };

    const removeMaterial = (index) => {
        setSelectedMaterials(selectedMaterials.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Calculate total material cost
            let totalMaterialCost = 0;
            const materialsUsed = selectedMaterials.map(sm => {
                const cost = sm.quantity * (sm.costPerUnit || 0);
                totalMaterialCost += cost;
                return {
                    materialId: sm.materialId,
                    name: sm.materialName,
                    quantity: Number(sm.quantity),
                    unit: sm.unit,
                    cost: cost
                };
            });

            // Deduct materials from inventory
            for (const sm of selectedMaterials) {
                if (sm.materialId && sm.quantity > 0) {
                    await updateDoc(doc(db, 'materials', sm.materialId), {
                        currentStock: increment(-Number(sm.quantity)),
                        updatedAt: serverTimestamp()
                    });

                    // Record material usage
                    await addDoc(collection(db, 'materialUsage'), {
                        bookingId: booking.id,
                        materialId: sm.materialId,
                        materialName: sm.materialName,
                        quantityUsed: Number(sm.quantity),
                        unit: sm.unit,
                        cost: sm.quantity * (sm.costPerUnit || 0),
                        usedAt: serverTimestamp()
                    });
                }
            }

            // Create expense entry for materials used
            if (totalMaterialCost > 0) {
                await addDoc(collection(db, 'expenses'), {
                    title: `Materials for ${booking.serviceName} - ${booking.licensePlate}`,
                    amount: totalMaterialCost,
                    category: 'supplies',
                    date: new Date().toISOString().split('T')[0],
                    paymentMode: 'internal',
                    note: `Auto-generated from service completion. Booking: ${booking.bookingReference || booking.id.slice(0, 8)}`,
                    bookingId: booking.id,
                    isAutoGenerated: true,
                    createdAt: serverTimestamp()
                });
            }

            // Complete the booking with additional data
            onComplete({
                waterUsage: Number(waterUsage) || 0,
                completedBy: user?.uid || 'unknown',
                completedByName: userProfile?.displayName || user?.email || 'Staff',
                materialsUsed: materialsUsed,
                totalMaterialCost: totalMaterialCost,
                completionNotes: notes,
                completedAt: serverTimestamp()
            });

        } catch (error) {
            console.error('Error completing service:', error);
            alert('Error completing service. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><CheckCircle size={20} /> Complete Service</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="completion-info" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                            <p><strong>{booking.customerName || 'N/A'}</strong></p>
                            <p><strong>{booking.serviceName}</strong></p>
                            <p style={{ fontSize: '0.875rem', color: '#666' }}>{booking.carMake} {booking.carModel} • {booking.licensePlate}</p>
                        </div>

                        <div className="form-group">
                            <label><Droplets size={16} style={{ marginRight: '0.5rem' }} />Water Usage (Liters)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={waterUsage}
                                onChange={(e) => setWaterUsage(e.target.value)}
                                placeholder="e.g., 30"
                            />
                        </div>

                        <div className="form-group">
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Materials Used</span>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={addMaterial}>
                                    + Add Material
                                </button>
                            </label>

                            {fetchingMaterials ? (
                                <p style={{ color: '#666', fontSize: '0.875rem' }}>Loading materials...</p>
                            ) : selectedMaterials.length === 0 ? (
                                <p style={{ color: '#666', fontSize: '0.875rem' }}>No materials added yet</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {selectedMaterials.map((sm, index) => (
                                        <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <select
                                                value={sm.materialId}
                                                onChange={(e) => updateSelectedMaterial(index, 'materialId', e.target.value)}
                                                style={{ flex: 2 }}
                                            >
                                                <option value="">Select Material</option>
                                                {materials.map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.name} ({m.currentStock} {m.unit})
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                step="0.01"
                                                placeholder="Qty"
                                                value={sm.quantity}
                                                onChange={(e) => updateSelectedMaterial(index, 'quantity', e.target.value)}
                                                style={{ flex: 1, width: '70px' }}
                                            />
                                            <button
                                                type="button"
                                                className="btn-icon danger"
                                                onClick={() => removeMaterial(index)}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="form-group">
                            <label>Completion Notes (Optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows="2"
                                placeholder="Any notes about the service..."
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-success" disabled={loading}>
                            {loading ? 'Completing...' : 'Complete Service'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Bookings;
