// src/components/FraudDetector.tsx
// Drop this component into your Dashboard page

import { useState } from "react";
import { predictFraud, TransactionType, PredictionResult } from "@/services/fraudApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

const TRANSACTION_TYPES = [
  { id: "bank_transfer", label: "Bank Transfer", icon: "🏦" },
  { id: "credit_card",   label: "Credit Card",   icon: "💳" },
  { id: "upi",           label: "UPI Payment",   icon: "📱" },
  { id: "bitcoin",       label: "Bitcoin",       icon: "₿"  },
] as const;

const RISK_COLORS: Record<string, string> = {
  MINIMAL:  "text-green-400",
  LOW:      "text-blue-400",
  MEDIUM:   "text-yellow-400",
  HIGH:     "text-orange-400",
  CRITICAL: "text-red-500",
};

export default function FraudDetector() {
  const [txType, setTxType]     = useState<TransactionType>("bank_transfer");
  const [amount, setAmount]     = useState("");
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<PredictionResult | null>(null);

  const handleAnalyze = async () => {
    if (!amount || isNaN(Number(amount))) {
      toast.error("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setResult(null);

    // Build transaction data based on type
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

    const response = await predictFraud(transactionData, txType);
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
    <div className="glass-strong rounded-2xl p-6 cyber-border space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">Fraud Analyzer</h2>
          <p className="text-xs text-muted-foreground">AI-powered transaction screening</p>
        </div>
      </div>

      {/* Transaction Type */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-sm">Transaction Type</Label>
        <div className="grid grid-cols-2 gap-2">
          {TRANSACTION_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTxType(t.id); setResult(null); }}
              className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                txType === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-sm">Amount</Label>
        <Input
          type="number"
          placeholder="Enter transaction amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="bg-muted/50 border-border focus:border-primary"
          min="0"
        />
      </div>

      {/* Analyze Button */}
      <Button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full gradient-primary text-primary-foreground font-heading glow-primary"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
        ) : (
          <><Shield className="w-4 h-4 mr-2" /> Analyze Transaction</>
        )}
      </Button>

      {/* Result */}
      {result && (
        <div className={`rounded-xl p-4 border ${
          result.prediction === "FRAUD"
            ? "border-red-500/40 bg-red-500/10"
            : "border-green-500/40 bg-green-500/10"
        }`}>
          <div className="flex items-center gap-3 mb-3">
            {result.prediction === "FRAUD" ? (
              <AlertTriangle className="w-6 h-6 text-red-500" />
            ) : (
              <CheckCircle className="w-6 h-6 text-green-400" />
            )}
            <span className={`text-xl font-bold font-heading ${
              result.prediction === "FRAUD" ? "text-red-500" : "text-green-400"
            }`}>
              {result.prediction}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Risk Level</p>
              <p className={`font-semibold ${RISK_COLORS[result.risk_level]}`}>
                {result.risk_level}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Fraud Probability</p>
              <p className="font-semibold text-foreground">{result.fraud_probability}%</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Transaction Type</p>
              <p className="font-semibold text-foreground capitalize">
                {result.transaction_type.replace("_", " ")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Model Accuracy</p>
              <p className="font-semibold text-foreground">
                {typeof result.model_accuracy === "number"
                  ? `${result.model_accuracy}%`
                  : result.model_accuracy}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}