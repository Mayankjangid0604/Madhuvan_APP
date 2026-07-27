/**
 * Safely parses a fetch Response as JSON, falling back to the raw text
 * under `raw` if the body isn't valid JSON (error pages, proxies, outages).
 */
exports.parseJsonResponse = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};
