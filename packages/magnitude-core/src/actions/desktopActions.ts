import { ActionDefinition, createAction } from ".";
import { z } from "zod";
import { DesktopConnector } from "@/connectors/desktopConnector";

// Import reusable actions from webActions
import {
    typeAction,
    keyboardEnterAction,
    keyboardTabAction,
    keyboardBackspaceAction,
    keyboardSelectAllAction,
    waitAction
} from "./webActions";

// For grounded planner - coordinate-based actions
export const clickCoordDesktopAction = createAction({
    name: 'mouse:click',
    description: "Click at coordinates",
    schema: z.object({
        x: z.number().int(),
        y: z.number().int(),
    }),
    resolver: async ({ input: { x, y }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const harness = desktop.getHarness();
        await harness.click({ x, y });
    },
    render: ({ x, y }) => `⊙ click (${x}, ${y})`
});

export const rightClickCoordDesktopAction = createAction({
    name: 'mouse:right_click',
    description: "Right click at coordinates",
    schema: z.object({
        x: z.number().int(),
        y: z.number().int(),
    }),
    resolver: async ({ input: { x, y }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const harness = desktop.getHarness();
        await harness.rightClick({ x, y });
    },
    render: ({ x, y }) => `⊙ right click (${x}, ${y})`
});

export const doubleClickCoordDesktopAction = createAction({
    name: 'mouse:double_click',
    description: "Double click at coordinates",
    schema: z.object({
        x: z.number().int(),
        y: z.number().int(),
    }),
    resolver: async ({ input: { x, y }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const harness = desktop.getHarness();
        await harness.doubleClick({ x, y });
    },
    render: ({ x, y }) => `⊙ double click (${x}, ${y})`
});

export const scrollCoordDesktopAction = createAction({
    name: 'mouse:scroll',
    description: "Scroll at position",
    schema: z.object({
        x: z.number().int(),
        y: z.number().int(),
        deltaX: z.number().int().describe("Pixels to scroll horizontally"),
        deltaY: z.number().int().describe("Pixels to scroll vertically"),
    }),
    resolver: async ({ input: { x, y, deltaX, deltaY }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const harness = desktop.getHarness();
        await harness.scroll({ x, y, deltaX, deltaY });
    },
    render: ({ deltaX, deltaY }) => `⟳ scroll (${deltaX}, ${deltaY})`
});

export const dragCoordDesktopAction = createAction({
    name: 'mouse:drag',
    description: "Drag from one position to another",
    schema: z.object({
        fromX: z.number().int(),
        fromY: z.number().int(),
        toX: z.number().int(),
        toY: z.number().int(),
        duration: z.number().optional().describe("Duration in seconds")
    }),
    resolver: async ({ input: { fromX, fromY, toX, toY, duration }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const harness = desktop.getHarness();
        await harness.drag({ fromX, fromY, toX, toY, duration });
    },
    render: ({ fromX, fromY, toX, toY }) => `⊹ drag from (${fromX}, ${fromY}) to (${toX}, ${toY})`
});

// For separate grounding - target-based actions
export const clickTargetDesktopAction = createAction({
    name: 'mouse:click',
    description: "Click something",
    schema: z.object({
        target: z.string().describe("What to click on"),
    }),
    resolver: async ({ input: { target }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const harness = desktop.getHarness();
        const screenshot = await desktop.getLastScreenshot();
        const { x, y } = await desktop.requireGrounding().locateTarget(screenshot, target);
        await harness.click({ x, y });
    }
});

export const scrollTargetDesktopAction = createAction({
    name: 'mouse:scroll',
    description: "Hover mouse over target and scroll",
    schema: z.object({
        target: z.string().describe("Where to position mouse for scrolling"),
        deltaX: z.number().int().describe("Pixels to scroll horizontally"),
        deltaY: z.number().int().describe("Pixels to scroll vertically"),
    }),
    resolver: async ({ input: { target, deltaX, deltaY }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const harness = desktop.getHarness();
        const screenshot = await desktop.getLastScreenshot();
        const { x, y } = await desktop.requireGrounding().locateTarget(screenshot, target);
        await harness.scroll({ x, y, deltaX, deltaY });
    }
});

// Desktop-specific actions
export const launchAppAction = createAction({
    name: 'app:launch',
    description: "Launch an application",
    schema: z.object({
        name: z.string().describe("Application name to launch"),
    }),
    resolver: async ({ input: { name }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        await desktop.getHarness().launchApp(name);
    },
    render: ({ name }) => `▶ launch ${name}`
});

export const switchAppAction = createAction({
    name: 'app:switch',
    description: "Switch to an application",
    schema: z.object({
        name: z.string().describe("Application name to switch to"),
    }),
    resolver: async ({ input: { name }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        await desktop.getHarness().switchToApp(name);
    },
    render: ({ name }) => `⇄ switch to ${name}`
});

export const closeAppAction = createAction({
    name: 'app:close',
    description: "Close an application",
    schema: z.object({
        name: z.string().describe("Application name to close"),
    }),
    resolver: async ({ input: { name }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        await desktop.getHarness().closeApp(name);
    },
    render: ({ name }) => `✕ close ${name}`
});

export const runCommandAction = createAction({
    name: 'system:command',
    description: "Run a system command",
    schema: z.object({
        command: z.string().describe("Command to execute"),
    }),
    resolver: async ({ input: { command }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        const result = await desktop.getHarness().runCommand(command);
        return `stdout: ${result.stdout}\nstderr: ${result.stderr}\nreturn code: ${result.returncode}`;
    },
    render: ({ command }) => `$ ${command}`
});

export const hotkeyAction = createAction({
    name: 'keyboard:hotkey',
    description: "Press a keyboard shortcut",
    schema: z.object({
        keys: z.array(z.string()).describe("Keys to press together (e.g., ['cmd', 'c'])"),
    }),
    resolver: async ({ input: { keys }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        await desktop.getHarness().hotkey(...keys);
    },
    render: ({ keys }) => `⌨ ${keys.join('+')}`
});

export const clipboardCopyAction = createAction({
    name: 'clipboard:copy',
    description: "Copy selected text to clipboard",
    schema: z.object({}),
    resolver: async ({ agent }) => {
        const desktop = agent.require(DesktopConnector);
        // First do Cmd+C (or Ctrl+C on Windows/Linux)
        const os = desktop.getHarness().options?.osType || 'macos';
        const copyKey = os === 'macos' ? 'cmd' : 'ctrl';
        await desktop.getHarness().hotkey(copyKey, 'c');
    },
    render: () => `📋 copy`
});

export const clipboardPasteAction = createAction({
    name: 'clipboard:paste',
    description: "Paste from clipboard",
    schema: z.object({}),
    resolver: async ({ agent }) => {
        const desktop = agent.require(DesktopConnector);
        // Do Cmd+V (or Ctrl+V on Windows/Linux)
        const os = desktop.getHarness().options?.osType || 'macos';
        const pasteKey = os === 'macos' ? 'cmd' : 'ctrl';
        await desktop.getHarness().hotkey(pasteKey, 'v');
    },
    render: () => `📋 paste`
});

export const setClipboardAction = createAction({
    name: 'clipboard:set',
    description: "Set clipboard content directly",
    schema: z.object({
        text: z.string().describe("Text to put in clipboard"),
    }),
    resolver: async ({ input: { text }, agent }) => {
        const desktop = agent.require(DesktopConnector);
        await desktop.getHarness().setClipboard(text);
    },
    render: ({ text }) => `📋 set clipboard: "${text}"`
});

// Action collections
export const agnosticDesktopActions = [
    // Application control
    launchAppAction,
    switchAppAction,
    closeAppAction,
    
    // System
    runCommandAction,
    
    // Keyboard (reused from web)
    typeAction,
    keyboardEnterAction,
    keyboardTabAction,
    keyboardBackspaceAction,
    keyboardSelectAllAction,
    hotkeyAction,
    
    // Clipboard
    clipboardCopyAction,
    clipboardPasteAction,
    setClipboardAction,
    
    // Timing
    waitAction
] as const;

export const coordDesktopActions = [
    clickCoordDesktopAction,
    rightClickCoordDesktopAction,
    doubleClickCoordDesktopAction,
    scrollCoordDesktopAction,
    dragCoordDesktopAction
] as const;

export const targetDesktopActions = [
    clickTargetDesktopAction,
    scrollTargetDesktopAction
] as const; 