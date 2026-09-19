"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Select,
  Card,
  PageHeader,
  TableWrap,
  EmptyState,
} from "@/components/ui";
import { formatPKR, formatMonth } from "@/lib/utils";
import { CLASS_OPTIONS } from "@/lib/types";

type Row = {
  id: string;
  total_amount: number;
  billing_month: string;
  voucher_no: string;
  student_name: string;
  class: string;
  section: string;
  gr_no: string;
};

export function PendingReportClient({ rows }: { rows: Row[] }) {
  const [classFilter, setClassFilter] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = useMemo(() => {
    let list = rows.filter(
      (r) => !classFilter || r.class === classFilter
    );
    list = [...list].sort((a, b) => {
      const cmp = a.class.localeCompare(b.class, undefined, {
        numeric: true,
      });
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [rows, classFilter, sortAsc]);

  const total = filtered.reduce((a, r) => a + Number(r.total_amount), 0);

  return (
    <div className="space-y-4 pb-16 lg:pb-0">
      <PageHeader
        title="Pending Fee Report"
        description="Students with unpaid / pending dues"
        actions={
          <p className="rounded-full bg-warning/15 px-4 py-2 text-sm font-bold text-warning">
            Total pending: {formatPKR(total)}
          </p>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Select
            className="max-w-xs"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="">All classes</option>
            {CLASS_OPTIONS.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={() => setSortAsc((s) => !s)}>
            Sort by class {sortAsc ? "↑" : "↓"}
          </Button>
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-sidebar/50 text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Class</th>
                <th className="px-4 py-3 font-semibold">GR No.</th>
                <th className="px-4 py-3 font-semibold">Billing Month</th>
                <th className="px-4 py-3 font-semibold">Voucher</th>
                <th className="px-4 py-3 font-semibold">Amount Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState message="No pending dues." />
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-sidebar/30">
                    <td className="px-4 py-3 font-semibold">
                      {r.student_name}
                    </td>
                    <td className="px-4 py-3">
                      {r.class}-{r.section}
                    </td>
                    <td className="px-4 py-3">{r.gr_no}</td>
                    <td className="px-4 py-3">
                      {formatMonth(r.billing_month)}
                    </td>
                    <td className="px-4 py-3">{r.voucher_no}</td>
                    <td className="px-4 py-3 font-bold text-warning">
                      {formatPKR(r.total_amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}
