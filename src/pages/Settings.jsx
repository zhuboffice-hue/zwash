import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
    Settings as SettingsIcon,
    Store,
    Clock,
    DollarSign,
    Calendar,
    Save,
    Download,
    FileText,
    ToggleLeft,
    ToggleRight
} from 'lucide-react';
import * as XLSX from 'xlsx';

const Settings = () => {
    const { isAdmin, user } = useAuth();
    const { theme, updateTheme } = useTheme();
    const [settings, setSettings] = useState({
        businessName: 'My Car Wash',
        businessPhone: '',
        businessEmail: '',
        businessAddress: '',
        currency: 'INR',
        currencySymbol: '₹',
        openTime: '09:00',
        closeTime: '18:00',
        slotDuration: 30,
        bufferTime: 15,
        maxConcurrentBookings: 2,
        // GST Settings
        gstEnabled: false,
        gstNumber: '',
        gstPercentage: 18,
        // Default Templates
        whatsappConfirmation: '',
        whatsappReminder: '',
        workingDays: [1, 2, 3, 4, 5, 6]
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user]);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            // Use Auth UID as the document ID for shop-specific settings
            const docRef = doc(db, 'settings', user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', user.uid), {
                ...settings,
                updatedAt: serverTimestamp()
            });
            alert('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleBackup = async () => {
        try {
            // This is a simple backup - in production you'd want to backup all collections
            const backup = {
                settings: settings,
                exportedAt: new Date().toISOString()
            };

            const dataStr = JSON.stringify(backup, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `zwash_backup_${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Backup error:', error);
        }
    };

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader"></div>
            </div>
        );
    }

    return (
        <div className="settings-page">
            <div className="page-header">
                <div>
                    <h1><SettingsIcon size={28} /> Settings</h1>
                    <p className="subtitle">Configure your business settings</p>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary" onClick={handleBackup}>
                        <Download size={18} /> Backup Data
                    </button>
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={saveSettings} disabled={saving}>
                            <Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    )}
                </div>
            </div>

            <div className="settings-grid">
                {/* Business Info */}
                <div className="card">
                    <div className="card-header">
                        <h3><Store size={18} /> Business Information</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Business Name</label>
                            <input
                                name="businessName"
                                value={settings.businessName}
                                onChange={handleChange}
                                placeholder="Your Car Wash Name"
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    name="businessPhone"
                                    value={settings.businessPhone}
                                    onChange={handleChange}
                                    placeholder="+91 98765 43210"
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    name="businessEmail"
                                    type="email"
                                    value={settings.businessEmail}
                                    onChange={handleChange}
                                    placeholder="contact@carwash.com"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Address</label>
                            <textarea
                                name="businessAddress"
                                value={settings.businessAddress}
                                onChange={handleChange}
                                rows="2"
                                placeholder="123 Main Street, Nagercoil"
                            />
                        </div>
                    </div>
                </div>

                {/* UI Customization */}
                {isAdmin && (
                    <div className="card">
                        <div className="card-header">
                            <h3><SettingsIcon size={18} /> UI Appearance</h3>
                        </div>
                        <div className="card-body">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Primary Brand Color</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="color"
                                            value={theme?.primaryColor || '#047857'}
                                            onChange={(e) => updateTheme({ ...theme, primaryColor: e.target.value })}
                                            style={{ width: '50px', height: '40px', padding: '0', border: 'none' }}
                                        />
                                        <input
                                            type="text"
                                            value={theme?.primaryColor || '#047857'}
                                            onChange={(e) => updateTheme({ ...theme, primaryColor: e.target.value })}
                                            placeholder="#047857"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Secondary / Accent Color</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="color"
                                            value={theme?.secondaryColor || '#d97706'}
                                            onChange={(e) => updateTheme({ ...theme, secondaryColor: e.target.value })}
                                            style={{ width: '50px', height: '40px', padding: '0', border: 'none' }}
                                        />
                                        <input
                                            type="text"
                                            value={theme?.secondaryColor || '#d97706'}
                                            onChange={(e) => updateTheme({ ...theme, secondaryColor: e.target.value })}
                                            placeholder="#d97706"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Sidebar Background</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <input
                                            type="color"
                                            value={theme?.sidebarColor || '#1e293b'}
                                            onChange={(e) => updateTheme({ ...theme, sidebarColor: e.target.value })}
                                            style={{ width: '50px', height: '40px', padding: '0', border: 'none' }}
                                        />
                                        <input
                                            type="text"
                                            value={theme?.sidebarColor || '#1e293b'}
                                            onChange={(e) => updateTheme({ ...theme, sidebarColor: e.target.value })}
                                            placeholder="#1e293b"
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label>Border Radius</label>
                                    <select
                                        value={theme?.borderRadius || '8px'}
                                        onChange={(e) => updateTheme({ ...theme, borderRadius: e.target.value })}
                                    >
                                        <option value="0px">Square (0px)</option>
                                        <option value="4px">Small (4px)</option>
                                        <option value="8px">Medium (8px)</option>
                                        <option value="12px">Large (12px)</option>
                                        <option value="20px">Round (20px)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Operating Hours */}
                <div className="card">
                    <div className="card-header">
                        <h3><Clock size={18} /> Operating Hours</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Opening Time</label>
                                <input
                                    name="openTime"
                                    type="time"
                                    value={settings.openTime}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="form-group">
                                <label>Closing Time</label>
                                <input
                                    name="closeTime"
                                    type="time"
                                    value={settings.closeTime}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Slot Duration (minutes)</label>
                                <input
                                    name="slotDuration"
                                    type="number"
                                    value={settings.slotDuration}
                                    onChange={handleChange}
                                    min="15"
                                    max="120"
                                />
                            </div>
                            <div className="form-group">
                                <label>Buffer Time (minutes)</label>
                                <input
                                    name="bufferTime"
                                    type="number"
                                    value={settings.bufferTime}
                                    onChange={handleChange}
                                    min="0"
                                    max="60"
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Max Concurrent Bookings</label>
                            <input
                                name="maxConcurrentBookings"
                                type="number"
                                value={settings.maxConcurrentBookings}
                                onChange={handleChange}
                                min="1"
                                max="10"
                            />
                        </div>
                    </div>
                </div>

                {/* Currency */}
                <div className="card">
                    <div className="card-header">
                        <h3><DollarSign size={18} /> Currency Settings</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Currency Code</label>
                                <select name="currency" value={settings.currency} onChange={handleChange}>
                                    <option value="INR">INR - Indian Rupee</option>
                                    <option value="USD">USD - US Dollar</option>
                                    <option value="EUR">EUR - Euro</option>
                                    <option value="GBP">GBP - British Pound</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Currency Symbol</label>
                                <input
                                    name="currencySymbol"
                                    value={settings.currencySymbol}
                                    onChange={handleChange}
                                    placeholder="₹"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* GST Settings */}
                <div className="card">
                    <div className="card-header">
                        <h3><FileText size={18} /> GST / Tax Settings</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Enable GST</label>
                            <button
                                type="button"
                                className="toggle-btn"
                                onClick={() => setSettings(prev => ({ ...prev, gstEnabled: !prev.gstEnabled }))}
                                style={{
                                    background: settings.gstEnabled ? 'var(--success)' : 'var(--navy-300)',
                                    border: 'none',
                                    padding: '0.5rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {settings.gstEnabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                                {settings.gstEnabled ? 'Enabled' : 'Disabled'}
                            </button>
                        </div>

                        {settings.gstEnabled && (
                            <>
                                <div className="form-group">
                                    <label>GST Number (GSTIN)</label>
                                    <input
                                        name="gstNumber"
                                        value={settings.gstNumber}
                                        onChange={handleChange}
                                        placeholder="22AAAAA0000A1Z5"
                                        style={{ textTransform: 'uppercase' }}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>GST Percentage (%)</label>
                                    <input
                                        name="gstPercentage"
                                        type="number"
                                        value={settings.gstPercentage}
                                        onChange={handleChange}
                                        min="0"
                                        max="28"
                                        placeholder="18"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* WhatsApp Message Templates */}
                <div className="card">
                    <div className="card-header">
                        <h3>📱 WhatsApp Templates</h3>
                    </div>
                    <div className="card-body">
                        <div className="form-group">
                            <label>Booking Confirmation</label>
                            <textarea
                                name="whatsappConfirmation"
                                value={settings.whatsappConfirmation || 'Hi {name}! Booking confirmed. 📅 {date}, ⏰ {time}, 🚗 {service}. - {business}'}
                                onChange={handleChange}
                                rows="2"
                            />
                        </div>
                        <div className="form-group">
                            <label>Reminder Message</label>
                            <textarea
                                name="whatsappReminder"
                                value={settings.whatsappReminder || 'Reminder: Your car wash is tomorrow at {time}. - {business}'}
                                onChange={handleChange}
                                rows="2"
                            />
                        </div>
                        <small style={{ color: 'var(--navy-500)' }}>Placeholders: {'{name}'}, {'{date}'}, {'{time}'}, {'{service}'}, {'{business}'}</small>
                    </div>
                </div>

                {/* Working Days */}
                <div className="card">
                    <div className="card-header">
                        <h3><Calendar size={18} /> Working Days</h3>
                    </div>
                    <div className="card-body">
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => {
                                const days = settings.workingDays || [1, 2, 3, 4, 5, 6];
                                const isOn = days.includes(i);
                                return (
                                    <button key={day} type="button" onClick={() => {
                                        const newDays = isOn ? days.filter(d => d !== i) : [...days, i];
                                        setSettings(prev => ({ ...prev, workingDays: newDays }));
                                    }} style={{
                                        padding: '0.5rem 0.75rem', borderRadius: '6px',
                                        border: 'none', background: isOn ? 'var(--primary)' : '#e5e7eb',
                                        color: isOn ? '#fff' : '#374151', fontWeight: 600, cursor: 'pointer'
                                    }}>{day}</button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        .settings-grid {
          display: grid;
          gap: 1.5rem;
        }
        
        .settings-grid .card {
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        
        .settings-grid .card-header {
          background: var(--navy-50);
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--navy-100);
        }
        
        .settings-grid .card-header h3 {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--navy-800);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0;
        }
        
        .settings-grid .card-body {
          padding: 1.25rem;
        }
        
        .gst-toggle {
          background: var(--navy-100);
          color: var(--navy-600);
          border: none;
          padding: 0.5rem 1rem;
          border-radius: var(--radius-md);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }
        
        .gst-toggle.enabled {
          background: var(--primary);
          color: white;
        }
        
        @media (max-width: 768px) {
          .settings-grid {
            gap: 1rem;
          }
          
          .settings-grid .card-header {
            padding: 0.875rem 1rem;
          }
          
          .settings-grid .card-header h3 {
            font-size: 0.9rem;
          }
          
          .settings-grid .card-body {
            padding: 1rem;
          }
          
          .form-row {
            flex-direction: column;
          }
          
          .settings-grid textarea {
            font-size: 0.875rem;
          }
        }
      `}</style>
        </div>
    );
};

export default Settings;
