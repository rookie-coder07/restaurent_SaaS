const restaurantStreams = new Map();

function getRestaurantStreamKey(restaurantId) {
  return String(restaurantId || '').trim();
}

function getRestaurantClients(restaurantId) {
  const key = getRestaurantStreamKey(restaurantId);

  if (!restaurantStreams.has(key)) {
    restaurantStreams.set(key, new Set());
  }

  return restaurantStreams.get(key);
}

export function attachRestaurantStream(restaurantId, client) {
  const clients = getRestaurantClients(restaurantId);
  clients.add(client);
}

export function detachRestaurantStream(restaurantId, client) {
  const key = getRestaurantStreamKey(restaurantId);
  const clients = restaurantStreams.get(key);

  if (!clients) {
    return;
  }

  clients.delete(client);

  if (clients.size === 0) {
    restaurantStreams.delete(key);
  }
}

export function writeSseEvent(res, eventName, payload = {}) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export function broadcastRestaurantEvent(restaurantId, eventName, payload = {}) {
  const clients = restaurantStreams.get(getRestaurantStreamKey(restaurantId));

  if (!clients || clients.size === 0) {
    return 0;
  }

  let deliveredCount = 0;

  clients.forEach((client) => {
    try {
      writeSseEvent(client.res, eventName, {
        ...payload,
        eventName,
        emittedAt: new Date().toISOString(),
      });
      deliveredCount += 1;
    } catch {
      detachRestaurantStream(restaurantId, client);
    }
  });

  return deliveredCount;
}
