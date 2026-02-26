import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Shield,
  Plus,
  LogOut,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  BarChart3,
  Eye,
  Server,
  Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { predictFraud, TransactionType } from "@/services/fraudApi";
import AnalyticsCharts from "@/components/AnalyticsCharts";

interface Transaction {
  id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  sender_name: string;
  sender_account: string;
  receiver_name: string;
  receiver_account: string;
  transaction_type: string;
  location: string | null;
  ip_address: string | null;
  device_info: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

interface FraudAnalysis {
  id: string;
  transaction_id: string;
  risk_score: number;
  risk_level: string;
  flags: string[];
  velocity_check: boolean;
  amount_anomaly: boolean;
  geo_mismatch: boolean;
  unusual_time: boolean;
  duplicate_detected: boolean;
  analysis_details: Record<string, any>;
  analyzed_at: string;
}

const ALGORITHMS = [
  { id: "xgboost", label: "XGBoost", desc: "High accuracy tree ensemble" },
  { id: "random_forest", label: "Random Forest", desc: "Robust decision forest" },
  { id: "logistic_regression", label: "Logistic Regression", desc: "Linear baseline" },
  { id: "autoencoder", label: "Autoencoder", desc: "Unsupervised anomaly detection" }
];

function generateTransactionId() {
  return "TXN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function RiskBadge({ level }: { level: string }) {
  if (level === "high")
    return <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-heading"><XCircle className="w-3 h-3 mr-1" />High Risk</Badge>;
  if (level === "medium")
    return <Badge className="bg-warning/20 text-warning border-warning/30 font-heading"><AlertTriangle className="w-3 h-3 mr-1" />Medium</Badge>;
  return <Badge className="bg-success/20 text-success border-success/30 font-heading"><CheckCircle className="w-3 h-3 mr-1" />Low Risk</Badge>;
}

function RiskMeter({ score }: { score: number }) {
  const color = score >= 60 ? "bg-destructive" : score >= 30 ? "bg-warning" : "bg-success";
  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground font-heading">Risk Score</span>
        <span className="text-xs font-display text-foreground">{score}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, FraudAnalysis>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailTx, setDetailTx] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState<TransactionType>("bank_transfer");
  const [algoModel, setAlgoModel] = useState<string>("xgboost");

