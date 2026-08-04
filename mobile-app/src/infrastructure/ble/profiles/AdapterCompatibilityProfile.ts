export interface AdapterCompatibilityProfile {
  id: string; // e.g. "elm327-standard", "vlink"
  name: string;
  expectedServices: string[];
  expectedWriteCharacteristics: string[];
  expectedReceiveCharacteristics: string[];
}
