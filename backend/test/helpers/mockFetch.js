/**
 * Installs a fake global.fetch for the duration of a test. `plan` is either
 * an array of { status, body } responses (consumed in call order) or a
 * function (url, options, callIndex) => { status, body }.
 * Returns a restore() function plus the list of calls made (url, options).
 */
function mockFetch(plan) {
  const original = global.fetch;
  const calls = [];
  let index = 0;

  global.fetch = async (url, options) => {
    calls.push({ url, options });
    const def = typeof plan === 'function' ? plan(url, options, index) : plan[index];
    index += 1;
    if (!def) throw new Error(`mockFetch: no response defined for call #${index}`);

    const bodyText = typeof def.body === 'string' ? def.body : JSON.stringify(def.body ?? {});
    return {
      ok: def.status >= 200 && def.status < 300,
      status: def.status,
      json: async () => JSON.parse(bodyText),
      text: async () => bodyText
    };
  };

  return {
    calls,
    restore: () => { global.fetch = original; }
  };
}

module.exports = { mockFetch };
