/**
 * ZWash Dynamic Scheduling Engine v2.0
 * 
 * CRITICAL FIX: Duration-validated availability (not just slot generation)
 * 
 * Key Principle:
 * - 5-minute scan interval is GRANULARITY, not availability
 * - Each start time must have CONTINUOUS FREE TIME >= service_duration + buffer
 * - Same category bookings BLOCK each other completely
 * - Different category bookings CAN run in parallel
 */

import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

// ============================================
// TIME UTILITIES
// ============================================

/**
 * Convert "HH:MM" time string to minutes since midnight
 */
export const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to "HH:MM" format
 */
export const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * Convert 24-hour time to 12-hour AM/PM format for display
 */
export const formatTime12Hour = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
};

// ============================================
// BOOKING DATA FETCHING
// ============================================

/**
 * Fetch all non-cancelled bookings for a specific date
 * Returns bookings with normalized duration/category fields
 */
export const getBookingsForDate = async (db, dateStr) => {
    try {
        const bookingsRef = collection(db, 'bookings');
        const q = query(
            bookingsRef,
            where('bookingDate', '==', dateStr),
            where('status', '!=', 'cancelled')
        );
        const snapshot = await getDocs(q);

        return snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                startTime: data.startTime,
                // Normalize duration - check multiple possible field names
                duration: data.serviceDuration || data.durationMinutes || data.duration || 30,
                // Normalize category - check multiple possible field names
                category: data.serviceCategory || data.category || 'Detailed Wash',
                serviceName: data.serviceName || 'Unknown Service',
                isWalkIn: data.isWalkIn || false,
                status: data.status
            };
        });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        return [];
    }
};

/**
 * Fetch business settings
 */
export const getSettings = async (db) => {
    try {
        const docRef = doc(db, 'settings', 'business');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        // Default settings
        return {
            openTime: '09:00',
            closeTime: '18:00',
            bufferTime: 15,
            maxConcurrentBookings: 1
        };
    } catch (error) {
        console.error('Error fetching settings:', error);
        return {
            openTime: '09:00',
            closeTime: '18:00',
            bufferTime: 15,
            maxConcurrentBookings: 1
        };
    }
};

// ============================================
// CORE VALIDATION LOGIC
// ============================================

/**
 * Check if a proposed time range conflicts with an existing booking
 * 
 * @param {number} proposedStart - Start time in minutes
 * @param {number} proposedEnd - End time in minutes (includes buffer)
 * @param {string} proposedCategory - Category of the new service
 * @param {Object} existingBooking - Existing booking to check against
 * @param {number} bufferTime - Buffer time in minutes
 * @returns {boolean} - True if there's a conflict
 */
const hasConflictWithBooking = (proposedStart, proposedEnd, proposedCategory, existingBooking, bufferTime) => {
    const existingStart = timeToMinutes(existingBooking.startTime);
    const existingEnd = existingStart + existingBooking.duration + bufferTime;

    // Check if time ranges overlap
    // Two ranges overlap if: start1 < end2 AND start2 < end1
    const rangesOverlap = proposedStart < existingEnd && existingStart < proposedEnd;

    if (!rangesOverlap) {
        return false; // No overlap at all - no conflict
    }

    // Ranges DO overlap - check category rules
    // Same category = CONFLICT (cannot overlap)
    // Different category = NO CONFLICT (can run in parallel)
    const existingCategory = existingBooking.category;

    if (proposedCategory === existingCategory) {
        // Same category - this is a BLOCKING conflict
        return true;
    }

    // Different categories - allow parallel execution
    return false;
};

/**
 * Check if a start time is valid for the given service
 * 
 * CORE VALIDATION: Ensures the FULL duration + buffer is FREE
 * 
 * @param {number} startMin - Proposed start time in minutes
 * @param {number} serviceDuration - Service duration in minutes
 * @param {string} serviceCategory - Service category
 * @param {Array} existingBookings - List of existing bookings
 * @param {number} bufferTime - Buffer time in minutes
 * @param {number} closeMinutes - Closing time in minutes
 * @returns {Object} - { isValid: boolean, blockedBy?: string }
 */
