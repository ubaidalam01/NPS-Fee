import { Card } from "@/components/ui";
import { GraduationCap } from "lucide-react";

export default function SetupPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#d4ebef_0%,_transparent_55%),radial-gradient(ellipse_at_bottom_right,_#e8f4c8_0%,_transparent_45%)]" />
      <Card className="relative w-full max-w-lg p-8 animate-fade-up">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-navy text-lime">
          <GraduationCap className="h-6 w-6" />
        </div>
        <h1 className="text-center text-2xl font-extrabold text-navy">
          Connect Supabase
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          The app is running, but{" "}
          <code className="rounded bg-sidebar px-1.5 py-0.5 text-xs">
            .env.local
          </code>{" "}
          is missing. Add your Supabase keys, then restart{" "}
          <code className="rounded bg-sidebar px-1.5 py-0.5 text-xs">
            npm run dev
          </code>
          .
        </p>

        <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-navy">
          <li>
            Create a project at{" "}
            <a
              className="font-semibold text-teal underline"
              href="https://supabase.com"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com
            </a>
          </li>
          <li>
            Run{" "}
            <code className="rounded bg-sidebar px-1 text-xs">
              supabase/migrations/001_schema.sql
            </code>{" "}
            in the SQL Editor
          </li>
          <li>
            Bootstrap the school + admin with{" "}
            <code className="rounded bg-sidebar px-1 text-xs">
              supabase/migrations/002_bootstrap_school.sql
            </code>
          </li>
          <li>
            Copy{" "}
            <code className="rounded bg-sidebar px-1 text-xs">
              .env.local.example
            </code>{" "}
            to{" "}
            <code className="rounded bg-sidebar px-1 text-xs">.env.local</code>{" "}
            and paste URL + anon key
          </li>
          <li>Restart the dev server and open http://localhost:3000</li>
        </ol>

        <pre className="mt-6 overflow-x-auto rounded-xl bg-navy p-4 text-xs leading-relaxed text-lime">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...`}
        </pre>
      </Card>
    </div>
  );
}
