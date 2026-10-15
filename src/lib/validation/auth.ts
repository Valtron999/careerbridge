import { z } from 'zod';

export const signupSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters').max(72),
  account_type: z.enum(['candidate', 'employer']),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address') });
export type SignupInput = z.infer<typeof signupSchema>;

export const updatePasswordSchema = z.object({
  password: z.string().min(8, 'Use at least 8 characters').max(72, 'Use 72 characters or fewer'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'The two passwords do not match' });
