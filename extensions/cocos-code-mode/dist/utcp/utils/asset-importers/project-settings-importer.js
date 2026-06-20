"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSettingsImporter = void 0;
class ProjectSettingsImporter {
    get name() {
        return 'project-settings';
    }
    get className() {
        return 'ProjectSettings';
    }
    async getProperties(assetInfo) {
        try {
            // Get actual config
            const projectConfig = await Editor.Message.request('project', 'query-config', 'project') || {};
            // Build manual properties
            return this.buildProperties(projectConfig);
        }
        catch (e) {
            console.warn('[ProjectSettingsImporter] Failed to query project settings:', e);
            return {};
        }
    }
    async setProperty(assetInfo, path, value) {
        try {
            // Handle Custom Layers
            if (path.startsWith('customLayers')) {
                return this.setLayerProperty(path, value);
            }
            // Handle Sorting Layers
            if (path.startsWith('sortingLayers')) {
                return this.setSortingLayerProperty(path, value);
            }
            // Handle Physics Collision Groups
            if (path.startsWith('physics.collisionGroups')) {
                return this.setCollisionGroupProperty(path, value);
            }
            // Handle General Settings
            if (path.startsWith('general')) {
                return this.setGeneralProperty(path, value);
            }
            // Handle Default Material (Reference Unwrap)
            if (path === 'physics.defaultMaterial' && value && typeof value === 'object' && value.uuid) {
                value = value.uuid;
            }
            // Handle Collision Matrix (Object vs Array)
            // If path is physics.collisionMatrix.5, it maps to physics.collisionMatrix["5"] which is fine.
            await Editor.Message.request('project', 'set-config', 'project', path, value);
            return true;
        }
        catch (e) {
            console.warn('[ProjectSettingsImporter] Failed to set project settings:', e);
            return false;
        }
    }
    async setGeneralProperty(path, value) {
        const config = await Editor.Message.request('project', 'query-config', 'project');
        const general = config.general || {};
        const parts = path.split('.');
        const key = parts[1];
        if (key === 'designResolution') {
            // sub-properties: general.designResolution.width
            if (parts.length === 3) {
                const subKey = parts[2];
                general.designResolution[subKey] = value;
            }
            else {
                // general.designResolution (Replace size values)
                if (value && typeof value === 'object') {
                    if ('width' in value)
                        general.designResolution.width = value.width;
                    if ('height' in value)
                        general.designResolution.height = value.height;
                }
            }
        }
        else if (key === 'fitWidth' || key === 'fitHeight') {
            general.designResolution[key] = value;
        }
        else {
            general[key] = value;
        }
        await Editor.Message.request('project', 'set-config', 'project', 'general', general);
        return true;
    }
    async setCollisionGroupProperty(path, value) {
        // path: physics.collisionGroups.0.name or physics.collisionGroups.0
        const parts = path.split('.');
        const indexStr = parts[2];
        if (!indexStr)
            return false;
        const index = parseInt(indexStr);
        if (isNaN(index))
            return false;
        const config = await Editor.Message.request('project', 'query-config', 'project');
        const physics = config.physics || {};
        const groups = physics.collisionGroups || [];
        let newName = "";
        if (typeof value === 'string')
            newName = value;
        else if (typeof value === 'object' && value.name)
            newName = value.name;
        // Note: 'index' variable here refers to the ARRAY INDEX in the configuration list,
        // NOT the collision group index (1 << groupIndex).
        if (index < groups.length) {
            // Modification
            if (newName)
                groups[index].name = newName;
        }
        else if (index === groups.length) {
            // Creation: Find first available group index (0..31)
            const usedIndices = new Set(groups.map((g) => g.index));
            // Usually 0 is Default.
            if (!usedIndices.has(0))
                usedIndices.add(0); // Treat 0 as used usually
            let nextGroupIndex = 1;
            while (usedIndices.has(nextGroupIndex)) {
                nextGroupIndex++;
            }
            if (nextGroupIndex > 31) {
                console.warn('Max collision groups reached (32).');
                return false;
            }
            groups.push({
                index: nextGroupIndex,
                name: newName || `Group ${nextGroupIndex}`
            });
        }
        else {
            return false;
        }
        physics.collisionGroups = groups;
        await Editor.Message.request('project', 'set-config', 'project', 'physics', physics);
        return true;
    }
    async setSortingLayerProperty(path, value) {
        // path: sortingLayers.0 or sortingLayers.0.name
        const parts = path.split('.');
        const indexStr = parts[1];
        if (!indexStr)
            return false;
        const index = parseInt(indexStr);
        if (isNaN(index))
            return false;
        const config = await Editor.Message.request('project', 'query-config', 'project');
        const sortingInfo = config['sorting-layer'] || { layers: [], increaseId: 0 };
        const layers = sortingInfo.layers || [];
        // Determine what we are setting
        let patchData = {};
        if (parts.length === 2) {
            if (typeof value === 'string')
                patchData = { name: value };
            else
                patchData = value;
        }
        else if (parts.length === 3) {
            const field = parts[2];
            patchData[field] = value;
        }
        else {
            return false;
        }
        if (index < layers.length) {
            // Modification
            layers[index] = Object.assign(Object.assign({}, layers[index]), patchData);
        }
        else if (index === layers.length) {
            // Creation
            const newId = (sortingInfo.increaseId || 0) + 1;
            sortingInfo.increaseId = newId;
            let newValue = patchData.value;
            if (newValue === undefined) {
                const maxVal = layers.reduce((max, l) => (l.value !== undefined && l.value > max) ? l.value : max, -1);
                newValue = maxVal + 1;
            }
            const newLayer = {
                id: newId,
                name: patchData.name || `Layer ${newId}`,
                value: newValue
            };
            layers.push(newLayer);
        }
        else {
            return false;
        }
        sortingInfo.layers = layers;
        // Update the full sorting-layer object to ensure increaseId and set-config sync
        await Editor.Message.request('project', 'set-config', 'project', 'sorting-layer', sortingInfo);
        return true;
    }
    async setLayerProperty(path, value) {
        // parsing path: customLayers.0.name or customLayers.0
        const parts = path.split('.');
        const indexStr = parts[1];
        if (!indexStr)
            return false;
        const index = parseInt(indexStr);
        if (isNaN(index))
            return false;
        let newName = "";
        if (typeof value === 'string')
            newName = value;
        else if (typeof value === 'object' && value.name)
            newName = value.name;
        await Editor.Message.request('project', 'set-config', 'project', `layer.${index}`, { name: newName, value: 1 << (index + 1) });
        return true;
    }
    buildProperties(data) {
        const result = {};
        result['sortingLayers'] = {
            value: data && data['sorting-layer'] && data['sorting-layer'].layers ? this.buildSortingLayerProperties(data['sorting-layer'].layers) : [],
            extends: [],
            type: 'SortingLayerItem',
            isArray: true,
            tooltip: 'Sorting layers for sprites'
        };
        result['customLayers'] = {
            value: data && data.layer ? this.buildLayerProperties(data.layer) : [],
            extends: [],
            type: 'LayerItem',
            isArray: true,
            tooltip: 'User defined rendering layers'
        };
        result['physics'] = {
            value: data && data.physics ? this.buildPhysicsProperties(data.physics) : {},
            type: 'PhysicsSettings'
        };
        result['general'] = {
            value: data && data.general ? this.buildGeneralProperties(data.general) : {},
            type: 'GeneralSettings'
        };
        return result;
    }
    buildGeneralProperties(general) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const result = {};
        result['designResolution'] = {
            value: { width: (_b = (_a = general.designResolution) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 1280, height: (_d = (_c = general.designResolution) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 720 },
            type: 'cc.Size',
            extends: ['cc.ValueType']
        };
        result['fitWidth'] = { value: (_f = (_e = general.designResolution) === null || _e === void 0 ? void 0 : _e.fitWidth) !== null && _f !== void 0 ? _f : false, type: 'Boolean' };
        result['fitHeight'] = { value: (_h = (_g = general.designResolution) === null || _g === void 0 ? void 0 : _g.fitHeight) !== null && _h !== void 0 ? _h : false, type: 'Boolean' };
        result['downloadMaxConcurrency'] = { value: (_j = general.downloadMaxConcurrency) !== null && _j !== void 0 ? _j : 15, type: 'Integer', min: 1 };
        result['highQuality'] = { value: (_k = general.highQuality) !== null && _k !== void 0 ? _k : false, type: 'Boolean' };
        return result;
    }
    buildPhysicsProperties(physics) {
        const result = {};
        // Simple props
        const props = [
            { key: 'allowSleep', type: 'Boolean' },
            { key: 'autoSimulation', type: 'Boolean' },
            { key: 'sleepThreshold', type: 'Float' },
            { key: 'fixedTimeStep', type: 'Float', options: { min: 0 } },
            { key: 'maxSubSteps', type: 'Integer', options: { min: 1 } },
        ];
        for (const p of props) {
            if (p.key in physics) {
                result[p.key] = Object.assign({ value: physics[p.key], type: p.type }, p.options);
            }
        }
        if (physics.gravity) {
            result['gravity'] = { value: physics.gravity, type: 'cc.Vec3', extends: ['cc.ValueType'] };
        }
        result['defaultMaterial'] = {
            value: physics.defaultMaterial ? { uuid: physics.defaultMaterial } : null,
            type: 'cc.PhysicsMaterial',
            extends: ['cc.Object']
        };
        // Collision Groups
        const groups = physics.collisionGroups || [];
        result['collisionGroups'] = {
            value: groups.map((g) => ({
                value: {
                    index: { value: g.index, type: 'Integer', readonly: true },
                    name: { value: g.name, type: 'String' }
                },
                type: 'CollisionGroupItem'
            })),
            type: 'CollisionGroupItem',
            isArray: true,
            elementTypeData: {
                type: 'CollisionGroupItem',
                value: {
                    index: { value: 0, type: 'Integer', readonly: true },
                    name: { value: '', type: 'String' }
                }
            }
        };
        // Collision Matrix
        const bitmaskList = [];
        // Default group 0
        const defaultGroup = groups.find((g) => g.index === 0);
        bitmaskList.push({ name: defaultGroup ? defaultGroup.name : 'DEFAULT', value: 1 << 0 });
        for (const g of groups) {
            if (g.index !== 0) {
                bitmaskList.push({ name: g.name, value: 1 << g.index });
            }
        }
        const matrixObj = physics.collisionMatrix || {};
        const matrixArr = [];
        // Calculate max index to display
        const indices = [0, ...groups.map((g) => g.index), ...Object.keys(matrixObj).map(k => parseInt(k))];
        const maxIndex = Math.max(...indices);
        for (let i = 0; i <= maxIndex; i++) {
            matrixArr.push({
                value: matrixObj[i] || 0,
                type: 'BitMask',
                bitmaskList: bitmaskList
            });
        }
        result['collisionMatrix'] = {
            value: matrixArr,
            type: 'BitMask',
            isArray: true,
            elementTypeData: {
                type: 'BitMask',
                value: 0,
                bitmaskList: bitmaskList
            }
        };
        return result;
    }
    buildSortingLayerProperties(layers) {
        return layers.map(layer => ({
            extends: [],
            value: {
                id: {
                    value: layer.id,
                    type: 'Integer',
                    readonly: true
                },
                name: {
                    value: layer.name,
                    type: 'String'
                },
                value: {
                    value: layer.value,
                    type: 'Integer'
                }
            },
            type: 'SortingLayerItem'
        }));
    }
    buildLayerProperties(layers) {
        return layers.map(layer => ({
            extends: [],
            value: {
                name: {
                    value: layer.name,
                    type: 'String'
                },
                value: {
                    value: layer.value,
                    type: 'Integer',
                    readonly: true
                }
            },
            type: 'LayerItem'
        }));
    }
}
exports.ProjectSettingsImporter = ProjectSettingsImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvamVjdC1zZXR0aW5ncy1pbXBvcnRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NvdXJjZS91dGNwL3V0aWxzL2Fzc2V0LWltcG9ydGVycy9wcm9qZWN0LXNldHRpbmdzLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQU1BLE1BQWEsdUJBQXVCO0lBQ2hDLElBQUksSUFBSTtRQUNKLE9BQU8sa0JBQWtCLENBQUM7SUFDOUIsQ0FBQztJQUVELElBQUksU0FBUztRQUNULE9BQU8saUJBQWlCLENBQUM7SUFDN0IsQ0FBQztJQUVELEtBQUssQ0FBQyxhQUFhLENBQUMsU0FBb0I7UUFDcEMsSUFBSSxDQUFDO1lBQ0Qsb0JBQW9CO1lBQ3BCLE1BQU0sYUFBYSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLGNBQWMsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLENBQUM7WUFFL0YsMEJBQTBCO1lBQzFCLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNULE9BQU8sQ0FBQyxJQUFJLENBQUMsNkRBQTZELEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDL0UsT0FBTyxFQUFFLENBQUM7UUFDZCxDQUFDO0lBQ0wsQ0FBQztJQUVELEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBb0IsRUFBRSxJQUFZLEVBQUUsS0FBVTtRQUM1RCxJQUFJLENBQUM7WUFDRCx1QkFBdUI7WUFDdkIsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2xDLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztZQUM5QyxDQUFDO1lBRUQsd0JBQXdCO1lBQ3hCLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsRUFB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QUNwQixDQUFDLENBQUMsQ0FBQztJQUNSLENBQUM7Q0FDSjtBQXBZRCwwREFvWUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJQXNzZXRJbXBvcnRlciB9IGZyb20gJy4vYmFzZS1pbXBvcnRlcic7XHJcbmltcG9ydCB7IEFzc2V0SW5mbyB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9hc3NldC1kYi9AdHlwZXMvcHVibGljJztcclxuaW1wb3J0IHsgSVByb3BlcnR5VmFsdWVUeXBlIH0gZnJvbSAnQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9wdWJsaWMnO1xyXG5cclxuZGVjbGFyZSBjb25zdCBFZGl0b3I6IGFueTtcclxuXHJcbmV4cG9ydCBjbGFzcyBQcm9qZWN0U2V0dGluZ3NJbXBvcnRlciBpbXBsZW1lbnRzIElBc3NldEltcG9ydGVyIHtcclxuICAgIGdldCBuYW1lKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuICdwcm9qZWN0LXNldHRpbmdzJztcclxuICAgIH1cclxuXHJcbiAgICBnZXQgY2xhc3NOYW1lKCk6IHN0cmluZyB7XHJcbiAgICAgICAgcmV0dXJuICdQcm9qZWN0U2V0dGluZ3MnO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIGdldFByb3BlcnRpZXMoYXNzZXRJbmZvOiBBc3NldEluZm8pOiBQcm9taXNlPHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5VmFsdWVUeXBlIH0+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBHZXQgYWN0dWFsIGNvbmZpZ1xyXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0Q29uZmlnID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdxdWVyeS1jb25maWcnLCAncHJvamVjdCcpIHx8IHt9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gQnVpbGQgbWFudWFsIHByb3BlcnRpZXNcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYnVpbGRQcm9wZXJ0aWVzKHByb2plY3RDb25maWcpO1xyXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbUHJvamVjdFNldHRpbmdzSW1wb3J0ZXJdIEZhaWxlZCB0byBxdWVyeSBwcm9qZWN0IHNldHRpbmdzOicsIGUpO1xyXG4gICAgICAgICAgICByZXR1cm4ge307XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNldFByb3BlcnR5KGFzc2V0SW5mbzogQXNzZXRJbmZvLCBwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyBIYW5kbGUgQ3VzdG9tIExheWVyc1xyXG4gICAgICAgICAgICBpZiAocGF0aC5zdGFydHNXaXRoKCdjdXN0b21MYXllcnMnKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2V0TGF5ZXJQcm9wZXJ0eShwYXRoLCB2YWx1ZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEhhbmRsZSBTb3J0aW5nIExheWVyc1xyXG4gICAgICAgICAgICBpZiAocGF0aC5zdGFydHNXaXRoKCdzb3J0aW5nTGF5ZXJzJykpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLnNldFNvcnRpbmdMYXllclByb3BlcnR5KHBhdGgsIHZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSGFuZGxlIFBoeXNpY3MgQ29sbGlzaW9uIEdyb3Vwc1xyXG4gICAgICAgICAgICBpZiAocGF0aC5zdGFydHNXaXRoKCdwaHlzaWNzLmNvbGxpc2lvbkdyb3VwcycpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXRDb2xsaXNpb25Hcm91cFByb3BlcnR5KHBhdGgsIHZhbHVlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gSGFuZGxlIEdlbmVyYWwgU2V0dGluZ3NcclxuICAgICAgICAgICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnZ2VuZXJhbCcpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZXRHZW5lcmFsUHJvcGVydHkocGF0aCwgdmFsdWUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBIYW5kbGUgRGVmYXVsdCBNYXRlcmlhbCAoUmVmZXJlbmNlIFVud3JhcClcclxuICAgICAgICAgICAgaWYgKHBhdGggPT09ICdwaHlzaWNzLmRlZmF1bHRNYXRlcmlhbCcgJiYgdmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS51dWlkKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnV1aWQ7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEhhbmRsZSBDb2xsaXNpb24gTWF0cml4IChPYmplY3QgdnMgQXJyYXkpXHJcbiAgICAgICAgICAgIC8vIElmIHBhdGggaXMgcGh5c2ljcy5jb2xsaXNpb25NYXRyaXguNSwgaXQgbWFwcyB0byBwaHlzaWNzLmNvbGxpc2lvbk1hdHJpeFtcIjVcIl0gd2hpY2ggaXMgZmluZS5cclxuXHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAnc2V0LWNvbmZpZycsICdwcm9qZWN0JywgcGF0aCwgdmFsdWUpO1xyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUud2FybignW1Byb2plY3RTZXR0aW5nc0ltcG9ydGVyXSBGYWlsZWQgdG8gc2V0IHByb2plY3Qgc2V0dGluZ3M6JywgZSk7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0R2VuZXJhbFByb3BlcnR5KHBhdGg6IHN0cmluZywgdmFsdWU6IGFueSk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKTtcclxuICAgICAgICBjb25zdCBnZW5lcmFsID0gY29uZmlnLmdlbmVyYWwgfHwge307XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XHJcbiAgICAgICAgY29uc3Qga2V5ID0gcGFydHNbMV07XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGtleSA9PT0gJ2Rlc2lnblJlc29sdXRpb24nKSB7XHJcbiAgICAgICAgICAgICAvLyBzdWItcHJvcGVydGllczogZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uLndpZHRoXHJcbiAgICAgICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAzKSB7XHJcbiAgICAgICAgICAgICAgICAgY29uc3Qgc3ViS2V5ID0gcGFydHNbMl07XHJcbiAgICAgICAgICAgICAgICAgZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uW3N1YktleV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgLy8gZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uIChSZXBsYWNlIHNpemUgdmFsdWVzKVxyXG4gICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAmJiB0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGlmICgnd2lkdGgnIGluIHZhbHVlKSBnZW5lcmFsLmRlc2lnblJlc29sdXRpb24ud2lkdGggPSB2YWx1ZS53aWR0aDtcclxuICAgICAgICAgICAgICAgICAgICAgaWYgKCdoZWlnaHQnIGluIHZhbHVlKSBnZW5lcmFsLmRlc2lnblJlc29sdXRpb24uaGVpZ2h0ID0gdmFsdWUuaGVpZ2h0O1xyXG4gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2UgaWYgKGtleSA9PT0gJ2ZpdFdpZHRoJyB8fCBrZXkgPT09ICdmaXRIZWlnaHQnKSB7XHJcbiAgICAgICAgICAgICBnZW5lcmFsLmRlc2lnblJlc29sdXRpb25ba2V5XSA9IHZhbHVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICBnZW5lcmFsW2tleV0gPSB2YWx1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdzZXQtY29uZmlnJywgJ3Byb2plY3QnLCAnZ2VuZXJhbCcsIGdlbmVyYWwpO1xyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0Q29sbGlzaW9uR3JvdXBQcm9wZXJ0eShwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgICAgICAvLyBwYXRoOiBwaHlzaWNzLmNvbGxpc2lvbkdyb3Vwcy4wLm5hbWUgb3IgcGh5c2ljcy5jb2xsaXNpb25Hcm91cHMuMFxyXG4gICAgICAgIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xyXG4gICAgICAgIGNvbnN0IGluZGV4U3RyID0gcGFydHNbMl07XHJcbiAgICAgICAgaWYgKCFpbmRleFN0cikgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gcGFyc2VJbnQoaW5kZXhTdHIpO1xyXG4gICAgICAgIGlmIChpc05hTihpbmRleCkpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICAgICAgY29uc3QgY29uZmlnID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdxdWVyeS1jb25maWcnLCAncHJvamVjdCcpO1xyXG4gICAgICAgIGNvbnN0IHBoeXNpY3MgPSBjb25maWcucGh5c2ljcyB8fCB7fTtcclxuICAgICAgICBjb25zdCBncm91cHMgPSBwaHlzaWNzLmNvbGxpc2lvbkdyb3VwcyB8fCBbXTtcclxuXHJcbiAgICAgICAgbGV0IG5ld05hbWUgPSBcIlwiO1xyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSBuZXdOYW1lID0gdmFsdWU7XHJcbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiB2YWx1ZS5uYW1lKSBuZXdOYW1lID0gdmFsdWUubmFtZTtcclxuXHJcbiAgICAgICAgLy8gTm90ZTogJ2luZGV4JyB2YXJpYWJsZSBoZXJlIHJlZmVycyB0byB0aGUgQVJSQVkgSU5ERVggaW4gdGhlIGNvbmZpZ3VyYXRpb24gbGlzdCxcclxuICAgICAgICAvLyBOT1QgdGhlIGNvbGxpc2lvbiBncm91cCBpbmRleCAoMSA8PCBncm91cEluZGV4KS5cclxuICAgICAgICBcclxuICAgICAgICBpZiAoaW5kZXggPCBncm91cHMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAvLyBNb2RpZmljYXRpb25cclxuICAgICAgICAgICAgIGlmIChuZXdOYW1lKSBncm91cHNbaW5kZXhdLm5hbWUgPSBuZXdOYW1lO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IGdyb3Vwcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgIC8vIENyZWF0aW9uOiBGaW5kIGZpcnN0IGF2YWlsYWJsZSBncm91cCBpbmRleCAoMC4uMzEpXHJcbiAgICAgICAgICAgICBjb25zdCB1c2VkSW5kaWNlcyA9IG5ldyBTZXQoZ3JvdXBzLm1hcCgoZzogYW55KSA9PiBnLmluZGV4KSk7XHJcbiAgICAgICAgICAgICAvLyBVc3VhbGx5IDAgaXMgRGVmYXVsdC5cclxuICAgICAgICAgICAgIGlmICghdXNlZEluZGljZXMuaGFzKDApKSB1c2VkSW5kaWNlcy5hZGQoMCk7IC8vIFRyZWF0IDAgYXMgdXNlZCB1c3VhbGx5XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICAgICAgIGxldCBuZXh0R3JvdXBJbmRleCA9IDE7XHJcbiAgICAgICAgICAgICB3aGlsZSAodXNlZEluZGljZXMuaGFzKG5leHRHcm91cEluZGV4KSkge1xyXG4gICAgICAgICAgICAgICAgIG5leHRHcm91cEluZGV4Kys7XHJcbiAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICAgICAgIGlmIChuZXh0R3JvdXBJbmRleCA+IDMxKSB7XHJcbiAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdNYXggY29sbGlzaW9uIGdyb3VwcyByZWFjaGVkICgzMikuJyk7XHJcbiAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgIGdyb3Vwcy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICBpbmRleDogbmV4dEdyb3VwSW5kZXgsXHJcbiAgICAgICAgICAgICAgICAgbmFtZTogbmV3TmFtZSB8fCBgR3JvdXAgJHtuZXh0R3JvdXBJbmRleH1gXHJcbiAgICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBwaHlzaWNzLmNvbGxpc2lvbkdyb3VwcyA9IGdyb3VwcztcclxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdwcm9qZWN0JywgJ3NldC1jb25maWcnLCAncHJvamVjdCcsICdwaHlzaWNzJywgcGh5c2ljcyk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTb3J0aW5nTGF5ZXJQcm9wZXJ0eShwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgICAgICAvLyBwYXRoOiBzb3J0aW5nTGF5ZXJzLjAgb3Igc29ydGluZ0xheWVycy4wLm5hbWVcclxuICAgICAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcclxuICAgICAgICBjb25zdCBpbmRleFN0ciA9IHBhcnRzWzFdO1xyXG4gICAgICAgIGlmICghaW5kZXhTdHIpIHJldHVybiBmYWxzZTtcclxuICAgICAgICBjb25zdCBpbmRleCA9IHBhcnNlSW50KGluZGV4U3RyKTtcclxuICAgICAgICBpZiAoaXNOYU4oaW5kZXgpKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAncXVlcnktY29uZmlnJywgJ3Byb2plY3QnKTtcclxuICAgICAgICBjb25zdCBzb3J0aW5nSW5mbyA9IGNvbmZpZ1snc29ydGluZy1sYXllciddIHx8IHsgbGF5ZXJzOiBbXSwgaW5jcmVhc2VJZDogMCB9O1xyXG4gICAgICAgIGNvbnN0IGxheWVycyA9IHNvcnRpbmdJbmZvLmxheWVycyB8fCBbXTtcclxuXHJcbiAgICAgICAgLy8gRGV0ZXJtaW5lIHdoYXQgd2UgYXJlIHNldHRpbmdcclxuICAgICAgICBsZXQgcGF0Y2hEYXRhOiBhbnkgPSB7fTtcclxuICAgICAgICBpZiAocGFydHMubGVuZ3RoID09PSAyKSB7XHJcbiAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgcGF0Y2hEYXRhID0geyBuYW1lOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICAgZWxzZSBwYXRjaERhdGEgPSB2YWx1ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKHBhcnRzLmxlbmd0aCA9PT0gMykge1xyXG4gICAgICAgICAgICAgY29uc3QgZmllbGQgPSBwYXJ0c1syXTtcclxuICAgICAgICAgICAgIHBhdGNoRGF0YVtmaWVsZF0gPSB2YWx1ZTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaW5kZXggPCBsYXllcnMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAvLyBNb2RpZmljYXRpb25cclxuICAgICAgICAgICAgIGxheWVyc1tpbmRleF0gPSB7IC4uLmxheWVyc1tpbmRleF0sIC4uLnBhdGNoRGF0YSB9O1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaW5kZXggPT09IGxheWVycy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgIC8vIENyZWF0aW9uXHJcbiAgICAgICAgICAgICBjb25zdCBuZXdJZCA9IChzb3J0aW5nSW5mby5pbmNyZWFzZUlkIHx8IDApICsgMTtcclxuICAgICAgICAgICAgIHNvcnRpbmdJbmZvLmluY3JlYXNlSWQgPSBuZXdJZDtcclxuICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgbGV0IG5ld1ZhbHVlID0gcGF0Y2hEYXRhLnZhbHVlO1xyXG4gICAgICAgICAgICAgaWYgKG5ld1ZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICBjb25zdCBtYXhWYWwgPSBsYXllcnMucmVkdWNlKChtYXg6IG51bWJlciwgbDogYW55KSA9PiAobC52YWx1ZSAhPT0gdW5kZWZpbmVkICYmIGwudmFsdWUgPiBtYXgpID8gbC52YWx1ZSA6IG1heCwgLTEpO1xyXG4gICAgICAgICAgICAgICAgIG5ld1ZhbHVlID0gbWF4VmFsICsgMTtcclxuICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgY29uc3QgbmV3TGF5ZXIgPSB7XHJcbiAgICAgICAgICAgICAgICAgaWQ6IG5ld0lkLFxyXG4gICAgICAgICAgICAgICAgIG5hbWU6IHBhdGNoRGF0YS5uYW1lIHx8IGBMYXllciAke25ld0lkfWAsXHJcbiAgICAgICAgICAgICAgICAgdmFsdWU6IG5ld1ZhbHVlXHJcbiAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgbGF5ZXJzLnB1c2gobmV3TGF5ZXIpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgc29ydGluZ0luZm8ubGF5ZXJzID0gbGF5ZXJzO1xyXG4gICAgICAgIC8vIFVwZGF0ZSB0aGUgZnVsbCBzb3J0aW5nLWxheWVyIG9iamVjdCB0byBlbnN1cmUgaW5jcmVhc2VJZCBhbmQgc2V0LWNvbmZpZyBzeW5jXHJcbiAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgncHJvamVjdCcsICdzZXQtY29uZmlnJywgJ3Byb2plY3QnLCAnc29ydGluZy1sYXllcicsIHNvcnRpbmdJbmZvKTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIHNldExheWVyUHJvcGVydHkocGF0aDogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICAgICAgLy8gcGFyc2luZyBwYXRoOiBjdXN0b21MYXllcnMuMC5uYW1lIG9yIGN1c3RvbUxheWVycy4wXHJcbiAgICAgICAgY29uc3QgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XHJcbiAgICAgICAgY29uc3QgaW5kZXhTdHIgPSBwYXJ0c1sxXTtcclxuICAgICAgICBpZiAoIWluZGV4U3RyKSByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgY29uc3QgaW5kZXggPSBwYXJzZUludChpbmRleFN0cik7XHJcbiAgICAgICAgaWYgKGlzTmFOKGluZGV4KSkgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGxldCBuZXdOYW1lID0gXCJcIjtcclxuICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykgbmV3TmFtZSA9IHZhbHVlO1xyXG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUubmFtZSkgbmV3TmFtZSA9IHZhbHVlLm5hbWU7XHJcblxyXG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3Byb2plY3QnLCAnc2V0LWNvbmZpZycsICdwcm9qZWN0JywgYGxheWVyLiR7aW5kZXh9YCwgeyBuYW1lOiBuZXdOYW1lLCB2YWx1ZTogMSA8PCAoaW5kZXggKyAxKSB9KTtcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGJ1aWxkUHJvcGVydGllcyhkYXRhOiBhbnkpOiB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9IHtcclxuICAgICAgICBjb25zdCByZXN1bHQ6IHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5VmFsdWVUeXBlIH0gPSB7fTtcclxuXHJcbiAgICAgICAgcmVzdWx0Wydzb3J0aW5nTGF5ZXJzJ10gPSB7XHJcbiAgICAgICAgICAgIHZhbHVlOiBkYXRhICYmIGRhdGFbJ3NvcnRpbmctbGF5ZXInXSAmJiBkYXRhWydzb3J0aW5nLWxheWVyJ10ubGF5ZXJzID8gdGhpcy5idWlsZFNvcnRpbmdMYXllclByb3BlcnRpZXMoZGF0YVsnc29ydGluZy1sYXllciddLmxheWVycykgOiBbXSxcclxuICAgICAgICAgICAgZXh0ZW5kczogW10sXHJcbiAgICAgICAgICAgIHR5cGU6ICdTb3J0aW5nTGF5ZXJJdGVtJyxcclxuICAgICAgICAgICAgaXNBcnJheTogdHJ1ZSxcclxuICAgICAgICAgICAgdG9vbHRpcDogJ1NvcnRpbmcgbGF5ZXJzIGZvciBzcHJpdGVzJ1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHJlc3VsdFsnY3VzdG9tTGF5ZXJzJ10gPSB7XHJcbiAgICAgICAgICAgIHZhbHVlOiBkYXRhICYmIGRhdGEubGF5ZXIgPyB0aGlzLmJ1aWxkTGF5ZXJQcm9wZXJ0aWVzKGRhdGEubGF5ZXIpIDogW10sXHJcbiAgICAgICAgICAgIGV4dGVuZHM6IFtdLFxyXG4gICAgICAgICAgICB0eXBlOiAnTGF5ZXJJdGVtJyxcclxuICAgICAgICAgICAgaXNBcnJheTogdHJ1ZSxcclxuICAgICAgICAgICAgdG9vbHRpcDogJ1VzZXIgZGVmaW5lZCByZW5kZXJpbmcgbGF5ZXJzJ1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHJlc3VsdFsncGh5c2ljcyddID0ge1xyXG4gICAgICAgICAgICB2YWx1ZTogZGF0YSAmJiBkYXRhLnBoeXNpY3MgPyB0aGlzLmJ1aWxkUGh5c2ljc1Byb3BlcnRpZXMoZGF0YS5waHlzaWNzKSA6IHt9LFxyXG4gICAgICAgICAgICB0eXBlOiAnUGh5c2ljc1NldHRpbmdzJ1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIHJlc3VsdFsnZ2VuZXJhbCddID0ge1xyXG4gICAgICAgICAgICB2YWx1ZTogZGF0YSAmJiBkYXRhLmdlbmVyYWwgPyB0aGlzLmJ1aWxkR2VuZXJhbFByb3BlcnRpZXMoZGF0YS5nZW5lcmFsKSA6IHt9LFxyXG4gICAgICAgICAgICB0eXBlOiAnR2VuZXJhbFNldHRpbmdzJ1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGJ1aWxkR2VuZXJhbFByb3BlcnRpZXMoZ2VuZXJhbDogYW55KTogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSB7XHJcbiAgICAgICAgY29uc3QgcmVzdWx0OiB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9ID0ge307XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmVzdWx0WydkZXNpZ25SZXNvbHV0aW9uJ10gPSB7XHJcbiAgICAgICAgICAgIHZhbHVlOiB7IHdpZHRoOiBnZW5lcmFsLmRlc2lnblJlc29sdXRpb24/LndpZHRoID8/IDEyODAsIGhlaWdodDogZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uPy5oZWlnaHQgPz8gNzIwIH0sXHJcbiAgICAgICAgICAgIHR5cGU6ICdjYy5TaXplJyxcclxuICAgICAgICAgICAgZXh0ZW5kczogWydjYy5WYWx1ZVR5cGUnXVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgcmVzdWx0WydmaXRXaWR0aCddID0geyB2YWx1ZTogZ2VuZXJhbC5kZXNpZ25SZXNvbHV0aW9uPy5maXRXaWR0aCA/PyBmYWxzZSwgdHlwZTogJ0Jvb2xlYW4nIH07XHJcbiAgICAgICAgcmVzdWx0WydmaXRIZWlnaHQnXSA9IHsgdmFsdWU6IGdlbmVyYWwuZGVzaWduUmVzb2x1dGlvbj8uZml0SGVpZ2h0ID8/IGZhbHNlLCB0eXBlOiAnQm9vbGVhbicgfTtcclxuXHJcbiAgICAgICAgcmVzdWx0Wydkb3dubG9hZE1heENvbmN1cnJlbmN5J10gPSB7IHZhbHVlOiBnZW5lcmFsLmRvd25sb2FkTWF4Q29uY3VycmVuY3kgPz8gMTUsIHR5cGU6ICdJbnRlZ2VyJywgbWluOiAxIH07XHJcbiAgICAgICAgcmVzdWx0WydoaWdoUXVhbGl0eSddID0geyB2YWx1ZTogZ2VuZXJhbC5oaWdoUXVhbGl0eSA/PyBmYWxzZSwgdHlwZTogJ0Jvb2xlYW4nIH07XHJcblxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZFBoeXNpY3NQcm9wZXJ0aWVzKHBoeXNpY3M6IGFueSk6IHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5VmFsdWVUeXBlIH0ge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdDogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSA9IHt9O1xyXG4gICAgICAgIFxyXG4gICAgICAgIC8vIFNpbXBsZSBwcm9wc1xyXG4gICAgICAgIGNvbnN0IHByb3BzID0gW1xyXG4gICAgICAgICAgICB7IGtleTogJ2FsbG93U2xlZXAnLCB0eXBlOiAnQm9vbGVhbicgfSxcclxuICAgICAgICAgICAgeyBrZXk6ICdhdXRvU2ltdWxhdGlvbicsIHR5cGU6ICdCb29sZWFuJyB9LFxyXG4gICAgICAgICAgICB7IGtleTogJ3NsZWVwVGhyZXNob2xkJywgdHlwZTogJ0Zsb2F0JyB9LFxyXG4gICAgICAgICAgICB7IGtleTogJ2ZpeGVkVGltZVN0ZXAnLCB0eXBlOiAnRmxvYXQnLCBvcHRpb25zOiB7IG1pbjogMCB9IH0sXHJcbiAgICAgICAgICAgIHsga2V5OiAnbWF4U3ViU3RlcHMnLCB0eXBlOiAnSW50ZWdlcicsIG9wdGlvbnM6IHsgbWluOiAxIH0gfSxcclxuICAgICAgICBdO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHAgb2YgcHJvcHMpIHtcclxuICAgICAgICAgICAgaWYgKHAua2V5IGluIHBoeXNpY3MpIHtcclxuICAgICAgICAgICAgICAgICByZXN1bHRbcC5rZXldID0geyB2YWx1ZTogcGh5c2ljc1twLmtleV0sIHR5cGU6IHAudHlwZSwgLi4ucC5vcHRpb25zIH07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKHBoeXNpY3MuZ3Jhdml0eSkge1xyXG4gICAgICAgICAgICByZXN1bHRbJ2dyYXZpdHknXSA9IHsgdmFsdWU6IHBoeXNpY3MuZ3Jhdml0eSwgdHlwZTogJ2NjLlZlYzMnLCBleHRlbmRzOiBbJ2NjLlZhbHVlVHlwZScgXSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVzdWx0WydkZWZhdWx0TWF0ZXJpYWwnXSA9IHsgXHJcbiAgICAgICAgICAgIHZhbHVlOiBwaHlzaWNzLmRlZmF1bHRNYXRlcmlhbCA/IHsgdXVpZDogcGh5c2ljcy5kZWZhdWx0TWF0ZXJpYWwgfSA6IG51bGwsXHJcbiAgICAgICAgICAgIHR5cGU6ICdjYy5QaHlzaWNzTWF0ZXJpYWwnLCBcclxuICAgICAgICAgICAgZXh0ZW5kczogWydjYy5PYmplY3QnXSBcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICAvLyBDb2xsaXNpb24gR3JvdXBzXHJcbiAgICAgICAgY29uc3QgZ3JvdXBzID0gcGh5c2ljcy5jb2xsaXNpb25Hcm91cHMgfHwgW107XHJcbiAgICAgICAgcmVzdWx0Wydjb2xsaXNpb25Hcm91cHMnXSA9IHtcclxuICAgICAgICAgICAgIHZhbHVlOiBncm91cHMubWFwKChnOiBhbnkpID0+ICh7XHJcbiAgICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHsgdmFsdWU6IGcuaW5kZXgsIHR5cGU6ICdJbnRlZ2VyJywgcmVhZG9ubHk6IHRydWUgfSxcclxuICAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB2YWx1ZTogZy5uYW1lLCB0eXBlOiAnU3RyaW5nJyB9XHJcbiAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICB0eXBlOiAnQ29sbGlzaW9uR3JvdXBJdGVtJ1xyXG4gICAgICAgICAgICAgfSkpLFxyXG4gICAgICAgICAgICAgdHlwZTogJ0NvbGxpc2lvbkdyb3VwSXRlbScsXHJcbiAgICAgICAgICAgICBpc0FycmF5OiB0cnVlLFxyXG4gICAgICAgICAgICAgZWxlbWVudFR5cGVEYXRhOiB7XHJcbiAgICAgICAgICAgICAgICB0eXBlOiAnQ29sbGlzaW9uR3JvdXBJdGVtJyxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaW5kZXg6IHsgdmFsdWU6IDAsIHR5cGU6ICdJbnRlZ2VyJywgcmVhZG9ubHk6IHRydWUgfSxcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiB7IHZhbHVlOiAnJywgdHlwZTogJ1N0cmluZycgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgfVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIC8vIENvbGxpc2lvbiBNYXRyaXhcclxuICAgICAgICBjb25zdCBiaXRtYXNrTGlzdDogeyBuYW1lOiBzdHJpbmcsIHZhbHVlOiBudW1iZXIgfVtdID0gW107XHJcbiAgICAgICAgLy8gRGVmYXVsdCBncm91cCAwXHJcbiAgICAgICAgY29uc3QgZGVmYXVsdEdyb3VwID0gZ3JvdXBzLmZpbmQoKGc6IGFueSkgPT4gZy5pbmRleCA9PT0gMCk7XHJcbiAgICAgICAgYml0bWFza0xpc3QucHVzaCh7IG5hbWU6IGRlZmF1bHRHcm91cCA/IGRlZmF1bHRHcm91cC5uYW1lIDogJ0RFRkFVTFQnLCB2YWx1ZTogMSA8PCAwIH0pO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAoY29uc3QgZyBvZiBncm91cHMpIHtcclxuICAgICAgICAgICAgaWYgKGcuaW5kZXggIT09IDApIHtcclxuICAgICAgICAgICAgICAgICBiaXRtYXNrTGlzdC5wdXNoKHsgbmFtZTogZy5uYW1lLCB2YWx1ZTogMSA8PCBnLmluZGV4IH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBtYXRyaXhPYmogPSBwaHlzaWNzLmNvbGxpc2lvbk1hdHJpeCB8fCB7fTtcclxuICAgICAgICBjb25zdCBtYXRyaXhBcnIgPSBbXTtcclxuICAgICAgICAvLyBDYWxjdWxhdGUgbWF4IGluZGV4IHRvIGRpc3BsYXlcclxuICAgICAgICBjb25zdCBpbmRpY2VzID0gWzAsIC4uLmdyb3Vwcy5tYXAoKGc6IGFueSkgPT4gZy5pbmRleCksIC4uLk9iamVjdC5rZXlzKG1hdHJpeE9iaikubWFwKGsgPT4gcGFyc2VJbnQoaykpXTtcclxuICAgICAgICBjb25zdCBtYXhJbmRleCA9IE1hdGgubWF4KC4uLmluZGljZXMpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IG1heEluZGV4OyBpKyspIHtcclxuICAgICAgICAgICAgbWF0cml4QXJyLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgdmFsdWU6IG1hdHJpeE9ialtpXSB8fCAwLFxyXG4gICAgICAgICAgICAgICAgdHlwZTogJ0JpdE1hc2snLFxyXG4gICAgICAgICAgICAgICAgYml0bWFza0xpc3Q6IGJpdG1hc2tMaXN0XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmVzdWx0Wydjb2xsaXNpb25NYXRyaXgnXSA9IHtcclxuICAgICAgICAgICAgdmFsdWU6IG1hdHJpeEFycixcclxuICAgICAgICAgICAgdHlwZTogJ0JpdE1hc2snLFxyXG4gICAgICAgICAgICBpc0FycmF5OiB0cnVlLFxyXG4gICAgICAgICAgICBlbGVtZW50VHlwZURhdGE6IHtcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdCaXRNYXNrJyxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiAwLFxyXG4gICAgICAgICAgICAgICAgYml0bWFza0xpc3Q6IGJpdG1hc2tMaXN0XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYnVpbGRTb3J0aW5nTGF5ZXJQcm9wZXJ0aWVzKGxheWVyczogQXJyYXk8eyBpZDogbnVtYmVyLCBuYW1lOiBzdHJpbmcsIHZhbHVlOiBudW1iZXIgfT4pOiBBcnJheTxJUHJvcGVydHlWYWx1ZVR5cGU+IHtcclxuICAgICAgICByZXR1cm4gbGF5ZXJzLm1hcChsYXllciA9PiAoe1xyXG4gICAgICAgICAgICBleHRlbmRzOiBbXSxcclxuICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgIGlkOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGxheWVyLmlkLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdJbnRlZ2VyJyxcclxuICAgICAgICAgICAgICAgICAgICByZWFkb25seTogdHJ1ZVxyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG5hbWU6IHtcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogbGF5ZXIubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICB0eXBlOiAnU3RyaW5nJ1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWU6IGxheWVyLnZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdJbnRlZ2VyJ1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB0eXBlOiAnU29ydGluZ0xheWVySXRlbSdcclxuICAgICAgICB9KSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBidWlsZExheWVyUHJvcGVydGllcyhsYXllcnM6IEFycmF5PHsgbmFtZTogc3RyaW5nLCB2YWx1ZTogbnVtYmVyIH0+KTogQXJyYXk8SVByb3BlcnR5VmFsdWVUeXBlPiB7XHJcbiAgICAgICAgIHJldHVybiBsYXllcnMubWFwKGxheWVyID0+ICh7XHJcbiAgICAgICAgICAgIGV4dGVuZHM6IFtdLFxyXG4gICAgICAgICAgICB2YWx1ZToge1xyXG4gICAgICAgICAgICAgICAgbmFtZToge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBsYXllci5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdTdHJpbmcnXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgdmFsdWU6IHtcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogbGF5ZXIudmFsdWUsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ0ludGVnZXInLFxyXG4gICAgICAgICAgICAgICAgICAgIHJlYWRvbmx5OiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHR5cGU6ICdMYXllckl0ZW0nXHJcbiAgICAgICAgfSkpO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==