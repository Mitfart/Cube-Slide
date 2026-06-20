"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetClassInfoTool = void 0;
const decorators_1 = require("../decorators");
const tools_utils_1 = require("../utils/tools-utils");
const schemas_1 = require("../schemas");
class GetClassInfoTool {
    constructor() {
        this._definitions = [];
        this._definedNames = new Set();
        this._commonTypesDefinition = 'interface IExposedAttributes { type?: string, visible?: boolean, multiline?: boolean, min?: number, max?: number, step?: number, unit?: string, radian?: boolean }\n' +
            'function property(options: IExposedAttributes) {}\n' +
            'type InstanceReference<T> = { id: string; type: string };\n' +
            'class Vec2 { x: number; y: number; }\n' +
            'class Vec3 { x: number; y: number; z: number; }\n' +
            'class Vec4 { x: number; y: number; z: number; w: number; }\n' +
            'class Color { r: number; g: number; b: number; a: number; }\n' +
            'class Rect { x: number; y: number; width: number; height: number; }\n' +
            'class Size { width: number; height: number; }\n' +
            'class Quat { x: number; y: number; z: number; w: number; }\n' +
            'class Mat3 { m00: number; m01: number; m02: number;\n' +
            '\tm03: number; m04: number; m05: number;\n' +
            '\tm06: number; m07: number; m08: number; }\n' +
            'class Mat4 { m00: number; m01: number; m02: number; m03: number;\n' +
            '\tm04: number; m05: number; m06: number; m07: number;\n' +
            '\tm08: number; m09: number; m10: number; m11: number;\n' +
            '\tm12: number; m13: number; m14: number; m15: number; }\n' +
            'class Gradient { alphaKeys: Array<{ alpha: number, time: number }>, colorKeys: Array<{ /* always 3 elements: r, g and b values */color: Array<number>, time: number }>, mode: number }';
    }
    async inspectorGetSettingsDefinition(params) {
        switch (params.settingsType) {
            case 'CommonTypes':
                return { definition: this._commonTypesDefinition };
            case 'CurrentSceneGlobals':
                return this.inspectorGetInstanceDefinition({ reference: { id: 'CurrentSceneGlobals' } });
            case 'ProjectSettings':
                return this.inspectorGetInstanceDefinition({ reference: { id: 'ProjectSettings' } });
            default:
                throw new Error(`Unknown settings type: '${params.settingsType}'.`);
        }
    }
    async inspectorGetInstanceDefinition(params) {
        this._definitions = [];
        this._definedNames.clear();
        let props = undefined;
        let className = params.reference.id;
        const instanceInfo = await tools_utils_1.ToolsUtils.inspectInstance(params.reference.id);
        if (instanceInfo) {
            className = instanceInfo.type;
            if (instanceInfo.assetInfo) {
                className += 'Importer';
            }
            if (instanceInfo.props) {
                props = instanceInfo.props;
            }
            this.processClass(className, props);
        }
        else {
            throw new Error(`Class, Instance or special keyword not found: '${params.reference.id}'.`);
        }
        return { definition: this._definitions.join('\n') };
    }
    processClass(className, providedProps, extendsClass) {
        if (this._definedNames.has(className)) {
            return;
        }
        this._definedNames.add(className);
        if (!providedProps)
            return;
        // Don't let AI mess out with UUID
        if ('uuid' in providedProps && this.isProperty(providedProps.uuid)) {
            providedProps.uuid.readonly = true;
        }
        // Collect fields first to potentially hoist nested definitions
        const fields = [];
        for (const propName of Object.keys(providedProps)) {
            const prop = providedProps[propName];
            // Filter out primitive properties which can't be inspected or invisible ones
            if (prop === undefined || prop === null ||
                (this.isProperty(prop) && 'visible' in prop && !prop.visible))
                continue;
            // IProperty Handling (Complex types, Metadata)
            if (this.isProperty(prop)) {
                const p = prop;
                const decoratorParts = [];
                const isArray = !!p.isArray;
                // Determine item definition for Arrays
                let itemDef = p;
                if (isArray) {
                    if (p.elementTypeData) {
                        itemDef = p.elementTypeData;
                    }
                    else if (Array.isArray(p.value) && p.value.length > 0) {
                        // Try to infer from first element
                        itemDef = p.value[0];
                    }
                    else {
                        // Cannot infer structure for empty array without schema
                        // Fallback to basic type handling
                        itemDef = null;
                    }
                }
                // Analyze Identity (based on itemDef if array, or p if single)
                const defToAnalyze = itemDef || p;
                const itemExtends = defToAnalyze.extends || [];
                const rawType = defToAnalyze.type || 'any';
                const isValueType = itemExtends.includes('cc.ValueType');
                const isReference = itemExtends.includes('cc.Object') ||
                    (!isValueType && (rawType === 'Node' || rawType === 'Component' || rawType === 'cc.Node' || rawType === 'cc.Component'));
                let tsType = this.resolveTsType(rawType).replace(/^cc\./, '');
                // Process Enum/BitMask
                const targetList = defToAnalyze.enumList || defToAnalyze.bitmaskList;
                if ((rawType === 'Enum' || rawType === 'BitMask') && targetList) {
                    const cleanClassName = className.replace(/^cc\./, '').replace(/[^a-zA-Z0-9_]/g, '_');
                    if (p.displayName && typeof p.displayName === 'string') {
                        if (p.displayName.startsWith('i18n:')) {
                            p.displayName = Editor.I18n.t(p.displayName.slice(5)); // Remove 'i18n:' prefix
                        }
                        if (p.displayName.trim().length === 0) {
                            p.displayName = propName;
                        }
                    }
                    else {
                        p.displayName = propName.charAt(0).toUpperCase() + propName.slice(1);
                    }
                    let enumName = `${cleanClassName}${p.displayName.replace(/[^a-zA-Z0-9_]/g, '')}${rawType}`;
                    if (defToAnalyze.userData && typeof defToAnalyze.userData === 'object' && 'enumName' in defToAnalyze.userData) {
                        enumName = defToAnalyze.userData['enumName'];
                    }
                    this.generateEnumDefinition(enumName, targetList);
                    tsType = enumName;
                }
                // Process Struct or Standard Type
                else {
                    // Recursion: Only recurse if we have a valid item definition (itemDef)
                    // If isArray is true but itemDef is undefined, we skip recursion (treat as Array<any> or Array<p.type>)
                    if (itemDef && !isReference && !isValueType && !this.isPrimitiveType(rawType) && itemDef.value && typeof itemDef.value === 'object') {
                        let nestedName = tsType;
                        if (!nestedName || nestedName === 'Object' || nestedName === 'any') {
                            const suffix = isArray ? 'Item' : 'Type';
                            nestedName = `${className}${propName.charAt(0).toUpperCase() + propName.slice(1)}${suffix}`;
                        }
                        const extendsForNested = itemDef.extends && itemDef.extends.length > 0 ? itemDef.extends[0].replace(/^cc\./, '') : undefined;
                        this.processClass(nestedName, itemDef.value, extendsForNested !== nestedName ? extendsForNested : undefined);
                        tsType = nestedName;
                    }
                }
                // Wrap reference type
                if (isReference) {
                    if (tsType === 'any')
                        tsType = 'Object';
                    tsType = `InstanceReference<${tsType}>`;
                }
                // Wrap array type
                if (isArray) {
                    tsType = `Array<${tsType}>`;
                }
                // Decorators & Attributes
                let decoratorType = null;
                // Valuable types for decorators is only CCInteger and CCFloat
                if (p.type === 'Integer')
                    decoratorType = 'CCInteger';
                else if (p.type === 'Float' || p.type === 'Number')
                    decoratorType = 'CCFloat';
                if (decoratorType) {
                    decoratorParts.push(isArray ? `type: [${decoratorType}]` : `type: ${decoratorType}`);
                }
                // Attributes that can help AI get more context
                const attrs = ['min', 'max', 'step', 'unit', 'radian', 'multiline'];
                attrs.forEach(attr => {
                    const val = p[attr];
                    if (val !== undefined && val !== null)
                        decoratorParts.push(`${attr}: ${val}`);
                });
                if (p.tooltip) {
                    let tooltip = p.tooltip;
                    if (tooltip.startsWith('i18n:')) {
                        tooltip = Editor.I18n.t(tooltip.slice(5)); // Remove 'i18n:' prefix
                    }
                    if (tooltip.trim().length > 0) {
                        if (tooltip.match(/<br\s*\/?>/i) || tooltip.includes('\n')) {
                            const lines = tooltip.split(/<br\s*\/?>|\n/i).map(l => l.trim()).filter(l => l.length > 0);
                            if (lines.length > 0) {
                                fields.push(`\t/**`);
                                lines.forEach(line => fields.push(`\t * ${line}`));
                                fields.push(`\t */`);
                            }
                        }
                        else {
                            fields.push(`\t/** ${tooltip} */`);
                        }
                    }
                }
                if (decoratorParts.length > 0) {
                    fields.push(`\t@property({ ${decoratorParts.join(', ')} })`);
                }
                const prefix = !!p.readonly ? 'readonly ' : '';
                fields.push(`\t${prefix}${propName}: ${tsType};`);
                continue;
            }
            // Raw Value Handling (Primitives and simple objects)
            if (this.isPrimitive(prop)) {
                fields.push(`\t${propName}: ${typeof prop};`);
                continue;
            }
            // Array Handling
            if (Array.isArray(prop)) {
                if (prop.length === 0) {
                    fields.push(`\t${propName}: Array<any>;`);
                }
                else {
                    const firstItem = prop[0];
                    if (this.isPrimitive(firstItem)) {
                        fields.push(`\t${propName}: Array<${typeof firstItem}>;`);
                    }
                    else if (typeof firstItem === 'object') {
                        // Raw object in array -> Recursion
                        const nestedClassName = `${className}${propName.charAt(0).toUpperCase() + propName.slice(1)}Item`;
                        this.processClass(nestedClassName, firstItem);
                        fields.push(`\t${propName}: Array<${nestedClassName}>;`);
                    }
                    else {
                        fields.push(`\t${propName}: Array<any>;`);
                    }
                }
                continue;
            }
            // Fallback for raw object (struct)
            if (typeof prop === 'object') {
                const cleanClassName = className.replace(/^cc\./, '').replace(/[^a-zA-Z0-9_]/g, '_');
                const nestedClassName = `${cleanClassName}${propName.charAt(0).toUpperCase() + propName.slice(1)}Type`;
                this.processClass(nestedClassName, prop);
                fields.push(`\t${propName}: ${nestedClassName};`);
            }
        }
        const shortName = className.includes('.') ? className.split('.').pop() : className;
        const classDef = [
            `export class ${shortName} ${extendsClass ? `extends ${extendsClass}` : ''} {`,
            ...fields,
            `}`
        ].join('\n');
        this._definitions.push(classDef);
    }
    // Type Guard for IProperty
    isProperty(val) {
        return val && typeof val === 'object' && 'value' in val;
    }
    // Based on info from CCClass
    isPrimitiveType(type) {
        return ['Integer', 'Float', 'Number', 'String', 'Boolean'].includes(type);
    }
    // Check if value is primitive
    isPrimitive(value) {
        return value === null || (typeof value !== "object" && typeof value !== "function");
    }
    // Helper for Enum or BitMask generation
    generateEnumDefinition(name, items) {
        if (this._definedNames.has(name))
            return;
        this._definedNames.add(name);
        const lines = [];
        lines.push(`export enum ${name} {`);
        items.forEach((item) => {
            let cleanName = item.name.replace(/[^a-zA-Z0-9_]/g, '_');
            if (/^[0-9]/.test(cleanName)) {
                cleanName = `_${cleanName}`;
            }
            if (typeof item.value === 'string') {
                lines.push(`\t${cleanName} = '${item.value}',`);
            }
            else {
                lines.push(`\t${cleanName} = ${item.value},`);
            }
        });
        lines.push(`}`);
        this._definitions.unshift(lines.join('\n'));
    }
    resolveTsType(type) {
        switch (type) {
            case 'Integer':
            case 'Float':
            case 'Number':
            case 'Enum': // Enums handled specifically, but fallback for safety
            case 'BitMask':
                return 'number';
            case 'String':
                return 'string';
            case 'Boolean':
                return 'boolean';
            default:
                return type; // e.g. Vec3, Color, Node
        }
    }
}
exports.GetClassInfoTool = GetClassInfoTool;
__decorate([
    (0, decorators_1.utcpTool)("inspectorGetSettingsDefinition", "Generates TypeScript definition for specific settings.", { type: 'object', properties: { settingsType: { type: 'string', enum: ['CommonTypes', 'CurrentSceneGlobals', 'ProjectSettings'] } }, required: ['settingsType'] }, { type: 'object', properties: { definition: { type: 'string' } }, required: ['definition'] }, "GET", ['code', 'typescript', 'inspection', 'definition', 'common', 'types', 'settings', 'scene', 'globals', 'project'])
], GetClassInfoTool.prototype, "inspectorGetSettingsDefinition", null);
__decorate([
    (0, decorators_1.utcpTool)("inspectorGetInstanceDefinition", "Generates TypeScript definition based on properties and descriptions of instance (Node, Component, Asset).", { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, { type: 'object', properties: { definition: { type: 'string' } }, required: ['definition'] }, "GET", ['code', 'typescript', 'inspection', 'definition', 'class', 'info', 'meta', 'instance', 'node', 'component', 'asset', 'data'])
], GetClassInfoTool.prototype, "inspectorGetInstanceDefinition", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC1kZWZlbml0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL3V0Y3AvdG9vbHMvdHlwZXNjcmlwdC1kZWZlbml0aW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLDhDQUF5QztBQUV6QyxzREFBa0Q7QUFDbEQsd0NBQXlFO0FBRXpFLE1BQWEsZ0JBQWdCO0lBQTdCO1FBRVksaUJBQVksR0FBYSxFQUFFLENBQUM7UUFDNUIsa0JBQWEsR0FBZ0IsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN2QywyQkFBc0IsR0FDMUIsc0tBQXNLO1lBQ3RLLHFEQUFxRDtZQUNyRCw2REFBNkQ7WUFDN0Qsd0NBQXdDO1lBQ3hDLG1EQUFtRDtZQUNuRCw4REFBOEQ7WUFDOUQsK0RBQStEO1lBQy9ELHVFQUF1RTtZQUN2RSxpREFBaUQ7WUFDakQsOERBQThEO1lBQzlELHVEQUF1RDtZQUN2RCw0Q0FBNEM7WUFDNUMsOENBQThDO1lBQzlDLG9FQUFvRTtZQUNwRSx5REFBeUQ7WUFDekQseURBQXlEO1lBQ3pELDJEQUEyRDtZQUMzRCx3TEFBd0wsQ0FBQztJQW9Uak0sQ0FBQztJQTNTUyxBQUFOLEtBQUssQ0FBQyw4QkFBOEIsQ0FBQyxNQUFnQztRQUNqRSxRQUFRLE1BQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUMxQixLQUFLLGFBQWE7Z0JBQ2QsT0FBTyxFQUFFLFVBQVUsRUFBRSxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztZQUN2RCxLQUFLLHFCQUFxQjtnQkFDdEIsT0FBTyxJQUFJLENBQUMsOEJBQThCLENBQUMsRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUscUJBQXFCLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFDN0YsS0FBSyxpQkFBaUI7Z0JBQ2xCLE9BQU8sSUFBSSxDQUFDLDhCQUE4QixDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLGlCQUFpQixFQUFFLEVB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QUssRUFBRyxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQ3hJO3NFQXNCQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHV0Y3BUb29sIH0gZnJvbSAnLi4vZGVjb3JhdG9ycyc7XHJcbmltcG9ydCB7IElQcm9wZXJ0eSwgSVByb3BlcnR5VmFsdWVUeXBlIH0gZnJvbSAnQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9wdWJsaWMnO1xyXG5pbXBvcnQgeyBUb29sc1V0aWxzIH0gZnJvbSAnLi4vdXRpbHMvdG9vbHMtdXRpbHMnO1xyXG5pbXBvcnQgeyBJSW5zdGFuY2VSZWZlcmVuY2UsIEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hIH0gZnJvbSAnLi4vc2NoZW1hcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgR2V0Q2xhc3NJbmZvVG9vbCB7XHJcblxyXG4gICAgcHJpdmF0ZSBfZGVmaW5pdGlvbnM6IHN0cmluZ1tdID0gW107XHJcbiAgICBwcml2YXRlIF9kZWZpbmVkTmFtZXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xyXG4gICAgcHJpdmF0ZSBfY29tbW9uVHlwZXNEZWZpbml0aW9uOiBzdHJpbmcgPSBcclxuICAgICAgICAnaW50ZXJmYWNlIElFeHBvc2VkQXR0cmlidXRlcyB7IHR5cGU/OiBzdHJpbmcsIHZpc2libGU/OiBib29sZWFuLCBtdWx0aWxpbmU/OiBib29sZWFuLCBtaW4/OiBudW1iZXIsIG1heD86IG51bWJlciwgc3RlcD86IG51bWJlciwgdW5pdD86IHN0cmluZywgcmFkaWFuPzogYm9vbGVhbiB9XFxuJyArXHJcbiAgICAgICAgJ2Z1bmN0aW9uIHByb3BlcnR5KG9wdGlvbnM6IElFeHBvc2VkQXR0cmlidXRlcykge31cXG4nICtcclxuICAgICAgICAndHlwZSBJbnN0YW5jZVJlZmVyZW5jZTxUPiA9IHsgaWQ6IHN0cmluZzsgdHlwZTogc3RyaW5nIH07XFxuJyArXHJcbiAgICAgICAgJ2NsYXNzIFZlYzIgeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgfVxcbicgK1xyXG4gICAgICAgICdjbGFzcyBWZWMzIHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlcjsgfVxcbicgK1xyXG4gICAgICAgICdjbGFzcyBWZWM0IHsgeDogbnVtYmVyOyB5OiBudW1iZXI7IHo6IG51bWJlcjsgdzogbnVtYmVyOyB9XFxuJyArXHJcbiAgICAgICAgJ2NsYXNzIENvbG9yIHsgcjogbnVtYmVyOyBnOiBudW1iZXI7IGI6IG51bWJlcjsgYTogbnVtYmVyOyB9XFxuJyArXHJcbiAgICAgICAgJ2NsYXNzIFJlY3QgeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXI7IH1cXG4nICtcclxuICAgICAgICAnY2xhc3MgU2l6ZSB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyOyB9XFxuJyArXHJcbiAgICAgICAgJ2NsYXNzIFF1YXQgeyB4OiBudW1iZXI7IHk6IG51bWJlcjsgejogbnVtYmVyOyB3OiBudW1iZXI7IH1cXG4nICtcclxuICAgICAgICAnY2xhc3MgTWF0MyB7IG0wMDogbnVtYmVyOyBtMDE6IG51bWJlcjsgbTAyOiBudW1iZXI7XFxuJyArXHJcbiAgICAgICAgJ1xcdG0wMzogbnVtYmVyOyBtMDQ6IG51bWJlcjsgbTA1OiBudW1iZXI7XFxuJyArXHJcbiAgICAgICAgJ1xcdG0wNjogbnVtYmVyOyBtMDc6IG51bWJlcjsgbTA4OiBudW1iZXI7IH1cXG4nICtcclxuICAgICAgICAnY2xhc3MgTWF0NCB7IG0wMDogbnVtYmVyOyBtMDE6IG51bWJlcjsgbTAyOiBudW1iZXI7IG0wMzogbnVtYmVyO1xcbicgK1xyXG4gICAgICAgICdcXHRtMDQ6IG51bWJlcjsgbTA1OiBudW1iZXI7IG0wNjogbnVtYmVyOyBtMDc6IG51bWJlcjtcXG4nICtcclxuICAgICAgICAnXFx0bTA4OiBudW1iZXI7IG0wOTogbnVtYmVyOyBtMTA6IG51bWJlcjsgbTExOiBudW1iZXI7XFxuJyArXHJcbiAgICAgICAgJ1xcdG0xMjogbnVtYmVyOyBtMTM6IG51bWJlcjsgbTE0OiBudW1iZXI7IG0xNTogbnVtYmVyOyB9XFxuJyArXHJcbiAgICAgICAgJ2NsYXNzIEdyYWRpZW50IHsgYWxwaGFLZXlzOiBBcnJheTx7IGFscGhhOiBudW1iZXIsIHRpbWU6IG51bWJlciB9PiwgY29sb3JLZXlzOiBBcnJheTx7IC8qIGFsd2F5cyAzIGVsZW1lbnRzOiByLCBnIGFuZCBiIHZhbHVlcyAqL2NvbG9yOiBBcnJheTxudW1iZXI+LCB0aW1lOiBudW1iZXIgfT4sIG1vZGU6IG51bWJlciB9JztcclxuXHJcbiAgICBAdXRjcFRvb2woXHJcbiAgICAgICAgXCJpbnNwZWN0b3JHZXRTZXR0aW5nc0RlZmluaXRpb25cIixcclxuICAgICAgICBcIkdlbmVyYXRlcyBUeXBlU2NyaXB0IGRlZmluaXRpb24gZm9yIHNwZWNpZmljIHNldHRpbmdzLlwiLFxyXG4gICAgICAgIHsgdHlwZTogJ29iamVjdCcgLCBwcm9wZXJ0aWVzOiB7IHNldHRpbmdzVHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogWydDb21tb25UeXBlcycsICdDdXJyZW50U2NlbmVHbG9iYWxzJywgJ1Byb2plY3RTZXR0aW5ncyddIH0gfSwgcmVxdWlyZWQ6IFsnc2V0dGluZ3NUeXBlJ10gfSxcclxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IGRlZmluaXRpb246IHsgdHlwZTogJ3N0cmluZycgfSB9LCByZXF1aXJlZDogWydkZWZpbml0aW9uJ10gfSwgXHJcbiAgICAgICAgXCJHRVRcIiwgIFsnY29kZScsICd0eXBlc2NyaXB0JywgJ2luc3BlY3Rpb24nLCAnZGVmaW5pdGlvbicsICdjb21tb24nLCAndHlwZXMnLCAnc2V0dGluZ3MnLCAnc2NlbmUnLCAnZ2xvYmFscycsICdwcm9qZWN0J11cclxuICAgIClcclxuICAgIGFzeW5jIGluc3BlY3RvckdldFNldHRpbmdzRGVmaW5pdGlvbihwYXJhbXM6IHsgc2V0dGluZ3NUeXBlOiBzdHJpbmcgfSk6IFByb21pc2U8eyBkZWZpbml0aW9uOiBzdHJpbmcgfT4ge1xyXG4gICAgICAgIHN3aXRjaCAocGFyYW1zLnNldHRpbmdzVHlwZSkge1xyXG4gICAgICAgICAgICBjYXNlICdDb21tb25UeXBlcyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBkZWZpbml0aW9uOiB0aGlzLl9jb21tb25UeXBlc0RlZmluaXRpb24gfTtcclxuICAgICAgICAgICAgY2FzZSAnQ3VycmVudFNjZW5lR2xvYmFscyc6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5pbnNwZWN0b3JHZXRJbnN0YW5jZURlZmluaXRpb24oeyByZWZlcmVuY2U6IHsgaWQ6ICdDdXJyZW50U2NlbmVHbG9iYWxzJyB9IH0pO1xyXG4gICAgICAgICAgICBjYXNlICdQcm9qZWN0U2V0dGluZ3MnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuaW5zcGVjdG9yR2V0SW5zdGFuY2VEZWZpbml0aW9uKHsgcmVmZXJlbmNlOiB7IGlkOiAnUHJvamVjdFNldHRpbmdzJyB9IH0pO1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHNldHRpbmdzIHR5cGU6ICcke3BhcmFtcy5zZXR0aW5nc1R5cGV9Jy5gKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICBcclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICBcImluc3BlY3RvckdldEluc3RhbmNlRGVmaW5pdGlvblwiLFxyXG4gICAgICAgIFwiR2VuZXJhdGVzIFR5cGVTY3JpcHQgZGVmaW5pdGlvbiBiYXNlZCBvbiBwcm9wZXJ0aWVzIGFuZCBkZXNjcmlwdGlvbnMgb2YgaW5zdGFuY2UgKE5vZGUsIENvbXBvbmVudCwgQXNzZXQpLlwiLFxyXG4gICAgICAgIHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSB9LCByZXF1aXJlZDogWydyZWZlcmVuY2UnXSB9LFxyXG4gICAgICAgIHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgZGVmaW5pdGlvbjogeyB0eXBlOiAnc3RyaW5nJyB9IH0sIHJlcXVpcmVkOiBbJ2RlZmluaXRpb24nXSB9LCBcclxuICAgICAgICBcIkdFVFwiLCAgWydjb2RlJywgJ3R5cGVzY3JpcHQnLCAnaW5zcGVjdGlvbicsICdkZWZpbml0aW9uJywgJ2NsYXNzJywgJ2luZm8nLCAnbWV0YScsICdpbnN0YW5jZScsICdub2RlJywgJ2NvbXBvbmVudCcsICdhc3NldCcsICdkYXRhJ11cclxuICAgIClcclxuICAgIGFzeW5jIGluc3BlY3RvckdldEluc3RhbmNlRGVmaW5pdGlvbihwYXJhbXM6IHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UgfSk6IFByb21pc2U8eyBkZWZpbml0aW9uOiBzdHJpbmcgfT4ge1xyXG4gICAgICAgIHRoaXMuX2RlZmluaXRpb25zID0gW107XHJcbiAgICAgICAgdGhpcy5fZGVmaW5lZE5hbWVzLmNsZWFyKCk7XHJcblxyXG4gICAgICAgIGxldCBwcm9wczogeyBba2V5OiBzdHJpbmddOiBJUHJvcGVydHlWYWx1ZVR5cGUgfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcclxuICAgICAgICBsZXQgY2xhc3NOYW1lID0gcGFyYW1zLnJlZmVyZW5jZS5pZDtcclxuICAgICAgICBjb25zdCBpbnN0YW5jZUluZm8gPSBhd2FpdCBUb29sc1V0aWxzLmluc3BlY3RJbnN0YW5jZShwYXJhbXMucmVmZXJlbmNlLmlkKTtcclxuICAgICAgICBpZiAoaW5zdGFuY2VJbmZvKSB7XHJcbiAgICAgICAgICAgIGNsYXNzTmFtZSA9IGluc3RhbmNlSW5mby50eXBlO1xyXG4gICAgICAgICAgICBpZiAoaW5zdGFuY2VJbmZvLmFzc2V0SW5mbykge1xyXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lICs9ICdJbXBvcnRlcic7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKGluc3RhbmNlSW5mby5wcm9wcykge1xyXG4gICAgICAgICAgICAgICAgcHJvcHMgPSBpbnN0YW5jZUluZm8ucHJvcHM7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5wcm9jZXNzQ2xhc3MoY2xhc3NOYW1lLCBwcm9wcyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDbGFzcywgSW5zdGFuY2Ugb3Igc3BlY2lhbCBrZXl3b3JkIG5vdCBmb3VuZDogJyR7cGFyYW1zLnJlZmVyZW5jZS5pZH0nLmApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHsgZGVmaW5pdGlvbjogdGhpcy5fZGVmaW5pdGlvbnMuam9pbignXFxuJykgfTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIHByb2Nlc3NDbGFzcyhjbGFzc05hbWU6IHN0cmluZywgcHJvdmlkZWRQcm9wcz86IHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5VmFsdWVUeXBlIH0sIGV4dGVuZHNDbGFzcz86IHN0cmluZykge1xyXG4gICAgICAgIGlmICh0aGlzLl9kZWZpbmVkTmFtZXMuaGFzKGNsYXNzTmFtZSkpIHtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5fZGVmaW5lZE5hbWVzLmFkZChjbGFzc05hbWUpO1xyXG5cclxuICAgICAgICBpZiAoIXByb3ZpZGVkUHJvcHMpIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8gRG9uJ3QgbGV0IEFJIG1lc3Mgb3V0IHdpdGggVVVJRFxyXG4gICAgICAgIGlmICgndXVpZCcgaW4gcHJvdmlkZWRQcm9wcyAmJiB0aGlzLmlzUHJvcGVydHkocHJvdmlkZWRQcm9wcy51dWlkKSkge1xyXG4gICAgICAgICAgICBwcm92aWRlZFByb3BzLnV1aWQucmVhZG9ubHkgPSB0cnVlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gQ29sbGVjdCBmaWVsZHMgZmlyc3QgdG8gcG90ZW50aWFsbHkgaG9pc3QgbmVzdGVkIGRlZmluaXRpb25zXHJcbiAgICAgICAgY29uc3QgZmllbGRzOiBzdHJpbmdbXSA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKGNvbnN0IHByb3BOYW1lIG9mIE9iamVjdC5rZXlzKHByb3ZpZGVkUHJvcHMpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb3AgPSBwcm92aWRlZFByb3BzW3Byb3BOYW1lXTtcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIC8vIEZpbHRlciBvdXQgcHJpbWl0aXZlIHByb3BlcnRpZXMgd2hpY2ggY2FuJ3QgYmUgaW5zcGVjdGVkIG9yIGludmlzaWJsZSBvbmVzXHJcbiAgICAgICAgICAgIGlmIChwcm9wID09PSB1bmRlZmluZWQgfHwgcHJvcCA9PT0gbnVsbCB8fCBcclxuICAgICAgICAgICAgICAgICh0aGlzLmlzUHJvcGVydHkocHJvcCkgJiYgJ3Zpc2libGUnIGluIHByb3AgJiYgIXByb3AudmlzaWJsZSkpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgICAgICAgLy8gSVByb3BlcnR5IEhhbmRsaW5nIChDb21wbGV4IHR5cGVzLCBNZXRhZGF0YSlcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNQcm9wZXJ0eShwcm9wKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcCA9IHByb3AgYXMgSVByb3BlcnR5O1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGVjb3JhdG9yUGFydHM6IHN0cmluZ1tdID0gW107XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc0FycmF5ID0gISFwLmlzQXJyYXk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpdGVtIGRlZmluaXRpb24gZm9yIEFycmF5c1xyXG4gICAgICAgICAgICAgICAgbGV0IGl0ZW1EZWY6IGFueSA9IHA7XHJcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChwLmVsZW1lbnRUeXBlRGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtRGVmID0gcC5lbGVtZW50VHlwZURhdGE7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KHAudmFsdWUpICYmIHAudmFsdWUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGluZmVyIGZyb20gZmlyc3QgZWxlbWVudFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgaXRlbURlZiA9IHAudmFsdWVbMF07XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQ2Fubm90IGluZmVyIHN0cnVjdHVyZSBmb3IgZW1wdHkgYXJyYXkgd2l0aG91dCBzY2hlbWFcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gYmFzaWMgdHlwZSBoYW5kbGluZ1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpdGVtRGVmID0gbnVsbDsgXHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAvLyBBbmFseXplIElkZW50aXR5IChiYXNlZCBvbiBpdGVtRGVmIGlmIGFycmF5LCBvciBwIGlmIHNpbmdsZSlcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRlZlRvQW5hbHl6ZSA9IGl0ZW1EZWYgfHwgcDtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGl0ZW1FeHRlbmRzID0gZGVmVG9BbmFseXplLmV4dGVuZHMgfHwgW107XHJcbiAgICAgICAgICAgICAgICBjb25zdCByYXdUeXBlID0gZGVmVG9BbmFseXplLnR5cGUgfHwgJ2FueSc7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlzVmFsdWVUeXBlID0gaXRlbUV4dGVuZHMuaW5jbHVkZXMoJ2NjLlZhbHVlVHlwZScpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaXNSZWZlcmVuY2UgPSBpdGVtRXh0ZW5kcy5pbmNsdWRlcygnY2MuT2JqZWN0JykgfHwgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICghaXNWYWx1ZVR5cGUgJiYgKHJhd1R5cGUgPT09ICdOb2RlJyB8fCByYXdUeXBlID09PSAnQ29tcG9uZW50JyB8fCByYXdUeXBlID09PSAnY2MuTm9kZScgfHwgcmF3VHlwZSA9PT0gJ2NjLkNvbXBvbmVudCcpKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgbGV0IHRzVHlwZSA9IHRoaXMucmVzb2x2ZVRzVHlwZShyYXdUeXBlKS5yZXBsYWNlKC9eY2NcXC4vLCAnJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gUHJvY2VzcyBFbnVtL0JpdE1hc2tcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRhcmdldExpc3QgPSBkZWZUb0FuYWx5emUuZW51bUxpc3QgfHwgZGVmVG9BbmFseXplLmJpdG1hc2tMaXN0O1xyXG4gICAgICAgICAgICAgICAgaWYgKChyYXdUeXBlID09PSAnRW51bScgfHwgcmF3VHlwZSA9PT0gJ0JpdE1hc2snKSAmJiB0YXJnZXRMaXN0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFuQ2xhc3NOYW1lID0gY2xhc3NOYW1lLnJlcGxhY2UoL15jY1xcLi8sICcnKS5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csICdfJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICBpZiAocC5kaXNwbGF5TmFtZSAmJiB0eXBlb2YgcC5kaXNwbGF5TmFtZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHAuZGlzcGxheU5hbWUuc3RhcnRzV2l0aCgnaTE4bjonKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHAuZGlzcGxheU5hbWUgPSBFZGl0b3IuSTE4bi50KHAuZGlzcGxheU5hbWUuc2xpY2UoNSkpOyAvLyBSZW1vdmUgJ2kxOG46JyBwcmVmaXhcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAocC5kaXNwbGF5TmFtZS50cmltKCkubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwLmRpc3BsYXlOYW1lID0gcHJvcE5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcC5kaXNwbGF5TmFtZSA9IHByb3BOYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcHJvcE5hbWUuc2xpY2UoMSk7XHJcbiAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgIGxldCBlbnVtTmFtZSA9IGAke2NsZWFuQ2xhc3NOYW1lfSR7cC5kaXNwbGF5TmFtZS5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csICcnKX0ke3Jhd1R5cGV9YDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgIGlmIChkZWZUb0FuYWx5emUudXNlckRhdGEgJiYgdHlwZW9mIGRlZlRvQW5hbHl6ZS51c2VyRGF0YSA9PT0gJ29iamVjdCcgJiYgJ2VudW1OYW1lJyBpbiBkZWZUb0FuYWx5emUudXNlckRhdGEpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGVudW1OYW1lID0gZGVmVG9BbmFseXplLnVzZXJEYXRhWydlbnVtTmFtZSddO1xyXG4gICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgICB0aGlzLmdlbmVyYXRlRW51bURlZmluaXRpb24oZW51bU5hbWUsIHRhcmdldExpc3QpO1xyXG4gICAgICAgICAgICAgICAgICAgICB0c1R5cGUgPSBlbnVtTmFtZTtcclxuICAgICAgICAgICAgICAgIH0gXHJcbiAgICAgICAgICAgICAgICAvLyBQcm9jZXNzIFN0cnVjdCBvciBTdGFuZGFyZCBUeXBlXHJcbiAgICAgICAgICAgICAgICBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBSZWN1cnNpb246IE9ubHkgcmVjdXJzZSBpZiB3ZSBoYXZlIGEgdmFsaWQgaXRlbSBkZWZpbml0aW9uIChpdGVtRGVmKVxyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIGlzQXJyYXkgaXMgdHJ1ZSBidXQgaXRlbURlZiBpcyB1bmRlZmluZWQsIHdlIHNraXAgcmVjdXJzaW9uICh0cmVhdCBhcyBBcnJheTxhbnk+IG9yIEFycmF5PHAudHlwZT4pXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGl0ZW1EZWYgJiYgIWlzUmVmZXJlbmNlICYmICFpc1ZhbHVlVHlwZSAmJiAhdGhpcy5pc1ByaW1pdGl2ZVR5cGUocmF3VHlwZSkgJiYgaXRlbURlZi52YWx1ZSAmJiB0eXBlb2YgaXRlbURlZi52YWx1ZSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBuZXN0ZWROYW1lID0gdHNUeXBlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFuZXN0ZWROYW1lIHx8IG5lc3RlZE5hbWUgPT09ICdPYmplY3QnIHx8IG5lc3RlZE5hbWUgPT09ICdhbnknKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VmZml4ID0gaXNBcnJheSA/ICdJdGVtJyA6ICdUeXBlJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXN0ZWROYW1lID0gYCR7Y2xhc3NOYW1lfSR7cHJvcE5hbWUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBwcm9wTmFtZS5zbGljZSgxKX0ke3N1ZmZpeH1gO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleHRlbmRzRm9yTmVzdGVkID0gaXRlbURlZi5leHRlbmRzICYmIGl0ZW1EZWYuZXh0ZW5kcy5sZW5ndGggPiAwID8gaXRlbURlZi5leHRlbmRzWzBdLnJlcGxhY2UoL15jY1xcLi8sICcnKSA6IHVuZGVmaW5lZDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHJvY2Vzc0NsYXNzKG5lc3RlZE5hbWUsIGl0ZW1EZWYudmFsdWUgYXMgYW55LCBleHRlbmRzRm9yTmVzdGVkICE9PSBuZXN0ZWROYW1lID8gZXh0ZW5kc0Zvck5lc3RlZCA6IHVuZGVmaW5lZCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICB0c1R5cGUgPSBuZXN0ZWROYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gV3JhcCByZWZlcmVuY2UgdHlwZVxyXG4gICAgICAgICAgICAgICAgaWYgKGlzUmVmZXJlbmNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRzVHlwZSA9PT0gJ2FueScpIHRzVHlwZSA9ICdPYmplY3QnO1xyXG4gICAgICAgICAgICAgICAgICAgIHRzVHlwZSA9IGBJbnN0YW5jZVJlZmVyZW5jZTwke3RzVHlwZX0+YDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gV3JhcCBhcnJheSB0eXBlXHJcbiAgICAgICAgICAgICAgICBpZiAoaXNBcnJheSkge1xyXG4gICAgICAgICAgICAgICAgICAgICB0c1R5cGUgPSBgQXJyYXk8JHt0c1R5cGV9PmA7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gRGVjb3JhdG9ycyAmIEF0dHJpYnV0ZXNcclxuICAgICAgICAgICAgICAgIGxldCBkZWNvcmF0b3JUeXBlID0gbnVsbDtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBWYWx1YWJsZSB0eXBlcyBmb3IgZGVjb3JhdG9ycyBpcyBvbmx5IENDSW50ZWdlciBhbmQgQ0NGbG9hdFxyXG4gICAgICAgICAgICAgICAgaWYgKHAudHlwZSA9PT0gJ0ludGVnZXInKSBkZWNvcmF0b3JUeXBlID0gJ0NDSW50ZWdlcic7XHJcbiAgICAgICAgICAgICAgICBlbHNlIGlmIChwLnR5cGUgPT09ICdGbG9hdCcgfHwgcC50eXBlID09PSAnTnVtYmVyJykgZGVjb3JhdG9yVHlwZSA9ICdDQ0Zsb2F0JztcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGRlY29yYXRvclR5cGUpIHtcclxuICAgICAgICAgICAgICAgICAgICAgZGVjb3JhdG9yUGFydHMucHVzaChpc0FycmF5ID8gYHR5cGU6IFske2RlY29yYXRvclR5cGV9XWAgOiBgdHlwZTogJHtkZWNvcmF0b3JUeXBlfWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIEF0dHJpYnV0ZXMgdGhhdCBjYW4gaGVscCBBSSBnZXQgbW9yZSBjb250ZXh0XHJcbiAgICAgICAgICAgICAgICBjb25zdCBhdHRycyA9IFsnbWluJywgJ21heCcsICdzdGVwJywgJ3VuaXQnLCAncmFkaWFuJywgJ211bHRpbGluZSddO1xyXG4gICAgICAgICAgICAgICAgYXR0cnMuZm9yRWFjaChhdHRyID0+IHsgXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsID0gKHAgYXMgYW55KVthdHRyXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodmFsICE9PSB1bmRlZmluZWQgJiYgdmFsICE9PSBudWxsKSBkZWNvcmF0b3JQYXJ0cy5wdXNoKGAke2F0dHJ9OiAke3ZhbH1gKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChwLnRvb2x0aXApIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgdG9vbHRpcCA9IHAudG9vbHRpcDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodG9vbHRpcC5zdGFydHNXaXRoKCdpMThuOicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvb2x0aXAgPSBFZGl0b3IuSTE4bi50KHRvb2x0aXAuc2xpY2UoNSkpOyAvLyBSZW1vdmUgJ2kxOG46JyBwcmVmaXhcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2x0aXAudHJpbSgpLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRvb2x0aXAubWF0Y2goLzxiclxccypcXC8/Pi9pKSB8fCB0b29sdGlwLmluY2x1ZGVzKCdcXG4nKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZXMgPSB0b29sdGlwLnNwbGl0KC88YnJcXHMqXFwvPz58XFxuL2kpLm1hcChsID0+IGwudHJpbSgpKS5maWx0ZXIobCA9PiBsLmxlbmd0aCA+IDApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxpbmVzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChgXFx0LyoqYCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGluZXMuZm9yRWFjaChsaW5lID0+IGZpZWxkcy5wdXNoKGBcXHQgKiAke2xpbmV9YCkpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGBcXHQgKi9gKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGBcXHQvKiogJHt0b29sdGlwfSAqL2ApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChkZWNvcmF0b3JQYXJ0cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdEBwcm9wZXJ0eSh7ICR7ZGVjb3JhdG9yUGFydHMuam9pbignLCAnKX0gfSlgKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBwcmVmaXggPSAhIXAucmVhZG9ubHkgPyAncmVhZG9ubHkgJyA6ICcnO1xyXG4gICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdCR7cHJlZml4fSR7cHJvcE5hbWV9OiAke3RzVHlwZX07YCk7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gUmF3IFZhbHVlIEhhbmRsaW5nIChQcmltaXRpdmVzIGFuZCBzaW1wbGUgb2JqZWN0cylcclxuICAgICAgICAgICAgaWYgKHRoaXMuaXNQcmltaXRpdmUocHJvcCkpIHtcclxuICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGBcXHQke3Byb3BOYW1lfTogJHt0eXBlb2YgcHJvcH07YCk7XHJcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQXJyYXkgSGFuZGxpbmdcclxuICAgICAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocHJvcCkpIHtcclxuICAgICAgICAgICAgICAgIGlmIChwcm9wLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGBcXHQke3Byb3BOYW1lfTogQXJyYXk8YW55PjtgKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlyc3RJdGVtID0gcHJvcFswXTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc1ByaW1pdGl2ZShmaXJzdEl0ZW0pKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBmaWVsZHMucHVzaChgXFx0JHtwcm9wTmFtZX06IEFycmF5PCR7dHlwZW9mIGZpcnN0SXRlbX0+O2ApO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGZpcnN0SXRlbSA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFJhdyBvYmplY3QgaW4gYXJyYXkgLT4gUmVjdXJzaW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXN0ZWRDbGFzc05hbWUgPSBgJHtjbGFzc05hbWV9JHtwcm9wTmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHByb3BOYW1lLnNsaWNlKDEpfUl0ZW1gO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZXNzQ2xhc3MobmVzdGVkQ2xhc3NOYW1lLCBmaXJzdEl0ZW0gYXMgdW5rbm93biBhcyB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkcy5wdXNoKGBcXHQke3Byb3BOYW1lfTogQXJyYXk8JHtuZXN0ZWRDbGFzc05hbWV9PjtgKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdCR7cHJvcE5hbWV9OiBBcnJheTxhbnk+O2ApO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8gRmFsbGJhY2sgZm9yIHJhdyBvYmplY3QgKHN0cnVjdClcclxuICAgICAgICAgICAgIGlmICh0eXBlb2YgcHJvcCA9PT0gJ29iamVjdCcpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNsZWFuQ2xhc3NOYW1lID0gY2xhc3NOYW1lLnJlcGxhY2UoL15jY1xcLi8sICcnKS5yZXBsYWNlKC9bXmEtekEtWjAtOV9dL2csICdfJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBuZXN0ZWRDbGFzc05hbWUgPSBgJHtjbGVhbkNsYXNzTmFtZX0ke3Byb3BOYW1lLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgcHJvcE5hbWUuc2xpY2UoMSl9VHlwZWA7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NDbGFzcyhuZXN0ZWRDbGFzc05hbWUsIHByb3AgYXMgdW5rbm93biBhcyB7IFtrZXk6IHN0cmluZ106IElQcm9wZXJ0eVZhbHVlVHlwZSB9KTsgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgZmllbGRzLnB1c2goYFxcdCR7cHJvcE5hbWV9OiAke25lc3RlZENsYXNzTmFtZX07YCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHNob3J0TmFtZSA9IGNsYXNzTmFtZS5pbmNsdWRlcygnLicpID8gY2xhc3NOYW1lLnNwbGl0KCcuJykucG9wKCkhIDogY2xhc3NOYW1lO1xyXG4gICAgICAgIGNvbnN0IGNsYXNzRGVmID0gW1xyXG4gICAgICAgICAgICBgZXhwb3J0IGNsYXNzICR7c2hvcnROYW1lfSAke2V4dGVuZHNDbGFzcyA/IGBleHRlbmRzICR7ZXh0ZW5kc0NsYXNzfWAgOiAnJ30ge2AsXHJcbiAgICAgICAgICAgIC4uLmZpZWxkcyxcclxuICAgICAgICAgICAgYH1gXHJcbiAgICAgICAgXS5qb2luKCdcXG4nKTtcclxuXHJcbiAgICAgICAgdGhpcy5fZGVmaW5pdGlvbnMucHVzaChjbGFzc0RlZik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVHlwZSBHdWFyZCBmb3IgSVByb3BlcnR5XHJcbiAgICBwcml2YXRlIGlzUHJvcGVydHkodmFsOiBhbnkpOiB2YWwgaXMgSVByb3BlcnR5IHtcclxuICAgICAgICAgcmV0dXJuIHZhbCAmJiB0eXBlb2YgdmFsID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIHZhbDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBCYXNlZCBvbiBpbmZvIGZyb20gQ0NDbGFzc1xyXG4gICAgcHJpdmF0ZSBpc1ByaW1pdGl2ZVR5cGUodHlwZTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIFsnSW50ZWdlcicsICdGbG9hdCcsICdOdW1iZXInLCAnU3RyaW5nJywgJ0Jvb2xlYW4nXS5pbmNsdWRlcyh0eXBlKTtcclxuICAgIH1cclxuXHJcbiAgICAvLyBDaGVjayBpZiB2YWx1ZSBpcyBwcmltaXRpdmVcclxuICAgIHByaXZhdGUgaXNQcmltaXRpdmUodmFsdWU6IHVua25vd24pOiBib29sZWFuIHtcclxuICAgICAgICByZXR1cm4gdmFsdWUgPT09IG51bGwgfHwgKHR5cGVvZiB2YWx1ZSAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIik7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSGVscGVyIGZvciBFbnVtIG9yIEJpdE1hc2sgZ2VuZXJhdGlvblxyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZUVudW1EZWZpbml0aW9uKG5hbWU6IHN0cmluZywgaXRlbXM6IGFueVtdKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX2RlZmluZWROYW1lcy5oYXMobmFtZSkpIHJldHVybjtcclxuICAgICAgICB0aGlzLl9kZWZpbmVkTmFtZXMuYWRkKG5hbWUpO1xyXG5cclxuICAgICAgICBjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBsaW5lcy5wdXNoKGBleHBvcnQgZW51bSAke25hbWV9IHtgKTtcclxuICAgICAgICBpdGVtcy5mb3JFYWNoKChpdGVtKSA9PiB7XHJcbiAgICAgICAgICAgIGxldCBjbGVhbk5hbWUgPSBpdGVtLm5hbWUucmVwbGFjZSgvW15hLXpBLVowLTlfXS9nLCAnXycpO1xyXG4gICAgICAgICAgICBpZiAoL15bMC05XS8udGVzdChjbGVhbk5hbWUpKSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhbk5hbWUgPSBgXyR7Y2xlYW5OYW1lfWA7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgaXRlbS52YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goYFxcdCR7Y2xlYW5OYW1lfSA9ICcke2l0ZW0udmFsdWV9JyxgKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGxpbmVzLnB1c2goYFxcdCR7Y2xlYW5OYW1lfSA9ICR7aXRlbS52YWx1ZX0sYCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgICAgICBsaW5lcy5wdXNoKGB9YCk7XHJcbiAgICAgICAgdGhpcy5fZGVmaW5pdGlvbnMudW5zaGlmdChsaW5lcy5qb2luKCdcXG4nKSk7XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgcmVzb2x2ZVRzVHlwZSh0eXBlOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIHN3aXRjaCAodHlwZSkge1xyXG4gICAgICAgICAgICBjYXNlICdJbnRlZ2VyJzpcclxuICAgICAgICAgICAgY2FzZSAnRmxvYXQnOlxyXG4gICAgICAgICAgICBjYXNlICdOdW1iZXInOlxyXG4gICAgICAgICAgICBjYXNlICdFbnVtJzogLy8gRW51bXMgaGFuZGxlZCBzcGVjaWZpY2FsbHksIGJ1dCBmYWxsYmFjayBmb3Igc2FmZXR5XHJcbiAgICAgICAgICAgIGNhc2UgJ0JpdE1hc2snOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuICdudW1iZXInO1xyXG4gICAgICAgICAgICBjYXNlICdTdHJpbmcnOlxyXG4gICAgICAgICAgICAgICAgcmV0dXJuICdzdHJpbmcnO1xyXG4gICAgICAgICAgICBjYXNlICdCb29sZWFuJzpcclxuICAgICAgICAgICAgICAgIHJldHVybiAnYm9vbGVhbic7XHJcbiAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHlwZTsgLy8gZS5nLiBWZWMzLCBDb2xvciwgTm9kZVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbn1cclxuXHJcbiJdfQ==