"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaterialImporter = void 0;
const base_importer_1 = require("./base-importer");
class MaterialImporter extends base_importer_1.BaseAssetImporter {
    constructor() {
        super(...arguments);
        this.name = 'material';
    }
    async getProperties(assetInfo) {
        var _a;
        const materialDump = await Editor.Message.request('scene', 'query-material', assetInfo.uuid);
        if (!materialDump) {
            throw new Error('Material dump not found');
        }
        const propertyContainer = {};
        // Get Effect Info
        const collator = new Intl.Collator(undefined, { numeric: true });
        const effects = Object.values(await Editor.Message.request('scene', 'query-all-effects'))
            .filter((effect) => !effect.hideInEditor)
            .sort((a, b) => collator.compare(a.name, b.name));
        let effectName = (_a = materialDump.effect) !== null && _a !== void 0 ? _a : 'builtin-standard';
        propertyContainer['effect'] = {
            value: effectName,
            type: 'Enum',
            userData: { enumName: 'MaterialEffectAssetName' },
            enumList: effects.map((effect) => ({ name: effect.name.replace('../', ''), value: effect.name })),
            visible: true,
            readonly: false
        };
        if (materialDump.data) {
            const techniqueOptions = materialDump.data.map((t, i) => ({ name: t.name || i.toString(), value: i }));
            propertyContainer['technique'] = {
                value: materialDump.technique,
                type: 'Enum',
                enumList: techniqueOptions,
                visible: true,
                readonly: false
            };
            const currentTechniqueIndex = materialDump.technique || 0;
            const currentTechnique = materialDump.data[currentTechniqueIndex];
            if (currentTechnique && currentTechnique.passes) {
                const passes = [];
                function checkDefineVisibility(defines, defineMap) {
                    for (const def of defines) {
                        if (def.startsWith('!')) {
                            if (defineMap[def.substring(1)]) {
                                return false;
                            }
                        }
                        else {
                            if (!defineMap[def]) {
                                return false;
                            }
                        }
                    }
                    return true;
                }
                currentTechnique.passes.forEach((pass, passIndex) => {
                    const passProps = {};
                    // Create a map of defines for quick lookup
                    const defineMap = {};
                    if (pass.defines) {
                        // Prepare define map
                        pass.defines.forEach((def) => {
                            defineMap[def.name] = def.value;
                        });
                        // Process defines
                        pass.defines.forEach((def) => {
                            // Transform define type based on logic
                            let type = def.type;
                            let enumList = def.enumList;
                            switch (def.type) {
                                case 'Number':
                                    type = 'Enum';
                                    enumList = [];
                                    if (def.range && def.range.length >= 2) {
                                        for (let i = def.range[0]; i <= def.range[1]; i++) {
                                            enumList.push({ name: `Variant${i}`, value: i });
                                        }
                                    }
                                    break;
                                case 'String':
                                    type = 'Enum';
                                    enumList = [];
                                    if (def.options) {
                                        enumList = def.options.map((str) => ({ name: str, value: str }));
                                    }
                                    break;
                                case 'Enum':
                                    break;
                                default:
                                    type = 'Boolean';
                                    break;
                            }
                            const defProp = {
                                type: type,
                                extends: [],
                                value: def.value,
                                tooltip: def.tooltip,
                                enumList: enumList,
                                visible: checkDefineVisibility(def.defines || [], defineMap)
                            };
                            passProps[def.name] = defProp;
                        });
                    }
                    // Process properties
                    if (pass.props) {
                        pass.props.forEach((prop) => {
                            // Inject extends: ['cc.ValueType'] for known value types to prevent custom class generation
                            let extendsData = prop.extends || [];
                            if (['Vec2', 'Vec3', 'Vec4', 'Color', 'Rect', 'Size', 'Quat', 'Mat3', 'Mat4'].includes(prop.type)) {
                                if (!extendsData.includes('cc.ValueType')) {
                                    extendsData = [...extendsData, 'cc.ValueType'];
                                }
                            }
                            const valProp = Object.assign(Object.assign({}, prop), { displayName: prop.displayName || prop.name, visible: checkDefineVisibility(prop.defines || [], defineMap), extends: extendsData });
                            passProps[prop.name] = valProp;
                        });
                    }
                    const passHasProps = Object.keys(passProps).length > 0;
                    passProps['phase'] = {
                        extends: [],
                        type: 'String',
                        value: pass.phase || '',
                        visible: true,
                        readonly: true
                    };
                    passes.push({
                        extends: ['cc.MaterialPass'],
                        value: passProps,
                        type: `cc.MaterialPass${passHasProps ? passIndex : ''}`
                    });
                });
                const passesProp = {
                    value: passes,
                    type: 'cc.MaterialPasses',
                    visible: true
                };
                propertyContainer['passes'] = passesProp;
            }
        }
        return propertyContainer;
    }
    async setProperty(assetInfo, path, value) {
        // 1. Get the current material dump
        const materialDump = await Editor.Message.request('scene', 'query-material', assetInfo.uuid);
        if (!materialDump) {
            return false;
        }
        let handled = false;
        // 2. Handle simple root properties
        if (path === 'effectAsset' || path === 'effect') {
            const effects = await Editor.Message.request('scene', 'query-all-effects');
            if (value && value.name) {
                value = value.name;
            }
            if (typeof value === 'object' && 'uuid' in value) {
                value = value.uuid;
            }
            if (effects[value]) {
                value = effects[value].name;
                handled = true;
            }
            else {
                const effect = effects.find((eff) => eff.name === value);
                if (effect) {
                    value = effect.name;
                    handled = true;
                }
                else {
                    // Effect not found
                    throw new Error(`Effect '${value}' not found`);
                }
            }
        }
        else if (path === 'technique') {
            materialDump.technique = value;
            handled = true;
        }
        else {
            // 3. Handle data/props traversal
            const techniqueIndex = materialDump.technique || 0;
            const technique = materialDump.data[techniqueIndex];
            if (technique && technique.passes) {
                const parts = path.split('.');
                let targetPassIndices = [];
                let propPathParts = [];
                // Check for explicit pass path "passes.0.propName..."
                if (parts[0] === 'passes' && !isNaN(parseInt(parts[1]))) {
                    targetPassIndices = [parseInt(parts[1])];
                    propPathParts = parts.slice(2);
                }
                else {
                    // Implicit: Search all passes in current technique
                    targetPassIndices = technique.passes.map((_, i) => i);
                    propPathParts = parts;
                }
                if (propPathParts.length > 0) {
                    const propName = propPathParts[0];
                    const subProps = propPathParts.slice(1);
                    const setDeepProperty = (target, pathParts, val) => {
                        let current = target;
                        // Navigate to the parent of the target property
                        for (let i = 0; i < pathParts.length - 1; i++) {
                            const key = pathParts[i];
                            // 1. Try to access key directly
                            if (current[key] !== undefined) {
                                current = current[key];
                                continue;
                            }
                            // 2. Try to drill into .value (if current is a wrapper)
                            if (current.value && typeof current.value === 'object' && current.value[key] !== undefined) {
                                current = current.value[key];
                                continue;
                            }
                            // 3. Special case for arrays where we might be accessing by index but current is a wrapper
                            if (current.value && Array.isArray(current.value) && current.value[key] !== undefined) {
                                current = current.value[key];
                                continue;
                            }
                            // Path not found
                            return false;
                        }
                        const lastKey = pathParts[pathParts.length - 1];
                        // Helper to set on the final object
                        const setOnObject = (obj) => {
                            if (obj[lastKey] === undefined)
                                return false;
                            const targetProp = obj[lastKey];
                            // Check if the target is a Property Wrapper (Object with .value)
                            // We avoid Arrays or nulls
                            if (targetProp && typeof targetProp === 'object' && !Array.isArray(targetProp) && 'value' in targetProp) {
                                targetProp.value = val;
                            }
                            else {
                                // It's a raw value (primitive or struct without wrapper)
                                obj[lastKey] = val;
                            }
                            return true;
                        };
                        // 1. Try direct set
                        if (setOnObject(current))
                            return true;
                        // 2. Try set on .value (if wrapper)
                        if (current.value && typeof current.value === 'object') {
                            if (setOnObject(current.value))
                                return true;
                        }
                        return false;
                    };
                    targetPassIndices.forEach(passIndex => {
                        const pass = technique.passes[passIndex];
                        if (!pass)
                            return;
                        // 1. Search in props (Array)
                        if (pass.props) {
                            const prop = pass.props.find((p) => p.name === propName);
                            if (prop) {
                                if (subProps.length === 0) {
                                    if (typeof value === 'string' && prop.type &&
                                        (prop.type.toLowerCase().includes('texture') || prop.type.toLowerCase().includes('sampler'))) {
                                        prop.value = { uuid: value };
                                    }
                                    else {
                                        prop.value = value;
                                    }
                                    handled = true;
                                }
                                else {
                                    // Validate if prop.value is object for deep set
                                    if (prop.value && typeof prop.value === 'object') {
                                        if (setDeepProperty(prop, subProps, value)) {
                                            handled = true;
                                        }
                                    }
                                }
                            }
                        }
                        // 2. Search in defines (Array)
                        if (pass.defines) {
                            const define = pass.defines.find((d) => d.name === propName);
                            if (define) {
                                if (subProps.length === 0) {
                                    define.value = value;
                                    handled = true;
                                }
                            }
                        }
                        // 3. Search in states (Object)
                        if (pass.states && pass.states.value) {
                            // Check direct state property (e.g., "priority", "primitive")
                            if (pass.states.value[propName]) {
                                const stateProp = pass.states.value[propName];
                                if (subProps.length === 0) {
                                    stateProp.value = value;
                                    handled = true;
                                }
                                else {
                                    if (stateProp.value && typeof stateProp.value === 'object') {
                                        if (setDeepProperty(stateProp, subProps, value)) {
                                            handled = true;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }
        // 4. Apply changes
        if (handled) {
            await Editor.Message.request('scene', 'apply-material', assetInfo.uuid, materialDump);
            Editor.Message.broadcast('material-inspector:change-dump');
            return true;
        }
        return false;
    }
}
exports.MaterialImporter = MaterialImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWF0ZXJpYWwtaW1wb3J0ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zb3VyY2UvdXRjcC91dGlscy9hc3NldC1pbXBvcnRlcnMvbWF0ZXJpYWwtaW1wb3J0ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbURBQW9EO0FBSXBELE1BQWEsZ0JBQWlCLFNBQVEsaUNBQWlCO0lBQXZEOztRQUNJLFNBQUksR0FBRyxVQUFVLENBQUM7SUErVnRCLENBQUM7SUE3VkcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFjOztRQUM5QixNQUFNLFlBQVksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFN0YsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMseUJBQXlCLENBQUMsQ0FBQztRQUMvQyxDQUFDO1FBRUQsTUFBTSxpQkFBaUIsR0FBaUMsRUFBRSxDQUFDO1FBRTNELGtCQUFrQjtRQUNsQixNQUFNLFFBQVEsR0FBRyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUM7UUFDakUsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO2FBQ3BGLE1BQU0sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsQ0FBRSxNQUFjLENBQUMsWUFBWSxDQUFDO2FBQ2pELElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUUsQ0FBUyxDQUFDLElBQUksRUFBRyxDQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztR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b0JBQ0wsQ0FBQyxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO1FBRUQsbUJBQW1CO1FBQ25CLElBQUksT0FBTyxFQUFFLENBQUM7WUFDVCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQ3RGLE1BQU0sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLGdDQUFnQyxDQUFDLENBQUM7WUFDM0QsT0FBTyxJQUFJLENBQUM7UUFDakIsQ0FBQztRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2pCLENBQUM7Q0FDSjtBQWhXRCw0Q0FnV0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQXNzZXRJbXBvcnRlciB9IGZyb20gJy4vYmFzZS1pbXBvcnRlcic7XHJcbmltcG9ydCB7IElBc3NldEluZm8gfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3B1YmxpYyc7XHJcbmltcG9ydCB7IElQcm9wZXJ0eSwgSVByb3BlcnR5VmFsdWVUeXBlIH0gZnJvbSAnQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9wdWJsaWMnO1xyXG5cclxuZXhwb3J0IGNsYXNzIE1hdGVyaWFsSW1wb3J0ZXIgZXh0ZW5kcyBCYXNlQXNzZXRJbXBvcnRlciB7XHJcbiAgICBuYW1lID0gJ21hdGVyaWFsJztcclxuXHJcbiAgICBhc3luYyBnZXRQcm9wZXJ0aWVzKGFzc2V0SW5mbzogYW55KTogUHJvbWlzZTx7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9PiB7XHJcbiAgICAgICAgY29uc3QgbWF0ZXJpYWxEdW1wID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbWF0ZXJpYWwnLCBhc3NldEluZm8udXVpZCk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCFtYXRlcmlhbER1bXApIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNYXRlcmlhbCBkdW1wIG5vdCBmb3VuZCcpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcHJvcGVydHlDb250YWluZXI6IHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5IH0gPSB7fTtcclxuXHJcbiAgICAgICAgLy8gR2V0IEVmZmVjdCBJbmZvXHJcbiAgICAgICAgY29uc3QgY29sbGF0b3IgPSBuZXcgSW50bC5Db2xsYXRvcih1bmRlZmluZWQsIHsgbnVtZXJpYzogdHJ1ZSB9KTtcclxuICAgICAgICBjb25zdCBlZmZlY3RzID0gT2JqZWN0LnZhbHVlcyhhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1hbGwtZWZmZWN0cycpKVxyXG4gICAgICAgICAgICAuZmlsdGVyKChlZmZlY3QpID0+ICEoZWZmZWN0IGFzIGFueSkuaGlkZUluRWRpdG9yKVxyXG4gICAgICAgICAgICAuc29ydCgoYSwgYikgPT4gY29sbGF0b3IuY29tcGFyZSgoYSBhcyBhbnkpLm5hbWUsIChiIGFzIGFueSkubmFtZSkpO1xyXG5cclxuICAgICAgICBsZXQgZWZmZWN0TmFtZSA9IG1hdGVyaWFsRHVtcC5lZmZlY3QgPz8gJ2J1aWx0aW4tc3RhbmRhcmQnO1xyXG5cclxuICAgICAgICBwcm9wZXJ0eUNvbnRhaW5lclsnZWZmZWN0J10gPSB7XHJcbiAgICAgICAgICAgIHZhbHVlOiBlZmZlY3ROYW1lLFxyXG4gICAgICAgICAgICB0eXBlOiAnRW51bScsXHJcbiAgICAgICAgICAgIHVzZXJEYXRhOiB7IGVudW1OYW1lOiAnTWF0ZXJpYWxFZmZlY3RBc3NldE5hbWUnIH0sXHJcbiAgICAgICAgICAgIGVudW1MaXN0OiBlZmZlY3RzLm1hcCgoZWZmZWN0OiBhbnkpID0+ICh7IG5hbWU6IGVmZmVjdC5uYW1lLnJlcGxhY2UoJy4uLycsICcnKSwgdmFsdWU6IGVmZmVjdC5uYW1lIH0pKSxcclxuICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgcmVhZG9ubHk6IGZhbHNlXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgaWYgKG1hdGVyaWFsRHVtcC5kYXRhKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRlY2huaXF1ZU9wdGlvbnMgPSBtYXRlcmlhbER1bXAuZGF0YS5tYXAoKHQ6IGFueSwgaTogbnVtYmVyKSA9PiAoeyBuYW1lOiB0Lm5hbWUgfHwgaS50b1N0cmluZygpLCB2YWx1ZTogaSB9KSk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBwcm9wZXJ0eUNvbnRhaW5lclsndGVjaG5pcXVlJ10gPSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZTogbWF0ZXJpYWxEdW1wLnRlY2huaXF1ZSxcclxuICAgICAgICAgICAgICAgIHR5cGU6ICdFbnVtJyxcclxuICAgICAgICAgICAgICAgIGVudW1MaXN0OiB0ZWNobmlxdWVPcHRpb25zLFxyXG4gICAgICAgICAgICAgICAgdmlzaWJsZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIHJlYWRvbmx5OiBmYWxzZVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgY29uc3QgY3VycmVudFRlY2huaXF1ZUluZGV4ID0gbWF0ZXJpYWxEdW1wLnRlY2huaXF1ZSB8fCAwO1xyXG4gICAgICAgICAgICBjb25zdCBjdXJyZW50VGVjaG5pcXVlID0gbWF0ZXJpYWxEdW1wLmRhdGFbY3VycmVudFRlY2huaXF1ZUluZGV4XTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmIChjdXJyZW50VGVjaG5pcXVlICYmIGN1cnJlbnRUZWNobmlxdWUucGFzc2VzKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwYXNzZXM6IGFueVtdID0gW107XHJcblxyXG4gICAgICAgICAgICAgICAgZnVuY3Rpb24gY2hlY2tEZWZpbmVWaXNpYmlsaXR5KGRlZmluZXM6IGFueVtdLCBkZWZpbmVNYXA6IHsgW2tleTogc3RyaW5nXTogYW55IH0pOiBib29sZWFuIHtcclxuICAgICAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGRlZiBvZiBkZWZpbmVzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkZWYuc3RhcnRzV2l0aCgnIScpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGVmaW5lTWFwW2RlZi5zdWJzdHJpbmcoMSldKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFkZWZpbmVNYXBbZGVmXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50VGVjaG5pcXVlLnBhc3Nlcy5mb3JFYWNoKChwYXNzOiBhbnksIHBhc3NJbmRleDogbnVtYmVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFzc1Byb3BzOiB7IFtrZXk6c3RyaW5nXTogYW55IH0gPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAvLyBDcmVhdGUgYSBtYXAgb2YgZGVmaW5lcyBmb3IgcXVpY2sgbG9va3VwXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZGVmaW5lTWFwOiB7IFtrZXk6IHN0cmluZ106IGFueSB9ID0ge307XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHBhc3MuZGVmaW5lcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQcmVwYXJlIGRlZmluZSBtYXBcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGFzcy5kZWZpbmVzLmZvckVhY2goKGRlZjogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWZpbmVNYXBbZGVmLm5hbWVdID0gZGVmLnZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFByb2Nlc3MgZGVmaW5lc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXNzLmRlZmluZXMuZm9yRWFjaCgoZGVmOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFRyYW5zZm9ybSBkZWZpbmUgdHlwZSBiYXNlZCBvbiBsb2dpY1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGV0IHR5cGUgPSBkZWYudHlwZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBlbnVtTGlzdCA9IGRlZi5lbnVtTGlzdDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKGRlZi50eXBlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnTnVtYmVyJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9ICdFbnVtJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bUxpc3QgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlZi5yYW5nZSAmJiBkZWYucmFuZ2UubGVuZ3RoID49IDIpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAobGV0IGkgPSBkZWYucmFuZ2VbMF07IGkgPD0gZGVmLnJhbmdlWzFdOyBpKyspIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtTGlzdC5wdXNoKHsgbmFtZTogYFZhcmlhbnQke2l9YCwgdmFsdWU6IGkgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnU3RyaW5nJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZSA9ICdFbnVtJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW51bUxpc3QgPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlZi5vcHRpb25zKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnVtTGlzdCA9IGRlZi5vcHRpb25zLm1hcCgoc3RyOiBzdHJpbmcpID0+ICh7IG5hbWU6IHN0ciwgdmFsdWU6IHN0ciB9KSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnRW51bSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGUgPSAnQm9vbGVhbic7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlZlByb3AgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogdHlwZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHRlbmRzOiBbXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogZGVmLnZhbHVlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvb2x0aXA6IGRlZi50b29sdGlwLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudW1MaXN0OiBlbnVtTGlzdCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiBjaGVja0RlZmluZVZpc2liaWxpdHkoZGVmLmRlZmluZXMgfHwgW10sIGRlZmluZU1hcClcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXNzUHJvcHNbZGVmLm5hbWVdID0gZGVmUHJvcDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9jZXNzIHByb3BlcnRpZXNcclxuICAgICAgICAgICAgICAgICAgICBpZiAocGFzcy5wcm9wcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXNzLnByb3BzLmZvckVhY2goKHByb3A6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gSW5qZWN0IGV4dGVuZHM6IFsnY2MuVmFsdWVUeXBlJ10gZm9yIGtub3duIHZhbHVlIHR5cGVzIHRvIHByZXZlbnQgY3VzdG9tIGNsYXNzIGdlbmVyYXRpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBleHRlbmRzRGF0YSA9IHByb3AuZXh0ZW5kcyB8fCBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChbJ1ZlYzInLCAnVmVjMycsICdWZWM0JywgJ0NvbG9yJywgJ1JlY3QnLCAnU2l6ZScsICdRdWF0JywgJ01hdDMnLCAnTWF0NCddLmluY2x1ZGVzKHByb3AudHlwZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWV4dGVuZHNEYXRhLmluY2x1ZGVzKCdjYy5WYWx1ZVR5cGUnKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBleHRlbmRzRGF0YSA9IFsuLi5leHRlbmRzRGF0YSwgJ2NjLlZhbHVlVHlwZSddO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWxQcm9wID0ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC4uLnByb3AsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGlzcGxheU5hbWU6IHByb3AuZGlzcGxheU5hbWUgfHwgcHJvcC5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGU6IGNoZWNrRGVmaW5lVmlzaWJpbGl0eShwcm9wLmRlZmluZXMgfHwgW10sIGRlZmluZU1hcCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZXh0ZW5kczogZXh0ZW5kc0RhdGFcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwYXNzUHJvcHNbcHJvcC5uYW1lXSA9IHZhbFByb3A7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcGFzc0hhc1Byb3BzID0gT2JqZWN0LmtleXMocGFzc1Byb3BzKS5sZW5ndGggPiAwO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBwYXNzUHJvcHNbJ3BoYXNlJ10gPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGV4dGVuZHM6IFtdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiAnU3RyaW5nJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWU6IHBhc3MucGhhc2UgfHwgJycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZpc2libGU6IHRydWUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlYWRvbmx5OiB0cnVlXHJcbiAgICAgICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcGFzc2VzLnB1c2goe1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBleHRlbmRzOiBbJ2NjLk1hdGVyaWFsUGFzcyddLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZTogcGFzc1Byb3BzLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBgY2MuTWF0ZXJpYWxQYXNzJHtwYXNzSGFzUHJvcHMgPyBwYXNzSW5kZXggOiAnJ31gXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgY29uc3QgcGFzc2VzUHJvcDogYW55ID0ge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlOiBwYXNzZXMsXHJcbiAgICAgICAgICAgICAgICAgICAgdHlwZTogJ2NjLk1hdGVyaWFsUGFzc2VzJyxcclxuICAgICAgICAgICAgICAgICAgICB2aXNpYmxlOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICAgICAgcHJvcGVydHlDb250YWluZXJbJ3Bhc3NlcyddID0gcGFzc2VzUHJvcDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHByb3BlcnR5Q29udGFpbmVyO1xyXG4gICAgfVxyXG5cclxuICAgIGFzeW5jIHNldFByb3BlcnR5KGFzc2V0SW5mbzogSUFzc2V0SW5mbywgcGF0aDogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICAgICAgLy8gMS4gR2V0IHRoZSBjdXJyZW50IG1hdGVyaWFsIGR1bXBcclxuICAgICAgICBjb25zdCBtYXRlcmlhbER1bXAgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1tYXRlcmlhbCcsIGFzc2V0SW5mby51dWlkKTtcclxuICAgICAgICBpZiAoIW1hdGVyaWFsRHVtcCkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBsZXQgaGFuZGxlZCA9IGZhbHNlO1xyXG5cclxuICAgICAgICAvLyAyLiBIYW5kbGUgc2ltcGxlIHJvb3QgcHJvcGVydGllc1xyXG4gICAgICAgIGlmIChwYXRoID09PSAnZWZmZWN0QXNzZXQnIHx8IHBhdGggPT09ICdlZmZlY3QnKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGVmZmVjdHMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1hbGwtZWZmZWN0cycpO1xyXG4gICAgICAgICAgICBpZiAodmFsdWUgJiYgdmFsdWUubmFtZSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5uYW1lO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmICd1dWlkJyBpbiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS51dWlkO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChlZmZlY3RzW3ZhbHVlXSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBlZmZlY3RzW3ZhbHVlXS5uYW1lO1xyXG4gICAgICAgICAgICAgICAgaGFuZGxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlZmZlY3QgPSBlZmZlY3RzLmZpbmQoKGVmZjogYW55KSA9PiBlZmYubmFtZSA9PT0gdmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgaWYgKGVmZmVjdCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gZWZmZWN0Lm5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgaGFuZGxlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEVmZmVjdCBub3QgZm91bmRcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEVmZmVjdCAnJHt2YWx1ZX0nIG5vdCBmb3VuZGApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIGlmIChwYXRoID09PSAndGVjaG5pcXVlJykge1xyXG4gICAgICAgICAgICBtYXRlcmlhbER1bXAudGVjaG5pcXVlID0gdmFsdWU7XHJcbiAgICAgICAgICAgIGhhbmRsZWQgPSB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vIDMuIEhhbmRsZSBkYXRhL3Byb3BzIHRyYXZlcnNhbFxyXG4gICAgICAgICAgICBjb25zdCB0ZWNobmlxdWVJbmRleCA9IG1hdGVyaWFsRHVtcC50ZWNobmlxdWUgfHwgMDtcclxuICAgICAgICAgICAgY29uc3QgdGVjaG5pcXVlID0gbWF0ZXJpYWxEdW1wLmRhdGFbdGVjaG5pcXVlSW5kZXhdO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgaWYgKHRlY2huaXF1ZSAmJiB0ZWNobmlxdWUucGFzc2VzKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcclxuICAgICAgICAgICAgICAgIGxldCB0YXJnZXRQYXNzSW5kaWNlczogbnVtYmVyW10gPSBbXTtcclxuICAgICAgICAgICAgICAgIGxldCBwcm9wUGF0aFBhcnRzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGZvciBleHBsaWNpdCBwYXNzIHBhdGggXCJwYXNzZXMuMC5wcm9wTmFtZS4uLlwiXHJcbiAgICAgICAgICAgICAgICBpZiAocGFydHNbMF0gPT09ICdwYXNzZXMnICYmICFpc05hTihwYXJzZUludChwYXJ0c1sxXSkpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGFzc0luZGljZXMgPSBbcGFyc2VJbnQocGFydHNbMV0pXTtcclxuICAgICAgICAgICAgICAgICAgICBwcm9wUGF0aFBhcnRzID0gcGFydHMuc2xpY2UoMik7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIEltcGxpY2l0OiBTZWFyY2ggYWxsIHBhc3NlcyBpbiBjdXJyZW50IHRlY2huaXF1ZVxyXG4gICAgICAgICAgICAgICAgICAgIHRhcmdldFBhc3NJbmRpY2VzID0gdGVjaG5pcXVlLnBhc3Nlcy5tYXAoKF86IGFueSwgaTogbnVtYmVyKSA9PiBpKTtcclxuICAgICAgICAgICAgICAgICAgICBwcm9wUGF0aFBhcnRzID0gcGFydHM7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHByb3BQYXRoUGFydHMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb3BOYW1lID0gcHJvcFBhdGhQYXJ0c1swXTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzdWJQcm9wcyA9IHByb3BQYXRoUGFydHMuc2xpY2UoMSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNldERlZXBQcm9wZXJ0eSA9ICh0YXJnZXQ6IGFueSwgcGF0aFBhcnRzOiBzdHJpbmdbXSwgdmFsOiBhbnkpOiBib29sZWFuID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGN1cnJlbnQgPSB0YXJnZXQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBOYXZpZ2F0ZSB0byB0aGUgcGFyZW50IG9mIHRoZSB0YXJnZXQgcHJvcGVydHlcclxuICAgICAgICAgICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXRoUGFydHMubGVuZ3RoIC0gMTsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBrZXkgPSBwYXRoUGFydHNbaV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIDEuIFRyeSB0byBhY2Nlc3Mga2V5IGRpcmVjdGx5XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudFtrZXldICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjdXJyZW50ID0gY3VycmVudFtrZXldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAyLiBUcnkgdG8gZHJpbGwgaW50byAudmFsdWUgKGlmIGN1cnJlbnQgaXMgYSB3cmFwcGVyKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGN1cnJlbnQudmFsdWUgJiYgdHlwZW9mIGN1cnJlbnQudmFsdWUgPT09ICdvYmplY3QnICYmIGN1cnJlbnQudmFsdWVba2V5XSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQudmFsdWVba2V5XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAzLiBTcGVjaWFsIGNhc2UgZm9yIGFycmF5cyB3aGVyZSB3ZSBtaWdodCBiZSBhY2Nlc3NpbmcgYnkgaW5kZXggYnV0IGN1cnJlbnQgaXMgYSB3cmFwcGVyXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudC52YWx1ZSAmJiBBcnJheS5pc0FycmF5KGN1cnJlbnQudmFsdWUpICYmIGN1cnJlbnQudmFsdWVba2V5XSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudCA9IGN1cnJlbnQudmFsdWVba2V5XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXRoIG5vdCBmb3VuZFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYXN0S2V5ID0gcGF0aFBhcnRzW3BhdGhQYXJ0cy5sZW5ndGggLSAxXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEhlbHBlciB0byBzZXQgb24gdGhlIGZpbmFsIG9iamVjdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzZXRPbk9iamVjdCA9IChvYmo6IGFueSk6IGJvb2xlYW4gPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChvYmpbbGFzdEtleV0gPT09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRQcm9wID0gb2JqW2xhc3RLZXldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZSB0YXJnZXQgaXMgYSBQcm9wZXJ0eSBXcmFwcGVyIChPYmplY3Qgd2l0aCAudmFsdWUpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gV2UgYXZvaWQgQXJyYXlzIG9yIG51bGxzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRhcmdldFByb3AgJiYgdHlwZW9mIHRhcmdldFByb3AgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHRhcmdldFByb3ApICYmICd2YWx1ZScgaW4gdGFyZ2V0UHJvcCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXJnZXRQcm9wLnZhbHVlID0gdmFsO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEl0J3MgYSByYXcgdmFsdWUgKHByaW1pdGl2ZSBvciBzdHJ1Y3Qgd2l0aG91dCB3cmFwcGVyKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvYmpbbGFzdEtleV0gPSB2YWw7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gMS4gVHJ5IGRpcmVjdCBzZXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNldE9uT2JqZWN0KGN1cnJlbnQpKSByZXR1cm4gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDIuIFRyeSBzZXQgb24gLnZhbHVlIChpZiB3cmFwcGVyKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY3VycmVudC52YWx1ZSAmJiB0eXBlb2YgY3VycmVudC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXRPbk9iamVjdChjdXJyZW50LnZhbHVlKSkgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB9O1xyXG5cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGFzc0luZGljZXMuZm9yRWFjaChwYXNzSW5kZXggPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwYXNzID0gdGVjaG5pcXVlLnBhc3Nlc1twYXNzSW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIXBhc3MpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIDEuIFNlYXJjaCBpbiBwcm9wcyAoQXJyYXkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzLnByb3BzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwcm9wID0gcGFzcy5wcm9wcy5maW5kKChwOiBhbnkpID0+IHAubmFtZSA9PT0gcHJvcE5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHByb3ApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3ViUHJvcHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnICYmIHByb3AudHlwZSAmJiBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChwcm9wLnR5cGUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcygndGV4dHVyZScpIHx8IHByb3AudHlwZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdzYW1wbGVyJykpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9wLnZhbHVlID0geyB1dWlkOiB2YWx1ZSB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvcC52YWx1ZSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZhbGlkYXRlIGlmIHByb3AudmFsdWUgaXMgb2JqZWN0IGZvciBkZWVwIHNldFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocHJvcC52YWx1ZSAmJiB0eXBlb2YgcHJvcC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZXREZWVwUHJvcGVydHkocHJvcCwgc3ViUHJvcHMsIHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyAyLiBTZWFyY2ggaW4gZGVmaW5lcyAoQXJyYXkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwYXNzLmRlZmluZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlZmluZSA9IHBhc3MuZGVmaW5lcy5maW5kKChkOiBhbnkpID0+IGQubmFtZSA9PT0gcHJvcE5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRlZmluZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdWJQcm9wcy5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVmaW5lLnZhbHVlID0gdmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gMy4gU2VhcmNoIGluIHN0YXRlcyAoT2JqZWN0KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFzcy5zdGF0ZXMgJiYgcGFzcy5zdGF0ZXMudmFsdWUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBkaXJlY3Qgc3RhdGUgcHJvcGVydHkgKGUuZy4sIFwicHJpb3JpdHlcIiwgXCJwcmltaXRpdmVcIilcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAocGFzcy5zdGF0ZXMudmFsdWVbcHJvcE5hbWVdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0YXRlUHJvcCA9IHBhc3Muc3RhdGVzLnZhbHVlW3Byb3BOYW1lXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1YlByb3BzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0YXRlUHJvcC52YWx1ZSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzdGF0ZVByb3AudmFsdWUgJiYgdHlwZW9mIHN0YXRlUHJvcC52YWx1ZSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHNldERlZXBQcm9wZXJ0eShzdGF0ZVByb3AsIHN1YlByb3BzLCB2YWx1ZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGhhbmRsZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIDQuIEFwcGx5IGNoYW5nZXNcclxuICAgICAgICBpZiAoaGFuZGxlZCkge1xyXG4gICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnYXBwbHktbWF0ZXJpYWwnLCBhc3NldEluZm8udXVpZCwgbWF0ZXJpYWxEdW1wKTtcclxuICAgICAgICAgICAgIEVkaXRvci5NZXNzYWdlLmJyb2FkY2FzdCgnbWF0ZXJpYWwtaW5zcGVjdG9yOmNoYW5nZS1kdW1wJyk7XHJcbiAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==