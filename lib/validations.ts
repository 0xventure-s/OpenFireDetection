import { z } from 'zod';
import { isPointInJurisdiction } from './jurisdiction';

const fireStatusSchema = z.enum([
  'unconfirmed',
  'probable',
  'confirmed',
  'false_positive',
  'extinguished',
]);

const operationalStatusSchema = z.enum([
  'unreviewed',
  'evaluating',
  'dispatched',
  'monitoring',
  'closed',
]);

const incidentPrioritySchema = z.enum(['low', 'medium', 'high', 'critical']);
const operationalUnitTypeSchema = z.enum(['engine', 'tanker', 'brush_truck', 'pickup', 'machinery', 'support', 'brigade', 'other']);
const operationalUnitStatusSchema = z.enum(['available', 'assigned', 'unavailable', 'maintenance']);
const operationalAssetTypeSchema = z.enum(['water_tank', 'water_source', 'helipad', 'station', 'staging', 'access_point', 'other']);
const operationalAssetStatusSchema = z.enum(['available', 'unavailable', 'unknown']);
const incidentAssignmentStatusSchema = z.enum(['assigned', 'en_route', 'on_scene', 'released']);
const maintenanceStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);

const lifecycleStatusSchema = z.enum(['active', 'closed', 'archived', 'test']);
const lifecycleFilterSchema = z.union([lifecycleStatusSchema, z.literal('all')]);

const periodSchema = z.enum(['24h', '7d', '30d', '90d', 'all']);
const operationalUnitPayloadSchema = z.object({
  serialNumber: z.string().trim().optional(),
  engineHours: z.number().int().min(0).optional(),
  internalCode: z.string().trim().optional(),
  subtype: z.string().trim().optional(),
}).passthrough();
const operationalAssetPayloadSchema = z.object({
  capacityLiters: z.number().int().min(0).optional(),
  accessNotes: z.string().trim().optional(),
  subtype: z.string().trim().optional(),
}).passthrough();

// Fire validation schemas
export const createFireSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  detectedAt: z.coerce.date(),
  notes: z.string().optional(),
  reportedBy: z.string().optional(),
}).superRefine((value, ctx) => {
  if (!isPointInJurisdiction(value.lat, value.lon)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lat'],
      message: 'La ubicación debe estar dentro de la jurisdicción configurada',
    });
  }
});

export const confirmFireSchema = z.object({
  confirmed: z.boolean(),
  actor: z.string().min(1),
  reason: z.string().optional(),
});

export const updateFireSchema = z.object({
  status: fireStatusSchema.optional(),
  confirmed: z.boolean().optional(),
  confirmedBy: z.string().optional(),
});

export const noteSchema = z.object({
  notes: z.string().trim().min(1),
});

export const extinguishFireSchema = z.object({
  reason: z.string().trim().optional(),
});

export const operateFireSchema = z.object({
  operationalStatus: operationalStatusSchema.optional(),
  priority: incidentPrioritySchema.optional(),
  assignedUnit: z.string().trim().optional(),
  assignedTeam: z.string().trim().optional(),
  reviewed: z.boolean().optional(),
  dispatch: z.boolean().optional(),
  riskSummary: z.string().trim().optional(),
});

export const lifecycleFireSchema = z.object({
  lifecycleStatus: lifecycleStatusSchema,
  reason: z.string().trim().optional(),
});

export const fireStationSchema = z.object({
  code: z.string().trim().optional(),
  name: z.string().trim().min(1),
  locality: z.string().trim().optional(),
  address: z.string().trim().optional(),
  contact: z.string().trim().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().optional(),
  payload: operationalUnitPayloadSchema.optional(),
});

export const fireStationUpdateSchema = fireStationSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export const operationalUnitSchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  type: operationalUnitTypeSchema.default('engine'),
  stationId: z.string().trim().optional(),
  baseName: z.string().trim().optional(),
  status: operationalUnitStatusSchema.default('available'),
  contact: z.string().trim().optional(),
  licensePlate: z.string().trim().optional(),
  capacityLiters: z.number().int().min(0).optional(),
  crewCapacity: z.number().int().min(0).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().optional(),
  payload: operationalUnitPayloadSchema.optional(),
});

