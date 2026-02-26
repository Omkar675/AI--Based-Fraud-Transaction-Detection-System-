import { useMemo } from "react";
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
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
import { PieChart as PieIcon, Activity, AlertTriangle, ActivitySquare } from "lucide-react";

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
  unusual_time: boolean;
  duplicate_detected: boolean;
}

interface AnalyticsChartsProps {
  transactions: Transaction[];
  analyses: Record<string, FraudAnalysis>;
}

const RISK_COLORS = {
  high: "#ef4444",   // Red
  medium: "#eab308", // Yellow
  low: "#22c55e",    // Green
};

const CHART_COLORS = {
  primary: "#00f0ff", // Cyber Blue
  accent: "#a855f7",  // Cyber Purple
  orange: "#f59e0b",
};

function PanelTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass cyber-border rounded-xl px-4 py-3 shadow-xl shadow-primary/10 text-xs min-w-[150px] backdrop-blur-md">
      {label && <div className="text-primary font-heading font-semibold mb-2 border-b border-border/50 pb-1 truncate">{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: entry.color || entry.fill }} />
            <span className="text-muted-foreground">{entry.name}:</span>
          </div>
          <span className="font-mono font-bold text-foreground ml-3">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function RiskDot(props: any) {
  const { cx, cy, payload } = props;
  const color =
    payload.risk_level === "high" ? RISK_COLORS.high :
      payload.risk_level === "medium" ? RISK_COLORS.medium :
        RISK_COLORS.low;
  return <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.8} stroke="#00f0ff" strokeWidth={1} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />;
}

export default function AnalyticsCharts({ transactions, analyses }: AnalyticsChartsProps) {

  const perTransactionData = useMemo(() => {
    return transactions
      .slice()
      .reverse()
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

  const riskDistribution = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    Object.values(analyses).forEach((a) => {
      if (a.risk_level === "high") counts.high++;
      else if (a.risk_level === "medium") counts.medium++;
      else counts.low++;
    });
    return [
      { name: "High", value: counts.high, fill: RISK_COLORS.high },
      { name: "Medium", value: counts.medium, fill: RISK_COLORS.medium },
      { name: "Low", value: counts.low, fill: RISK_COLORS.low },
    ].filter((d) => d.value > 0);
  }, [analyses]);

  const flagPatterns = useMemo(() => {
    const counts = { "Velocity": 0, "Amt Anomaly": 0, "Unusual Time": 0, "Duplicate": 0 };
    Object.values(analyses).forEach((a) => {
      if (a.velocity_check) counts["Velocity"]++;
      if (a.amount_anomaly) counts["Amt Anomaly"]++;
      if (a.unusual_time) counts["Unusual Time"]++;
      if (a.duplicate_detected) counts["Duplicate"]++;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [analyses]);

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

  const scoreHistogram = useMemo(() => {
    const buckets = [
      { range: "0–20", count: 0, fill: RISK_COLORS.low },
      { range: "21–40", count: 0, fill: CHART_COLORS.primary },
      { range: "41–60", count: 0, fill: RISK_COLORS.medium },
      { range: "61–80", count: 0, fill: CHART_COLORS.orange },
      { range: "81–100", count: 0, fill: RISK_COLORS.high },
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

  if (transactions.length === 0) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-8 mb-8">
      {/* Time Series Graph */}
      <div className="glass rounded-xl p-5 cyber-border hover:border-primary/40 transition-all xl:col-span-2 group">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <Activity className="w-5 h-5 text-primary group-hover:glow-primary transition-all" />
            Neural Risk Over Time
          </div>
          <span className="font-mono text-primary bg-primary/10 px-3 py-1 rounded-md text-sm border border-primary/20">
            Node Signals: {transactions.length}
          </span>
        </div>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={perTransactionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
              <Tooltip content={<PanelTooltip />} />
              <Area
                type="monotone"
                dataKey="risk_score"
                name="Risk Score"
                stroke={CHART_COLORS.primary}
                strokeWidth={3}
                fill="url(#gradRisk)"
                activeDot={{ r: 6, fill: CHART_COLORS.primary, stroke: "#fff", strokeWidth: 2, className: "glow-primary" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Flag Distribution (Bar Chart) */}
      <div className="glass rounded-xl p-5 cyber-border hover:border-primary/40 transition-all group">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground mb-6">
          <AlertTriangle className="w-5 h-5 text-destructive group-hover:glow-danger transition-all" />
          Heuristic Pattern Blocks
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={flagPatterns} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip cursor={{ fill: 'hsl(var(--primary)/0.05)' }} content={<PanelTooltip />} />
              <Bar dataKey="value" name="Occurrences" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} barSize={20}>
                {flagPatterns.map((_, index) => (
                  <Cell key={index} fill={[CHART_COLORS.primary, CHART_COLORS.accent, RISK_COLORS.low, RISK_COLORS.high][index % 4]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk Distribution (Pie) */}
      <div className="glass rounded-xl p-5 cyber-border hover:border-primary/40 transition-all group">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground mb-6">
          <PieIcon className="w-5 h-5 text-warning group-hover:glow-accent transition-all" />
          Threat Vector Topography
        </div>
        <div className="h-[220px] flex items-center justify-center">
          <div className="w-1/2 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={riskDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value" stroke="none">
                  {riskDistribution.map((entry, index) => <Cell key={index} fill={entry.fill} style={{ filter: `drop-shadow(0 0 8px ${entry.fill}80)` }} />)}
                </Pie>
                <Tooltip content={<PanelTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 flex flex-col gap-3 pl-4">
            {riskDistribution.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-muted/20 border border-border/50 p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: r.fill, boxShadow: `0 0 8px ${r.fill}` }} />
                  <span className="text-muted-foreground font-heading">{r.name}</span>
                </div>
                <span className="font-mono font-bold text-foreground">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Amount vs Risk (Scatter) */}
      <div className="glass rounded-xl p-5 cyber-border hover:border-primary/40 transition-all group">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground mb-6">
          <ActivitySquare className="w-5 h-5 text-success glow-primary transition-all" />
          Volume vs. Risk Matrix
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
              <XAxis
                type="number" dataKey="amount" name="Transfer Vol"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "monospace" }}
                axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
              />
              <YAxis
                type="number" dataKey="risk_score" name="Risk Output"
                domain={[0, 100]}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "monospace" }}
                axisLine={false} tickLine={false}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip cursor={{ strokeDasharray: "3 3", stroke: "hsl(var(--primary))" }} content={<PanelTooltip />} />
              <Scatter name="Signals" data={scatterData} shape={<RiskDot />} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bucket Histogram */}
      <div className="glass rounded-xl p-5 cyber-border hover:border-primary/40 transition-all group">
        <div className="flex items-center gap-2 font-heading text-lg font-bold text-foreground mb-6">
          <ActivitySquare className="w-5 h-5 text-accent glow-accent transition-all" />
          Severity Frequency
        </div>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreHistogram} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" vertical={false} />
              <XAxis dataKey="range" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11, fontFamily: "monospace" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'hsl(var(--primary)/0.05)' }} content={<PanelTooltip />} />
              <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]}>
                {scoreHistogram.map((entry, index) => <Cell key={index} fill={entry.fill} style={{ filter: `drop-shadow(0 0 6px ${entry.fill}60)` }} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}