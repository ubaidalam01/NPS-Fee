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
} from "@/components/ui";
import {
  formatPKR,
  formatMonth,
  fromMonthInput,
  monthInputValue,
  schoolCodeFromId,
} from "@/lib/utils";
import type { Student, FeeHead } from "@/lib/types";
import { CLASS_OPTIONS, SECTION_OPTIONS } from "@/lib/types";
import { printReceipt } from "@/lib/receipt";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { showAppAlert } from "@/lib/app-alert";

type StructureRow = {
  class: string;
  fee_head_id: string;
  amount: number;
};

type ExistingVoucher = {
  id: string;
  student_id: string;
  status: string;
  total_amount: number;
  voucher_no: string;
  /** Always yyyy-MM-dd (1st of month), same as fee_vouchers.billing_month */
  billing_month: string;
};

/** Normalize DB date / timestamptz / yyyy-MM-dd to yyyy-MM-dd for comparisons. */
function toBillingMonthKey(value: string): string {
  return value.slice(0, 10);
}

export function FeeCollectionClient({
  students,
  feeHeads,
  structure,
  initialVouchers,
}: {
  students: Student[];
  feeHeads: FeeHead[];
  structure: StructureRow[];
  initialVouchers: ExistingVoucher[];
}) {
  const session = useAppSession();
  const schoolId = session.schoolId!;
  const schoolName = session.schoolName ?? "School";
  const schoolLogoUrl = session.schoolLogoUrl;
  const schoolAddress = session.schoolAddress;
  const schoolPhone = session.schoolPhone;
  const [billingMonth, setBillingMonth] = useState(monthInputValue());
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [vouchers, setVouchers] = useState<ExistingVoucher[]>(() =>
    initialVouchers.map((v) => ({
      ...v,
      billing_month: toBillingMonthKey(
        v.billing_month ?? `${monthInputValue()}-01`
      ),
    }))
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingCollect, setPendingCollect] = useState<{
    student: Student;
    voucher: ExistingVoucher;
  } | null>(null);

  const monthDate = fromMonthInput(billingMonth);
  const monthKey = toBillingMonthKey(monthDate);

  function voucherForStudent(studentId: string) {
    return vouchers.find(
      (v) =>
        v.student_id === studentId &&
        toBillingMonthKey(v.billing_month) === monthKey
    );
  }

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== "active") return false;
      if (classFilter && s.class !== classFilter) return false;
      if (sectionFilter && s.section !== sectionFilter) return false;
      return true;
    });
  }, [students, classFilter, sectionFilter]);

  const structureByClassHead = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of structure) {
      map.set(`${row.class}::${row.fee_head_id}`, Number(row.amount));
    }
    return map;
  }, [structure]);

  function amountForStudent(s: Student) {
    let total = 0;
    const items: { fee_head_id: string; fee_head_name: string; amount: number }[] =
      [];
    for (const head of feeHeads) {
      if (head.frequency === "non_recurring") continue;
      let amount = structureByClassHead.get(`${s.class}::${head.id}`) ?? 0;
      if (head.name.toLowerCase().includes("tuition") && s.monthly_tuition_fee > 0) {
        amount = Number(s.monthly_tuition_fee);
      }
      if (amount > 0) {
        items.push({
          fee_head_id: head.id,
          fee_head_name: head.name,
          amount,
        });
        total += amount;
      }
    }
    return { total, items };
  }

  async function generateVouchers() {
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const code = schoolCodeFromId(schoolId);
    const monthKey = toBillingMonthKey(monthDate);
    const failures: string[] = [];

    // One query for existing vouchers this month (replaces per-student selects)
    const [{ data: existingRows, error: existingErr }, { count }] =
      await Promise.all([
        supabase
          .from("fee_vouchers")
          .select(
            "id, student_id, status, total_amount, voucher_no, billing_month"
          )
          .eq("school_id", schoolId)
          .eq("billing_month", monthDate),
        supabase
          .from("fee_vouchers")
          .select("id", { count: "exact", head: true })
          .eq("school_id", schoolId),
      ]);

    if (existingErr) {
      setMessage(existingErr.message);
      setBusy(false);
      return;
    }

    const existingByStudent = new Set<string>();
    for (const row of existingRows ?? []) {
      existingByStudent.add(row.student_id);
    }
    for (const v of vouchers) {
      if (toBillingMonthKey(v.billing_month) === monthKey) {
        existingByStudent.add(v.student_id);
      }
    }

    // Keep local list in sync with DB for this month
    if (existingRows) {
      setVouchers((prev) => {
        const otherMonths = prev.filter(
          (v) => toBillingMonthKey(v.billing_month) !== monthKey
        );
        const monthRows = existingRows.map((v) => ({
          ...v,
          billing_month: toBillingMonthKey(v.billing_month ?? monthDate),
        }));
        return [...otherMonths, ...monthRows];
      });
    }

    let seq = (count ?? 0) + 1;
    const toInsert: {
      school_id: string;
      student_id: string;
      voucher_no: string;
      billing_month: string;
      total_amount: number;
      status: "unpaid";
    }[] = [];
    /** Fee heads per student for voucher_items after insert */
    const itemsByStudent = new Map<
      string,
      { fee_head_id: string; fee_head_name: string; amount: number }[]
    >();

    for (const s of filteredStudents) {
      if (existingByStudent.has(s.id)) continue;

      const { total, items } = amountForStudent(s);
      if (total <= 0) {
        failures.push(
          `${s.name}: zero fees (no recurring amounts for this class)`
        );
        continue;
      }

      const voucher_no = `V${code}${new Date().getFullYear().toString().slice(-2)}${String(seq).padStart(5, "0")}`;
      seq += 1;
      toInsert.push({
        school_id: schoolId,
        student_id: s.id,
        voucher_no,
        billing_month: monthDate,
        total_amount: total,
        status: "unpaid",
      });
      itemsByStudent.set(s.id, items);
    }

    if (toInsert.length === 0) {
      if (failures.length) {
        setMessage(`No vouchers generated. ${failures.join("; ")}`);
      } else {
        setMessage(
          "No new vouchers to generate (already exist for this month)."
        );
      }
      setBusy(false);
      return;
    }

    // Single bulk insert instead of one insert per student
    const { data: inserted, error: insertError } = await supabase
      .from("fee_vouchers")
      .insert(toInsert)
      .select(
        "id, student_id, status, total_amount, voucher_no, billing_month"
      );

    if (insertError || !inserted) {
      setMessage(
        insertError?.message ?? "Bulk voucher insert failed. Please try again."
      );
      setBusy(false);
      return;
    }

    const itemRows = inserted.flatMap((voucher) => {
      const items = itemsByStudent.get(voucher.student_id) ?? [];
      return items.map((item) => ({
        voucher_id: voucher.id,
        school_id: schoolId,
        fee_head_id: item.fee_head_id,
        fee_head_name: item.fee_head_name,
        amount: item.amount,
      }));
    });

    if (itemRows.length > 0) {
      const { error: itemsError } = await supabase
        .from("voucher_items")
        .insert(itemRows);
      if (itemsError) {
        failures.push(`Line items: ${itemsError.message}`);
      }
    }

    setVouchers((prev) => [
      ...prev,
      ...inserted.map((voucher) => ({
        ...voucher,
        billing_month: toBillingMonthKey(voucher.billing_month ?? monthDate),
      })),
    ]);

    const suffix = failures.length
      ? ` Some issues: ${failures.join("; ")}`
      : "";
    setMessage(
      `Generated ${inserted.length} voucher(s) for ${formatMonth(monthDate)}.${suffix}`
    );
    setBusy(false);
    // Local vouchers list is already updated — skip router.refresh() so a
    // stale RSC payload cannot wipe newly created rows from the UI.
  }

  async function collectPayment(student: Student, voucher: ExistingVoucher) {
    setBusy(true);
    setPendingCollect(null);
    const supabase = createClient();
    const code = schoolCodeFromId(schoolId);
    const { count } = await supabase
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId);
    const receipt_no = `R${code}${new Date().getFullYear().toString().slice(-2)}${String((count ?? 0) + 1).padStart(5, "0")}`;

    // Matches payments columns: school_id, voucher_id, receipt_no, amount
    // (+ paid_at / is_voided defaults on the server when omitted)
    const paymentPayload = {
      school_id: schoolId,
      voucher_id: voucher.id,
      receipt_no,
      amount: voucher.total_amount,
      paid_at: new Date().toISOString(),
      is_voided: false,
    };

    const { data: payment, error } = await supabase
      .from("payments")
      .insert(paymentPayload)
      .select()
      .single();

    if (error || !payment) {
      showAppAlert(error?.message ?? "Payment failed", "Payment failed");
      setBusy(false);
      return;
    }

    const { data: updatedVoucher, error: voucherError } = await supabase
      .from("fee_vouchers")
      .update({ status: "paid" })
      .eq("id", voucher.id)
      .select("id, student_id, status, total_amount, voucher_no, billing_month")
      .single();

    if (voucherError || !updatedVoucher) {
      showAppAlert(
        voucherError?.message ??
          "Payment recorded but voucher status did not update. Refresh and check Payment History.",
        "Voucher update failed"
      );
    }

    // Flip badge immediately from local state (source of truth on this page)
    setVouchers((list) => {
      const paidRow = {
        ...(updatedVoucher ?? voucher),
        status: "paid" as const,
        billing_month: toBillingMonthKey(
          (updatedVoucher ?? voucher).billing_month ?? monthDate
        ),
      };
      const exists = list.some((v) => v.id === voucher.id);
      if (exists) {
        return list.map((v) => (v.id === voucher.id ? paidRow : v));
      }
      return [...list, paidRow];
    });

    setBusy(false);

    const computed = amountForStudent(student);
    const [{ data: schoolRow }, { data: voucherItemRows }] = await Promise.all([
      supabase
        .from("schools")
        .select("name, logo_url, address, contact_phone")
        .eq("id", schoolId)
        .maybeSingle(),
      supabase
        .from("voucher_items")
        .select("fee_head_name, amount")
        .eq("voucher_id", voucher.id)
        .order("fee_head_name"),
    ]);

    // Persist line items for older vouchers that were created before items existed
    let receiptItems =
      voucherItemRows?.map((row) => ({
        name: row.fee_head_name,
        amount: Number(row.amount),
      })) ?? [];

    if (receiptItems.length === 0 && computed.items.length > 0) {
      receiptItems = computed.items.map((i) => ({
        name: i.fee_head_name,
        amount: i.amount,
      }));
      await supabase.from("voucher_items").insert(
        computed.items.map((i) => ({
          voucher_id: voucher.id,
          school_id: schoolId,
          fee_head_id: i.fee_head_id,
          fee_head_name: i.fee_head_name,
          amount: i.amount,
        }))
      );
    }

    if (receiptItems.length === 0) {
      receiptItems = [{ name: "Fee payment", amount: Number(payment.amount) }];
    }

    printReceipt({
      schoolName: schoolRow?.name ?? schoolName,
      schoolLogoUrl: schoolRow?.logo_url ?? schoolLogoUrl,
      schoolAddress: schoolRow?.address ?? schoolAddress,
      schoolPhone: schoolRow?.contact_phone ?? schoolPhone,
      receiptNo: receipt_no,
      voucherNo: voucher.voucher_no,
      studentName: student.name,
      fatherName: student.father_name,
      className: student.class,
      section: student.section,
      rollNo: student.gr_no,
      billingMonth: monthDate,
      amount: Number(payment.amount),
      paidAt: payment.paid_at,
      items: receiptItems,
    });
  }

  // Load vouchers for selected month from server props — refresh when month changes via reload
  async function loadMonthVouchers() {
    setBusy(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("fee_vouchers")
      .select("id, student_id, status, total_amount, voucher_no, billing_month")
      .eq("school_id", schoolId)
      .eq("billing_month", monthDate);
    setVouchers(
      (data ?? []).map((v) => ({
        ...v,
        billing_month: toBillingMonthKey(v.billing_month ?? monthDate),
      }))
    );
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fee Collection"
        description="Generate monthly vouchers and collect full cash payments"
      />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              type="month"
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
            />
          </div>
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
          <Button
            variant="outline"
            className="w-full"
            onClick={loadMonthVouchers}
            disabled={busy}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            className="w-full"
            onClick={generateVouchers}
            disabled={busy}
          >
            Generate Vouchers
          </Button>
        </div>
        {message ? (
          <p className="mt-3 break-words text-sm text-teal">{message}</p>
        ) : null}
      </Card>

      <Card>
        {filteredStudents.length === 0 ? (
          <EmptyState message="No active students for this filter." />
        ) : (
          <>
            <ul className="divide-y divide-border/60 md:hidden">
              {filteredStudents.map((s) => {
                const voucher = voucherForStudent(s.id);
                const estimated = amountForStudent(s).total;
                return (
                  <li key={s.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-navy">
                          {s.name}
                        </p>
                        <p className="text-sm text-muted">
                          Class {s.class}-{s.section} · {s.gr_no}
                        </p>
                      </div>
                      {voucher ? (
                        <Badge
                          tone={
                            voucher.status === "paid" ? "teal" : "warning"
                          }
                        >
                          {voucher.status}
                        </Badge>
                      ) : (
                        <Badge tone="muted">No voucher</Badge>
                      )}
                    </div>
                    <p className="text-sm font-bold text-navy">
                      {formatPKR(voucher?.total_amount ?? estimated)}
                    </p>
                    {voucher?.status === "unpaid" ? (
                      <Button
                        variant="primary"
                        className="w-full"
                        disabled={busy}
                        onClick={() =>
                          setPendingCollect({ student: s, voucher })
                        }
                      >
                        Collect (Cash)
                      </Button>
                    ) : voucher?.status === "paid" ? (
                      <p className="text-sm font-semibold text-teal">Paid</p>
                    ) : (
                      <p className="text-sm text-muted">Generate voucher first</p>
                    )}
                  </li>
                );
              })}
            </ul>

            <TableWrap className="hidden md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-sidebar/50 text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Class</th>
                    <th className="px-4 py-3 font-semibold">GR No.</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredStudents.map((s) => {
                    const voucher = voucherForStudent(s.id);
                    const estimated = amountForStudent(s).total;
                    return (
                      <tr key={s.id} className="hover:bg-sidebar/30">
                        <td className="px-4 py-3 font-semibold">{s.name}</td>
                        <td className="px-4 py-3">
                          {s.class}-{s.section}
                        </td>
                        <td className="px-4 py-3">{s.gr_no}</td>
                        <td className="px-4 py-3">
                          {formatPKR(voucher?.total_amount ?? estimated)}
                        </td>
                        <td className="px-4 py-3">
                          {voucher ? (
                            <Badge
                              tone={
                                voucher.status === "paid" ? "teal" : "warning"
                              }
                            >
                              {voucher.status}
                            </Badge>
                          ) : (
                            <Badge tone="muted">No voucher</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {voucher?.status === "unpaid" ? (
                            <Button
                              size="sm"
                              variant="primary"
                              disabled={busy}
                              onClick={() =>
                                setPendingCollect({ student: s, voucher })
                              }
                            >
                              Collect (Cash)
                            </Button>
                          ) : voucher?.status === "paid" ? (
                            <span className="text-xs font-semibold text-teal">
                              Paid
                            </span>
                          ) : (
                            <span className="text-xs text-muted">
                              Generate first
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(pendingCollect)}
        title="Collect this payment?"
        description={
          pendingCollect ? (
            <>
              Collect full cash payment of{" "}
              <span className="font-semibold text-navy">
                {formatPKR(pendingCollect.voucher.total_amount)}
              </span>{" "}
              for{" "}
              <span className="font-semibold text-navy">
                {pendingCollect.student.name}
              </span>
              ? This marks the voucher as paid and prints a receipt.
            </>
          ) : null
        }
        confirmLabel="Collect"
        cancelLabel="Cancel"
        variant="primary"
        confirming={busy}
        onCancel={() => {
          if (!busy) setPendingCollect(null);
        }}
        onConfirm={() => {
          if (pendingCollect) {
            void collectPayment(
              pendingCollect.student,
              pendingCollect.voucher
            );
          }
        }}
      />
    </div>
  );
}
