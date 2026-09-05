import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Vul een geldig e-mailadres in");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Vul je wachtwoord in"),
});

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Vul je naam in").max(80),
  email: emailSchema,
  password: z.string().min(8, "Kies een wachtwoord van minstens 8 tekens"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
