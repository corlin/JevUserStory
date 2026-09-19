import { defaultExperimentService } from '../../../src/services/experiment-service';
import { DEMO_CASES } from '../../../src/fixtures/cases';
import { isSupportedDatasetSlice } from '../../../src/domain/slices';
import { GatewayEvaluationError } from '../../../src/gateway/evaluate-case';
import { PolicyThresholdsSchema } from '../../../src/policy/validation';
import { z } from 'zod';

const ExperimentInputSchema = z.object({
  datasetSlice: z.string().default('all'),
  sourceType: z.enum(['baseline', 'live']).default('baseline'),
  customThresholds: PolicyThresholdsSchema.optional(),
}).strict();

export function createExperimentsListHandler(service = defaultExperimentService) {
  return async function GET(): Promise<Response> {
    const experiments = service.listExperiments();
    return Response.json({ experiments });
  };
}

export function createRunExperimentHandler(service = defaultExperimentService) {
  return async function POST(request: Request): Promise<Response> {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = ExperimentInputSchema.safeParse(body);
      if (!parsed.success || !isSupportedDatasetSlice(DEMO_CASES, parsed.data.datasetSlice)) {
        return Response.json({ error: { code: 'INVALID_EXPERIMENT_PAYLOAD' } }, { status: 400 });
      }
      const experiment = await service.runExperiment({
        datasetSlice: parsed.data.datasetSlice,
        sourceType: parsed.data.sourceType,
        customThresholds: parsed.data.customThresholds,
      });
      return Response.json({ experiment }, { status: 201 });
    } catch (error) {
      if (error instanceof GatewayEvaluationError) {
        return Response.json({ error: { code: error.code } }, { status: 502 });
      }
      if (error instanceof Error && error.message === 'INVALID_EVALUATION_RESPONSE') {
        return Response.json({ error: { code: error.message } }, { status: 502 });
      }
      return Response.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
  };
}

export const GET = createExperimentsListHandler();
export const POST = createRunExperimentHandler();
