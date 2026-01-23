import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../config/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

const ThemeContext = createContext();

export const useTheme = () => {
    return useContext(ThemeContext);
};

import { useAuth } from './AuthContext';

export const ThemeProvider = ({ children }) => {
    const { user, userProfile } = useAuth();
    const [theme, setTheme] = useState({
        primaryColor: '#047857', // Default Emerald
        secondaryColor: '#d97706', // Default Amber
        borderRadius: '8px',
        sidebarColor: '#1e293b' // Default Navy
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        // Determine the settings document ID
        // If user is Admin/Superadmin, use their own ID. 
        // If Employee, we ideally need the Shop Owner's ID. 
        // For now, assuming single-shop invite context or using the user's ID if they are the admin.
        // TODO: For employees, we need to store 'employerId' in their profile to fetch correct shop settings.
        // Falling back to 'business' for backward compatibility or global default if logic fails.

        const settingsId = user.uid;

        // Subscribe to real-time updates for settings
        const unsubscribe = onSnapshot(doc(db, 'settings', settingsId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                if (data.theme) {
                    setTheme(prev => ({ ...prev, ...data.theme }));
                    applyTheme(data.theme);
                }
            } else {
                // Try fallback to global business settings if user-specific doesn't exist
                // (Optional: keep default state)
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching theme settings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const applyTheme = (themeData) => {
        const root = document.documentElement;
        if (themeData.primaryColor) {
            root.style.setProperty('--primary', themeData.primaryColor);
        }
        if (themeData.secondaryColor) {
            root.style.setProperty('--accent', themeData.secondaryColor);
        }
        if (themeData.sidebarColor) {
            root.style.setProperty('--sidebar-bg', themeData.sidebarColor);
        }
        if (themeData.borderRadius) {
            root.style.setProperty('--radius-sm', themeData.borderRadius);
            root.style.setProperty('--radius-md', `calc(${themeData.borderRadius} + 4px)`);
            root.style.setProperty('--radius-lg', `calc(${themeData.borderRadius} + 8px)`);
        }
    };

    const updateTheme = async (newTheme) => {
        if (!user) return;
        try {
            await setDoc(doc(db, 'settings', user.uid), {
                theme: newTheme,
                updatedAt: serverTimestamp()
            }, { merge: true });
            return true;
        } catch (error) {
            console.error("Error updating theme:", error);
            return false;
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, updateTheme, loading }}>
            {children}
        </ThemeContext.Provider>
    );
};
