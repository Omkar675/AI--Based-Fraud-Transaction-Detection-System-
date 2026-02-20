import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PieChart as PieIcon, TrendingUp, BarChart2 } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  transaction_date: string;
  created_at: string;
}

interface FraudAnalysis {
  transaction_id: string;
  risk_score: number;
  risk_level: string;
  velocity_check: boolean;
  amount_anomaly: boolean;
  geo_mismatch: boolean;
  unusual_time: boolean;
  duplicate_detected: boolean;
}

interface AnalyticsChartsProps {
  transactions: Transaction[];
  analyses: Record<string, FraudAnalysis>;
}

const RISK_COLORS = {
  high: "hsl(0 72% 55%)",
  medium: "hsl(38 92% 55%)",
  low: "hsl(145 65% 42%)",
};

const CHART_COLORS = {
  primary: "hsl(165 80% 48%)",
  accent: "hsl(270 70% 60%)",
  blue: "hsl(200 100% 60%)",
  red: "hsl(0 72% 55%)",
  orange: "hsl(38 92% 55%)",
  green: "hsl(145 65% 42%)",
};

// Custom tooltip styled to match the cyberpunk theme
function CyberTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg px-3 py-2 border border-primary/30 shadow-lg">
      {label && (
        <p className="text-xs text-muted-foreground font-heading mb-1">{label}</p>
      )}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color || entry.fill }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-display font-bold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function PieCustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="glass-strong rounded-lg px-3 py-2 border border-primary/30 shadow-lg">
      <div className="flex items-center gap-2 text-xs">
        <div className="w-2 h-2 rounded-full" style={{ background: entry.payload.fill }} />
        <span className="text-muted-foreground capitalize">{entry.name}:</span>
        <span className="font-display font-bold text-foreground">{entry.value}</span>
      </div>
    </div>
  );
}

export default function AnalyticsCharts({ transactions, analyses }: AnalyticsChartsProps) {
  // 1. Risk distribution pie data
  const riskDistribution = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    Object.values(analyses).forEach((a) => {
      if (a.risk_level === "high") counts.high++;
      else if (a.risk_level === "medium") counts.medium++;
      else counts.low++;
    });
    return [
      { name: "High Risk", value: counts.high, fill: RISK_COLORS.high },
      { name: "Medium Risk", value: counts.medium, fill: RISK_COLORS.medium },
      { name: "Low Risk", value: counts.low, fill: RISK_COLORS.low },
    ].filter((d) => d.value > 0);
  }, [analyses]);

  // 2. Transaction trend over last 7 days (daily counts + avg risk score)
  const trendData = useMemo(() => {
    const days: Record<string, { date: string; transactions: number; avgRisk: number; totalRisk: number }> = {};

    // Build 7-day range
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      days[key] = { date: key, transactions: 0, avgRisk: 0, totalRisk: 0 };
    }

    transactions.forEach((tx) => {
      const d = new Date(tx.created_at);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (days[key]) {
        days[key].transactions++;
        const analysis = analyses[tx.id];
        if (analysis) {
          days[key].totalRisk += Number(analysis.risk_score);
        }
      }
    });

    return Object.values(days).map((d) => ({
      date: d.date,
      transactions: d.transactions,
      avgRisk: d.transactions > 0 ? Math.round(d.totalRisk / d.transactions) : 0,
    }));
  }, [transactions, analyses]);

  // 3. Fraud pattern counts (which flags are most common)
  const flagPatterns = useMemo(() => {
    const counts = {
      "Velocity": 0,
      "Amt Anomaly": 0,
      "Geo Mismatch": 0,
      "Unusual Time": 0,
      "Duplicate": 0,
    };
    Object.values(analyses).forEach((a) => {
      if (a.velocity_check) counts["Velocity"]++;
      if (a.amount_anomaly) counts["Amt Anomaly"]++;
      if (a.geo_mismatch) counts["Geo Mismatch"]++;
      if (a.unusual_time) counts["Unusual Time"]++;
      if (a.duplicate_detected) counts["Duplicate"]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analyses]);

  // 4. Risk score distribution histogram (buckets: 0-20, 20-40, 40-60, 60-80, 80-100)
  const scoreHistogram = useMemo(() => {
    const buckets = [
      { range: "0–20", count: 0, fill: CHART_COLORS.green },
      { range: "21–40", count: 0, fill: CHART_COLORS.primary },
      { range: "41–60", count: 0, fill: CHART_COLORS.orange },
      { range: "61–80", count: 0, fill: RISK_COLORS.high },
      { range: "81–100", count: 0, fill: "hsl(350 80% 50%)" },
    ];
    Object.values(analyses).forEach((a) => {
      const s = Number(a.risk_score);
      if (s <= 20) buckets[0].count++;
      else if (s <= 40) buckets[1].count++;
      else if (s <= 60) buckets[2].count++;
      else if (s <= 80) buckets[3].count++;
      else buckets[4].count++;
    });
    return buckets;
  }, [analyses]);

  const hasData = transactions.length > 0;

  if (!hasData) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Analytics
      </h2>

      {/* Row 1: Area chart (full width) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass rounded-2xl p-5 cyber-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-heading text-sm font-semibold text-foreground">Transaction Trends (Last 7 Days)</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradTx" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.red} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.red} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" />
            <XAxis dataKey="date" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CyberTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "Rajdhani", color: "hsl(215 20% 55%)" }} />
            <Area type="monotone" dataKey="transactions" name="Transactions" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#gradTx)" dot={{ fill: CHART_COLORS.primary, r: 3 }} />
            <Area type="monotone" dataKey="avgRisk" name="Avg Risk Score" stroke={CHART_COLORS.red} strokeWidth={2} fill="url(#gradRisk)" dot={{ fill: CHART_COLORS.red, r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Row 2: Pie + Bar side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Distribution Pie */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-2xl p-5 cyber-border"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-accent" />
            <span className="font-heading text-sm font-semibold text-foreground">Risk Distribution</span>
          </div>
          {riskDistribution.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No analysis data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  stroke="none"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<PieCustomTooltip />} />
                <Legend
                  formatter={(value) => <span style={{ color: "hsl(215 20% 55%)", fontFamily: "Rajdhani", fontSize: 11 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Fraud Patterns Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="glass rounded-2xl p-5 cyber-border"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-cyber-blue" />
            <span className="font-heading text-sm font-semibold text-foreground">Fraud Flag Breakdown</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={flagPatterns} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "hsl(215 20% 55%)", fontSize: 10, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CyberTooltip />} />
              <Bar dataKey="value" name="Occurrences" radius={[4, 4, 0, 0]}>
                {flagPatterns.map((_, index) => (
                  <Cell
                    key={index}
                    fill={[CHART_COLORS.red, CHART_COLORS.orange, CHART_COLORS.accent, CHART_COLORS.blue, CHART_COLORS.primary][index % 5]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Row 3: Risk Score Histogram */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="glass rounded-2xl p-5 cyber-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="font-heading text-sm font-semibold text-foreground">Risk Score Distribution</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={scoreHistogram} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={40}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CyberTooltip />} />
            <Bar dataKey="count" name="Transactions" radius={[4, 4, 0, 0]}>
              {scoreHistogram.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