const isStartTimeValid = (startMin, serviceDuration, serviceCategory, existingBookings, bufferTime, closeMinutes) => {
    const proposedEnd = startMin + serviceDuration + bufferTime;

    // Check 1: Does the service fit within operating hours?
    if (proposedEnd > closeMinutes) {
        return {
            isValid: false,
            reason: 'Extends beyond closing time'
        };
    }

    // Check 2: Does the FULL duration conflict with any same-category booking?
    for (const booking of existingBookings) {
        if (hasConflictWithBooking(startMin, proposedEnd, serviceCategory, booking, bufferTime)) {
            return {
                isValid: false,
                reason: `Conflicts with ${booking.serviceName}`,
                blockedBy: booking.id
            };
        }
    }

    // All checks passed - this start time is VALID
    return { isValid: true };
};

// ============================================
// MAIN AVAILABILITY GENERATION
// ============================================

/**
 * Generate all available start times for a service on a given date
 * 
 * CRITICAL: This validates that FULL continuous time is free, not just the start point
 * 
 * Algorithm:
 * 1. Scan timeline in 5-minute increments (granularity)
 * 2. For EACH candidate start time:
 *    - Calculate end_time = start + duration + buffer
 *    - Check if ANY same-category booking overlaps with [start, end]
 *    - Only include if ZERO conflicts
 */
export const generateAvailableStartTimes = async ({
    db,
    dateStr,
    service,
    settings: providedSettings = null,
    existingBookings: providedBookings = null,
    includePast = false // New parameter to include past slots
}) => {
    // Fetch settings if not provided
    const settings = providedSettings || await getSettings(db);

    // Fetch existing bookings if not provided
    const existingBookings = providedBookings || await getBookingsForDate(db, dateStr);

    // Debug log
    console.log('=== SCHEDULING ENGINE DEBUG ===');
    console.log('Date:', dateStr);
    console.log('Service:', service?.name, '| Duration:', service?.durationMinutes, 'min | Category:', service?.category);
    console.log('Existing bookings:', existingBookings.length);
    existingBookings.forEach(b => {
        console.log(`  - ${b.startTime} | ${b.duration}min | ${b.category} | ${b.serviceName}`);
    });

    // Extract settings
    const openMinutes = timeToMinutes(settings.openTime || '09:00');
    const closeMinutes = timeToMinutes(settings.closeTime || '18:00');
    const bufferTime = settings.bufferTime || 15;

    // Service details
    const serviceDuration = service?.durationMinutes || 30;
    const serviceCategory = service?.category || 'Detailed Wash';

    // ============================================
    // DYNAMIC DISPLAY INTERVAL = SERVICE DURATION
    // ============================================
    // Slot intervals match the service duration for perfect back-to-back scheduling
    // 30-min service = slots every 30 min (9:00, 9:30, 10:00...)
    // 45-min service = slots every 45 min (9:00, 9:45, 10:30...)
    // 90-min service = slots every 90 min (9:00, 10:30, 12:00...)
    const displayInterval = serviceDuration; // Use service duration as interval

    console.log('Settings: Open', settings.openTime, '| Close', settings.closeTime, '| Buffer', bufferTime, 'min');
    console.log('Required block:', serviceDuration + bufferTime, 'min total');
    console.log('Display interval:', displayInterval, 'min (= service duration)');

    // Scan increment for finding valid slots (5 min for precision)
    const SCAN_INCREMENT = 5;

    // Calculate earliest possible start time for today
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDate = new Date(dateStr);
    selectedDate.setHours(0, 0, 0, 0);

    const isToday = selectedDate.getTime() === today.getTime();

    let earliestMinutes = openMinutes;
    if (isToday && !includePast) {
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        // Minimum 30 minutes advance booking
        earliestMinutes = Math.max(openMinutes, currentMinutes + 30);
        // Round up to next 15-min mark for cleaner display
        earliestMinutes = Math.ceil(earliestMinutes / 15) * 15;
    }

    console.log('Scanning from', minutesToTime(earliestMinutes), 'to', minutesToTime(closeMinutes));

    // Generate available slots using DISPLAY INTERVAL
    const availableSlots = [];
    let checkedCount = 0;
    let validCount = 0;

    // Loop through times at DISPLAY INTERVAL spacing
    for (let startMin = earliestMinutes; startMin < closeMinutes; startMin += displayInterval) {
        checkedCount++;

        // CRITICAL: Validate that the FULL duration + buffer is free
        const validation = isStartTimeValid(
            startMin,
            serviceDuration,
            serviceCategory,
            existingBookings,
            bufferTime,
            closeMinutes
        );

        const startTime = minutesToTime(startMin);

        if (validation.isValid) {
            validCount++;
            availableSlots.push({
                time: startTime,
                display: formatTime12Hour(startTime),
                available: true,
                endTime: minutesToTime(startMin + serviceDuration),
                blockedUntil: minutesToTime(startMin + serviceDuration + bufferTime)
            });
        } else {
            // Include unavailable slots so they can be shown in UI (e.g. red for booked)
            availableSlots.push({
                time: startTime,
                display: formatTime12Hour(startTime),
                available: false,
                reason: validation.reason,
                blockedBy: validation.blockedBy,
                endTime: minutesToTime(startMin + serviceDuration)
            });
        }
    }

    console.log('Checked', checkedCount, 'time slots | Valid:', validCount);
    console.log('=== END DEBUG ===');

    return availableSlots;
};

