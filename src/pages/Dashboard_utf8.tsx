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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  // 1. Amount anomaly: if amount > 2x average or > $10,000
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

  // 2. Velocity check: >5 transactions in last hour
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentCount = history.filter(
    (t) => new Date(t.created_at) > oneHourAgo
  ).length;
  if (recentCount >= 5) {
    velocityCheck = true;
    riskScore += 20;
    flags.push(`${recentCount} transactions in the last hour (velocity alert)`);
  }

  // 3. Geo mismatch: different location from most recent
  if (tx.location && history.length > 0) {
    const lastLocation = history[0]?.location;
    if (lastLocation && lastLocation.toLowerCase() !== tx.location.toLowerCase()) {
      geoMismatch = true;
      riskScore += 20;
      flags.push(`Location "${tx.location}" differs from last transaction "${lastLocation}"`);
    }
  }

  // 4. Unusual time: between 1 AM and 5 AM
  const txHour = new Date(tx.transaction_date).getHours();
  if (txHour >= 1 && txHour <= 5) {
    unusualTime = true;
    riskScore += 15;
    flags.push(`Transaction at unusual hour (${txHour}:00)`);
  }

  // 5. Duplicate detection
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
  const [senderName, setSenderName] = useState("");
  const [senderAccount, setSenderAccount] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverAccount, setReceiverAccount] = useState("");
  const [txType, setTxType] = useState("transfer");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchTransactions();
    }
  }, [user]);

  async function fetchTransactions() {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load transactions");
      return;
    }
    setTransactions(data || []);

    // Fetch analyses
    const { data: analysisData } = await supabase
      .from("fraud_analysis")
      .select("*");

    if (analysisData) {
      const map: Record<string, FraudAnalysis> = {};
      analysisData.forEach((a: any) => {
        map[a.transaction_id] = a;
      });
      setAnalyses(map);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a valid amount");
      setSubmitting(false);
      return;
    }

    const txId = generateTransactionId();
    const txDate = new Date().toISOString();

    // Insert transaction
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
        transaction_date: txDate,
      })
      .select()
      .single();

    if (txError) {
      toast.error("Failed to add transaction");
      setSubmitting(false);
      return;
    }

    // Run fraud analysis
    const analysis = analyzeTransaction(
      { amount: parsedAmount, location: location.trim() || null, transaction_type: txType, transaction_date: txDate },
      transactions
    );

    const { error: analysisError } = await supabase.from("fraud_analysis").insert({
      transaction_id: txData.id,
      user_id: user.id,
      ...analysis,
      flags: analysis.flags as any,
      analysis_details: analysis.analysis_details as any,
    });

    if (analysisError) {
      console.error("Analysis insert error:", analysisError);
    }

    // Reset form
    setAmount("");
    setSenderName("");
    setSenderAccount("");
    setReceiverName("");
    setReceiverAccount("");
    setTxType("transfer");
    setLocation("");
    setDescription("");
    setDialogOpen(false);
    setSubmitting(false);

    toast.success(
      analysis.risk_level === "high"
        ? "ΓÜá∩╕Å HIGH RISK transaction detected!"
        : analysis.risk_level === "medium"
        ? "ΓÜí Medium risk ΓÇö review recommended"
        : "Γ£à Transaction looks safe"
    );

    fetchTransactions();
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
                <DialogTitle className="font-heading text-xl text-foreground">Add Transaction</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                <Button type="submit" disabled={submitting} className="w-full gradient-primary text-primary-foreground font-heading glow-primary">
                  {submitting ? "Analyzing..." : "Submit & Analyze"}
                </Button>
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
            {transactions.map((tx, i) => {
              const analysis = analyses[tx.id];
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass rounded-xl p-4 cyber-border hover:border-primary/40 transition-all cursor-pointer"
                  onClick={() => setDetailTx(tx.id)}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-heading text-sm font-semibold text-foreground">{tx.transaction_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {tx.sender_name} ΓåÆ {tx.receiver_name} ┬╖ {tx.transaction_type}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-display text-lg font-bold text-foreground">
                        ${Number(tx.amount).toLocaleString()}
                      </span>
                      {analysis && <RiskBadge level={analysis.risk_level} />}
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {analysis && (
                    <div className="mt-3">
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
              <DialogTitle className="font-heading text-xl text-foreground">Transaction Analysis</DialogTitle>
            </DialogHeader>
            {detailTransaction && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">ID:</span> <span className="text-foreground font-mono">{detailTransaction.transaction_id}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="text-foreground font-display font-bold">${Number(detailTransaction.amount).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Sender:</span> <span className="text-foreground">{detailTransaction.sender_name}</span></div>
                  <div><span className="text-muted-foreground">Receiver:</span> <span className="text-foreground">{detailTransaction.receiver_name}</span></div>
                  <div><span className="text-muted-foreground">Type:</span> <span className="text-foreground capitalize">{detailTransaction.transaction_type}</span></div>
                  <div><span className="text-muted-foreground">Location:</span> <span className="text-foreground">{detailTransaction.location || "N/A"}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Date:</span> <span className="text-foreground">{new Date(detailTransaction.transaction_date).toLocaleString()}</span></div>
                </div>

                {detailAnalysis && (
                  <>
                    <div className="border-t border-border pt-4">
                      <RiskMeter score={Number(detailAnalysis.risk_score)} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Risk Level:</span>
                      <RiskBadge level={detailAnalysis.risk_level} />
                    </div>

                    {/* Checks */}
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Velocity", value: detailAnalysis.velocity_check },
                        { label: "Amount Anomaly", value: detailAnalysis.amount_anomaly },
                        { label: "Geo Mismatch", value: detailAnalysis.geo_mismatch },
                        { label: "Unusual Time", value: detailAnalysis.unusual_time },
                        { label: "Duplicate", value: detailAnalysis.duplicate_detected },
                      ].map((check) => (
                        <div key={check.label} className="flex items-center gap-2 text-sm">
                          {check.value ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-success" />
                          )}
                          <span className={check.value ? "text-destructive" : "text-muted-foreground"}>{check.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Flags */}
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
