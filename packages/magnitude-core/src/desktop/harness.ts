import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import logger from '@/logger';
import { Logger } from 'pino';
import { Image } from '@/memory/image';

import sharp from 'sharp';

export interface DesktopHarnessOptions {
    // VM Configuration
    osType: 'macos' | 'linux' | 'windows';
    vmName?: string;
    memory: string;
    cpu: string;
    display: string | { width: number; height: number };
    
    // Connection options
    apiKey?: string;
    host?: string;
    port?: number;
    bridgePath?: string;
    pythonPath?: string;
    
    // Visualization options
    virtualScreenDimensions?: { width: number; height: number };
}

interface CommandResponse {
    status: 'success' | 'error';
    message?: string;
    data?: any;
}

interface PendingCommand {
    resolve: (value: CommandResponse) => void;
    reject: (error: Error) => void;
    timeout?: NodeJS.Timeout;
}

export class DesktopHarness extends EventEmitter {
    public readonly options: DesktopHarnessOptions;
    private logger: Logger;
    
    // Python bridge process
    private pythonProcess?: ChildProcess;
    private commandQueue: PendingCommand[] = [];
    private ready = false;
    private vmName?: string;
    
    constructor(options: DesktopHarnessOptions) {
        super();
        this.options = options;
        this.logger = logger.child({ name: 'desktop.harness' });
    }
    
    async start(): Promise<void> {
        // Start Python bridge process
        const pythonPath = this.options.pythonPath || 'python3';
        const bridgePath = this.options.bridgePath || path.join(__dirname, 'desktopBridge.py');
        
        this.logger.info({ pythonPath, bridgePath }, 'Starting desktop bridge');
        
        this.pythonProcess = spawn(pythonPath, [bridgePath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1'
            }
        });
        
