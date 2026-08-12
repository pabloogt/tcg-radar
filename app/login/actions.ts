"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  error: string | null;
};

export async function login(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const credentials = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    return { error: credentials.error.issues[0]?.message ?? "Invalid login details" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Supabase signInWithPassword failed", {
        message: error.message,
        code: error.code,
        status: error.status,
      });
    }

    return { error: "Incorrect email or password." };
  }

  redirect("/dashboard");
}
