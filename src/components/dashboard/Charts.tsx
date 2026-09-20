"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { formatPKR } from "@/lib/utils";

const LIME = "#A8D842";
const NAVY = "#1B2A4A";
const TEAL = "#2A9D8F";
const MUTED = "#c5d4db";

export function MonthlyTrendChart({
  data,
}: {
  data: { month: string; amount: number }[];
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 4, left: -8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eef2" />
          <XAxis
            dataKey="month"
            tick={{ fill: "#6b7c93", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b7c93", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          />
          <Tooltip
            formatter={(value) => formatPKR(Number(value ?? 0))}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #dce6ec",
              fontSize: 13,
            }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke={LIME}
            strokeWidth={3}
            dot={{ fill: NAVY, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentStatusDonut({
  paid,
  pending,
}: {
  paid: number;
  pending: number;
}) {
  const data = [
    { name: "Paid", value: paid },
    { name: "Pending", value: pending },
  ];
  const colors = [TEAL, MUTED];
  const total = paid + pending || 1;

  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius="45%"
            outerRadius="70%"
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatPKR(Number(value ?? 0))}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #dce6ec",
              fontSize: 13,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Total
        </p>
        <p className="text-lg font-extrabold text-navy">
          {formatPKR(total === 1 && paid + pending === 0 ? 0 : paid + pending)}
        </p>
      </div>
    </div>
  );
}
