"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SceneTools = void 0;
const package_json_1 = __importDefault(require("../../../package.json"));
const decorators_1 = require("../decorators");
const schemas_1 = require("../schemas");
class SceneTools {
    async nodeGetTree(args) {
        var _a;
        let treeBase;
        if (args.reference) {
            treeBase = await Editor.Message.request('scene', 'query-node-tree', args.reference.id);
        }
        else {
            // Default queries the whole scene
            treeBase = await Editor.Message.request('scene', 'query-node-tree');
        }
        if (!treeBase) {
            throw new Error(`Node tree not found for ${((_a = args.reference) === null || _a === void 0 ? void 0 : _a.id) || 'entire scene'}`);
        }
        const formatNode = (node) => {
            const comps = node.components ? node.components.map((c) => ({
                reference: { id: c.value, type: c.type }
            })) : [];
            let children = [];
            children = node.children ? node.children.map(formatNode).filter((c) => c !== null) : [];
            return {
                reference: { id: node.uuid, type: 'cc.Node' },
                name: node.name,
                active: node.active,
                components: comps,
                children: children
            };
        };
        const result = formatNode(treeBase);
        result.path = treeBase.path || undefined;
        return result;
    }
    async nodeGetAtPath(args) {
        const nodeTree = await Editor.Message.request('scene', 'query-node-tree');
        if (!nodeTree) {
            throw new Error(`Scene is empty or could not retrieve scene tree.`);
        }
        const sceneRootName = nodeTree.name;
        if (args.hierarchyPath.startsWith('/')) {
            args.hierarchyPath = args.hierarchyPath.slice(1);
        }
        if (args.hierarchyPath.startsWith(`${sceneRootName}`)) {
            args.hierarchyPath = args.hierarchyPath.slice(sceneRootName.length);
        }
        if (args.hierarchyPath === '') {
            return { references: [{ id: nodeTree.uuid }] };
        }
        const pathParts = args.hierarchyPath.split('/').filter(p => p.length > 0);
        let currentNodes = [nodeTree];
        for (const part of pathParts) {
            const nextNodes = [];
            for (const node of currentNodes) {
                const matchingChildren = (node.children || []).filter((child) => child.name === part);
                nextNodes.push(...matchingChildren);
            }
            currentNodes = nextNodes;
            if (currentNodes.length === 0) {
                break;
            }
        }
        return { references: currentNodes.map((node) => ({ id: node.uuid, type: 'cc.Node' })) };
    }
    async sceneCreatePrimitiveNode(args) {
        const primitiveMap = {
            'Capsule': "db://internal/default_prefab/3d/Capsule.prefab",
            'Cone': "db://internal/default_prefab/3d/Cone.prefab",
            'Cube': "db://internal/default_prefab/3d/Cube.prefab",
            'Cylinder': "db://internal/default_prefab/3d/Cylinder.prefab",
            'Plane': "db://internal/default_prefab/3d/Plane.prefab",
            'Quad': "db://internal/default_prefab/3d/Quad.prefab",
            'Sphere': "db://internal/default_prefab/3d/Sphere.prefab",
            'Torus': "db://internal/default_prefab/3d/Torus.prefab",
        };
        if (!primitiveMap[args.primitiveType]) {
            throw new Error(`Unsupported primitive type: ${args.primitiveType}`);
        }
        const prefabUrl = primitiveMap[args.primitiveType];
        const assetUuid = await Editor.Message.request('asset-db', 'query-uuid', prefabUrl);
        if (!assetUuid) {
            throw new Error(`Failed to find asset for primitive type ${args.primitiveType} at ${prefabUrl}`);
        }
        return await this.sceneCreateNode({
            name: args.name,
            parentReference: args.parentReference,
            assetReference: { id: assetUuid, type: 'cc.Prefab' },
            unwrapPrefab: true
        });
    }
    async sceneCreateNode(args) {
        const options = {
            name: args.name
        };
        if (args.parentReference) {
            options.parent = args.parentReference.id;
        }
        else {
            // Force root if no parent provided
            options.parent = (await Editor.Message.request('scene', 'query-node-tree')).uuid;
        }
        let assetUuid = null;
        // 1. Determine Asset UUID
        if ((args.assetReference && 'id' in args.assetReference)) {
            const assetInfo = await Editor.Message.request('asset-db', 'query-asset-info', args.assetReference.id);
            if (!assetInfo) {
                throw new Error(`Asset reference not found: ${args.assetReference.id}`);
            }
            let prefabFound = assetInfo.type === 'cc.Prefab';
            // If not a prefab, check if it has a prefab sub-asset (like in case of FBX)
            if (!prefabFound) {
                for (let subAsset of Object.values(assetInfo.subAssets)) {
                    if (subAsset.type === 'cc.Prefab') {
                        assetUuid = subAsset.uuid;
                        prefabFound = true;
                        break;
                    }
                }
            }
            else {
                assetUuid = assetInfo.uuid;
            }
            if (!prefabFound) {
                throw new Error(`Provided asset reference ${args.assetReference.id} is not a prefab and does not contain a prefab sub-asset.`);
            }
            else {
                if (!args.unwrapPrefab) {
                    options.unlinkPrefab = false;
                    options.type = 'cc.Prefab';
                }
            }
        }
        if (assetUuid) {
            options.assetUuid = assetUuid;
        }
        // 2. Create Node
        const result = await Editor.Message.request('scene', 'create-node', options);
        const newNodeUuid = Array.isArray(result) ? result[0] : result;
        if (!newNodeUuid) {
            throw new Error(`Failed to create node ${args.name}${args.assetReference ? ` from asset ${args.assetReference.id}` : ''}.`);
        }
        await Editor.Message.request('scene', 'snapshot');
        return { reference: { id: newNodeUuid, type: 'cc.Node' } };
    }
    async nodeOperate(args) {
        if (await Editor.Message.request('scene', 'query-node', args.reference.id) === null) {
            throw new Error(`Target node ${args.reference.id} not found`);
        }
        switch (args.operation) {
            case 'move':
                if (!args.newParentReference) {
                    throw new Error("newParentReference required for move");
                }
                await Editor.Message.request('scene', 'set-parent', {
                    parent: args.newParentReference.id,
                    uuids: args.reference.id,
                    keepWorldTransform: true
                });
                if (args.siblingIndex !== undefined) {
                    await this.setSiblingIndex(args.reference.id, args.siblingIndex);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'copy':
                const duplicateResult = await Editor.Message.request('scene', 'duplicate-node', [args.reference.id]);
                if (!duplicateResult || duplicateResult.length === 0) {
                    throw new Error(`Node ${args.reference.id} duplication failed`);
                }
                const newNodes = duplicateResult;
                const newNodeId = newNodes[0];
                if (args.newParentReference) {
                    await Editor.Message.request('scene', 'set-parent', {
                        parent: args.newParentReference.id,
                        uuids: newNodes,
                        keepWorldTransform: true
                    });
                }
                if (args.siblingIndex !== undefined) {
                    await this.setSiblingIndex(newNodeId, args.siblingIndex);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true, copiedNodeReference: { id: newNodeId, type: 'cc.Node' } };
            case 'delete':
                await Editor.Message.request('scene', 'remove-node', {
                    uuid: args.reference.id
                });
                const nodeCheck = await Editor.Message.request('scene', 'query-node', args.reference.id);
                if (nodeCheck !== null && nodeCheck !== undefined) {
                    throw new Error(`Node ${args.reference.id} still exists after removal`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'create_prefab':
                if (!args.newPrefabPath) {
                    throw new Error("newPrefabPath required for create_prefab");
                }
                const parentInfo = await this.getParentAndSiblingIndex(args.reference.id);
                const createdPrefabUuid = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'createPrefabFromNode',
                    args: [args.reference.id, args.newPrefabPath]
                });
                if (!createdPrefabUuid) {
                    throw new Error("Failed to create prefab asset.");
                }
                const updatedNodeId = await this.getUpdatedUuid(parentInfo.parentUuid, parentInfo.siblingIndex);
                await Editor.Message.request('scene', 'snapshot');
                return { success: true, createdPrefabAssetReference: { id: createdPrefabUuid, type: 'cc.Prefab' }, updatedNodeReference: { id: updatedNodeId, type: 'cc.Node' } };
            case 'revert_prefab':
                const revertSuccess = await Editor.Message.request('scene', 'restore-prefab', { uuid: args.reference.id });
                await Editor.Message.request('scene', 'snapshot');
                return { success: revertSuccess };
            case 'apply_prefab':
                const applyError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'applyPrefabByNode',
                    args: [args.reference.id]
                });
                if (applyError != null) {
                    throw new Error(`Failed to apply prefab: ${applyError}`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'unwrap_prefab':
                const unwrapError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'unlinkPrefabByNode',
                    args: [args.reference.id, false]
                });
                if (unwrapError != null) {
                    throw new Error(`Failed to unwrap prefab: ${unwrapError}`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'unwrap_prefab_completely':
                const unwrapAllError = await Editor.Message.request('scene', 'execute-scene-script', {
                    name: package_json_1.default.name,
                    method: 'unlinkPrefabByNode',
                    args: [args.reference.id, true]
                });
                if (unwrapAllError != null) {
                    throw new Error(`Failed to unwrap prefab completely: ${unwrapAllError}`);
                }
                await Editor.Message.request('scene', 'snapshot');
                return { success: true };
            case 'open_prefab':
                const nodeForPrefab = await Editor.Message.request('scene', 'query-node', args.reference.id);
                if (!nodeForPrefab) {
                    throw new Error(`Node ${args.reference.id} not found`);
                }
                const pInfo = nodeForPrefab.__prefab__ || nodeForPrefab._prefab || (nodeForPrefab.value && (nodeForPrefab.value.__prefab__ || nodeForPrefab.value._prefab));
                const pValue = (pInfo === null || pInfo === void 0 ? void 0 : pInfo.value) || pInfo;
                const targetUuid = (pValue === null || pValue === void 0 ? void 0 : pValue.assetUuid) || (pValue === null || pValue === void 0 ? void 0 : pValue.uuid);
                if (!targetUuid) {
                    throw new Error(`Node ${args.reference.id} is not linked to a prefab`);
                }
                try {
                    await Editor.Message.request('asset-db', 'open-asset', targetUuid);
                }
                catch (error) {
                    throw new Error(`Failed to open prefab asset ${targetUuid}. Reason: ${(error === null || error === void 0 ? void 0 : error.message) || error}`);
                }
                return { success: true };
            default:
                throw new Error(`Unknown scene node operation: ${args.operation}`);
        }
    }
    // Helpers
    async getParent(nodeUuid) {
        var _a, _b, _c;
        const node = await Editor.Message.request('scene', 'query-node', nodeUuid);
        if ((_b = (_a = node === null || node === void 0 ? void 0 : node.parent) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.uuid)
            return node.parent.value.uuid;
        if ((_c = node === null || node === void 0 ? void 0 : node.parent) === null || _c === void 0 ? void 0 : _c.uuid)
            return node.parent.uuid;
        return await Editor.Message.request('scene', 'query-uuid');
    }
    // Helper to set sibling index
    async setSiblingIndex(uuid, index) {
        // Get parent first
        const parentUuid = await this.getParent(uuid);
        if (!parentUuid) {
            throw new Error(`Node ${uuid} has no parent`);
        }
        // Get children of parent
        const parentNode = await Editor.Message.request('scene', 'query-node', parentUuid);
        const childrenArray = parentNode.children;
        if (!childrenArray || !Array.isArray(childrenArray)) {
            throw new Error(`Parent node ${parentUuid} has no children`);
        }
        const currentIndex = childrenArray.findIndex((child) => child.value.uuid === uuid);
        if (currentIndex === -1) {
            throw new Error(`Node ${uuid} not found in parent children`);
        }
        if (currentIndex === index)
            return true;
        // Calculate offset
        // We need to move the element at currentIndex to targetIndex.
        // The API move-array-element works with offset from current position.
        // Ensure index is within bounds [0, length-1]
        const targetIndex = Math.max(0, Math.min(index, childrenArray.length - 1));
        const offset = targetIndex - currentIndex;
        if (offset === 0)
            return true;
        return await Editor.Message.request('scene', 'move-array-element', {
            uuid: parentUuid,
            path: 'children',
            target: currentIndex,
            offset: offset,
        });
    }
    async getParentAndSiblingIndex(uuid) {
        const parentUuid = await this.getParent(uuid);
        if (!parentUuid) {
            throw new Error(`Node ${uuid} has no parent`);
        }
        const parentNode = await Editor.Message.request('scene', 'query-node', parentUuid);
        const childrenArray = parentNode.children;
        if (!childrenArray || !Array.isArray(childrenArray)) {
            throw new Error(`Parent node ${parentUuid} has no children`);
        }
        const index = childrenArray.findIndex((child) => child.value.uuid === uuid);
        if (index === -1) {
            throw new Error(`Node ${uuid} not found in parent children`);
        }
        return { parentUuid, siblingIndex: index };
    }
    async getUpdatedUuid(parentUuid, siblingIndex) {
        const parentNodeInfo = await Editor.Message.request('scene', 'query-node', parentUuid);
        if (!parentNodeInfo || !parentNodeInfo.children || !Array.isArray(parentNodeInfo.children) || !parentNodeInfo.children[siblingIndex]) {
            throw new Error(`Failed to retrieve updated node info after prefab creation.`);
        }
        return parentNodeInfo.children[siblingIndex].value.uuid;
    }
}
exports.SceneTools = SceneTools;
__decorate([
    (0, decorators_1.utcpTool)('nodeGetTree', 'Get the hierarchy tree of specific node or scene root if no reference is provided. Children have recursive structure.', {
        type: 'object',
        properties: {
            reference: schemas_1.InstanceReferenceSchema
        }
    }, schemas_1.SceneTreeItemSchema, "GET", ['scene', 'graph', 'node', 'hierarchy', 'tree'])
], SceneTools.prototype, "nodeGetTree", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeGetAtPath', 'Get nodes at specific path in the scene hierarchy. Usually returns one node, but can return multiple nodes with the same name.', {
        type: 'object',
        properties: {
            hierarchyPath: { type: 'string', description: 'Path to the node in the scene hierarchy"' },
        },
        required: ['hierarchyPath']
    }, { type: 'object', properties: { references: { type: 'array', items: schemas_1.InstanceReferenceSchema } } }, "GET", ['scene', 'node', 'get', 'path', 'find', 'look', 'instance', 'hierarchy'])
], SceneTools.prototype, "nodeGetAtPath", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeCreatePrimitive', 'Create a new node with predefined primitive geometry MeshRenderer. If no parent is specified, root node is used. Returns reference to the new node.', { type: 'object',
        properties: {
            name: { type: 'string' },
            primitiveType: { type: 'string', enum: [
                    'Capsule', 'Cone', 'Cube', 'Cylinder', 'Plane', 'Quad', 'Sphere', 'Torus',
                ] },
            parentReference: schemas_1.InstanceReferenceSchema
        },
        required: ['name', 'primitiveType']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['scene', 'node', 'create', 'add'])
], SceneTools.prototype, "sceneCreatePrimitiveNode", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeCreate', 'Create a new node in the scene. If no parent is specified, root node is used. Returns reference to the new node.', {
        type: 'object',
        properties: {
            name: { type: 'string' },
            parentReference: schemas_1.InstanceReferenceSchema,
            assetReference: schemas_1.InstanceReferenceSchema,
            unwrapPrefab: { type: 'boolean', default: false }
        },
        required: ['name']
    }, { type: 'object', properties: { reference: schemas_1.InstanceReferenceSchema }, required: ['reference'] }, "POST", ['scene', 'node', 'create', 'add'])
], SceneTools.prototype, "sceneCreateNode", null);
__decorate([
    (0, decorators_1.utcpTool)('nodeOperate', 'Perform operation on referenced node, including prefab operations.', {
        type: 'object',
        properties: {
            operation: { type: 'string', enum: ['move', 'copy', 'delete', 'create_prefab', 'revert_prefab', 'apply_prefab', 'unwrap_prefab', 'unwrap_prefab_completely', 'open_prefab'] },
            reference: schemas_1.InstanceReferenceSchema,
            newParentReference: schemas_1.InstanceReferenceSchema,
            newPrefabPath: { type: 'string', description: 'For create_prefab: target db:// path', nullable: true },
            siblingIndex: { type: 'integer', description: 'For move/copy: target index in parent children array', nullable: true }
        },
        required: ['operation', 'reference']
    }, { type: 'object',
        properties: {
            success: { type: 'boolean' },
            createdPrefabAssetReference: schemas_1.InstanceReferenceSchema,
            updatedNodeReference: schemas_1.InstanceReferenceSchema,
            copiedNodeReference: schemas_1.InstanceReferenceSchema
        }
    }, "POST", ['scene', 'node', 'remove', 'move', 'copy', 'delete', 'prefab', 'apply', 'revert', 'unwrap', 'create'])
], SceneTools.prototype, "nodeOperate", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2NlbmUtdG9vbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvdXRjcC90b29scy9zY2VuZS10b29scy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSx5RUFBZ0Q7QUFDaEQsOENBQXlDO0FBQ3pDLHdDQUE4RztBQUU5RyxNQUFhLFVBQVU7SUFhYixBQUFOLEtBQUssQ0FBQyxXQUFXLENBQUMsSUFBd0M7O1FBQ3RELElBQUksUUFBUSxDQUFDO1FBQ2IsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDaEIsUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLENBQUM7UUFDNUYsQ0FBQzthQUFNLENBQUM7WUFDSCxrQ0FBa0M7WUFDbEMsUUFBUSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFDLENBQUM7UUFDekUsQ0FBQztRQUVELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMsMkJBQTJCLENBQUEsTUFBQSxJQUFJLENBQUMsU0FBUywwQ0FBRSxFQUFFLEtBQUksY0FBYyxFQUFFLENBQUMsQ0FBQztRQUN2RixDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsQ0FBQyxJQUFTLEVBQWtCLEVBQUU7WUFFOUMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7Z0JBQzdELFNBQVMsRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsSUFBSSxFQUFFO2FBQzNDLENBQUMs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LFFBQVEsRUFBRSxJQUFJLEVBQUU7WUFDdEcsWUFBWSxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsc0RBQXNELEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtTQUN6SDtRQUNELFFBQVEsRUFBRSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUM7S0FDdkMsRUFDRCxFQUFFLElBQUksRUFBRSxRQUFRO1FBQ1osVUFBVSxFQUFFO1lBQ1IsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRTtZQUM1QiwyQkFBMkIsRUFBRSxpQ0FBdUI7WUFDcEQsb0JBQW9CLEVBQUUsaUNBQXVCO1lBQzdDLG1CQUFtQixFQUFFLGlDQUF1QjtTQUMvQztLQUNKLEVBQUUsTUFBTSxFQUFHLENBQUMsT0FBTyxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUNySDs2Q0FvS0EiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcGFja2FnZUpTT04gZnJvbSAnLi4vLi4vLi4vcGFja2FnZS5qc29uJztcclxuaW1wb3J0IHsgdXRjcFRvb2wgfSBmcm9tICcuLi9kZWNvcmF0b3JzJztcclxuaW1wb3J0IHsgSVNjZW5lVHJlZUl0ZW0sIFNjZW5lVHJlZUl0ZW1TY2hlbWEsIEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLCBJSW5zdGFuY2VSZWZlcmVuY2UgfSBmcm9tICcuLi9zY2hlbWFzJztcclxuXHJcbmV4cG9ydCBjbGFzcyBTY2VuZVRvb2xzIHtcclxuXHJcbiAgICBAdXRjcFRvb2woXHJcbiAgICAgICAgJ25vZGVHZXRUcmVlJyxcclxuICAgICAgICAnR2V0IHRoZSBoaWVyYXJjaHkgdHJlZSBvZiBzcGVjaWZpYyBub2RlIG9yIHNjZW5lIHJvb3QgaWYgbm8gcmVmZXJlbmNlIGlzIHByb3ZpZGVkLiBDaGlsZHJlbiBoYXZlIHJlY3Vyc2l2ZSBzdHJ1Y3R1cmUuJyxcclxuICAgICAgICB7XHJcbiAgICAgICAgICAgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG4gICAgICAgIFNjZW5lVHJlZUl0ZW1TY2hlbWEsIFwiR0VUXCIsICBbJ3NjZW5lJywgJ2dyYXBoJywgJ25vZGUnLCAnaGllcmFyY2h5JywgJ3RyZWUnXVxyXG4gICAgKVxyXG4gICAgYXN5bmMgbm9kZUdldFRyZWUoYXJnczogeyByZWZlcmVuY2U/OiBJSW5zdGFuY2VSZWZlcmVuY2UgfSk6IFByb21pc2U8SVNjZW5lVHJlZUl0ZW0+IHtcclxuICAgICAgICBsZXQgdHJlZUJhc2U7XHJcbiAgICAgICAgaWYgKGFyZ3MucmVmZXJlbmNlKSB7XHJcbiAgICAgICAgICAgICB0cmVlQmFzZSA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUtdHJlZScsIGFyZ3MucmVmZXJlbmNlLmlkKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgLy8gRGVmYXVsdCBxdWVyaWVzIHRoZSB3aG9sZSBzY2VuZVxyXG4gICAgICAgICAgICAgdHJlZUJhc2UgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKCF0cmVlQmFzZSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgdHJlZSBub3QgZm91bmQgZm9yICR7YXJncy5yZWZlcmVuY2U/LmlkIHx8ICdlbnRpcmUgc2NlbmUnfWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZm9ybWF0Tm9kZSA9IChub2RlOiBhbnkpOiBJU2NlbmVUcmVlSXRlbSA9PiB7XHJcblxyXG4gICAgICAgICAgIGNvbnN0IGNvbXBzID0gbm9kZS5jb21wb25lbnRzID8gbm9kZS5jb21wb25lbnRzLm1hcCgoYzogYW55KSA9PiAoe1xyXG4gICAgICAgICAgICAgICByZWZlcmVuY2U6IHsgaWQ6IGMudmFsdWUsIHR5cGU6IGMudHlwZSB9XHJcbiAgICAgICAgICAgfSkpIDogW107XHJcblxyXG4gICAgICAgICAgIGxldCBjaGlsZHJlbjogSVNjZW5lVHJlZUl0ZW1bXSA9IFtdO1xyXG4gICAgICAgICAgICBjaGlsZHJlbiA9IG5vZGUuY2hpbGRyZW4gPyBub2RlLmNoaWxkcmVuLm1hcChmb3JtYXROb2RlKS5maWx0ZXIoKGM6IGFueSkgPT4gYyAhPT0gbnVsbCkgOiBbXTtcclxuXHJcbiAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHJlZmVyZW5jZTogeyBpZDogbm9kZS51dWlkLCB0eXBlOiAnY2MuTm9kZScgfSxcclxuICAgICAgICAgICAgICAgIG5hbWU6IG5vZGUubmFtZSxcclxuICAgICAgICAgICAgICAgIGFjdGl2ZTogbm9kZS5hY3RpdmUsXHJcbiAgICAgICAgICAgICAgICBjb21wb25lbnRzOiBjb21wcyxcclxuICAgICAgICAgICAgICAgIGNoaWxkcmVuOiBjaGlsZHJlblxyXG4gICAgICAgICAgIH07XHJcbiAgICAgICAgfTtcclxuICAgICAgICBcclxuICAgICAgICBjb25zdCByZXN1bHQ6IElTY2VuZVRyZWVJdGVtID0gZm9ybWF0Tm9kZSh0cmVlQmFzZSk7XHJcbiAgICAgICAgcmVzdWx0LnBhdGggPSAodHJlZUJhc2UgYXMgYW55KS5wYXRoIHx8IHVuZGVmaW5lZDtcclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfVxyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICAnbm9kZUdldEF0UGF0aCcsXHJcbiAgICAgICAgJ0dldCBub2RlcyBhdCBzcGVjaWZpYyBwYXRoIGluIHRoZSBzY2VuZSBoaWVyYXJjaHkuIFVzdWFsbHkgcmV0dXJucyBvbmUgbm9kZSwgYnV0IGNhbiByZXR1cm4gbXVsdGlwbGUgbm9kZXMgd2l0aCB0aGUgc2FtZSBuYW1lLicsXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgICB0eXBlOiAnb2JqZWN0JyxcclxuICAgICAgICAgICAgcHJvcGVydGllczoge1xyXG4gICAgICAgICAgICAgICAgaGllcmFyY2h5UGF0aDogeyB0eXBlOiAnc3RyaW5nJywgZGVzY3JpcHRpb246ICdQYXRoIHRvIHRoZSBub2RlIGluIHRoZSBzY2VuZSBoaWVyYXJjaHlcIicgfSxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnaGllcmFyY2h5UGF0aCddXHJcbiAgICAgICAgfSwgeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyByZWZlcmVuY2VzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSB9IH0gfSwgXCJHRVRcIiwgIFsnc2NlbmUnLCAnbm9kZScsICdnZXQnLCAncGF0aCcsICdmaW5kJywgJ2xvb2snLCAnaW5zdGFuY2UnLCAnaGllcmFyY2h5J11cclxuICAgIClcclxuICAgIGFzeW5jIG5vZGVHZXRBdFBhdGgoYXJnczogeyBoaWVyYXJjaHlQYXRoOiBzdHJpbmcgfSk6IFByb21pc2U8eyByZWZlcmVuY2VzOiBJSW5zdGFuY2VSZWZlcmVuY2VbXSB9PiB7XHJcbiAgICAgICAgY29uc3Qgbm9kZVRyZWUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKTtcclxuICAgICAgICBpZiAoIW5vZGVUcmVlKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgU2NlbmUgaXMgZW1wdHkgb3IgY291bGQgbm90IHJldHJpZXZlIHNjZW5lIHRyZWUuYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzY2VuZVJvb3ROYW1lID0gKG5vZGVUcmVlLm5hbWUgYXMgdW5rbm93biBhcyBzdHJpbmcpO1xyXG4gICAgICAgIGlmIChhcmdzLmhpZXJhcmNoeVBhdGguc3RhcnRzV2l0aCgnLycpKSB7XHJcbiAgICAgICAgICAgIGFyZ3MuaGllcmFyY2h5UGF0aCA9IGFyZ3MuaGllcmFyY2h5UGF0aC5zbGljZSgxKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGFyZ3MuaGllcmFyY2h5UGF0aC5zdGFydHNXaXRoKGAke3NjZW5lUm9vdE5hbWV9YCkpIHtcclxuICAgICAgICAgICAgYXJncy5oaWVyYXJjaHlQYXRoID0gYXJncy5oaWVyYXJjaHlQYXRoLnNsaWNlKHNjZW5lUm9vdE5hbWUubGVuZ3RoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGFyZ3MuaGllcmFyY2h5UGF0aCA9PT0gJycpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHsgcmVmZXJlbmNlczogW3sgaWQ6IChub2RlVHJlZS51dWlkIGFzIHVua25vd24gYXMgc3RyaW5nKSB9XSB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcGF0aFBhcnRzID0gYXJncy5oaWVyYXJjaHlQYXRoLnNwbGl0KCcvJykuZmlsdGVyKHAgPT4gcC5sZW5ndGggPiAwKTtcclxuICAgICAgICBsZXQgY3VycmVudE5vZGVzID0gW25vZGVUcmVlXTtcclxuICAgICAgICBmb3IgKGNvbnN0IHBhcnQgb2YgcGF0aFBhcnRzKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG5leHROb2RlczogYW55W10gPSBbXTtcclxuICAgICAgICAgICAgZm9yIChjb25zdCBub2RlIG9mIGN1cnJlbnROb2Rlcykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbWF0Y2hpbmdDaGlsZHJlbiA9IChub2RlLmNoaWxkcmVuIHx8IFtdKS5maWx0ZXIoKGNoaWxkOiBhbnkpID0+IGNoaWxkLm5hbWUgPT09IHBhcnQpO1xyXG4gICAgICAgICAgICAgICAgbmV4dE5vZGVzLnB1c2goLi4ubWF0Y2hpbmdDaGlsZHJlbik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY3VycmVudE5vZGVzID0gbmV4dE5vZGVzO1xyXG4gICAgICAgICAgICBpZiAoY3VycmVudE5vZGVzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB7IHJlZmVyZW5jZXM6IGN1cnJlbnROb2Rlcy5tYXAoKG5vZGU6IGFueSkgPT4gKHsgaWQ6IG5vZGUudXVpZCwgdHlwZTogJ2NjLk5vZGUnIH0pKSB9O1xyXG4gICAgfVxyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICAnbm9kZUNyZWF0ZVByaW1pdGl2ZScsXHJcbiAgICAgICAgJ0NyZWF0ZSBhIG5ldyBub2RlIHdpdGggcHJlZGVmaW5lZCBwcmltaXRpdmUgZ2VvbWV0cnkgTWVzaFJlbmRlcmVyLiBJZiBubyBwYXJlbnQgaXMgc3BlY2lmaWVkLCByb290IG5vZGUgaXMgdXNlZC4gUmV0dXJucyByZWZlcmVuY2UgdG8gdGhlIG5ldyBub2RlLicsXHJcbiAgICAgICAgIHsgIHR5cGU6ICdvYmplY3QnLFxyXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiB7IHR5cGU6ICdzdHJpbmcnIH0sXHJcbiAgICAgICAgICAgICAgICBwcmltaXRpdmVUeXBlOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbXHJcbiAgICAgICAgICAgICAgICAgICAgJ0NhcHN1bGUnLCAnQ29uZScsICdDdWJlJywgJ0N5bGluZGVyJywgJ1BsYW5lJywgJ1F1YWQnLCAnU3BoZXJlJywgJ1RvcnVzJyxcclxuICAgICAgICAgICAgICAgIF0gfSxcclxuICAgICAgICAgICAgICAgIHBhcmVudFJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWFcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgcmVxdWlyZWQ6IFsnbmFtZScsICdwcmltaXRpdmVUeXBlJ11cclxuICAgICAgICAgfSwgXHJcbiAgICAgICAgIHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSB9LCByZXF1aXJlZDogWydyZWZlcmVuY2UnXSB9LCBcIlBPU1RcIiwgIFsnc2NlbmUnLCAnbm9kZScsICdjcmVhdGUnLCAnYWRkJ11cclxuICAgIClcclxuICAgIGFzeW5jIHNjZW5lQ3JlYXRlUHJpbWl0aXZlTm9kZShhcmdzOiB7IG5hbWU6IHN0cmluZywgcHJpbWl0aXZlVHlwZTogc3RyaW5nLCBwYXJlbnRSZWZlcmVuY2U/OiBJSW5zdGFuY2VSZWZlcmVuY2UgfSk6IFByb21pc2U8eyByZWZlcmVuY2U6IElJbnN0YW5jZVJlZmVyZW5jZSB9PiB7XHJcbiAgICAgICAgY29uc3QgcHJpbWl0aXZlTWFwOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xyXG4gICAgICAgICAgICAnQ2Fwc3VsZSc6IFwiZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X3ByZWZhYi8zZC9DYXBzdWxlLnByZWZhYlwiLFxyXG4gICAgICAgICAgICAnQ29uZSc6IFwiZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X3ByZWZhYi8zZC9Db25lLnByZWZhYlwiLFxyXG4gICAgICAgICAgICAnQ3ViZSc6IFwiZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X3ByZWZhYi8zZC9DdWJlLnByZWZhYlwiLFxyXG4gICAgICAgICAgICAnQ3lsaW5kZXInOiBcImRiOi8vaW50ZXJuYWwvZGVmYXVsdF9wcmVmYWIvM2QvQ3lsaW5kZXIucHJlZmFiXCIsXHJcbiAgICAgICAgICAgICdQbGFuZSc6IFwiZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X3ByZWZhYi8zZC9QbGFuZS5wcmVmYWJcIixcclxuICAgICAgICAgICAgJ1F1YWQnOiBcImRiOi8vaW50ZXJuYWwvZGVmYXVsdF9wcmVmYWIvM2QvUXVhZC5wcmVmYWJcIixcclxuICAgICAgICAgICAgJ1NwaGVyZSc6IFwiZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X3ByZWZhYi8zZC9TcGhlcmUucHJlZmFiXCIsXHJcbiAgICAgICAgICAgICdUb3J1cyc6IFwiZGI6Ly9pbnRlcm5hbC9kZWZhdWx0X3ByZWZhYi8zZC9Ub3J1cy5wcmVmYWJcIixcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBpZiAoIXByaW1pdGl2ZU1hcFthcmdzLnByaW1pdGl2ZVR5cGVdKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgcHJpbWl0aXZlIHR5cGU6ICR7YXJncy5wcmltaXRpdmVUeXBlfWApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgcHJlZmFiVXJsID0gcHJpbWl0aXZlTWFwW2FyZ3MucHJpbWl0aXZlVHlwZV07XHJcbiAgICAgICAgY29uc3QgYXNzZXRVdWlkID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncXVlcnktdXVpZCcsIHByZWZhYlVybCk7XHJcbiAgICAgICAgaWYgKCFhc3NldFV1aWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCBhc3NldCBmb3IgcHJpbWl0aXZlIHR5cGUgJHthcmdzLnByaW1pdGl2ZVR5cGV9IGF0ICR7cHJlZmFiVXJsfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5zY2VuZUNyZWF0ZU5vZGUoe1xyXG4gICAgICAgICAgICBuYW1lOiBhcmdzLm5hbWUsXHJcbiAgICAgICAgICAgIHBhcmVudFJlZmVyZW5jZTogYXJncy5wYXJlbnRSZWZlcmVuY2UsXHJcbiAgICAgICAgICAgIGFzc2V0UmVmZXJlbmNlOiB7IGlkOiBhc3NldFV1aWQsIHR5cGU6ICdjYy5QcmVmYWInIH0sXHJcbiAgICAgICAgICAgIHVud3JhcFByZWZhYjogdHJ1ZVxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICAnbm9kZUNyZWF0ZScsXHJcbiAgICAgICAgJ0NyZWF0ZSBhIG5ldyBub2RlIGluIHRoZSBzY2VuZS4gSWYgbm8gcGFyZW50IGlzIHNwZWNpZmllZCwgcm9vdCBub2RlIGlzIHVzZWQuIFJldHVybnMgcmVmZXJlbmNlIHRvIHRoZSBuZXcgbm9kZS4nLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IHsgdHlwZTogJ3N0cmluZycgfSxcclxuICAgICAgICAgICAgICAgIHBhcmVudFJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsXHJcbiAgICAgICAgICAgICAgICBhc3NldFJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsXHJcbiAgICAgICAgICAgICAgICB1bndyYXBQcmVmYWI6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZWZhdWx0OiBmYWxzZSB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ25hbWUnXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgeyB0eXBlOiAnb2JqZWN0JywgcHJvcGVydGllczogeyByZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hIH0sIHJlcXVpcmVkOiBbJ3JlZmVyZW5jZSddIH0sIFwiUE9TVFwiLCAgWydzY2VuZScsICdub2RlJywgJ2NyZWF0ZScsICdhZGQnXVxyXG4gICAgKVxyXG4gICAgYXN5bmMgc2NlbmVDcmVhdGVOb2RlKGFyZ3M6IHsgbmFtZTogc3RyaW5nLCBwYXJlbnRSZWZlcmVuY2U/OiBJSW5zdGFuY2VSZWZlcmVuY2UsIGFzc2V0UmVmZXJlbmNlPzogSUluc3RhbmNlUmVmZXJlbmNlLCB1bndyYXBQcmVmYWI/OiBib29sZWFuIH0pOiBQcm9taXNlPHsgcmVmZXJlbmNlOiBJSW5zdGFuY2VSZWZlcmVuY2UgfT4ge1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IGFueSA9IHtcclxuICAgICAgICAgICAgbmFtZTogYXJncy5uYW1lXHJcbiAgICAgICAgfTtcclxuICAgICAgICBpZiAoYXJncy5wYXJlbnRSZWZlcmVuY2UpIHtcclxuICAgICAgICAgICAgb3B0aW9ucy5wYXJlbnQgPSBhcmdzLnBhcmVudFJlZmVyZW5jZS5pZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBGb3JjZSByb290IGlmIG5vIHBhcmVudCBwcm92aWRlZFxyXG4gICAgICAgICAgICBvcHRpb25zLnBhcmVudCA9IChhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlLXRyZWUnKSkudXVpZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGxldCBhc3NldFV1aWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgICAgICAvLyAxLiBEZXRlcm1pbmUgQXNzZXQgVVVJRFxyXG4gICAgICAgIGlmICgoYXJncy5hc3NldFJlZmVyZW5jZSAmJiAnaWQnIGluIGFyZ3MuYXNzZXRSZWZlcmVuY2UpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGFzc2V0SW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCBhcmdzLmFzc2V0UmVmZXJlbmNlLmlkKTtcclxuICAgICAgICAgICAgaWYgKCFhc3NldEluZm8pIHtcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgQXNzZXQgcmVmZXJlbmNlIG5vdCBmb3VuZDogJHthcmdzLmFzc2V0UmVmZXJlbmNlLmlkfWApO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBsZXQgcHJlZmFiRm91bmQgPSBhc3NldEluZm8udHlwZSA9PT0gJ2NjLlByZWZhYic7XHJcbiAgICAgICAgICAgIC8vIElmIG5vdCBhIHByZWZhYiwgY2hlY2sgaWYgaXQgaGFzIGEgcHJlZmFiIHN1Yi1hc3NldCAobGlrZSBpbiBjYXNlIG9mIEZCWClcclxuICAgICAgICAgICAgaWYgKCFwcmVmYWJGb3VuZCkge1xyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgc3ViQXNzZXQgb2YgT2JqZWN0LnZhbHVlcyhhc3NldEluZm8uc3ViQXNzZXRzKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzdWJBc3NldC50eXBlID09PSAnY2MuUHJlZmFiJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBhc3NldFV1aWQgPSBzdWJBc3NldC51dWlkO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmVmYWJGb3VuZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGFzc2V0VXVpZCA9IGFzc2V0SW5mby51dWlkO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIXByZWZhYkZvdW5kKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3ZpZGVkIGFzc2V0IHJlZmVyZW5jZSAke2FyZ3MuYXNzZXRSZWZlcmVuY2UuaWR9IGlzIG5vdCBhIHByZWZhYiBhbmQgZG9lcyBub3QgY29udGFpbiBhIHByZWZhYiBzdWItYXNzZXQuYCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MudW53cmFwUHJlZmFiKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9ucy51bmxpbmtQcmVmYWIgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25zLnR5cGUgPSAnY2MuUHJlZmFiJztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGFzc2V0VXVpZCkge1xyXG4gICAgICAgICAgICBvcHRpb25zLmFzc2V0VXVpZCA9IGFzc2V0VXVpZDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIDIuIENyZWF0ZSBOb2RlXHJcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY3JlYXRlLW5vZGUnLCBvcHRpb25zKTtcclxuICAgICAgICBjb25zdCBuZXdOb2RlVXVpZCA9IEFycmF5LmlzQXJyYXkocmVzdWx0KSA/IHJlc3VsdFswXSA6IHJlc3VsdDtcclxuXHJcbiAgICAgICAgaWYgKCFuZXdOb2RlVXVpZCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBjcmVhdGUgbm9kZSAke2FyZ3MubmFtZX0ke2FyZ3MuYXNzZXRSZWZlcmVuY2UgPyBgIGZyb20gYXNzZXQgJHthcmdzLmFzc2V0UmVmZXJlbmNlLmlkfWAgOiAnJ30uYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xyXG5cclxuICAgICAgICByZXR1cm4geyByZWZlcmVuY2U6IHsgaWQ6IG5ld05vZGVVdWlkLCB0eXBlOiAnY2MuTm9kZScgfSB9O1xyXG4gICAgfVxyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICAnbm9kZU9wZXJhdGUnLFxyXG4gICAgICAgICdQZXJmb3JtIG9wZXJhdGlvbiBvbiByZWZlcmVuY2VkIG5vZGUsIGluY2x1ZGluZyBwcmVmYWIgb3BlcmF0aW9ucy4nLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIG9wZXJhdGlvbjogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogWydtb3ZlJywgJ2NvcHknLCAnZGVsZXRlJywgJ2NyZWF0ZV9wcmVmYWInLCAncmV2ZXJ0X3ByZWZhYicsICdhcHBseV9wcmVmYWInLCAndW53cmFwX3ByZWZhYicsICd1bndyYXBfcHJlZmFiX2NvbXBsZXRlbHknLCAnb3Blbl9wcmVmYWInXSB9LFxyXG4gICAgICAgICAgICAgICAgcmVmZXJlbmNlOiBJbnN0YW5jZVJlZmVyZW5jZVNjaGVtYSxcclxuICAgICAgICAgICAgICAgIG5ld1BhcmVudFJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWEsXHJcbiAgICAgICAgICAgICAgICBuZXdQcmVmYWJQYXRoOiB7IHR5cGU6ICdzdHJpbmcnLCBkZXNjcmlwdGlvbjogJ0ZvciBjcmVhdGVfcHJlZmFiOiB0YXJnZXQgZGI6Ly8gcGF0aCcsIG51bGxhYmxlOiB0cnVlIH0sXHJcbiAgICAgICAgICAgICAgICBzaWJsaW5nSW5kZXg6IHsgdHlwZTogJ2ludGVnZXInLCBkZXNjcmlwdGlvbjogJ0ZvciBtb3ZlL2NvcHk6IHRhcmdldCBpbmRleCBpbiBwYXJlbnQgY2hpbGRyZW4gYXJyYXknLCBudWxsYWJsZTogdHJ1ZSB9XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHJlcXVpcmVkOiBbJ29wZXJhdGlvbicsICdyZWZlcmVuY2UnXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgeyB0eXBlOiAnb2JqZWN0JywgXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHsgdHlwZTogJ2Jvb2xlYW4nIH0sXHJcbiAgICAgICAgICAgICAgICBjcmVhdGVkUHJlZmFiQXNzZXRSZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLFxyXG4gICAgICAgICAgICAgICAgdXBkYXRlZE5vZGVSZWZlcmVuY2U6IEluc3RhbmNlUmVmZXJlbmNlU2NoZW1hLFxyXG4gICAgICAgICAgICAgICAgY29waWVkTm9kZVJlZmVyZW5jZTogSW5zdGFuY2VSZWZlcmVuY2VTY2hlbWFcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sIFwiUE9TVFwiLCAgWydzY2VuZScsICdub2RlJywgJ3JlbW92ZScsICdtb3ZlJywgJ2NvcHknLCAnZGVsZXRlJywgJ3ByZWZhYicsICdhcHBseScsICdyZXZlcnQnLCAndW53cmFwJywgJ2NyZWF0ZSddXHJcbiAgICApXHJcbiAgICBhc3luYyBub2RlT3BlcmF0ZShhcmdzOiB7IG9wZXJhdGlvbjogc3RyaW5nLCByZWZlcmVuY2U6IElJbnN0YW5jZVJlZmVyZW5jZSwgbmV3UGFyZW50UmVmZXJlbmNlPzogSUluc3RhbmNlUmVmZXJlbmNlLCBuZXdQcmVmYWJQYXRoPzogc3RyaW5nLCBzaWJsaW5nSW5kZXg/OiBudW1iZXIgfSk6IFxyXG4gICAgICAgIFByb21pc2U8eyBzdWNjZXNzPzogYm9vbGVhbiwgY3JlYXRlZFByZWZhYkFzc2V0UmVmZXJlbmNlPzogSUluc3RhbmNlUmVmZXJlbmNlLCB1cGRhdGVkTm9kZVJlZmVyZW5jZT86IElJbnN0YW5jZVJlZmVyZW5jZSwgY29waWVkTm9kZVJlZmVyZW5jZT86IElJbnN0YW5jZVJlZmVyZW5jZSB9PiB7XHJcbiAgICAgICAgaWYgKGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3F1ZXJ5LW5vZGUnLCBhcmdzLnJlZmVyZW5jZS5pZCkgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUYXJnZXQgbm9kZSAke2FyZ3MucmVmZXJlbmNlLmlkfSBub3QgZm91bmRgKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHN3aXRjaCAoYXJncy5vcGVyYXRpb24pIHtcclxuICAgICAgICAgICAgY2FzZSAnbW92ZSc6XHJcbiAgICAgICAgICAgICAgICBpZiAoIWFyZ3MubmV3UGFyZW50UmVmZXJlbmNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwibmV3UGFyZW50UmVmZXJlbmNlIHJlcXVpcmVkIGZvciBtb3ZlXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wYXJlbnQnLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgcGFyZW50OiBhcmdzLm5ld1BhcmVudFJlZmVyZW5jZS5pZCxcclxuICAgICAgICAgICAgICAgICAgICB1dWlkczogYXJncy5yZWZlcmVuY2UuaWQsXHJcbiAgICAgICAgICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtOiB0cnVlXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoYXJncy5zaWJsaW5nSW5kZXggIT09IHVuZGVmaW5lZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuc2V0U2libGluZ0luZGV4KGFyZ3MucmVmZXJlbmNlLmlkLCBhcmdzLnNpYmxpbmdJbmRleCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc25hcHNob3QnKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnY29weSc6XHJcbiAgICAgICAgICAgICAgICAgY29uc3QgZHVwbGljYXRlUmVzdWx0ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZHVwbGljYXRlLW5vZGUnLCBbYXJncy5yZWZlcmVuY2UuaWRdKTtcclxuICAgICAgICAgICAgICAgICBpZiAoIWR1cGxpY2F0ZVJlc3VsdCB8fCBkdXBsaWNhdGVSZXN1bHQubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICR7YXJncy5yZWZlcmVuY2UuaWR9IGR1cGxpY2F0aW9uIGZhaWxlZGApO1xyXG4gICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICBjb25zdCBuZXdOb2RlcyA9IGR1cGxpY2F0ZVJlc3VsdCBhcyBzdHJpbmdbXTtcclxuICAgICAgICAgICAgICAgICBjb25zdCBuZXdOb2RlSWQgPSBuZXdOb2Rlc1swXTsgXHJcbiAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgaWYgKGFyZ3MubmV3UGFyZW50UmVmZXJlbmNlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NldC1wYXJlbnQnLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHBhcmVudDogYXJncy5uZXdQYXJlbnRSZWZlcmVuY2UuaWQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHV1aWRzOiBuZXdOb2RlcyxcclxuICAgICAgICAgICAgICAgICAgICAgICAga2VlcFdvcmxkVHJhbnNmb3JtOiB0cnVlXHJcbiAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgaWYgKGFyZ3Muc2libGluZ0luZGV4ICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5zZXRTaWJsaW5nSW5kZXgobmV3Tm9kZUlkLCBhcmdzLnNpYmxpbmdJbmRleCk7XHJcbiAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xyXG4gICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGNvcGllZE5vZGVSZWZlcmVuY2U6IHsgaWQ6IG5ld05vZGVJZCwgdHlwZTogJ2NjLk5vZGUnIH0gfTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ2RlbGV0ZSc6XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZW1vdmUtbm9kZScsIHtcclxuICAgICAgICAgICAgICAgICAgICB1dWlkOiBhcmdzLnJlZmVyZW5jZS5pZFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUNoZWNrID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIGFyZ3MucmVmZXJlbmNlLmlkKTtcclxuICAgICAgICAgICAgICAgIGlmIChub2RlQ2hlY2sgIT09IG51bGwgJiYgbm9kZUNoZWNrICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHthcmdzLnJlZmVyZW5jZS5pZH0gc3RpbGwgZXhpc3RzIGFmdGVyIHJlbW92YWxgKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ2NyZWF0ZV9wcmVmYWInOlxyXG4gICAgICAgICAgICAgICAgaWYgKCFhcmdzLm5ld1ByZWZhYlBhdGgpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJuZXdQcmVmYWJQYXRoIHJlcXVpcmVkIGZvciBjcmVhdGVfcHJlZmFiXCIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY29uc3QgcGFyZW50SW5mbyA9IGF3YWl0IHRoaXMuZ2V0UGFyZW50QW5kU2libGluZ0luZGV4KGFyZ3MucmVmZXJlbmNlLmlkKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjcmVhdGVkUHJlZmFiVXVpZCA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHBhY2thZ2VKU09OLm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnY3JlYXRlUHJlZmFiRnJvbU5vZGUnLFxyXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLnJlZmVyZW5jZS5pZCwgYXJncy5uZXdQcmVmYWJQYXRoXVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICghY3JlYXRlZFByZWZhYlV1aWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJGYWlsZWQgdG8gY3JlYXRlIHByZWZhYiBhc3NldC5cIik7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVkTm9kZUlkID0gYXdhaXQgdGhpcy5nZXRVcGRhdGVkVXVpZChwYXJlbnRJbmZvLnBhcmVudFV1aWQsIHBhcmVudEluZm8uc2libGluZ0luZGV4KTtcclxuXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUsIGNyZWF0ZWRQcmVmYWJBc3NldFJlZmVyZW5jZTogeyBpZDogY3JlYXRlZFByZWZhYlV1aWQsIHR5cGU6ICdjYy5QcmVmYWInIH0sIHVwZGF0ZWROb2RlUmVmZXJlbmNlOiB7IGlkOiB1cGRhdGVkTm9kZUlkLCB0eXBlOiAnY2MuTm9kZScgfSB9O1xyXG4gICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjYXNlICdyZXZlcnRfcHJlZmFiJzpcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJldmVydFN1Y2Nlc3MgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdyZXN0b3JlLXByZWZhYicsIHsgdXVpZDogYXJncy5yZWZlcmVuY2UuaWQgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc25hcHNob3QnKTtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiByZXZlcnRTdWNjZXNzIH07XHJcblxyXG4gICAgICAgICAgICBjYXNlICdhcHBseV9wcmVmYWInOlxyXG4gICAgICAgICAgICAgICAgY29uc3QgYXBwbHlFcnJvciA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2V4ZWN1dGUtc2NlbmUtc2NyaXB0Jywge1xyXG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IHBhY2thZ2VKU09OLm5hbWUsXHJcbiAgICAgICAgICAgICAgICAgICAgbWV0aG9kOiAnYXBwbHlQcmVmYWJCeU5vZGUnLFxyXG4gICAgICAgICAgICAgICAgICAgIGFyZ3M6IFthcmdzLnJlZmVyZW5jZS5pZF1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmIChhcHBseUVycm9yICE9IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBhcHBseSBwcmVmYWI6ICR7YXBwbHlFcnJvcn1gKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzbmFwc2hvdCcpO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcclxuXHJcbiAgICAgICAgICAgIGNhc2UgJ3Vud3JhcF9wcmVmYWInOlxyXG4gICAgICAgICAgICAgICAgY29uc3QgdW53cmFwRXJyb3IgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBwYWNrYWdlSlNPTi5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ3VubGlua1ByZWZhYkJ5Tm9kZScsXHJcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW2FyZ3MucmVmZXJlbmNlLmlkLCBmYWxzZV1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBpZiAodW53cmFwRXJyb3IgIT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHVud3JhcCBwcmVmYWI6ICR7dW53cmFwRXJyb3J9YCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnc25hcHNob3QnKTtcclxuXHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XHJcblxyXG4gICAgICAgICAgICBjYXNlICd1bndyYXBfcHJlZmFiX2NvbXBsZXRlbHknOlxyXG4gICAgICAgICAgICAgICAgY29uc3QgdW53cmFwQWxsRXJyb3IgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdleGVjdXRlLXNjZW5lLXNjcmlwdCcsIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lOiBwYWNrYWdlSlNPTi5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ3VubGlua1ByZWZhYkJ5Tm9kZScsXHJcbiAgICAgICAgICAgICAgICAgICAgYXJnczogW2FyZ3MucmVmZXJlbmNlLmlkLCB0cnVlXVxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGlmICh1bndyYXBBbGxFcnJvciAhPSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gdW53cmFwIHByZWZhYiBjb21wbGV0ZWx5OiAke3Vud3JhcEFsbEVycm9yfWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NuYXBzaG90Jyk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG5cclxuICAgICAgICAgICAgY2FzZSAnb3Blbl9wcmVmYWInOlxyXG4gICAgICAgICAgICAgICAgY29uc3Qgbm9kZUZvclByZWZhYjogYW55ID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIGFyZ3MucmVmZXJlbmNlLmlkKTtcclxuICAgICAgICAgICAgICAgIGlmICghbm9kZUZvclByZWZhYikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgTm9kZSAke2FyZ3MucmVmZXJlbmNlLmlkfSBub3QgZm91bmRgKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IHBJbmZvID0gbm9kZUZvclByZWZhYi5fX3ByZWZhYl9fIHx8IG5vZGVGb3JQcmVmYWIuX3ByZWZhYiB8fCAobm9kZUZvclByZWZhYi52YWx1ZSAmJiAobm9kZUZvclByZWZhYi52YWx1ZS5fX3ByZWZhYl9fIHx8IG5vZGVGb3JQcmVmYWIudmFsdWUuX3ByZWZhYikpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcFZhbHVlID0gcEluZm8/LnZhbHVlIHx8IHBJbmZvO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdGFyZ2V0VXVpZCA9IHBWYWx1ZT8uYXNzZXRVdWlkIHx8IHBWYWx1ZT8udXVpZDtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIXRhcmdldFV1aWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHthcmdzLnJlZmVyZW5jZS5pZH0gaXMgbm90IGxpbmtlZCB0byBhIHByZWZhYmApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRyeSB7IFxyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ29wZW4tYXNzZXQnLCB0YXJnZXRVdWlkKTtcclxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBvcGVuIHByZWZhYiBhc3NldCAke3RhcmdldFV1aWR9LiBSZWFzb246ICR7ZXJyb3I/Lm1lc3NhZ2UgfHwgZXJyb3J9YCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG5cclxuICAgICAgICAgICAgZGVmYXVsdDpcclxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBzY2VuZSBub2RlIG9wZXJhdGlvbjogJHthcmdzLm9wZXJhdGlvbn1gKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLy8gSGVscGVyc1xyXG5cclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0UGFyZW50KG5vZGVVdWlkOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgICAgIGNvbnN0IG5vZGUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgbm9kZVV1aWQpO1xyXG4gICAgICAgIGlmIChub2RlPy5wYXJlbnQ/LnZhbHVlPy51dWlkKSByZXR1cm4gbm9kZS5wYXJlbnQudmFsdWUudXVpZDtcclxuICAgICAgICBpZiAobm9kZT8ucGFyZW50Py51dWlkKSByZXR1cm4gbm9kZS5wYXJlbnQudXVpZDtcclxuICAgICAgICByZXR1cm4gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktdXVpZCcpO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIEhlbHBlciB0byBzZXQgc2libGluZyBpbmRleFxyXG4gICAgcHJpdmF0ZSBhc3luYyBzZXRTaWJsaW5nSW5kZXgodXVpZDogc3RyaW5nLCBpbmRleDogbnVtYmVyKSB7XHJcbiAgICAgICAgLy8gR2V0IHBhcmVudCBmaXJzdFxyXG4gICAgICAgIGNvbnN0IHBhcmVudFV1aWQgPSBhd2FpdCB0aGlzLmdldFBhcmVudCh1dWlkKTtcclxuICAgICAgICBpZiAoIXBhcmVudFV1aWQpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICR7dXVpZH0gaGFzIG5vIHBhcmVudGApO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gR2V0IGNoaWxkcmVuIG9mIHBhcmVudFxyXG4gICAgICAgIGNvbnN0IHBhcmVudE5vZGUgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgcGFyZW50VXVpZCk7XHJcbiAgICAgICAgY29uc3QgY2hpbGRyZW5BcnJheSA9IHBhcmVudE5vZGUuY2hpbGRyZW47XHJcbiAgICAgICAgaWYgKCFjaGlsZHJlbkFycmF5IHx8ICFBcnJheS5pc0FycmF5KGNoaWxkcmVuQXJyYXkpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUGFyZW50IG5vZGUgJHtwYXJlbnRVdWlkfSBoYXMgbm8gY2hpbGRyZW5gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IGN1cnJlbnRJbmRleCA9IGNoaWxkcmVuQXJyYXkuZmluZEluZGV4KChjaGlsZDogYW55KSA9PiBjaGlsZC52YWx1ZS51dWlkID09PSB1dWlkKTtcclxuICAgICAgICBpZiAoY3VycmVudEluZGV4ID09PSAtMSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHt1dWlkfSBub3QgZm91bmQgaW4gcGFyZW50IGNoaWxkcmVuYCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoY3VycmVudEluZGV4ID09PSBpbmRleCkgcmV0dXJuIHRydWU7XHJcblxyXG4gICAgICAgIC8vIENhbGN1bGF0ZSBvZmZzZXRcclxuICAgICAgICAvLyBXZSBuZWVkIHRvIG1vdmUgdGhlIGVsZW1lbnQgYXQgY3VycmVudEluZGV4IHRvIHRhcmdldEluZGV4LlxyXG4gICAgICAgIC8vIFRoZSBBUEkgbW92ZS1hcnJheS1lbGVtZW50IHdvcmtzIHdpdGggb2Zmc2V0IGZyb20gY3VycmVudCBwb3NpdGlvbi5cclxuICAgICAgICBcclxuICAgICAgICAvLyBFbnN1cmUgaW5kZXggaXMgd2l0aGluIGJvdW5kcyBbMCwgbGVuZ3RoLTFdXHJcbiAgICAgICAgY29uc3QgdGFyZ2V0SW5kZXggPSBNYXRoLm1heCgwLCBNYXRoLm1pbihpbmRleCwgY2hpbGRyZW5BcnJheS5sZW5ndGggLSAxKSk7XHJcbiAgICAgICAgY29uc3Qgb2Zmc2V0ID0gdGFyZ2V0SW5kZXggLSBjdXJyZW50SW5kZXg7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKG9mZnNldCA9PT0gMCkgcmV0dXJuIHRydWU7XHJcblxyXG4gICAgICAgIHJldHVybiBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdtb3ZlLWFycmF5LWVsZW1lbnQnLCB7XHJcbiAgICAgICAgICAgIHV1aWQ6IHBhcmVudFV1aWQsXHJcbiAgICAgICAgICAgIHBhdGg6ICdjaGlsZHJlbicsXHJcbiAgICAgICAgICAgIHRhcmdldDogY3VycmVudEluZGV4LFxyXG4gICAgICAgICAgICBvZmZzZXQ6IG9mZnNldCxcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGFzeW5jIGdldFBhcmVudEFuZFNpYmxpbmdJbmRleCh1dWlkOiBzdHJpbmcpOiBQcm9taXNlPHsgcGFyZW50VXVpZDogc3RyaW5nLCBzaWJsaW5nSW5kZXg6IG51bWJlciB9PiB7XHJcbiAgICAgICAgY29uc3QgcGFyZW50VXVpZCA9IGF3YWl0IHRoaXMuZ2V0UGFyZW50KHV1aWQpO1xyXG4gICAgICAgIGlmICghcGFyZW50VXVpZCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE5vZGUgJHt1dWlkfSBoYXMgbm8gcGFyZW50YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBwYXJlbnROb2RlID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktbm9kZScsIHBhcmVudFV1aWQpO1xyXG4gICAgICAgIGNvbnN0IGNoaWxkcmVuQXJyYXkgPSBwYXJlbnROb2RlLmNoaWxkcmVuO1xyXG4gICAgICAgIGlmICghY2hpbGRyZW5BcnJheSB8fCAhQXJyYXkuaXNBcnJheShjaGlsZHJlbkFycmF5KSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYFBhcmVudCBub2RlICR7cGFyZW50VXVpZH0gaGFzIG5vIGNoaWxkcmVuYCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gY2hpbGRyZW5BcnJheS5maW5kSW5kZXgoKGNoaWxkOiBhbnkpID0+IGNoaWxkLnZhbHVlLnV1aWQgPT09IHV1aWQpO1xyXG4gICAgICAgIGlmIChpbmRleCA9PT0gLTEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBOb2RlICR7dXVpZH0gbm90IGZvdW5kIGluIHBhcmVudCBjaGlsZHJlbmApO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4geyBwYXJlbnRVdWlkLCBzaWJsaW5nSW5kZXg6IGluZGV4IH07XHJcbiAgICB9XHJcbiAgICBcclxuICAgIHByaXZhdGUgYXN5bmMgZ2V0VXBkYXRlZFV1aWQocGFyZW50VXVpZDogc3RyaW5nLCBzaWJsaW5nSW5kZXg6IG51bWJlcik6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICAgICAgY29uc3QgcGFyZW50Tm9kZUluZm8gPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1ub2RlJywgcGFyZW50VXVpZCk7XHJcbiAgICAgICAgaWYgKCFwYXJlbnROb2RlSW5mbyB8fCAhcGFyZW50Tm9kZUluZm8uY2hpbGRyZW4gfHwgIUFycmF5LmlzQXJyYXkocGFyZW50Tm9kZUluZm8uY2hpbGRyZW4pIHx8ICFwYXJlbnROb2RlSW5mby5jaGlsZHJlbltzaWJsaW5nSW5kZXhdKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHJldHJpZXZlIHVwZGF0ZWQgbm9kZSBpbmZvIGFmdGVyIHByZWZhYiBjcmVhdGlvbi5gKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHBhcmVudE5vZGVJbmZvLmNoaWxkcmVuW3NpYmxpbmdJbmRleF0udmFsdWUudXVpZDtcclxuICAgIH1cclxufSJdfQ==