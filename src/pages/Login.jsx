import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Car, Droplets, Sparkles, Shield, Zap, Users } from 'lucide-react';

const Login = () => {
    const { user, userProfile, loading, error, signInWithGoogle } = useAuth();
    const navigate = useNavigate();
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (user && userProfile && !userProfile.needsOnboarding) {
            navigate('/');
        }
    }, [user, userProfile, navigate]);

    if (loading) {
        return (
            <div className="login-page-premium">
                <div className="login-loader-container">
                    <div className="login-loader-spinner">
                        <Car size={32} />
                    </div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    // If user needs onboarding, show onboarding form
    if (user && userProfile?.needsOnboarding) {
        return <OnboardingForm />;
    }

    return (
        <div className="login-page-premium">
            {/* Animated Background Elements */}
            <div className="login-bg-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
                <div className="shape shape-4"></div>
            </div>

            {/* Floating Bubbles Animation */}
            <div className="bubbles-container">
                {[...Array(12)].map((_, i) => (
                    <div key={i} className={`bubble bubble-${i + 1}`}></div>
                ))}
            </div>

            {/* Main Content */}
            <div className="login-split-layout">
                {/* Left Side - Branding */}
                <div className="login-branding-side">
                    <div className="branding-content">
                        <div className="brand-logo-container">
                            <div className="brand-logo-glow"></div>
                            <div className="brand-logo">
                                <Car size={48} />
                            </div>
                        </div>
                        <h1 className="brand-title">ZWash</h1>
                        <p className="brand-subtitle">Car Wash Management System</p>

                        <div className="brand-features">
                            <div className="brand-feature">
                                <div className="feature-icon">
                                    <Sparkles size={20} />
                                </div>
                                <span>Premium Dashboard</span>
                            </div>
                            <div className="brand-feature">
                                <div className="feature-icon">
                                    <Users size={20} />
                                </div>
                                <span>Customer Management</span>
                            </div>
                            <div className="brand-feature">
                                <div className="feature-icon">
                                    <Zap size={20} />
                                </div>
                                <span>Real-time Analytics</span>
                            </div>
                            <div className="brand-feature">
                                <div className="feature-icon">
                                    <Shield size={20} />
                                </div>
                                <span>Secure & Reliable</span>
                            </div>
                        </div>
                    </div>

                    {/* Decorative Car Illustration */}
                    <div className="car-illustration">
                        <div className="car-body">
                            <Car size={120} strokeWidth={1} />
                        </div>
                        <div className="water-drops">
                            <Droplets size={24} className="drop drop-1" />
                            <Droplets size={20} className="drop drop-2" />
                            <Droplets size={16} className="drop drop-3" />
                        </div>
                    </div>
                </div>

                {/* Right Side - Login Form */}
                <div className="login-form-side">
                    <div className="login-card-premium">
                        <div className="card-glow"></div>

                        <div className="login-card-header">
                            <div className="admin-badge">
                                <Shield size={14} />
                                <span>Admin Portal</span>
                            </div>
                            <h2>Welcome Back</h2>
                            <p>Sign in to access your dashboard</p>
                        </div>

                        {error && (
                            <div className="login-error-alert">
                                <span className="error-icon">!</span>
                                {error}
                            </div>
                        )}

                        <button
                            className={`google-signin-btn ${isHovered ? 'hovered' : ''}`}
                            onClick={signInWithGoogle}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                            disabled={loading}
                        >
                            <div className="btn-bg"></div>
                            <div className="btn-content">
                                <svg className="google-icon" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                <span>Continue with Google</span>
                            </div>
                            <div className="btn-shine"></div>
                        </button>

                        <div className="login-divider">
                            <span>Secure Authentication</span>
                        </div>

                        <div className="login-info-box">
                            <div className="info-icon">
                                <Shield size={18} />
                            </div>
                            <div className="info-content">
                                <p className="info-title">Authorized Access Only</p>
                                <p className="info-text">This portal is restricted to ZWash administrators. Contact your system admin for access permissions.</p>
                            </div>
                        </div>

                        <div className="login-footer">
                            <p>© 2024 ZWash. All rights reserved.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Onboarding form for new employees
const OnboardingForm = () => {
    const { userProfile, updateProfile, logout } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        try {
            await updateProfile({
                displayName: formData.get('displayName'),
                phone: formData.get('phone'),
                address: formData.get('address') || ''
            });
            navigate('/');
        } catch (err) {
            console.error('Error updating profile:', err);
        }
    };

    return (
        <div className="login-page-premium">
            {/* Animated Background Elements */}
            <div className="login-bg-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
                <div className="shape shape-3"></div>
            </div>

            {/* Floating Bubbles */}
            <div className="bubbles-container">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className={`bubble bubble-${i + 1}`}></div>
                ))}
            </div>

            <div className="onboarding-card-container">
                <div className="login-card-premium onboarding-card">
                    <div className="card-glow"></div>

                    <div className="login-card-header">
                        <div className="brand-logo-container small">
                            <div className="brand-logo-glow"></div>
                            <div className="brand-logo">
                                <Car size={32} />
                            </div>
                        </div>
                        <h2>Complete Your Profile</h2>
                        <p>Please fill in your details to continue</p>
                    </div>

                    <form onSubmit={handleSubmit} className="onboarding-form-premium">
                        <div className="form-group-premium">
                            <label htmlFor="displayName">
                                <Users size={16} />
                                Full Name *
                            </label>
                            <input
                                type="text"
                                id="displayName"
                                name="displayName"
                                defaultValue={userProfile?.displayName}
                                required
                                placeholder="Enter your full name"
                            />
                        </div>

                        <div className="form-group-premium">
                            <label htmlFor="phone">
                                <Zap size={16} />
                                Phone Number *
                            </label>
                            <input
                                type="tel"
                                id="phone"
                                name="phone"
                                required
                                placeholder="+91 98765 43210"
                            />
                        </div>

                        <div className="form-group-premium">
                            <label htmlFor="address">
                                <Sparkles size={16} />
                                Address
                            </label>
                            <textarea
                                id="address"
                                name="address"
                                rows="2"
                                placeholder="Enter your address (optional)"
                            />
                        </div>

                        <button type="submit" className="google-signin-btn submit-btn">
                            <div className="btn-bg"></div>
                            <div className="btn-content">
                                <Sparkles size={18} />
                                <span>Complete Registration</span>
                            </div>
                            <div className="btn-shine"></div>
                        </button>
                    </form>

                    <button className="logout-link" onClick={logout}>
                        ← Sign out and use different account
                    </button>

                    <div className="pending-notice">
                        <Shield size={18} />
                        <p>Your account is pending admin approval. You'll be notified once approved.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
