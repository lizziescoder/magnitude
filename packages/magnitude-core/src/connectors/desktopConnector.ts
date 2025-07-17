import { AgentConnector } from ".";
import { DesktopHarness } from "@/desktop/harness";
import { ActionDefinition } from '@/actions';
import { agnosticDesktopActions, coordDesktopActions, targetDesktopActions } from '@/actions/desktopActions';
import logger from "@/logger";
import { Logger } from 'pino';
import { Observation } from "@/memory/observation";
import { Image } from "@/memory/image";
import { GroundingClient } from "@/ai/types";
import { GroundingService, moondreamTargetingInstructions } from "@/ai/grounding";

const DEFAULT_MIN_RETAINED_SCREENSHOTS = 2;

export interface DesktopConnectorOptions {
    // VM Configuration
    osType?: 'macos' | 'linux' | 'windows';
    vmName?: string;
    memory?: string;
    cpu?: string;
    display?: string | { width: number; height: number };
    
    // Connection options
    apiKey?: string;  // For cloud VMs
    host?: string;    // Default: localhost
    port?: number;    // Default: 7777
    bridgePath?: string; // Path to Python bridge script
    
    // Behavior options
    grounding?: GroundingClient;
    virtualScreenDimensions?: { width: number, height: number };
    minScreenshots?: number;
    
    // Python environment
    pythonPath?: string; // Default: 'python3'
}

export interface DesktopConnectorStateData {
    screenshot: Image;
    // Could add running applications, window state, etc.
}

export class DesktopConnector implements AgentConnector {
    public readonly id: string = "desktop";
    private harness!: DesktopHarness;
    private options: DesktopConnectorOptions;
    private logger: Logger;
    private grounding?: GroundingService;

    constructor(options: DesktopConnectorOptions = {}) {
        this.options = options;
        this.logger = logger.child({
            name: `connectors.${this.id}`
        });
        if (this.options.grounding) {
            this.grounding = new GroundingService({ client: this.options.grounding });
        }
    }

    requireGrounding(): GroundingService {
        if (!this.grounding) throw new Error("Grounding not configured on desktop connector");
        return this.grounding;
    }

    async onStart(): Promise<void> {
        this.logger.info("Starting desktop connector...");
        
        // Initialize the desktop harness with computer bridge
        this.harness = new DesktopHarness({
            osType: this.options.osType || 'macos',
            vmName: this.options.vmName,
            memory: this.options.memory || '8GB',
            cpu: this.options.cpu || '4',
            display: this.options.display || '1024x768',
            apiKey: this.options.apiKey,
            host: this.options.host,
            port: this.options.port,
            bridgePath: this.options.bridgePath,
            pythonPath: this.options.pythonPath,
            virtualScreenDimensions: this.options.virtualScreenDimensions
        });
        
        await this.harness.start();
        this.logger.info("DesktopHarness started.");
    }

    async onStop(): Promise<void> {
        this.logger.info("Stopping desktop connector...");
        if (this.harness) {
            await this.harness.stop();
            this.logger.info("Desktop harness stopped.");
        }
        this.logger.info("Stopped successfully.");
    }

    getActionSpace(): ActionDefinition<any>[] {
        if (this.grounding) {
            // Separate grounding
            return [...targetDesktopActions, ...agnosticDesktopActions];
        } else {
            // Planner is grounded
            return [...coordDesktopActions, ...agnosticDesktopActions];
        }
    }

    public getHarness(): DesktopHarness {
        if (!this.harness) {
            throw new Error("DesktopConnector: Harness is not available. Ensure onStart has completed.");
        }
        return this.harness;
    }

    private async captureCurrentState(): Promise<DesktopConnectorStateData> {
        if (!this.harness) {
            throw new Error("DesktopConnector: Harness is not available for capturing state.");
        }
        const screenshot = await this.harness.screenshot();
        return { screenshot: await this.transformScreenshot(screenshot) };
    }

    async transformScreenshot(screenshot: Image): Promise<Image> {
        if (this.options.virtualScreenDimensions) {
            return await screenshot.resize(this.options.virtualScreenDimensions.width, this.options.virtualScreenDimensions.height);
        } else {
            return screenshot;
        }
    }

    public async getLastScreenshot(): Promise<Image> {
        return (await this.captureCurrentState()).screenshot;
    }

    async collectObservations(): Promise<Observation[]> {
        const currentState = await this.captureCurrentState();
        const observations: Observation[] = [];

        const screenshotLimit = this.options.minScreenshots ?? DEFAULT_MIN_RETAINED_SCREENSHOTS;

        observations.push(
            Observation.fromConnector(
                this.id,
                currentState.screenshot,
                { type: 'screenshot', limit: screenshotLimit, dedupe: true }
            )
        );
        
        // Could add additional observations like running apps, system state, etc.
        
        return observations;
    }

    async getInstructions(): Promise<void | string> {
        if (this.grounding) {
            return moondreamTargetingInstructions;
        }
    }
} 