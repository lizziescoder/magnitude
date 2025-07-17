#!/usr/bin/env python3
"""
Desktop Bridge for Magnitude

This module provides a bridge between the TypeScript DesktopHarness and the CUA Python
Computer libraries for controlling desktop VMs. It handles VM lifecycle management and
interface operations via JSON over stdin/stdout.
"""

import asyncio
import base64
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Set up logging to stderr to avoid stdout pollution
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)

# Try to import CUA Computer
try:
    from computer import Computer
except ImportError:
    logger.error("Failed to import Computer. Please install: pip install 'cua-computer[all]'")
    sys.exit(1)

class DesktopBridge:
    def __init__(self):
        self.computer: Optional[Computer] = None
        self.running = True
        
    def _create_success_response(self, data: Any = None) -> Dict[str, Any]:
        """Create a successful response."""
        response = {"status": "success"}
        if data is not None:
            response["data"] = data
        return response
        
    def _create_error_response(self, message: str) -> Dict[str, Any]:
        """Create an error response."""
        return {"status": "error", "message": message}
    
    def _get_interface(self):
        """Get the computer interface if available."""
        if self.computer:
            return getattr(self.computer, '_interface', None)
        return None
    
    async def initialize_vm(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Initialize and start the VM."""
        try:
            logger.info(f"Initializing VM with config: {config}")
            
            # Create Computer instance
            self.computer = Computer(
                os_type=config.get('osType', 'macos'),
                name=config.get('vmName', f"magnitude-desktop-{int(asyncio.get_event_loop().time())}"),
                memory=config.get('memory', '8GB'),
                cpu=config.get('cpu', '4'),
                display=config.get('display', '1024x768'),
                api_key=config.get('apiKey'),
                host=config.get('host', 'localhost'),
                port=config.get('port', 7777),
                verbosity=logging.INFO
            )
            
            # Start the VM
            await self.computer.run()
            
            logger.info("VM initialized successfully")
            return {
                "status": "success",
                "message": "VM initialized",
                "vm_name": self.computer.config.name if hasattr(self.computer, 'config') else config.get('vmName')
            }
        except Exception as e:
            logger.error(f"Failed to initialize VM: {e}", exc_info=True)
            return self._create_error_response(str(e))
    
    async def handle_command(self, command: Dict[str, Any]) -> Dict[str, Any]:
        """Handle commands from TypeScript."""
        if not self.computer:
            return self._create_error_response("VM not initialized")
        
        action = command.get("action")
        logger.debug(f"Handling command: {action}")
        
        interface = self._get_interface()
        if not interface and action not in ["stop", "launch_app", "switch_app", "close_app"]:
            return self._create_error_response("Computer interface not available")
        
        try:
            if action == "screenshot":
                screenshot = await interface.screenshot()
                encoded = base64.b64encode(screenshot).decode('utf-8')
                return self._create_success_response(data=encoded)
            
            elif action == "click":
                x = command.get("x", 0)
                y = command.get("y", 0)
                await interface.left_click(x, y)
                return self._create_success_response()
                
            elif action == "right_click":
                x = command.get("x", 0)
                y = command.get("y", 0)
                await interface.right_click(x, y)
                return self._create_success_response()
            
            elif action == "double_click":
                x = command.get("x", 0)
                y = command.get("y", 0)
                await interface.double_click(x, y)
                return self._create_success_response()
            
            elif action == "type":
                text = command.get("text", "")
                await interface.type_text(text)
                return self._create_success_response()
                
            elif action == "key":
                key = command.get("key", "")
                await interface.press_key(key)
                return self._create_success_response()
                
            elif action == "hotkey":
                keys = command.get("keys", [])
                await interface.hotkey(*keys)
                return self._create_success_response()
                
            elif action == "scroll":
                x = command.get("x", 0)
                y = command.get("y", 0)
                deltaX = command.get("deltaX", 0)
                deltaY = command.get("deltaY", 0)
                # Move to position and scroll
                await interface.move_cursor(x, y)
                if deltaY != 0:
                    clicks = abs(deltaY) // 50  # Approximate scroll amount
                    if deltaY > 0:
                        await interface.scroll_down(clicks)
                    else:
                        await interface.scroll_up(clicks)
                return self._create_success_response()
                
            elif action == "move_cursor":
                x = command.get("x", 0)
                y = command.get("y", 0)
                await interface.move_cursor(x, y)
                return self._create_success_response()
                
            elif action == "drag":
                from_x = command.get("from_x", 0)
                from_y = command.get("from_y", 0)
                to_x = command.get("to_x", 0)
                to_y = command.get("to_y", 0)
                duration = command.get("duration", 0.5)
                await interface.move_cursor(from_x, from_y)
                await interface.drag_to(to_x, to_y, duration=duration)
                return self._create_success_response()
            
            elif action == "launch_app":
                app_name = command.get("app_name", "")
                # macOS specific - use open command
                if self.computer.os_type == "macos":
                    await interface.run_command(f"open -a '{app_name}'")
                else:
                    # Linux/Windows would need different commands
                    await interface.run_command(app_name)
                await asyncio.sleep(2)  # Wait for app to open
                return self._create_success_response()
                
            elif action == "switch_app":
                app_name = command.get("app_name", "")
                # macOS specific - use osascript
                if self.computer.os_type == "macos":
                    script = f'tell application "{app_name}" to activate'
                    await interface.run_command(f"osascript -e '{script}'")
                return self._create_success_response()
                
            elif action == "close_app":
                app_name = command.get("app_name", "")
                # macOS specific
                if self.computer.os_type == "macos":
                    script = f'quit app "{app_name}"'
                    await interface.run_command(f"osascript -e '{script}'")
                return self._create_success_response()
            
            elif action == "run_command":
                cmd = command.get("command", "")
                result = await interface.run_command(cmd)
                return self._create_success_response(data={
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                    "returncode": result.returncode
                })
            
            elif action == "read_file":
                path = command.get("path", "")
                content = await interface.read_text(path)
                return self._create_success_response(data=content)
            
            elif action == "write_file":
                path = command.get("path", "")
                content = command.get("content", "")
                await interface.write_text(path, content)
                return self._create_success_response()
            
            elif action == "file_exists":
                path = command.get("path", "")
                exists = await interface.file_exists(path)
                return self._create_success_response(data=exists)
            
            elif action == "get_clipboard":
                content = await interface.copy_to_clipboard()
                return self._create_success_response(data=content)
            
            elif action == "set_clipboard":
                text = command.get("text", "")
                await interface.set_clipboard(text)
                return self._create_success_response()
                
            elif action == "stop":
                await self.computer.stop()
                self.running = False
                return self._create_success_response(message="VM stopped")
                
            else:
                return self._create_error_response(f"Unknown action: {action}")
                
        except Exception as e:
            logger.error(f"Error handling command {action}: {e}", exc_info=True)
            return self._create_error_response(str(e))
    
    async def run(self):
        """Main event loop."""
        # Send ready signal
        print(json.dumps({"status": "ready"}), flush=True)
        
        try:
            while self.running:
                try:
                    # Read command from stdin
                    line = await asyncio.get_event_loop().run_in_executor(
                        None, sys.stdin.readline
                    )
                    
                    if not line:
                        break
                    
                    line = line.strip()
                    if not line:
                        continue
                        
                    logger.debug(f"Received command: {line}")
                    
                    try:
                        command = json.loads(line)
                    except json.JSONDecodeError as e:
                        logger.error(f"Invalid JSON: {e}")
                        print(json.dumps({"status": "error", "message": f"Invalid JSON: {e}"}), flush=True)
                        continue
                    
                    # Handle special init command
                    if command.get("action") == "init":
                        result = await self.initialize_vm(command.get("config", {}))
                    else:
                        result = await self.handle_command(command)
                    
                    # Send response
                    print(json.dumps(result), flush=True)
                    
                except Exception as e:
                    logger.error(f"Error in main loop: {e}", exc_info=True)
                    print(json.dumps({
                        "status": "error",
                        "message": f"Main loop error: {str(e)}"
                    }), flush=True)
                    
        except KeyboardInterrupt:
            logger.info("Received interrupt signal")
        finally:
            # Cleanup
            if self.computer:
                try:
                    await self.computer.stop()
                except Exception as e:
                    logger.error(f"Error stopping computer: {e}")

def main():
    """Entry point."""
    bridge = DesktopBridge()
    asyncio.run(bridge.run())

if __name__ == "__main__":
    main() 