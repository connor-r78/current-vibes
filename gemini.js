import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, increment } from 'firebase/firestore';

// --- Global Variable Access (MANDATORY) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Mock user credentials for the "Admin" account
const MOCK_ADMIN_EMAIL = "editor@thecurrent.edu";
const MOCK_ADMIN_PASSWORD = "password123";

// --- Utility Functions ---

// Simple custom modal/toast function to avoid using alert()
function showToast(message, isError = false) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `p-4 mb-2 rounded-lg shadow-xl text-white ${isError ? 'bg-red-600' : 'bg-green-600'} transition-opacity duration-300`;
    toast.textContent = message;
    
    toastContainer.prepend(toast); // Add to the top
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

// --- Main Application Component ---

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [viewCount, setViewCount] = useState(0);
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showLogin, setShowLogin] = useState(false);

    // Firestore Path for Public Analytics Counter
    const analyticsDocPath = useMemo(() => 
        db ? doc(db, `/artifacts/${appId}/public/data/analytics/olhs_current_views`) : null, 
        [db]
    );

    // 1. Initialize Firebase and Handle Authentication
    useEffect(() => {
        if (!firebaseConfig.apiKey) {
            console.error("Firebase configuration missing. Cannot initialize Firestore/Auth.");
            setIsAuthReady(true);
            return;
        }

        const app = initializeApp(firebaseConfig);
        const firestore = getFirestore(app);
        const firebaseAuth = getAuth(app);
        
        setDb(firestore);
        setAuth(firebaseAuth);

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                setUserId(null);
            }
            // Mark auth system as ready after initial check
            setIsAuthReady(true);
        });

        // Sign in with the provided custom token or anonymously
        const attemptAuth = async () => {
            try {
                if (initialAuthToken) {
                    await signInWithCustomToken(firebaseAuth, initialAuthToken);
                } else {
                    await signInAnonymously(firebaseAuth);
                }
            } catch (error) {
                console.error("Firebase Auth Error during initialization:", error);
            }
        };

        attemptAuth();

        return () => unsubscribe();
    }, []);

    // 2. Track Page View on Load (after auth is ready)
    // The tracking is done only once when the component mounts and auth is ready.
    useEffect(() => {
        if (!isAuthReady || !analyticsDocPath) return;

        // Function to increment the view count
        const trackPageView = async () => {
            try {
                // Atomically increments the 'count' field by 1.
                await setDoc(analyticsDocPath, { count: increment(1) }, { merge: true });
                console.log("Page view tracked successfully.");
            } catch (error) {
                console.error("Error tracking page view:", error);
            }
        };

        trackPageView();
    }, [isAuthReady, analyticsDocPath]); // Runs once when auth is ready

    // 3. Subscribe to Real-Time View Count (Analytics)
    useEffect(() => {
        if (!isAuthReady || !analyticsDocPath) return;

        const unsubscribe = onSnapshot(analyticsDocPath, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setViewCount(data.count || 0);
            } else {
                // Document doesn't exist yet, initialize to 0
                setViewCount(0);
                // Optionally initialize the document if it doesn't exist
                // setDoc(analyticsDocPath, { count: 0 }, { merge: true });
            }
        }, (error) => {
            console.error("Error listening to analytics data:", error);
        });

        return () => unsubscribe();
    }, [isAuthReady, analyticsDocPath]);


    // --- Authentication Handlers ---

    // Note: In a real app, this would involve server-side validation.
    const handleLogin = useCallback(async (e) => {
        e.preventDefault();
        if (isLoggingIn || !auth) return;

        if (loginEmail !== MOCK_ADMIN_EMAIL || loginPassword !== MOCK_ADMIN_PASSWORD) {
            showToast("Invalid credentials. Use 'editor@thecurrent.edu' / 'password123'", true);
            return;
        }

        setIsLoggingIn(true);
        try {
            // For a mock admin, we just sign out the current user (likely anonymous)
            // and then sign in a custom mock user using an actual Firebase method.
            // Since we don't have a backend to generate a real custom token, 
            // we will simulate the login by relying on the global token if available,
            // otherwise, we sign in anonymously and rely on the `isLoggedIn` state.
            // For this environment, we just use the global auth system if the user
            // matches the mock credentials.
            showToast("Admin login successful. (Simulation: Real authentication requires a secure backend).");
            setShowLogin(false);
        } catch (error) {
            console.error("Login failed:", error);
            showToast(`Login failed: ${error.message}`, true);
        } finally {
            setIsLoggingIn(false);
        }
    }, [auth, loginEmail, loginPassword, isLoggingIn]);

    const handleSignOut = useCallback(async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            showToast("Signed out successfully. Viewing as public.");
            setShowLogin(false);
        } catch (error) {
            console.error("Sign out failed:", error);
            showToast("Sign out failed.", true);
        }
    }, [auth]);

    // Check if the current user is "logged in" as the admin (or just checking if userId exists)
    // For this mock, we assume any logged in state is sufficient to show the dashboard.
    const isLoggedIn = !!userId;
    const isAdmin = isLoggedIn; // Simplified: any logged in user is the "Admin" for this demo

    // --- Components ---

    const Header = () => (
        <header className="bg-red-800 text-white shadow-lg sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div className="flex-shrink-0">
                    <h1 className="text-3xl font-extrabold tracking-tight font-serif">
                        <span className="text-yellow-400">The Current</span>
                        <span className="text-xl font-medium block leading-none pt-0.5">Ocean Lakes High School</span>
                    </h1>
                </div>
                <nav className="hidden md:flex space-x-6 text-lg font-medium">
                    <a href="#" className="hover:text-yellow-400 transition duration-150">Home</a>
                    <a href="#" className="hover:text-yellow-400 transition duration-150">News</a>
                    <a href="#" className="hover:text-yellow-400 transition duration-150">Sports</a>
                    <a href="#" className="hover:text-yellow-400 transition duration-150">Opinion</a>
                </nav>
                <div className="flex items-center space-x-3">
                    {isAdmin ? (
                        <>
                            <span className="text-sm hidden sm:inline">Admin ID: {userId.substring(0, 8)}...</span>
                            <button
                                onClick={handleSignOut}
                                className="px-4 py-2 bg-yellow-500 text-red-800 font-semibold rounded-lg shadow hover:bg-yellow-400 transition duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-red-800"
                            >
                                Sign Out
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => setShowLogin(true)}
                            className="px-4 py-2 bg-yellow-500 text-red-800 font-semibold rounded-lg shadow hover:bg-yellow-400 transition duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-red-800"
                        >
                            Editor Login
                        </button>
                    )}
                </div>
            </div>
            {/* Mobile Nav */}
            <div className="md:hidden flex justify-around text-sm py-2 bg-red-700">
                <a href="#" className="hover:text-yellow-400 transition duration-150">Home</a>
                <a href="#" className="hover:text-yellow-400 transition duration-150">News</a>
                <a href="#" className="hover:text-yellow-400 transition duration-150">Sports</a>
                <a href="#" className="hover:text-yellow-400 transition duration-150">Opinion</a>
            </div>
        </header>
    );

    const LoginPage = () => (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-20 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-red-800">Editor Login</h2>
                <form onSubmit={handleLogin}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                            Email (Mock: editor@thecurrent.edu)
                        </label>
                        <input
                            id="email"
                            type="email"
                            placeholder="Email"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            required
                        />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                            Password (Mock: password123)
                        </label>
                        <input
                            id="password"
                            type="password"
                            placeholder="Password"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="shadow appearance-none border rounded-lg w-full py-3 px-4 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            required
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <button
                            type="submit"
                            className="bg-red-800 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition duration-200 disabled:bg-red-400"
                            disabled={isLoggingIn}
                        >
                            {isLoggingIn ? 'Logging In...' : 'Sign In'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowLogin(false)}
                            className="inline-block align-baseline font-bold text-sm text-gray-600 hover:text-gray-800"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    const AdminDashboard = () => (
        <section className="bg-red-50 p-6 rounded-xl shadow-lg mt-8 border-t-4 border-red-800">
            <h2 className="text-3xl font-bold text-red-800 mb-6 border-b pb-2">Admin Dashboard (Analytics)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-yellow-500">
                    <p className="text-sm font-medium text-gray-500">Total Page Views</p>
                    <p className="text-4xl font-extrabold text-red-800 mt-1">
                        {isAuthReady ? viewCount.toLocaleString() : 'Loading...'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-yellow-500">
                    <p className="text-sm font-medium text-gray-500">Current Logged-in User ID</p>
                    <p className="text-base font-mono text-gray-700 mt-1 break-all">
                        {userId || 'N/A'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-yellow-500">
                    <p className="text-sm font-medium text-gray-500">Data Source</p>
                    <p className="text-base font-semibold text-gray-700 mt-1">
                        Firebase Firestore (NoSQL)
                    </p>
                    <p className="text-xs text-gray-500 mt-1 break-all">
                        Path: `/artifacts/{appId}/public/data/analytics/...`
                    </p>
                </div>
            </div>
        </section>
    );

    const ArticleCard = ({ title, summary, author, category, imageUrl }) => (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-[1.02] transition duration-300 ease-in-out">
            <img 
                src={imageUrl} 
                alt={title} 
                className="w-full h-48 object-cover"
                onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = `https://placehold.co/600x400/D0312D/FFFFFF?text=${category.toUpperCase()}`;
                }}
            />
            <div className="p-6">
                <p className="text-xs font-semibold uppercase text-red-600 mb-1">{category}</p>
                <h3 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2">{title}</h3>
                <p className="text-gray-600 mb-4 line-clamp-3">{summary}</p>
                <div className="flex justify-between items-center text-sm text-gray-500">
                    <span>By {author}</span>
                    <a href="#" className="text-red-800 font-semibold hover:underline">Read More &rarr;</a>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-100 font-sans">
            <style>{`
                /* Font setup */
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');
                .font-sans { font-family: 'Inter', sans-serif; }
                .font-serif { font-family: 'Playfair Display', serif; }

                /* Custom scrollbar for better aesthetics */
                ::-webkit-scrollbar { width: 8px; }
                ::-webkit-scrollbar-thumb { 
                    background-color: #D0312D; /* Red-800 */
                    border-radius: 4px;
                }
                ::-webkit-scrollbar-track { 
                    background-color: #f1f1f1;
                }
            `}</style>
            
            {/* Toast Container for notifications */}
            <div id="toast-container" className="fixed top-20 right-4 z-50 max-w-xs w-full"></div>

            <Header />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isAdmin && <AdminDashboard />}

                <section className="mt-8">
                    <h2 className="text-4xl font-bold text-gray-800 mb-6 border-b-2 border-red-800 pb-2 font-serif">Latest Stories</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        <ArticleCard
                            title="Dolphin Robotics Team Wins Regional Championship"
                            summary="The Ocean Lakes Robotics Team secured a major victory, qualifying for the national finals after a thrilling regional competition..."
                            author="Jane Smith"
                            category="News"
                            imageUrl="https://placehold.co/600x400/D0312D/FFFFFF?text=Robotics+Victory"
                        />
                        <ArticleCard
                            title="Analyzing the New VBCPS Grading Policy Changes"
                            summary="Our opinion columnist breaks down how the latest shifts in the Virginia Beach City Public Schools grading system will impact student stress and academic integrity."
                            author="Alex Johnson"
                            category="Opinion"
                            imageUrl="https://placehold.co/600x400/1E40AF/FFFFFF?text=Grading+Policy"
                        />
                        <ArticleCard
                            title="Volleyball Dominates in Undefeated Season Start"
                            summary="The Ocean Lakes Girls' Volleyball team has set an incredible pace, sweeping their first five opponents. We look into the keys to their success this year."
                            author="Chris Lee"
                            category="Sports"
                            imageUrl="https://placehold.co/600x400/059669/FFFFFF?text=Volleyball+Action"
                        />
                        <ArticleCard
                            title="Review: The Cafeteria's New Healthy Lunch Initiative"
                            summary="Students offer their honest reviews of the new menu items designed to boost nutrition. Is it a hit or a miss? Find out inside."
                            author="Taylor Brown"
                            category="Lifestyle"
                            imageUrl="https://placehold.co/600x400/F59E0B/FFFFFF?text=School+Lunch"
                        />
                    </div>
                </section>
            </main>

            <footer className="bg-gray-800 text-white mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center">
                    <p>&copy; {new Date().getFullYear()} The Current Newspaper | Ocean Lakes High School. All rights reserved.</p>
                    <p className="text-xs mt-2">Powered by Firebase & React | Analytics Count: {viewCount.toLocaleString()}</p>
                </div>
            </footer>

            {showLogin && <LoginPage />}
        </div>
    );
};

export default App;
