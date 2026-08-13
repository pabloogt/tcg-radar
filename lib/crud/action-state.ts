import type { ZodError } from "zod";

export type ActionState = {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
};

export const initialActionState: ActionState = { error: null };

export function validationState(error: ZodError): ActionState {
  const flattened = error.flatten();
  return {
    error: "Revisa los campos marcados.",
    fieldErrors: flattened.fieldErrors as Record<string, string[]>,
  };
}

export function databaseErrorState(message = "No se pudo guardar. Inténtalo de nuevo."): ActionState {
  return { error: message };
}
