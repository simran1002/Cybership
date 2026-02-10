import { UpsRateMapper } from '../../integrations/ups/ups-rate-mapper';
import { ErrorCode, ServiceError } from '../../domain/errors';
import { RateRequest } from '../../domain/rates';
import { UpsRateResponse } from '../../integrations/ups/ups-schemas';

describe('UpsRateMapper', () => {
  const baseRequest: RateRequest = {
    origin: {
      street: ['1 Main'],
      city: 'Atlanta',
      state: 'GA',
      postalCode: '30339',
      country: 'US'
    },
    destination: {
      street: ['2 Main'],
      city: 'Austin',
      state: 'TX',
      postalCode: '73301',
      country: 'US'
    },
    packages: [{ weight: 1, length: 1, width: 1, height: 1 }]
  };

  it('includes ShipperNumber when accountNumber is configured', () => {
    const mapper = new UpsRateMapper({ accountNumber: 'ACCT' });
    const req = mapper.toCarrierRequest(baseRequest);
    expect(req.RateRequest.Shipment.Shipper.ShipperNumber).toBe('ACCT');
  });

  it('throws a validation error for an unsupported service level', () => {
    const mapper = new UpsRateMapper({});
    const bad = { ...baseRequest, serviceLevel: 'teleport' } as unknown as RateRequest;
    expect(() => mapper.toCarrierRequest(bad)).toThrow(ServiceError);
  });

  it('throws API_ERROR when UPS returns no RatedShipment entries', () => {
    const mapper = new UpsRateMapper({});
    const response: UpsRateResponse = {
      RateResponse: {
        Response: { ResponseStatus: { Code: '1', Description: 'Success' } },
        RatedShipment: []
      }
    };

    expect(() => mapper.fromCarrierResponse(response, 'req_1')).toThrow(ServiceError);
    try {
      mapper.fromCarrierResponse(response, 'req_1');
    } catch (e) {
      const err = e as ServiceError;
      expect(err.code).toBe(ErrorCode.API_ERROR);
      expect(err.carrier).toBe('UPS');
    }
  });
});

