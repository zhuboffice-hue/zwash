import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../config/firebase';
import { collection, query, getDocs, orderBy, doc, getDoc, updateDoc, addDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore';
import { FileText, Download, Eye, Search, Printer, Receipt, MessageCircle, Copy, ExternalLink, Plus, Edit, Trash2, Archive, RotateCcw, X, Car } from 'lucide-react';
import * as XLSX from 'xlsx';

const Invoices = () => {
    const { hasPermission, isEmployee, user, userProfile, isSuperAdmin } = useAuth();

    // Get today and yesterday dates for employee filtering
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const todayStr = today.toISOString().split('T')[0];
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Core states
    const [invoices, setInvoices] = useState([]);
    const [archivedInvoices, setArchivedInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [settings, setSettings] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Tab state: 'active' or 'archived'
    const [activeTab, setActiveTab] = useState('active');

    // CRUD Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState(null);

    useEffect(() => {
        fetchInvoices();
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const docRef = doc(db, 'settings', 'business');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setSettings(docSnap.data());
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    const fetchInvoices = async () => {
        try {
            setLoading(true);

            // Fetch completed bookings
            let bookingsQuery = collection(db, 'bookings');
            if (userProfile?.shopId && !isSuperAdmin) {
                bookingsQuery = query(bookingsQuery, where('shopId', '==', userProfile.shopId));
            }
            const bookingsSnap = await getDocs(query(bookingsQuery));
            const completedBookings = bookingsSnap.docs
                .map(d => ({ id: d.id, ...d.data(), source: 'booking' }))
                .filter(b => b.status === 'completed' && !b.isArchived);

            // Fetch manual invoices
            let invoicesQuery = collection(db, 'invoices');
            if (userProfile?.shopId && !isSuperAdmin) {
                invoicesQuery = query(invoicesQuery, where('shopId', '==', userProfile.shopId));
            }
            const invoicesSnap = await getDocs(query(invoicesQuery));
            const manualInvoices = invoicesSnap.docs
                .map(d => ({ id: d.id, ...d.data(), source: 'invoice' }));

            // Separate active and archived
            const activeManual = manualInvoices.filter(inv => !inv.isArchived);
            const archivedManual = manualInvoices.filter(inv => inv.isArchived);
            const archivedBookings = bookingsSnap.docs
                .map(d => ({ id: d.id, ...d.data(), source: 'booking' }))
                .filter(b => b.status === 'completed' && b.isArchived);

            // Combine and sort by date
            const allActive = [...completedBookings, ...activeManual]
                .sort((a, b) => (b.bookingDate || b.invoiceDate || '').localeCompare(a.bookingDate || a.invoiceDate || ''));
            const allArchived = [...archivedBookings, ...archivedManual]
                .sort((a, b) => (b.bookingDate || b.invoiceDate || '').localeCompare(a.bookingDate || a.invoiceDate || ''));

            setInvoices(allActive);
            setArchivedInvoices(allArchived);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    // Archive an invoice (soft delete)
    const archiveInvoice = async (invoice) => {
        if (!window.confirm(`Archive invoice for ${invoice.customerName || 'this customer'}?`)) return;
        try {
            const collectionName = invoice.source === 'invoice' ? 'invoices' : 'bookings';
            await updateDoc(doc(db, collectionName, invoice.id), {
                isArchived: true,
                archivedAt: serverTimestamp()
            });
            fetchInvoices();
        } catch (error) {
            console.error('Error archiving invoice:', error);
            alert('Error archiving invoice');
        }
    };

    // Restore an archived invoice
    const restoreInvoice = async (invoice) => {
        try {
            const collectionName = invoice.source === 'invoice' ? 'invoices' : 'bookings';
            await updateDoc(doc(db, collectionName, invoice.id), {
                isArchived: false,
                restoredAt: serverTimestamp()
            });
            fetchInvoices();
        } catch (error) {
            console.error('Error restoring invoice:', error);
            alert('Error restoring invoice');
        }
    };

    const exportToExcel = () => {
        const exportData = invoices.map(inv => ({
            'Invoice #': inv.bookingReference || inv.id.slice(0, 8),
            Date: inv.bookingDate,
            Service: inv.serviceName,
            Amount: inv.price,
            'Paid Amount': inv.paidAmount || 0,
            'Payment Status': inv.paymentStatus || 'unpaid',
            'License Plate': inv.licensePlate,
            'Customer Name': inv.customerName,
            'Customer Phone': inv.contactPhone
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
        XLSX.writeFile(wb, `invoices_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Payment status update
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentPrice, setPaymentPrice] = useState(''); // New state for editable total price
    const [discount, setDiscount] = useState('');
    const [extraCharge, setExtraCharge] = useState('');
    const [paymentMode, setPaymentMode] = useState('cash');
    const [processing, setProcessing] = useState(false);

    const updatePaymentStatus = async () => {
        if (!paymentInvoice) return;
        try {
            setProcessing(true);
            const amount = Number(paymentAmount) || 0;
            // Use the edited price from state, or fallback to original
            const newTotalPrice = Number(paymentPrice) || paymentInvoice.price || 0;
            const previousPaid = paymentInvoice.paidAmount || 0;
            const newPaidTotal = previousPaid + amount;

            let status = 'unpaid';
            if (newPaidTotal >= newTotalPrice) status = 'paid';
            else if (newPaidTotal > 0) status = 'partial';

            const collectionName = paymentInvoice.source === 'invoice' ? 'invoices' : 'bookings';

            await updateDoc(doc(db, collectionName, paymentInvoice.id), {
                price: newTotalPrice, // Save the potentially edited price
                discount: Number(discount) || 0,
                extraCharge: Number(extraCharge) || 0,
                paidAmount: newPaidTotal,
                paymentStatus: status,
                paymentMode: paymentMode,
                lastPaymentDate: new Date().toISOString().split('T')[0],
                updatedAt: serverTimestamp()
            });

            // Update local state for both lists to ensure UI reflects changes immediately
            const updateList = (list) => list.map(inv =>
                inv.id === paymentInvoice.id
                    ? { ...inv, price: newTotalPrice, paidAmount: newPaidTotal, paymentStatus: status, paymentMode }
                    : inv
            );

            setInvoices(prev => updateList(prev));
            setArchivedInvoices(prev => updateList(prev));

            setShowPaymentModal(false);
            setPaymentInvoice(null);
            setPaymentAmount('');
            setPaymentPrice('');
            alert(`Payment recorded successfully! New Balance: ₹${newTotalPrice - newPaidTotal}`);
        } catch (error) {
            console.error('Error updating payment:', error);
            alert('Error recording payment');
        } finally {
            setProcessing(false);
        }
    };

    const getPaymentBadge = (invoice) => {
        const status = invoice.paymentStatus || 'unpaid';
        const badges = {
            'paid': { class: 'badge-completed', label: 'Paid' },
            'partial': { class: 'badge-progress', label: 'Partial' },
            'unpaid': { class: 'badge-pending', label: 'Unpaid' }
        };
        return badges[status] || badges.unpaid;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const formatTime12Hour = (time24) => {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':').map(Number);
        const period = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    // Generate PDF Invoice / GST Bill
    const generatePDF = (invoice, includeGST = false) => {
        const baseAmount = invoice.price || 0;
        // Fixed CGST and SGST at 9% each (total 18%)
        const cgstPercentage = 9;
        const sgstPercentage = 9;
        const cgstAmount = includeGST ? Math.round((baseAmount * cgstPercentage) / 100) : 0;
        const sgstAmount = includeGST ? Math.round((baseAmount * sgstPercentage) / 100) : 0;
        const totalGst = cgstAmount + sgstAmount;
        const totalAmount = baseAmount + totalGst;

        // Professional navy/indigo color scheme matching detailed branding
        const brandPrimary = '#1a1f3a';      // Deep navy
        const brandSecondary = '#2e3856';    // Medium navy
        const brandAccent = '#047857';       // Emerald green accent
        const brandSuccess = '#10b981';      // Green for GST

        const printContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${includeGST ? 'GST Bill' : 'Invoice'} - ${invoice.bookingReference || invoice.id.slice(0, 8)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; }
        .invoice-container { max-width: 800px; margin: 0 auto; padding: 30px 40px; }
        
        /* Header with Logo */
        .invoice-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: flex-start; 
            margin-bottom: 30px; 
            padding-bottom: 25px; 
            border-bottom: 3px solid ${brandPrimary}; 
        }
        .company-info { display: flex; align-items: flex-start; gap: 20px; }
        .company-logo { 
            width: 100px; 
            height: 100px; 
            object-fit: contain;
            border-radius: 8px;
        }
        .company-details h1 { font-size: 24px; color: ${brandPrimary}; margin-bottom: 8px; font-weight: 700; }
        .company-details p { color: #64748b; font-size: 12px; line-height: 1.6; }
        .company-details .contact { margin-top: 8px; }
        
        .invoice-title { text-align: right; }
        .invoice-title h2 { 
            font-size: 28px; 
            color: ${includeGST ? brandSuccess : brandPrimary}; 
            text-transform: uppercase; 
            letter-spacing: 2px;
            font-weight: 800;
        }
        .invoice-title .invoice-number { 
            font-size: 15px; 
            color: ${brandSecondary}; 
            margin-top: 8px;
            font-weight: 600;
        }
        .invoice-title .invoice-date { font-size: 13px; color: #64748b; margin-top: 4px; }
        
        /* Customer & Vehicle Details */
        .invoice-details { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 30px; 
            margin-bottom: 30px; 
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
        }
        .detail-section h3 { 
            font-size: 11px; 
            text-transform: uppercase; 
            color: ${brandSecondary}; 
            margin-bottom: 10px; 
            letter-spacing: 1.5px;
            font-weight: 700;
        }
        .detail-section p { font-size: 13px; line-height: 1.8; color: #475569; }
        .detail-section strong { color: ${brandPrimary}; }
        
        /* Items Table */
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .items-table th { 
            background: ${brandPrimary}; 
            color: white;
            padding: 14px 15px; 
            text-align: left; 
            font-size: 11px; 
            text-transform: uppercase; 
            letter-spacing: 1px;
            font-weight: 600;
        }
        .items-table td { 
            padding: 14px 15px; 
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
        }
        .items-table .text-right { text-align: right; }
        .items-table tbody tr:hover { background: #f8fafc; }
        
        /* Totals */
        .totals { width: 280px; margin-left: auto; }
        .totals-row { 
            display: flex; 
            justify-content: space-between; 
            padding: 10px 0; 
            border-bottom: 1px solid #e2e8f0;
            font-size: 13px;
        }
        .totals-row.total { 
            font-size: 18px; 
            font-weight: 700; 
            color: ${brandPrimary}; 
            border-bottom: none;
            border-top: 2px solid ${brandPrimary};
            padding: 15px 0;
            margin-top: 5px;
        }
        .totals-row.gst { color: ${brandSuccess}; font-weight: 500; }
        
        /* GST Info Box */
        ${includeGST ? `
        .gst-info { 
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); 
            border: 1px solid #86efac; 
            border-radius: 8px; 
            padding: 18px 20px; 
            margin: 25px 0; 
        }
        .gst-info h4 { color: ${brandSuccess}; margin-bottom: 10px; font-size: 13px; font-weight: 700; }
        .gst-info p { font-size: 12px; color: #166534; line-height: 1.6; }` : ''}
        
        /* Footer */
        .invoice-footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e2e8f0; 
            text-align: center;
        }
        .thank-you { 
            font-size: 16px; 
            color: ${brandPrimary}; 
            margin-bottom: 12px;
            font-weight: 600;
        }
        .invoice-footer .note { font-size: 11px; color: #94a3b8; }
        
        @media print { 
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .invoice-container { padding: 20px; }
        }
    </style>
</head>
<body>
    <div class="invoice-container">
        <div class="invoice-header">
            <div class="company-info">
                <img src="/detail.svg" class="company-logo" alt="ZWash Logo" />
                <div class="company-details">
                    <h1>${settings?.businessName || 'ZWash Car Wash'}</h1>
                    <p>Suchindram Byp, near Ragavendra Temple</p>
                    <p>Nagercoil, Tamil Nadu 629704</p>
                    <p class="contact">📞 +91 9363911500 | ✉️ detailingcommando@gmail.com</p>
                    ${includeGST && settings?.gstNumber ? `<p style="margin-top:5px;font-weight:600;">GSTIN: ${settings.gstNumber}</p>` : ''}
                </div>
            </div>
            <div class="invoice-title">
                <h2>${includeGST ? 'Tax Invoice' : 'Invoice'}</h2>
                <p class="invoice-number">#${invoice.bookingReference || invoice.id.slice(0, 8).toUpperCase()}</p>
                <p class="invoice-date">Date: ${invoice.bookingDate}</p>
            </div>
        </div>
        
        <div class="invoice-details">
            <div class="detail-section">
                <h3>Bill To</h3>
                <p><strong>${invoice.customerName || 'Walk-in Customer'}</strong></p>
                <p>Phone: ${invoice.contactPhone || 'N/A'}</p>
            </div>
            <div class="detail-section">
                <h3>Vehicle Info</h3>
                <p><strong>${invoice.carMake || ''} ${invoice.carModel || ''}</strong></p>
                <p>Plate: ${invoice.licensePlate || 'N/A'}</p>
                <p>Service Time: ${formatTime12Hour(invoice.startTime)}</p>
            </div>
        </div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Service Description</th>
                    <th style="width:60px;">Qty</th>
                    <th class="text-right" style="width:100px;">Rate</th>
                    <th class="text-right" style="width:100px;">Amount</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>${invoice.serviceName}</strong></td>
                    <td>1</td>
                    <td class="text-right">${formatCurrency(baseAmount)}</td>
                    <td class="text-right"><strong>${formatCurrency(baseAmount)}</strong></td>
                </tr>
            </tbody>
        </table>
        
        <div class="totals">
            <div class="totals-row">
                <span>Subtotal</span>
                <span>${formatCurrency(baseAmount)}</span>
            </div>
            ${includeGST ? `
            <div class="totals-row gst">
                <span>CGST @ ${cgstPercentage}%</span>
                <span>${formatCurrency(cgstAmount)}</span>
            </div>
            <div class="totals-row gst">
                <span>SGST @ ${sgstPercentage}%</span>
                <span>${formatCurrency(sgstAmount)}</span>
            </div>
            ` : ''}
            <div class="totals-row total">
                <span>Total Amount</span>
                <span>${formatCurrency(totalAmount)}</span>
            </div>
        </div>
        
        ${includeGST && settings?.gstNumber ? `
        <div class="gst-info">
            <h4>📋 GST Details</h4>
            <p><strong>GSTIN:</strong> ${settings.gstNumber}</p>
            <p><strong>HSN/SAC:</strong> 9992 (Washing and Cleaning Services)</p>
            <p><strong>CGST (${cgstPercentage}%):</strong> ${formatCurrency(cgstAmount)} | <strong>SGST (${sgstPercentage}%):</strong> ${formatCurrency(sgstAmount)}</p>
            <p style="margin-top:5px;"><strong>Total Tax:</strong> ${formatCurrency(totalGst)}</p>
        </div>
        ` : ''}
        
        <div class="invoice-footer">
            <p class="thank-you">Thank you for choosing us! 🙏</p>
            <p class="note">This is a computer-generated ${includeGST ? 'tax invoice' : 'invoice'} and does not require a signature.</p>
        </div>
    </div>
</body>
</html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.onload = function () {
            printWindow.print();
        };
    };

    const openInvoiceModal = (invoice) => {
        setSelectedInvoice(invoice);
        setShowModal(true);
    };

    // Generate shareable invoice link
    const getInvoiceLink = (invoice) => {
        const baseUrl = window.location.origin.replace('5173', '5174'); // Customer app port
        return `${baseUrl}/invoice/${invoice.id}`;
    };

    // Share invoice via WhatsApp
    const shareViaWhatsApp = (invoice) => {
        const link = getInvoiceLink(invoice);
        const message = `Hi! Here's your invoice from ${settings?.businessName || 'ZWash Car Wash'}\n\n` +
            `📋 Invoice: #${invoice.bookingReference || invoice.id.slice(0, 8).toUpperCase()}\n` +
            `🚗 Service: ${invoice.serviceName}\n` +
            `💰 Amount: ${formatCurrency(invoice.price)}\n` +
            `📅 Date: ${invoice.bookingDate}\n\n` +
            `View your invoice online: ${link}\n\n` +
            `Thank you for choosing us! 🙏`;

        const whatsappUrl = `https://wa.me/${invoice.contactPhone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    // Copy invoice link
    const copyInvoiceLink = (invoice) => {
        const link = getInvoiceLink(invoice);
        navigator.clipboard.writeText(link).then(() => {
            alert('Invoice link copied to clipboard!');
        });
    };

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.price || 0), 0);

    // Select active or archived based on tab
    const currentList = activeTab === 'active' ? invoices : archivedInvoices;

    // For employees: only show today's and yesterday's invoices
    const dateFilteredInvoices = isEmployee
        ? currentList.filter(inv => inv.bookingDate === todayStr || inv.bookingDate === yesterdayStr)
        : currentList;

    const filteredInvoices = dateFilteredInvoices.filter(inv => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            inv.bookingReference?.toLowerCase().includes(search) ||
            inv.serviceName?.toLowerCase().includes(search) ||
            inv.contactPhone?.includes(search) ||
            inv.licensePlate?.toLowerCase().includes(search)
        );
    });

    return (
        <div className="invoices-page">
            <div className="page-header">
                <div>
                    <h1><FileText size={28} /> Invoices</h1>
                    <p className="subtitle">
                        {isEmployee ? "Today's and yesterday's invoices" : 'Manage service invoices'}
                    </p>
                </div>
                <div className="header-actions">
                    {/* Tab Toggle */}
                    <div className="tab-group" style={{ background: 'var(--navy-800)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                        <button
                            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
                            onClick={() => setActiveTab('active')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                background: activeTab === 'active' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'active' ? 'white' : 'rgba(255,255,255,0.6)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <FileText size={16} /> Active
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'archived' ? 'active' : ''}`}
                            onClick={() => setActiveTab('archived')}
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                background: activeTab === 'archived' ? 'var(--primary)' : 'transparent',
                                color: activeTab === 'archived' ? 'white' : 'rgba(255,255,255,0.6)',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Archive size={16} /> Archived ({archivedInvoices.length})
                        </button>
                    </div>
                    <button className="btn btn-secondary" onClick={exportToExcel}>
                        <Download size={18} /> Export
                    </button>
                    {hasPermission('bookings', 'create') && (
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            <Plus size={18} /> Create Invoice
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="quick-stats-row">
                <div className="quick-stat-card">
                    <div className="stat-icon green">
                        <FileText size={20} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-value">{dateFilteredInvoices.length}</span>
                        <span className="stat-label">{isEmployee ? "Today's Invoices" : 'Total Invoices'}</span>
                    </div>
                </div>
                {/* Only show revenue to admins with finance permission */}
                {hasPermission('finance') && (
                    <div className="quick-stat-card">
                        <div className="stat-icon blue">
                            <FileText size={20} />
                        </div>
                        <div className="stat-info">
                            <span className="stat-value">{formatCurrency(totalRevenue)}</span>
                            <span className="stat-label">Total Revenue</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Search */}
            <div className="search-filter-bar">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search invoices..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Invoices Table */}
            <div className="card">
                <div className="card-body">
                    {loading ? (
                        <div className="empty-state"><div className="loader"></div></div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={48} />
                            <p>No invoices found</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Invoice #</th>
                                        <th>Date</th>
                                        <th>Service</th>
                                        <th>Amount</th>
                                        <th>Payment</th>
                                        <th>Owner Details</th>
                                        <th>Vehicle</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredInvoices.map(invoice => {
                                        const payBadge = getPaymentBadge(invoice);
                                        return (
                                            <tr key={invoice.id}>
                                                <td><strong>{invoice.bookingReference || invoice.id.slice(0, 8)}</strong></td>
                                                <td>{invoice.bookingDate}</td>
                                                <td>{invoice.serviceName}</td>
                                                <td>
                                                    <div>{formatCurrency(invoice.price)}</div>
                                                    {invoice.paidAmount > 0 && invoice.paidAmount < invoice.price && (
                                                        <small style={{ color: '#10b981' }}>Paid: {formatCurrency(invoice.paidAmount)}</small>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${payBadge.class}`}>{payBadge.label}</span>
                                                </td>
                                                <td>
                                                    <strong>{invoice.customerName || 'Walk-in'}</strong>
                                                    <br />
                                                    <small style={{ color: 'var(--navy-500)' }}>{invoice.contactPhone || 'N/A'}</small>
                                                </td>
                                                <td>{invoice.licensePlate}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                        {invoice.paymentStatus !== 'paid' && (
                                                            <button
                                                                className="btn btn-sm btn-primary"
                                                                onClick={() => {
                                                                    setPaymentInvoice(invoice);
                                                                    const currentPrice = invoice.price || 0;
                                                                    const currentPaid = invoice.paidAmount || 0;
                                                                    // Initialize fields
                                                                    setDiscount(invoice.discount || '');
                                                                    setExtraCharge(invoice.extraCharge || '');
                                                                    setPaymentPrice(String(currentPrice));

                                                                    // Default payment amount is remaining balance
                                                                    const balance = currentPrice - currentPaid;
                                                                    setPaymentAmount(String(Math.max(0, balance)));

                                                                    setShowPaymentModal(true);
                                                                }}
                                                                title="Record Payment"
                                                            >
                                                                💳 Pay
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-sm btn-secondary"
                                                            onClick={() => generatePDF(invoice, false)}
                                                            title="Print Invoice"
                                                        >
                                                            <Printer size={14} />
                                                        </button>
                                                        {settings?.gstEnabled && (
                                                            <button
                                                                className="btn btn-sm"
                                                                onClick={() => generatePDF(invoice, true)}
                                                                title="Print GST Bill"
                                                                style={{ background: '#10b981', color: 'white' }}
                                                            >
                                                                <Receipt size={14} />
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-sm"
                                                            onClick={() => shareViaWhatsApp(invoice)}
                                                            title="Share via WhatsApp"
                                                            style={{ background: '#25D366', color: 'white' }}
                                                        >
                                                            <MessageCircle size={14} />
                                                        </button>
                                                        {/* Edit Button */}
                                                        {hasPermission('bookings', 'edit') && (
                                                            <button
                                                                className="btn btn-sm btn-secondary"
                                                                onClick={() => { setEditingInvoice(invoice); setShowEditModal(true); }}
                                                                title="Edit Invoice"
                                                            >
                                                                <Edit size={14} />
                                                            </button>
                                                        )}
                                                        {/* Archive/Delete Button */}
                                                        {hasPermission('bookings', 'delete') && (
                                                            <button
                                                                className="btn btn-sm"
                                                                onClick={() => archiveInvoice(invoice)}
                                                                title="Archive Invoice"
                                                                style={{ background: '#ef4444', color: 'white' }}
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

                    {/* Mobile Cards */}
                    <div className="mobile-cards">
                        {filteredInvoices.map(invoice => (
                            <div key={invoice.id} className="booking-card">
                                <div className="booking-card-header">
                                    <strong>{invoice.bookingReference || invoice.id.slice(0, 8)}</strong>
                                    <span className="badge badge-completed">Completed</span>
                                </div>
                                <div className="booking-card-body">
                                    <p><strong>{invoice.serviceName}</strong></p>
                                    <p>{invoice.bookingDate} | {invoice.licensePlate}</p>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--navy-600)' }}>
                                        {invoice.customerName} - {invoice.contactPhone}
                                    </p>
                                    <p className="booking-price">{formatCurrency(invoice.price)}</p>
                                </div>
                                <div className="booking-card-footer" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => generatePDF(invoice, false)}
                                    >
                                        <Printer size={14} /> Invoice
                                    </button>
                                    {settings?.gstEnabled && (
                                        <button
                                            className="btn btn-sm"
                                            onClick={() => generatePDF(invoice, true)}
                                            style={{ background: '#10b981', color: 'white' }}
                                        >
                                            <Receipt size={14} /> GST Bill
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-sm"
                                        onClick={() => shareViaWhatsApp(invoice)}
                                        style={{ background: '#25D366', color: 'white' }}
                                    >
                                        <MessageCircle size={14} /> WhatsApp
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {
                showPaymentModal && paymentInvoice && (
                    <div className="modal">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h2>💳 Record Payment</h2>
                                <button className="modal-close" onClick={() => setShowPaymentModal(false)}>&times;</button>
                            </div>
                            <div className="modal-body">
                                <div style={{ background: 'var(--navy-50)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                    <p><strong>Invoice:</strong> {paymentInvoice.bookingReference}</p>
                                    <p><strong>Service:</strong> {paymentInvoice.serviceName}</p>
                                    <p><strong>Invoice:</strong> {paymentInvoice.bookingReference}</p>
                                    <p><strong>Service:</strong> {paymentInvoice.serviceName}</p>

                                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                                        <label style={{ color: 'var(--navy-600)', fontSize: '0.85rem' }}>Base Service Price</label>
                                        <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                                            {formatCurrency((paymentInvoice.price || 0) + (Number(paymentInvoice.discount) || 0) - (Number(paymentInvoice.extraCharge) || 0))}
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '400', marginLeft: '0.5rem' }}>(Original)</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label style={{ color: 'var(--navy-600)', fontSize: '0.85rem' }}>Discount (-)</label>
                                            <input
                                                type="number"
                                                value={discount}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setDiscount(val);
                                                    // Recalculate total
                                                    const base = (paymentInvoice.price || 0) + (Number(paymentInvoice.discount) || 0) - (Number(paymentInvoice.extraCharge) || 0);
                                                    const newTotal = base - (Number(val) || 0) + (Number(extraCharge) || 0);
                                                    setPaymentPrice(String(newTotal));
                                                    setPaymentAmount(String(Math.max(0, newTotal - (paymentInvoice.paidAmount || 0))));
                                                }}
                                                placeholder="0"
                                                style={{ borderColor: '#ef4444', color: '#b91c1c' }}
                                            />
                                        </div>
                                        <div className="form-group" style={{ flex: 1 }}>
                                            <label style={{ color: 'var(--navy-600)', fontSize: '0.85rem' }}>Extra / Tip (+)</label>
                                            <input
                                                type="number"
                                                value={extraCharge}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setExtraCharge(val);
                                                    // Recalculate total
                                                    const base = (paymentInvoice.price || 0) + (Number(paymentInvoice.discount) || 0) - (Number(paymentInvoice.extraCharge) || 0);
                                                    const newTotal = base - (Number(discount) || 0) + (Number(val) || 0);
                                                    setPaymentPrice(String(newTotal));
                                                    setPaymentAmount(String(Math.max(0, newTotal - (paymentInvoice.paidAmount || 0))));
                                                }}
                                                placeholder="0"
                                                style={{ borderColor: '#10b981', color: '#059669' }}
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group" style={{ marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #e2e8f0' }}>
                                        <label style={{ color: 'var(--navy-800)', fontSize: '0.9rem', fontWeight: '600' }}>Final Bill Amount</label>
                                        <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>
                                            {formatCurrency(paymentPrice)}
                                        </div>
                                    </div>

                                    {paymentInvoice.paidAmount > 0 && (
                                        <p><strong>Already Paid:</strong> {formatCurrency(paymentInvoice.paidAmount)}</p>
                                    )}
                                    <p style={{ color: '#f59e0b', fontWeight: '700', marginTop: '0.5rem' }}>
                                        <strong>Balance Due:</strong> {formatCurrency((Number(paymentPrice) || 0) - (paymentInvoice.paidAmount || 0))}
                                    </p>
                                </div>
                                <div className="form-group">
                                    <label>Payment Amount *</label>
                                    <input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="Enter amount"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Payment Mode</label>
                                    <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                                        <option value="cash">Cash</option>
                                        <option value="upi">UPI</option>
                                        <option value="card">Card</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary" onClick={() => setShowPaymentModal(false)}>Cancel</button>
                                <button className="btn btn-primary" onClick={updatePaymentStatus} disabled={processing}>
                                    {processing ? 'Processing...' : 'Record Payment'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Invoice Modal */}
            {showEditModal && editingInvoice && (
                <EditInvoiceModal
                    invoice={editingInvoice}
                    onClose={() => { setShowEditModal(false); setEditingInvoice(null); }}
                    onSuccess={fetchInvoices}
                />
            )}

            {/* Create Invoice Modal */}
            {showCreateModal && (
                <CreateInvoiceModal
                    onClose={() => setShowCreateModal(false)}
                    onSuccess={fetchInvoices}
                    user={user}
                    userProfile={userProfile}
                />
            )}
        </div >
    );
};

const EditInvoiceModal = ({ invoice, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        customerName: invoice.customerName || '',
        contactPhone: invoice.contactPhone || '',
        carMake: invoice.carMake || '',
        carModel: invoice.carModel || '',
        licensePlate: invoice.licensePlate || '',
        serviceName: invoice.serviceName || '',
        price: invoice.price || 0
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const collectionName = invoice.source === 'invoice' ? 'invoices' : 'bookings';
            await updateDoc(doc(db, collectionName, invoice.id), {
                ...formData,
                price: Number(formData.price),
                updatedAt: serverTimestamp()
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error updating invoice:', error);
            alert('Failed to update invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Edit size={20} /> Edit Invoice</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Customer Name</label>
                            <input
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                value={formData.contactPhone}
                                onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Details (Make/Model)</label>
                                <input
                                    value={`${formData.carMake} ${formData.carModel}`}
                                    onChange={e => {
                                        // Simple split logic
                                        const parts = e.target.value.split(' ');
                                        setFormData({
                                            ...formData,
                                            carMake: parts[0] || '',
                                            carModel: parts.slice(1).join(' ') || ''
                                        });
                                    }}
                                    placeholder="Toyota Camry"
                                />
                            </div>
                            <div className="form-group">
                                <label>License Plate</label>
                                <input
                                    value={formData.licensePlate}
                                    onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Service Name</label>
                            <input
                                value={formData.serviceName}
                                onChange={e => setFormData({ ...formData, serviceName: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Amount (₹)</label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const CreateInvoiceModal = ({ onClose, onSuccess, user, userProfile }) => {
    const [formData, setFormData] = useState({
        customerName: '',
        contactPhone: '',
        vehicleType: 'car',
        carMake: '',
        carModel: '',
        licensePlate: '',
        serviceName: '',
        price: '',
        invoiceDate: new Date().toISOString().split('T')[0]
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Generate ID similar to bookings but for manual invoices
            const ref = `INV-${Date.now().toString().slice(-6)}`;

            await addDoc(collection(db, 'invoices'), {
                ...formData,
                bookingReference: ref,
                price: Number(formData.price),
                status: 'completed',
                paymentStatus: 'unpaid',
                paidAmount: 0,
                createdBy: user?.uid || 'unknown',
                shopId: userProfile?.shopId,
                createdAt: serverTimestamp(),
                isManual: true
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error creating invoice:', error);
            alert('Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal">
            <div className="modal-content">
                <div className="modal-header">
                    <h2><Plus size={20} /> Create Manual Invoice</h2>
                    <button className="modal-close" onClick={onClose}>&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="date"
                                    value={formData.invoiceDate}
                                    onChange={e => setFormData({ ...formData, invoiceDate: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Customer Name</label>
                            <input
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                                required
                                placeholder="Enter customer name"
                            />
                        </div>
                        <div className="form-group">
                            <label>Phone</label>
                            <input
                                value={formData.contactPhone}
                                onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                                placeholder="Customer phone"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Make & Model</label>
                                <input
                                    value={`${formData.carMake} ${formData.carModel}`.trim()}
                                    onChange={e => {
                                        const parts = e.target.value.split(' ');
                                        setFormData({
                                            ...formData,
                                            carMake: parts[0] || '',
                                            carModel: parts.slice(1).join(' ') || ''
                                        });
                                    }}
                                    placeholder="e.g. Honda City"
                                />
                            </div>
                            <div className="form-group">
                                <label>License Plate</label>
                                <input
                                    value={formData.licensePlate}
                                    onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                                    placeholder="TN-00-AA-0000"
                                    style={{ textTransform: 'uppercase' }}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Service Name</label>
                            <input
                                value={formData.serviceName}
                                onChange={e => setFormData({ ...formData, serviceName: e.target.value })}
                                required
                                placeholder="e.g. Full Wash"
                            />
                        </div>
                        <div className="form-group">
                            <label>Amount (₹)</label>
                            <input
                                type="number"
                                value={formData.price}
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                required
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'Create Invoice' : 'Create Invoice'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Invoices;
