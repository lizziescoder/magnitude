import { Agent, AgentOptions } from ".";
import { DesktopConnector, DesktopConnectorOptions } from "@/connectors/desktopConnector";
import { buildDefaultDesktopAgentOptions } from "@/ai/util";

// Helper function to start a desktop agent
export async function startDesktopAgent(
    options?: AgentOptions & DesktopConnectorOptions
): Promise<DesktopAgent> {
    const { agentOptions, desktopOptions } = buildDefaultDesktopAgentOptions({ 
        agentOptions: options ?? {}, 
        desktopOptions: options ?? {} 
    });

    const agent = new DesktopAgent({
        agentOptions: agentOptions,
        desktopOptions: desktopOptions,
    });

    await agent.start();
    return agent;
}

export class DesktopAgent extends Agent {
    constructor({ agentOptions, desktopOptions }: { 
        agentOptions?: Partial<AgentOptions>, 
        desktopOptions?: DesktopConnectorOptions 
    }) {
        super({
            ...agentOptions,
            connectors: [new DesktopConnector(desktopOptions || {}), ...(agentOptions?.connectors ?? [])]
        });
    }

    get harness() {
        return this.require(DesktopConnector).getHarness();
    }

    async openApp(appName: string): Promise<void> {
        // Open app using shell command - harness doesn't have openApp method
        await this.harness.runCommand(`open -a "${appName}"`);
    }

    async executeShellCommand(command: string): Promise<string> {
        const result = await this.harness.runCommand(command);
        return result.stdout;
    }

    async getScreenSize(): Promise<{ width: number; height: number }> {
        // Get screen size from options or use default
        const dimensions = this.harness.options.virtualScreenDimensions || { width: 1280, height: 720 };
        return dimensions;
    }

    async takeScreenshot(): Promise<Buffer> {
        const image = await this.harness.screenshot();
        const base64 = await image.toBase64();
        return Buffer.from(base64, 'base64');
    }
} 