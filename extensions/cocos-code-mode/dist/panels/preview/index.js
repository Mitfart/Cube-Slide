"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const templateRaw = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/preview/index.html'), 'utf-8');
const styleRaw = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/preview/index.css'), 'utf-8');
module.exports = Editor.Panel.define({
    template: templateRaw,
    style: styleRaw,
    $: {
        container: '#preview-container',
    },
    listeners: {},
    methods: {
        async generatePreview(uuid, width = 512, height = 512, jpegQuality = 80) {
            try {
                const info = await Editor.Message.request('asset-db', 'query-asset-info', uuid);
                if (!info)
                    throw new Error("Asset info not found");
                let previewType = '';
                let queryMethod = '';
                switch (info.importer) {
                    case 'prefab':
                    case 'fbx':
                    case 'gltf':
                    case 'gltf-skeleton':
                        previewType = 'scene:prefab-preview';
                        queryMethod = 'query-prefab-preview-data';
                        break;
                    case 'material':
                        previewType = 'scene:material-preview';
                        queryMethod = 'query-material-preview-data';
                        break;
                    case 'gltf-mesh':
                    case 'mesh':
                        previewType = 'scene:mesh-preview';
                        queryMethod = 'query-mesh-preview-data';
                        break;
                    case 'spine':
                        previewType = 'scene:spine-preview';
                        queryMethod = 'query-spine-preview-data';
                        break;
                    default:
                        previewType = 'scene:mini-preview';
                        queryMethod = 'query-scene-preview-data';
                        break;
                }
                // @ts-ignore
                const GLPreview = Editor._Module.require('PreviewExtends').default;
                const glPreview = new GLPreview(previewType, queryMethod);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                await glPreview.init({ width, height });
                await glPreview.initGL(canvas, { width, height });
                await glPreview.resizeGL(width, height);
                // Set Target
                const call = async (func, ...args) => {
                    return await Editor.Message.request('scene', 'call-preview-function', previewType, func, ...args);
                };
                if (info.importer === 'prefab' || info.importer === 'scene' || info.importer === 'fbx' || info.importer === 'gltf') {
                    await call('setPrefab', uuid);
                }
                else if (info.importer === 'material') {
                    // Match Inspector implementation
                    await call('resetCamera');
                    await call('setLightEnable', true);
                    await call('setPrimitive', 'sphere');
                    await Editor.Message.request('scene', 'preview-material', uuid);
                }
                else if (info.importer === 'gltf-mesh') {
                    await call('setModel', uuid);
                }
                else if (info.importer === 'spine') {
                    await call('setSpine', uuid);
                }
                else {
                    await call('setScene', uuid);
                }
                // Draw
                const data = await glPreview.queryPreviewData({ width, height });
                glPreview.drawGL(data);
                const dataURL = canvas.toDataURL('image/jpeg', jpegQuality);
                return dataURL.replace(/^data:image\/\w+;base64,/, '');
            }
            catch (error) {
                console.error(`[Preview] Error:`, error);
                throw new Error(`Generaton failed: ${error.message}`);
            }
        },
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL3ByZXZpZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSwyQkFBa0M7QUFDbEMsK0JBQTRCO0FBRTVCLE1BQU0sV0FBVyxHQUFHLElBQUEsaUJBQVksRUFBQyxJQUFBLFdBQUksRUFBQyxTQUFTLEVBQUUsNkNBQTZDLENBQUMsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMxRyxNQUFNLFFBQVEsR0FBRyxJQUFBLGlCQUFZLEVBQUMsSUFBQSxXQUFJLEVBQUMsU0FBUyxFQUFFLHlDQUF5QyxDQUFDLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFFbkcsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztJQUNqQyxRQUFRLEVBQUUsV0FBVztJQUNyQixLQUFLLEVBQUUsUUFBUTtJQUNmLENBQUMsRUFBRTtRQUNDLFNBQVMsRUFBRSxvQkFBb0I7S0FDbEM7SUFFRCxTQUFTLEVBQUUsRUFDVjtJQUVELE9BQU8sRUFBRTtRQUNMLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBWSxFQUFFLFFBQWdCLEdBQUcsRUFBRSxTQUFpQixHQUFHLEVBQUUsY0FBc0IsRUFBRTtZQUNuRyxJQUFJLENBQUM7Z0JBQ0QsTUFBTSxJQUFJLEdBQUcsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ2hGLElBQUksQ0FBQyxJQUFJO29CQUFFLE1BQU0sSUFBSSxLQUFLLENBQUMsc0JBQXNCLENBQUMsQ0FBQztnQkFFbkQsSUFBSSxXQUFXLEdBQUcsRUFBRSxDQUFDO2dCQUNyQixJQUFJLFdBQVcsR0FBRyxFQUFFLENBQUM7Z0JBRXJCLFFBQVEsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO29CQUNwQixLQUFLLFFBQVEsQ0FBQztvQkFDZCxLQUFL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TUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNqQyxDQUFDO3FCQUFNLENBQUM7b0JBQ0gsTUFBTSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNsQyxDQUFDO2dCQUVELE9BQU87Z0JBQ1AsTUFBTSxJQUFJLEdBQUcsTUFBTSxTQUFTLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxLQUFLLEVBQUUsTUFBTSxFQUFFLENBQUMsQ0FBQztnQkFFakUsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFFdkIsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsV0FBVyxDQUFDLENBQUM7Z0JBRTVELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQywwQkFBMEIsRUFBRSxFQUFFLENBQUMsQ0FBQztZQUUzRCxDQUFDO1lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztnQkFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDekMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQkFBcUIsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUM7WUFDMUQsQ0FBQztRQUNMLENBQUM7S0FDSjtDQUNHLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xyXG5cclxuY29uc3QgdGVtcGxhdGVSYXcgPSByZWFkRmlsZVN5bmMoam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi9zdGF0aWMvdGVtcGxhdGUvcHJldmlldy9pbmRleC5odG1sJyksICd1dGYtOCcpO1xyXG5jb25zdCBzdHlsZVJhdyA9IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy9zdHlsZS9wcmV2aWV3L2luZGV4LmNzcycpLCAndXRmLTgnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gRWRpdG9yLlBhbmVsLmRlZmluZSh7XHJcbiAgICB0ZW1wbGF0ZTogdGVtcGxhdGVSYXcsXHJcbiAgICBzdHlsZTogc3R5bGVSYXcsXHJcbiAgICAkOiB7XHJcbiAgICAgICAgY29udGFpbmVyOiAnI3ByZXZpZXctY29udGFpbmVyJyxcclxuICAgIH0sXHJcbiAgICBcclxuICAgIGxpc3RlbmVyczoge1xyXG4gICAgfSxcclxuICAgIFxyXG4gICAgbWV0aG9kczoge1xyXG4gICAgICAgIGFzeW5jIGdlbmVyYXRlUHJldmlldyh1dWlkOiBzdHJpbmcsIHdpZHRoOiBudW1iZXIgPSA1MTIsIGhlaWdodDogbnVtYmVyID0gNTEyLCBqcGVnUXVhbGl0eTogbnVtYmVyID0gODApOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaW5mbyA9IGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ2Fzc2V0LWRiJywgJ3F1ZXJ5LWFzc2V0LWluZm8nLCB1dWlkKTtcclxuICAgICAgICAgICAgICAgIGlmICghaW5mbykgdGhyb3cgbmV3IEVycm9yKFwiQXNzZXQgaW5mbyBub3QgZm91bmRcIik7XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIGxldCBwcmV2aWV3VHlwZSA9ICcnO1xyXG4gICAgICAgICAgICAgICAgbGV0IHF1ZXJ5TWV0aG9kID0gJyc7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIHN3aXRjaCAoaW5mby5pbXBvcnRlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgJ3ByZWZhYic6XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZmJ4JzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdnbHRmJzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdnbHRmLXNrZWxldG9uJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlld1R5cGUgPSAnc2NlbmU6cHJlZmFiLXByZXZpZXcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeU1ldGhvZCA9ICdxdWVyeS1wcmVmYWItcHJldmlldy1kYXRhJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnbWF0ZXJpYWwnOlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aWV3VHlwZSA9ICdzY2VuZTptYXRlcmlhbC1wcmV2aWV3JztcclxuICAgICAgICAgICAgICAgICAgICAgICAgcXVlcnlNZXRob2QgPSAncXVlcnktbWF0ZXJpYWwtcHJldmlldy1kYXRhJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FzZSAnZ2x0Zi1tZXNoJzpcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdtZXNoJzpcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJldmlld1R5cGUgPSAnc2NlbmU6bWVzaC1wcmV2aWV3JztcclxuICAgICAgICAgICAgICAgICAgICAgICAgcXVlcnlNZXRob2QgPSAncXVlcnktbWVzaC1wcmV2aWV3LWRhdGEnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBjYXNlICdzcGluZSc6XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByZXZpZXdUeXBlID0gJ3NjZW5lOnNwaW5lLXByZXZpZXcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeU1ldGhvZCA9ICdxdWVyeS1zcGluZS1wcmV2aWV3LWRhdGEnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcmV2aWV3VHlwZSA9ICdzY2VuZTptaW5pLXByZXZpZXcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBxdWVyeU1ldGhvZCA9ICdxdWVyeS1zY2VuZS1wcmV2aWV3LWRhdGEnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxyXG4gICAgICAgICAgICAgICAgY29uc3QgR0xQcmV2aWV3ID0gRWRpdG9yLl9Nb2R1bGUucmVxdWlyZSgnUHJldmlld0V4dGVuZHMnKS5kZWZhdWx0O1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZ2xQcmV2aWV3ID0gbmV3IEdMUHJldmlldyhwcmV2aWV3VHlwZSwgcXVlcnlNZXRob2QpO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTtcclxuICAgICAgICAgICAgICAgIGNhbnZhcy53aWR0aCA9IHdpZHRoO1xyXG4gICAgICAgICAgICAgICAgY2FudmFzLmhlaWdodCA9IGhlaWdodDtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgYXdhaXQgZ2xQcmV2aWV3LmluaXQoeyB3aWR0aCwgaGVpZ2h0IH0pO1xyXG4gICAgICAgICAgICAgICAgYXdhaXQgZ2xQcmV2aWV3LmluaXRHTChjYW52YXMsIHsgd2lkdGgsIGhlaWdodCB9KTtcclxuICAgICAgICAgICAgICAgIGF3YWl0IGdsUHJldmlldy5yZXNpemVHTCh3aWR0aCwgaGVpZ2h0KTtcclxuICAgIFxyXG4gICAgICAgICAgICAgICAgLy8gU2V0IFRhcmdldFxyXG4gICAgICAgICAgICAgICAgY29uc3QgY2FsbCA9IGFzeW5jIChmdW5jOiBzdHJpbmcsIC4uLmFyZ3M6IGFueVtdKSA9PiB7IFxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdjYWxsLXByZXZpZXctZnVuY3Rpb24nLCBwcmV2aWV3VHlwZSwgZnVuYywgLi4uYXJncyk7IFxyXG4gICAgICAgICAgICAgICAgfTtcclxuICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKGluZm8uaW1wb3J0ZXIgPT09ICdwcmVmYWInIHx8IGluZm8uaW1wb3J0ZXIgPT09ICdzY2VuZScgfHwgaW5mby5pbXBvcnRlciA9PT0gJ2ZieCcgfHwgaW5mby5pbXBvcnRlciA9PT0gJ2dsdGYnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2FsbCgnc2V0UHJlZmFiJywgdXVpZCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGluZm8uaW1wb3J0ZXIgPT09ICdtYXRlcmlhbCcpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBNYXRjaCBJbnNwZWN0b3IgaW1wbGVtZW50YXRpb25cclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBjYWxsKCdyZXNldENhbWVyYScpO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IGNhbGwoJ3NldExpZ2h0RW5hYmxlJywgdHJ1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2FsbCgnc2V0UHJpbWl0aXZlJywgJ3NwaGVyZScpO1xyXG4gICAgICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3ByZXZpZXctbWF0ZXJpYWwnLCB1dWlkKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoaW5mby5pbXBvcnRlciA9PT0gJ2dsdGYtbWVzaCcpIHtcclxuICAgICAgICAgICAgICAgICAgICBhd2FpdCBjYWxsKCdzZXRNb2RlbCcsIHV1aWQpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChpbmZvLmltcG9ydGVyID09PSAnc3BpbmUnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgYXdhaXQgY2FsbCgnc2V0U3BpbmUnLCB1dWlkKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgIGF3YWl0IGNhbGwoJ3NldFNjZW5lJywgdXVpZCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIC8vIERyYXdcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCBnbFByZXZpZXcucXVlcnlQcmV2aWV3RGF0YSh7IHdpZHRoLCBoZWlnaHQgfSk7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGdsUHJldmlldy5kcmF3R0woZGF0YSk7XHJcbiAgICBcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRhdGFVUkwgPSBjYW52YXMudG9EYXRhVVJMKCdpbWFnZS9qcGVnJywganBlZ1F1YWxpdHkpO1xyXG5cclxuICAgICAgICAgICAgICAgIHJldHVybiBkYXRhVVJMLnJlcGxhY2UoL15kYXRhOmltYWdlXFwvXFx3KztiYXNlNjQsLywgJycpO1xyXG4gICAgXHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtQcmV2aWV3XSBFcnJvcjpgLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEdlbmVyYXRvbiBmYWlsZWQ6ICR7ZXJyb3IubWVzc2FnZX1gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICB9XHJcbn0gYXMgYW55KTtcclxuIl19