import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the full URL hash and search params
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);

        const code = searchParams.get("code");
        const accessToken = hashParams.get("access_token");
        const errorDesc = hashParams.get("error_description") || searchParams.get("error_description");

        // If there's an error in the URL, handle it
        if (errorDesc) {
          setMessage(`Verification failed: ${errorDesc}`);
          setTimeout(() => navigate("/auth"), 3000);
          return;
        }

        // PKCE flow — code in URL query string
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Code exchange error:", error);
            setMessage("Verification failed. Please try signing up again.");
            setTimeout(() => navigate("/auth"), 3000);
            return;
          }
          if (data.session) {
            setMessage("Email verified! Welcome to FraudShield 🎉");
            setTimeout(() => navigate("/dashboard"), 1500);
            return;
          }
        }

        // Implicit flow — token in URL hash
        if (accessToken) {
          const { data, error } = await supabase.auth.getSession();
          if (error || !data.session) {
            setMessage("Session expired. Please sign in again.");
            setTimeout(() => navigate("/auth"), 2000);
            return;
          }
          setMessage("Email verified! Welcome to FraudShield 🎉");
          setTimeout(() => navigate("/dashboard"), 1500);
          return;
        }

        // No code or token — check if already has session
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          setMessage("Already verified! Redirecting...");
          setTimeout(() => navigate("/dashboard"), 1000);
          return;
        }

        // Nothing worked
        setMessage("No verification token found. Please try again.");
        setTimeout(() => navigate("/auth"), 3000);

      } catch (err) {
        console.error("Auth callback error:", err);
        setMessage("Something went wrong. Redirecting...");
        setTimeout(() => navigate("/auth"), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">
            NEURAL<span className="text-primary">SHIELD</span>
          </h1>
        </div>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-lg text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}