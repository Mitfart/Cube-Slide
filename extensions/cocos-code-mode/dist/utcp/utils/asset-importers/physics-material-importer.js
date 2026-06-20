"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhysicsMaterialImporter = void 0;
const base_importer_1 = require("./base-importer");
class PhysicsMaterialImporter extends base_importer_1.BaseAssetImporter {
    constructor() {
        super(...arguments);
        this.name = 'physics-material';
    }
    async getProperties(assetInfo) {
        const materialMeta = await Editor.Message.request('scene', 'query-physics-material', assetInfo.uuid);
        if (!materialMeta) {
            throw new Error(`Physics material meta not found for ${assetInfo.uuid}`);
        }
        return materialMeta;
    }
    async setProperty(assetInfo, path, value) {
        let materialMeta = await Editor.Message.request('scene', 'query-physics-material', assetInfo.uuid);
        if (!materialMeta) {
            return false;
        }
        // Apply change
        if (path.includes('.')) {
            const parts = path.split('.');
            let current = materialMeta;
            for (let i = 0; i < parts.length - 1; i++) {
                current = current[parts[i]];
                if (current === undefined)
                    current = current[parts[i]].value;
                if (current === undefined)
                    return false;
            }
            const lastCurrent = current[parts[parts.length - 1]];
            if (typeof lastCurrent === 'object' && 'value' in lastCurrent) {
                current[parts[parts.length - 1]].value = value;
            }
            else {
                current[parts[parts.length - 1]] = value;
            }
        }
        else {
            if (typeof materialMeta[path] === 'object' && 'value' in materialMeta[path]) {
                materialMeta[path].value = value;
            }
            else {
                materialMeta[path] = value;
            }
        }
        materialMeta = await Editor.Message.request('scene', 'change-physics-material', materialMeta);
        await Editor.Message.request('scene', 'apply-physics-material', assetInfo.uuid, materialMeta);
        return true;
    }
}
exports.PhysicsMaterialImporter = PhysicsMaterialImporter;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGh5c2ljcy1tYXRlcmlhbC1pbXBvcnRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NvdXJjZS91dGNwL3V0aWxzL2Fzc2V0LWltcG9ydGVycy9waHlzaWNzLW1hdGVyaWFsLWltcG9ydGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLG1EQUFvRDtBQUlwRCxNQUFhLHVCQUF3QixTQUFRLGlDQUFpQjtJQUE5RDs7UUFDSSxTQUFJLEdBQUcsa0JBQWtCLENBQUM7SUE4QzlCLENBQUM7SUE1Q0csS0FBSyxDQUFDLGFBQWEsQ0FBQyxTQUFxQjtRQUNyQyxNQUFNLFlBQVksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFckcsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1lBQ2hCLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXVDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQzdFLENBQUM7UUFFRCxPQUFPLFlBQVksQ0FBQztJQUN4QixDQUFDO0lBRUQsS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFxQixFQUFFLElBQVksRUFBRSxLQUFVO1FBQzdELElBQUksWUFBWSxHQUFHLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLHdCQUF3QixFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDaEIsT0FBTyxLQUFLLENBQUM7UUFDakIsQ0FBQztRQUVELGVBQWU7UUFDZixJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQztZQUNyQixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzlCLElBQUksT0FBTyxHQUFHLFlBQVksQ0FBQztZQUMzQixLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQztnQkFDeEMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDNUIsSUFBSSxPQUFPLEtBQUssU0FBUztvQkFBRSxPQUFPLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztnQkFDN0QsSUFBSSxPQUFPLEtBQUssU0FBUztvQkFBRSxPQUFPLEtBQUssQ0FBQztZQUM1QyxDQUFDO1lBQ0QsTUFBTSxXQUFXLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDckQsSUFBSSxPQUFPLFdBQVcsS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLFdBQVcsRUFBRSxDQUFDO2dCQUM1RCxPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1lBQ25ELENBQUM7aUJBQU0sQ0FBQztnQkFDSixPQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLENBQUM7WUFDN0MsQ0FBQztRQUNMLENBQUM7YUFBTSxDQUFDO1lBQ0osSUFBSSxPQUFPLFlBQVksQ0FBQyxJQUFJLENBQUMsS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUMxRSxZQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQztZQUNyQyxDQUFDO2lCQUFNLENBQUM7Z0JBQ0osWUFBWSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQztZQUMvQixDQUFDO1FBQ0wsQ0FBQztRQUVELFlBQVksR0FBRyxNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSx5QkFBeUIsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUU5RixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxTQUFTLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzlGLE9BQU8sSUFBSSxDQUFDO0lBQ2hCLENBQUM7Q0FDSjtBQS9DRCwwREErQ0MiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlQXNzZXRJbXBvcnRlciB9IGZyb20gJy4vYmFzZS1pbXBvcnRlcic7XHJcbmltcG9ydCB7IElBc3NldEluZm8gfSBmcm9tICdAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvYXNzZXQtZGIvQHR5cGVzL3B1YmxpYyc7XHJcbmltcG9ydCB7IElQcm9wZXJ0eVZhbHVlVHlwZSB9IGZyb20gJ0Bjb2Nvcy9jcmVhdG9yLXR5cGVzL2VkaXRvci9wYWNrYWdlcy9zY2VuZS9AdHlwZXMvcHVibGljJztcclxuXHJcbmV4cG9ydCBjbGFzcyBQaHlzaWNzTWF0ZXJpYWxJbXBvcnRlciBleHRlbmRzIEJhc2VBc3NldEltcG9ydGVyIHtcclxuICAgIG5hbWUgPSAncGh5c2ljcy1tYXRlcmlhbCc7XHJcblxyXG4gICAgYXN5bmMgZ2V0UHJvcGVydGllcyhhc3NldEluZm86IElBc3NldEluZm8pOiBQcm9taXNlPHsgW2tleTogc3RyaW5nXTogSVByb3BlcnR5VmFsdWVUeXBlIH0+IHtcclxuICAgICAgICBjb25zdCBtYXRlcmlhbE1ldGEgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1waHlzaWNzLW1hdGVyaWFsJywgYXNzZXRJbmZvLnV1aWQpO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICghbWF0ZXJpYWxNZXRhKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgUGh5c2ljcyBtYXRlcmlhbCBtZXRhIG5vdCBmb3VuZCBmb3IgJHthc3NldEluZm8udXVpZH1gKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBtYXRlcmlhbE1ldGE7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgc2V0UHJvcGVydHkoYXNzZXRJbmZvOiBJQXNzZXRJbmZvLCBwYXRoOiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgICAgICBsZXQgbWF0ZXJpYWxNZXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktcGh5c2ljcy1tYXRlcmlhbCcsIGFzc2V0SW5mby51dWlkKTtcclxuICAgICAgICBpZiAoIW1hdGVyaWFsTWV0YSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyBBcHBseSBjaGFuZ2VcclxuICAgICAgICBpZiAocGF0aC5pbmNsdWRlcygnLicpKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xyXG4gICAgICAgICAgICBsZXQgY3VycmVudCA9IG1hdGVyaWFsTWV0YTtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGggLSAxOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGN1cnJlbnQgPSBjdXJyZW50W3BhcnRzW2ldXTtcclxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQpIGN1cnJlbnQgPSBjdXJyZW50W3BhcnRzW2ldXS52YWx1ZTtcclxuICAgICAgICAgICAgICAgIGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQpIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBsYXN0Q3VycmVudCA9IGN1cnJlbnRbcGFydHNbcGFydHMubGVuZ3RoIC0gMV1dO1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGxhc3RDdXJyZW50ID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIGxhc3RDdXJyZW50KSB7XHJcbiAgICAgICAgICAgICAgICBjdXJyZW50W3BhcnRzW3BhcnRzLmxlbmd0aCAtIDFdXS52YWx1ZSA9IHZhbHVlO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY3VycmVudFtwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgbWF0ZXJpYWxNZXRhW3BhdGhdID09PSAnb2JqZWN0JyAmJiAndmFsdWUnIGluIG1hdGVyaWFsTWV0YVtwYXRoXSkge1xyXG4gICAgICAgICAgICAgICAgbWF0ZXJpYWxNZXRhW3BhdGhdLnZhbHVlID0gdmFsdWU7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBtYXRlcmlhbE1ldGFbcGF0aF0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgbWF0ZXJpYWxNZXRhID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnY2hhbmdlLXBoeXNpY3MtbWF0ZXJpYWwnLCBtYXRlcmlhbE1ldGEpO1xyXG5cclxuICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdhcHBseS1waHlzaWNzLW1hdGVyaWFsJywgYXNzZXRJbmZvLnV1aWQsIG1hdGVyaWFsTWV0YSk7XHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbn1cclxuIl19