import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const logAction = async (user, action, resource, details, metadata = {}) => {
    try {
        if (!user) return;

        await addDoc(collection(db, 'auditLogs'), {
            userId: user.uid || user.id,
            userName: user.displayName || user.email || 'Unknown',
            userRole: user.role || 'unknown',
            action: action, // 'create', 'update', 'delete', 'login', etc.
            resource: resource, // 'materials', 'employees', 'bookings', etc.
            details: details, // Description of what happened
            metadata: metadata, // JSON object with specific IDs, before/after values
            timestamp: serverTimestamp(),
            userAgent: navigator.userAgent
        });
    } catch (error) {
        console.error('Error logging action:', error);
        // Don't throw, we don't want to break the app if logging fails
    }
};
