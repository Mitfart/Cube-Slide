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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditorTools = void 0;
const decorators_1 = require("../decorators");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const schemas_1 = require("../schemas");
class EditorTools {
    async editorOperate(args) {
        switch (args.operation) {
            case 'save_scene_or_prefab':
                await Editor.Message.request('scene', 'save-scene');
                return { success: true };
            case 'close_scene_or_prefab':
                await Editor.Message.request('scene', 'close-scene');
                return { success: true };
            case 'play_preview':
                await Editor.Message.request('scene', 'editor-preview-set-play', true);
                return { success: true };
            case 'pause':
                await Editor.Message.request('scene', 'editor-preview-call-method', 'pause', true);
                return { success: true };
            case 'step':
                await Editor.Message.request('scene', 'editor-preview-call-method', 'step');
                return { success: true };
            case 'stop':
                await Editor.Message.request('scene', 'editor-preview-set-play', false);
                return { success: true };
            case 'refresh':
                await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets');
                return { success: true };
            default:
                throw new Error(`Unknown operation: ${args.operation}`);
        }
    }
    async editorGetLogs(args) {
        const projectPath = Editor.Project.path;
        const logPath = path.join(projectPath, 'temp', 'logs', 'project.log');
        if (args.showStack === undefined) {
            args.showStack = false;
        }
        if (!fs.existsSync(logPath)) {
            throw new Error(`Log file not found at ${logPath}`);
        }
        const entries = [];
        const fd = fs.openSync(logPath, 'r');
        try {
            const stats = fs.fstatSync(fd);
            const fileSize = stats.size;
            const bufferSize = 10 * 1024; // 10KB chunks
            const buffer = Buffer.alloc(bufferSize);
            let position = fileSize;
            let leftover = '';
            let accumulatedBody = ''; // Text belonging to the current (bottom-most) entry being parsed
            const regex = /^(\d{1,2}-\d{1,2}-\d{4}\s\d{2}:\d{2}:\d{2}\s-\s(?:log|warn|error|info):\s)/;
            const timestampRegex = /^\d{1,2}-\d{1,2}-\d{4}\s\d{2}:\d{2}:\d{2}\s-\s/;
            let lastContent = null;
            let lastCount = 0;
            while (position > 0 && entries.length < args.count) {
                const readSize = Math.min(bufferSize, position);
                const readPos = position - readSize;
                fs.readSync(fd, buffer, 0, readSize, readPos);
                position -= readSize;
                const chunk = buffer.toString('utf-8', 0, readSize);
                const combined = chunk + leftover;
                // Split by newline
                const lines = combined.split(/\r?\n/);
                if (position > 0) {
                    leftover = lines.shift() || '';
                }
                else {
                    leftover = ''; // Process all
                }
                // Process lines in reverse (bottom to top of the chunk)
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i];
                    // Check if this line is a Header (Start of Entry)
                    if (regex.test(line)) {
                        let entry = line;
                        if (args.showStack && accumulatedBody.length > 0) {
                            entry += '\n' + accumulatedBody;
                        }
                        const cleaned = entry.replace(timestampRegex, '');
                        if (cleaned === lastContent) {
                            lastCount++;
                            entries[entries.length - 1] = `(${lastCount}) ${cleaned}`;
                        }
                        else {
                            if (entries.length >= args.count) {
                                // Found a new group but we already have enough
                                position = 0; // Stop reading file loop
                                break; // Stop lines loop
                            }
                            lastContent = cleaned;
                            lastCount = 1;
                            entries.push(cleaned);
                        }
                        accumulatedBody = ''; // Reset for the next entry (upwards)
                    }
                    else {
                        // This identifies as body text (or empty line) belonging to the entry "above" it
                        if (args.showStack && accumulatedBody.length > 0) {
                            accumulatedBody = line + '\n' + accumulatedBody;
                        }
                        else {
                            accumulatedBody = line;
                        }
                    }
                }
            }
        }
        finally {
            fs.closeSync(fd);
        }
        // We pushed entries in reverse order (newest first).
        if (args.order === 'oldest-to-newest') {
            return { logLines: entries.reverse() };
        }
        return { logLines: entries };
    }
}
exports.EditorTools = EditorTools;
__decorate([
    (0, decorators_1.utcpTool)('editorOperate', 'Common editor operations for scene and prefab view, game preview controls and asset database refresh', {
        type: 'object',
        properties: {
            operation: { type: 'string', enum: ['save_scene_or_prefab', 'close_scene_or_prefab', 'play_preview', 'pause', 'step', 'stop', 'refresh'] }
        },
        required: ['operation']
    }, schemas_1.SuccessIndicatorSchema, "POST", ['operation', 'editor', 'scene', 'prefab', 'preview', 'asset', 'refresh'])
], EditorTools.prototype, "editorOperate", null);
__decorate([
    (0, decorators_1.utcpTool)('editorGetLogs', 'Get last N editor log entries', {
        type: 'object',
        properties: {
            count: { type: 'number', description: 'Number of log entries to retrieve', default: 10 },
            showStack: { type: 'boolean', description: 'Return full stack trace for each log entry' },
            order: { type: 'string', enum: ['newest-to-oldest', 'oldest-to-newest'], description: 'Order of logs', default: 'newest-to-oldest' }
        },
        required: ['count', 'order']
    }, { type: 'object', properties: { logLines: { type: 'array', items: { type: 'string' } } }, required: ['logLines'] }, "GET", ['editor', 'logs', 'debug', 'info'])
], EditorTools.prototype, "editorGetLogs", null);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZWRpdG9yLXRvb2xzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc291cmNlL3V0Y3AvdG9vbHMvZWRpdG9yLXRvb2xzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDhDQUF5QztBQUN6Qyx1Q0FBeUI7QUFDekIsMkNBQTZCO0FBQzdCLHdDQUF1RTtBQUV2RSxNQUFhLFdBQVc7SUFjZCxBQUFOLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBMkI7UUFDM0MsUUFBUSxJQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7WUFDckIsS0FBSyxzQkFBc0I7Z0JBQ3ZCLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFlBQVksQ0FBQyxDQUFDO2dCQUNwRCxPQUFPLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFDO1lBQzdCLEtBQUssdUJBQXVCO2dCQUN4QixNQUFNLE1BQU0sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztnQkFDckQsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUM3QixLQUFLLGNBQWM7Z0JBQ2YsTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUseUJBQXlCLEVBQUUsSUFBSSxDQUFDLENBQUM7Z0JBQ3ZFLE9BQU8sRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUM7WUFDN0IsS0FBSyxPQUFPO2dCQUNSLE1BQU0sTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLDRCQUE0QixFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztnQkFDbkYsT0FBTyxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBQztZQUM3QixLQUFLLE1BQU07Z0JBQ04sTUFBTSxNQUFNLENBQUMsT0FBTyxDQUFDLE9B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cnMnO1xyXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IElTdWNjZXNzSW5kaWNhdG9yLCBTdWNjZXNzSW5kaWNhdG9yU2NoZW1hIH0gZnJvbSAnLi4vc2NoZW1hcyc7XHJcblxyXG5leHBvcnQgY2xhc3MgRWRpdG9yVG9vbHMge1xyXG5cclxuICAgIEB1dGNwVG9vbChcclxuICAgICAgICAnZWRpdG9yT3BlcmF0ZScsXHJcbiAgICAgICAgJ0NvbW1vbiBlZGl0b3Igb3BlcmF0aW9ucyBmb3Igc2NlbmUgYW5kIHByZWZhYiB2aWV3LCBnYW1lIHByZXZpZXcgY29udHJvbHMgYW5kIGFzc2V0IGRhdGFiYXNlIHJlZnJlc2gnLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIG9wZXJhdGlvbjogeyB0eXBlOiAnc3RyaW5nJywgZW51bTogWydzYXZlX3NjZW5lX29yX3ByZWZhYicsICdjbG9zZV9zY2VuZV9vcl9wcmVmYWInLCAncGxheV9wcmV2aWV3JywgJ3BhdXNlJywgJ3N0ZXAnLCAnc3RvcCcsICdyZWZyZXNoJ10gfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICByZXF1aXJlZDogWydvcGVyYXRpb24nXVxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgU3VjY2Vzc0luZGljYXRvclNjaGVtYSwgXCJQT1NUXCIsICBbJ29wZXJhdGlvbicsICdlZGl0b3InLCAnc2NlbmUnLCAncHJlZmFiJywgJ3ByZXZpZXcnLCAnYXNzZXQnLCAncmVmcmVzaCddXHJcbiAgICApXHJcbiAgICBhc3luYyBlZGl0b3JPcGVyYXRlKGFyZ3M6IHsgb3BlcmF0aW9uOiBzdHJpbmcgfSk6IFByb21pc2U8SVN1Y2Nlc3NJbmRpY2F0b3I+IHtcclxuICAgICAgICBzd2l0Y2ggKGFyZ3Mub3BlcmF0aW9uKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ3NhdmVfc2NlbmVfb3JfcHJlZmFiJzpcclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NhdmUtc2NlbmUnKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiB7IHN1Y2Nlc3M6IHRydWUgfTtcclxuICAgICAgICAgICAgY2FzZSAnY2xvc2Vfc2NlbmVfb3JfcHJlZmFiJzpcclxuICAgICAgICAgICAgICAgIGF3YWl0IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ2Nsb3NlLXNjZW5lJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XHJcbiAgICAgICAgICAgIGNhc2UgJ3BsYXlfcHJldmlldyc6XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdlZGl0b3ItcHJldmlldy1zZXQtcGxheScsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG4gICAgICAgICAgICBjYXNlICdwYXVzZSc6XHJcbiAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdlZGl0b3ItcHJldmlldy1jYWxsLW1ldGhvZCcsICdwYXVzZScsIHRydWUpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG4gICAgICAgICAgICBjYXNlICdzdGVwJzpcclxuICAgICAgICAgICAgICAgICBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdlZGl0b3ItcHJldmlldy1jYWxsLW1ldGhvZCcsICdzdGVwJyk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XHJcbiAgICAgICAgICAgIGNhc2UgJ3N0b3AnOlxyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAnZWRpdG9yLXByZXZpZXctc2V0LXBsYXknLCBmYWxzZSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4geyBzdWNjZXNzOiB0cnVlIH07XHJcbiAgICAgICAgICAgIGNhc2UgJ3JlZnJlc2gnOlxyXG4gICAgICAgICAgICAgICAgYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnYXNzZXQtZGInLCAncmVmcmVzaC1hc3NldCcsICdkYjovL2Fzc2V0cycpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgc3VjY2VzczogdHJ1ZSB9O1xyXG4gICAgICAgICAgICBkZWZhdWx0OlxyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIG9wZXJhdGlvbjogJHthcmdzLm9wZXJhdGlvbn1gKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgQHV0Y3BUb29sKFxyXG4gICAgICAgICdlZGl0b3JHZXRMb2dzJyxcclxuICAgICAgICAnR2V0IGxhc3QgTiBlZGl0b3IgbG9nIGVudHJpZXMnLFxyXG4gICAgICAgIHtcclxuICAgICAgICAgICAgdHlwZTogJ29iamVjdCcsXHJcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcclxuICAgICAgICAgICAgICAgIGNvdW50OiB7IHR5cGU6ICdudW1iZXInLCBkZXNjcmlwdGlvbjogJ051bWJlciBvZiBsb2cgZW50cmllcyB0byByZXRyaWV2ZScsIGRlZmF1bHQ6IDEwIH0sXHJcbiAgICAgICAgICAgICAgICBzaG93U3RhY2s6IHsgdHlwZTogJ2Jvb2xlYW4nLCBkZXNjcmlwdGlvbjogJ1JldHVybiBmdWxsIHN0YWNrIHRyYWNlIGZvciBlYWNoIGxvZyBlbnRyeScgfSxcclxuICAgICAgICAgICAgICAgIG9yZGVyOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ25ld2VzdC10by1vbGRlc3QnLCAnb2xkZXN0LXRvLW5ld2VzdCddLCBkZXNjcmlwdGlvbjogJ09yZGVyIG9mIGxvZ3MnLCBkZWZhdWx0OiAnbmV3ZXN0LXRvLW9sZGVzdCcgfVxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICByZXF1aXJlZDogWydjb3VudCcsICdvcmRlciddXHJcbiAgICAgICAgfSxcclxuICAgICAgICB7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7IGxvZ0xpbmVzOiB7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0gfSB9LCByZXF1aXJlZDogWydsb2dMaW5lcyddIH0sIFwiR0VUXCIsICBbJ2VkaXRvcicsICdsb2dzJywgJ2RlYnVnJywgJ2luZm8nXVxyXG4gICAgKVxyXG4gICAgYXN5bmMgZWRpdG9yR2V0TG9ncyhhcmdzOiB7IGNvdW50OiBudW1iZXIsIHNob3dTdGFjazogYm9vbGVhbiwgb3JkZXI6ICduZXdlc3QtdG8tb2xkZXN0JyB8ICdvbGRlc3QtdG8tbmV3ZXN0JyB9KTogUHJvbWlzZTx7IGxvZ0xpbmVzOiBzdHJpbmdbXSB9PiB7XHJcbiAgICAgICAgY29uc3QgcHJvamVjdFBhdGggPSBFZGl0b3IuUHJvamVjdC5wYXRoO1xyXG4gICAgICAgIGNvbnN0IGxvZ1BhdGggPSBwYXRoLmpvaW4ocHJvamVjdFBhdGgsICd0ZW1wJywgJ2xvZ3MnLCAncHJvamVjdC5sb2cnKTtcclxuXHJcbiAgICAgICAgaWYgKGFyZ3Muc2hvd1N0YWNrID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgYXJncy5zaG93U3RhY2sgPSBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghZnMuZXhpc3RzU3luYyhsb2dQYXRoKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYExvZyBmaWxlIG5vdCBmb3VuZCBhdCAke2xvZ1BhdGh9YCk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBlbnRyaWVzOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgIGNvbnN0IGZkID0gZnMub3BlblN5bmMobG9nUGF0aCwgJ3InKTtcclxuICAgICAgICBcclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBzdGF0cyA9IGZzLmZzdGF0U3luYyhmZCk7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpbGVTaXplID0gc3RhdHMuc2l6ZTtcclxuICAgICAgICAgICAgY29uc3QgYnVmZmVyU2l6ZSA9IDEwICogMTAyNDsgLy8gMTBLQiBjaHVua3NcclxuICAgICAgICAgICAgY29uc3QgYnVmZmVyID0gQnVmZmVyLmFsbG9jKGJ1ZmZlclNpemUpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgbGV0IHBvc2l0aW9uID0gZmlsZVNpemU7XHJcbiAgICAgICAgICAgIGxldCBsZWZ0b3ZlciA9ICcnO1xyXG4gICAgICAgICAgICBsZXQgYWNjdW11bGF0ZWRCb2R5ID0gJyc7IC8vIFRleHQgYmVsb25naW5nIHRvIHRoZSBjdXJyZW50IChib3R0b20tbW9zdCkgZW50cnkgYmVpbmcgcGFyc2VkXHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICBjb25zdCByZWdleCA9IC9eKFxcZHsxLDJ9LVxcZHsxLDJ9LVxcZHs0fVxcc1xcZHsyfTpcXGR7Mn06XFxkezJ9XFxzLVxccyg/OmxvZ3x3YXJufGVycm9yfGluZm8pOlxccykvO1xyXG4gICAgICAgICAgICBjb25zdCB0aW1lc3RhbXBSZWdleCA9IC9eXFxkezEsMn0tXFxkezEsMn0tXFxkezR9XFxzXFxkezJ9OlxcZHsyfTpcXGR7Mn1cXHMtXFxzLztcclxuICAgICAgICAgICAgXHJcbiAgICAgICAgICAgIGxldCBsYXN0Q29udGVudDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XHJcbiAgICAgICAgICAgIGxldCBsYXN0Q291bnQgPSAwO1xyXG5cclxuICAgICAgICAgICAgd2hpbGUgKHBvc2l0aW9uID4gMCAmJiBlbnRyaWVzLmxlbmd0aCA8IGFyZ3MuY291bnQpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHJlYWRTaXplID0gTWF0aC5taW4oYnVmZmVyU2l6ZSwgcG9zaXRpb24pO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVhZFBvcyA9IHBvc2l0aW9uIC0gcmVhZFNpemU7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIGZzLnJlYWRTeW5jKGZkLCBidWZmZXIsIDAsIHJlYWRTaXplLCByZWFkUG9zKTtcclxuICAgICAgICAgICAgICAgIHBvc2l0aW9uIC09IHJlYWRTaXplO1xyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjaHVuayA9IGJ1ZmZlci50b1N0cmluZygndXRmLTgnLCAwLCByZWFkU2l6ZSk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb21iaW5lZCA9IGNodW5rICsgbGVmdG92ZXI7XHJcbiAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgIC8vIFNwbGl0IGJ5IG5ld2xpbmVcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gY29tYmluZWQuc3BsaXQoL1xccj9cXG4vKTtcclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgaWYgKHBvc2l0aW9uID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGxlZnRvdmVyID0gbGluZXMuc2hpZnQoKSB8fCAnJztcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbGVmdG92ZXIgPSAnJzsgLy8gUHJvY2VzcyBhbGxcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBQcm9jZXNzIGxpbmVzIGluIHJldmVyc2UgKGJvdHRvbSB0byB0b3Agb2YgdGhlIGNodW5rKVxyXG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSA9IGxpbmVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoaXMgbGluZSBpcyBhIEhlYWRlciAoU3RhcnQgb2YgRW50cnkpXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlZ2V4LnRlc3QobGluZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbGV0IGVudHJ5ID0gbGluZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGFyZ3Muc2hvd1N0YWNrICYmIGFjY3VtdWxhdGVkQm9keS5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyeSArPSAnXFxuJyArIGFjY3VtdWxhdGVkQm9keTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgY2xlYW5lZCA9IGVudHJ5LnJlcGxhY2UodGltZXN0YW1wUmVnZXgsICcnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjbGVhbmVkID09PSBsYXN0Q29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdENvdW50Kys7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyaWVzW2VudHJpZXMubGVuZ3RoIC0gMV0gPSBgKCR7bGFzdENvdW50fSkgJHtjbGVhbmVkfWA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZW50cmllcy5sZW5ndGggPj0gYXJncy5jb3VudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvdW5kIGEgbmV3IGdyb3VwIGJ1dCB3ZSBhbHJlYWR5IGhhdmUgZW5vdWdoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb24gPSAwOyAvLyBTdG9wIHJlYWRpbmcgZmlsZSBsb29wXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7IC8vIFN0b3AgbGluZXMgbG9vcFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdENvbnRlbnQgPSBjbGVhbmVkO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFzdENvdW50ID0gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudHJpZXMucHVzaChjbGVhbmVkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWNjdW11bGF0ZWRCb2R5ID0gJyc7IC8vIFJlc2V0IGZvciB0aGUgbmV4dCBlbnRyeSAodXB3YXJkcylcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBUaGlzIGlkZW50aWZpZXMgYXMgYm9keSB0ZXh0IChvciBlbXB0eSBsaW5lKSBiZWxvbmdpbmcgdG8gdGhlIGVudHJ5IFwiYWJvdmVcIiBpdFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYXJncy5zaG93U3RhY2sgJiYgYWNjdW11bGF0ZWRCb2R5Lmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkQm9keSA9IGxpbmUgKyAnXFxuJyArIGFjY3VtdWxhdGVkQm9keTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjY3VtdWxhdGVkQm9keSA9IGxpbmU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgXHJcbiAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgZnMuY2xvc2VTeW5jKGZkKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vIFdlIHB1c2hlZCBlbnRyaWVzIGluIHJldmVyc2Ugb3JkZXIgKG5ld2VzdCBmaXJzdCkuXHJcbiAgICAgICAgaWYgKGFyZ3Mub3JkZXIgPT09ICdvbGRlc3QtdG8tbmV3ZXN0Jykge1xyXG4gICAgICAgICAgICAgcmV0dXJuIHsgbG9nTGluZXM6IGVudHJpZXMucmV2ZXJzZSgpIH07XHJcbiAgICAgICAgfSBcclxuICAgICAgICBcclxuICAgICAgICByZXR1cm4geyBsb2dMaW5lczogZW50cmllcyB9O1xyXG4gICAgfVxyXG5cclxufVxyXG4iXX0=