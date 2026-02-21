import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
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
  Wifi,
  WifiOff,
  Brain,
  Clock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AnalyticsCharts from "@/components/AnalyticsCharts";
import { predictFraud, TransactionType } from "@/services/fraudApi";

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

interface MLResult {
  prediction: "FRAUD" | "LEGITIMATE";
  fraud_probability: number;
  risk_level: string;
  model_accuracy: number | string;
  transaction_type: string;
}

// ML models config
const ML_MODELS: { id: TransactionType; label: string; icon: string; desc: string }[] = [
  { id: "bank_transfer", label: "Bank Transfer", icon: "🏦", desc: "Wire, NEFT, IMPS" },
  { id: "credit_card",   label: "Credit Card",   icon: "💳", desc: "Card transactions" },
  { id: "upi",           label: "UPI Payment",   icon: "📱", desc: "UPI, PhonePe, GPay" },
  { id: "bitcoin",       label: "Bitcoin",        icon: "₿",  desc: "Crypto transfers" },
];

function generateTransactionId() {
  return "TXN-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
}

function analyzeTransaction(
  tx: { amount: number; location: string | null; transaction_type: string; transaction_date: string },
  history: Transaction[]
): Omit<FraudAnalysis, "id" | "transaction_id" | "analyzed_at"> {
  let riskScore = 0;
  const flags: string[] = [];
  let velocityCheck = false;
  let amountAnomaly = false;
  let geoMismatch = false;
  let unusualTime = false;
  let duplicateDetected = false;

  if (history.length > 0) {
    const avgAmount = history.reduce((s, t) => s + Number(t.amount), 0) / history.length;
    if (tx.amount > avgAmount * 2) {
      amountAnomaly = true;
      riskScore += 25;
      flags.push(`Amount $${tx.amount} is ${(tx.amount / avgAmount).toFixed(1)}x your average ($${avgAmount.toFixed(0)})`);
    }
  }
  if (tx.amount > 10000) {
    riskScore += 15;
    flags.push("High-value transaction exceeds $10,000");
  }

  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentCount = history.filter((t) => new Date(t.created_at) > oneHourAgo).length;
  if (recentCount >= 5) {
    velocityCheck = true;
    riskScore += 20;
    flags.push(`${recentCount} transactions in the last hour (velocity alert)`);
  }

  if (tx.location && history.length > 0) {
    const lastLocation = history[0]?.location;
    if (lastLocation && lastLocation.toLowerCase() !== tx.location.toLowerCase()) {
      geoMismatch = true;
      riskScore += 20;
      flags.push(`Location "${tx.location}" differs from last transaction "${lastLocation}"`);
    }
  }

  const txHour = new Date(tx.transaction_date).getHours();
  if (txHour >= 1 && txHour <= 5) {
    unusualTime = true;
    riskScore += 15;
    flags.push(`Transaction at unusual hour (${txHour}:00)`);
  }

  const fiveMinAgo = new Date(Date.now() - 300000);
  const duplicate = history.find(
    (t) =>
      Number(t.amount) === tx.amount &&
      t.transaction_type === tx.transaction_type &&
      new Date(t.created_at) > fiveMinAgo
  );
  if (duplicate) {
    duplicateDetected = true;
    riskScore += 20;
    flags.push("Possible duplicate: same amount and type within 5 minutes");
  }

  riskScore = Math.min(riskScore, 100);
  const riskLevel = riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low";

  return {
    risk_score: riskScore,
    risk_level: riskLevel,
    flags,
    velocity_check: velocityCheck,
    amount_anomaly: amountAnomaly,
    geo_mismatch: geoMismatch,
    unusual_time: unusualTime,
    duplicate_detected: duplicateDetected,
    analysis_details: { recentCount, txHour },
  };
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

function MLResultCard({ result }: { result: MLResult }) {
  const isFraud = result.prediction === "FRAUD";
  const RISK_COLORS: Record<string, string> = {
    MINIMAL: "text-green-400",
    LOW: "text-blue-400",
    MEDIUM: "text-yellow-400",
    HIGH: "text-orange-400",
    CRITICAL: "text-red-500",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl p-4 border mt-2 ${
        isFraud ? "border-red-500/40 bg-red-500/10" : "border-green-500/40 bg-green-500/10"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Brain className="w-4 h-4 text-primary" />
        <span className="text-xs font-heading text-muted-foreground">AI MODEL RESULT</span>
      </div>
      <div className="flex items-center gap-3 mb-3">
        {isFraud
          ? <XCircle className="w-6 h-6 text-red-500" />
          : <CheckCircle className="w-6 h-6 text-green-400" />}
        <span className={`text-xl font-bold font-heading ${isFraud ? "text-red-500" : "text-green-400"}`}>
          {result.prediction}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Risk Level</p>
          <p className={`font-semibold ${RISK_COLORS[result.risk_level] ?? "text-foreground"}`}>{result.risk_level}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Fraud Probability</p>
          <p className="font-semibold text-foreground">{Number(result.fraud_probability).toFixed(2)}%</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Model Used</p>
          <p className="font-semibold text-foreground">
            {result.transaction_type === "bank_transfer" ? "🏦 Bank Transfer"
              : result.transaction_type === "credit_card" ? "💳 Credit Card"
              : result.transaction_type === "upi" ? "📱 UPI Payment"
              : result.transaction_type === "bitcoin" ? "₿ Bitcoin"
              : result.transaction_type}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Model Accuracy</p>
          <p className="font-semibold text-foreground">
            {typeof result.model_accuracy === "number" ? `${result.model_accuracy}%` : result.model_accuracy}
          </p>
        </div>
      </div>
    </motion.div>
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
  const [isLive, setIsLive] = useState(false);
  const [newTxId, setNewTxId] = useState<string | null>(null);
  const [mlResult, setMlResult] = useState<MLResult | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Form state
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [txType, setTxType] = useState("transfer");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [txDate, setTxDate] = useState(() => new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [txHour, setTxHour] = useState(() => {
    const h = new Date().getHours();
    return String(h % 12 || 12).padStart(2, "0");
  });
  const [txMinute, setTxMinute] = useState(() => String(new Date().getMinutes()).padStart(2, "0"));
  const [txAmPm, setTxAmPm] = useState(() => new Date().getHours() >= 12 ? "PM" : "AM");
  const [mlModel, setMlModel] = useState<TransactionType>("bank_transfer");

  // Helper: combine date + time fields into ISO string
  const getTxDateTime = () => {
    let hour = parseInt(txHour);
    if (txAmPm === "PM" && hour !== 12) hour += 12;
    if (txAmPm === "AM" && hour === 12) hour = 0;
    return `${txDate}T${String(hour).padStart(2, "0")}:${txMinute}:00`;
  };

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchTransactions = useCallback(async () => {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) { toast.error("Failed to load transactions"); return; }
    setTransactions(data || []);

    const { data: analysisData } = await supabase.from("fraud_analysis").select("*");
    if (analysisData) {
      const map: Record<string, FraudAnalysis> = {};
      analysisData.forEach((a: any) => { map[a.transaction_id] = a; });
      setAnalyses(map);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchTransactions();

    // ✅ Realtime — no filter so events aren't silently dropped
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "transactions" },
        (payload) => {
          const newTx = payload.new as Transaction;
          if (newTx.user_id !== user.id) return;
          setTransactions((prev) => {
            if (prev.some((t) => t.id === newTx.id)) return prev;
            return [newTx, ...prev];
          });
          setNewTxId(newTx.id);
          setTimeout(() => setNewTxId(null), 3000);
        }
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fraud_analysis" },
        (payload) => {
          const newAnalysis = payload.new as FraudAnalysis;
          if (newAnalysis.user_id !== user.id) return;
          setAnalyses((prev) => ({ ...prev, [newAnalysis.transaction_id]: newAnalysis }));
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "transactions" },
        (payload) => {
          const updated = payload.new as Transaction;
          if (updated.user_id !== user.id) return;
          setTransactions((prev) => prev.map((t) => t.id === updated.id ? updated : t));
        }
      )
      .subscribe((status) => { setIsLive(status === "SUBSCRIBED"); });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); setIsLive(false); };
  }, [user, fetchTransactions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setMlResult(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      setSubmitting(false);
      return;
    }

    const txId = generateTransactionId();
    const txDateTime = new Date(getTxDateTime()).toISOString(); // ✅ use selected AM/PM time

    // ── 1. Save to Supabase ───────────────────────────────────────────────────
    const { data: txData, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        transaction_id: txId,
        amount: parsedAmount,
        sender_name: senderName.trim(),
        sender_account: senderAccount.trim(),
        receiver_name: receiverName.trim(),
        receiver_account: receiverAccount.trim(),
        transaction_type: txType,
        location: location.trim() || null,
        description: description.trim() || null,
        transaction_date: txDateTime,
      })
      .select()
      .single();

    if (txError) {
      toast.error("Failed to add transaction");
      setSubmitting(false);
      return;
    }

    // ── 2. Rule-based analysis ────────────────────────────────────────────────
    const analysis = analyzeTransaction(
      { amount: parsedAmount, location: location.trim() || null, transaction_type: txType, transaction_date: txDateTime },
      transactions
    );

    await supabase.from("fraud_analysis").insert({
      transaction_id: txData.id,
      user_id: user.id,
      ...analysis,
      flags: analysis.flags as any,
      analysis_details: analysis.analysis_details as any,
    });

    // ── 3. ML model prediction ────────────────────────────────────────────────
    try {
      const txDate = new Date(getTxDateTime());
      const hour = txDate.getHours();
      const day = txDate.getDay();
      const amountLog = Math.log1p(parsedAmount);
      const isHighAmount = parsedAmount > 200000 ? 1 : 0;
      const isRoundAmount = parsedAmount % 1000 === 0 ? 1 : 0;

      let transactionData: Record<string, number | string> = {};

      // ✅ Build features based on SELECTED model — exact feature names from training
      if (mlModel === "bank_transfer") {
        const oldbalanceOrg = parsedAmount;
        const newbalanceOrig = 0;
        const oldbalanceDest = 0;
        const newbalanceDest = parsedAmount;
        transactionData = {
          amount: parsedAmount,
          oldbalanceOrg,
          newbalanceOrig,
          oldbalanceDest,
          newbalanceDest,
          balanceChangeOrig: newbalanceOrig - oldbalanceOrg,
          balanceChangeDest: newbalanceDest - oldbalanceDest,
          errorBalanceOrig: Math.abs(oldbalanceOrg - parsedAmount - newbalanceOrig),
          errorBalanceDest: Math.abs(oldbalanceDest + parsedAmount - newbalanceDest),
          hour, day,
          amount_log: amountLog,
          is_high_amount: isHighAmount,
          is_round_amount: isRoundAmount,
          type_encoded: txType === "withdrawal" ? 1 : 4,
          orig_transaction_count: transactions.length,
          dest_transaction_count: 1,
        };

      } else if (mlModel === "credit_card") {
        // Credit card needs V1-V28 PCA features + Amount
        transactionData = { Amount: parsedAmount };
        for (let i = 1; i <= 28; i++) transactionData[`V${i}`] = 0;

      } else if (mlModel === "upi") {
        // Exact UPI feature names from training:
        // ['amount (INR)', 'hour_of_day', 'day_of_week', 'is_weekend', 'hour',
        //  'is_night', 'transaction type_encoded', 'merchant_category_encoded',
        //  'transaction_status_encoded', 'sender_age_group_encoded',
        //  'receiver_age_group_encoded', 'sender_state_encoded',
        //  'sender_bank_encoded', 'receiver_bank_encoded',
        //  'device_type_encoded', 'network_type_encoded']
        const isWeekend = [0, 6].includes(day) ? 1 : 0;
        const isNight = (hour >= 22 || hour <= 5) ? 1 : 0;
        transactionData = {
          "amount (INR)": parsedAmount,
          "hour_of_day": hour,
          "day_of_week": day,
          "is_weekend": isWeekend,
          "hour": hour,
          "is_night": isNight,
          "transaction type_encoded": txType === "payment" ? 1 : 2,
          "merchant_category_encoded": 1,       // default: general merchant
          "transaction_status_encoded": 1,       // default: completed
          "sender_age_group_encoded": 2,         // default: adult (25-40)
          "receiver_age_group_encoded": 2,
          "sender_state_encoded": 1,             // default: state 1
          "sender_bank_encoded": 1,              // default: bank 1
          "receiver_bank_encoded": 1,
          "device_type_encoded": 1,              // default: mobile
          "network_type_encoded": 1,             // default: 4G
        };

      } else if (mlModel === "bitcoin") {
        // Bitcoin has 177 features (feature_1 to feature_166 + aggregates)
        // Use amount-derived values for key features, 0 for unknown graph features
        transactionData = {};
        for (let i = 1; i <= 166; i++) {
          if (i === 1) transactionData[`feature_${i}`] = parsedAmount;
          else if (i === 2) transactionData[`feature_${i}`] = amountLog;
          else if (i === 3) transactionData[`feature_${i}`] = isHighAmount;
          else if (i === 4) transactionData[`feature_${i}`] = isRoundAmount;
          else if (i === 5) transactionData[`feature_${i}`] = hour;
          else if (i === 6) transactionData[`feature_${i}`] = day;
          else transactionData[`feature_${i}`] = 0;
        }
        // Aggregate features
        transactionData["local_sum"] = parsedAmount;
        transactionData["local_mean"] = parsedAmount;
        transactionData["local_std"] = 0;
        transactionData["local_max"] = parsedAmount;
        transactionData["local_min"] = parsedAmount;
        transactionData["agg_sum"] = parsedAmount * transactions.length;
        transactionData["agg_mean"] = transactions.length > 0
          ? transactions.reduce((s, t) => s + Number(t.amount), 0) / transactions.length
          : parsedAmount;
        transactionData["agg_std"] = 0;
        transactionData["agg_max"] = Math.max(parsedAmount, ...transactions.map(t => Number(t.amount)));
        transactionData["agg_min"] = transactions.length > 0
          ? Math.min(parsedAmount, ...transactions.map(t => Number(t.amount)))
          : parsedAmount;
        transactionData["local_agg_ratio"] = transactions.length > 0
          ? parsedAmount / (transactions.reduce((s, t) => s + Number(t.amount), 0) / transactions.length || 1)
          : 1;
      }

      const mlResponse = await predictFraud(transactionData, mlModel);

      if (mlResponse.success && mlResponse.result) {
        setMlResult(mlResponse.result as MLResult);
        if (mlResponse.result.prediction === "FRAUD") {
          toast.error(`🤖 AI: FRAUD DETECTED — ${mlResponse.result.risk_level} risk (${mlResponse.result.fraud_probability}%)`);
        } else {
          toast.success(`🤖 AI: Legitimate — ${mlResponse.result.fraud_probability}% fraud probability`);
        }
      } else {
        toast.warning("⚠️ ML backend offline — using rule-based analysis only");
      }
    } catch {
      toast.warning("⚠️ ML backend offline — using rule-based analysis only");
    }

    // ── 4. Reset form ─────────────────────────────────────────────────────────
    setAmount("");
    setSenderName("");
    setSenderAccount("");
    setReceiverName("");
    setReceiverAccount("");
    setTxType("transfer");
    setLocation("");
    setDescription("");
    setTxDate(new Date().toISOString().slice(0, 10));
    setTxHour(String(new Date().getHours() % 12 || 12).padStart(2, "0"));
    setTxMinute(String(new Date().getMinutes()).padStart(2, "0"));
    setTxAmPm(new Date().getHours() >= 12 ? "PM" : "AM");
    setSubmitting(false);
  }

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
            NEURAL<span className="text-primary">SHIELD</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-heading border ${
            isLive ? "bg-success/10 text-success border-success/30" : "bg-muted text-muted-foreground border-border"
          }`}>
            {isLive ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                <Wifi className="w-3 h-3" /> LIVE
              </>
            ) : (
              <><WifiOff className="w-3 h-3" /> Connecting…</>
            )}
          </div>
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
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
              className="glass rounded-xl p-4 cyber-border">
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                <span className="text-xs text-muted-foreground font-heading">{stat.label}</span>
              </div>
              <span className="font-display text-2xl font-bold text-foreground">{stat.value}</span>
            </motion.div>
          ))}
        </div>

        <AnalyticsCharts transactions={transactions} analyses={analyses} />

        {/* Transactions header */}
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Transactions
          </h2>

          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setMlResult(null); }}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground font-heading glow-primary">
                <Plus className="w-4 h-4 mr-2" /> New Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-strong border-border max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl text-foreground">Add Transaction</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4 mt-4">

                {/* Amount + Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Amount ($)</Label>
                    <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" min="0.01" required className="bg-muted/50" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Type</Label>
                    <Select value={txType} onValueChange={setTxType}>
                      <SelectTrigger className="bg-muted/50"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="transfer">Transfer</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="withdrawal">Withdrawal</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Sender */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Sender Name</Label>
                    <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} required maxLength={100} className="bg-muted/50" placeholder="Alice Smith" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Sender Account</Label>
                    <Input value={senderAccount} onChange={(e) => setSenderAccount(e.target.value)} required maxLength={50} className="bg-muted/50" placeholder="XXXX-1234" />
                  </div>
                </div>

                {/* Receiver */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Receiver Name</Label>
                    <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} required maxLength={100} className="bg-muted/50" placeholder="Bob Jones" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Receiver Account</Label>
                    <Input value={receiverAccount} onChange={(e) => setReceiverAccount(e.target.value)} required maxLength={50} className="bg-muted/50" placeholder="XXXX-5678" />
                  </div>
                </div>

                {/* Location + Description */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Location</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} className="bg-muted/50" placeholder="New York, US" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Description</Label>
                    <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className="bg-muted/50" placeholder="Monthly rent" />
                  </div>
                </div>

                {/* ✅ Transaction Date & Time with AM/PM */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Transaction Date & Time
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Date picker */}
                    <Input
                      type="date"
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="bg-muted/50 border-border focus:border-primary"
                    />
                    {/* Time picker with AM/PM */}
                    <div className="flex gap-1">
                      <Select value={txHour} onValueChange={setTxHour}>
                        <SelectTrigger className="bg-muted/50 w-16 text-xs px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0")).map((h) => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={txMinute} onValueChange={setTxMinute}>
                        <SelectTrigger className="bg-muted/50 w-16 text-xs px-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["00","05","10","15","20","25","30","35","40","45","50","55"].map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex rounded-lg border border-border overflow-hidden">
                        {["AM","PM"].map((ap) => (
                          <button
                            key={ap}
                            type="button"
                            onClick={() => setTxAmPm(ap)}
                            className={`px-2.5 text-xs font-heading transition-all ${
                              txAmPm === ap
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >{ap}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    ⚠️ Transactions between 1:00 AM – 5:00 AM are flagged as unusual time
                  </p>
                </div>

                {/* ✅ AI Model Selector */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1">
                    <Brain className="w-3 h-3" /> Select AI Model
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ML_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setMlModel(m.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          mlModel === m.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                        }`}
                      >
                        <div className="text-base mb-0.5">{m.icon} <span className="text-xs font-semibold">{m.label}</span></div>
                        <div className="text-[10px] opacity-70">{m.desc}</div>
                        {mlModel === m.id && <div className="text-[10px] text-primary mt-0.5 font-heading">✓ Selected</div>}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground">Choose the model that matches your transaction type for best accuracy</p>
                </div>

                <Button type="submit" disabled={submitting} className="w-full gradient-primary text-primary-foreground font-heading glow-primary">
                  {submitting
                    ? <><Brain className="w-4 h-4 mr-2 animate-pulse" /> AI Analyzing...</>
                    : "Submit & Analyze"}
                </Button>

                {/* ML Result */}
                {mlResult && <MLResultCard result={mlResult} />}

              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Transaction List */}
        {transactions.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center cyber-border">
            <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-heading text-xl text-muted-foreground mb-2">No transactions yet</h3>
            <p className="text-sm text-muted-foreground">Add your first transaction to see fraud analysis in action.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {transactions.map((tx) => {
                const analysis = analyses[tx.id];
                const isNew = tx.id === newTxId;
                return (
                  <motion.div key={tx.id}
                    initial={{ opacity: 0, x: -30, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className={`glass rounded-xl p-4 transition-colors cursor-pointer ${
                      isNew ? "border border-primary/70 shadow-[0_0_16px_hsl(165_80%_48%/0.25)]" : "cyber-border hover:border-primary/40"
                    }`}
                    onClick={() => setDetailTx(tx.id)}
                  >
                    {isNew && (
                      <div className="flex items-center gap-1.5 mb-2 text-xs text-primary font-heading">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                        </span>
                        New — just arrived via realtime
                      </div>
                    )}
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-heading text-sm font-semibold text-foreground">{tx.transaction_id}</div>
                          <div className="text-xs text-muted-foreground">
                            {tx.sender_name} → {tx.receiver_name} · {tx.transaction_type}
                          </div>
                          <div className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(tx.transaction_date).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-display text-lg font-bold text-foreground">${Number(tx.amount).toLocaleString()}</span>
                        {analysis && <RiskBadge level={analysis.risk_level} />}
                        <Eye className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    {analysis && <div className="mt-3"><RiskMeter score={Number(analysis.risk_score)} /></div>}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={!!detailTx} onOpenChange={(open) => { if (!open) setDetailTx(null); }}>
          <DialogContent className="glass-strong border-border max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl text-foreground">Transaction Analysis</DialogTitle>
            </DialogHeader>
            {detailTransaction && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">ID:</span> <span className="text-foreground font-mono text-xs">{detailTransaction.transaction_id}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground font-display font-bold">${Number(detailTransaction.amount).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Sender:</span> <span className="text-foreground">{detailTransaction.sender_name}</span></div>
                  <div><span className="text-muted-foreground">Receiver:</span> <span className="text-foreground">{detailTransaction.receiver_name}</span></div>
                  <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground capitalize">{detailTransaction.transaction_type}</span></div>
                  <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{detailTransaction.location || "N/A"}</span></div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Transaction Time:</span>{" "}
                    <span className="text-foreground">{new Date(detailTransaction.transaction_date).toLocaleString()}</span>
                  </div>
                </div>

                {detailAnalysis && (
                  <>
                    <div className="border-t border-border pt-4"><RiskMeter score={Number(detailAnalysis.risk_score)} /></div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Risk Level:</span>
                      <RiskBadge level={detailAnalysis.risk_level} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Velocity Check", value: detailAnalysis.velocity_check },
                        { label: "Amount Anomaly", value: detailAnalysis.amount_anomaly },
                        { label: "Geo Mismatch", value: detailAnalysis.geo_mismatch },
                        { label: "Unusual Time", value: detailAnalysis.unusual_time },
                        { label: "Duplicate", value: detailAnalysis.duplicate_detected },
                      ].map((check) => (
                        <div key={check.label} className="flex items-center gap-2 text-sm">
                          {check.value ? <XCircle className="w-4 h-4 text-destructive" /> : <CheckCircle className="w-4 h-4 text-success" />}
                          <span className={check.value ? "text-destructive" : "text-muted-foreground"}>{check.label}</span>
                        </div>
                      ))}
                    </div>
                    {(detailAnalysis.flags as string[]).length > 0 && (
                      <div className="space-y-2">
                        <span className="text-sm font-heading text-foreground">Flags:</span>
                        {(detailAnalysis.flags as string[]).map((flag, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-warning bg-warning/5 rounded-lg p-2 border border-warning/20">
                            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{flag}</span>
                          </div>
                        ))}
                      </div>
                    )}
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