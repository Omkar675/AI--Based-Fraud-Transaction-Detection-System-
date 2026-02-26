import { useState } from "react";
import { predictFraud, TransactionType, PredictionResult } from "@/services/fraudApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle, Loader2, Brain, Activity } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Simplified terminology for the user
const TRANSACTION_TYPES = [
  { id: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
  { id: "credit_card", label: "Credit Card", icon: "💳" },
  { id: "upi", label: "UPI & App Payment", icon: "📱" },
  { id: "bitcoin", label: "Cryptocurrency", icon: "₿" },
] as const;

const ALGORITHMS = [
  { id: "xgboost", label: "Advanced (XGBoost)", icon: "⚡" },
  { id: "random_forest", label: "Standard (Random Forest)", icon: "🌳" },
  { id: "logistic_regression", label: "Basic (Logistic Reg)", icon: "📈" },
  { id: "autoencoder", label: "Deep AI (Autoencoder)", icon: "🧠" }
] as const;

const RISK_COLORS: Record<string, string> = {
  MINIMAL: "text-emerald-400",
  LOW: "text-blue-400",
  MEDIUM: "text-orange-400",
  HIGH: "text-[#ff6b6b]",
  CRITICAL: "text-red-500",
};

export default function FraudDetector() {
  const [txType, setTxType] = useState<TransactionType>("bank_transfer");
  const [algoType, setAlgoType] = useState<string>("xgboost");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);

  const handleAnalyze = async () => {
    if (!amount || isNaN(Number(amount))) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setResult(null);

    let transactionData: Record<string, string | number> = { amount: Number(amount) };

    if (txType === "bank_transfer") {
      transactionData = {
        amount: Number(amount),
        type: "TRANSFER",
        oldbalanceOrg: Number(amount),
        newbalanceOrig: 0,
        oldbalanceDest: 0,
        newbalanceDest: Number(amount),
      };
    } else if (txType === "upi") {
      transactionData = {
        amount: Number(amount),
        upi_id: "user@bank",
        payment_method: "UPI",
      };
    } else if (txType === "credit_card") {
      transactionData = { Amount: Number(amount) };
    } else if (txType === "bitcoin") {
      transactionData = { feature_1: Number(amount) };
    }

    const response = await predictFraud(transactionData, txType, algoType);
    setLoading(false);

    if (!response.success || !response.result) {
      toast.error(response.error || "Analysis failed");
      return;
    }

    setResult(response.result);

    if (response.result.prediction === "FRAUD") {
      toast.error(`⚠️ FRAUD DETECTED — ${response.result.risk_level} risk`);
    } else {
      toast.success("✅ Transaction appears legitimate");
    }
  };

  return (
    <div className="glass-card border border-slate-700/50 shadow-2xl rounded-3xl p-8 space-y-8 max-w-lg mx-auto relative overflow-hidden backdrop-blur-2xl bg-slate-900/60 mt-20">

      {/* Background glow effects strictly within the card */}
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-primary/20 blur-[60px] rounded-full mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-50px] left-[-50px] w-48 h-48 bg-accent/10 blur-[60px] rounded-full mix-blend-screen pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-700/50 pb-5 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-[0_0_20px_rgba(14,165,233,0.4)] flex items-center justify-center">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold text-white tracking-tight">AI Fraud Analyzer</h2>
          <p className="text-sm text-slate-400 font-medium mt-0.5">Real-time analysis</p>
        </div>
      </div>

      {/* Transaction Type */}
      <div className="space-y-4 relative z-10">
        <Label className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Select Payment Method</Label>
        <div className="grid grid-cols-2 gap-3">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTxType(t.id); setResult(null); }}
              className={`p-4 rounded-xl border text-sm font-bold transition-all flex flex-col items-center text-center ${txType === t.id
                ? "border-primary bg-primary/10 text-primary shadow-[0_0_20px_rgba(14,165,233,0.2)] scale-[1.02]"
                : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800"
                }`}
            >
              <span className="text-2xl mb-1">{t.icon}</span>
              <span className={txType === t.id ? "text-primary drop-shadow-[0_0_5px_rgba(14,165,233,0.8)]" : ""}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Algorithm Type */}
      <div className="space-y-4 relative z-10">
        <Label className="text-slate-400 text-[10px] font-bold tracking-widest uppercase flex items-center gap-2">
          Select AI Model <span className="bg-accent/20 text-accent px-2 py-0.5 rounded-full border border-accent/20">Advanced</span>
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {ALGORITHMS.map((a) => (
            <button
              key={a.id}
              onClick={() => { setAlgoType(a.id); setResult(null); }}
              className={`p-4 rounded-xl border text-xs font-bold transition-all flex flex-col items-center text-center ${algoType === a.id
                ? "border-accent bg-accent/10 text-accent shadow-[0_0_20px_rgba(59,130,246,0.2)] scale-[1.02]"
                : "border-slate-800 bg-slate-900/50 text-slate-400 hover:border-slate-700 hover:bg-slate-800"
                }`}
            >
              <span className="text-xl mb-1">{a.icon}</span>
              <span className={algoType === a.id ? "text-accent drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]" : ""}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Amount relative z-10*/}
      <div className="space-y-3 relative z-10">
        <Label className="text-slate-400 text-[10px] font-bold tracking-widest uppercase">Transfer Amount ($)</Label>
        <Input
          type="number"
          placeholder="Enter transaction amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-slate-900/80 border-slate-700 text-white font-mono text-lg focus:border-primary focus:ring-1 focus:ring-primary shadow-inner rounded-xl h-14"
          min="0"
        />
      </div>

      {/* Analyze Button */}
      <Button
        onClick={handleAnalyze}
        disabled={loading}
        className="relative z-10 w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-bold text-lg py-7 rounded-xl shadow-[0_0_30px_rgba(14,165,233,0.3)] transition-all hover:scale-[1.02] border border-white/10"
      >
        {loading ? (
          <><Activity className="w-6 h-6 mr-3 animate-pulse" /> Processing Analysis...</>
        ) : (
          <><Brain className="w-5 h-5 mr-3" /> Run Analysis</>
        )}
      </Button>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: 20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className={`relative z-10 mt-6 rounded-2xl p-6 border shadow-2xl backdrop-blur-md ${result.prediction === "FRAUD"
              ? "border-red-500/30 bg-red-500/10"
              : "border-primary/30 bg-primary/10"
              }`}>
            <div className="flex items-center gap-4 mb-5 border-b border-white/10 pb-4">
              {result.prediction === "FRAUD" ? (
                <AlertTriangle className="w-8 h-8 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
              ) : (
                <CheckCircle className="w-8 h-8 text-primary drop-shadow-[0_0_15px_rgba(14,165,233,0.5)]" />
              )}
              <span className={`text-2xl font-bold font-display tracking-tight ${result.prediction === "FRAUD" ? "text-red-400" : "text-primary"
                }`}>
                {result.prediction} DETECTED
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-black/40 rounded-xl p-4 border border-white/5">
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Risk Level</p>
                <p className={`font-bold ${RISK_COLORS[result.risk_level]}`}>
                  {result.risk_level}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Fraud Prob.</p>
                <p className="font-bold text-white">{result.fraud_probability}%</p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Model Context</p>
                <p className="font-bold text-white capitalize">
                  {result.transaction_type.replace("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">Base Accuracy</p>
                <p className="font-bold text-accent">
                  {typeof result.model_accuracy === "number"
                    ? `${result.model_accuracy}%`
                    : result.model_accuracy}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}