// ============================================
// BOOKING VALIDATION (Before Creation)
// ============================================

/**
 * Validate a proposed booking before creation
 * This is a FINAL check before actually saving to database
 */
export const validateBooking = async ({
    db,
    dateStr,
    startTime,
    service,
    settings: providedSettings = null,
    existingBookings: providedBookings = null
}) => {
    const settings = providedSettings || await getSettings(db);
    const existingBookings = providedBookings || await getBookingsForDate(db, dateStr);

    const bufferTime = settings.bufferTime || 15;
    const openMinutes = timeToMinutes(settings.openTime || '09:00');
    const closeMinutes = timeToMinutes(settings.closeTime || '18:00');

    const serviceDuration = service?.durationMinutes || 30;
    const serviceCategory = service?.category || 'Detailed Wash';
    const startMin = timeToMinutes(startTime);

    // Use the same validation logic as availability generation
    const validation = isStartTimeValid(
        startMin,
        serviceDuration,
        serviceCategory,
        existingBookings,
        bufferTime,
        closeMinutes
    );

    if (!validation.isValid) {
        return {
            valid: false,
            error: validation.reason || 'Time slot not available'
        };
    }

    // Check operating hours
    if (startMin < openMinutes) {
        return { valid: false, error: 'Booking starts before opening time' };
    }

    return { valid: true };
};

// ============================================
// UTILITY EXPORTS
// ============================================

/**
 * Prepare booking data with all required fields for scheduling
 * Call this before saving a booking to ensure all fields are present
 */
export const prepareBookingData = (formData, service, settings) => {
    const bufferTime = settings?.bufferTime || 15;
    const startMinutes = timeToMinutes(formData.startTime || formData.time);
    const duration = service?.durationMinutes || 30;
    const endMinutes = startMinutes + duration;

    return {
        ...formData,
        // CRITICAL: These fields MUST be stored for scheduling to work
        serviceDuration: duration,
        serviceCategory: service?.category || 'Detailed Wash',
        endTime: minutesToTime(endMinutes),
        blockedUntil: minutesToTime(endMinutes + bufferTime)
    };
};

export default {
    timeToMinutes,
    minutesToTime,
    formatTime12Hour,
    getBookingsForDate,
    getSettings,
    generateAvailableStartTimes,
    validateBooking,
    prepareBookingData
};
