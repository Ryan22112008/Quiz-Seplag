import { z } from 'zod';

/**
 * Shared form primitives (Zod).
 * Format validation only — no API, no business rules in this step.
 */
export const baseTextSchema = z.string().trim().min(1, 'Campo obrigatório');

/** Room PIN format defined for the product: 4 to 6 numeric digits. */
export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 6;

/** Keeps only digits and respects the maximum PIN length (typed or pasted). */
export function onlyDigits(value: string, maxLength: number = PIN_MAX_LENGTH): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export const joinGameSchema = z.object({
  pin: z
    .string()
    .trim()
    .min(1, 'Digite o PIN da partida')
    .regex(/^\d+$/, 'O PIN deve conter apenas números')
    .refine((pin) => pin.length >= PIN_MIN_LENGTH, {
      message: `O PIN deve ter pelo menos ${PIN_MIN_LENGTH} números`,
    }),
});

export type JoinGameValues = z.infer<typeof joinGameSchema>;

export { z };
