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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAllImporters = registerAllImporters;
const importer_manager_1 = require("./importer-manager");
const material_importer_1 = require("./material-importer");
const texture_importer_1 = require("./texture-importer");
const script_importer_1 = require("./script-importer");
const physics_material_importer_1 = require("./physics-material-importer");
const fbx_importer_1 = require("./fbx-importer");
const gltf_importer_1 = require("./gltf-importer");
const directory_importer_1 = require("./directory-importer");
const auto_atlas_importer_1 = require("./auto-atlas-importer");
const prefab_importer_1 = require("./prefab-importer");
const image_importer_1 = require("./image-importer");
const sprite_frame_importer_1 = require("./sprite-frame-importer");
const texture_cube_importer_1 = require("./texture-cube-importer");
const erp_texture_cube_importer_1 = require("./erp-texture-cube-importer");
const render_texture_importer_1 = require("./render-texture-importer");
const project_settings_importer_1 = require("./project-settings-importer");
__exportStar(require("./base-importer"), exports);
__exportStar(require("./importer-manager"), exports);
__exportStar(require("./material-importer"), exports);
__exportStar(require("./texture-importer"), exports);
__exportStar(require("./script-importer"), exports);
__exportStar(require("./physics-material-importer"), exports);
__exportStar(require("./fbx-importer"), exports);
__exportStar(require("./gltf-importer"), exports);
__exportStar(require("./directory-importer"), exports);
__exportStar(require("./auto-atlas-importer"), exports);
__exportStar(require("./prefab-importer"), exports);
__exportStar(require("./image-importer"), exports);
__exportStar(require("./sprite-frame-importer"), exports);
__exportStar(require("./texture-cube-importer"), exports);
__exportStar(require("./erp-texture-cube-importer"), exports);
__exportStar(require("./render-texture-importer"), exports);
__exportStar(require("./project-settings-importer"), exports);
function registerAllImporters() {
    const manager = importer_manager_1.ImporterManager.getInstance();
    // Project Settings
    manager.registerImporter(new project_settings_importer_1.ProjectSettingsImporter());
    // Material
    manager.registerImporter(new material_importer_1.MaterialImporter());
    // Scripts
    manager.registerImporter(new script_importer_1.ScriptImporter()); // typescript
    // Prefab
    manager.registerImporter(new prefab_importer_1.PrefabImporter());
    // Textures & Images
    manager.registerImporter(new image_importer_1.ImageImporter());
    manager.registerImporter(new texture_importer_1.TextureImporter());
    manager.registerImporter(new sprite_frame_importer_1.SpriteFrameImporter());
    manager.registerImporter(new texture_cube_importer_1.TextureCubeImporter());
    manager.registerImporter(new erp_texture_cube_importer_1.ErpTextureCubeImporter());
    manager.registerImporter(new render_texture_importer_1.RenderTextureImporter());
    // Other
    manager.registerImporter(new physics_material_importer_1.PhysicsMaterialImporter());
    manager.registerImporter(new fbx_importer_1.FbxImporter());
    manager.registerImporter(new gltf_importer_1.GltfImporter());
    manager.registerImporter(new directory_importer_1.DirectoryImporter());
    manager.registerImporter(new auto_atlas_importer_1.AutoAtlasImporter());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zb3VyY2UvdXRjcC91dGlscy9hc3NldC1pbXBvcnRlcnMvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7OztBQW1DQSxvREE2QkM7QUFoRUQseURBQXFEO0FBQ3JELDJEQUF1RDtBQUN2RCx5REFBcUQ7QUFDckQsdURBQW1EO0FBQ25ELDJFQUFzRTtBQUN0RSxpREFBNkM7QUFDN0MsbURBQStDO0FBQy9DLDZEQUF5RDtBQUN6RCwrREFBMEQ7QUFDMUQsdURBQW1EO0FBQ25ELHFEQUFpRDtBQUNqRCxtRUFBOEQ7QUFDOUQsbUVBQThEO0FBQzlELDJFQUFxRTtBQUNyRSx1RUFBa0U7QUFDbEUsMkVBQXNFO0FBRXRFLGtEQUFnQztBQUNoQyxxREFBbUM7QUFDbkMsc0RBQW9DO0FBQ3BDLHFEQUFtQztBQUNuQyxvREFBa0M7QUFDbEMsOERBQTRDO0FBQzVDLGlEQUErQjtBQUMvQixrREFBZ0M7QUFDaEMsdURBQXFDO0FBQ3JDLHdEQUFzQztBQUN0QyxvREFBa0M7QUFDbEMsbURBQWlDO0FBQ2pDLDBEQUF3QztBQUN4QywwREFBd0M7QUFDeEMsOERBQTRDO0FBQzVDLDREQUEwQztBQUMxQyw4REFBNEM7QUFFNUMsU0FBZ0Isb0JBQW9CO0lBQ2hDLE1BQU0sT0FBTyxHQUFHLGtDQUFlLENBQUMsV0FBVyxFQUFFLENBQUM7SUFFOUMsbUJBQW1CO0lBQ25CLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLG1EQUF1QixFQUFFLENBQUMsQ0FBQztJQUV4RCxXQUFXO0lBQ1gsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksb0NBQWdCLEVBQUUsQ0FBQyxDQUFDO0lBRWpELFVBQVU7SUFDVixPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxnQ0FBYyxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWE7SUFFN0QsU0FBUztJQUNULE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLGdDQUFjLEVBQUUsQ0FBQyxDQUFDO0lBRS9DLG9CQUFvQjtJQUNwQixPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSw4QkFBYSxFQUFFLENBQUMsQ0FBQztJQUM5QyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxrQ0FBZSxFQUFFLENBQUMsQ0FBQztJQUNoRCxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwyQ0FBbUIsRUFBRSxDQUFDLENBQUM7SUFDcEQsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksMkNBQW1CLEVBQUUsQ0FBQyxDQUFDO0lBQ3BELE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLGtEQUFzQixFQUFFLENBQUMsQ0FBQztJQUN2RCxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwrQ0FBcUIsRUFBRSxDQUFDLENBQUM7SUFFdEQsUUFBUTtJQUNSLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLG1EQUF1QixFQUFFLENBQUMsQ0FBQztJQUN4RCxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSwwQkFBVyxFQUFFLENBQUMsQ0FBQztJQUM1QyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSw0QkFBWSxFQUFFLENBQUMsQ0FBQztJQUM3QyxPQUFPLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxzQ0FBaUIsRUFBRSxDQUFDLENBQUM7SUFDbEQsT0FBTyxDQUFDLGdCQUFnQixDQUFDLElBQUksdUNBQWlCLEVBQUUsQ0FBQyxDQUFDO0FBQ3RELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBJbXBvcnRlck1hbmFnZXIgfSBmcm9tICcuL2ltcG9ydGVyLW1hbmFnZXInO1xyXG5pbXBvcnQgeyBNYXRlcmlhbEltcG9ydGVyIH0gZnJvbSAnLi9tYXRlcmlhbC1pbXBvcnRlcic7XHJcbmltcG9ydCB7IFRleHR1cmVJbXBvcnRlciB9IGZyb20gJy4vdGV4dHVyZS1pbXBvcnRlcic7XHJcbmltcG9ydCB7IFNjcmlwdEltcG9ydGVyIH0gZnJvbSAnLi9zY3JpcHQtaW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBQaHlzaWNzTWF0ZXJpYWxJbXBvcnRlciB9IGZyb20gJy4vcGh5c2ljcy1tYXRlcmlhbC1pbXBvcnRlcic7XHJcbmltcG9ydCB7IEZieEltcG9ydGVyIH0gZnJvbSAnLi9mYngtaW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBHbHRmSW1wb3J0ZXIgfSBmcm9tICcuL2dsdGYtaW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBEaXJlY3RvcnlJbXBvcnRlciB9IGZyb20gJy4vZGlyZWN0b3J5LWltcG9ydGVyJztcclxuaW1wb3J0IHsgQXV0b0F0bGFzSW1wb3J0ZXIgfSBmcm9tICcuL2F1dG8tYXRsYXMtaW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBQcmVmYWJJbXBvcnRlciB9IGZyb20gJy4vcHJlZmFiLWltcG9ydGVyJztcclxuaW1wb3J0IHsgSW1hZ2VJbXBvcnRlciB9IGZyb20gJy4vaW1hZ2UtaW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBTcHJpdGVGcmFtZUltcG9ydGVyIH0gZnJvbSAnLi9zcHJpdGUtZnJhbWUtaW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBUZXh0dXJlQ3ViZUltcG9ydGVyIH0gZnJvbSAnLi90ZXh0dXJlLWN1YmUtaW1wb3J0ZXInO1xyXG5pbXBvcnQgeyBFcnBUZXh0dXJlQ3ViZUltcG9ydGVyIH0gZnJvbSAnLi9lcnAtdGV4dHVyZS1jdWJlLWltcG9ydGVyJztcclxuaW1wb3J0IHsgUmVuZGVyVGV4dHVyZUltcG9ydGVyIH0gZnJvbSAnLi9yZW5kZXItdGV4dHVyZS1pbXBvcnRlcic7XHJcbmltcG9ydCB7IFByb2plY3RTZXR0aW5nc0ltcG9ydGVyIH0gZnJvbSAnLi9wcm9qZWN0LXNldHRpbmdzLWltcG9ydGVyJztcclxuXHJcbmV4cG9ydCAqIGZyb20gJy4vYmFzZS1pbXBvcnRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vaW1wb3J0ZXItbWFuYWdlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vbWF0ZXJpYWwtaW1wb3J0ZXInO1xyXG5leHBvcnQgKiBmcm9tICcuL3RleHR1cmUtaW1wb3J0ZXInO1xyXG5leHBvcnQgKiBmcm9tICcuL3NjcmlwdC1pbXBvcnRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vcGh5c2ljcy1tYXRlcmlhbC1pbXBvcnRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vZmJ4LWltcG9ydGVyJztcclxuZXhwb3J0ICogZnJvbSAnLi9nbHRmLWltcG9ydGVyJztcclxuZXhwb3J0ICogZnJvbSAnLi9kaXJlY3RvcnktaW1wb3J0ZXInO1xyXG5leHBvcnQgKiBmcm9tICcuL2F1dG8tYXRsYXMtaW1wb3J0ZXInO1xyXG5leHBvcnQgKiBmcm9tICcuL3ByZWZhYi1pbXBvcnRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vaW1hZ2UtaW1wb3J0ZXInO1xyXG5leHBvcnQgKiBmcm9tICcuL3Nwcml0ZS1mcmFtZS1pbXBvcnRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vdGV4dHVyZS1jdWJlLWltcG9ydGVyJztcclxuZXhwb3J0ICogZnJvbSAnLi9lcnAtdGV4dHVyZS1jdWJlLWltcG9ydGVyJztcclxuZXhwb3J0ICogZnJvbSAnLi9yZW5kZXItdGV4dHVyZS1pbXBvcnRlcic7XHJcbmV4cG9ydCAqIGZyb20gJy4vcHJvamVjdC1zZXR0aW5ncy1pbXBvcnRlcic7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJBbGxJbXBvcnRlcnMoKSB7XHJcbiAgICBjb25zdCBtYW5hZ2VyID0gSW1wb3J0ZXJNYW5hZ2VyLmdldEluc3RhbmNlKCk7XHJcbiAgICBcclxuICAgIC8vIFByb2plY3QgU2V0dGluZ3NcclxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgUHJvamVjdFNldHRpbmdzSW1wb3J0ZXIoKSk7XHJcblxyXG4gICAgLy8gTWF0ZXJpYWxcclxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgTWF0ZXJpYWxJbXBvcnRlcigpKTtcclxuICAgIFxyXG4gICAgLy8gU2NyaXB0c1xyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBTY3JpcHRJbXBvcnRlcigpKTsgLy8gdHlwZXNjcmlwdFxyXG5cclxuICAgIC8vIFByZWZhYlxyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBQcmVmYWJJbXBvcnRlcigpKTtcclxuICAgIFxyXG4gICAgLy8gVGV4dHVyZXMgJiBJbWFnZXNcclxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgSW1hZ2VJbXBvcnRlcigpKTtcclxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgVGV4dHVyZUltcG9ydGVyKCkpO1xyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBTcHJpdGVGcmFtZUltcG9ydGVyKCkpO1xyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBUZXh0dXJlQ3ViZUltcG9ydGVyKCkpO1xyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBFcnBUZXh0dXJlQ3ViZUltcG9ydGVyKCkpO1xyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBSZW5kZXJUZXh0dXJlSW1wb3J0ZXIoKSk7XHJcbiAgICBcclxuICAgIC8vIE90aGVyXHJcbiAgICBtYW5hZ2VyLnJlZ2lzdGVySW1wb3J0ZXIobmV3IFBoeXNpY3NNYXRlcmlhbEltcG9ydGVyKCkpO1xyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBGYnhJbXBvcnRlcigpKTtcclxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgR2x0ZkltcG9ydGVyKCkpO1xyXG4gICAgbWFuYWdlci5yZWdpc3RlckltcG9ydGVyKG5ldyBEaXJlY3RvcnlJbXBvcnRlcigpKTtcclxuICAgIG1hbmFnZXIucmVnaXN0ZXJJbXBvcnRlcihuZXcgQXV0b0F0bGFzSW1wb3J0ZXIoKSk7XHJcbn1cclxuIl19