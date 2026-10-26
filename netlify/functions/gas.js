// Netlify Function: a small go-between so visitors' phones only ever talk to YOUR website.
// The function (on Netlify's servers) talks to Google Apps Script for them. This fixes phones/networks
// that cannot open script.google.com directly, and lets Netlify cache the product list for speed.
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwuixtEGHj2CAcwXWpLdDmvlnEWSBbhcQZ6lxjFjYy5wf887TvstBuoSqZ2TrJxuSOpug/exec';
const READ_ACTIONS = ['products', 'banners', 'reviews'];

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  try {
    // ----- orders & reviews (website -> Google Sheet) -----
    if (event.httpMethod === 'POST') {
      const body = event.body || '';
      if (!body || body.length > 20000) return { statusCode: 413, headers, body: '{"result":"error"}' };
      const r = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
        redirect: 'follow'
      });
      const text = await r.text();
      JSON.parse(text); // must be the script's JSON answer
      return { statusCode: 200, headers: { ...headers, 'Cache-Control': 'no-store' }, body: text };
    }

    // ----- products / banners / reviews (Google -> website) -----
    const action = (event.queryStringParameters || {}).action;
    if (!READ_ACTIONS.includes(action)) return { statusCode: 400, headers, body: '{"error":"bad action"}' };
    const r = await fetch(GAS_URL + '?action=' + action, { redirect: 'follow' });
    const text = await r.text();
    JSON.parse(text); // refuse to pass along an HTML error page
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=600'
      },
      body: text
    };
  } catch (e) {
    return { statusCode: 502, headers: { ...headers, 'Cache-Control': 'no-store' }, body: '{"error":"upstream"}' };
  }
};
