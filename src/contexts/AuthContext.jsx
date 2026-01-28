import { createContext, useContext, useState, useEffect } from 'react';
import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';

const AuthContext = createContext(null);

// User roles with permissions
export const ROLES = {
    SUPERADMIN: 'superadmin',
    ADMIN: 'admin', // Shop Admin
    MANAGER: 'manager',
    SENIOR_EMPLOYEE: 'senior_employee',
    EMPLOYEE: 'employee'
};

export const PERMISSIONS = {
    [ROLES.SUPERADMIN]: {
        superadmin: true,
        dashboard: true,
        bookings: { view: false, create: false, edit: false, delete: false },
        services: { view: false, create: false, edit: false, delete: false },
        customers: { view: false, create: false, edit: false, delete: false },
        employees: { view: false, create: false, edit: false, delete: false },
        expenses: { view: false, create: false, edit: false, delete: false },
        invoices: { view: false, create: false, edit: false, delete: false },
        payroll: { view: false, create: false, edit: false, delete: false },
        analytics: false,
        settings: false,
        finance: false,
        attendance: false,
        audit: false
    },
    [ROLES.ADMIN]: {
        dashboard: true,
        bookings: { view: true, create: true, edit: true, delete: true },
        services: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        employees: { view: true, create: true, edit: true, delete: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        payroll: { view: true, create: true, edit: true, delete: true },
        analytics: true,
        settings: true,
        finance: true,
        attendance: true,
        audit: true
    },
    [ROLES.MANAGER]: {
        dashboard: true,
        bookings: { view: true, create: true, edit: true, delete: true },
        services: { view: true, create: true, edit: true, delete: true },
        customers: { view: true, create: true, edit: true, delete: true },
        employees: { view: true, create: true, edit: true, delete: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: true, delete: true },
        payroll: { view: false, create: false, edit: false, delete: false },
        analytics: true,
        settings: false,
        finance: false,
        attendance: true
    },
    [ROLES.SENIOR_EMPLOYEE]: {
        dashboard: true,
        bookings: { view: true, create: true, edit: true, delete: false },
        services: { view: true, create: false, edit: true, delete: false },
        customers: { view: true, create: true, edit: true, delete: false },
        employees: { view: false, create: false, edit: false, delete: false },
        expenses: { view: true, create: true, edit: true, delete: true },
        invoices: { view: true, create: true, edit: false, delete: false },
        payroll: { view: false, create: false, edit: false, delete: false },
        analytics: false,
        settings: false,
        finance: false,
        attendance: true
    },
    [ROLES.EMPLOYEE]: {
        dashboard: true,
        bookings: { view: true, create: true, edit: false, delete: false },
        services: { view: true, create: false, edit: false, delete: false },
        customers: { view: false, create: false, edit: false, delete: false },
        employees: { view: false, create: false, edit: false, delete: false },
        expenses: { view: false, create: false, edit: false, delete: false },
        invoices: { view: false, create: false, edit: false, delete: false },
        payroll: { view: false, create: false, edit: false, delete: false },
        analytics: false,
        settings: false,
        finance: false,
        attendance: true
    }
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user has specific permission
    const hasPermission = (resource, action = null) => {
        if (!userProfile?.role) return false;

        // 1. Check for Custom Permissions (Override)
        if (userProfile.permissions && userProfile.permissions[resource] !== undefined) {
            const customPerms = userProfile.permissions[resource];

            // If boolean, return directly
            if (typeof customPerms === 'boolean') return customPerms;

            // If action specified, check action
            if (action && typeof customPerms === 'object') {
                return customPerms[action] === true;
            }

            // If no action but object, check if ANY action allowed (view usually)
            if (typeof customPerms === 'object') {
                return customPerms.view === true ||
                    customPerms.create === true ||
                    customPerms.edit === true ||
                    customPerms.delete === true;
            }
        }

        // 2. Fallback to Role-based Permissions
        // Normalize role to lowercase to handle case mismatches
        const normalizedRole = userProfile.role.toLowerCase();
        const permissions = PERMISSIONS[normalizedRole];

        if (!permissions) {
            console.warn('No permissions found for role:', userProfile.role);
            return false;
        }

        const resourcePerms = permissions[resource];

        // If no permissions defined for this resource, deny
        if (resourcePerms === undefined) return false;

        // If it's a boolean, return it directly
        if (typeof resourcePerms === 'boolean') return resourcePerms;

        // If action is specified, return that specific action
        if (action && typeof resourcePerms === 'object') {
            return resourcePerms[action] === true;
        }

        // If no action specified but resource is an object, check if ANY action is allowed
        if (typeof resourcePerms === 'object') {
            return resourcePerms.view === true ||
                resourcePerms.create === true ||
                resourcePerms.edit === true ||
                resourcePerms.delete === true;
        }

        return false;
    };

    // Fetch or create user profile
    const fetchUserProfile = async (firebaseUser) => {
        try {
            const userRef = doc(db, 'adminUsers', firebaseUser.uid);
            const userDoc = await getDoc(userRef);

            if (userDoc.exists()) {
                const profile = { id: userDoc.id, ...userDoc.data() };

                // Check if user is approved
                if (profile.status === 'pending') {
                    setError('Your account is pending approval. Please wait for admin approval.');
                    await signOut(auth);
                    return null;
                }

                if (profile.status === 'rejected') {
                    setError('Your account access has been rejected.');
                    await signOut(auth);
                    return null;
                }

                setUserProfile(profile);
                return profile;
            } else {
                // Check if this is the first admin user or check admin whitelist
                const adminConfig = await getDoc(doc(db, 'settings', 'admin_config'));
                const isFirstUser = !(adminConfig.exists() && adminConfig.data().initialized);

                // Hardcoded Superadmin Check
                const isSuperAdminEmail = firebaseUser.email.toLowerCase() === 'zwash.office@gmail.com';

                if (isSuperAdminEmail || isFirstUser) {
                    // First user or specific email becomes superadmin/admin
                    const role = isSuperAdminEmail ? ROLES.SUPERADMIN : ROLES.ADMIN;

                    const newProfile = {
                        uid: firebaseUser.uid,
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName || (role === ROLES.SUPERADMIN ? 'Super Admin' : 'Admin'),
                        photoURL: firebaseUser.photoURL,
                        role: role,
                        shopId: isFirstUser || role === ROLES.SUPERADMIN ? 'HEAD_OFFICE' : firebaseUser.uid, // First admin defines their own shop
                        status: 'approved',
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    };

                    await setDoc(userRef, newProfile);
                    await setDoc(doc(db, 'settings', 'admin_config'), {
                        initialized: true,
                        primaryAdminEmail: firebaseUser.email
                    });

                    setUserProfile({ id: firebaseUser.uid, ...newProfile });
                    return { id: firebaseUser.uid, ...newProfile };
                } else {
                    // New user - check if invited
                    const emailLower = firebaseUser.email.toLowerCase();
                    const invitesQuery = query(
                        collection(db, 'employeeInvites'),
                        where('email', '==', emailLower),
                        where('status', '==', 'pending')
                    );
                    const inviteSnapshot = await getDocs(invitesQuery);

                    if (!inviteSnapshot.empty) {
                        // User was invited - create APPROVED profile (since they were invited)
                        const invite = inviteSnapshot.docs[0];
                        const inviteData = invite.data();
                        const newProfile = {
                            uid: firebaseUser.uid,
                            email: firebaseUser.email,
                            displayName: firebaseUser.displayName || '',
                            photoURL: firebaseUser.photoURL,
                            role: inviteData.role || ROLES.EMPLOYEE,
                            permissions: inviteData.permissions || null, // Inherit permissions from invite
                            shopId: inviteData.shopId || (inviteData.role === ROLES.ADMIN ? firebaseUser.uid : null), // Inherit or Create Shop ID
                            status: 'approved', // Auto-approve since they were invited
                            invitedBy: inviteData.invitedBy,
                            needsOnboarding: true,
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        };

                        await setDoc(userRef, newProfile);

                        // Update the invite status to accepted
                        const { updateDoc: updateDocument } = await import('firebase/firestore');
                        await updateDocument(doc(db, 'employeeInvites', invite.id), {
                            status: 'accepted',
                            acceptedAt: serverTimestamp()
                        });

                        setUserProfile({ id: firebaseUser.uid, ...newProfile, needsOnboarding: true });
                        return { id: firebaseUser.uid, ...newProfile, needsOnboarding: true };
                    } else {
                        // Not invited - deny access
                        setError('Access denied. You need an invitation to access this system. Make sure you sign in with the same email that was invited.');
                        await signOut(auth);
                        return null;
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching user profile:', err);
            setError('Failed to load user profile');
            return null;
        }
    };

    // Listen for auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setLoading(true);
            setError(null);

            if (firebaseUser) {
                setUser(firebaseUser);
                await fetchUserProfile(firebaseUser);
            } else {
                setUser(null);
                setUserProfile(null);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Sign in with Google
    const signInWithGoogle = async () => {
        try {
            setError(null);
            setLoading(true);
            await signInWithPopup(auth, googleProvider);
        } catch (err) {
            console.error('Google sign in error:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    // Sign out
    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserProfile(null);
        } catch (err) {
            console.error('Logout error:', err);
            setError(err.message);
        }
    };

    // Update user profile (for onboarding)
    const updateProfile = async (profileData) => {
        if (!user) return;

        try {
            const userRef = doc(db, 'adminUsers', user.uid);
            await setDoc(userRef, {
                ...profileData,
                needsOnboarding: false,
                updatedAt: serverTimestamp()
            }, { merge: true });

            setUserProfile(prev => ({
                ...prev,
                ...profileData,
                needsOnboarding: false
            }));
        } catch (err) {
            console.error('Error updating profile:', err);
            throw err;
        }
    };

    const value = {
        user,
        userProfile,
        loading,
        error,
        signInWithGoogle,
        logout,
        updateProfile,
        hasPermission,
        isSuperAdmin: userProfile?.role === ROLES.SUPERADMIN,
        isAdmin: userProfile?.role === ROLES.ADMIN,
        isManager: userProfile?.role === ROLES.MANAGER,

        isSeniorEmployee: userProfile?.role === ROLES.SENIOR_EMPLOYEE,
        isEmployee: userProfile?.role === ROLES.EMPLOYEE
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
