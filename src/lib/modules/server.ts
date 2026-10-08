/**
 * Server module index — binds each module's tables and hooks. Imported for its
 * side effects by the server entry points (remote functions, REST resources).
 */
import './directory/server.ts';
import './projects/server.ts';
import './billing/server.ts';
