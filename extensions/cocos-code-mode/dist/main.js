"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const package_json_1 = __importDefault(require("../package.json"));
const utcp_server_1 = require("./utcp/utcp-server");
const config_manager_1 = require("./utcp/config-manager");
let utcpServer = null;
const methods = {
    openPanel() {
        Editor.Panel.open(package_json_1.default.name + '.configuration');
    },
    async restartServer(newPort) {
        if (utcpServer) {
            console.log(`[${package_json_1.default.name}] Restarting UTCP Server on port ${newPort}...`);
            utcpServer.stop();
            try {
                const actualPort = await utcpServer.start(newPort);
                console.log(`[${package_json_1.default.name}] UTCP Server restarted on port ${actualPort}`);
                // Используем менеджер конфигурации для обновления порта
                const configManager = (0, config_manager_1.getConfigManager)();
                await configManager.updatePort(actualPort);
            }
            catch (err) {
                console.error(`[${package_json_1.default.name}] Failed to restart UTCP Server:`, err);
            }
        }
    }
};
async function load() {
    // Initialize config manager
    const configManager = (0, config_manager_1.getConfigManager)();
    await configManager.initialize();
    utcpServer = new utcp_server_1.UtcpServerManager();
    let wasConfiguredPort = true;
    // Load port from profile, default to 0 (random free port) if not set
    let port = await Editor.Profile.getConfig(package_json_1.default.name, 'serverPort');
    if (typeof port !== 'number') {
        port = 0;
        wasConfiguredPort = false;
    }
    try {
        const actualPort = await utcpServer.start(port);
        console.log(`[${package_json_1.default.name}] UTCP Server started on port ${actualPort}`);
        // Automatically update the port in the configuration on startup
        await configManager.updatePort(actualPort);
        console.log(`[${package_json_1.default.name}] UTCP config automatically updated with port ${actualPort}`);
    }
    catch (err) {
        console.error(`[${package_json_1.default.name}] Failed to start UTCP Server:`, err);
    }
    if (!wasConfiguredPort) {
        methods.openPanel();
    }
}
function unload() {
    if (utcpServer) {
        console.log(`[${package_json_1.default.name}] Stopping UTCP Server...`);
        utcpServer.stop();
        utcpServer = null;
    }
}
// Cocos extension loader reads CommonJS exports.
exports.methods = methods;
exports.load = load;
exports.unload = unload;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7O0FBQUEsbUVBQTBDO0FBQzFDLG9EQUF1RDtBQUN2RCwwREFBeUQ7QUFFekQsSUFBSSxVQUFVLEdBQTZCLElBQUksQ0FBQztBQUdoRCxNQUFNLE9BQU8sR0FBNEM7SUFFckQsU0FBUztRQUNMLE1BQU0sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLHNCQUFXLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDLENBQUM7SUFDM0QsQ0FBQztJQUdELEtBQUssQ0FBQyxhQUFhLENBQUMsT0FBZTtRQUMvQixJQUFJLFVBQVUsRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHNCQUFXLENBQUMsSUFBSSxvQ0FBb0MsT0FBTyxLQUFLLENBQUMsQ0FBQztZQUNsRixVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDbEIsSUFBSSxDQUFDO2dCQUNELE1BQU0sVUFBVSxHQUFHLE1BQU0sVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbkQsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHNCQUFXLENBQUMsSUFBSSxtQ0FBbUMsVUFBVSxFQUFFLENBQUMsQ0FBQztnQkFFakYsd0RBQXdEO2dCQUN4RCxNQUFNLGFBQWEsR0FBRyxJQUFBLGlDQUFnQixHQUFFLENBQUM7Z0JBQ3pDLE1BQU0sYUFBYSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMvQyxDQUFDO1lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztnQkFDWCxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksc0JBQVcsQ0FBQyxJQUFJLGtDQUFrQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQy9FLENBQUM7UUFDTCxDQUFDO0lBQ0wsQ0FBQztDQUNKLENBQUM7QUFFRixLQUFLLFVBQVUsSUFBSTtJQUNmLDRCQUE0QjtJQUM1QixNQUFNLGFBQWEsR0FBRyxJQUFBLGlDQUFnQixHQUFFLENBQUM7SUFDekMsTUFBTSxhQUFhLENBQUMsVUFBVSxFQUFFLENBQUM7SUFFakMsVUFBVSxHQUFHLElBQUksK0JBQWlCLEVBQUUsQ0FBQztJQUVyQyxJQUFJLGlCQUFpQixHQUFHLElBQUksQ0FBQztJQUM3QixxRUFBcUU7SUFDckUsSUFBSSxJQUFJLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxzQkFBVyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztJQUMxRSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQzNCLElBQUksR0FBRyxDQUFDLENBQUM7UUFDVCxpQkFBaUIsR0FBRyxLQUFLLENBQUM7SUFDOUIsQ0FBQztJQUVELElBQUksQ0FBQztRQUNELE1BQU0sVUFBVSxHQUFHLE1BQU0sVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoRCxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksc0JBQVcsQ0FBQyxJQUFJLGlDQUFpQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBRS9FLGdFQUFnRTtRQUNoRSxNQUFNLGFBQWEsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0MsT0FBTyxDQUFDLEdBQUcsQ0FBQyxJQUFJLHNCQUFXLENBQUMsSUFBSSxpREFBaUQsVUFBVSxFQUFFLENBQUMsQ0FBQztJQUNuRyxDQUFDO0lBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztRQUNYLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxzQkFBVyxDQUFDLElBQUksZ0NBQWdDLEVBQUUsR0FBRyxDQUFDLENBQUM7SUFDN0UsQ0FBQztJQUVELElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO1FBQ3JCLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUN4QixDQUFDO0FBQ0wsQ0FBQztBQUVELFNBQVMsTUFBTTtJQUNYLElBQUksVUFBVSxFQUFFLENBQUM7UUFDYixPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksc0JBQVcsQ0FBQyxJQUFJLDJCQUEyQixDQUFDLENBQUM7UUFDN0QsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ2xCLFVBQVUsR0FBRyxJQUFJLENBQUM7SUFDdEIsQ0FBQztBQUNMLENBQUM7QUFFRCxpREFBaUQ7QUFDakQsT0FBTyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDMUIsT0FBTyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7QUFDcEIsT0FBTyxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vcGFja2FnZS5qc29uJztcclxuaW1wb3J0IHsgVXRjcFNlcnZlck1hbmFnZXIgfSBmcm9tICcuL3V0Y3AvdXRjcC1zZXJ2ZXInO1xyXG5pbXBvcnQgeyBnZXRDb25maWdNYW5hZ2VyIH0gZnJvbSAnLi91dGNwL2NvbmZpZy1tYW5hZ2VyJztcclxuXHJcbmxldCB1dGNwU2VydmVyOiBVdGNwU2VydmVyTWFuYWdlciB8IG51bGwgPSBudWxsO1xyXG5cclxuXHJcbmNvbnN0IG1ldGhvZHM6IHsgW2tleTogc3RyaW5nXTogKC4uLmFueTogYW55KSA9PiBhbnkgfSA9IHtcclxuXHJcbiAgICBvcGVuUGFuZWwoKSB7XHJcbiAgICAgICAgRWRpdG9yLlBhbmVsLm9wZW4ocGFja2FnZUpTT04ubmFtZSArICcuY29uZmlndXJhdGlvbicpO1xyXG4gICAgfSxcclxuXHJcblxyXG4gICAgYXN5bmMgcmVzdGFydFNlcnZlcihuZXdQb3J0OiBudW1iZXIpIHtcclxuICAgICAgICBpZiAodXRjcFNlcnZlcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgWyR7cGFja2FnZUpTT04ubmFtZX1dIFJlc3RhcnRpbmcgVVRDUCBTZXJ2ZXIgb24gcG9ydCAke25ld1BvcnR9Li4uYCk7XHJcbiAgICAgICAgICAgIHV0Y3BTZXJ2ZXIuc3RvcCgpO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgYWN0dWFsUG9ydCA9IGF3YWl0IHV0Y3BTZXJ2ZXIuc3RhcnQobmV3UG9ydCk7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyhgWyR7cGFja2FnZUpTT04ubmFtZX1dIFVUQ1AgU2VydmVyIHJlc3RhcnRlZCBvbiBwb3J0ICR7YWN0dWFsUG9ydH1gKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8g0JjRgdC/0L7Qu9GM0LfRg9C10Lwg0LzQtdC90LXQtNC20LXRgCDQutC+0L3RhNC40LPRg9GA0LDRhtC40Lgg0LTQu9GPINC+0LHQvdC+0LLQu9C10L3QuNGPINC/0L7RgNGC0LBcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ01hbmFnZXIgPSBnZXRDb25maWdNYW5hZ2VyKCk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBjb25maWdNYW5hZ2VyLnVwZGF0ZVBvcnQoYWN0dWFsUG9ydCk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihgWyR7cGFja2FnZUpTT04ubmFtZX1dIEZhaWxlZCB0byByZXN0YXJ0IFVUQ1AgU2VydmVyOmAsIGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5hc3luYyBmdW5jdGlvbiBsb2FkKCkge1xyXG4gICAgLy8gSW5pdGlhbGl6ZSBjb25maWcgbWFuYWdlclxyXG4gICAgY29uc3QgY29uZmlnTWFuYWdlciA9IGdldENvbmZpZ01hbmFnZXIoKTtcclxuICAgIGF3YWl0IGNvbmZpZ01hbmFnZXIuaW5pdGlhbGl6ZSgpO1xyXG4gICAgXHJcbiAgICB1dGNwU2VydmVyID0gbmV3IFV0Y3BTZXJ2ZXJNYW5hZ2VyKCk7XHJcblxyXG4gICAgbGV0IHdhc0NvbmZpZ3VyZWRQb3J0ID0gdHJ1ZTtcclxuICAgIC8vIExvYWQgcG9ydCBmcm9tIHByb2ZpbGUsIGRlZmF1bHQgdG8gMCAocmFuZG9tIGZyZWUgcG9ydCkgaWYgbm90IHNldFxyXG4gICAgbGV0IHBvcnQgPSBhd2FpdCBFZGl0b3IuUHJvZmlsZS5nZXRDb25maWcocGFja2FnZUpTT04ubmFtZSwgJ3NlcnZlclBvcnQnKTtcclxuICAgIGlmICh0eXBlb2YgcG9ydCAhPT0gJ251bWJlcicpIHtcclxuICAgICAgICBwb3J0ID0gMDtcclxuICAgICAgICB3YXNDb25maWd1cmVkUG9ydCA9IGZhbHNlO1xyXG4gICAgfVxyXG5cclxuICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgYWN0dWFsUG9ydCA9IGF3YWl0IHV0Y3BTZXJ2ZXIuc3RhcnQocG9ydCk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFske3BhY2thZ2VKU09OLm5hbWV9XSBVVENQIFNlcnZlciBzdGFydGVkIG9uIHBvcnQgJHthY3R1YWxQb3J0fWApO1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIEF1dG9tYXRpY2FsbHkgdXBkYXRlIHRoZSBwb3J0IGluIHRoZSBjb25maWd1cmF0aW9uIG9uIHN0YXJ0dXBcclxuICAgICAgICBhd2FpdCBjb25maWdNYW5hZ2VyLnVwZGF0ZVBvcnQoYWN0dWFsUG9ydCk7XHJcbiAgICAgICAgY29uc29sZS5sb2coYFske3BhY2thZ2VKU09OLm5hbWV9XSBVVENQIGNvbmZpZyBhdXRvbWF0aWNhbGx5IHVwZGF0ZWQgd2l0aCBwb3J0ICR7YWN0dWFsUG9ydH1gKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoYFske3BhY2thZ2VKU09OLm5hbWV9XSBGYWlsZWQgdG8gc3RhcnQgVVRDUCBTZXJ2ZXI6YCwgZXJyKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIXdhc0NvbmZpZ3VyZWRQb3J0KSB7XHJcbiAgICAgICAgbWV0aG9kcy5vcGVuUGFuZWwoKTtcclxuICAgIH1cclxufVxyXG5cclxuZnVuY3Rpb24gdW5sb2FkKCkge1xyXG4gICAgaWYgKHV0Y3BTZXJ2ZXIpIHtcclxuICAgICAgICBjb25zb2xlLmxvZyhgWyR7cGFja2FnZUpTT04ubmFtZX1dIFN0b3BwaW5nIFVUQ1AgU2VydmVyLi4uYCk7XHJcbiAgICAgICAgdXRjcFNlcnZlci5zdG9wKCk7XHJcbiAgICAgICAgdXRjcFNlcnZlciA9IG51bGw7XHJcbiAgICB9XHJcbn1cclxuXHJcbi8vIENvY29zIGV4dGVuc2lvbiBsb2FkZXIgcmVhZHMgQ29tbW9uSlMgZXhwb3J0cy5cclxuZXhwb3J0cy5tZXRob2RzID0gbWV0aG9kcztcclxuZXhwb3J0cy5sb2FkID0gbG9hZDtcclxuZXhwb3J0cy51bmxvYWQgPSB1bmxvYWQ7XHJcbiJdfQ==