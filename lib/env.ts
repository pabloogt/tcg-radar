import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().trim().min(1),
});

const result = publicEnvSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!result.success) {
  const missingOrInvalid = result.error.issues
    .map((issue) => issue.path.join("."))
    .join(", ");

  throw new Error(
    `Missing or invalid Supabase environment configuration: ${missingOrInvalid}`,
  );
}

export const publicEnv = result.data;
