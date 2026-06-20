"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SetPropertyTool = void 0;
const decorators_1 = require("../decorators");
const tools_utils_1 = require("../utils/tools-utils");
const asset_importers_1 = require("../utils/asset-importers");
const schemas_1 = require("../schemas");
class SetPropertyTool {
    async setCurrentSceneProperties(params) {
        return await this.setInstanceProperties({
            reference: { id: params.settingsType }, propertyPaths: params.propertyPaths, values: params.values
        });
    }
    async setInstanceProperties(params) {
        let { reference: { id: uuid }, propertyPaths, values } = params;
        if (!propertyPaths || !values) {
            throw new Error(`Property paths and values are required.`);
        }
        if (propertyPaths.length !== values.length) {
            throw new Error(`Property paths count (${propertyPaths.length}) does not match values count (${values.length}).`);
        }
        let info = await tools_utils_1.ToolsUtils.inspectInstance(uuid, false);
        if (!info) {
            throw new Error(`Target ${uuid} not found or not supported.`);
        }
        uuid = info.uuid;
        const { type, props, assetInfo } = info;
        if (!props) {
            throw new Error(`Could not retrieve properties for ${type} of instance ${uuid}.`);
        }
        for (let i = 0; i < propertyPaths.length; i++) {
            await this.setProperty(info, propertyPaths[i], values[i]);
        }
        return { success: true };
    }
    async setProperty({ uuid, type, props, assetInfo }, propertyPath, value) {
        var _a;
        // Find property definition in the dump
        let targetProp = null;
        try {
            targetProp = this.findPropertyInDump(props, propertyPath);
        }
        catch (e) {
            throw new Error(`Property '${propertyPath}' resolution failed: ${e.message}. Please recheck TypescriptDefinition of ${uuid}. Arrays are reached by indexes.`);
        }
        if (!targetProp) {
            throw new Error(`Property '${propertyPath}' not found on ${type} of instance ${uuid}.`);
        }
        // Normalize value based on property definition
        value = this.normalizeValue(value, targetProp);
        if (assetInfo) {
            try {
                const success = await ((_a = asset_importers_1.ImporterManager.getInstance().getImporter(assetInfo.importer)) === null || _a === void 0 ? void 0 : _a.setProperty(assetInfo, propertyPath, value));
                if (!success) {
                    throw new Error(`Importer failed to set property.`);
                }
            }
            catch (e) {
                throw new Error(`Failed to set property on Asset ${uuid}: ${e}`);
            }
            return;
        }
        if (type === 'cc.SceneGlobals') {
            // Scene Globals are part of the scene node but under _globals
            propertyPath = `_globals.${propertyPath}`;
            // uuid is already set to the Scene UUID from inspectInstance
        }
        else if (type !== 'cc.Node') {
            const nodeUuid = props.node.value.uuid;
            const nodeInfo = await Editor.Message.request('scene', 'query-node', nodeUuid);
            if (!nodeInfo) {
                throw new Error(`Parent Node ${nodeUuid} for Component ${uuid} not found.`);
            }
            const componentIndex = nodeInfo.__comps__.findIndex((comp) => comp.value.uuid.value === uuid);
            propertyPath = `__comps__.${componentIndex}.${propertyPath}`;
            uuid = nodeUuid;
        }
        await this.applyValue(uuid, propertyPath, targetProp, value);
    }
    normalizeValue(value, prop) {
        // Try to parse string values into proper types
        if (typeof value === 'string') {
            const isStringProp = prop.type === 'String';
            if (!isStringProp) {
                const t = value.trim();
                if (t === 'true')
                    return true;
                if (t === 'false')
                    return false;
                if (!isNaN(Number(t)) && t !== '') {
                    return Number(t);
                }
                if ((t.startsWith('{') || t.startsWith('[')) && (t.endsWith('}') || t.endsWith(']'))) {
                    try {
                        return JSON.parse(t);
                    }
                    catch (e) { }
                }
            }
        }
        return value;
    }
    findPropertyInDump(root, path) {
        if (!path)
            return null;
        if (!root)
            return null;
        const parts = path.split('.');
        let current = { value: root }; // Wrap to unify traversal
        // Helper to check if object looks like a property definition
        const isProperty = (obj) => obj && typeof obj === 'object' && ('type' in obj || 'extends' in obj);
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            // Current is expected to be an IProperty or object containing IProperty data
            let val = current.value;
            // If current is just the dictionary (root), use it directly
            if (current === root || (typeof current === 'object' && !('value' in current))) {
                val = current;
            }
            if (val === undefined || val === null)
                return null;
            // 1. Array Index
            if (Array.isArray(val)) {
                const idx = parseInt(part);
                if (!isNaN(idx)) {
                    // Existing index
                    if (val[idx] !== undefined) {
                        const elem = val[idx];
                        if (isProperty(elem)) {
                            current = elem;
                        }
                        else if (current.elementTypeData) {
                            // Hydrate from schema
                            current = Object.assign(Object.assign({}, current.elementTypeData), { value: elem });
                        }
                        else {
                            // Fallback for primitive arrays without schema
                            current = { value: elem, type: 'Unknown' };
                        }
                        continue;
                    }
                    // Extending array support: Allow index == length if schema exists.
                    // Don't allow gaps (idx > length).
                    if (idx === val.length) {
                        if (current.elementTypeData) {
                            current = current.elementTypeData;
                            continue;
                        }
                        else {
                            throw new Error(`Array extension at '${part}' failed: No elementTypeData.`);
                        }
                    }
                    throw new Error(`Array index '${idx}' out of bounds (length: ${val.length}) at '${part}'.`);
                }
                throw new Error(`Invalid array index '${part}' at '${path}'.`);
            }
            // 2. Object Key
            if (typeof val === 'object') {
                if (part in val) {
                    const propCandidate = val[part];
                    if (isProperty(propCandidate)) {
                        current = propCandidate;
                    }
                    else {
                        // Not a property, probably a raw value in a struct (like position.x = 0)
                        // Try to find schema in default value if available
                        let schema = null;
                        if (current.default && current.default.value && typeof current.default.value === 'object' && part in current.default.value) {
                            schema = current.default.value[part];
                        }
                        if (schema) {
                            current = Object.assign(Object.assign({}, schema), { value: propCandidate });
                        }
                        else {
                            // No schema found, treat as untyped value
                            current = { value: propCandidate, type: 'Unknown' };
                        }
                    }
                    continue;
                }
                throw new Error(`Key '${part}' not found ${i == 0 ? '' : 'in ' + parts.slice(0, i).join('.')}.`);
            }
            throw new Error(`Path segment '${part}' '${i == 0 ? '' : 'at ' + parts.slice(0, i).join('.')}' failed resolution.`);
        }
        return current;
    }
    async applyValue(uuid, path, prop, value) {
        var _a, _b, _c;
        // Handle direct references
        if ((_a = prop.extends) === null || _a === void 0 ? void 0 : _a.includes('cc.Object')) {
            value = await this.convertObjectReferenceToCocos(value, prop);
        }
        // Handle array of references
        if (Array.isArray(value) && ((_c = (_b = prop.elementTypeData) === null || _b === void 0 ? void 0 : _b.extends) === null || _c === void 0 ? void 0 : _c.includes('cc.Object'))) {
            const convertedArray = [];
            value.forEach(async (item, index) => {
                convertedArray[index] = await this.convertObjectReferenceToCocos(item, prop.elementTypeData);
            });
            value = convertedArray;
        }
        const dump = { value, type: prop.type };
        await Editor.Message.request('scene', 'set-property', {
            uuid,
            path,
            dump
        });
        await Editor.Message.request('scene', 'snapshot');
    }
    async convertObjectReferenceToCocos(value, prop) {
        const extendsInfo = prop.extends || [];
        // Accept plain UUID string or { uuid: string } structure
        if (typeof value === 'string') {
            value = { uuid: value };
        }
        // Reference object with id is sent
        if (typeof value === 'object' && value !== null && 'id' in value) {
            value = { uuid: value.id };
        }
        // Special case for asset subtype check
        if (extendsInfo.includes('cc.Asset')) {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', value.uuid);
            if (!assetInfo) {
                throw new Error(`Asset with id ${value.uuid} not found.`);
            }
            let foundSubAsset = false;
            if (assetInfo.type !== prop.type) {
                Object.values(assetInfo.subAssets || {}).forEach(subAsset => {
                    if (subAsset.type === prop.type) {
                        value = { uuid: subAsset.uuid };
                        foundSubAsset = true;
                    }
                });
            }
            else {
                foundSubAsset = true;
            }
            if (!foundSubAsset && assetInfo.type !== prop.type) {
                throw new Error(`Reference type mismatch: expected ${prop.type}, got ${assetInfo.type}.`);
            }
        }
        return value;
    }
}
exports.SetPropertyTool = SetPropertyTool;
__decorate([
    (0, decorators_1.utcpTool)("inspectorSetSettingsProperties", "Sets a property on the specific settings. If a property path or type is not confirmed via inspectorGet* tools, you MUST NOT call any setter.", { type: 'object',
        properties: {
            settingsType: { type: 'string', enum: ['CurrentSceneGlobals', 'ProjectSettings'] },
            propertyPath: { type: 'string', description: "Plain path to the property (e.g., 'ambient.skyLightingColor.r'). Don't support code execution." },
            value: { type: ['array', 'object', 'string', 'number', 'boolean', 'null'], additionalProperties: true }
        },
        required: ['settingsType', 'propertyPath', 'value']
    }, schemas_1.SuccessIndicatorSchema, "POST", ['property', 'set', 'scene', 'settings', 'project', 'modify', 'config'])
], SetPropertyTool.prototype, "setCurrentSceneProperties", null);
__decorate([
    (0, decorators_1.utcpTool)("inspectorSetInstanceProperties", "Sets a property on instance of Node, Component or Asset. If a property path or type is not confirmed via inspectorGet* tools, you MUST NOT call any setter.", {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema,
            propertyPaths: { type: 'array', items: { type: 'string' }, description: "Plain paths to the properties (e.g., ['position.x', 'rotation.y']). Don't support code execution. Arrays are reached by indexes. (e.g. 'sharedMaterials.0')" },
            values: { type: 'array', items: { type: ['array', 'object', 'string', 'number', 'boolean', 'null'], additionalProperties: true } }
        },
        required: ['reference', 'propertyPaths', 'values']
    }, schemas_1.SuccessIndicatorSchema, "POST", ['property', 'set', 'instance', 'node', 'component', 'asset', 'modify', 'meta'])
], SetPropertyTool.prototype, "setInstanceProperties", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0LXByb3BlcnRpZXMtdG9vbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3NvdXJjZS91dGNwL3Rvb2xzL3NldC1wcm9wZXJ0aWVzLXRvb2wudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsOENBQXlDO0FBRXpDLHNEQUFrRDtBQUNsRCw4REFBMkQ7QUFFM0Qsd0NBQW9IO0FBSXBILE1BQWEsZUFBZTtJQWNsQixBQUFOLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxNQUF3RTtRQUNwRyxPQUFPLE1BQU0sSUFBSSxDQUFDLHFCQUFxQixDQUFDO1lBQ3BDLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsWUFBWSxFQUFFLEVBQUUsYUFBYSxFQUFFLE1BQU0sQ0FBQyxhQUFhLEVBQUUsTUFBTSxFQUFFLE1BQU0sQ0FBQyxNQUFNO1NBQ3JHLENBQUMsQ0FBQztJQUNQLENBQUM7SUFpQkssQUFBTixLQUFLLENBQUMscUJBQXFCLENBQUMsTUFBaUY7UUFDekcsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxJQUFJLEVBQUUsRUFBRSxhQUFhLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDO1FBRWhFLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUM1QixNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF5QyxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVELElBQUksYUFBYSxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsYUFBYSxDQUFDLE1BQU0sa0NBQWtDLE1BQU0sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDO1FBQ3RILENBQUM7UUFFRCxJQUFJLElBQUksR0FBRyxNQUFNLHdCQUFVLENBQUMsZUFBZSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztRQUN6RCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDUixNQUFNLElBQUksS0FBSyxDQUFDLFVBQVUsSUFBSSw4QkFBOEIsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCxJQUFJLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQztRQUVqQixNQUFNLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxTQUFTLEVBQUUsR0FBRyxJQUFJLENBQUM7UUFFeEMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsSUFBSSxnQkFBZ0IsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUN0RixDQUFDO1FBRUQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGFBQWEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztZQUM1QyxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLGFBQWEsQ0FBQyxDQUFDLENBQUMsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM5RCxDQUFDO1FBRUQsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztJQUM3QixDQUFDO0lBRU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFNBQVMsRUFBb0gsRUFBRSxZQUFvQixFQUFFLEtBQVU7O1FBQzFNLHVDQUF1QztRQUN2QyxJQUFJLFVBQVUsR0FBcUIsSUFBSSxDQUFDO1FBQ3hDLElBQUksQ0FBQztZQUNELFVBQVUsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzlELENBQUM7UUFBQyxPQUFPLENBQU0sRUFBRSxDQUFDO1lBQ2QsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFhLFlBQVksd0JBQXdCLENBQUMsQ0FBQyxPQUFPLDRDQUE0QyxJQUFJLGtDQUFrQyxDQUFDLENBQUM7UUFDbEssQ0FBQztRQUVELElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxZQUFZLGtCQUFrQixJQUFJLGdCQUFnQixJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBQzVGLENBQUM7UUFFRCwrQ0FBK0M7UUFDL0MsS0FBSyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBRS9DLElBQUksU0FBUyxFQUFFLENBQUM7WUFDWixJQUFJLENBQUM7Z0JBQ0QsTUFBTSxPQUFPLEdBQXdCLE1BQU0sQ0FBQSxNQUFBLGlDQUFlLENBQUMsV0FBVyxFQUFFLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsMENBQUUsV0FBVyxDQUFDLFNBQVMsRUFBRSxZQUFZLEVBQUUsS0FBSyxDQUFDLENBQUEsQ0FBQztnQkFDdEosSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO29CQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsa0NBQWtDLENBQUMsQ0FBQztnQkFDeEQsQ0FBQztZQUNMLENBQUM7WUFBQyxPQUFPLENBQUMsRUFBRSxDQUFDO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsbUNBQW1DLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3JFLENBQUM7WUFDRCxPQUFPO1FBQ1gsQ0FBQztRQUVELElBQUksSUFBSSxLQUFLLGlCQUFpQixFQUFFLENBQUM7WUFDN0IsOERBQThEO1lBQzlELFlBQVksR0FBRyxZQUFZLFlBQVksRUFBRSxDQUFDO1lBQzFDLDZEQUE2RDtRQUNqRSxDQUFDO2FBQU0sSUFBSSxJQUFJLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDNUIsTUFBTSxRQUFRLEdBQUksS0FBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ2hELE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztZQUMvRSxJQUFJLENBQUMsUUFBUSxFQUFFLENBQUM7Z0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxlQUFlLFFBQVEsa0JBQWtCLElBQUksYUFBYSxDQUFDLENBQUM7WUFDaEYsQ0FBQztZQUNELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUMsSUFBUyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUM7WUFDbkcsWUFBWSxHQUFHLGFBQWEsY0FBYyxJQUFJLFlBQVksRUFBRSxDQUFDO1lBQzdELElBQUksR0FBRyxRQUFRLENBQUM7UUFDcEIsQ0FBQztRQUVELE1BQU0sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRU8sY0FBYyxDQUFDLEtBQVUsRUFBRSxJQUFlO1FBQzlDLCtDQUErQztRQUMvQyxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQzVCLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDO1lBQzVDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDaEIsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUN2QixJQUFJLENBQUMsS0FBSyxNQUFNO29CQUFFLE9BQU8sSUFBSSxDQUFDO2dCQUM5QixJQUFJLENBQUMsS0FBSyxPQUFPO29CQUFFLE9BQU8sS0FBSyxDQUFDO2dCQUVoQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQztvQkFDaEMsT0FBTyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JCLENBQUM7Z0JBRUQsSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDbkYsSUFBSSxDQUFDO3dCQUFDLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFBQyxDQUFDO29CQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUMvQyxDQUFDO1lBQ0wsQ0FBQztRQUNMLENBQUM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBRU8sa0JBQWtCLENBQUMsSUFBOEQsRUFBRSxJQUFZO1FBQ25HLElBQUksQ0FBQyxJQUFJO1lBQUUsT0FBTyxJQUFJLENBQUM7UUFDdkIsSUFBSSxDQUFDLElBQUk7WUFBRSxPQUFPLElBQUksQ0FBQztRQUV2QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRTlCLElBQUksT0FBTyxHQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsMEJBQTBCO1FBRTlELDZEQUE2RDtRQUM3RCxNQUFNLFVBQVUsR0FBRyxDQUFDLEdBQVEsRUFBRSxFQUFFLENBQUMsR0FBRyxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsSUFBSSxDQUFDLE1BQU0sSUFBSSxHQUFHLElBQUksU0FBUyxJQUFJLEdBQUcsQ0FBQyxDQUFDO1FBRXZHLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUM7WUFDcEMsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRXRCLDZFQUE2RTtZQUM3RSxJQUFJLEdBQUcsR0FBRyxPQUFPLENBQUMsS0FBSyxDQUFDO1lBQ3hCLDREQUE0RDtZQUM1RCxJQUFJLE9BQU8sS0FBSyxJQUFJLElBQUksQ0FBQyxPQUFPLE9BQU8sS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzdFLEdBQUcsR0FBRyxPQUFPLENBQUM7WUFDbEIsQ0FBQztZQUVELElBQUksR0FBRyxLQUFLLFNBQVMsSUFBSSxHQUFHLEtBQUssSUFBSTtnQkFBRSxPQUFPLElBQUksQ0FBQztZQUVuRCxpQkFBaUI7WUFDakIsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JCLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDM0IsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO29CQUNkLGlCQUFpQjtvQkFDakIsSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssU0FBUyxFQUFFLENBQUM7d0JBQ3pCLE1BQU0sSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQzt3QkFDdEIsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQzs0QkFDbkIsT0FBTyxHQUFHLElBQUksQ0FBQzt3QkFDbkIsQ0FBQzs2QkFBTSxJQUFJLE9BQU8sQ0FBQyxlQUFlLEVBQUUsQ0FBQzs0QkFDakMsc0JBQXNCOzRCQUN0QixPQUFPLG1DQUFRLE9BQU8sQ0FBQyxlQUFlLEtBQUUsS0FBSyxFQUFFLElBQUksR0FBRSxDQUFDO3dCQUMxRCxDQUFDOzZCQUFNLENBQUM7NEJBQ0osK0NBQStDOzRCQUMvQyxPQUFPLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsQ0FBQzt3QkFDL0MsQ0FBQzt3QkFDRCxTQUFTO29CQUNiLENBQUM7b0JBQ0QsbUVBQW1FO29CQUNuRSxtQ0FBbUM7b0JBQ25DLElBQUksR0FBRyxLQUFLLEdBQUcsQ0FBQyxNQUFNLEVBQUUsQ0FBQzt3QkFDckIsSUFBSSxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUM7NEJBQzFCLE9BQU8sR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDOzRCQUNsQyxTQUFTO3dCQUNiLENBQUM7NkJBQU0sQ0FBQzs0QkFDSixNQUFNLElBQUksS0FBSyxDQUFDLHVCQUF1QixJQUFJLCtCQUErQixDQUFDLENBQUM7d0JBQ2hGLENBQUM7b0JBQ0wsQ0FBQztvQkFDRCxNQUFNLElBQUksS0FBSyxDQUFDLGdCQUFnQixHQUFHLDRCQUE0QixHQUFHLENBQUMsTUFBTSxTQUFTLElBQUksSUFBSSxDQUFDLENBQUM7Z0JBQ2hHLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyx3QkFBd0IsSUFBSSxTQUFTLElBQUksSUFBSSxDQUFDLENBQUM7WUFDbkUsQ0FBQztZQUVELGdCQUFnQjtZQUNoQixJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUMxQixJQUFJLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztvQkFDZCxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsSUFBd0IsQ0FBQyxDQUFDO29CQUNwRCxJQUFJLFVBQVUsQ0FBQyxhQUFhLENBQUMsRUFBRSxDQUFDO3dCQUM1QixPQUFPLEdBQUcsYUFBYSxDQUFDO29CQUM1QixDQUFDO3lCQUFNLENBQUM7d0JBQ0oseUVBQXlFO3dCQUN6RSxtREFBbUQ7d0JBQ25ELElBQUksTUFBTSxHQUFHLElBQUksQ0FBQzt3QkFDbEIsSUFBSSxPQUFPLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEtBQUssUUFBUSxJQUFJLElBQUksSUFBSSxPQUFPLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDOzRCQUN6SCxNQUFNLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7d0JBQ3pDLENBQUM7d0JBRUQsSUFBSSxNQUFNLEVBQUUsQ0FBQzs0QkFDVCxPQUFPLG1DQUFRLE1BQU0sS0FBRSxLQUFLLEVBQUUsYUFBYSxHQUFFLENBQUM7d0JBQ2xELENBQUM7NkJBQU0sQ0FBQzs0QkFDSiwwQ0FBMEM7NEJBQzFDLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxDQUFDO3dCQUN4RCxDQUFDO29CQUNMLENBQUM7b0JBQ0QsU0FBUztnQkFDYixDQUFDO2dCQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxJQUFJLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNyRyxDQUFDO1lBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQkFBaUIsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsc0JBQXNCLENBQUMsQ0FBQztRQUN4SCxDQUFDO1FBRUQsT0FBTyxPQUFvQixDQUFDO0lBQ2hDLENBQUM7SUFFTyxLQUFLLENBQUMsVUFBVSxDQUFDLElBQVksRUFBRSxJQUFZLEVBQUUsSUFBZSxFQUFFLEtBQVU7O1FBQzVFLDJCQUEyQjtRQUMzQixJQUFJLE1BQUEsSUFBSSxDQUFDLE9BQU8sMENBQUUsUUFBUSxDQUFDLFdBQVcsQ0FBQyxFQUFFLENBQUM7WUFDdEMsS0FBSyxHQUFHLE1BQU0sSUFBSSxDQUFDLDZCQUE2QixDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNsRSxDQUFDO1FBRUQsNkJBQTZCO1FBQzdCLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsS0FBSSxNQUFBLE1BQUEsSUFBSSxDQUFDLGVBQWUsMENBQUUsT0FBTywwQ0FBRSxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUEsRUFBRSxDQUFDO1lBQy9FLE1BQU0sY0FBYyxHQUFVLEVBQUUsQ0FBQztZQUNqQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEVBQUU7Z0JBQ2hDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWdCLENBQUMsQ0FBQztZQUNsRyxDQUFDLENBQUMsQ0FBQztZQUNILEtBQUssR0FBRyxjQUFjLENBQUM7UUFDM0IsQ0FBQztRQUVELE1BQU0sSUFBSSxHQUFHLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFeEMsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsY0FBYyxFQUFFO1lBQ2xELElBQUk7WUFDSixJQUFJO1lBQ0osSUFBSTtTQUNQLENBQUMsQ0FBQztRQUVILE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFTyxLQUFLLENBQUMsNkJBQTZCLENBQUMsS0FBVSxFQUFFLElBQWU7UUFDbkUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFFdkMseURBQXlEO1FBQ3pELElBQUksT0FBTyxLQUFLLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDNUIsS0FBSyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDO1FBQzVCLENBQUM7UUFFRCxtQ0FBbUM7UUFDbkMsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxLQUFLLElBQUksSUFBSSxJQUFJLElBQUksS0FBSyxFQUFFLENBQUM7WUFDL0QsS0FBSyxHQUFHLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUMvQixDQUFDO1FBRUQsdUNBQXVDO1FBQ3ZDLElBQUksV0FBVyxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO1lBQ25DLE1BQU0sU0FBUyxHQUFxQixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0csSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUNiLE1BQU0sSUFBSSxLQUFLLENBQUMsaUJBQWlCLEtBQUssQ0FBQyxJQUFJLGFBQWEsQ0FBQyxDQUFDO1lBQzlELENBQUM7WUFDRCxJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7WUFDMUIsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztnQkFDL0IsTUFBTSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsU0FBUyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtvQkFDeEQsSUFBSSxRQUFRLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDOUIsS0FBSyxHQUFHLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQzt3QkFDaEMsYUFBYSxHQUFHLElBQUksQ0FBQztvQkFDekIsQ0FBQztnQkFDTCxDQUFDLENBQUMsQ0FBQztZQUNQLENBQUM7aUJBQU0sQ0FBQztnQkFDSixhQUFhLEdBQUcsSUFBSSxDQUFDO1lBQ3pCLENBQUM7WUFFRCxJQUFJLENBQUMsYUFBYSxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO2dCQUNqRCxNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxJQUFJLENBQUMsSUFBSSxTQUFTLFNBQVMsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDO1lBQzlGLENBQUM7UUFDTCxDQUFDO1FBQ0QsT0FBTyxLQUFLLENBQUM7SUFDakIsQ0FBQztDQUNKO0FBNVJELDBDQTRSQztBQTlRUztJQWJMLElBQUEscUJBQVEsRUFDTCxnQ0FBZ0MsRUFDaEMsOElBQThJLEVBQzlJLEVBQUUsSUFBSSxFQUFFLFFBQVE7UUFDWixVQUFVLEVBQUU7WUFDUixZQUFZLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLHFCQUFxQixFQUFFLGlCQUFpQixDQUFDLEVBQUU7WUFDbEYsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsZ0dBQWdHLEVBQUU7WUFDL0ksS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxNQUFNLENBQUMsRUFBRSxvQkFBb0IsRUFBRSxJQUFJLEVBQUU7U0FDMUc7UUFDRCxRQUFRLEVBQUUsQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLE9BQU8sQ0FBQztLQUN0RCxFQUNELGdDQUFzQixFQUFFLE1BQU0sRUFBRSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUMxRztnRUFLQTtBQWlCSztJQWRMLElBQUEscUJBQVEsRUFDTCxnQ0FBZ0MsRUFDaEMsNkpBQTZKLEVBQzdKO1FBQ0ksSUFBSSxFQUFFLFFBQVE7UUFDZCxVQUFVLEVBQUU7WUFDUixTQUFTLEVBQUUsaUNBQXVCO1lBQ2xDLGFBQWEsRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxFQUFFLFdBQVcsRUFBRSw2SkFBNkosRUFBRTtZQUN2TyxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLEVBQUUsb0JBQW9CLEVBQUUsSUFBSSxFQUFFLEVBQUU7U0FDckk7UUFDRCxRQUFRLEVBQUUsQ0FBQyxXQUFXLEVBQUUsZUFBZSxFQUFFLFFBQVEsQ0FBQztLQUNyRCxFQUNELGdDQUFzQixFQUFFLE1BQU0sRUFBRSxDQUFDLFVBQVUsRUFBRSxLQUFLLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsQ0FDbEg7NERBOEJBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgdXRjcFRvb2wgfSBmcm9tICcuLi9kZWNvcmF0b3JzJztcclxuaW1wb3J0IHsgSVByb3BlcnR5LCBJUHJvcGVydHlWYWx1ZVR5cGUgfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvc2NlbmUvQHR5cGVzL3B1YmxpYyc7XHJcbmltcG9ydCB7IFRvb2xzVXRpbHMgfSBmcm9tICcuLi91dGlscy90b29scy11dGlscyc7XHJcbmltcG9ydCB7IEltcG9ydGVyTWFuYWdlciB9IGZyb20gJy4uL3V0aWxzL2Fzc2V0LWltcG9ydGVycyc7XHJcbmltcG9ydCB7IEFzc2V0SW5mbyB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9hc3NldC1kYi9AdHlwZXMvcHVibGljJztcclxuaW1wb3J0IHsgSUluc3RhbmNlUmVmZXJlbmNlLCBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSwgSVN1Y2Nlc3NJbmRpY2F0b3IsIFN1Y2Nlc3NJbmRpY2F0b3JTY2hlbWEgfSBmcm9tICcuLi9zY2hlbWFzJztcclxuXHJcbmRlY2xhcmUgY29uc3QgRWRpdG9yOiBhbnk7XHJcblxyXG5leHBvcnQgY2xhc3MgU2V0UHJvcGVydHlUb29sIHtcclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICBcImluc3BlY3RvclNldFNldHRpbmdzUHJvcGVydGllc1wiLFxyXG4gICAgICAgIFwiU2V0cyBhIHByb3BlcnR5IG9uIHRoZSBzcGVjaWZpYyBzZXR0aW5ncy4gSWYgYSBwcm9wZXJ0eSBwYXRoIG9yIHR5cGUgaXMgbm90IGNvbmZpcm1lZCB2aWEgaW5zcGVjdG9yR2V0KiB0b29scywgeW91IE1VU1QgTk9UIGNhbGwgYW55IHNldHRlci5cIixcclxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICBzZXR0aW5nc1R5cGU6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsnQ3VycmVudFNjZW5lR2xvYmFscycsICdQcm9qZWN0U2V0dGluZ3MnXSB9LFxyXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogXCJQbGFpbiBwYXRoIHRvIHRoZSBwcm9wZXJ0eSAoZS5nLiwgJ2FtYmllbnQuc2t5TGlnaHRpbmdDb2xvci5yJykuIERvbid0IHN1cHBvcnQgY29kZSBleGVjdXRpb24uXCIgfSxcclxuICAgICAgICAgICAgICAgIHZhbHVlOiB7IHR5cGU6IFsnYXJyYXknLCAnb2JqZWN0JywgJ3N0cmluZycsICdudW1iZXInLCAnYm9vbGVhbicsICdudWxsJ10sIGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlIH1cclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnc2V0dGluZ3NUeXBlJywgJ3Byb3BlcnR5UGF0aCcsICd2YWx1ZSddXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTdWNjZXNzSW5kaWNhdG9yU2NoZW1hLCBcIlBPU1RcIiwgWydwcm9wZXJ0eScsICdzZXQnLCAnc2NlbmUnLCAnc2V0dGluZ3MnLCAncHJvamVjdCcsICdtb2RpZnknLCAnY29uZmlnJ11cclxuICAgIClcclxuICAgIGFzeW5jIHNldEN1cnJlbnRTY2VuZVByb3BlcnRpZXMocGFyYW1zOiB7IHNldHRpbmdzVHlwZTogc3RyaW5nLCBwcm9wZXJ0eVBhdGhzOiBzdHJpbmdbXSwgdmFsdWVzOiBhbnlbXSB9KTogUHJvbWlzZTxJU3VjY2Vzc0luZGljYXRvcj4ge1xyXG4gICAgICAgIHJldHVybiBhd2FpdCB0aGlzLnNldEluc3RhbmNlUHJvcGVydGllcyh7XHJcbiAgICAgICAgICAgIHJlZmVyZW5jZTogeyBpZDogcGFyYW1zLnNldHRpbmdzVHlwZSB9LCBwcm9wZXJ0eVBhdGhzOiBwYXJhbXMucHJvcGVydHlQYXRocywgdmFsdWVzOiBwYXJhbXMudmFsdWVzXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICBcImluc3BlY3RvclNldEluc3RhbmNlUHJvcGVydGllc1wiLFxyXG4gICAgICAgIFwiU2V0cyBhIHByb3BlcnR5IG9uIGluc3RhbmNlIG9mIE5vZGUsIENvbXBvbmVudCBvciBBc3NldC4gSWYgYSBwcm9wZXJ0eSBwYXRoIG9yIHR5cGUgaXMgbm90IGNvbmZpcm1lZCB2aWEgaW5zcGVjdG9yR2V0KiB0b29scywgeW91IE1VU1QgTk9UIGNhbGwgYW55IHNldHRlci5cIixcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLFxyXG4gICAgICAgICAgICAgICAgcHJvcGVydHlQYXRoczogeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LCBkZXNjcmlwdGlvbjogXCJQbGFpbiBwYXRocyB0byB0aGUgcHJvcGVydGllcyAoZS5nLiwgWydwb3NpdGlvbi54JywgJ3JvdGF0aW9uLnknXSkuIERvbid0IHN1cHBvcnQgY29kZSBleGVjdXRpb24uIEFycmF5cyBhcmUgcmVhY2hlZCBieSBpbmRleGVzLiAoZS5nLiAnc2hhcmVkTWF0ZXJpYWxzLjAnKVwiIH0sXHJcbiAgICAgICAgICAgICAgICB2YWx1ZXM6IHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogWydhcnJheScsICdvYmplY3QnLCAnc3RyaW5nJywgJ251bWJlcicsICdib29sZWFuJywgJ251bGwnXSwgYWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUgfSB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ3JlZmVyZW5jZScsICdwcm9wZXJ0eVBhdGhzJywgJ3ZhbHVlcyddXHJcbiAgICAgICAgfSxcclxuICAgICAgICBTdWNjZXNzSW5kaWNhdG9yU2NoZW1hLCBcIlBPU1RcIiwgWydwcm9wZXJ0eScsICdzZXQnLCAnaW5zdGFuY2UnLCAnbm9kZScsICdjb21wb25lbnQnLCAnYXNzZXQnLCAnbW9kaWZ5JywgJ21ldGEnXVxyXG4gICAgKVxyXG4gICAgYXN5bmMgc2V0SW5zdGFuY2VQcm9wZXJ0aWVzKHBhcmFtczogeyByZWZlcmVuY2U6IElJbnN0YW5jZVJlZmVyZW5jZSwgcHJvcGVydHlQYXRoczogc3RyaW5nW10sIHZhbHVlczogYW55W10gfSk6IFByb21pc2U8SVN1Y2Nlc3NJbmRpY2F0b3I+IHtcclxuICAgICAgICBsZXQgeyByZWZlcmVuY2U6IHsgaWQ6IHV1aWQgfSwgcHJvcGVydHlQYXRocywgdmFsdWVzIH0gPSBwYXJhbXM7XHJcblxyXG4gICAgICAgIGlmICghcHJvcGVydHlQYXRocyB8fCAhdmFsdWVzKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgcGF0aHMgYW5kIHZhbHVlcyBhcmUgcmVxdWlyZWQuYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAocHJvcGVydHlQYXRocy5sZW5ndGggIT09IHZhbHVlcy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSBwYXRocyBjb3VudCAoJHtwcm9wZXJ0eVBhdGhzLmxlbmd0aH0pIGRvZXMgbm90IG1hdGNoIHZhbHVlcyBjb3VudCAoJHt2YWx1ZXMubGVuZ3RofSkuYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgaW5mbyA9IGF3YWl0IFRvb2xzVXRpbHMuaW5zcGVjdEluc3RhbmNlKHV1aWQsIGZhbHNlKTtcclxuICAgICAgICBpZiAoIWluZm8pIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUYXJnZXQgJHt1dWlkfSBub3QgZm91bmQgb3Igbm90IHN1cHBvcnRlZC5gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHV1aWQgPSBpbmZvLnV1aWQ7XHJcblxyXG4gICAgICAgIGNvbnN0IHsgdHlwZSwgcHJvcHMsIGFzc2V0SW5mbyB9ID0gaW5mbztcclxuXHJcbiAgICAgICAgaWYgKCFwcm9wcykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCByZXRyaWV2ZSBwcm9wZXJ0aWVzIGZvciAke3R5cGV9IG9mIGluc3RhbmNlICR7dXVpZH0uYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHByb3BlcnR5UGF0aHMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRQcm9wZXJ0eShpbmZvLCBwcm9wZXJ0eVBhdGhzW2ldLCB2YWx1ZXNbaV0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgc2V0UHJvcGVydHkoeyB1dWlkLCB0eXBlLCBwcm9wcywgYXNzZXRJbmZvIH06IHsgdXVpZDogc3RyaW5nLCB0eXBlOiBzdHJpbmcsIHByb3BzOiB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9IHwgbnVsbCwgYXNzZXRJbmZvOiBBc3NldEluZm8gfCBudWxsIH0sIHByb3BlcnR5UGF0aDogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgLy8gRmluZCBwcm9wZXJ0eSBkZWZpbml0aW9uIGluIHRoZSBkdW1wXHJcbiAgICAgICAgbGV0IHRhcmdldFByb3A6IElQcm9wZXJ0eSB8IG51bGwgPSBudWxsO1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHRhcmdldFByb3AgPSB0aGlzLmZpbmRQcm9wZXJ0eUluRHVtcChwcm9wcywgcHJvcGVydHlQYXRoKTtcclxuICAgICAgICB9IGNhdGNoIChlOiBhbnkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAnJHtwcm9wZXJ0eVBhdGh9JyByZXNvbHV0aW9uIGZhaWxlZDogJHtlLm1lc3NhZ2V9LiBQbGVhc2UgcmVjaGVjayBUeXBlc2NyaXB0RGVmaW5pdGlvbiBvZiAke3V1aWR9LiBBcnJheXMgYXJlIHJlYWNoZWQgYnkgaW5kZXhlcy5gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghdGFyZ2V0UHJvcCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5ICcke3Byb3BlcnR5UGF0aH0nIG5vdCBmb3VuZCBvbiAke3R5cGV9IG9mIGluc3RhbmNlICR7dXVpZH0uYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBOb3JtYWxpemUgdmFsdWUgYmFzZWQgb24gcHJvcGVydHkgZGVmaW5pdGlvblxyXG4gICAgICAgIHZhbHVlID0gdGhpcy5ub3JtYWxpemVWYWx1ZSh2YWx1ZSwgdGFyZ2V0UHJvcCk7XHJcblxyXG4gICAgICAgIGlmIChhc3NldEluZm8pIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN1Y2Nlc3M6IGJvb2xlYW4gfCB1bmRlZmluZWQgPSBhd2FpdCBJbXBvcnRlck1hbmFnZXIuZ2V0SW5zdGFuY2UoKS5nZXRJbXBvcnRlcihhc3NldEluZm8uaW1wb3J0ZXIpPy5zZXRQcm9wZXJ0eShhc3NldEluZm8sIHByb3BlcnR5UGF0aCwgdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFzdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBJbXBvcnRlciBmYWlsZWQgdG8gc2V0IHByb3BlcnR5LmApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBzZXQgcHJvcGVydHkgb24gQXNzZXQgJHt1dWlkfTogJHtlfWApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0eXBlID09PSAnY2MuU2NlbmVHbG9iYWxzJykge1xyXG4gICAgICAgICAgICAvLyBTY2VuZSBHbG9iYWxzIGFyZSBwYXJ0IG9mIHRoZSBzY2VuZSBub2RlIGJ1dCB1bmRlciBfZ2xvYmFsc1xyXG4gICAgICAgICAgICBwcm9wZXJ0eVBhdGggPSBgX2dsb2JhbHMuJHtwcm9wZXJ0eVBhdGh9YDtcclxuICAgICAgICAgICAgLy8gdXVpZCBpcyBhbHJlYWR5IHNldCB0byB0aGUgU2NlbmUgVVVJRCBmcm9tIGluc3BlY3RJbnN0YW5jZVxyXG4gICAgICAgIH0gZWxzZSBpZiAodHlwZSAhPT0gJ2NjLk5vZGUnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5vZGVVdWlkID0gKHByb3BzIGFzIGFueSkubm9kZS52YWx1ZS51dWlkO1xyXG4gICAgICAgICAgICBjb25zdCBub2RlSW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBub2RlVXVpZCk7XHJcbiAgICAgICAgICAgIGlmICghbm9kZUluZm8pIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IE5vZGUgJHtub2RlVXVpZH0gZm9yIENvbXBvbmVudCAke3V1aWR9IG5vdCBmb3VuZC5gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBjb21wb25lbnRJbmRleCA9IG5vZGVJbmZvLl9fY29tcHNfXy5maW5kSW5kZXgoKGNvbXA6IGFueSkgPT4gY29tcC52YWx1ZS51dWlkLnZhbHVlID09PSB1dWlkKTtcclxuICAgICAgICAgICAgcHJvcGVydHlQYXRoID0gYF9fY29tcHNfXy4ke2NvbXBvbmVudEluZGV4fS4ke3Byb3BlcnR5UGF0aH1gO1xyXG4gICAgICAgICAgICB1dWlkID0gbm9kZVV1aWQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhd2FpdCB0aGlzLmFwcGx5VmFsdWUodXVpZCwgcHJvcGVydHlQYXRoLCB0YXJnZXRQcm9wLCB2YWx1ZSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBub3JtYWxpemVWYWx1ZSh2YWx1ZTogYW55LCBwcm9wOiBJUHJvcGVydHkpOiBhbnkge1xyXG4gICAgICAgIC8vIFRyeSB0byBwYXJzZSBzdHJpbmcgdmFsdWVzIGludG8gcHJvcGVyIHR5cGVzXHJcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgY29uc3QgaXNTdHJpbmdQcm9wID0gcHJvcC50eXBlID09PSAnU3RyaW5nJztcclxuICAgICAgICAgICAgaWYgKCFpc1N0cmluZ1Byb3ApIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHQgPSB2YWx1ZS50cmltKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodCA9PT0gJ3RydWUnKSByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGlmICh0ID09PSAnZmFsc2UnKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKCFpc05hTihOdW1iZXIodCkpICYmIHQgIT09ICcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIE51bWJlcih0KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoKHQuc3RhcnRzV2l0aCgneycpIHx8IHQuc3RhcnRzV2l0aCgnWycpKSAmJiAodC5lbmRzV2l0aCgnfScpIHx8IHQuZW5kc1dpdGgoJ10nKSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0cnkgeyByZXR1cm4gSlNPTi5wYXJzZSh0KTsgfSBjYXRjaCAoZSkgeyB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZmluZFByb3BlcnR5SW5EdW1wKHJvb3Q6IHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5VmFsdWVUeXBlIH0gfCBBc3NldEluZm8gfCBudWxsLCBwYXRoOiBzdHJpbmcpOiBJUHJvcGVydHkgfCBudWxsIHtcclxuICAgICAgICBpZiAoIXBhdGgpIHJldHVybiBudWxsO1xyXG4gICAgICAgIGlmICghcm9vdCkgcmV0dXJuIG51bGw7XHJcblxyXG4gICAgICAgIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xyXG5cclxuICAgICAgICBsZXQgY3VycmVudDogYW55ID0geyB2YWx1ZTogcm9vdCB9OyAvLyBXcmFwIHRvIHVuaWZ5IHRyYXZlcnNhbFxyXG5cclxuICAgICAgICAvLyBIZWxwZXIgdG8gY2hlY2sgaWYgb2JqZWN0IGxvb2tzIGxpa2UgYSBwcm9wZXJ0eSBkZWZpbml0aW9uXHJcbiAgICAgICAgY29uc3QgaXNQcm9wZXJ0eSA9IChvYmo6IGFueSkgPT4gb2JqICYmIHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmICgndHlwZScgaW4gb2JqIHx8ICdleHRlbmRzJyBpbiBvYmopO1xyXG5cclxuICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcnQgPSBwYXJ0c1tpXTtcclxuXHJcbiAgICAgICAgICAgIC8vIEN1cnJlbnQgaXMgZXhwZWN0ZWQgdG8gYmUgYW4gSVByb3BlcnR5IG9yIG9iamVjdCBjb250YWluaW5nIElQcm9wZXJ0eSBkYXRhXHJcbiAgICAgICAgICAgIGxldCB2YWwgPSBjdXJyZW50LnZhbHVlO1xyXG4gICAgICAgICAgICAvLyBJZiBjdXJyZW50IGlzIGp1c3QgdGhlIGRpY3Rpb25hcnkgKHJvb3QpLCB1c2UgaXQgZGlyZWN0bHlcclxuICAgICAgICAgICAgaWYgKGN1cnJlbnQgPT09IHJvb3QgfHwgKHR5cGVvZiBjdXJyZW50ID09PSAnb2JqZWN0JyAmJiAhKCd2YWx1ZScgaW4gY3VycmVudCkpKSB7XHJcbiAgICAgICAgICAgICAgICB2YWwgPSBjdXJyZW50O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAodmFsID09PSB1bmRlZmluZWQgfHwgdmFsID09PSBudWxsKSByZXR1cm4gbnVsbDtcclxuXHJcbiAgICAgICAgICAgIC8vIDEuIEFycmF5IEluZGV4XHJcbiAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHZhbCkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlkeCA9IHBhcnNlSW50KHBhcnQpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFpc05hTihpZHgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gRXhpc3RpbmcgaW5kZXhcclxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsW2lkeF0gIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlbGVtID0gdmFsW2lkeF07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc1Byb3BlcnR5KGVsZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gZWxlbTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjdXJyZW50LmVsZW1lbnRUeXBlRGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSHlkcmF0ZSBmcm9tIHNjaGVtYVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudCA9IHsgLi4uY3VycmVudC5lbGVtZW50VHlwZURhdGEsIHZhbHVlOiBlbGVtIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjayBmb3IgcHJpbWl0aXZlIGFycmF5cyB3aXRob3V0IHNjaGVtYVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudCA9IHsgdmFsdWU6IGVsZW0sIHR5cGU6ICdVbmtub3duJyB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvLyBFeHRlbmRpbmcgYXJyYXkgc3VwcG9ydDogQWxsb3cgaW5kZXggPT0gbGVuZ3RoIGlmIHNjaGVtYSBleGlzdHMuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gRG9uJ3QgYWxsb3cgZ2FwcyAoaWR4ID4gbGVuZ3RoKS5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoaWR4ID09PSB2YWwubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjdXJyZW50LmVsZW1lbnRUeXBlRGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQuZWxlbWVudFR5cGVEYXRhO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFycmF5IGV4dGVuc2lvbiBhdCAnJHtwYXJ0fScgZmFpbGVkOiBObyBlbGVtZW50VHlwZURhdGEuYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBcnJheSBpbmRleCAnJHtpZHh9JyBvdXQgb2YgYm91bmRzIChsZW5ndGg6ICR7dmFsLmxlbmd0aH0pIGF0ICcke3BhcnR9Jy5gKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBhcnJheSBpbmRleCAnJHtwYXJ0fScgYXQgJyR7cGF0aH0nLmApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyAyLiBPYmplY3QgS2V5XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgaWYgKHBhcnQgaW4gdmFsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcHJvcENhbmRpZGF0ZSA9IHZhbFtwYXJ0IGFzIGtleW9mIHR5cGVvZiB2YWxdO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChpc1Byb3BlcnR5KHByb3BDYW5kaWRhdGUpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBwcm9wQ2FuZGlkYXRlO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIE5vdCBhIHByb3BlcnR5LCBwcm9iYWJseSBhIHJhdyB2YWx1ZSBpbiBhIHN0cnVjdCAobGlrZSBwb3NpdGlvbi54ID0gMClcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpbmQgc2NoZW1hIGluIGRlZmF1bHQgdmFsdWUgaWYgYXZhaWxhYmxlXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCBzY2hlbWEgPSBudWxsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudC5kZWZhdWx0ICYmIGN1cnJlbnQuZGVmYXVsdC52YWx1ZSAmJiB0eXBlb2YgY3VycmVudC5kZWZhdWx0LnZhbHVlID09PSAnb2JqZWN0JyAmJiBwYXJ0IGluIGN1cnJlbnQuZGVmYXVsdC52YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2NoZW1hID0gY3VycmVudC5kZWZhdWx0LnZhbHVlW3BhcnRdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2NoZW1hKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0geyAuLi5zY2hlbWEsIHZhbHVlOiBwcm9wQ2FuZGlkYXRlIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBObyBzY2hlbWEgZm91bmQsIHRyZWF0IGFzIHVudHlwZWQgdmFsdWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGN1cnJlbnQgPSB7IHZhbHVlOiBwcm9wQ2FuZGlkYXRlLCB0eXBlOiAnVW5rbm93bicgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgS2V5ICcke3BhcnR9JyBub3QgZm91bmQgJHtpID09IDAgPyAnJyA6ICdpbiAnICsgcGFydHMuc2xpY2UoMCwgaSkuam9pbignLicpfS5gKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXRoIHNlZ21lbnQgJyR7cGFydH0nICcke2kgPT0gMCA/ICcnIDogJ2F0ICcgKyBwYXJ0cy5zbGljZSgwLCBpKS5qb2luKCcuJyl9JyBmYWlsZWQgcmVzb2x1dGlvbi5gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBjdXJyZW50IGFzIElQcm9wZXJ0eTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGFwcGx5VmFsdWUodXVpZDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIHByb3A6IElQcm9wZXJ0eSwgdmFsdWU6IGFueSkge1xyXG4gICAgICAgIC8vIEhhbmRsZSBkaXJlY3QgcmVmZXJlbmNlc1xyXG4gICAgICAgIGlmIChwcm9wLmV4dGVuZHM/LmluY2x1ZGVzKCdjYy5PYmplY3QnKSkge1xyXG4gICAgICAgICAgICB2YWx1ZSA9IGF3YWl0IHRoaXMuY29udmVydE9iamVjdFJlZmVyZW5jZVRvQ29jb3ModmFsdWUsIHByb3ApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gSGFuZGxlIGFycmF5IG9mIHJlZmVyZW5jZXNcclxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkgJiYgcHJvcC5lbGVtZW50VHlwZURhdGE/LmV4dGVuZHM/LmluY2x1ZGVzKCdjYy5PYmplY3QnKSkge1xyXG4gICAgICAgICAgICBjb25zdCBjb252ZXJ0ZWRBcnJheTogYW55W10gPSBbXTtcclxuICAgICAgICAgICAgdmFsdWUuZm9yRWFjaChhc3luYyAoaXRlbSwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnZlcnRlZEFycmF5W2luZGV4XSA9IGF3YWl0IHRoaXMuY29udmVydE9iamVjdFJlZmVyZW5jZVRvQ29jb3MoaXRlbSwgcHJvcC5lbGVtZW50VHlwZURhdGEhKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIHZhbHVlID0gY29udmVydGVkQXJyYXk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBkdW1wID0geyB2YWx1ZSwgdHlwZTogcHJvcC50eXBlIH07XHJcblxyXG4gICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wcm9wZXJ0eScsIHtcclxuICAgICAgICAgICAgdXVpZCxcclxuICAgICAgICAgICAgcGF0aCxcclxuICAgICAgICAgICAgZHVtcFxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgY29udmVydE9iamVjdFJlZmVyZW5jZVRvQ29jb3ModmFsdWU6IGFueSwgcHJvcDogSVByb3BlcnR5KTogUHJvbWlzZTx7IHV1aWQ6IHN0cmluZyB9PiB7XHJcbiAgICAgICAgY29uc3QgZXh0ZW5kc0luZm8gPSBwcm9wLmV4dGVuZHMgfHwgW107XHJcblxyXG4gICAgICAgIC8vIEFjY2VwdCBwbGFpbiBVVUlEIHN0cmluZyBvciB7IHV1aWQ6IHN0cmluZyB9IHN0cnVjdHVyZVxyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XHJcbiAgICAgICAgICAgIHZhbHVlID0geyB1dWlkOiB2YWx1ZSB9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBcclxuICAgICAgICAvLyBSZWZlcmVuY2Ugb2JqZWN0IHdpdGggaWQgaXMgc2VudFxyXG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICYmICdpZCcgaW4gdmFsdWUpIHtcclxuICAgICAgICAgICAgdmFsdWUgPSB7IHV1aWQ6IHZhbHVlLmlkIH07XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBTcGVjaWFsIGNhc2UgZm9yIGFzc2V0IHN1YnR5cGUgY2hlY2tcclxuICAgICAgICBpZiAoZXh0ZW5kc0luZm8uaW5jbHVkZXMoJ2NjLkFzc2V0JykpIHtcclxuICAgICAgICAgICAgY29uc3QgYXNzZXRJbmZvOiBBc3NldEluZm8gfCBudWxsID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIHZhbHVlLnV1aWQpO1xyXG4gICAgICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NldCB3aXRoIGlkICR7dmFsdWUudXVpZH0gbm90IGZvdW5kLmApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxldCBmb3VuZFN1YkFzc2V0ID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGlmIChhc3NldEluZm8udHlwZSAhPT0gcHJvcC50eXBlKSB7XHJcbiAgICAgICAgICAgICAgICBPYmplY3QudmFsdWVzKGFzc2V0SW5mby5zdWJBc3NldHMgfHwge30pLmZvckVhY2goc3ViQXNzZXQgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWJBc3NldC50eXBlID09PSBwcm9wLnR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB7IHV1aWQ6IHN1YkFzc2V0LnV1aWQgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm91bmRTdWJBc3NldCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBmb3VuZFN1YkFzc2V0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKCFmb3VuZFN1YkFzc2V0ICYmIGFzc2V0SW5mby50eXBlICE9PSBwcm9wLnR5cGUpIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUmVmZXJlbmNlIHR5cGUgbWlzbWF0Y2g6IGV4cGVjdGVkICR7cHJvcC50eXBlfSwgZ290ICR7YXNzZXRJbmZvLnR5cGV9LmApO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB2YWx1ZTtcclxuICAgIH1cclxufVxyXG4iXX0=