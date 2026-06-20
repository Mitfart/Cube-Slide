"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FbxImporter = void 0;
const model_base_importer_1 = require("./model-base-importer");
class FbxImporter extends model_base_importer_1.ModelBaseImporter {
    constructor() {
        super(...arguments);
        this.name = 'fbx';
    }
    addSpecificUserData(userData, container) {
        const fbx = userData.fbx || {};
        container.animationBakeRate = {
            value: fbx.animationBakeRate,
            type: 'Enum',
            enumList: [
                { name: 'Auto', value: 0 },
                { name: 'BakeRate24', value: 24 },
                { name: 'BakeRate25', value: 25 },
                { name: 'BakeRate30', value: 30 },
                { name: 'BakeRate60', value: 60 }
            ],
            tooltip: 'Specify the animation bake sample rate in frames per second (fps).'
        };
        container.preferLocalTimeSpan = {
            value: !!fbx.preferLocalTimeSpan,
            type: 'Boolean',
            tooltip: 'When exporting FBX animations, whether prefer to use the time range recorded in FBX file.<br>If one is not preferred, or one is invalid for use, the time range is robustly calculated.<br>Some FBX generators may not export this information.'
        };
        container.smartMaterialEnabled = {
            value: !!fbx.smartMaterialEnabled,
            type: 'Boolean',
            tooltip: 'Convert DCC materials to engine builtin materials which match the internal lighting model.'
        };
        container.legacyFbxImporter = {
            value: !!userData.legacyFbxImporter,
            type: 'Boolean',
        };
    }
}
exports.FbxImporter = FbxImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmJ4LWltcG9ydGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc291cmNlL3V0Y3AvdXRpbHMvYXNzZXQtaW1wb3J0ZXJzL2ZieC1pbXBvcnRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQSwrREFBMEQ7QUFHMUQsTUFBYSxXQUFZLFNBQVEsdUNBQWlCO0lBQWxEOztRQUNJLFNBQUksR0FBRyxLQUFLLENBQUM7SUFtQ2pCLENBQUM7SUFqQ2EsbUJBQW1CLENBQUMsUUFBYSxFQUFFLFNBQXVDO1FBQ2hGLE1BQU0sR0FBRyxHQUFHLFFBQVEsQ0FBQyxHQUFHLElBQUksRUFBRSxDQUFDO1FBRS9CLFNBQVMsQ0FBQyxpQkFBaUIsR0FBRztZQUMxQixLQUFLLEVBQUUsR0FBRyxDQUFDLGlCQUFpQjtZQUM1QixJQUFJLEVBQUUsTUFBTTtZQUNaLFFBQVEsRUFBRTtnQkFDTixFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsS0FBSyxFQUFFLENBQUMsRUFBRTtnQkFDMUIsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7Z0JBQ2pDLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUUsRUFBRSxFQUFFO2dCQUNqQyxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRTtnQkFDakMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7YUFDcEM7WUFDRCxPQUFPLEVBQUUsb0VBQW9FO1NBQ2hGLENBQUM7UUFFRixTQUFTLENBQUMsbUJBQW1CLEdBQUc7WUFDNUIsS0FBSyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsbUJBQW1CO1lBQ2hDLElBQUksRUFBRSxTQUFTO1lBQ2YsT0FBTyxFQUFFLGlQQUFpUDtTQUM3UCxDQUFDO1FBRUYsU0FBUyxDQUFDLG9CQUFvQixHQUFHO1lBQzVCLEtBQUssRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLG9CQUFvQjtZQUNqQyxJQUFJLEVBQUUsU0FBUztZQUNmLE9BQU8sRUFBRSw0RkFBNEY7U0FDekcsQ0FBQztRQUVGLFNBQVMsQ0FBQyxpQkFBaUIsR0FBRztZQUN6QixLQUFLLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUI7WUFDbkMsSUFBSSxFQUFFLFNBQVM7U0FDbkIsQ0FBQztJQUNOLENBQUM7Q0FDSjtBQXBDRCxrQ0FvQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBNb2RlbEJhc2VJbXBvcnRlciB9IGZyb20gJy4vbW9kZWwtYmFzZS1pbXBvcnRlcic7XHJcbmltcG9ydCB7IElQcm9wZXJ0eSB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9zY2VuZS9AdHlwZXMvcHVibGljJztcclxuXHJcbmV4cG9ydCBjbGFzcyBGYnhJbXBvcnRlciBleHRlbmRzIE1vZGVsQmFzZUltcG9ydGVyIHtcclxuICAgIG5hbWUgPSAnZmJ4JztcclxuXHJcbiAgICBwcm90ZWN0ZWQgYWRkU3BlY2lmaWNVc2VyRGF0YSh1c2VyRGF0YTogYW55LCBjb250YWluZXI6IHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5IH0pOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBmYnggPSB1c2VyRGF0YS5mYnggfHwge307XHJcbiAgICAgICAgXHJcbiAgICAgICAgY29udGFpbmVyLmFuaW1hdGlvbkJha2VSYXRlID0ge1xyXG4gICAgICAgICAgICB2YWx1ZTogZmJ4LmFuaW1hdGlvbkJha2VSYXRlLFxyXG4gICAgICAgICAgICB0eXBlOiAnRW51bScsXHJcbiAgICAgICAgICAgIGVudW1MaXN0OiBbXHJcbiAgICAgICAgICAgICAgICB7IG5hbWU6ICdBdXRvJywgdmFsdWU6IDAgfSxcclxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Jha2VSYXRlMjQnLCB2YWx1ZTogMjQgfSxcclxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Jha2VSYXRlMjUnLCB2YWx1ZTogMjUgfSxcclxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Jha2VSYXRlMzAnLCB2YWx1ZTogMzAgfSxcclxuICAgICAgICAgICAgICAgIHsgbmFtZTogJ0Jha2VSYXRlNjAnLCB2YWx1ZTogNjAgfVxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgICB0b29sdGlwOiAnU3BlY2lmeSB0aGUgYW5pbWF0aW9uIGJha2Ugc2FtcGxlIHJhdGUgaW4gZnJhbWVzIHBlciBzZWNvbmQgKGZwcykuJ1xyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnRhaW5lci5wcmVmZXJMb2NhbFRpbWVTcGFuID0ge1xyXG4gICAgICAgICAgICB2YWx1ZTogISFmYngucHJlZmVyTG9jYWxUaW1lU3BhbixcclxuICAgICAgICAgICAgdHlwZTogJ0Jvb2xlYW4nLFxyXG4gICAgICAgICAgICB0b29sdGlwOiAnV2hlbiBleHBvcnRpbmcgRkJYIGFuaW1hdGlvbnMsIHdoZXRoZXIgcHJlZmVyIHRvIHVzZSB0aGUgdGltZSByYW5nZSByZWNvcmRlZCBpbiBGQlggZmlsZS48YnI+SWYgb25lIGlzIG5vdCBwcmVmZXJyZWQsIG9yIG9uZSBpcyBpbnZhbGlkIGZvciB1c2UsIHRoZSB0aW1lIHJhbmdlIGlzIHJvYnVzdGx5IGNhbGN1bGF0ZWQuPGJyPlNvbWUgRkJYIGdlbmVyYXRvcnMgbWF5IG5vdCBleHBvcnQgdGhpcyBpbmZvcm1hdGlvbi4nXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgY29udGFpbmVyLnNtYXJ0TWF0ZXJpYWxFbmFibGVkID0ge1xyXG4gICAgICAgICAgICAgdmFsdWU6ICEhZmJ4LnNtYXJ0TWF0ZXJpYWxFbmFibGVkLFxyXG4gICAgICAgICAgICAgdHlwZTogJ0Jvb2xlYW4nLFxyXG4gICAgICAgICAgICAgdG9vbHRpcDogJ0NvbnZlcnQgRENDIG1hdGVyaWFscyB0byBlbmdpbmUgYnVpbHRpbiBtYXRlcmlhbHMgd2hpY2ggbWF0Y2ggdGhlIGludGVybmFsIGxpZ2h0aW5nIG1vZGVsLidcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb250YWluZXIubGVnYWN5RmJ4SW1wb3J0ZXIgPSB7XHJcbiAgICAgICAgICAgICB2YWx1ZTogISF1c2VyRGF0YS5sZWdhY3lGYnhJbXBvcnRlcixcclxuICAgICAgICAgICAgIHR5cGU6ICdCb29sZWFuJyxcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG59XHJcbiJdfQ==