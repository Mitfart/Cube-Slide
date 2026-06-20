"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssetTools = void 0;
const fs_extra_1 = __importDefault(require("fs-extra"));
const decorators_1 = require("../decorators");
const schemas_1 = require("../schemas");
const path_1 = __importStar(require("path"));
const os_1 = __importDefault(require("os"));
function normalizePath(p) {
    if (!p)
        return 'db://assets';
    let path = p.replace(/\\/g, '/').trim();
    // Handle db:// protocol
    if (path.startsWith('db://')) {
        return path.endsWith('/') && path !== 'db://' ? path.slice(0, -1) : path;
    }
    // Remove leading slash
    if (path.startsWith('/')) {
        path = path.slice(1);
    }
    // Handle root aliases
    if (path === '' || path === 'assets') {
        return 'db://assets';
    }
    // Handle 'assets/' prefix
    if (path.startsWith('assets/')) {
        const result = 'db://' + path;
        return result.endsWith('/') ? result.slice(0, -1) : result;
    }
    // Treat as relative path under assets
    if (path.endsWith('/')) {
        path = path.slice(0, -1);
    }
    return `db://assets/${path}`;
}
class AssetTools {
    async assetGetTree(args) {
        if (args.reference) {
            const info = await Editor.Message.request('asset-db', 'query-asset-info', args.reference.id);
            if (!info) {
                throw new Error(`Asset with UUID ${args.reference.id} not found.`);
            }
            args.assetPath = info.url;
        }
        let rootPath = normalizePath(args.assetPath);
        const pattern = `${rootPath}/**`;
        const assets = await Editor.Message.request('asset-db', 'query-assets', { pattern });
        const rootUuid = await Editor.Message.request('asset-db', 'query-uuid', rootPath);
        const assetsMap = new Map();
        // Create Root Node first
        const rootName = rootPath.split('/').pop() || 'assets';
        const rootNode = {
            filesystemPath: Editor.Project.path + '/' + rootPath.replace('db://', ''),
            reference: { id: rootUuid || 'root', type: 'folder' },
            name: rootName,
            children: []
        };
        assetsMap.set(rootPath, rootNode);
        // First pass: Map assets
        assets.forEach((asset) => {
            if (asset.url === rootPath)
                return; // Skip root, already created
            const type = asset.isDirectory ? 'folder' : asset.type;
            const treeItem = {
                reference: { id: asset.uuid, type: type },
                name: asset.name,
                children: []
            };
            assetsMap.set(asset.url, treeItem);
        });
        // Second pass: Build hierarchy
        assets.forEach((asset) => {
            if (asset.url === rootPath)
                return;
            const treeItem = assetsMap.get(asset.url);
            if (!treeItem)
                return;
            const parentUrl = asset.url.substring(0, asset.url.lastIndexOf('/'));
            const parentItem = assetsMap.get(parentUrl);
            if (parentItem) {
                parentItem.children.push(treeItem);
            }
        });
        return rootNode;
    }
    async assetGetAtPath(args) {
        let targetPath = normalizePath(args.assetPath);
        console.log(`Looking for asset at path: ${targetPath}`);
        const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', targetPath);
        if (!assetInfo) {
            throw new Error(`Asset not found at path: ${targetPath}`);
        }
        else {
            return { reference: { id: assetInfo.uuid, type: assetInfo.type } };
        }
    }
    async assetCreate(args) {
        var _a, _b, _c, _d;
        let targetPath = normalizePath(args.assetPath);
        // Map 'preset' from schema to 'type' expected by function
        const type = args.preset;
        const presetMap = {
            'material': 'db://internal/default_file_content/material/default.mtl',
            'effect': 'db://internal/default_file_content/effect/default.effect',
            'scene': 'db://internal/default_file_content/scene/default.scene',
            'prefab': 'db://internal/default_file_content/prefab/default.prefab',
            'animation-clip': 'db://internal/default_file_content/animation-clip/default.anim',
            'render-texture': 'db://internal/default_file_content/render-texture/default.rt',
            'physics-material': 'db://internal/default_file_content/physics-material/default.pmtl',
            'animation-graph': 'db://internal/default_file_content/animation-graph/default.animgraph',
            'animation-graph-variant': 'db://internal/default_file_content/animation-graph-variant/default.animgraphvari',
            'animation-mask': 'db://internal/default_file_content/animation-mask/default.animask',
            'auto-atlas': 'db://internal/default_file_content/auto-atlas/default.pac',
            'effect-header': 'db://internal/default_file_content/effect-header/chunk',
            'label-atlas': 'db://internal/default_file_content/label-atlas/default.labelatlas',
            'terrain': 'db://internal/default_file_content/terrain/default.terrain'
        };
        const assetOptions = {
            overwrite: (_b = (_a = args.options) === null || _a === void 0 ? void 0 : _a.overwrite) !== null && _b !== void 0 ? _b : false,
            rename: (_d = (_c = args.options) === null || _c === void 0 ? void 0 : _c.rename) !== null && _d !== void 0 ? _d : false
        };
        if (type === 'folder' || type === 'typescript') {
            let content = null;
            if (type === 'typescript') {
                const currentExtName = (0, path_1.extname)(targetPath);
                if (currentExtName !== '.ts') {
                    targetPath = currentExtName ? targetPath.slice(0, -currentExtName.length) : targetPath;
                    targetPath += '.ts';
                }
                const className = (0, path_1.basename)(targetPath.slice('db://'.length), '.ts');
                content = this.generateTypescriptClassTemplate(className);
            }
            const result = await Editor.Message.request('asset-db', 'create-asset', targetPath, content, assetOptions);
            if (!result) {
                throw new Error(`Failed to create folder at ${targetPath}`);
            }
            else {
                return { reference: { id: result.uuid, type: type } };
            }
        }
        const source = presetMap[type];
        if (!source) {
            throw new Error(`Unknown asset preset type: ${type}`);
        }
        if ((0, path_1.extname)(targetPath) === '' && type !== 'folder') {
            targetPath += type == 'chunk' ? '.chunk' : (0, path_1.extname)(presetMap[type]);
        }
        const assetInfo = await Editor.Message.request('asset-db', 'copy-asset', source, targetPath, assetOptions);
        if (!assetInfo) {
            throw new Error(`Failed to create asset at ${targetPath}`);
        }
        else {
            return { reference: { id: assetInfo.uuid, type: assetInfo.type } };
        }
    }
    async assetImport(args) {
        var _a, _b, _c, _d;
        let targetPath = normalizePath(args.targetAssetPath);
        const assetOptions = {
            overwrite: (_b = (_a = args.options) === null || _a === void 0 ? void 0 : _a.overwrite) !== null && _b !== void 0 ? _b : false,
            rename: (_d = (_c = args.options) === null || _c === void 0 ? void 0 : _c.rename) !== null && _d !== void 0 ? _d : false
        };
        // Additional resolving for absolute path
        if (args.sourceFilesystemPath.startsWith('~')) {
            args.sourceFilesystemPath = path_1.default.join(os_1.default.homedir(), args.sourceFilesystemPath.slice(1));
        }
        args.sourceFilesystemPath = path_1.default.resolve(args.sourceFilesystemPath);
        args.sourceFilesystemPath = await fs_extra_1.default.realpath(args.sourceFilesystemPath);
        // Checking for existing asset at target path
        let existingAssetInfo = null;
        // If caller tries to import the same file in assets - just reimport
        if (`${Editor.Project.path}${targetPath.slice('db:/'.length)}` === args.sourceFilesystemPath) {
            await Editor.Message.request('asset-db', 'refresh-asset', targetPath);
            existingAssetInfo = await Editor.Message.request('asset-db', 'query-asset-info', targetPath);
        }
        const assetInfo = existingAssetInfo ? existingAssetInfo :
            await Editor.Message.request('asset-db', 'import-asset', args.sourceFilesystemPath, targetPath, assetOptions);
        if (!assetInfo) {
            throw new Error(`Failed to import asset to ${targetPath}`);
        }
        else {
            if (assetInfo.extends && assetInfo.importer === 'image' && args.imageType) {
                // Handle image type override
                const meta = await Editor.Message.request('asset-db', 'query-asset-meta', assetInfo.uuid);
                if (meta && meta.userData) {
                    let typeToSet = args.imageType;
                    if (typeToSet === 'normal-map') {
                        typeToSet = 'normal map';
                    }
                    if (typeToSet === 'texture-cube') {
                        typeToSet = 'texture cube';
                    }
                    meta.userData.type = typeToSet;
                    await Editor.Message.request('asset-db', 'save-asset-meta', assetInfo.uuid, JSON.stringify(meta));
                }
            }
            return { reference: { id: assetInfo.uuid, type: assetInfo.type } };
        }
    }
    async assetOperate(args) {
        var _a, _b, _c, _d, _e, _f;
        const assetOptions = {
            overwrite: (_b = (_a = args.options) === null || _a === void 0 ? void 0 : _a.overwrite) !== null && _b !== void 0 ? _b : false,
            rename: (_d = (_c = args.options) === null || _c === void 0 ? void 0 : _c.rename) !== null && _d !== void 0 ? _d : false
        };
        args.targetAssetPath = normalizePath(args.targetAssetPath);
        let result = null;
        switch (args.operation) {
            case 'move':
                if (!args.targetAssetPath) {
                    throw new Error('Target is required for move');
                }
                result = await Editor.Message.request('asset-db', 'move-asset', args.reference.id, args.targetAssetPath, assetOptions);
                break;
            case 'copy':
                if (!args.targetAssetPath) {
                    throw new Error('Target is required for copy');
                }
                result = await Editor.Message.request('asset-db', 'copy-asset', args.reference.id, args.targetAssetPath, assetOptions);
                break;
            case 'delete':
                result = await Editor.Message.request('asset-db', 'delete-asset', args.reference.id);
                break;
            case 'open':
                await Editor.Message.request('asset-db', 'open-asset', args.reference.id);
                result = null;
                break;
            case 'refresh':
                await Editor.Message.request('asset-db', 'refresh-asset', args.reference.id);
                result = null;
                break;
            case 'reimport':
                await Editor.Message.request('asset-db', 'reimport-asset', args.reference.id);
                result = null;
                break;
            default:
                throw new Error(`Unknown operation: ${args.operation}`);
        }
        return { reference: { id: (_e = result === null || result === void 0 ? void 0 : result.uuid) !== null && _e !== void 0 ? _e : '', type: (_f = result === null || result === void 0 ? void 0 : result.type) !== null && _f !== void 0 ? _f : '' } };
    }
    generateTypescriptClassTemplate(className) {
        return `import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('${className}')
export class ${className} extends Component {
    start() {

    }

    update(deltaTime: number) {
        
    }
}`;
    }
}
exports.AssetTools = AssetTools;
__decorate([
    (0, decorators_1.utcpTool)('assetGetTree', 'Get the asset and subAsset hierarchy tree. Children have recursive structure.', {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema,
            assetPath: { type: 'string', description: 'Root path to start from' }
        }
    }, schemas_1.AssetTreeItemSchema, "GET", ['asset', 'file', 'tree', 'hierarchy', 'folder', 'subasset'])
], AssetTools.prototype, "assetGetTree", null);
__decorate([
    (0, decorators_1.utcpTool)('assetGetAtPath', 'Get asset reference by given local path and name, including extension. Can be used for subassets too. Returns reference to the asset.', {
        type: 'object',
        properties: {
            assetPath: { type: 'string' }
        },
        required: ['assetPath']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "GET", ['asset', 'get', 'path', 'look', 'find'])
], AssetTools.prototype, "assetGetAtPath", null);
__decorate([
    (0, decorators_1.utcpTool)('assetCreate', 'Create empty asset or folder of given type. Automatically handles folders creation along the path. Returns reference to the new asset.', {
        type: 'object',
        properties: {
            assetPath: { type: 'string' },
            preset: {
                type: 'string',
                enum: [
                    'folder',
                    'material',
                    'effect',
                    'scene',
                    'prefab',
                    'typescript',
                    'animation-clip',
                    'render-texture',
                    'physics-material',
                    'animation-graph',
                    'animation-graph-variant',
                    'animation-mask',
                    'auto-atlas',
                    'effect-header',
                    'label-atlas',
                    'terrain'
                ],
                description: 'Preset type for the new asset'
            },
            options: { type: 'object', properties: { overwrite: { type: 'boolean' }, rename: { type: 'boolean' } }, description: 'Additional options for the operation', nullable: true },
        },
        required: ['assetPath', 'preset']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['asset', 'create', 'new', 'preset', 'folder', 'typescript'])
], AssetTools.prototype, "assetCreate", null);
__decorate([
    (0, decorators_1.utcpTool)('assetImport', 'Import an external file as an asset into the project. Path must end with the extension. Returns reference to the new asset.', {
        type: 'object',
        properties: {
            sourceFilesystemPath: { type: 'string', description: 'Source filesystem path of the file to import' },
            targetAssetPath: { type: 'string', description: 'Target path in the asset database' },
            imageType: { type: 'string', enum: ['raw', 'texture', 'normal-map', 'sprite-frame', 'texture-cube'], description: 'For image files, specify how to import them' },
            options: { type: 'object', properties: { overwrite: { type: 'boolean' }, rename: { type: 'boolean' } }, description: 'Additional options for the operation' },
        },
        required: ['sourceFilesystemPath', 'targetAssetPath']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['asset', 'import', 'file', 'external', 'image'])
], AssetTools.prototype, "assetImport", null);
__decorate([
    (0, decorators_1.utcpTool)('assetOperate', 'Perform operations on assets (move, copy, delete, open). Returns reference to the affected asset (for delete/open returns the source asset reference).', {
        type: 'object',
        properties: {
            operation: { type: 'string', enum: ['move', 'copy', 'delete', 'open', 'refresh', 'reimport'] },
            reference: schemas_1.InstanceReferenceSchema,
            targetAssetPath: { type: 'string', description: 'Target path (for move/copy/import)' },
            options: { type: 'object', properties: { overwrite: { type: 'boolean' }, rename: { type: 'boolean' } }, description: 'Additional options for the operation', nullable: true },
        },
        required: ['operation', 'reference']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['asset', 'operate', 'move', 'copy', 'delete', 'open', 'refresh', 'reimport'])
], AssetTools.prototype, "assetOperate", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXNzZXQtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvdXRjcC90b29scy9hc3NldC10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBMEI7QUFDMUIsOENBQXlDO0FBRXpDLHdDQUE4RztBQUM5Ryw2Q0FBK0M7QUFDL0MsNENBQW9CO0FBRXBCLFNBQVMsYUFBYSxDQUFDLENBQVU7SUFDN0IsSUFBSSxDQUFDLENBQUM7UUFBRSxPQUFPLGFBQWEsQ0FBQztJQUM3QixJQUFJLElBQUksR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztJQUV4Qyx3QkFBd0I7SUFDeEIsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7UUFDM0IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksS0FBSyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUM3RSxDQUFDO0lBRUQsdUJBQXVCO0lBQ3ZCLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO1FBQ3ZCLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ3pCLENBQUM7SUFFRCxzQkFBc0I7SUFDdEIsSUFBSSxJQUFJLEtBQUssRUFBRSxJQUFJLElBQUksS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUNuQyxPQUFPLGFBQWEsQ0FBQztJQUN6QixDQUFDO0lBRUQsMEJBQTBCO0lBQzFCLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQzdCLE1BQU0sTUFBTSxHQUFHLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDOUIsT0FBTyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUM7SUFDL0QsQ0FBQztJQUVELHNDQUFzQztJQUN0QyxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztRQUNyQixJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUM3QixDQUFDO0lBRUQsT0FBTyxlQUFlLElBQUksRUFBRSxDQUFDO0FBQ2pDLENBQUM7QUFFRCxNQUFhLFVBQVU7SUFjYixBQUFOLEtBQUssQ0FBQyxZQUFZLENBQUMsSUFBNEQ7UUFDM0UsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDakIsTUFBTSxJQUFJLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUM3RixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ1IsTUFBTSxJQUFJLEtBQUssQ0FBQyxtQkFBbUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQ3ZFLENBQUM7WUFDRCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUM7UUFDOUIsQ0FBQztRQUVELElBQUksUUFBUSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFFN0MsTUFBTSxPQUFPLEdBQUcsR0FBRyxRQUFRLEtBQUssQ0FBQztRQUNqQyxNQUFNLE1BQU0sR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsRUFBRSxPQUFPLEVBQUUsQ0FBQyxDQUFDO1FBQ3JGLE1BQU0sUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVsRixNQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsRUFBMEIsQ0FBQztRQUVwRCx5QkFBeUI7UUFDekIsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxRQUFRLENBQUM7UUFDdkQsTUFBTSxRQUFRLEdBQW1CO1lBQzdCLGNBQWMsRUFBRSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksR0FBRyxHQUFHLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDO1lBQ3pFLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxRQUFRLElBQUksTUFBTSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDckQsSUFBSSxFQUFFLFFBQVE7WUFDZCxRQUFRLEVBQUUsRUFBRTtTQUNmLENBQUM7UUFDRixTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUVsQyx5QkFBeUI7UUFDekIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQVUsRUFBRSxFQUFFO1lBQzFCLElBQUksS0FBSyxDQUFDLEdBQUcsS0FBSyxRQUFRO2dCQUFFLE9BQU8sQ0FBQyw2QkFBNkI7WUFFakUsTUFBTSxJQUFJLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBRXZELE1BQU0sUUFBUSxHQUFtQjtnQkFDN0IsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRTtnQkFDekMsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJO2dCQUNoQixRQUFRLEVBQUUsRUFBRTthQUNmLENBQUM7WUFFRixTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdkMsQ0FBQyxDQUFDLENBQUM7UUFFSCwrQkFBK0I7UUFDL0IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQVUsRUFBRSxFQUFFO1lBQzFCLElBQUksS0FBSyxDQUFDLEdBQUcsS0FBSyxRQUFRO2dCQUFFLE9BQU87WUFFbkMsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDMUMsSUFBSSxDQUFDLFFBQVE7Z0JBQUUsT0FBTztZQUV0QixNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNyRSxNQUFNLFVBQVUsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTVDLElBQUksVUFBVSxFQUFFLENBQUM7Z0JBQ2IsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDdkMsQ0FBQztRQUNMLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTyxRQUFRLENBQUM7SUFDcEIsQ0FBQztJQWNLLEFBQU4sS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUEyQjtRQUM1QyxJQUFJLFVBQVUsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRS9DLE9BQU8sQ0FBQyxHQUFHLENBQUMsOEJBQThCLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFFeEQsTUFBTSxTQUFTLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsVUFBVSxDQUFDLENBQUM7UUFDM0YsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyw0QkFBNEIsVUFBVSxFQUFFLENBQUMsQ0FBQztRQUM5RCxDQUFDO2FBQU0sQ0FBQztZQUNKLE9BQU8sRUFBRSxTQUFTLEVBQUUsRUFBRSxFQUFFLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDdkUsQ0FBQztJQUNMLENBQUM7SUFxQ0ssQUFBTixLQUFLLENBQUMsV0FBVyxDQUFDLElBQWdHOztRQUM5RyxJQUFJLFVBQVUsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRS9DLDBEQUEwRDtRQUMxRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3pCLE1BQU0sU0FBUyxHQUEyQjtZQUN0QyxVQUFVLEVBQUUseURBQXlEO1lBQ3JFLFFBQVEsRUFBRSwwREFBMEQ7WUFDcEUsT0FBTyxFQUFFLHdEQUF3RDtZQUNqRSxRQUFRLEVBQUUsMERBQTBEO1lBQ3BFLGdCQUFnQixFQUFFLGdFQUFnRTtZQUNsRixnQkFBZ0IsRUFBRSw4REFBOEQ7WUFDaEYsa0JBQWtCLEVBQUUsa0VBQWtFO1lBQ3RGLGlCQUFpQixFQUFFLHNFQUFzRTtZQUN6Rix5QkFBeUIsRUFBRSxrRkFBa0Y7WUFDN0csZ0JBQWdCLEVBQUUsbUVBQW1FO1lBQ3JGLFlBQVksRUFBRSwyREFBMkQ7WUFDekUsZUFBZSxFQUFFLHdEQUF3RDtZQUN6RSxhQUFhLEVBQUUsbUVBQW1FO1lBQ2xGLFNBQVMsRUFBRSw0REFBNEQ7U0FDMUUsQ0FBQztRQUVGLE1BQU0sWUFBWSxHQUF5QjtZQUN2QyxTQUFTLEVBQUUsTUFBQSxNQUFBLElBQUksQ0FBQyxPQUFPLDBDQUFFLFNBQVMsbUNBQUksS0FBSztZQUMzQyxNQUFNLEVBQUUsTUFBQSxNQUFBLElBQUksQ0FBQyxPQUFPLDBDQUFFLE1BQU0sbUNBQUksS0FBSztTQUN4QyxDQUFDO1FBRUYsSUFBSSxJQUFJLEtBQUssUUFBUSxJQUFJLElBQUksS0FBSyxZQUFZLEVBQUUsQ0FBQztZQUM3QyxJQUFJLE9BQU8sR0FBa0IsSUFBSSxDQUFDO1lBQ2xDLElBQUksSUFBSSxLQUFLLFlBQVksRUFBRSxDQUFDO2dCQUN4QixNQUFNLGNBQWMsR0FBRyxJQUFBLGNBQU8sRUFBQyxVQUFVLENBQUMsQ0FBQztnQkFDM0MsSUFBSSxjQUFjLEtBQUssS0FBSyxFQUFFLENBQUM7b0JBQzNCLFVBQVUsR0FBRyxjQUFjLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUM7b0JBQ3ZGLFVBQVUsSUFBSSxLQUFLLENBQUM7Z0JBQ3hCLENBQUM7Z0JBQ0QsTUFBTSxTQUFTLEdBQUcsSUFBQSxlQUFRLEVBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQ3BFLE9BQU8sR0FBRyxJQUFJLENBQUMsK0JBQStCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDOUQsQ0FBQztZQUVELE1BQU0sTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxVQUFVLEVBQUUsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQzNHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDVixNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE4QixVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQ2hFLENBQUM7aUJBQU0sQ0FBQztnQkFDSixPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUM7WUFDMUQsQ0FBQztRQUNMLENBQUM7UUFFRCxNQUFNLE1BQU0sR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDL0IsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ1YsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUMxRCxDQUFDO1FBRUQsSUFBSSxJQUFBLGNBQU8sRUFBQyxVQUFVLENBQUMsS0FBSyxFQUFFLElBQUksSUFBSSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQ2xELFVBQVUsSUFBSSxJQUFJLElBQUksT0FBTyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUEsY0FBTyxFQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBQ3hFLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUMzRyxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDYixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELENBQUM7YUFBTSxDQUFDO1lBQ0osT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztRQUN2RSxDQUFDO0lBQ0wsQ0FBQztJQWlCSyxBQUFOLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBb007O1FBQ2xOLElBQUksVUFBVSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFckQsTUFBTSxZQUFZLEdBQXlCO1lBQ3ZDLFNBQVMsRUFBRSxNQUFBLE1BQUEsSUFBSSxDQUFDLE9BQU8sMENBQUUsU0FBUyxtQ0FBSSxLQUFLO1lBQzNDLE1BQU0sRUFBRSxNQUFBLE1BQUEsSUFBSSxDQUFDLE9BQU8sMENBQUUsTUFBTSxtQ0FBSSxLQUFLO1NBQ3hDLENBQUM7UUFFRix5Q0FBeUM7UUFDekMsSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDNUMsSUFBSSxDQUFDLG9CQUFvQixHQUFHLGNBQUksQ0FBQyxJQUFJLENBQUMsWUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUM1RixDQUFDO1FBQ0QsSUFBSSxDQUFDLG9CQUFvQixHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDLG9CQUFvQixHQUFHLE1BQU0sa0JBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFFekUsNkNBQTZDO1FBQzdDLElBQUksaUJBQWlCLEdBQXFCLElBQUksQ0FBQztRQUMvQyxvRUFBb0U7UUFDcEUsSUFBSSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxHQUFHLFVBQVUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDM0YsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3RFLGlCQUFpQixHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGtCQUFrQixFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ2pHLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBRyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUNyRCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxjQUFjLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUFFLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNsSCxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDYixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELENBQUM7YUFBTSxDQUFDO1lBQ0osSUFBSSxTQUFTLENBQUMsT0FBTyxJQUFJLFNBQVMsQ0FBQyxRQUFRLEtBQUssT0FBTyxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUUsQ0FBQztnQkFDeEUsNkJBQTZCO2dCQUM3QixNQUFNLElBQUksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxrQkFBa0IsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzFGLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztvQkFDeEIsSUFBSSxTQUFTLEdBQVcsSUFBSSxDQUFDLFNBQVMsQ0FBQztvQkFDdkMsSUFBSSxTQUFTLEtBQUssWUFBWSxFQUFFLENBQUM7d0JBQzdCLFNBQVMsR0FBRyxZQUFZLENBQUM7b0JBQzdCLENBQUM7b0JBQ0QsSUFBSSxTQUFTLEtBQUssY0FBYyxFQUFFLENBQUM7d0JBQy9CLFNBQVMsR0FBRyxjQUFjLENBQUM7b0JBQy9CLENBQUM7b0JBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsU0FBUyxDQUFDO29CQUMvQixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDdEcsQ0FBQztZQUNMLENBQUM7WUFFRCxPQUFPLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ3ZFLENBQUM7SUFDTCxDQUFDO0lBaUJLLEFBQU4sS0FBSyxDQUFDLFlBQVksQ0FBQyxJQUF5STs7UUFDeEosTUFBTSxZQUFZLEdBQUc7WUFDakIsU0FBUyxFQUFFLE1BQUEsTUFBQSxJQUFJLENBQUMsT0FBTywwQ0FBRSxTQUFTLG1DQUFJLEtBQUs7WUFDM0MsTUFBTSxFQUFFLE1BQUEsTUFBQSxJQUFJLENBQUMsT0FBTywwQ0FBRSxNQUFNLG1DQUFJLEtBQUs7U0FDeEMsQ0FBQztRQUVGLElBQUksQ0FBQyxlQUFlLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMzRCxJQUFJLE1BQU0sR0FBcUIsSUFBSSxDQUFDO1FBRXBDLFFBQVEsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3JCLEtBQUssTUFBTTtnQkFDUCxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO29CQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUM7Z0JBQ25ELENBQUM7Z0JBRUQsTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsZUFBZSxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUN2SCxNQUFNO1lBRVYsS0FBSyxNQUFNO2dCQUNQLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7b0JBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMsNkJBQTZCLENBQUMsQ0FBQztnQkFDbkQsQ0FBQztnQkFDRCxNQUFNLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7Z0JBQ3ZILE1BQU07WUFFVixLQUFLLFFBQVE7Z0JBQ1QsTUFBTSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUNyRixNQUFNO1lBRVYsS0FBSyxNQUFNO2dCQUNQLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLFlBQVksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUMxRSxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUNkLE1BQU07WUFFVixLQUFLLFNBQVM7Z0JBQ1YsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsZUFBZSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQzdFLE1BQU0sR0FBRyxJQUFJLENBQUM7Z0JBQ2QsTUFBTTtZQUNWLEtBQUssVUFBVTtnQkFDWCxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFVBQVUsRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO2dCQUM5RSxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUNkLE1BQU07WUFDVjtnQkFDSSxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixJQUFJLENBQUMsU0FBUyxFQUFFLENBQUMsQ0FBQztRQUNoRSxDQUFDO1FBRUQsT0FBTyxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxNQUFBLE1BQU0sYUFBTixNQUFNLHVCQUFOLE1BQU0sQ0FBRSxJQUFJLG1DQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsTUFBQSxNQUFNLGFBQU4sTUFBTSx1QkFBTixNQUFNLENBQUUsSUFBSSxtQ0FBSSxFQUFFLEVBQUUsRUFBRSxDQUFDO0lBQy9FLENBQUM7SUFHTywrQkFBK0IsQ0FBQyxTQUFpQjtRQUNyRCxPQUFPOzs7WUFHSCxTQUFTO2VBQ04sU0FBUzs7Ozs7Ozs7RUFRdEIsQ0FBQztJQUNDLENBQUM7Q0FDSjtBQXJWRCxnQ0FxVkM7QUF2VVM7SUFaTCxJQUFBLHFCQUFRLEVBQ0wsY0FBYyxFQUNkLCtFQUErRSxFQUMvRTtRQUNJLElBQUksRUFBRSxRQUFRO1FBQ2QsVUFBVSxFQUFFO1lBQ1IsU0FBUyxFQUFFLGlDQUF1QjtZQUNsQyxTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSx5QkFBeUIsRUFBRTtTQUN4RTtLQUNKLEVBQ0QsNkJBQW1CLEVBQUUsS0FBSyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FDM0Y7OENBMkRBO0FBY0s7SUFaTCxJQUFBLHFCQUFRLEVBQ0wsZ0JBQWdCLEVBQ2hCLHVJQUF1SSxFQUN2STtRQUNJLElBQUksRUFBRSxRQUFRO1FBQ2QsVUFBVSxFQUFFO1lBQ1IsU0FBUyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtTQUNoQztRQUNELFFBQVEsRUFBRSxDQUFDLFdBQVcsQ0FBQztLQUMxQixFQUNELEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxTQUFTLEVBQUUsaUNBQXVCLEVBQUUsRUFBRSxRQUFRLEVBQUUsQ0FBQyxXQUFXLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxDQUFDLE9BQU8sRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FDbko7Z0RBWUE7QUFxQ0s7SUFuQ0wsSUFBQSxxQkFBUSxFQUNMLGFBQWEsRUFDYix3SUFBd0ksRUFDeEk7UUFDSSxJQUFJLEVBQUUsUUFBUTtRQUNkLFVBQVUsRUFBRTtZQUNSLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDN0IsTUFBTSxFQUFFO2dCQUNKLElBQUksRUFBRSxRQUFRO2dCQUNkLElBQUksRUFBRTtvQkFDRixRQUFRO29CQUNSLFVBQVU7b0JBQ1YsUUFBUTtvQkFDUixPQUFPO29CQUNQLFFBQVE7b0JBQ1IsWUFBWTtvQkFDWixnQkFBZ0I7b0JBQ2hCLGdCQUFnQjtvQkFDaEIsa0JBQWtCO29CQUNsQixpQkFBaUI7b0JBQ2pCLHlCQUF5QjtvQkFDekIsZ0JBQWdCO29CQUNoQixZQUFZO29CQUNaLGVBQWU7b0JBQ2YsYUFBYTtvQkFDYixTQUFTO2lCQUNaO2dCQUNELFdBQVcsRUFBRSwrQkFBK0I7YUFDL0M7WUFDRCxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsRUFBRSxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsc0NBQXNDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtTQUNoTDtRQUNELFFBQVEsRUFBRSxDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUM7S0FDcEMsRUFDRCxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQUUsU0FBUyxFQUFFLGlDQUF1QixFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFlBQVksQ0FBQyxDQUN4Szs2Q0ErREE7QUFpQks7SUFmTCxJQUFBLHFCQUFRLEVBQ0wsYUFBYSxFQUNiLDZIQUE2SCxFQUM3SDtRQUNJLElBQUksRUFBRSxRQUFRO1FBQ2QsVUFBVSxFQUFFO1lBQ1Isb0JBQW9CLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSw4Q0FBOEMsRUFBRTtZQUNyRyxlQUFlLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxtQ0FBbUMsRUFBRTtZQUNyRixTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsWUFBWSxFQUFFLGNBQWMsRUFBRSxjQUFjLENBQUMsRUFBRSxXQUFXLEVBQUUsNkNBQTZDLEVBQUU7WUFDakssT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsRUFBRSxTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLHNDQUFzQyxFQUFFO1NBQ2hLO1FBQ0QsUUFBUSxFQUFFLENBQUMsc0JBQXNCLEVBQUUsaUJBQWlCLENBQUM7S0FDeEQsRUFDRCxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQUUsU0FBUyxFQUFFLGlDQUF1QixFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQzVKOzZDQStDQTtBQWlCSztJQWZMLElBQUEscUJBQVEsRUFDTCxjQUFjLEVBQ2Qsd0pBQXdKLEVBQ3hKO1FBQ0ksSUFBSSxFQUFFLFFBQVE7UUFDZCxVQUFVLEVBQUU7WUFDUixTQUFTLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLEVBQUU7WUFDOUYsU0FBUyxFQUFFLGlDQUF1QjtZQUNsQyxlQUFlLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxvQ0FBb0MsRUFBRTtZQUN0RixPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsRUFBRSxNQUFNLEVBQUUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsc0NBQXNDLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtTQUNoTDtRQUNELFFBQVEsRUFBRSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUM7S0FDdkMsRUFDRCxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLEVBQUUsU0FBUyxFQUFFLGlDQUF1QixFQUFFLEVBQUUsUUFBUSxFQUFFLENBQUMsV0FBVyxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQ3pMOzhDQWdEQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBmcyBmcm9tICdmcy1leHRyYSc7XHJcbmltcG9ydCB7IHV0Y3BUb29sIH0gZnJvbSAnLi4vZGVjb3JhdG9ycyc7XHJcbmltcG9ydCB7IEFzc2V0SW5mbywgQXNzZXRPcGVyYXRpb25PcHRpb24gfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3B1YmxpYyc7XHJcbmltcG9ydCB7IEFzc2V0VHJlZUl0ZW1TY2hlbWEsIElBc3NldFRyZWVJdGVtLCBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSwgSUluc3RhbmNlUmVmZXJlbmNlIH0gZnJvbSAnLi4vc2NoZW1hcyc7XHJcbmltcG9ydCBwYXRoLCB7IGJhc2VuYW1lLCBleHRuYW1lIH0gZnJvbSAncGF0aCc7XHJcbmltcG9ydCBvcyBmcm9tICdvcyc7XHJcblxyXG5mdW5jdGlvbiBub3JtYWxpemVQYXRoKHA/OiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgaWYgKCFwKSByZXR1cm4gJ2RiOi8vYXNzZXRzJztcclxuICAgIGxldCBwYXRoID0gcC5yZXBsYWNlKC9cXFxcL2csICcvJykudHJpbSgpO1xyXG5cclxuICAgIC8vIEhhbmRsZSBkYjovLyBwcm90b2NvbFxyXG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnZGI6Ly8nKSkge1xyXG4gICAgICAgIHJldHVybiBwYXRoLmVuZHNXaXRoKCcvJykgJiYgcGF0aCAhPT0gJ2RiOi8vJyA/IHBhdGguc2xpY2UoMCwgLTEpIDogcGF0aDtcclxuICAgIH1cclxuXHJcbiAgICAvLyBSZW1vdmUgbGVhZGluZyBzbGFzaFxyXG4gICAgaWYgKHBhdGguc3RhcnRzV2l0aCgnLycpKSB7XHJcbiAgICAgICAgcGF0aCA9IHBhdGguc2xpY2UoMSk7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSGFuZGxlIHJvb3QgYWxpYXNlc1xyXG4gICAgaWYgKHBhdGggPT09ICcnIHx8IHBhdGggPT09ICdhc3NldHMnKSB7XHJcbiAgICAgICAgcmV0dXJuICdkYjovL2Fzc2V0cyc7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSGFuZGxlICdhc3NldHMvJyBwcmVmaXhcclxuICAgIGlmIChwYXRoLnN0YXJ0c1dpdGgoJ2Fzc2V0cy8nKSkge1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9ICdkYjovLycgKyBwYXRoO1xyXG4gICAgICAgIHJldHVybiByZXN1bHQuZW5kc1dpdGgoJy8nKSA/IHJlc3VsdC5zbGljZSgwLCAtMSkgOiByZXN1bHQ7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gVHJlYXQgYXMgcmVsYXRpdmUgcGF0aCB1bmRlciBhc3NldHNcclxuICAgIGlmIChwYXRoLmVuZHNXaXRoKCcvJykpIHtcclxuICAgICAgICBwYXRoID0gcGF0aC5zbGljZSgwLCAtMSk7XHJcbiAgICB9XHJcblxyXG4gICAgcmV0dXJuIGBkYjovL2Fzc2V0cy8ke3BhdGh9YDtcclxufVxyXG5cclxuZXhwb3J0IGNsYXNzIEFzc2V0VG9vbHMge1xyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICAnYXNzZXRHZXRUcmVlJyxcclxuICAgICAgICAnR2V0IHRoZSBhc3NldCBhbmQgc3ViQXNzZXQgaGllcmFyY2h5IHRyZWUuIENoaWxkcmVuIGhhdmUgcmVjdXJzaXZlIHN0cnVjdHVyZS4nLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsXHJcbiAgICAgICAgICAgICAgICBhc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycsIGRlc2NyaXB0aW9uOiAnUm9vdCBwYXRoIHRvIHN0YXJ0IGZyb20nIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgQXNzZXRUcmVlSXRlbVNjaGVtYSwgXCJHRVRcIiwgWydhc3NldCcsICdmaWxlJywgJ3RyZWUnLCAnaGllcmFyY2h5JywgJ2ZvbGRlcicsICdzdWJhc3NldCddXHJcbiAgICApXHJcbiAgICBhc3luYyBhc3NldEdldFRyZWUoYXJnczogeyByZWZlcmVuY2U/OiBJSW5zdGFuY2VSZWZlcmVuY2UsIGFzc2V0UGF0aD86IHN0cmluZyB9KTogUHJvbWlzZTxJQXNzZXRUcmVlSXRlbT4ge1xyXG4gICAgICAgIGlmIChhcmdzLnJlZmVyZW5jZSkge1xyXG4gICAgICAgICAgICBjb25zdCBpbmZvID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtaW5mbycsIGFyZ3MucmVmZXJlbmNlLmlkKTtcclxuICAgICAgICAgICAgaWYgKCFpbmZvKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2V0IHdpdGggVVVJRCAke2FyZ3MucmVmZXJlbmNlLmlkfSBub3QgZm91bmQuYCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgYXJncy5hc3NldFBhdGggPSBpbmZvLnVybDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCByb290UGF0aCA9IG5vcm1hbGl6ZVBhdGgoYXJncy5hc3NldFBhdGgpO1xyXG5cclxuICAgICAgICBjb25zdCBwYXR0ZXJuID0gYCR7cm9vdFBhdGh9LyoqYDtcclxuICAgICAgICBjb25zdCBhc3NldHMgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldHMnLCB7IHBhdHRlcm4gfSk7XHJcbiAgICAgICAgY29uc3Qgcm9vdFV1aWQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS11dWlkJywgcm9vdFBhdGgpO1xyXG5cclxuICAgICAgICBjb25zdCBhc3NldHNNYXAgPSBuZXcgTWFwPHN0cmluZywgSUFzc2V0VHJlZUl0ZW0+KCk7XHJcblxyXG4gICAgICAgIC8vIENyZWF0ZSBSb290IE5vZGUgZmlyc3RcclxuICAgICAgICBjb25zdCByb290TmFtZSA9IHJvb3RQYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgJ2Fzc2V0cyc7XHJcbiAgICAgICAgY29uc3Qgcm9vdE5vZGU6IElBc3NldFRyZWVJdGVtID0ge1xyXG4gICAgICAgICAgICBmaWxlc3lzdGVtUGF0aDogRWRpdG9yLlByb2plY3QucGF0aCArICcvJyArIHJvb3RQYXRoLnJlcGxhY2UoJ2RiOi8vJywgJycpLFxyXG4gICAgICAgICAgICByZWZlcmVuY2U6IHsgaWQ6IHJvb3RVdWlkIHx8ICdyb290JywgdHlwZTogJ2ZvbGRlcicgfSxcclxuICAgICAgICAgICAgbmFtZTogcm9vdE5hbWUsXHJcbiAgICAgICAgICAgIGNoaWxkcmVuOiBbXVxyXG4gICAgICAgIH07XHJcbiAgICAgICAgYXNzZXRzTWFwLnNldChyb290UGF0aCwgcm9vdE5vZGUpO1xyXG5cclxuICAgICAgICAvLyBGaXJzdCBwYXNzOiBNYXAgYXNzZXRzXHJcbiAgICAgICAgYXNzZXRzLmZvckVhY2goKGFzc2V0OiBhbnkpID0+IHtcclxuICAgICAgICAgICAgaWYgKGFzc2V0LnVybCA9PT0gcm9vdFBhdGgpIHJldHVybjsgLy8gU2tpcCByb290LCBhbHJlYWR5IGNyZWF0ZWRcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHR5cGUgPSBhc3NldC5pc0RpcmVjdG9yeSA/ICdmb2xkZXInIDogYXNzZXQudHlwZTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHRyZWVJdGVtOiBJQXNzZXRUcmVlSXRlbSA9IHtcclxuICAgICAgICAgICAgICAgIHJlZmVyZW5jZTogeyBpZDogYXNzZXQudXVpZCwgdHlwZTogdHlwZSB9LFxyXG4gICAgICAgICAgICAgICAgbmFtZTogYXNzZXQubmFtZSxcclxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBbXVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgYXNzZXRzTWFwLnNldChhc3NldC51cmwsIHRyZWVJdGVtKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8gU2Vjb25kIHBhc3M6IEJ1aWxkIGhpZXJhcmNoeVxyXG4gICAgICAgIGFzc2V0cy5mb3JFYWNoKChhc3NldDogYW55KSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChhc3NldC51cmwgPT09IHJvb3RQYXRoKSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICBjb25zdCB0cmVlSXRlbSA9IGFzc2V0c01hcC5nZXQoYXNzZXQudXJsKTtcclxuICAgICAgICAgICAgaWYgKCF0cmVlSXRlbSkgcmV0dXJuO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcGFyZW50VXJsID0gYXNzZXQudXJsLnN1YnN0cmluZygwLCBhc3NldC51cmwubGFzdEluZGV4T2YoJy8nKSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudEl0ZW0gPSBhc3NldHNNYXAuZ2V0KHBhcmVudFVybCk7XHJcblxyXG4gICAgICAgICAgICBpZiAocGFyZW50SXRlbSkge1xyXG4gICAgICAgICAgICAgICAgcGFyZW50SXRlbS5jaGlsZHJlbi5wdXNoKHRyZWVJdGVtKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICByZXR1cm4gcm9vdE5vZGU7XHJcbiAgICB9XHJcblxyXG4gICAgQHV0Y3BUb29sKFxyXG4gICAgICAgICdhc3NldEdldEF0UGF0aCcsXHJcbiAgICAgICAgJ0dldCBhc3NldCByZWZlcmVuY2UgYnkgZ2l2ZW4gbG9jYWwgcGF0aCBhbmQgbmFtZSwgaW5jbHVkaW5nIGV4dGVuc2lvbi4gQ2FuIGJlIHVzZWQgZm9yIHN1YmFzc2V0cyB0b28uIFJldHVybnMgcmVmZXJlbmNlIHRvIHRoZSBhc3NldC4nLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIGFzc2V0UGF0aDogeyB0eXBlOiAnc3RyaW5nJyB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ2Fzc2V0UGF0aCddXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEgfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ10gfSwgXCJHRVRcIiwgWydhc3NldCcsICdnZXQnLCAncGF0aCcsICdsb29rJywgJ2ZpbmQnXVxyXG4gICAgKVxyXG4gICAgYXN5bmMgYXNzZXRHZXRBdFBhdGgoYXJnczogeyBhc3NldFBhdGg6IHN0cmluZyB9KTogUHJvbWlzZTx7IHJlZmVyZW5jZTogSUluc3RhbmNlUmVmZXJlbmNlIH0+IHtcclxuICAgICAgICBsZXQgdGFyZ2V0UGF0aCA9IG5vcm1hbGl6ZVBhdGgoYXJncy5hc3NldFBhdGgpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZyhgTG9va2luZyBmb3IgYXNzZXQgYXQgcGF0aDogJHt0YXJnZXRQYXRofWApO1xyXG5cclxuICAgICAgICBjb25zdCBhc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdGFyZ2V0UGF0aCk7XHJcbiAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBBc3NldCBub3QgZm91bmQgYXQgcGF0aDogJHt0YXJnZXRQYXRofWApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHJlZmVyZW5jZTogeyBpZDogYXNzZXRJbmZvLnV1aWQsIHR5cGU6IGFzc2V0SW5mby50eXBlIH0gfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgQHV0Y3BUb29sKFxyXG4gICAgICAgICdhc3NldENyZWF0ZScsXHJcbiAgICAgICAgJ0NyZWF0ZSBlbXB0eSBhc3NldCBvciBmb2xkZXIgb2YgZ2l2ZW4gdHlwZS4gQXV0b21hdGljYWxseSBoYW5kbGVzIGZvbGRlcnMgY3JlYXRpb24gYWxvbmcgdGhlIHBhdGguIFJldHVybnMgcmVmZXJlbmNlIHRvIHRoZSBuZXcgYXNzZXQuJyxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICBhc3NldFBhdGg6IHsgdHlwZTogJ3N0cmluZycgfSxcclxuICAgICAgICAgICAgICAgIHByZXNldDoge1xyXG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdzdHJpbmcnLFxyXG4gICAgICAgICAgICAgICAgICAgIGVudW06IFtcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2ZvbGRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdtYXRlcmlhbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdlZmZlY3QnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnc2NlbmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAncHJlZmFiJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3R5cGVzY3JpcHQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnYW5pbWF0aW9uLWNsaXAnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAncmVuZGVyLXRleHR1cmUnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAncGh5c2ljcy1tYXRlcmlhbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdhbmltYXRpb24tZ3JhcGgnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnYW5pbWF0aW9uLWdyYXBoLXZhcmlhbnQnLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnYW5pbWF0aW9uLW1hc2snLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnYXV0by1hdGxhcycsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICdlZmZlY3QtaGVhZGVyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ2xhYmVsLWF0bGFzJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgJ3RlcnJhaW4nXHJcbiAgICAgICAgICAgICAgICAgICAgXSxcclxuICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogJ1ByZXNldCB0eXBlIGZvciB0aGUgbmV3IGFzc2V0J1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG9wdGlvbnM6IHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgb3ZlcndyaXRlOiB7IHR5cGU6ICdib29sZWFuJyB9LCByZW5hbWU6IHsgdHlwZTogJ2Jvb2xlYW4nIH0gfSwgZGVzY3JpcHRpb246ICdBZGRpdGlvbmFsIG9wdGlvbnMgZm9yIHRoZSBvcGVyYXRpb24nLCBudWxsYWJsZTogdHJ1ZSB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICByZXF1aXJlZDogWydhc3NldFBhdGgnLCAncHJlc2V0J11cclxuICAgICAgICB9LFxyXG4gICAgICAgIHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSB9LCByZXF1aXJlZDogWydyZWZlcmVuY2UnXSB9LCBcIlBPU1RcIiwgWydhc3NldCcsICdjcmVhdGUnLCAnbmV3JywgJ3ByZXNldCcsICdmb2xkZXInLCAndHlwZXNjcmlwdCddXHJcbiAgICApXHJcbiAgICBhc3luYyBhc3NldENyZWF0ZShhcmdzOiB7IGFzc2V0UGF0aDogc3RyaW5nOyBwcmVzZXQ6IHN0cmluZzsgb3B0aW9ucz86IHsgb3ZlcndyaXRlPzogYm9vbGVhbiwgcmVuYW1lPzogYm9vbGVhbiB9IH0pOiBQcm9taXNlPHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UgfT4ge1xyXG4gICAgICAgIGxldCB0YXJnZXRQYXRoID0gbm9ybWFsaXplUGF0aChhcmdzLmFzc2V0UGF0aCk7XHJcblxyXG4gICAgICAgIC8vIE1hcCAncHJlc2V0JyBmcm9tIHNjaGVtYSB0byAndHlwZScgZXhwZWN0ZWQgYnkgZnVuY3Rpb25cclxuICAgICAgICBjb25zdCB0eXBlID0gYXJncy5wcmVzZXQ7XHJcbiAgICAgICAgY29uc3QgcHJlc2V0TWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xyXG4gICAgICAgICAgICAnbWF0ZXJpYWwnOiAnZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X2ZpbGVfY29udGVudC9tYXRlcmlhbC9kZWZhdWx0Lm10bCcsXHJcbiAgICAgICAgICAgICdlZmZlY3QnOiAnZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X2ZpbGVfY29udGVudC9lZmZlY3QvZGVmYXVsdC5lZmZlY3QnLFxyXG4gICAgICAgICAgICAnc2NlbmUnOiAnZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X2ZpbGVfY29udGVudC9zY2VuZS9kZWZhdWx0LnNjZW5lJyxcclxuICAgICAgICAgICAgJ3ByZWZhYic6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L3ByZWZhYi9kZWZhdWx0LnByZWZhYicsXHJcbiAgICAgICAgICAgICdhbmltYXRpb24tY2xpcCc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2FuaW1hdGlvbi1jbGlwL2RlZmF1bHQuYW5pbScsXHJcbiAgICAgICAgICAgICdyZW5kZXItdGV4dHVyZSc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L3JlbmRlci10ZXh0dXJlL2RlZmF1bHQucnQnLFxyXG4gICAgICAgICAgICAncGh5c2ljcy1tYXRlcmlhbCc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L3BoeXNpY3MtbWF0ZXJpYWwvZGVmYXVsdC5wbXRsJyxcclxuICAgICAgICAgICAgJ2FuaW1hdGlvbi1ncmFwaCc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2FuaW1hdGlvbi1ncmFwaC9kZWZhdWx0LmFuaW1ncmFwaCcsXHJcbiAgICAgICAgICAgICdhbmltYXRpb24tZ3JhcGgtdmFyaWFudCc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2FuaW1hdGlvbi1ncmFwaC12YXJpYW50L2RlZmF1bHQuYW5pbWdyYXBodmFyaScsXHJcbiAgICAgICAgICAgICdhbmltYXRpb24tbWFzayc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2FuaW1hdGlvbi1tYXNrL2RlZmF1bHQuYW5pbWFzaycsXHJcbiAgICAgICAgICAgICdhdXRvLWF0bGFzJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvYXV0by1hdGxhcy9kZWZhdWx0LnBhYycsXHJcbiAgICAgICAgICAgICdlZmZlY3QtaGVhZGVyJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvZWZmZWN0LWhlYWRlci9jaHVuaycsXHJcbiAgICAgICAgICAgICdsYWJlbC1hdGxhcyc6ICdkYjovL2ludGVybmFsL2RlZmF1bHRfZmlsZV9jb250ZW50L2xhYmVsLWF0bGFzL2RlZmF1bHQubGFiZWxhdGxhcycsXHJcbiAgICAgICAgICAgICd0ZXJyYWluJzogJ2RiOi8vaW50ZXJuYWwvZGVmYXVsdF9maWxlX2NvbnRlbnQvdGVycmFpbi9kZWZhdWx0LnRlcnJhaW4nXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY29uc3QgYXNzZXRPcHRpb25zOiBBc3NldE9wZXJhdGlvbk9wdGlvbiA9IHtcclxuICAgICAgICAgICAgb3ZlcndyaXRlOiBhcmdzLm9wdGlvbnM/Lm92ZXJ3cml0ZSA/PyBmYWxzZSxcclxuICAgICAgICAgICAgcmVuYW1lOiBhcmdzLm9wdGlvbnM/LnJlbmFtZSA/PyBmYWxzZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGlmICh0eXBlID09PSAnZm9sZGVyJyB8fCB0eXBlID09PSAndHlwZXNjcmlwdCcpIHtcclxuICAgICAgICAgICAgbGV0IGNvbnRlbnQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ3R5cGVzY3JpcHQnKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjdXJyZW50RXh0TmFtZSA9IGV4dG5hbWUodGFyZ2V0UGF0aCk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudEV4dE5hbWUgIT09ICcudHMnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGF0aCA9IGN1cnJlbnRFeHROYW1lID8gdGFyZ2V0UGF0aC5zbGljZSgwLCAtY3VycmVudEV4dE5hbWUubGVuZ3RoKSA6IHRhcmdldFBhdGg7XHJcbiAgICAgICAgICAgICAgICAgICAgdGFyZ2V0UGF0aCArPSAnLnRzJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbnN0IGNsYXNzTmFtZSA9IGJhc2VuYW1lKHRhcmdldFBhdGguc2xpY2UoJ2RiOi8vJy5sZW5ndGgpLCAnLnRzJyk7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50ID0gdGhpcy5nZW5lcmF0ZVR5cGVzY3JpcHRDbGFzc1RlbXBsYXRlKGNsYXNzTmFtZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NyZWF0ZS1hc3NldCcsIHRhcmdldFBhdGgsIGNvbnRlbnQsIGFzc2V0T3B0aW9ucyk7XHJcbiAgICAgICAgICAgIGlmICghcmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgZm9sZGVyIGF0ICR7dGFyZ2V0UGF0aH1gKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHJlZmVyZW5jZTogeyBpZDogcmVzdWx0LnV1aWQsIHR5cGU6IHR5cGUgfSB9O1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzb3VyY2UgPSBwcmVzZXRNYXBbdHlwZV07XHJcbiAgICAgICAgaWYgKCFzb3VyY2UpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFzc2V0IHByZXNldCB0eXBlOiAke3R5cGV9YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZXh0bmFtZSh0YXJnZXRQYXRoKSA9PT0gJycgJiYgdHlwZSAhPT0gJ2ZvbGRlcicpIHtcclxuICAgICAgICAgICAgdGFyZ2V0UGF0aCArPSB0eXBlID09ICdjaHVuaycgPyAnLmNodW5rJyA6IGV4dG5hbWUocHJlc2V0TWFwW3R5cGVdKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2NvcHktYXNzZXQnLCBzb3VyY2UsIHRhcmdldFBhdGgsIGFzc2V0T3B0aW9ucyk7XHJcbiAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gY3JlYXRlIGFzc2V0IGF0ICR7dGFyZ2V0UGF0aH1gKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4geyByZWZlcmVuY2U6IHsgaWQ6IGFzc2V0SW5mby51dWlkLCB0eXBlOiBhc3NldEluZm8udHlwZSB9IH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICAnYXNzZXRJbXBvcnQnLFxyXG4gICAgICAgICdJbXBvcnQgYW4gZXh0ZXJuYWwgZmlsZSBhcyBhbiBhc3NldCBpbnRvIHRoZSBwcm9qZWN0LiBQYXRoIG11c3QgZW5kIHdpdGggdGhlIGV4dGVuc2lvbi4gUmV0dXJucyByZWZlcmVuY2UgdG8gdGhlIG5ldyBhc3NldC4nLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIHNvdXJjZUZpbGVzeXN0ZW1QYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1NvdXJjZSBmaWxlc3lzdGVtIHBhdGggb2YgdGhlIGZpbGUgdG8gaW1wb3J0JyB9LFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0QXNzZXRQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1RhcmdldCBwYXRoIGluIHRoZSBhc3NldCBkYXRhYmFzZScgfSxcclxuICAgICAgICAgICAgICAgIGltYWdlVHlwZTogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogWydyYXcnLCAndGV4dHVyZScsICdub3JtYWwtbWFwJywgJ3Nwcml0ZS1mcmFtZScsICd0ZXh0dXJlLWN1YmUnXSwgZGVzY3JpcHRpb246ICdGb3IgaW1hZ2UgZmlsZXMsIHNwZWNpZnkgaG93IHRvIGltcG9ydCB0aGVtJyB9LFxyXG4gICAgICAgICAgICAgICAgb3B0aW9uczogeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyBvdmVyd3JpdGU6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sIHJlbmFtZTogeyB0eXBlOiAnYm9vbGVhbicgfSB9LCBkZXNjcmlwdGlvbjogJ0FkZGl0aW9uYWwgb3B0aW9ucyBmb3IgdGhlIG9wZXJhdGlvbicgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnc291cmNlRmlsZXN5c3RlbVBhdGgnLCAndGFyZ2V0QXNzZXRQYXRoJ11cclxuICAgICAgICB9LFxyXG4gICAgICAgIHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSB9LCByZXF1aXJlZDogWydyZWZlcmVuY2UnXSB9LCBcIlBPU1RcIiwgWydhc3NldCcsICdpbXBvcnQnLCAnZmlsZScsICdleHRlcm5hbCcsICdpbWFnZSddXHJcbiAgICApXHJcbiAgICBhc3luYyBhc3NldEltcG9ydChhcmdzOiB7IHNvdXJjZUZpbGVzeXN0ZW1QYXRoOiBzdHJpbmcsIHRhcmdldEFzc2V0UGF0aDogc3RyaW5nLCBpbWFnZVR5cGU/OiAncmF3JyB8ICd0ZXh0dXJlJyB8ICdub3JtYWwtbWFwJyB8ICdzcHJpdGUtZnJhbWUnIHwgJ3RleHR1cmUtY3ViZScsIG9wdGlvbnM/OiB7IG92ZXJ3cml0ZT86IGJvb2xlYW4sIHJlbmFtZT86IGJvb2xlYW4gfSB9KTogUHJvbWlzZTx7IHJlZmVyZW5jZTogSUluc3RhbmNlUmVmZXJlbmNlIH0+IHtcclxuICAgICAgICBsZXQgdGFyZ2V0UGF0aCA9IG5vcm1hbGl6ZVBhdGgoYXJncy50YXJnZXRBc3NldFBhdGgpO1xyXG5cclxuICAgICAgICBjb25zdCBhc3NldE9wdGlvbnM6IEFzc2V0T3BlcmF0aW9uT3B0aW9uID0ge1xyXG4gICAgICAgICAgICBvdmVyd3JpdGU6IGFyZ3Mub3B0aW9ucz8ub3ZlcndyaXRlID8/IGZhbHNlLFxyXG4gICAgICAgICAgICByZW5hbWU6IGFyZ3Mub3B0aW9ucz8ucmVuYW1lID8/IGZhbHNlXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgLy8gQWRkaXRpb25hbCByZXNvbHZpbmcgZm9yIGFic29sdXRlIHBhdGhcclxuICAgICAgICBpZiAoYXJncy5zb3VyY2VGaWxlc3lzdGVtUGF0aC5zdGFydHNXaXRoKCd+JykpIHtcclxuICAgICAgICAgICAgYXJncy5zb3VyY2VGaWxlc3lzdGVtUGF0aCA9IHBhdGguam9pbihvcy5ob21lZGlyKCksIGFyZ3Muc291cmNlRmlsZXN5c3RlbVBhdGguc2xpY2UoMSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBhcmdzLnNvdXJjZUZpbGVzeXN0ZW1QYXRoID0gcGF0aC5yZXNvbHZlKGFyZ3Muc291cmNlRmlsZXN5c3RlbVBhdGgpO1xyXG4gICAgICAgIGFyZ3Muc291cmNlRmlsZXN5c3RlbVBhdGggPSBhd2FpdCBmcy5yZWFscGF0aChhcmdzLnNvdXJjZUZpbGVzeXN0ZW1QYXRoKTtcclxuXHJcbiAgICAgICAgLy8gQ2hlY2tpbmcgZm9yIGV4aXN0aW5nIGFzc2V0IGF0IHRhcmdldCBwYXRoXHJcbiAgICAgICAgbGV0IGV4aXN0aW5nQXNzZXRJbmZvOiBBc3NldEluZm8gfCBudWxsID0gbnVsbDtcclxuICAgICAgICAvLyBJZiBjYWxsZXIgdHJpZXMgdG8gaW1wb3J0IHRoZSBzYW1lIGZpbGUgaW4gYXNzZXRzIC0ganVzdCByZWltcG9ydFxyXG4gICAgICAgIGlmIChgJHtFZGl0b3IuUHJvamVjdC5wYXRofSR7dGFyZ2V0UGF0aC5zbGljZSgnZGI6LycubGVuZ3RoKX1gID09PSBhcmdzLnNvdXJjZUZpbGVzeXN0ZW1QYXRoKSB7XHJcbiAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3JlZnJlc2gtYXNzZXQnLCB0YXJnZXRQYXRoKTtcclxuICAgICAgICAgICAgZXhpc3RpbmdBc3NldEluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdxdWVyeS1hc3NldC1pbmZvJywgdGFyZ2V0UGF0aCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBhc3NldEluZm8gPSBleGlzdGluZ0Fzc2V0SW5mbyA/IGV4aXN0aW5nQXNzZXRJbmZvIDpcclxuICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnaW1wb3J0LWFzc2V0JywgYXJncy5zb3VyY2VGaWxlc3lzdGVtUGF0aCwgdGFyZ2V0UGF0aCwgYXNzZXRPcHRpb25zKTtcclxuICAgICAgICBpZiAoIWFzc2V0SW5mbykge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBpbXBvcnQgYXNzZXQgdG8gJHt0YXJnZXRQYXRofWApO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmIChhc3NldEluZm8uZXh0ZW5kcyAmJiBhc3NldEluZm8uaW1wb3J0ZXIgPT09ICdpbWFnZScgJiYgYXJncy5pbWFnZVR5cGUpIHtcclxuICAgICAgICAgICAgICAgIC8vIEhhbmRsZSBpbWFnZSB0eXBlIG92ZXJyaWRlXHJcbiAgICAgICAgICAgICAgICBjb25zdCBtZXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktYXNzZXQtbWV0YScsIGFzc2V0SW5mby51dWlkKTtcclxuICAgICAgICAgICAgICAgIGlmIChtZXRhICYmIG1ldGEudXNlckRhdGEpIHtcclxuICAgICAgICAgICAgICAgICAgICBsZXQgdHlwZVRvU2V0OiBzdHJpbmcgPSBhcmdzLmltYWdlVHlwZTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZVRvU2V0ID09PSAnbm9ybWFsLW1hcCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZVRvU2V0ID0gJ25vcm1hbCBtYXAnO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodHlwZVRvU2V0ID09PSAndGV4dHVyZS1jdWJlJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlVG9TZXQgPSAndGV4dHVyZSBjdWJlJztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgbWV0YS51c2VyRGF0YS50eXBlID0gdHlwZVRvU2V0O1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3NhdmUtYXNzZXQtbWV0YScsIGFzc2V0SW5mby51dWlkLCBKU09OLnN0cmluZ2lmeShtZXRhKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiB7IHJlZmVyZW5jZTogeyBpZDogYXNzZXRJbmZvLnV1aWQsIHR5cGU6IGFzc2V0SW5mby50eXBlIH0gfTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgQHV0Y3BUb29sKFxyXG4gICAgICAgICdhc3NldE9wZXJhdGUnLFxyXG4gICAgICAgICdQZXJmb3JtIG9wZXJhdGlvbnMgb24gYXNzZXRzIChtb3ZlLCBjb3B5LCBkZWxldGUsIG9wZW4pLiBSZXR1cm5zIHJlZmVyZW5jZSB0byB0aGUgYWZmZWN0ZWQgYXNzZXQgKGZvciBkZWxldGUvb3BlbiByZXR1cm5zIHRoZSBzb3VyY2UgYXNzZXQgcmVmZXJlbmNlKS4nLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIG9wZXJhdGlvbjogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogWydtb3ZlJywgJ2NvcHknLCAnZGVsZXRlJywgJ29wZW4nLCAncmVmcmVzaCcsICdyZWltcG9ydCddIH0sXHJcbiAgICAgICAgICAgICAgICByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLFxyXG4gICAgICAgICAgICAgICAgdGFyZ2V0QXNzZXRQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ1RhcmdldCBwYXRoIChmb3IgbW92ZS9jb3B5L2ltcG9ydCknIH0sXHJcbiAgICAgICAgICAgICAgICBvcHRpb25zOiB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IG92ZXJ3cml0ZTogeyB0eXBlOiAnYm9vbGVhbicgfSwgcmVuYW1lOiB7IHR5cGU6ICdib29sZWFuJyB9IH0sIGRlc2NyaXB0aW9uOiAnQWRkaXRpb25hbCBvcHRpb25zIGZvciB0aGUgb3BlcmF0aW9uJywgbnVsbGFibGU6IHRydWUgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnb3BlcmF0aW9uJywgJ3JlZmVyZW5jZSddXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IHJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEgfSwgcmVxdWlyZWQ6IFsncmVmZXJlbmNlJ10gfSwgXCJQT1NUXCIsIFsnYXNzZXQnLCAnb3BlcmF0ZScsICdtb3ZlJywgJ2NvcHknLCAnZGVsZXRlJywgJ29wZW4nLCAncmVmcmVzaCcsICdyZWltcG9ydCddXHJcbiAgICApXHJcbiAgICBhc3luYyBhc3NldE9wZXJhdGUoYXJnczogeyBvcGVyYXRpb246IHN0cmluZywgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UsIHRhcmdldEFzc2V0UGF0aD86IHN0cmluZywgb3B0aW9ucz86IHsgb3ZlcndyaXRlPzogYm9vbGVhbiwgcmVuYW1lPzogYm9vbGVhbiB9IH0pOiBQcm9taXNlPHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UgfT4ge1xyXG4gICAgICAgIGNvbnN0IGFzc2V0T3B0aW9ucyA9IHtcclxuICAgICAgICAgICAgb3ZlcndyaXRlOiBhcmdzLm9wdGlvbnM/Lm92ZXJ3cml0ZSA/PyBmYWxzZSxcclxuICAgICAgICAgICAgcmVuYW1lOiBhcmdzLm9wdGlvbnM/LnJlbmFtZSA/PyBmYWxzZVxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGFyZ3MudGFyZ2V0QXNzZXRQYXRoID0gbm9ybWFsaXplUGF0aChhcmdzLnRhcmdldEFzc2V0UGF0aCk7XHJcbiAgICAgICAgbGV0IHJlc3VsdDogQXNzZXRJbmZvIHwgbnVsbCA9IG51bGw7XHJcblxyXG4gICAgICAgIHN3aXRjaCAoYXJncy5vcGVyYXRpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnbW92ZSc6XHJcbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MudGFyZ2V0QXNzZXRQYXRoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUYXJnZXQgaXMgcmVxdWlyZWQgZm9yIG1vdmUnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdtb3ZlLWFzc2V0JywgYXJncy5yZWZlcmVuY2UuaWQsIGFyZ3MudGFyZ2V0QXNzZXRQYXRoLCBhc3NldE9wdGlvbnMpO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcblxyXG4gICAgICAgICAgICBjYXNlICdjb3B5JzpcclxuICAgICAgICAgICAgICAgIGlmICghYXJncy50YXJnZXRBc3NldFBhdGgpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RhcmdldCBpcyByZXF1aXJlZCBmb3IgY29weScpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAnY29weS1hc3NldCcsIGFyZ3MucmVmZXJlbmNlLmlkLCBhcmdzLnRhcmdldEFzc2V0UGF0aCwgYXNzZXRPcHRpb25zKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnZGVsZXRlJzpcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ2RlbGV0ZS1hc3NldCcsIGFyZ3MucmVmZXJlbmNlLmlkKTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnb3Blbic6XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdvcGVuLWFzc2V0JywgYXJncy5yZWZlcmVuY2UuaWQpO1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG5cclxuICAgICAgICAgICAgY2FzZSAncmVmcmVzaCc6XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWZyZXNoLWFzc2V0JywgYXJncy5yZWZlcmVuY2UuaWQpO1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdyZWltcG9ydCc6XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdhc3NldC1kYicsICdyZWltcG9ydC1hc3NldCcsIGFyZ3MucmVmZXJlbmNlLmlkKTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBvcGVyYXRpb246ICR7YXJncy5vcGVyYXRpb259YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4geyByZWZlcmVuY2U6IHsgaWQ6IHJlc3VsdD8udXVpZCA/PyAnJywgdHlwZTogcmVzdWx0Py50eXBlID8/ICcnIH0gfTtcclxuICAgIH1cclxuXHJcblxyXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVR5cGVzY3JpcHRDbGFzc1RlbXBsYXRlKGNsYXNzTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gYGltcG9ydCB7IF9kZWNvcmF0b3IsIENvbXBvbmVudCwgTm9kZSB9IGZyb20gJ2NjJztcclxuY29uc3QgeyBjY2NsYXNzLCBwcm9wZXJ0eSB9ID0gX2RlY29yYXRvcjtcclxuXHJcbkBjY2NsYXNzKCcke2NsYXNzTmFtZX0nKVxyXG5leHBvcnQgY2xhc3MgJHtjbGFzc05hbWV9IGV4dGVuZHMgQ29tcG9uZW50IHtcclxuICAgIHN0YXJ0KCkge1xyXG5cclxuICAgIH1cclxuXHJcbiAgICB1cGRhdGUoZGVsdGFUaW1lOiBudW1iZXIpIHtcclxuICAgICAgICBcclxuICAgIH1cclxufWA7XHJcbiAgICB9XHJcbn0iXX0=