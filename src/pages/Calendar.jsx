import { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CalendarDays, ChevronLeft, ChevronRight, Car, Clock, Phone, X, CheckCircle, AlertCircle } from 'lucide-react';
import { generateAvailableStartTimes, getSettings, timeToMinutes } from '../utils/schedulingEngine';

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedBookings, setSelectedBookings] = useState([]);

  // Timeline states
  const [settings, setSettings] = useState(null);
  const [timelineSlots, setTimelineSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const s = await getSettings(db);
      setSettings(s);
    };
    loadSettings();
  }, []);

  useEffect(() => {
    fetchMonthBookings();
  }, [currentDate]);

  useEffect(() => {
    if (selectedDate && settings) {
      generateTimeline();
    }
  }, [selectedDate, selectedBookings, settings]);

  const generateTimeline = async () => {
    setLoadingSlots(true);
    try {
      // Use a standard 30 min duration to check slot status
      // We pass the ALREADY FETCHED selectedBookings to avoid re-fetching
      const slots = await generateAvailableStartTimes({
        db,
        dateStr: selectedDate,
        service: { durationMinutes: 30, category: 'View' }, // Dummy service
        settings,
        existingBookings: selectedBookings,
        includePast: true // Show all slots for the day
      });
      setTimelineSlots(slots);
    } catch (err) {
      console.error("Error generating timeline", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const fetchMonthBookings = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Get first and last day of month
      const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const bookingsRef = collection(db, 'bookings');
      const q = query(
        bookingsRef,
        where('bookingDate', '>=', firstDay),
        where('bookingDate', '<=', lastDay)
      );

      const snapshot = await getDocs(q);
      const bookingsByDate = {};

      snapshot.forEach(doc => {
        const data = doc.data();
        const date = data.bookingDate;
        if (!bookingsByDate[date]) bookingsByDate[date] = [];
        bookingsByDate[date].push({ id: doc.id, ...data });
      });

      setBookings(bookingsByDate);
    } catch (error) {
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
    setSelectedBookings([]);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
    setSelectedBookings([]);
  };

  const handleDayClick = (dateStr, dayBookings) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setSelectedBookings([]);
    } else {
      setSelectedDate(dateStr);
      setSelectedBookings(dayBookings);
    }
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

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayBookings = bookings[dateStr] || [];
    const isToday = new Date().toISOString().split('T')[0] === dateStr;
    const isSelected = selectedDate === dateStr;

    days.push(
      <div
        key={day}
        className={`calendar-day ${isToday ? 'today' : ''} ${dayBookings.length > 0 ? 'has-bookings' : ''} ${isSelected ? 'selected' : ''}`}
        onClick={() => handleDayClick(dateStr, dayBookings)}
        style={{ cursor: 'pointer' }}
      >
        <span className="day-number">{day}</span>
        {dayBookings.length > 0 && (
          <div className="day-bookings">
            <span className="booking-count">{dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div>
          <h1><CalendarDays size={28} /> Calendar</h1>
          <p className="subtitle">View booking schedule</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <button className="btn btn-secondary" onClick={prevMonth}>
            <ChevronLeft size={18} />
          </button>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{monthName} {year}</h2>
          <button className="btn btn-secondary" onClick={nextMonth}>
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="empty-state"><div className="loader"></div></div>
          ) : (
            <div className="calendar-grid">
              <div className="calendar-header">
                <span>Sun</span>
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
              </div>
              <div className="calendar-days">
                {days}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Day Bookings */}
      {selectedDate && (
        <div className="selected-day-bookings">
          <div className="selected-day-header">
            <h3>
              📅 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })}
            </h3>
            <button className="btn-icon" onClick={() => { setSelectedDate(null); setSelectedBookings([]); }}>
              <X size={18} />
            </button>
          </div>

          {/* Timeline View */}
          <div className="day-timeline-section" style={{ padding: '0 1.25rem 1rem 1.25rem', borderBottom: '1px solid var(--navy-100)' }}>
            <h4 style={{ fontSize: '0.9rem', color: 'var(--navy-600)', margin: '1rem 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} /> Day Schedule (30 min slots)
            </h4>

            {/* Legend */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1rem',
              padding: '0.75rem',
              background: 'var(--navy-50)',
              borderRadius: '8px',
              fontSize: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#10b981', border: '1px solid #a7f3d0' }}></span>
                <span style={{ color: 'var(--navy-600)' }}>Free</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ef4444', border: '1px solid #fca5a5' }}></span>
                <span style={{ color: 'var(--navy-600)' }}>Booked</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: '#94a3b8', border: '1px solid #e2e8f0' }}></span>
                <span style={{ color: 'var(--navy-600)' }}>Passed</span>
              </div>
            </div>

            {loadingSlots ? (
              <div style={{ padding: '1rem', textAlign: 'center' }}><div className="loader is-small"></div></div>
            ) : (
              <div className="timeline-grid">
                {timelineSlots.map((slot, idx) => {
                  const slotStartMin = timeToMinutes(slot.time);
                  const slotEndMin = slotStartMin + 30; // 30 min view slots

                  // Check if this slot overlaps with any existing booking
                  const overlappingBooking = selectedBookings.find(b => {
                      const bStart = timeToMinutes(b.startTime);
                      const bDuration = Number(b.durationMinutes || b.serviceDuration || b.duration || 30);
                      const bEnd = bStart + bDuration;
                      
                      // Check for overlap: StartA < EndB && StartB < EndA
                      return slotStartMin < bEnd && bStart < slotEndMin;
                  });

                  // Determine status
                  // Priority: Booked > Past Unbooked > Available
                  const now = new Date();
                  const slotDateTime = new Date(`${selectedDate}T${slot.time}`);
                  
                  // Use a margin for "current time" to not gray out current slot immediately
                  const isPast = slotDateTime.getTime() < now.getTime() - (5 * 60000); // 5 min buffer

                  let statusColor = '#10b981'; // Green
                  let bgColor = '#ecfdf5';
                  let borderColor = '#a7f3d0';
                  let label = 'Available';
                  let isBooked = false;

                  if (overlappingBooking) {
                      isBooked = true;
                      statusColor = '#ef4444'; // Red
                      bgColor = '#fef2f2';
                      borderColor = '#fca5a5';
                      label = 'Booked';
                  } else if (isPast) {
                      statusColor = '#94a3b8'; // Gray
                      bgColor = '#f8fafc';
                      borderColor = '#e2e8f0';
                      label = 'Passed';
                  } else if (!slot.available) {
                      // Blocked by something else (e.g. break) but not a booking in our list?
                      // Or just use the engine's reason
                      statusColor = '#f59e0b'; // Amber
                      bgColor = '#fffbeb';
                      borderColor = '#fcd34d';
                      label = 'Unavailable';
                  }

                  return (
                    <div
                      key={idx}
                      className="timeline-slot"
                      style={{
                        background: bgColor,
                        borderColor: borderColor,
                        color: statusColor,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '6px',
                        padding: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        gap: '2px',
                        opacity: isPast && !isBooked ? 0.6 : 1, // Dim past available slots
                        minHeight: '60px'
                      }}
                      title={isBooked ? `Booked by ${overlappingBooking.customerName}` : label}
                    >
                      <span style={{ color: 'var(--navy-900)', fontSize: '0.85rem' }}>
                        {new Date(`2000-01-01T${slot.time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>

                      {isBooked && overlappingBooking ? (
                        <div style={{ textAlign: 'center', width: '100%', overflow: 'hidden' }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--navy-700)', fontWeight: '700', textTransform: 'uppercase' }}>
                            {overlappingBooking.bookingReference || 'BOOKED'}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--navy-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {overlappingBooking.customerName?.split(' ')[0] || 'Customer'}
                          </div>
                          {overlappingBooking.serviceName && (
                              <div style={{ fontSize: '0.6rem', color: 'var(--navy-400)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {overlappingBooking.serviceName}
                              </div>
                          )}
                        </div>
                      ) : (
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          fontSize: '0.7rem',
                          textTransform: 'uppercase'
                        }}>
                          {isBooked ? <AlertCircle size={10} /> : (!isPast && label === 'Available') ? <CheckCircle size={10} /> : null}
                          {label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ padding: '1rem 1.25rem 0.5rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--navy-600)' }}>Detailed Bookings</h4>
          </div>

          {selectedBookings.length === 0 ? (
            <div className="no-bookings-message">
              <p>No bookings list for this day</p>
            </div>
          ) : (
            <div className="day-booking-list">
              {selectedBookings.map(booking => {
                const badge = getStatusBadge(booking.status);
                return (
                  <div key={booking.id} className="day-booking-card">
                    <div className="day-booking-header">
                      <strong>{booking.bookingReference || booking.id.slice(0, 8)}</strong>
                      <span className={`badge ${badge.class}`}>{badge.label}</span>
                    </div>
                    <div className="day-booking-body">
                      <p><Car size={14} /> {booking.serviceName}</p>
                      <p>{booking.carMake} {booking.carModel} - {booking.licensePlate}</p>
                      <p><Clock size={14} /> {booking.startTime} ({booking.durationMinutes || booking.serviceDuration || 30} min)</p>
                      <p><Phone size={14} /> {booking.contactPhone}</p>
                      <p><strong>{formatCurrency(booking.price)}</strong></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <style>{`
        .calendar-page .card {
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-md);
        }
        
        .calendar-page .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          background: white;
          border-bottom: 1px solid var(--navy-100);
        }
        
        .calendar-page .card-header h2 {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--navy-800);
        }
        
        .calendar-page .card-header .btn {
          width: 36px;
          height: 36px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        
        .calendar-page .card-body {
          padding: 1rem;
          background: white;
        }
        
        .calendar-grid { }
        
        .calendar-header {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          font-weight: 600;
          font-size: 0.8rem;
          color: var(--navy-500);
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--navy-100);
          margin-bottom: 0.75rem;
        }
        
        .calendar-days {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 6px;
        }
        
        .calendar-day {
          aspect-ratio: 1;
          min-height: 50px;
          max-height: 80px;
          padding: 0.5rem;
          background: var(--navy-50);
          border-radius: var(--radius-md);
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: all 0.2s ease;
        }
        
        .calendar-day:hover:not(.empty) {
          background: var(--navy-100);
          transform: scale(1.02);
        }
        
        .calendar-day.empty { 
          background: transparent;
          pointer-events: none;
        }
        
        .calendar-day.today {
          background: var(--primary);
          color: white;
          box-shadow: 0 4px 12px rgba(74, 105, 255, 0.4);
        }
        
        .calendar-day.has-bookings {
          border: 2px solid var(--primary);
          background: rgba(74, 105, 255, 0.08);
        }
        
        .calendar-day.today.has-bookings {
          background: var(--primary);
          border-color: white;
        }
        
        .day-number {
          font-weight: 700;
          font-size: 0.95rem;
        }
        
        .day-bookings {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .booking-count {
          font-size: 0.65rem;
          font-weight: 600;
          background: var(--primary);
          color: white;
          padding: 0.15rem 0.4rem;
          border-radius: 10px;
          white-space: nowrap;
        }
        
        .calendar-day.today .booking-count {
          background: white;
          color: var(--primary);
        }
        
        .timeline-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 0.5rem;
        }

        .timeline-slot {
            cursor: default;
            transition: all 0.2s;
        }

        .timeline-slot:hover {
            transform: translateY(-2px);
        }

        @media (max-width: 768px) {
          .calendar-page .page-header h1 {
            font-size: 1.25rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }
          
          .calendar-page .page-header h1 svg {
            width: 22px;
            height: 22px;
          }
          
          .calendar-page .card-header {
            padding: 0.875rem 1rem;
          }
          
          .calendar-page .card-header h2 {
            font-size: 1rem;
          }
          
          .calendar-page .card-header .btn {
            width: 32px;
            height: 32px;
          }
          
          .calendar-page .card-body {
            padding: 0.5rem;
          }
          
          .calendar-header {
            padding-bottom: 0.5rem;
            margin-bottom: 0.5rem;
          }
          
          .calendar-days {
            gap: 3px;
          }
          
          .calendar-day {
            min-height: 48px;
            max-height: none;
            aspect-ratio: auto;
            padding: 0.35rem 0.25rem;
            border-radius: var(--radius-sm);
          }
          
          .calendar-header span {
            font-size: 0.7rem;
          }
          
          .day-number {
            font-size: 0.9rem;
          }
          
          .booking-count {
            font-size: 0.5rem;
            padding: 0.1rem 0.25rem;
          }
          
          .selected-day-bookings {
            margin-bottom: 1rem;
          }
        }
        
        @media (max-width: 420px) {
          .calendar-day {
            min-height: 42px;
            padding: 0.25rem 0.15rem;
          }
          
          .day-number {
            font-size: 0.8rem;
          }
          
          .calendar-header span {
            font-size: 0.6rem;
          }
          
          .booking-count {
            font-size: 0.45rem;
            padding: 0.08rem 0.2rem;
          }
          
          .calendar-page .card-header h2 {
            font-size: 0.9rem;
          }
        }
        
        @media (max-width: 360px) {
          .calendar-days {
            gap: 2px;
          }
          
          .calendar-day {
            min-height: 38px;
          }
          
          .day-number {
            font-size: 0.75rem;
          }
          
          .calendar-header span {
            font-size: 0.55rem;
          }
        }
        
        /* Selected Day Bookings Styles */
        .selected-day-bookings {
          margin-top: 1rem;
          background: white;
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          border: 1px solid var(--navy-100);
          overflow: hidden;
        }
        
        .selected-day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, var(--navy-50) 0%, white 100%);
          border-bottom: 1px solid var(--navy-100);
        }
        
        .selected-day-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--navy-800);
        }
        
        .no-bookings-message {
          padding: 2rem;
          text-align: center;
          color: var(--navy-500);
        }
        
        .day-booking-list {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        
        .day-booking-card {
          background: var(--navy-50);
          border: 1px solid var(--navy-100);
          border-radius: var(--radius-md);
          padding: 1rem;
          transition: var(--transition-fast);
        }
        
        .day-booking-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }
        
        .day-booking-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--navy-200);
        }
        
        .day-booking-header strong {
          font-size: 0.95rem;
          color: var(--navy-800);
        }
        
        .day-booking-body {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        
        .day-booking-body p {
          margin: 0;
          font-size: 0.85rem;
          color: var(--navy-600);
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .day-booking-body p svg {
          color: var(--navy-400);
          flex-shrink: 0;
        }
        
        .calendar-day.selected {
          background: var(--primary) !important;
          color: white !important;
          transform: scale(1.05);
          box-shadow: 0 4px 12px rgba(74, 105, 255, 0.4);
        }
        
        .calendar-day.selected .booking-count {
          background: white;
          color: var(--primary);
        }
        
        @media (max-width: 768px) {
          .selected-day-header {
            padding: 0.875rem 1rem;
          }
          
          .selected-day-header h3 {
            font-size: 0.9rem;
          }
          
          .day-booking-list {
            padding: 0.75rem;
          }
          
          .day-booking-card {
            padding: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
};

export default Calendar;
