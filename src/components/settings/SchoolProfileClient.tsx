"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { saveSchoolProfile } from "@/app/(app)/settings/actions";
import {
  Button,
  Input,
  Label,
  Textarea,
  Card,
  PageHeader,
} from "@/components/ui";
import type { School } from "@/lib/types";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/png", "image/jpeg"]);

export function SchoolProfileClient({ school }: { school: School }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: school.name,
    address: school.address ?? "",
    contact_phone: school.contact_phone ?? "",
    contact_email: school.contact_email ?? "",
  });
  const [logoUrl, setLogoUrl] = useState(school.logo_url ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onLogoSelected(file: File | null) {
    setError("");
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setLogoFile(null);
    if (!file) return;

    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Logo must be a PNG or JPG image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo must be 2 MB or smaller.");
      return;
    }

    setLogoFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadLogo(
    supabase: ReturnType<typeof createClient>,
    file: File
  ): Promise<string> {
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${school.id}/logo.${ext}`;
    const other = `${school.id}/logo.${ext === "png" ? "jpg" : "png"}`;

    // Clear sibling extension so only one logo object remains
    await supabase.storage.from("school-logos").remove([other]);

    const { error: uploadError } = await supabase.storage
      .from("school-logos")
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) throw new Error(uploadError.message);

    const { data } = supabase.storage.from("school-logos").getPublicUrl(path);
    // Bust browser/CDN cache after replace
    return `${data.publicUrl}?v=${Date.now()}`;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    setError("");
    const supabase = createClient();

    try {
      let nextLogoUrl: string | null = logoUrl || null;

      if (logoFile) {
        nextLogoUrl = await uploadLogo(supabase, logoFile);
      }

      const result = await saveSchoolProfile({
        schoolId: school.id,
        name: form.name.trim(),
        address: form.address.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        logo_url: nextLogoUrl,
      });

      if (!result.ok) {
        throw new Error(
          result.error ||
            "Failed to save — please try again or contact support"
        );
      }

      setLogoUrl(result.logo_url ?? nextLogoUrl ?? "");
      setLogoFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setMsg("School profile updated.");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save — please try again or contact support"
      );
    } finally {
      setSaving(false);
    }
  }

  const displayPreview = previewUrl || logoUrl || null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="School Profile"
        description="Used on receipts and vouchers"
        actions={
          <Link href="/settings/export" className="w-full sm:w-auto">
            <Button variant="navy" className="w-full sm:w-auto">
              Data Export
            </Button>
          </Link>
        }
      />

      <Card className="max-w-2xl p-4 sm:p-6">
        <form onSubmit={save} className="space-y-4">
          <div>
            <Label>School Name</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Phone</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_phone: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>School Contact Email</Label>
              <Input
                type="email"
                value={form.contact_email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contact_email: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <Label>Address</Label>
            <Textarea
              rows={3}
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </div>

          <div>
            <Label>School Logo</Label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-sidebar">
                {displayPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayPreview}
                    alt="School logo preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="px-2 text-center text-[11px] text-muted">
                    No logo
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) =>
                    onLogoSelected(e.target.files?.[0] ?? null)
                  }
                />
                <p className="text-xs text-muted">
                  PNG or JPG, max 2 MB. Replaces the current logo on save.
                </p>
                {logoFile ? (
                  <p className="text-xs font-medium text-navy">
                    Selected: {logoFile.name} (
                    {(logoFile.size / 1024).toFixed(0)} KB)
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          {msg ? (
            <p className="rounded-lg bg-teal/10 px-3 py-2 text-sm text-teal">
              {msg}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="primary"
            className="w-full sm:w-auto"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Profile"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
