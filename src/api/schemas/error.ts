import { Type, Static } from '@sinclair/typebox';

export const ErrorResponseSchema = Type.Object({
  success: Type.Literal(false),
  error: Type.String(),
  timestamp: Type.String(),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;
