"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  Select,
  Label,
  Card,
  CardHeader,
  Badge,
  PageHeader,
  TableWrap,
} from "@/components/ui";
import type { FeeHead, FeeFrequency } from "@/lib/types";
import { CLASS_OPTIONS } from "@/lib/types";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { showAppAlert } from "@/lib/app-alert";

type StructureCell = {
  id?: string;
  amount: number;
};

export function FeeStructureClient({
  initialHeads,
  initialMatrix,
}: {
  initialHeads: FeeHead[];
  initialMatrix: {
    class: string;
    fee_head_id: string;
    amount: number;
    id: string;
  }[];
}) {
  const { schoolId: sessionSchoolId } = useAppSession();
  const schoolId = sessionSchoolId!;
  const router = useRouter();
  const [heads, setHeads] = useState(initialHeads);
  const [matrix, setMatrix] = useState(() => {
    const map: Record<string, StructureCell> = {};
    for (const row of initialMatrix) {
      map[`${row.class}::${row.fee_head_id}`] = {
        id: row.id,
        amount: Number(row.amount),
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [headForm, setHeadForm] = useState({
    name: "",
    frequency: "recurring" as FeeFrequency,
  });
  const [showHead, setShowHead] = useState(false);

  const classes = useMemo(() => [...CLASS_OPTIONS], []);

  function getAmount(className: string, headId: string) {
    return matrix[`${className}::${headId}`]?.amount ?? 0;
  }

  function setAmount(className: string, headId: string, amount: number) {
    const key = `${className}::${headId}`;
    setMatrix((m) => ({
      ...m,
      [key]: { ...m[key], amount },
    }));
  }

  async function addHead(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fee_heads")
      .insert({
        school_id: schoolId,
        name: headForm.name.trim(),
        frequency: headForm.frequency,
      })
      .select("*")
      .single();
    if (error || !data) {
      showAppAlert(
        error?.message ?? "No fee head returned after save",
        "Could not add fee head"
      );
      return;
    }
    // Update local lists immediately — do not router.refresh() here; a
    // soft RSC refresh can remount this client with stale props and wipe
    // the new head from the UI even though the DB write succeeded.
    setHeads((h) => (h.some((x) => x.id === data.id) ? h : [...h, data]));
    setMatrix((m) => {
      const next = { ...m };
      for (const className of classes) {
        const key = `${className}::${data.id}`;
        if (!next[key]) next[key] = { amount: 0 };
      }
      return next;
    });
    setHeadForm({ name: "", frequency: "recurring" });
    setShowHead(false);
    setMsg(`Added fee head “${data.name}”.`);
  }

  async function saveMatrix() {
    setSaving(true);
    setMsg("");
    const supabase = createClient();
    const upserts = [];
    for (const className of classes) {
      for (const head of heads) {
        const key = `${className}::${head.id}`;
        const cell = matrix[key];
        // Matches class_fee_structures: school_id, class, fee_head_id, amount
        upserts.push({
          school_id: schoolId,
          class: className,
          fee_head_id: head.id,
          amount: cell?.amount ?? 0,
        });
      }
    }

    const { error } = await supabase
      .from("class_fee_structures")
      .upsert(upserts, { onConflict: "school_id,class,fee_head_id" });

    if (error) {
      setMsg(error.message);
    } else {
      setMsg("Fee structure saved.");
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fee Structure"
        description="Class fee matrix and fee heads"
        actions={
          <>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setShowHead(true)}
            >
              <Plus className="h-4 w-4" />
              Fee Head
            </Button>
            <Button
              variant="primary"
              className="w-full sm:w-auto"
              onClick={saveMatrix}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Matrix"}
            </Button>
          </>
        }
      />

      {msg ? (
        <p className="rounded-lg bg-teal/10 px-3 py-2 text-sm text-teal">
          {msg}
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="Fee Heads"
          subtitle="Defaults: Tuition (recurring), Exam (non-recurring)"
        />
        <div className="flex flex-wrap gap-2 p-4 sm:p-5">
          {heads.map((h) => (
            <Badge
              key={h.id}
              tone={h.frequency === "recurring" ? "teal" : "navy"}
            >
              {h.name} ·{" "}
              {h.frequency === "recurring" ? "Recurring" : "Non-recurring"}
            </Badge>
          ))}
          {heads.length === 0 ? (
            <p className="text-sm text-muted">
              No fee heads yet. Add one, or ensure the school was activated
              (seeds Tuition Fee & Exam Fee).
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Class Fee Matrix"
          subtitle="Amount (PKR) per class × fee head"
        />

        {/* Mobile: stacked per-class cards */}
        <div className="space-y-3 p-4 md:hidden">
          {heads.length === 0 ? (
            <p className="text-sm text-muted">Add a fee head to edit amounts.</p>
          ) : (
            classes.map((c) => (
              <div
                key={c}
                className="rounded-xl border border-border/60 bg-sidebar/30 p-4"
              >
                <p className="mb-3 text-sm font-bold text-navy">Class {c}</p>
                <div className="space-y-3">
                  {heads.map((h) => (
                    <div key={h.id}>
                      <Label>{h.name}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={getAmount(c, h.id)}
                        onChange={(e) =>
                          setAmount(c, h.id, Number(e.target.value) || 0)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop / tablet: scrollable matrix */}
        <TableWrap className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-sidebar/50 text-xs uppercase text-muted">
              <tr>
                <th className="sticky left-0 bg-sidebar/50 px-4 py-3 font-semibold">
                  Class
                </th>
                {heads.map((h) => (
                  <th
                    key={h.id}
                    className="min-w-[140px] px-4 py-3 font-semibold"
                  >
                    {h.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {classes.map((c) => (
                <tr key={c}>
                  <td className="sticky left-0 bg-card px-4 py-2 font-semibold">
                    {c}
                  </td>
                  {heads.map((h) => (
                    <td key={h.id} className="px-4 py-2">
                      <Input
                        type="number"
                        min={0}
                        value={getAmount(c, h.id)}
                        onChange={(e) =>
                          setAmount(c, h.id, Number(e.target.value) || 0)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {showHead ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 animate-fade-in sm:items-center sm:p-4">
          <Card className="w-full max-w-md rounded-b-none p-5 sm:rounded-xl sm:p-6">
            <h2 className="text-lg font-extrabold">Add Fee Head</h2>
            <form onSubmit={addHead} className="mt-4 space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  required
                  value={headForm.name}
                  onChange={(e) =>
                    setHeadForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Frequency</Label>
                <Select
                  value={headForm.frequency}
                  onChange={(e) =>
                    setHeadForm((f) => ({
                      ...f,
                      frequency: e.target.value as FeeFrequency,
                    }))
                  }
                >
                  <option value="recurring">Recurring (monthly)</option>
                  <option value="non_recurring">Non-recurring</option>
                </Select>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setShowHead(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full sm:w-auto"
                >
                  Add
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
