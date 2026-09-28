const SEEDED_PHC_COORDINATES = {
  'TN-CBE-SUL': { lat: 11.0248, lng: 77.128 },
  'TN-MDU-MEL': { lat: 10.0312, lng: 78.3398 },
  'TN-TNJ-PTK': { lat: 10.4234, lng: 79.3186 },
  'KL-TVM-NED': { lat: 8.6031, lng: 76.9998 },
  'KL-EKM-MUL': { lat: 9.9002, lng: 76.3884 },
  'KL-KKD-BAL': { lat: 11.4435, lng: 75.8342 },
  'KA-BLR-ANE': { lat: 12.7108, lng: 77.6954 },
  'KA-MYS-NAN': { lat: 12.1198, lng: 76.6836 },
  'KA-BEL-GOK': { lat: 16.1692, lng: 74.8234 },
  'MH-PUN-MUL': { lat: 18.5076, lng: 73.5168 },
  'MH-PUN-BAR': { lat: 18.1518, lng: 74.5772 },
  'MH-PUN-JUN': { lat: 19.2072, lng: 73.8754 },
  'MH-NAS-SIN': { lat: 19.8452, lng: 73.9996 },
  'MH-NGP-KAT': { lat: 21.2744, lng: 78.5852 },
  'RJ-JAI-BAS': { lat: 26.8422, lng: 76.0484 },
  'RJ-JOD-OSI': { lat: 26.721, lng: 72.908 },
  'RJ-UDR-MAV': { lat: 24.791, lng: 73.988 },
  'OD-KHD-BLP': { lat: 20.1984, lng: 85.9202 },
  'OD-CTC-NIA': { lat: 20.1402, lng: 86.0604 },
  'OD-GNJ-DIG': { lat: 19.2904, lng: 84.5712 },
};

function coordinatePair(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

function resolvePhcPosition(phc) {
  const fromApi = coordinatePair(phc?.latitude, phc?.longitude);
  if (fromApi) {
    return fromApi;
  }
  return SEEDED_PHC_COORDINATES[phc?.phc_code] || null;
}

export { resolvePhcPosition, SEEDED_PHC_COORDINATES };
