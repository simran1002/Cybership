import { RateRequest, RateResponse } from '../../domain/rates';

export interface RateMapper<CarrierRequest, CarrierResponse> {
  toCarrierRequest(request: RateRequest): CarrierRequest;
  fromCarrierResponse(response: CarrierResponse, requestId: string): RateResponse;
}

