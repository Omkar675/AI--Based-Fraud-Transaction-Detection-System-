import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Scene3D from "@/components/Scene3D";
import { Button } from "@/components/ui/button";
import { Shield, Activity, BarChart3, Zap, ArrowRight, Lock } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Scene3D className="absolute inset-0 z-0" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 glass-strong">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-wider text-foreground">
            NEURAL <span className="text-primary">SHIELD</span>
          </span>
        </div>
        <Button
          onClick={() => navigate("/auth")}
          variant="outline"
          className="border-primary/40 text-primary hover:bg-primary/10 font-heading tracking-wide"
        >
          <Lock className="w-4 h-4 mr-2" /> Sign In
        </Button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6 text-sm text-primary font-heading">
            <Zap className="w-4 h-4" /> Real-Time Fraud Detection System
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-black tracking-wider leading-tight mb-6">
            <span className="text-foreground">DETECT</span>
            <br />
            <span className="text-gradient-primary">FRAUD</span>
            <br />
            <span className="text-foreground">INSTANTLY</span>
          </h1>

          <p className="font-body text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10">
            Advanced heuristic analysis engine that scores every transaction in real-time.
            Velocity checks, anomaly detection, and geo-mismatch analysis.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              className="gradient-primary text-primary-foreground font-heading text-lg tracking-wide glow-primary px-8"
            >
              Get Started <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              onClick={() => navigate("/auth")}
              size="lg"
              variant="outline"
              className="border-accent/40 text-accent hover:bg-accent/10 font-heading text-lg tracking-wide px-8"
            >
              View Demo
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-20">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Activity,
              title: "Velocity Check",
              desc: "Monitors transaction frequency to catch rapid-fire fraud attempts before they clear.",
            },
            {
              icon: BarChart3,
              title: "Amount Anomaly",
              desc: "ML-inspired scoring detects unusual amounts relative to your transaction history.",
            },
            {
              icon: Shield,
              title: "Risk Scoring",
              desc: "Every transaction receives a 0-100 risk score with detailed breakdown of flags.",
            },
          ].map((feature, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.15 }}
              className="glass rounded-2xl p-6 cyber-border hover:border-primary/50 transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:glow-primary transition-all">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-heading text-xl font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-8 border-t border-border/30 text-center">
        <p className="text-sm text-muted-foreground font-body">
          &copy; 2026 NEURAL SHIELD — Real-Time Transaction Analysis Platform
        </p>
      </footer>
    </div>
  );
}
