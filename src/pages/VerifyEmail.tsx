import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Toaster, toast } from "sonner";
import { Shield, Sparkles, CheckCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function VerifyEmail() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

    useEffect(() => {
        const token = searchParams.get("token");
        if (!token) {
            setStatus("error");
            toast.error("Invalid verification link");
            return;
        }

        const verifyAccount = async () => {
            try {
                const res = await fetch("http://localhost:5001/api/auth/verify-email", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (res.ok) {
                    setStatus("success");
                    toast.success("Email successfully verified! You can now log in.");
                } else {
                    setStatus("error");
                    toast.error(data.error || "Failed to verify email");
                }
            } catch (err) {
                setStatus("error");
                toast.error("Network error. Could not connect to the server.");
            }
        };

        verifyAccount();
    }, [searchParams]);

    return (
        <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
            <div className="absolute inset-0 z-0 bg-grid-white/[0.02]" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md mx-4"
            >
                <div className="glass-strong rounded-2xl p-8 cyber-border text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mb-6 glow-primary">
                        {status === "loading" && <Sparkles className="w-8 h-8 text-white animate-pulse" />}
                        {status === "success" && <CheckCircle className="w-8 h-8 text-white" />}
                        {status === "error" && <XCircle className="w-8 h-8 text-white" />}
                    </div>

                    <h1 className="font-display text-2xl font-bold tracking-wider text-foreground mb-4">
                        Account Verification
                    </h1>

                    <p className="text-muted-foreground mb-8 text-lg">
                        {status === "loading" && "Verifying your email address..."}
                        {status === "success" && "Your email has been verified! You're ready to go."}
                        {status === "error" && "The verification link is invalid or has expired."}
                    </p>

                    <button
                        onClick={() => navigate("/auth")}
                        className="w-full gradient-primary text-primary-foreground font-heading py-3 rounded-lg text-lg tracking-wide hover:opacity-90 transition-opacity"
                    >
                        Go to Sign In
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
