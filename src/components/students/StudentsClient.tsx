"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Button,
  Input,
  Select,
  Label,
  Card,
  Badge,
  PageHeader,
  TableWrap,
  EmptyState,
} from "@/components/ui";
import { formatDate, formatPKR } from "@/lib/utils";
import type { Student, StudentStatus } from "@/lib/types";
import { CLASS_OPTIONS, SECTION_OPTIONS } from "@/lib/types";
import { useAppSession } from "@/components/providers/AppSessionProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const emptyForm = {
  name: "",
  father_name: "",
  class: "1",
  section: "A",
  gr_no: "",
  admission_date: new Date().toISOString().slice(0, 10),
  monthly_tuition_fee: "",
  status: "active" as StudentStatus,
};

export function StudentsClient({
  initialStudents,
}: {
  initialStudents: Student[];
}) {
  const { schoolId: sessionSchoolId } = useAppSession();
  const schoolId = sessionSchoolId!;
  const router = useRouter();
  const [students, setStudents] = useState(initialStudents);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (classFilter && s.class !== classFilter) return false;
      if (sectionFilter && s.section !== sectionFilter) return false;
      if (!q) return true;
      const hay = `${s.name} ${s.father_name} ${s.gr_no}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [students, q, classFilter, sectionFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setForm({
      name: s.name,
      father_name: s.father_name,
      class: s.class,
      section: s.section,
      gr_no: s.gr_no,
      admission_date: s.admission_date,
      monthly_tuition_fee: String(s.monthly_tuition_fee),
      status: s.status,
    });
    setError("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();

    // Matches students table columns:
    // school_id, gr_no, name, father_name, class, section,
    // monthly_tuition_fee, admission_date, status
    const payload = {
      school_id: schoolId,
      gr_no: form.gr_no.trim(),
      name: form.name.trim(),
      father_name: form.father_name.trim(),
      class: form.class,
      section: form.section,
      monthly_tuition_fee: Number(form.monthly_tuition_fee) || 0,
      admission_date: form.admission_date,
      status: form.status,
    };

    if (editing) {
      const { data, error: err } = await supabase
        .from("students")
        .update(payload)
        .eq("id", editing.id)
        .select()
        .single();
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      setStudents((list) => list.map((s) => (s.id === data.id ? data : s)));
    } else {
      const { data, error: err } = await supabase
        .from("students")
        .insert(payload)
        .select()
        .single();
      if (err) {
        setError(err.message);
        setSaving(false);
        return;
      }
      setStudents((list) => [data, ...list]);
    }

    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  async function remove(s: Student) {
    setDeleting(true);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("students")
      .delete()
      .eq("id", s.id);
    setDeleting(false);
    if (err) {
      setError(err.message);
      setPendingDelete(null);
      return;
    }
    setStudents((list) => list.filter((x) => x.id !== s.id));
    setPendingDelete(null);
    router.refresh();
  }

  const statusTone = (st: StudentStatus) =>
    st === "active" ? "teal" : st === "graduated" ? "navy" : "muted";

  return (
    <div className="pb-16 lg:pb-0">
      <PageHeader
        title="Student Manager"
        description="Add, edit, and filter students by class & section"
        actions={
          <Button variant="primary" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Student
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search name, father, GR no."
              value={q}
              onChange={(e) => setQ(e.target.value)}
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
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-sidebar/50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Father</th>
                <th className="px-4 py-3 font-semibold">Class</th>
                <th className="px-4 py-3 font-semibold">GR No.</th>
                <th className="px-4 py-3 font-semibold">Fee</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Admitted</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState message="No students match your filters." />
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-sidebar/30">
                    <td className="px-4 py-3 font-semibold text-navy">
                      {s.name}
                    </td>
                    <td className="px-4 py-3">{s.father_name}</td>
                    <td className="px-4 py-3">
                      {s.class}-{s.section}
                    </td>
                    <td className="px-4 py-3">{s.gr_no}</td>
                    <td className="px-4 py-3">
                      {formatPKR(s.monthly_tuition_fee)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(s.status)}>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{formatDate(s.admission_date)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          className="rounded-lg p-1.5 hover:bg-sidebar"
                          onClick={() => openEdit(s)}
                        >
                          <Pencil className="h-4 w-4 text-navy" />
                        </button>
                        <button
                          className="rounded-lg p-1.5 hover:bg-danger/10"
                          onClick={() => setPendingDelete(s)}
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 sm:items-center animate-fade-in">
          <Card className="w-full max-w-lg p-6 animate-fade-up max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-extrabold text-navy">
              {editing ? "Edit Student" : "Add Student"}
            </h2>
            <form onSubmit={save} className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Student Name</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Father Name</Label>
                  <Input
                    required
                    value={form.father_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, father_name: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Class</Label>
                  <Select
                    value={form.class}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, class: e.target.value }))
                    }
                  >
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Section</Label>
                  <Select
                    value={form.section}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, section: e.target.value }))
                    }
                  >
                    {SECTION_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>GR No.</Label>
                  <Input
                    required
                    value={form.gr_no}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, gr_no: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Admission Date</Label>
                  <Input
                    type="date"
                    required
                    value={form.admission_date}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        admission_date: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label>Monthly Tuition Fee (PKR)</Label>
                  <Input
                    type="number"
                    min={0}
                    required
                    value={form.monthly_tuition_fee}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        monthly_tuition_fee: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as StudentStatus,
                    }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="graduated">Graduated</option>
                  <option value="left">Left</option>
                </Select>
              </div>
              {error ? (
                <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this student?"
        description={
          pendingDelete
            ? `Delete ${pendingDelete.name}? This action cannot be undone.`
            : null
        }
        confirmLabel="Delete"
        confirming={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => {
          if (pendingDelete) void remove(pendingDelete);
        }}
      />
    </div>
  );
}
