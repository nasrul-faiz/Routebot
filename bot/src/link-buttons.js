function buildLocationLinks(point) {
  const links = [];
  const latitude = Number(point.latitude);
  const longitude = Number(point.longitude);
  const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude)
    && !(latitude === 0 && longitude === 0);

  if (/^\d+$/.test(String(point.code || '').trim())) {
    links.push({
      label: 'FamilyMart',
      url: `https://fmvending.web.app/refill-service/M${String(point.code).padStart(4, '0')}`,
    });
  }

  if (hasCoords) {
    links.push({
      label: 'Google Maps',
      url: `https://maps.google.com/?q=${latitude},${longitude}`,
    });
  }

  if (point.qrCodeDestinationUrl && String(point.qrCodeDestinationUrl).trim()) {
    links.push({
      label: 'QR Code',
      url: String(point.qrCodeDestinationUrl).trim(),
    });
  }

  if (hasCoords) {
    links.push({
      label: 'Waze',
      url: `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`,
    });
  }

  return links;
}

function chunkLinksForButtons(links, maxButtonsPerMessage = 3) {
  const chunks = [];
  for (let i = 0; i < links.length; i += maxButtonsPerMessage) {
    chunks.push(links.slice(i, i + maxButtonsPerMessage));
  }
  return chunks;
}

export { buildLocationLinks, chunkLinksForButtons };
