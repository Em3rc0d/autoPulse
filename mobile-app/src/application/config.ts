export const AppConfig = {
  // Activa los colores de referencia general, funciona con Replay y BLE real
  GENERIC_ADVISORY_PROFILES_ENABLED: true,
  // Replay, virtual adapters and raw diagnostic surfaces are development tools.
  // They must never be reachable from a production Release-1 build.
  INTERNAL_TOOLS_ENABLED: __DEV__,
};
