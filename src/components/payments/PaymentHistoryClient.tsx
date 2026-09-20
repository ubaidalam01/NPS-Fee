"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  Select,
  Card,
  PageHeader,
  TableWrap,
  Badge,
  EmptyState,
  Label,
  Textarea,
} from "@/components/ui";
import { formatPKR, formatDate, formatMonth } from "@/lib/utils";
import { printReceipt } from "@/lib/receipt";
import { CLASS_OPTIONS, SECTION_OPTIONS } from "@/lib/types";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";

type Row = {
  id: string;
  receipt_no: string;
  amount: number;
  paid_at: string;
  is_voided: boolean;
  voided_at: string | null;
  voucher_id: string;
  students: {
    name: string;
    father_name: string;
    class: string;
    section: string;
    gr_no: string;
  } | null;
  fee_vouchers: {
    voucher_no: string;
    billing_month: string;
  } | null;
};

export function PaymentHistoryClient({
  initialPayments,
}: {
  initialPayments: Row[];
}) {
  const session = useAppSession();
  const schoolId = session.schoolId!;
  const schoolName = session.schoolName ?? "School";
  const schoolLogoUrl = session.schoolLogoUrl;
  const schoolAddress = session.schoolAddress;
  const schoolPhone = session.schoolPhone;
  const [payments, setPayments] = useState(initialPayments);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [voiding, setVoiding] = useState<Row | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [voidError, setVoidError] = useState("");

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const s = p.students;
      if (classFilter && s?.class !== classFilter) return false;
      if (sectionFilter && s?.section !== sectionFilter) return false;
      if (from && p.paid_at < from) return false;
      if (to && p.paid_at > `${to}T23:59:59`) return false;
      return true;
    });
  }, [payments, from, to, classFilter, sectionFilter]);

  async function reprint(p: Row) {
    const s = p.students;
    const v = p.fee_vouchers;
    if (!s || !v) return;

    const supabase = createClient();
    const [{ data: schoolRow }, { data: voucherItemRows }] = await Promise.all([
      supabase
        .from("schools")
        .select("name, logo_url, address, contact_phone")
        .eq("id", schoolId)
        .maybeSingle(),
      supabase
        .from("voucher_items")
        .select("fee_head_name, amount")
        .eq("voucher_id", p.voucher_id)
        .order("fee_head_name"),
    ]);

    let items =
      voucherItemRows && voucherItemRows.length > 0
        ? voucherItemRows.map((row) => ({
            name: row.fee_head_name,
            amount: Number(row.amount),
          }))
        : [];

    // Older vouchers may lack line items — rebuild from fee structure
    if (items.length === 0) {
      const [{ data: heads }, { data: structureRows }, { data: voucherStudent }] =
        await Promise.all([
          supabase
            .from("fee_heads")
            .select("id, name, frequency")
            .eq("school_id", schoolId),
          supabase
            .from("class_fee_structures")
            .select("fee_head_id, amount")
            .eq("school_id", schoolId)
            .eq("class", s.class),
          supabase
            .from("fee_vouchers")
            .select("students(monthly_tuition_fee)")
            .eq("id", p.voucher_id)
            .maybeSingle(),
        ]);

      const tuitionRaw = voucherStudent?.students;
      const tuitionStudent = Array.isArray(tuitionRaw)
        ? tuitionRaw[0]
        : tuitionRaw;
      const tuition = Number(tuitionStudent?.monthly_tuition_fee ?? 0);

      const rebuilt: {
        fee_head_id: string | null;
        fee_head_name: string;
        amount: number;
      }[] = [];

      for (const head of heads ?? []) {
        if (head.frequency === "non_recurring") continue;
        const row = structureRows?.find((r) => r.fee_head_id === head.id);
        let amount = Number(row?.amount ?? 0);
        if (head.name.toLowerCase().includes("tuition") && tuition > 0) {
          amount = tuition;
        }
        if (amount > 0) {
          rebuilt.push({
            fee_head_id: head.id,
            fee_head_name: head.name,
            amount,
          });
        }
      }

      if (rebuilt.length > 0) {
        items = rebuilt.map((r) => ({
          name: r.fee_head_name,
          amount: r.amount,
        }));
        await supabase.from("voucher_items").insert(
          rebuilt.map((r) => ({
            voucher_id: p.voucher_id,
            school_id: schoolId,
            fee_head_id: r.fee_head_id,
            fee_head_name: r.fee_head_name,
            amount: r.amount,
          }))
        );
      }
    }

    if (items.length === 0) {
      items = [{ name: "Fee payment", amount: Number(p.amount) }];
    }

    printReceipt({
      schoolName: schoolRow?.name ?? schoolName,
      schoolLogoUrl: schoolRow?.logo_url ?? schoolLogoUrl,
      schoolAddress: schoolRow?.address ?? schoolAddress,
      schoolPhone: schoolRow?.contact_phone ?? schoolPhone,
      receiptNo: p.receipt_no,
      voucherNo: v.voucher_no,
      studentName: s.name,
      fatherName: s.father_name,
      className: s.class,
      section: s.section,
      rollNo: s.gr_no,
      billingMonth: v.billing_month,
      amount: Number(p.amount),
      paidAt: p.paid_at,
      items,
    });
  }

  async function confirmVoid() {
    if (!voiding || !reason.trim()) return;
    setBusy(true);
    setVoidError("");
    const supabase = createClient();

    const { error } = await supabase
      .from("payments")
      .update({
        is_voided: true,
        voided_at: new Date().toISOString(),
      })
      .eq("id", voiding.id);

    if (error) {
      setVoidError(error.message);
      setBusy(false);
      return;
    }

    await supabase
      .from("fee_vouchers")
      .update({ status: "unpaid" })
      .eq("id", voiding.voucher_id);

    setPayments((list) =>
      list.map((p) =>
        p.id === voiding.id
          ? { ...p, is_voided: true, voided_at: new Date().toISOString() }
          : p
      )
    );
    setVoiding(null);
    setReason("");
    setBusy(false);
    // Local payments list already updated — avoid refresh remount wiping void state
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment History"
        description="Filter receipts, reprint PDF, or void a payment"
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="From"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Select
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
          <Select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
          >
            <option value="">All sections</option>
            {SECTION_OPTIONS.map((s) => (
              <option key={s} value={s}>
                Section {s}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState message="No payments found." />
        ) : (
          <>
            <ul className="divide-y divide-border/60 md:hidden">
              {filtered.map((p) => (
                <li key={p.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">
                        {p.students?.name ?? "—"}
                      </p>
                      <p className="text-sm text-muted">{p.receipt_no}</p>
                    </div>
                    <Badge tone={p.is_voided ? "danger" : "teal"}>
                      {p.is_voided ? "voided" : "paid"}
                    </Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted">Class</dt>
                      <dd className="font-medium">
                        {p.students?.class}-{p.students?.section}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Month</dt>
                      <dd className="font-medium">
                        {p.fee_vouchers
                          ? formatMonth(p.fee_vouchers.billing_month)
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Amount</dt>
                      <dd className="font-bold text-navy">
                        {formatPKR(p.amount)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Date</dt>
                      <dd className="font-medium">{formatDate(p.paid_at)}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11 w-full sm:flex-1"
                      onClick={() => reprint(p)}
                    >
                      Reprint
                    </Button>
                    {!p.is_voided ? (
                      <Button
                        size="sm"
                        variant="danger"
                        className="min-h-11 w-full sm:flex-1"
                        onClick={() => {
                          setVoidError("");
                          setReason("");
                          setVoiding(p);
                        }}
                      >
                        Void
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <TableWrap className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-sidebar/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Receipt</th>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">Month</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-sidebar/30">
                      <td className="px-4 py-3 font-semibold">{p.receipt_no}</td>
                      <td className="px-4 py-3">{p.students?.name}</td>
                      <td className="px-4 py-3">
                        {p.students?.class}-{p.students?.section}
                      </td>
                      <td className="px-4 py-3">
                        {p.fee_vouchers
                          ? formatMonth(p.fee_vouchers.billing_month)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">{formatPKR(p.amount)}</td>
                      <td className="px-4 py-3">{formatDate(p.paid_at)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={p.is_voided ? "danger" : "teal"}>
                          {p.is_voided ? "voided" : "paid"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reprint(p)}
                          >
                            Reprint
                          </Button>
                          {!p.is_voided ? (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                setVoidError("");
                                setReason("");
                                setVoiding(p);
                              }}
                            >
                              Void
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(voiding)}
        title="Void this payment?"
        description={
          voiding ? (
            <>
              This will reverse receipt{" "}
              <span className="font-semibold text-navy">
                {voiding.receipt_no}
              </span>{" "}
              and mark the voucher as unpaid again. The payment record is kept
              as voided for audit.
            </>
          ) : null
        }
        confirmLabel="Void"
        confirming={busy}
        confirmDisabled={!reason.trim()}
        onCancel={() => {
          if (busy) return;
          setVoiding(null);
          setReason("");
          setVoidError("");
        }}
        onConfirm={() => void confirmVoid()}
      >
        <div>
          <Label>Reason</Label>
          <Textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Wrong amount / wrong student / duplicate…"
            disabled={busy}
          />
          {voidError ? (
            <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {voidError}
            </p>
          ) : null}
        </div>
      </ConfirmDialog>
    </div>
  );
}
