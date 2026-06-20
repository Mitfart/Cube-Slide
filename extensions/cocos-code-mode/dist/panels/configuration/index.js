"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const package_json_1 = __importDefault(require("../../../package.json"));
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const config_manager_1 = require("../../utcp/config-manager");
module.exports = Editor.Panel.define({
    listeners: {
        show() { console.log('show'); },
        hide() { console.log('hide'); },
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/configuration/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/configuration/index.css'), 'utf-8'),
    $: {
        app: '.panel',
        portInput: '#port-input',
        savePortBtn: '#save-port-btn',
        // MCP Integration
        mcpConfigCode: '#mcp-config-code',
        // UTCP Config
        utcpConfigPathInput: '#utcp-config-path',
        utcpConfigPathSaveBtn: '#save-utcp-path-btn',
        bridgeList: '#bridge-container',
        addBridgeBtn: '#add-bridge-btn',
        newTemplateJson: '#new-template-json',
    },
    methods: {
        async loadSettings() {
            const configManager = (0, config_manager_1.getConfigManager)();
            await configManager.initialize();
            // Update UI with config path
            if (this.$.utcpConfigPathInput) {
                this.$.utcpConfigPathInput.value = configManager.getConfigPath();
            }
            // Load Port
            const port = await configManager.getCurrentPort();
            if (this.$.portInput) {
                this.$.portInput.value = port || 0;
            }
            this.updateMcpCodeBlock();
            this.fetchBridgeList();
        },
        async saveSettings() {
            const newPath = this.$.utcpConfigPathInput.value;
            if (newPath) {
                const configManager = (0, config_manager_1.getConfigManager)();
                await configManager.setConfigPath(newPath);
                this.updateMcpCodeBlock();
                this.fetchBridgeList(); // Reload templates from new path
                console.log('Saved UTCP Config Path:', newPath);
            }
        },
        async updatePort() {
            const portVal = this.$.portInput.value;
            const port = parseInt(portVal);
            console.log(`Updating port to: ${port}`);
            // Send message to main process to restart server
            Editor.Message.send(package_json_1.default.name, 'restart-server', port);
        },
        updateMcpCodeBlock() {
            const codeEl = this.$.mcpConfigCode;
            if (!codeEl)
                return;
            const configManager = (0, config_manager_1.getConfigManager)();
            const configPath = configManager.getConfigPath();
            const config = {
                "mcpServers": {
                    "code-mode": {
                        "command": "npx",
                        "args": ["-y", "@utcp/code-mode-mcp"],
                        "env": {
                            "UTCP_CONFIG_FILE": configPath
                        }
                    }
                }
            };
            codeEl.textContent = JSON.stringify(config, null, 2);
        },
        fetchBridgeList() {
            const container = this.$.bridgeList;
            if (!container) {
                console.warn('Bridge Config Container not found');
                return;
            }
            // Clear "Loading..." or previous content
            container.innerHTML = '';
            const configManager = (0, config_manager_1.getConfigManager)();
            const config = configManager.readConfig();
            const templates = config.manual_call_templates || [];
            if (templates.length === 0) {
                container.innerHTML = '<div style="padding:10px; color: #888;">No templates found.</div>';
            }
            else {
                let html = '';
                templates.forEach((t) => {
                    const isCocos = t.name === 'CocosEditor';
                    const delBtn = isCocos
                        ? `` // No delete for Cocos
                        : `<ui-button slot="header" type="danger" class="remove-btn" tooltip="Remove Template">
                             <ui-icon value="del"></ui-icon>
                           </ui-button>`;
                    const headerText = `${t.name} (${t.call_template_type})`;
                    html += `
                    <ui-section class="bridge-item-section" data-name="${t.name}">
                        <div slot="header" style="display: flex; justify-content: space-between; align-items: center; width: 100%; padding-right: 10px;">
                            <ui-label>${headerText}</ui-label>
                            ${delBtn}
                        </div>
                        <div class="bridge-item-content">
                             <ui-code language="json" readonly id="code-${t.name}"></ui-code>
                        </div>
                    </ui-section>
                    `;
                });
                container.innerHTML = html;
                // Now populate the code values correctly
                templates.forEach((t) => {
                    const el = container.querySelector(`#code-${t.name}`);
                    if (el)
                        el.textContent = JSON.stringify(t, null, 2);
                });
            }
        },
        addBridgeTemplate() {
            const input = this.$.newTemplateJson;
            if (!input)
                return;
            const content = input.value.trim();
            if (!content)
                return;
            try {
                let newTpl = JSON.parse(content);
                // Validate with @utcp/sdk or simple schema
                if (!newTpl.name || !newTpl.call_template_type) {
                    alert('Invalid template. Must have name and call_template_type.');
                    return;
                }
                const configManager = (0, config_manager_1.getConfigManager)();
                const config = configManager.readConfig();
                // Check duplicates
                if (config.manual_call_templates.find((t) => t.name === newTpl.name)) {
                    alert(`Template ${newTpl.name} already exists.`);
                    return;
                }
                config.manual_call_templates.push(newTpl);
                configManager.writeConfig(config);
                input.value = '';
                this.fetchBridgeList();
            }
            catch (e) {
                alert('Invalid JSON: ' + e.message);
            }
        },
        removeBridge(name) {
            if (name === 'CocosEditor')
                return;
            if (!confirm(`Remove template ${name}?`))
                return;
            const configManager = (0, config_manager_1.getConfigManager)();
            const config = configManager.readConfig();
            if (config.manual_call_templates) {
                config.manual_call_templates = config.manual_call_templates.filter((t) => t.name !== name);
                configManager.writeConfig(config);
                this.fetchBridgeList();
            }
        },
    },
    ready() {
        this.loadSettings();
        // Listeners
        const savePort = this.$.savePortBtn;
        if (savePort)
            savePort.addEventListener('click', () => this.updatePort());
        const savePath = this.$.utcpConfigPathSaveBtn;
        if (savePath)
            savePath.addEventListener('click', () => this.saveSettings());
        const addBtn = this.$.addBridgeBtn;
        if (addBtn)
            addBtn.addEventListener('click', () => this.addBridgeTemplate());
        const list = this.$.bridgeList;
        if (list) {
            list.addEventListener('click', (e) => {
                // Handle delete clicks
                const btn = e.target.closest('.remove-btn');
                if (btn) {
                    // In new structure, btn is inside .bridge-item-content inside ui-section
                    const section = btn.closest('.bridge-item-section');
                    if (section && section.dataset.name) {
                        this.removeBridge(section.dataset.name);
                    }
                }
            });
        }
    },
    beforeClose() { },
    close() { },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2NvbmZpZ3VyYXRpb24vaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx5RUFBZ0Q7QUFDaEQsdUNBQXdDO0FBQ3hDLCtCQUE0QjtBQUM1Qiw4REFBNkQ7QUFFN0QsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxTQUFTLEVBQUU7UUFDUCxJQUFJLEtBQUssT0FBTyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0IsSUFBSSxLQUFLLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO0tBQ2xDO0lBQ0QsUUFBUSxFQUFFLElBQUEsdUJBQVksRUFBQyxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsbURBQW1ELENBQUMsRUFBRSxPQUFPLENBQUM7SUFDckcsS0FBSyxFQUFFLElBQUEsdUJBQVksRUFBQyxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsK0NBQStDLENBQUMsRUFBRSxPQUFPLENBQUM7SUFDOUYsQ0FBQyxFQUFFO1FBQ0MsR0FBRyxFQUFFLFFBQVE7UUFDYixTQUFTLEVBQUUsYUFBYTtRQUN4QixXQUFXLEVBQUUsZ0JBQWdCO1FBRTdCLGtCQUFrQjtRQUNsQixhQUFhLEVBQUUsa0JBQWtCO1FBRWpDLGNBQWM7UUFDZCxtQkFBbUIsRUFBRSxtQkFBbUI7UUFDeEMscUJBQXFCLEVBQUUscUJBQXFCO1FBQzVDLFVBQVUsRUFBRSxtQkFBbUI7UUFDL0IsWUFBWSxFQUFFLGlCQUFpQjtRQUMvQixlQUFlLEVBQUUsb0JBQW9CO0tBQ3hDO0lBRUQsT0FBTyxFQUFFO1FBQ0wsS0FBSyxDQUFDLFlBQVk7WUFDZCxNQUFNLGFBQWEsR0FBRyxJQUFBLGlDQUFnQixHQUFFLENBQUM7WUFDekMsTUFBTSxhQUFhLENBQUMs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TUFBTSxHQUFHLElBQUksQ0FBQyxDQUFDLENBQUMsWUFBMkIsQ0FBQztRQUNsRCxJQUFJLE1BQU07WUFBRSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLENBQUM7UUFFN0UsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUF5QixDQUFDO1FBQzlDLElBQUksSUFBSSxFQUFFLENBQUM7WUFDUCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBTSxFQUFFLEVBQUU7Z0JBQ3RDLHVCQUF1QjtnQkFDdkIsTUFBTSxHQUFHLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQzVDLElBQUksR0FBRyxFQUFFLENBQUM7b0JBQ04seUVBQXlFO29CQUN6RSxNQUFNLE9BQU8sR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7b0JBQ3BELElBQUksT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7d0JBQ2xDLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDNUMsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDUCxDQUFDO0lBQ0wsQ0FBQztJQUNELFdBQVcsS0FBSyxDQUFDO0lBQ2pCLEtBQUssS0FBSyxDQUFDO0NBQ2QsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHBhY2thZ2VKU09OIGZyb20gJy4uLy4uLy4uL3BhY2thZ2UuanNvbic7XHJcbmltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzLWV4dHJhJztcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBnZXRDb25maWdNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vdXRjcC9jb25maWctbWFuYWdlcic7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEVkaXRvci5QYW5lbC5kZWZpbmUoe1xyXG4gICAgbGlzdGVuZXJzOiB7XHJcbiAgICAgICAgc2hvdygpIHsgY29uc29sZS5sb2coJ3Nob3cnKTsgfSxcclxuICAgICAgICBoaWRlKCkgeyBjb25zb2xlLmxvZygnaGlkZScpOyB9LFxyXG4gICAgfSxcclxuICAgIHRlbXBsYXRlOiByZWFkRmlsZVN5bmMoam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvdGVtcGxhdGUvY29uZmlndXJhdGlvbi9pbmRleC5odG1sJyksICd1dGYtOCcpLFxyXG4gICAgc3R5bGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy9zdHlsZS9jb25maWd1cmF0aW9uL2luZGV4LmNzcycpLCAndXRmLTgnKSxcclxuICAgICQ6IHtcclxuICAgICAgICBhcHA6ICcucGFuZWwnLFxyXG4gICAgICAgIHBvcnRJbnB1dDogJyNwb3J0LWlucHV0JyxcclxuICAgICAgICBzYXZlUG9ydEJ0bjogJyNzYXZlLXBvcnQtYnRuJyxcclxuXHJcbiAgICAgICAgLy8gTUNQIEludGVncmF0aW9uXHJcbiAgICAgICAgbWNwQ29uZmlnQ29kZTogJyNtY3AtY29uZmlnLWNvZGUnLFxyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFVUQ1AgQ29uZmlnXHJcbiAgICAgICAgdXRjcENvbmZpZ1BhdGhJbnB1dDogJyN1dGNwLWNvbmZpZy1wYXRoJyxcclxuICAgICAgICB1dGNwQ29uZmlnUGF0aFNhdmVCdG46ICcjc2F2ZS11dGNwLXBhdGgtYnRuJyxcclxuICAgICAgICBicmlkZ2VMaXN0OiAnI2JyaWRnZS1jb250YWluZXInLFxyXG4gICAgICAgIGFkZEJyaWRnZUJ0bjogJyNhZGQtYnJpZGdlLWJ0bicsXHJcbiAgICAgICAgbmV3VGVtcGxhdGVKc29uOiAnI25ldy10ZW1wbGF0ZS1qc29uJyxcclxuICAgIH0sXHJcblxyXG4gICAgbWV0aG9kczoge1xyXG4gICAgICAgIGFzeW5jIGxvYWRTZXR0aW5ncygpIHtcclxuICAgICAgICAgICAgY29uc3QgY29uZmlnTWFuYWdlciA9IGdldENvbmZpZ01hbmFnZXIoKTtcclxuICAgICAgICAgICAgYXdhaXQgY29uZmlnTWFuYWdlci5pbml0aWFsaXplKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBVcGRhdGUgVUkgd2l0aCBjb25maWcgcGF0aFxyXG4gICAgICAgICAgICBpZiAodGhpcy4kLnV0Y3BDb25maWdQYXRoSW5wdXQpIHtcclxuICAgICAgICAgICAgICAgICh0aGlzLiQudXRjcENvbmZpZ1BhdGhJbnB1dCBhcyBhbnkpLnZhbHVlID0gY29uZmlnTWFuYWdlci5nZXRDb25maWdQYXRoKCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIExvYWQgUG9ydFxyXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gYXdhaXQgY29uZmlnTWFuYWdlci5nZXRDdXJyZW50UG9ydCgpO1xyXG4gICAgICAgICAgICBpZiAodGhpcy4kLnBvcnRJbnB1dCkge1xyXG4gICAgICAgICAgICAgICAgKHRoaXMuJC5wb3J0SW5wdXQgYXMgYW55KS52YWx1ZSA9IHBvcnQgfHwgMDtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy51cGRhdGVNY3BDb2RlQmxvY2soKTtcclxuICAgICAgICAgICAgdGhpcy5mZXRjaEJyaWRnZUxpc3QoKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBhc3luYyBzYXZlU2V0dGluZ3MoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSAodGhpcy4kLnV0Y3BDb25maWdQYXRoSW5wdXQgYXMgYW55KS52YWx1ZTtcclxuICAgICAgICAgICAgaWYgKG5ld1BhdGgpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ01hbmFnZXIgPSBnZXRDb25maWdNYW5hZ2VyKCk7XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBjb25maWdNYW5hZ2VyLnNldENvbmZpZ1BhdGgobmV3UGF0aCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZU1jcENvZGVCbG9jaygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mZXRjaEJyaWRnZUxpc3QoKTsgLy8gUmVsb2FkIHRlbXBsYXRlcyBmcm9tIG5ldyBwYXRoXHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnU2F2ZWQgVVRDUCBDb25maWcgUGF0aDonLCBuZXdQYXRoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGFzeW5jIHVwZGF0ZVBvcnQoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBvcnRWYWwgPSAodGhpcy4kLnBvcnRJbnB1dCBhcyBhbnkpLnZhbHVlO1xyXG4gICAgICAgICAgICBjb25zdCBwb3J0ID0gcGFyc2VJbnQocG9ydFZhbCk7XHJcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBVcGRhdGluZyBwb3J0IHRvOiAke3BvcnR9YCk7XHJcbiAgICAgICAgICAgIC8vIFNlbmQgbWVzc2FnZSB0byBtYWluIHByb2Nlc3MgdG8gcmVzdGFydCBzZXJ2ZXJcclxuICAgICAgICAgICAgRWRpdG9yLk1lc3NhZ2Uuc2VuZChwYWNrYWdlSlNPTi5uYW1lLCAncmVzdGFydC1zZXJ2ZXInLCBwb3J0KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICB1cGRhdGVNY3BDb2RlQmxvY2soKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvZGVFbCA9IHRoaXMuJC5tY3BDb25maWdDb2RlIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoIWNvZGVFbCkgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY29uZmlnTWFuYWdlciA9IGdldENvbmZpZ01hbmFnZXIoKTtcclxuICAgICAgICAgICAgY29uc3QgY29uZmlnUGF0aCA9IGNvbmZpZ01hbmFnZXIuZ2V0Q29uZmlnUGF0aCgpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY29uZmlnID0ge1xyXG4gICAgICAgICAgICAgICAgXCJtY3BTZXJ2ZXJzXCI6IHtcclxuICAgICAgICAgICAgICAgICAgICBcImNvZGUtbW9kZVwiOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFwiY29tbWFuZFwiOiBcIm5weFwiLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImFyZ3NcIjogW1wiLXlcIiwgXCJAdXRjcC9jb2RlLW1vZGUtbWNwXCJdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcImVudlwiOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIlVUQ1BfQ09ORklHX0ZJTEVcIjogY29uZmlnUGF0aFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgY29kZUVsLnRleHRDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoY29uZmlnLCBudWxsLCAyKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBmZXRjaEJyaWRnZUxpc3QoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IHRoaXMuJC5icmlkZ2VMaXN0IGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoIWNvbnRhaW5lcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdCcmlkZ2UgQ29uZmlnIENvbnRhaW5lciBub3QgZm91bmQnKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQ2xlYXIgXCJMb2FkaW5nLi4uXCIgb3IgcHJldmlvdXMgY29udGVudFxyXG4gICAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gJyc7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBjb25maWdNYW5hZ2VyID0gZ2V0Q29uZmlnTWFuYWdlcigpO1xyXG4gICAgICAgICAgICBjb25zdCBjb25maWcgPSBjb25maWdNYW5hZ2VyLnJlYWRDb25maWcoKTtcclxuICAgICAgICAgICAgY29uc3QgdGVtcGxhdGVzID0gY29uZmlnLm1hbnVhbF9jYWxsX3RlbXBsYXRlcyB8fCBbXTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0ZW1wbGF0ZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gJzxkaXYgc3R5bGU9XCJwYWRkaW5nOjEwcHg7IGNvbG9yOiAjODg4O1wiPk5vIHRlbXBsYXRlcyBmb3VuZC48L2Rpdj4nO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgbGV0IGh0bWwgPSAnJztcclxuICAgICAgICAgICAgICAgIHRlbXBsYXRlcy5mb3JFYWNoKCh0OiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpc0NvY29zID0gdC5uYW1lID09PSAnQ29jb3NFZGl0b3InO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlbEJ0biA9IGlzQ29jb3NcclxuICAgICAgICAgICAgICAgICAgICAgICAgPyBgYCAvLyBObyBkZWxldGUgZm9yIENvY29zXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDogYDx1aS1idXR0b24gc2xvdD1cImhlYWRlclwiIHR5cGU9XCJkYW5nZXJcIiBjbGFzcz1cInJlbW92ZS1idG5cIiB0b29sdGlwPVwiUmVtb3ZlIFRlbXBsYXRlXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHVpLWljb24gdmFsdWU9XCJkZWxcIj48L3VpLWljb24+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvdWktYnV0dG9uPmA7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhlYWRlclRleHQgPSBgJHt0Lm5hbWV9ICgke3QuY2FsbF90ZW1wbGF0ZV90eXBlfSlgO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBodG1sICs9IGBcclxuICAgICAgICAgICAgICAgICAgICA8dWktc2VjdGlvbiBjbGFzcz1cImJyaWRnZS1pdGVtLXNlY3Rpb25cIiBkYXRhLW5hbWU9XCIke3QubmFtZX1cIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBzbG90PVwiaGVhZGVyXCIgc3R5bGU9XCJkaXNwbGF5OiBmbGV4OyBqdXN0aWZ5LWNvbnRlbnQ6IHNwYWNlLWJldHdlZW47IGFsaWduLWl0ZW1zOiBjZW50ZXI7IHdpZHRoOiAxMDAlOyBwYWRkaW5nLXJpZ2h0OiAxMHB4O1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHVpLWxhYmVsPiR7aGVhZGVyVGV4dH08L3VpLWxhYmVsPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJHtkZWxCdG59XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnJpZGdlLWl0ZW0tY29udGVudFwiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIDx1aS1jb2RlIGxhbmd1YWdlPVwianNvblwiIHJlYWRvbmx5IGlkPVwiY29kZS0ke3QubmFtZX1cIj48L3VpLWNvZGU+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIDwvdWktc2VjdGlvbj5cclxuICAgICAgICAgICAgICAgICAgICBgO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIuaW5uZXJIVE1MID0gaHRtbDtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBOb3cgcG9wdWxhdGUgdGhlIGNvZGUgdmFsdWVzIGNvcnJlY3RseVxyXG4gICAgICAgICAgICAgICAgdGVtcGxhdGVzLmZvckVhY2goKHQ6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGVsID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoYCNjb2RlLSR7dC5uYW1lfWApIGFzIGFueTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZWwpIGVsLnRleHRDb250ZW50ID0gSlNPTi5zdHJpbmdpZnkodCwgbnVsbCwgMik7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGFkZEJyaWRnZVRlbXBsYXRlKCkge1xyXG4gICAgICAgICAgICBjb25zdCBpbnB1dCA9IHRoaXMuJC5uZXdUZW1wbGF0ZUpzb24gYXMgYW55O1xyXG4gICAgICAgICAgICBpZiAoIWlucHV0KSByZXR1cm47XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbnRlbnQgPSBpbnB1dC52YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICAgIGlmICghY29udGVudCkgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGxldCBuZXdUcGwgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xyXG4gICAgICAgICAgICAgICAgLy8gVmFsaWRhdGUgd2l0aCBAdXRjcC9zZGsgb3Igc2ltcGxlIHNjaGVtYVxyXG4gICAgICAgICAgICAgICAgaWYgKCFuZXdUcGwubmFtZSB8fCAhbmV3VHBsLmNhbGxfdGVtcGxhdGVfdHlwZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFsZXJ0KCdJbnZhbGlkIHRlbXBsYXRlLiBNdXN0IGhhdmUgbmFtZSBhbmQgY2FsbF90ZW1wbGF0ZV90eXBlLicpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb25maWdNYW5hZ2VyID0gZ2V0Q29uZmlnTWFuYWdlcigpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29uZmlnID0gY29uZmlnTWFuYWdlci5yZWFkQ29uZmlnKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgZHVwbGljYXRlc1xyXG4gICAgICAgICAgICAgICAgaWYgKGNvbmZpZy5tYW51YWxfY2FsbF90ZW1wbGF0ZXMuZmluZCgodDogYW55KSA9PiB0Lm5hbWUgPT09IG5ld1RwbC5uYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGFsZXJ0KGBUZW1wbGF0ZSAke25ld1RwbC5uYW1lfSBhbHJlYWR5IGV4aXN0cy5gKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgY29uZmlnLm1hbnVhbF9jYWxsX3RlbXBsYXRlcy5wdXNoKG5ld1RwbCk7XHJcbiAgICAgICAgICAgICAgICBjb25maWdNYW5hZ2VyLndyaXRlQ29uZmlnKGNvbmZpZyk7XHJcbiAgICAgICAgICAgICAgICBpbnB1dC52YWx1ZSA9ICcnO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5mZXRjaEJyaWRnZUxpc3QoKTtcclxuXHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGU6IGFueSkge1xyXG4gICAgICAgICAgICAgICAgYWxlcnQoJ0ludmFsaWQgSlNPTjogJyArIGUubWVzc2FnZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICByZW1vdmVCcmlkZ2UobmFtZTogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIGlmIChuYW1lID09PSAnQ29jb3NFZGl0b3InKSByZXR1cm47XHJcbiAgICAgICAgICAgIGlmICghY29uZmlybShgUmVtb3ZlIHRlbXBsYXRlICR7bmFtZX0/YCkpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZ01hbmFnZXIgPSBnZXRDb25maWdNYW5hZ2VyKCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGNvbmZpZ01hbmFnZXIucmVhZENvbmZpZygpO1xyXG4gICAgICAgICAgICBpZiAoY29uZmlnLm1hbnVhbF9jYWxsX3RlbXBsYXRlcykge1xyXG4gICAgICAgICAgICAgICAgY29uZmlnLm1hbnVhbF9jYWxsX3RlbXBsYXRlcyA9IGNvbmZpZy5tYW51YWxfY2FsbF90ZW1wbGF0ZXMuZmlsdGVyKCh0OiBhbnkpID0+IHQubmFtZSAhPT0gbmFtZSk7XHJcbiAgICAgICAgICAgICAgICBjb25maWdNYW5hZ2VyLndyaXRlQ29uZmlnKGNvbmZpZyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZldGNoQnJpZGdlTGlzdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuICAgIH0sXHJcbiAgICByZWFkeSgpIHtcclxuICAgICAgICB0aGlzLmxvYWRTZXR0aW5ncygpO1xyXG5cclxuICAgICAgICAvLyBMaXN0ZW5lcnNcclxuICAgICAgICBjb25zdCBzYXZlUG9ydCA9IHRoaXMuJC5zYXZlUG9ydEJ0biBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBpZiAoc2F2ZVBvcnQpIHNhdmVQb3J0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy51cGRhdGVQb3J0KCkpO1xyXG5cclxuICAgICAgICBjb25zdCBzYXZlUGF0aCA9IHRoaXMuJC51dGNwQ29uZmlnUGF0aFNhdmVCdG4gYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgaWYgKHNhdmVQYXRoKSBzYXZlUGF0aC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuc2F2ZVNldHRpbmdzKCkpO1xyXG5cclxuICAgICAgICBjb25zdCBhZGRCdG4gPSB0aGlzLiQuYWRkQnJpZGdlQnRuIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIGlmIChhZGRCdG4pIGFkZEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuYWRkQnJpZGdlVGVtcGxhdGUoKSk7XHJcblxyXG4gICAgICAgIGNvbnN0IGxpc3QgPSB0aGlzLiQuYnJpZGdlTGlzdCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBpZiAobGlzdCkge1xyXG4gICAgICAgICAgICBsaXN0LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGU6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gSGFuZGxlIGRlbGV0ZSBjbGlja3NcclxuICAgICAgICAgICAgICAgIGNvbnN0IGJ0biA9IGUudGFyZ2V0LmNsb3Nlc3QoJy5yZW1vdmUtYnRuJyk7XHJcbiAgICAgICAgICAgICAgICBpZiAoYnRuKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSW4gbmV3IHN0cnVjdHVyZSwgYnRuIGlzIGluc2lkZSAuYnJpZGdlLWl0ZW0tY29udGVudCBpbnNpZGUgdWktc2VjdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNlY3Rpb24gPSBidG4uY2xvc2VzdCgnLmJyaWRnZS1pdGVtLXNlY3Rpb24nKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2VjdGlvbiAmJiBzZWN0aW9uLmRhdGFzZXQubmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbW92ZUJyaWRnZShzZWN0aW9uLmRhdGFzZXQubmFtZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG4gICAgYmVmb3JlQ2xvc2UoKSB7IH0sXHJcbiAgICBjbG9zZSgpIHsgfSxcclxufSk7Il19