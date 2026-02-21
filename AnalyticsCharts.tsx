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
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { PieChart as PieIcon, TrendingUp, BarChart2, Activity } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  transaction_id: string;
  transaction_type: string;
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
  high:   "hsl(0 72% 55%)",
  medium: "hsl(38 92% 55%)",
  low:    "hsl(145 65% 42%)",
};

const CHART_COLORS = {
  primary: "hsl(165 80% 48%)",
  accent:  "hsl(270 70% 60%)",
  blue:    "hsl(200 100% 60%)",
  red:     "hsl(0 72% 55%)",
  orange:  "hsl(38 92% 55%)",
  green:   "hsl(145 65% 42%)",
};

function CyberTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-strong rounded-lg px-3 py-2 border border-primary/30 shadow-lg max-w-[200px]">
      {label && <p className="text-xs text-muted-foreground font-heading mb-1 truncate">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: entry.color || entry.fill }} />
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

// Custom dot for scatter — color by risk
function RiskDot(props: any) {
  const { cx, cy, payload } = props;
  const color =
    payload.risk_level === "high"   ? RISK_COLORS.high :
    payload.risk_level === "medium" ? RISK_COLORS.medium :
    RISK_COLORS.low;
  return <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.85} stroke="transparent" />;
}

export default function AnalyticsCharts({ transactions, analyses }: AnalyticsChartsProps) {

  // ── 1. Per-transaction risk score (each tx as a point on the chart) ──────────
  const perTransactionData = useMemo(() => {
    return transactions
      .slice()
      .reverse() // oldest first
      .map((tx, index) => {
        const analysis = analyses[tx.id];
        const shortId = tx.transaction_id?.slice(-6) ?? `#${index + 1}`;
        return {
          index: index + 1,
          label: shortId,
          amount: Number(tx.amount),
          risk_score: analysis ? Number(analysis.risk_score) : 0,
          risk_level: analysis?.risk_level ?? "low",
          type: tx.transaction_type,
        };
      });
  }, [transactions, analyses]);

  // ── 2. Risk distribution pie ─────────────────────────────────────────────────
  const riskDistribution = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    Object.values(analyses).forEach((a) => {
      if (a.risk_level === "high") counts.high++;
      else if (a.risk_level === "medium") counts.medium++;
      else counts.low++;
    });
    return [
      { name: "High Risk",   value: counts.high,   fill: RISK_COLORS.high   },
      { name: "Medium Risk", value: counts.medium, fill: RISK_COLORS.medium },
      { name: "Low Risk",    value: counts.low,    fill: RISK_COLORS.low    },
    ].filter((d) => d.value > 0);
  }, [analyses]);

  // ── 3. Fraud flag breakdown ───────────────────────────────────────────────────
  const flagPatterns = useMemo(() => {
    const counts = { "Velocity": 0, "Amt Anomaly": 0, "Geo Mismatch": 0, "Unusual Time": 0, "Duplicate": 0 };
    Object.values(analyses).forEach((a) => {
      if (a.velocity_check)    counts["Velocity"]++;
      if (a.amount_anomaly)    counts["Amt Anomaly"]++;
      if (a.geo_mismatch)      counts["Geo Mismatch"]++;
      if (a.unusual_time)      counts["Unusual Time"]++;
      if (a.duplicate_detected) counts["Duplicate"]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analyses]);

  // ── 4. Amount vs Risk scatter ─────────────────────────────────────────────────
  const scatterData = useMemo(() => {
    return transactions.map((tx) => {
      const analysis = analyses[tx.id];
      return {
        amount: Number(tx.amount),
        risk_score: analysis ? Number(analysis.risk_score) : 0,
        risk_level: analysis?.risk_level ?? "low",
        label: tx.transaction_id?.slice(-6),
      };
    });
  }, [transactions, analyses]);

  // ── 5. Risk score histogram ───────────────────────────────────────────────────
  const scoreHistogram = useMemo(() => {
    const buckets = [
      { range: "0–20",   count: 0, fill: CHART_COLORS.green   },
      { range: "21–40",  count: 0, fill: CHART_COLORS.primary },
      { range: "41–60",  count: 0, fill: CHART_COLORS.orange  },
      { range: "61–80",  count: 0, fill: RISK_COLORS.high     },
      { range: "81–100", count: 0, fill: "hsl(350 80% 50%)"   },
    ];
    Object.values(analyses).forEach((a) => {
      const s = Number(a.risk_score);
      if (s <= 20)      buckets[0].count++;
      else if (s <= 40) buckets[1].count++;
      else if (s <= 60) buckets[2].count++;
      else if (s <= 80) buckets[3].count++;
      else              buckets[4].count++;
    });
    return buckets;
  }, [analyses]);

  if (transactions.length === 0) return null;

  const highRiskCount   = Object.values(analyses).filter(a => a.risk_level === "high").length;
  const fraudRate       = transactions.length > 0
    ? ((highRiskCount / transactions.length) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" /> Analytics
      </h2>

      {/* ── Chart 1: Per-Transaction Risk Score ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="glass rounded-2xl p-5 cyber-border"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="font-heading text-sm font-semibold text-foreground">
              Risk Score — Per Transaction ({transactions.length} total)
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-heading">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Low</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block"/>Medium</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>High</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={perTransactionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gradRiskPer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={CHART_COLORS.red} stopOpacity={0.3} />
                <stop offset="95%" stopColor={CHART_COLORS.red} stopOpacity={0}   />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 10, fontFamily: "Rajdhani" }}
              axisLine={false} tickLine={false}
              interval={Math.max(0, Math.floor(perTransactionData.length / 10) - 1)}
              label={{ value: "Transaction ID (last 6 chars)", position: "insideBottom", offset: -2, fill: "hsl(215 20% 45%)", fontSize: 10 }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }}
              axisLine={false} tickLine={false}
              label={{ value: "Risk Score", angle: -90, position: "insideLeft", fill: "hsl(215 20% 45%)", fontSize: 10 }}
            />
            <Tooltip content={<CyberTooltip />} />
            {/* Red zone above 60 */}
            <Area
              type="monotone" dataKey="risk_score" name="Risk Score"
              stroke={CHART_COLORS.red} strokeWidth={2}
              fill="url(#gradRiskPer)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const color =
                  payload.risk_level === "high"   ? RISK_COLORS.high :
                  payload.risk_level === "medium" ? RISK_COLORS.medium :
                  RISK_COLORS.low;
                return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={color} stroke="transparent" />;
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Chart 2: Amount vs Risk Scatter ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
        className="glass rounded-2xl p-5 cyber-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-accent" />
          <span className="font-heading text-sm font-semibold text-foreground">
            Amount vs Risk Score (each dot = 1 transaction)
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" />
            <XAxis
              type="number" dataKey="amount" name="Amount"
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 10, fontFamily: "Rajdhani" }}
              axisLine={false} tickLine={false}
              tickFormatter={(v) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`}
              label={{ value: "Amount ($)", position: "insideBottom", offset: -5, fill: "hsl(215 20% 45%)", fontSize: 10 }}
            />
            <YAxis
              type="number" dataKey="risk_score" name="Risk Score"
              domain={[0, 100]}
              tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }}
              axisLine={false} tickLine={false}
              label={{ value: "Risk Score", angle: -90, position: "insideLeft", fill: "hsl(215 20% 45%)", fontSize: 10 }}
            />
            <ZAxis range={[60, 60]} />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                return (
                  <div className="glass-strong rounded-lg px-3 py-2 border border-primary/30 text-xs space-y-1">
                    <p className="font-heading text-muted-foreground">TX: {d?.label}</p>
                    <p className="text-foreground">Amount: <strong>${d?.amount?.toLocaleString()}</strong></p>
                    <p className="text-foreground">Risk Score: <strong>{d?.risk_score}</strong></p>
                    <p style={{ color:
                      d?.risk_level === "high" ? RISK_COLORS.high :
                      d?.risk_level === "medium" ? RISK_COLORS.medium :
                      RISK_COLORS.low
                    }} className="capitalize font-semibold">{d?.risk_level} risk</p>
                  </div>
                );
              }}
            />
            {/* Low risk dots */}
            <Scatter
              name="Low" data={scatterData.filter(d => d.risk_level === "low")}
              shape={<RiskDot />}
            />
            {/* Medium risk dots */}
            <Scatter
              name="Medium" data={scatterData.filter(d => d.risk_level === "medium")}
              shape={<RiskDot />}
            />
            {/* High risk dots */}
            <Scatter
              name="High" data={scatterData.filter(d => d.risk_level === "high")}
              shape={<RiskDot />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── Row 3: Pie + Flag Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="glass rounded-2xl p-5 cyber-border"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-accent" />
              <span className="font-heading text-sm font-semibold text-foreground">Risk Distribution</span>
            </div>
            <span className="text-xs font-heading text-destructive">{fraudRate}% high risk</span>
          </div>
          {riskDistribution.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No analysis data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                  {riskDistribution.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                </Pie>
                <Tooltip content={<PieCustomTooltip />} />
                <Legend formatter={(value) => <span style={{ color: "hsl(215 20% 55%)", fontFamily: "Rajdhani", fontSize: 11 }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}
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
                  <Cell key={index} fill={[CHART_COLORS.red, CHART_COLORS.orange, CHART_COLORS.accent, CHART_COLORS.blue, CHART_COLORS.primary][index % 5]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── Chart 4: Risk Score Histogram ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
        className="glass rounded-2xl p-5 cyber-border"
      >
        <div className="flex items-center gap-2 mb-1">
          <BarChart2 className="w-4 h-4 text-primary" />
          <span className="font-heading text-sm font-semibold text-foreground">Risk Score Distribution</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4 font-heading">How many transactions fall in each risk score bucket</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={scoreHistogram} margin={{ top: 5, right: 10, left: -20, bottom: 0 }} barSize={40}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 15%)" vertical={false} />
            <XAxis dataKey="range" tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 11, fontFamily: "Rajdhani" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CyberTooltip />} />
            <Bar dataKey="count" name="Transactions" radius={[4, 4, 0, 0]}>
              {scoreHistogram.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}