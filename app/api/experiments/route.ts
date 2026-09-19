import { defaultExperimentService } from '../../../src/services/experiment-service';

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
      const experiment = await service.runExperiment({
        datasetSlice: body.datasetSlice,
        sourceType: body.sourceType,
        customThresholds: body.customThresholds,
      });
      return Response.json({ experiment }, { status: 201 });
    } catch {
      return Response.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
  };
}

export const GET = createExperimentsListHandler();
export const POST = createRunExperimentHandler();
