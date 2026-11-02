/** Presentation labels only: source identities, model IDs and cache lineage stay unchanged. */
export const HGST_WD_VENDOR = 'HGST/WD';

export function displayVendor(vendor: string): string {
  return /^(?:WDC\/HGST|WD\/HGST|HGST\/WD|HGST|WD|WDC)$/i.test(vendor.trim())
    ? HGST_WD_VENDOR
    : vendor;
}

/** Historical Deskstar models can carry a redundant Hitachi prefix in source metadata. */
export function displayModelLabel<T extends { vendor: string; modelNumber: string }>(model: T): T {
  const deskstar = /^(?:(?:Hitachi|HGST)\s+)?(HD[ST][A-Z0-9]+)$/i.exec(model.modelNumber.trim());
  return {
    ...model,
    vendor: deskstar ? HGST_WD_VENDOR : displayVendor(model.vendor),
    modelNumber: deskstar ? deskstar[1]! : model.modelNumber,
  };
}