        // Handle Python process output
        this.pythonProcess.stdout?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter(line => line.trim());
            for (const line of lines) {
                try {
                    const response = JSON.parse(line);
                    this.handleResponse(response);
                } catch (err) {
                    this.logger.debug({ line }, 'Non-JSON output from Python');
                }
            }
        });
        
        this.pythonProcess.stderr?.on('data', (data: Buffer) => {
            this.logger.error({ stderr: data.toString() }, 'Python bridge error');
        });
        
        this.pythonProcess.on('error', (error) => {
            this.logger.error({ error }, 'Failed to start Python bridge');
            throw error;
        });
        
        this.pythonProcess.on('exit', (code, signal) => {
            this.logger.info({ code, signal }, 'Python bridge process exited');
            this.ready = false;
        });
        
        // Wait for ready signal
        await this.waitForReady();
        
        // Initialize VM
        await this.initializeVM();
    }
    
    private async waitForReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Python bridge failed to start within timeout'));
            }, 30000);
            
            this.once('ready', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    
    private handleResponse(response: any): void {
        // Handle initial ready signal
        if (response.status === 'ready' && !this.ready) {
            this.ready = true;
            this.emit('ready');
            this.logger.info('Desktop Python bridge is ready');
            return;
        }
        
        // Handle VM initialization response
        if (response.status === 'success' && response.message === 'VM initialized') {
            if (response.vm_name) {
                this.vmName = response.vm_name;
            }
        }
        
        // Handle command responses
        if (this.commandQueue.length > 0) {
            const pendingCommand = this.commandQueue.shift()!;
            
            if (pendingCommand.timeout) {
                clearTimeout(pendingCommand.timeout);
            }
            
            if (response.status === 'success') {
                pendingCommand.resolve(response);
            } else {
                pendingCommand.reject(new Error(response.message || 'Command failed'));
            }
        }
    }
    
    private async sendCommand(action: string, params: any = {}): Promise<CommandResponse> {
        if (!this.ready || !this.pythonProcess) {
            throw new Error('Desktop bridge not ready');
        }
        
        return new Promise((resolve, reject) => {
            const command = { action, ...params };
            
            const pendingCommand: PendingCommand = {
                resolve,
                reject,
                timeout: setTimeout(() => {
                    const index = this.commandQueue.indexOf(pendingCommand);
                    if (index > -1) {
                        this.commandQueue.splice(index, 1);
                    }
                    reject(new Error(`Command ${action} timed out`));
                }, 30000)
            };
            
            this.commandQueue.push(pendingCommand);
            this.pythonProcess!.stdin!.write(JSON.stringify(command) + '\n');
        });
    }
    
    private async initializeVM(): Promise<void> {
        const config = {
            osType: this.options.osType,
            vmName: this.options.vmName,
            memory: this.options.memory,
            cpu: this.options.cpu,
            display: typeof this.options.display === 'string' ? 
                this.options.display : 
                `${this.options.display.width}x${this.options.display.height}`,
            apiKey: this.options.apiKey,
            host: this.options.host,
            port: this.options.port
        };
        
        await this.sendCommand('init', { config });
    }
    
    async stop(): Promise<void> {
        if (this.pythonProcess) {
            await this.sendCommand('stop').catch(() => {
                // Ignore errors on stop
            });
            
            this.pythonProcess.kill();
            this.pythonProcess = undefined;
            this.ready = false;
        }
    }
    
    // Core desktop operations
    async screenshot(): Promise<Image> {
        const response = await this.sendCommand('screenshot');
        if (response.data) {
            // Convert base64 to Image
            return Image.fromBase64(response.data);
        }
        throw new Error('Failed to capture screenshot');
    }
    
    async click(coords: { x: number, y: number }): Promise<void> {
        await this.sendCommand('click', coords);
    }
    
    async rightClick(coords: { x: number, y: number }): Promise<void> {
        await this.sendCommand('right_click', coords);
    }
    
    async doubleClick(coords: { x: number, y: number }): Promise<void> {
        await this.sendCommand('double_click', coords);
    }
    
    async type(params: { content: string }): Promise<void> {
        await this.sendCommand('type', { text: params.content });
    }
    
    async key(key: string): Promise<void> {
        await this.sendCommand('key', { key });
    }
    
    async hotkey(...keys: string[]): Promise<void> {
        await this.sendCommand('hotkey', { keys });
    }
    
    async scroll(params: { x: number, y: number, deltaX: number, deltaY: number }): Promise<void> {
        await this.sendCommand('scroll', {
            x: params.x,
            y: params.y,
            deltaX: params.deltaX,
            deltaY: params.deltaY
        });
    }
    
    async moveCursor(x: number, y: number): Promise<void> {
        await this.sendCommand('move_cursor', { x, y });
    }
    
    async drag(params: { fromX: number, fromY: number, toX: number, toY: number, duration?: number }): Promise<void> {
        await this.sendCommand('drag', {
            from_x: params.fromX,
            from_y: params.fromY,
            to_x: params.toX,
            to_y: params.toY,
            duration: params.duration || 0.5
        });
    }
    
    // Desktop-specific operations
    async launchApp(appName: string): Promise<void> {
        await this.sendCommand('launch_app', { app_name: appName });
    }
    
    async switchToApp(appName: string): Promise<void> {
        await this.sendCommand('switch_app', { app_name: appName });
    }
    
    async closeApp(appName: string): Promise<void> {
        await this.sendCommand('close_app', { app_name: appName });
    }
    
    async runCommand(command: string): Promise<{ stdout: string; stderr: string; returncode: number }> {
        const response = await this.sendCommand('run_command', { command });
        return response.data;
    }
    
    // File operations
    async readFile(path: string): Promise<string> {
        const response = await this.sendCommand('read_file', { path });
        return response.data;
    }
    
    async writeFile(path: string, content: string): Promise<void> {
        await this.sendCommand('write_file', { path, content });
    }
    
    async fileExists(path: string): Promise<boolean> {
        const response = await this.sendCommand('file_exists', { path });
        return response.data;
    }
    
    // Clipboard operations
    async getClipboard(): Promise<string> {
        const response = await this.sendCommand('get_clipboard');
        return response.data;
    }
    
    async setClipboard(text: string): Promise<void> {
        await this.sendCommand('set_clipboard', { text });
    }
} 