export const operationalUnitUpdateSchema = operationalUnitSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export const operationalAssetSchema = z.object({
  name: z.string().trim().min(1),
  type: operationalAssetTypeSchema.default('other'),
  status: operationalAssetStatusSchema.default('unknown'),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().optional(),
  payload: operationalAssetPayloadSchema.optional(),
});

export const operationalAssetUpdateSchema = operationalAssetSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});

export const incidentAssignmentCreateSchema = z.object({
  unitId: z.string().trim().optional(),
  assetId: z.string().trim().optional(),
  unitName: z.string().trim().optional(),
  role: z.string().trim().min(1).default('primary'),
  status: incidentAssignmentStatusSchema.default('assigned'),
  notes: z.string().trim().optional(),
});

export const incidentAssignmentUpdateSchema = z.object({
  assignmentId: z.string().trim().min(1),
  status: incidentAssignmentStatusSchema.optional(),
  notes: z.string().trim().optional(),
});

export const maintenanceRecordCreateSchema = z.object({
  title: z.string().trim().min(1),
  status: maintenanceStatusSchema.default('scheduled'),
  dueAt: z.coerce.date().optional(),
  scheduledAt: z.coerce.date().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),
  odometerKm: z.number().int().min(0).optional(),
  performedBy: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const maintenanceRecordUpdateSchema = z.object({
  maintenanceId: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  status: maintenanceStatusSchema.optional(),
  dueAt: z.coerce.date().nullable().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  odometerKm: z.number().int().min(0).nullable().optional(),
  performedBy: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

// Query validation schemas
export const firesQuerySchema = z.object({
  status: fireStatusSchema.optional(),
  lifecycle: lifecycleFilterSchema.default('active'),
  since: z.coerce.date().optional(),
  period: periodSchema.optional(),
  includeArchived: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const geometryMeasureSchema = z.object({
  type: z.enum(['line', 'polygon']),
  coordinates: z.array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])).min(2),
});

export const firmsQuerySchema = z.object({
  since: z.coerce.date().optional(),
  bbox: z.string().optional(), // "west,south,east,north"
});

// Type exports
export type CreateFireInput = z.infer<typeof createFireSchema>;
export type ConfirmFireInput = z.infer<typeof confirmFireSchema>;
export type UpdateFireInput = z.infer<typeof updateFireSchema>;
export type NoteInput = z.infer<typeof noteSchema>;
export type ExtinguishFireInput = z.infer<typeof extinguishFireSchema>;
export type OperateFireInput = z.infer<typeof operateFireSchema>;
export type LifecycleFireInput = z.infer<typeof lifecycleFireSchema>;
export type FireStationInput = z.infer<typeof fireStationSchema>;
export type FireStationUpdateInput = z.infer<typeof fireStationUpdateSchema>;
export type OperationalUnitInput = z.infer<typeof operationalUnitSchema>;
export type OperationalUnitUpdateInput = z.infer<typeof operationalUnitUpdateSchema>;
export type OperationalAssetInput = z.infer<typeof operationalAssetSchema>;
export type IncidentAssignmentCreateInput = z.infer<typeof incidentAssignmentCreateSchema>;
export type IncidentAssignmentUpdateInput = z.infer<typeof incidentAssignmentUpdateSchema>;
export type MaintenanceRecordCreateInput = z.infer<typeof maintenanceRecordCreateSchema>;
export type MaintenanceRecordUpdateInput = z.infer<typeof maintenanceRecordUpdateSchema>;
export type FiresQueryInput = z.infer<typeof firesQuerySchema>;
export type FirmsQueryInput = z.infer<typeof firmsQuerySchema>;
export type GeometryMeasureInput = z.infer<typeof geometryMeasureSchema>;
