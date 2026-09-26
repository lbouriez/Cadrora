import { z } from 'zod';

// Configure before shared schemas are created; client CSP forbids Zod's Function() probe.
z.config({ jitless: true });

export { z };
