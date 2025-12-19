import { Type, Static } from '@sinclair/typebox';

export const ForkHealthSchema = Type.Object({
  status: Type.Union([
    Type.Literal('idle'),
    Type.Literal('starting'),
    Type.Literal('running'),
    Type.Literal('error'),
  ]),
  port: Type.Optional(Type.Number()),
  blockNumber: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});

export const HealthResponseSchema = Type.Object({
  status: Type.Union([Type.Literal('healthy'), Type.Literal('degraded')]),
  forks: Type.Record(Type.String(), ForkHealthSchema),
  uptime: Type.Number(),
  timestamp: Type.String(),
});

export type HealthResponse = Static<typeof HealthResponseSchema>;
