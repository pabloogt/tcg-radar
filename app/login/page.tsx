import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-7">
          <span className="mb-5 grid size-10 place-items-center rounded-xl bg-emerald-600 text-sm font-bold text-white">TR</span>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to your private TCG Radar dashboard.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
