process.env.BAML_LOG='off';
import { setLogLevel } from '@/ai/baml_client/config';

// Export core classes
export { Agent } from './agent';
export type { AgentOptions, ActOptions } from './agent';
export { BrowserAgent, startBrowserAgent } from './agent/browserAgent';
export { DesktopAgent, startDesktopAgent } from './agent/desktopAgent';

// Export connectors
export type { AgentConnector } from './connectors';
export { BrowserConnector } from './connectors/browserConnector';
export type { BrowserConnectorOptions } from './connectors/browserConnector';
export { DesktopConnector } from './connectors/desktopConnector';
export type { DesktopConnectorOptions } from './connectors/desktopConnector';

// Export desktop components
export { DesktopHarness } from './desktop/harness';
export type { DesktopHarnessOptions } from './desktop/harness';

// Re-export other existing exports
export * from './types';
export * from './memory';
export * from './actions';
export * from "@/web/harness";
export * from "@/web/browserProvider";
export * from "@/agent/errors";
export * from "@/ai/types";
export * from "@/web/types";
export * from "@/actions/types";
export * from '@/common';
export * from "@/telemetry";
export { buildDefaultBrowserAgentOptions, buildDefaultDesktopAgentOptions } from "@/ai/util";
export { logger } from './logger';
//export { ModelUsage } from '@/ai/modelHarness';

setLogLevel('OFF');