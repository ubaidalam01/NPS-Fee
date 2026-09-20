"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, PageHeader } from "@/components/ui";
import { downloadBlob, toCsv } from "@/lib/utils";
import { useAppSession } from "@/components/providers/AppSessionProvider";

export function ExportClient() {
  const { schoolId } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function fetchAll() {
    const id = schoolId!;
    const supabase = createClient();
    const [students, feeHeads, feeStructure, vouchers, payments] =
      await Promise.all([
        supabase.from("students").select("*").eq("school_id", id),
        supabase.from("fee_heads").select("*").eq("school_id", id),
        supabase.from("class_fee_structures").select("*").eq("school_id", id),
        supabase.from("fee_vouchers").select("*").eq("school_id", id),
        supabase.from("payments").select("*").eq("school_id", id),
      ]);
    return {
      students: students.data ?? [],
      fee_heads: feeHeads.data ?? [],
      class_fee_structures: feeStructure.data ?? [],
      fee_vouchers: vouchers.data ?? [],
      payments: payments.data ?? [],
    };
  }

  async function exportCsv() {
    setBusy(true);
    setMsg("");
    try {
      const data = await fetchAll();
      const parts = Object.entries(data).map(([name, rows]) => {
        const csv = toCsv(rows as Record<string, unknown>[]);
        return `### ${name}\n${csv}`;
      });
      const blob = new Blob([parts.join("\n\n")], {
        type: "text/csv;charset=utf-8",
      });
      downloadBlob(blob, `school-export-${schoolId!.slice(0, 8)}.csv`);
      setMsg("CSV download started.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Export failed");
    }
    setBusy(false);
  }

  async function exportExcel() {
    setBusy(true);
    setMsg("");
    try {
      const data = await fetchAll();
      const wb = XLSX.utils.book_new();
      for (const [name, rows] of Object.entries(data)) {
        const ws = XLSX.utils.json_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
      }
      const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBlob(blob, `school-export-${schoolId!.slice(0, 8)}.xlsx`);
      setMsg("Excel download started.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Export failed");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Export"
        description="One-click download of your school's own data"
      />
      <Card className="max-w-lg space-y-4 p-4 sm:p-6">
        <p className="text-sm text-muted">
          Exports students, fee heads, fee structure, vouchers, and payments for
          this school only.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="primary"
            className="w-full sm:w-auto"
            onClick={exportExcel}
            disabled={busy}
          >
            Download Excel
          </Button>
          <Button
            variant="navy"
            className="w-full sm:w-auto"
            onClick={exportCsv}
            disabled={busy}
          >
            Download CSV
          </Button>
        </div>
        {msg ? <p className="text-sm text-teal">{msg}</p> : null}
      </Card>
    </div>
  );
}
