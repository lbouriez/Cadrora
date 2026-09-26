/** Resolve every declared FEATURE_* Wrangler variable from the deployment environment. */
export function featureFlagVars(configVars, environment) {
  const vars = { ...configVars };
  for (const [name, defaultValue] of Object.entries(configVars)) {
    if (!/^FEATURE_[A-Z0-9_]+$/u.test(name)) continue;
    const value = String(environment[name] ?? defaultValue).trim().toLowerCase();
    if (value !== 'true' && value !== 'false') {
      throw new Error(`${name} must be true or false.`);
    }
    vars[name] = value;
  }
  return vars;
}
