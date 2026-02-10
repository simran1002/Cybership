import { HttpResponse } from '../../application/ports/http-client';

export interface CarrierClient<CarrierRequest> {
  send(request: CarrierRequest, context: { requestId: string }): Promise<HttpResponse>;
}

