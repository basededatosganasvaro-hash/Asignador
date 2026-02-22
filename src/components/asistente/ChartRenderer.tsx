"use client";
import { Box, Typography, Paper } from "@mui/material";
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
    <Paper variant="outlined" sx={{ p: 2, my: 1 }}>
      {title && (
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {title}
        </Typography>
      )}
      <Box sx={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          {type === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Bar key={ds.label} dataKey={ds.label} fill={ds.color || COLORS[i % COLORS.length]} />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              {datasets.map((ds, i) => (
                <Line key={ds.label} type="monotone" dataKey={ds.label} stroke={ds.color || COLORS[i % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          ) : (
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={data.map((d, i) => ({ name: d.name, value: d[datasets[0]?.label] as number }))}
                cx="50%" cy="50%" outerRadius={100} dataKey="value" label
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          )}
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
}