  // Dummy fields strictly for UI DB
  const [senderName, setSenderName] = useState("");
  const [receiverName, setReceiverName] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  async function fetchTransactions() {
    // using custom backend
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";
      const res = await fetch(`${API_URL}/api/transactions?limit=100`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setTransactions(data);

      const map: Record<string, FraudAnalysis> = {};
      data.forEach((t: any) => {
        if (t.risk_score !== undefined && t.risk_score !== null) {
          map[t.id] = {
            id: t.id,
            transaction_id: t.id,
            risk_score: t.risk_score,
            risk_level: t.risk_level,
            flags: typeof t.flags === 'string' ? JSON.parse(t.flags) : (t.flags || []),
            velocity_check: t.velocity_check,
            amount_anomaly: t.amount_anomaly,
            geo_mismatch: false,
            unusual_time: t.unusual_time,
            duplicate_detected: t.duplicate_detected,
            analysis_details: typeof t.analysis_details === 'string' ? JSON.parse(t.analysis_details) : (t.analysis_details || {}),
            analyzed_at: t.created_at
          };
        }
      });
      setAnalyses(map);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSubmitting(true);

    try {
      // Setup payload for ML inference
      let transactionData: Record<string, number | string> = {};

      if (txType === "bank_transfer") {
        transactionData = {
          amount: parsedAmount,
          oldbalanceOrg: parsedAmount,
          newbalanceOrig: 0,
          oldbalanceDest: 0,
          newbalanceDest: parsedAmount,
          balanceChangeOrig: -parsedAmount,
          balanceChangeDest: parsedAmount,
          errorBalanceOrig: 0,
          errorBalanceDest: 0,
          hour: 12, day: 1,
          amount_log: Math.log1p(parsedAmount),
          is_high_amount: parsedAmount > 200000 ? 1 : 0,
          is_round_amount: parsedAmount % 1000 === 0 ? 1 : 0,
          type_encoded: 1,
          orig_transaction_count: 5,
          dest_transaction_count: 1,
        };
      } else if (txType === "credit_card") {
        transactionData = { Amount: parsedAmount };
        for (let i = 1; i <= 28; i++) transactionData[`V${i}`] = 0;
      } else if (txType === "upi") {
        transactionData = {
          "amount (INR)": parsedAmount,
          "hour_of_day": 12, "day_of_week": 1, "is_weekend": 0, "hour": 12, "is_night": 0,
          "transaction type_encoded": 1, "merchant_category_encoded": 1, "transaction_status_encoded": 1,
          "sender_age_group_encoded": 2, "receiver_age_group_encoded": 2, "sender_state_encoded": 1,
          "sender_bank_encoded": 1, "receiver_bank_encoded": 1, "device_type_encoded": 1, "network_type_encoded": 1,
        };
      } else if (txType === "bitcoin") {
        transactionData = {};
        for (let i = 1; i <= 166; i++) transactionData[`feature_${i}`] = i === 1 ? parsedAmount : 0;
        transactionData["local_sum"] = parsedAmount;
        transactionData["local_mean"] = parsedAmount;
        transactionData["agg_mean"] = parsedAmount;
      }

      // Execute Real ML Analysis
      const mlResponse = await predictFraud(transactionData, txType, algoModel);

      let riskScore = 0;
      let riskLevel = "low";
      if (mlResponse.success && mlResponse.result) {
        riskScore = Number(mlResponse.result.fraud_probability);
        riskLevel = mlResponse.result.risk_level;
        toast.info(`Engine: ${algoModel} returned ${mlResponse.result.prediction}`);
      } else {
        toast.error("Model offline, using fallback heuristic");
        riskScore = parsedAmount > 10000 ? 80 : 10;
        riskLevel = riskScore > 60 ? "high" : "low";
      }

      // Push to backend history DB
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";
      const res = await fetch(`${API_URL}/api/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          amount: parsedAmount,
          transaction_type: txType,
          sender_name: senderName || "System Test",
          sender_account: "TEST-0000",
          receiver_name: receiverName || "External Recipient",
          receiver_account: "RCV-1111",
          description: `Analysis via ${algoModel}`,
          risk_score: riskScore,
          risk_level: riskLevel,
          flags: JSON.stringify(["Model Inference Executed", `Engine: ${algoModel}`, `Protocol: ${txType}`]),
          amount_anomaly: riskScore > 50,
          velocity_check: false,
          duplicate_detected: false,
          unusual_time: false,
          analysis_details: JSON.stringify(mlResponse.result || {})
        })
      });

      if (!res.ok) {
        toast.error("Failed to save transaction to DB");
      } else {
        toast.success(riskLevel === "high" ? "🚨 HIGH RISK transaction" : "✅ Safe Transaction");
        setDialogOpen(false);
        setAmount("");
        fetchTransactions();
      }

    } catch (err) {
      toast.error("Network error during analysis.");
    }

    setSubmitting(false);
  }

  // Stats
  const totalTx = transactions.length;
  const highRisk = Object.values(analyses).filter((a) => a.risk_level === "high").length;
  const medRisk = Object.values(analyses).filter((a) => a.risk_level === "medium").length;
  const avgScore =
    Object.values(analyses).length > 0
      ? (Object.values(analyses).reduce((s, a) => s + Number(a.risk_score), 0) / Object.values(analyses).length).toFixed(1)
      : "0";

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const detailAnalysis = detailTx ? analyses[detailTx] : null;
  const detailTransaction = detailTx ? transactions.find((t) => t.id === detailTx) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="glass-strong border-b border-border/30 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-wider text-foreground">
            FRAUD<span className="text-primary">SHIELD</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate("/"); }} className="text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Transactions", value: totalTx, icon: Activity, color: "text-primary" },
            { label: "High Risk", value: highRisk, icon: XCircle, color: "text-destructive" },
            { label: "Medium Risk", value: medRisk, icon: AlertTriangle, color: "text-warning" },
            { label: "Avg Risk Score", value: avgScore, icon: TrendingUp, color: "text-cyber-blue" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-4 cyber-border"
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground font-heading">{stat.label}</span>
              </div>
              <span className="font-display text-2xl font-bold text-foreground">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        {/* Add Transaction */}
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Transactions
          </h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground font-heading glow-primary">
                <Plus className="w-4 h-4 mr-2" /> New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Signal Analysis
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">

                <div className="space-y-4 p-4 rounded-xl glass cyber-border">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Transfer Amount</Label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0.01" required className="bg-muted/50 text-lg font-mono focus-visible:ring-primary" placeholder="0.00" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Protocol Type</Label>
                    <Select value={txType} onValueChange={(val: any) => setTxType(val)}>
                      <SelectTrigger className="bg-muted/50 font-mono"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">Wire / Bank Transfer</SelectItem>
                        <SelectItem value="credit_card">Credit Card Network</SelectItem>
                        <SelectItem value="upi">UPI / Mobile Payment</SelectItem>
                        <SelectItem value="bitcoin">Cryptocurrency Ledger</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3 p-4 rounded-xl glass cyber-border relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[50px] rounded-full mix-blend-screen pointer-events-none" />

                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Zap className="w-4 h-4" />
                    <span className="font-heading text-sm font-bold tracking-wide">AI Algorithm Engine</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 relative z-10">
                    {ALGORITHMS.map(a => (
                      <button
                        key={a.id} type="button" onClick={() => setAlgoModel(a.id)}
                        className={`p-3 text-left border rounded-xl transition-all ${algoModel === a.id ? "bg-primary/20 border-primary glow-primary" : "bg-muted/30 border-border hover:border-muted-foreground/50"}`}
                      >
                        <div className={`font-semibold text-sm font-heading ${algoModel === a.id ? "text-primary" : "text-foreground"}`}>{a.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{a.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Origin Name</Label>
                    <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} className="bg-muted/50" placeholder="Optional" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Target Name</Label>
                    <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="bg-muted/50" placeholder="Optional" />
                  </div>
                </div>

                <Button type="submit" disabled={submitting} className="w-full gradient-primary text-primary-foreground font-heading glow-primary py-6 text-lg tracking-wide hover:scale-[1.02] transition-transform">
                  {submitting ? "Processing Sequence..." : "Execute Detection Model"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Analytics Dashboard */}
        <AnalyticsCharts transactions={transactions as any} analyses={analyses as any} />

        {/* Transaction List */}
        {transactions.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center cyber-border">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-xl text-muted-foreground mb-2">No transaction data</h3>
            <p className="text-sm text-muted-foreground">Add your first transaction to run the AI heuristic model.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx, i) => {
              const analysis = analyses[tx.id];
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-4 cyber-border hover:border-primary/40 transition-all cursor-pointer group"
                  onClick={() => setDetailTx(tx.id)}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:glow-primary transition-all">
                        <Activity className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-heading text-sm font-semibold text-foreground">{tx.transaction_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString()} ┬╖ <span className="uppercase text-primary">{tx.transaction_type}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-display text-lg font-bold text-foreground">
                        ${Number(tx.amount).toLocaleString()}
                      </span>
                      {analysis && <RiskBadge level={analysis.risk_level} />}
                      <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center">
                        <Eye className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </div>
                  {analysis && (
                    <div className="mt-4 border-t border-border/50 pt-3">
                      <RiskMeter score={Number(analysis.risk_score)} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!detailTx} onOpenChange={(open) => { if (!open) setDetailTx(null); }}>
          <DialogContent className="glass-strong border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-foreground flex items-center gap-2">
                <Server className="w-5 h-5 text-primary" /> Event Telemetry
              </DialogTitle>
            </DialogHeader>
            {detailTransaction && (
              <div className="space-y-4 mt-4">
                <div className="p-4 rounded-xl bg-card border border-border shadow-inner">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Payload Amount</div>
                  <div className="font-display text-4xl font-bold text-foreground">${Number(detailTransaction.amount).toLocaleString()}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm p-4 rounded-xl glass cyber-border">
                  <div><span className="text-muted-foreground">Event Hash:</span> <div className="text-foreground font-mono text-xs mt-1">{detailTransaction.transaction_id}</div></div>
                  <div><span className="text-muted-foreground">Protocol:</span> <div className="text-foreground uppercase font-bold text-xs mt-1 text-primary">{detailTransaction.transaction_type}</div></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Timestamp:</span> <div className="text-foreground font-mono text-xs mt-1">{new Date(detailTransaction.created_at).toLocaleString()}</div></div>
                </div>

                {detailAnalysis && (
                  <>
                    <div className="p-4 rounded-xl glass cyber-border space-y-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/10 blur-[50px] rounded-full mix-blend-screen pointer-events-none" />

                      <div className="flex items-center justify-between">
                        <span className="font-heading font-bold tracking-wide">Algorithmic Confidence</span>
                        <RiskBadge level={detailAnalysis.risk_level} />
                      </div>
                      <RiskMeter score={Number(detailAnalysis.risk_score)} />

                      {(detailAnalysis.flags as string[]).length > 0 && (
                        <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                          <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">Model Output Parameters:</span>
                          {(detailAnalysis.flags as string[]).map((flag, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm text-warning bg-warning/5 rounded-lg p-2 border border-warning/20 font-mono text-xs">
                              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              <span>{flag}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}