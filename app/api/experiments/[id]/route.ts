import { defaultExperimentService } from '../../../../src/services/experiment-service';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export function createGetExperimentDetailsHandler(service = defaultExperimentService) {
  return async function GET(_request: Request, context: RouteContext): Promise<Response> {
    const { id } = await context.params;
    const details = service.getExperimentDetails(id);
    if (!details) {
      return Response.json({ error: { code: 'EXPERIMENT_NOT_FOUND' } }, { status: 404 });
    }
    return Response.json(details);
  };
}

export const GET = createGetExperimentDetailsHandler();
