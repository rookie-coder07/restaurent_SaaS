export function jsonSuccess(data, message = 'OK', status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      statusCode: status,
      success: true,
      data,
      message,
    }),
  };
}

export function jsonError(message = 'Request failed', status = 500, details) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify({
      statusCode: status,
      success: false,
      message,
      ...(details ? { details } : {}),
    }),
  };
}

function parsePostBody(rawBody) {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

export async function mockApi(page, responder) {
  await page.route('http://localhost:3000/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const response = await responder({
      route,
      request,
      url,
      method: request.method(),
      body: parsePostBody(request.postData()),
    });

    if (response) {
      await route.fulfill(response);
      return;
    }

    await route.fulfill(jsonSuccess({}));
  });
}
