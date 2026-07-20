export interface VehicleSnapshot {
  readonly vin?: string;
  readonly make?: string;
  readonly model?: string;
  readonly year?: number;
  readonly odometer?: number;
  readonly odometerUnit?: 'KM' | 'MILES';
  readonly protocolDetected?: string;
}
