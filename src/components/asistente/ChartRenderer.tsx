"use client";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

interface ChartConfig {
  type: "bar" | "line" | "pie";
  title?: string;
  labels: string[];
  datasets: { label: string; data: number[]; color?: string }[];
}

const COLORS = ["#1a237e", "#0288d1", "#2e7d32", "#ed6c02", "#d32f2f", "#7b1fa2", "#00838f", "#558b2f"];

interface ChartRendererProps {
  config: ChartConfig;
}

export default function ChartRenderer({ config }: ChartRendererProps) {
  const { type, title, labels, datasets } = config;

  // Transform to recharts format
  const data = labels.map((label, i) => {
    const point: Record<string, string | number> = { name: label };
    datasets.forEach((ds) => {
      point[ds.label] = ds.data[i] ?? 0;
    });
    return point;
  });

  return (
    <div className="bg-surface rounded-xl border border-slate-800/60 p-4 my-2">
      {title && (
        <h4 className="text-sm font-semibold text-slate-100 mb-2">
          {title}
        </h4>
      )}
      <div className="w-full h-[300px]">
        <ResponsiveContainer>
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1E2538",
                  border: "1px solid rgba(51, 65, 85, 0.6)",
                  borderRadius: "0.5rem",
                  color: "#e2e8f0",
                  fontSize: "0.75rem",
                }}
              />
              <Legend />
              {datasets.map((ds, i) => (
                <Bar key={ds.label} dataKey={ds.label} fill={ds.color || COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1E2538",
                  border: "1px solid rgba(51, 65, 85, 0.6)",
                  borderRadius: "0.5rem",
                  color: "#e2e8f0",
                  fontSize: "0.75rem",
                }}
              />
              <Legend />
              {datasets.map((ds, i) => (
                <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1E2538",
                  border: "1px solid rgba(51, 65, 85, 0.6)",
                  borderRadius: "0.5rem",
                  color: "#e2e8f0",
                  fontSize: "0.75rem",
                }}
              />
              <Legend />
              <Pie
                data={data.map((d) => ({ name: d.name, value: d[datasets[0]?.label] as number }))}
                cx="50%" cy="50%" outerRadius={100} dataKey="value" label
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
