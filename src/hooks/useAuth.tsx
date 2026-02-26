import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
    id: string;
    email: string;
    is_verified?: boolean;
    full_name?: string;
    role?: string;
}

interface AuthResponse {
    error?: { message: string };
    data?: any;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<AuthResponse>;
    signUp: (email: string, password: string, fullName: string) => Promise<AuthResponse>;
}

// Points to the new custom backend
const API_URL = `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api`;

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    signOut: async () => { },
    signIn: async () => ({ error: { message: "Not initialized" } }),
    signUp: async () => ({ error: { message: "Not initialized" } }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for existing token and authenticate using the /me endpoint
        const checkAuth = async () => {
            const token = localStorage.getItem("token");
            if (token) {
                try {
                    const res = await fetch(`${API_URL}/auth/me`, {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    });

                    if (res.ok) {
                        const userData = await res.json();
                        setUser(userData);
                    } else {
                        localStorage.removeItem("token");
                        setUser(null);
                    }
                } catch (error) {
                    console.error("Auth check failed:", error);
                    setUser(null);
                }
            }
            setLoading(false);
        };

        checkAuth();
    }, []);

    const signOut = async () => {
        setUser(null);
        localStorage.removeItem("token");
    };

    const signIn = async (email: string, password: string): Promise<AuthResponse> => {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });
            const data = await res.json();

            if (!res.ok) {
                return { error: { message: data.error || data.message || "Invalid credentials" } };
            }

            setUser(data.user);
            localStorage.setItem("token", data.token);
            return { data };
        } catch (err: any) {
            return { error: { message: `Fetch Error: ${err.message}. URL: ${API_URL}` } };
        }
    };

    const signUp = async (email: string, password: string, fullName: string): Promise<AuthResponse> => {
        try {
            const res = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password, fullName }),
            });
            const data = await res.json();

            if (!res.ok) {
                return { error: { message: data.error || data.message || "Registration failed" } };
            }

            return { data };
        } catch (err: any) {
            return { error: { message: `Fetch Error: ${err.message}. URL: ${API_URL}` } };
        }
    };

    return (
        <AuthContext.Provider value={{ user, loading, signOut, signIn, signUp }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
