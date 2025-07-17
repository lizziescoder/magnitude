# Desktop Connector for Magnitude

The Desktop Connector extends Magnitude to control desktop applications and VMs, enabling automation beyond web browsers.

## Overview

The Desktop Connector uses the CUA Computer interface to control desktop VMs, providing:
- Full mouse and keyboard control
- Screenshot capture
- Application launching and control
- File system operations
- Clipboard management

## Architecture

```
Magnitude Agent
    ↓
DesktopConnector
    ↓
DesktopHarness
    ↓
Python Bridge (desktopBridge.py)
    ↓
CUA Computer SDK
    ↓
VM (Lume/Cloud)
```

## Usage

### Basic Example

```typescript
import { Agent } from 'magnitude-core';
import { DesktopConnector } from 'magnitude-core';

// Create agent with desktop connector
const agent = new Agent({
  connectors: [
    new DesktopConnector({
      osType: 'macos',
      vmName: 'test-desktop',
      memory: '8GB',
      cpu: '4'
    })
  ]
});

await agent.start();

// High-level automation
await agent.act('Open TextEdit and write a document');

// Low-level control
await agent.act('click on the Apple menu');
await agent.act('type "Hello from Magnitude"');

await agent.stop();
```

### Using the Helper Function

```typescript
import { startDesktopAgent } from 'magnitude-core';

const agent = await startDesktopAgent({
  osType: 'macos',
  vmName: 'my-desktop'
});

await agent.act('Open Calculator and compute 2+2');
```

### With Browser Agent

You can combine desktop and browser automation:

```typescript
import { BrowserAgent } from 'magnitude-core';
import { DesktopConnector } from 'magnitude-core';

const agent = new BrowserAgent({
  agentOptions: {
    connectors: [
      // Browser connector is added automatically
      new DesktopConnector({ osType: 'macos' })
    ]
  }
});

// Now you can automate both browser and desktop
await agent.nav('https://example.com');
await agent.act('Take a screenshot using Preview app');
```

## Actions

The Desktop Connector provides desktop-specific actions:

### Application Control
- `app:launch` - Launch an application
- `app:switch` - Switch to an application
- `app:close` - Close an application

### System Control
- `system:command` - Run system commands
- `clipboard:copy` - Copy to clipboard
- `clipboard:paste` - Paste from clipboard
- `clipboard:set` - Set clipboard content

### Mouse Actions (coordinate-based)
- `mouse:click` - Click at coordinates
- `mouse:right_click` - Right click
- `mouse:double_click` - Double click
- `mouse:scroll` - Scroll at position
- `mouse:drag` - Drag from one position to another

### Keyboard Actions (reused from web)
- `keyboard:type` - Type text
- `keyboard:enter` - Press Enter
- `keyboard:tab` - Press Tab
- `keyboard:hotkey` - Press keyboard shortcuts

## Requirements

1. **Python Environment**: Python 3.8+ with CUA Computer SDK
   ```bash
   pip install 'cua-computer[all]'
   ```

2. **VM Provider**: One of:
   - Lume (for local VMs on macOS)
   - Cloud containers (with API key)

3. **Build Magnitude**: The desktop components need to be built:
   ```bash
   cd magnitude/packages/magnitude-core
   npm run build
   ```

## Configuration Options

```typescript
interface DesktopConnectorOptions {
  // VM Configuration
  osType?: 'macos' | 'linux' | 'windows';
  vmName?: string;
  memory?: string;  // e.g., '8GB'
  cpu?: string;     // e.g., '4'
  display?: string | { width: number; height: number };
  
  // Connection options
  apiKey?: string;     // For cloud VMs
  host?: string;       // Default: localhost
  port?: number;       // Default: 7777
  bridgePath?: string; // Path to Python bridge script
  pythonPath?: string; // Python executable path
  
  // Behavior options
  grounding?: GroundingClient;  // For AI-powered targeting
  virtualScreenDimensions?: { width: number; height: number };
  minScreenshots?: number;
  visuals?: ActionVisualizerOptions;
}
```

## Troubleshooting

### DesktopConnector not found
Ensure magnitude-core is built:
```bash
npm run build
```

### Python bridge fails to start
Check Python installation and CUA Computer SDK:
```bash
python3 -m pip show cua-computer
```

### VM fails to initialize
Check Lume is running (for local VMs):
```bash
lume status
```

## Future Enhancements

- Native TypeScript CUA Computer SDK support
- Direct VNC integration
- Windows and Linux VM support
- Application state detection
- UI element targeting with AI 