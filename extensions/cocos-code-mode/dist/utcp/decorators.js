"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
exports.utcpTool = utcpTool;
class ToolRegistry {
    static register(options) {
        this.tools.set(options.tool.name, options);
    }
    static getTools() {
        return Array.from(this.tools.values());
    }
}
exports.ToolRegistry = ToolRegistry;
ToolRegistry.tools = new Map();
function utcpTool(name, description, inputs, outputs, httpMethod, tags = []) {
    return function (target, propertyKey, descriptor) {
        if (!descriptor)
            return;
        ToolRegistry.register({
            method: descriptor.value,
            target,
            tool: {
                name,
                description,
                inputs,
                outputs,
                tags,
                tool_call_template: {
                    call_template_type: "http",
                    http_method: httpMethod,
                    request_body_format: "json",
                    url: `/tools/${name}`,
                    content_type: "application/json"
                },
            }
        });
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVjb3JhdG9ycy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL3NvdXJjZS91dGNwL2RlY29yYXRvcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBcUJBLDRCQXVCQztBQW5DRCxNQUFhLFlBQVk7SUFHckIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxPQUFxQjtRQUNqQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMvQyxDQUFDO0lBRUQsTUFBTSxDQUFDLFFBQVE7UUFDWCxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO0lBQzNDLENBQUM7O0FBVEwsb0NBVUM7QUFUa0Isa0JBQUssR0FBOEIsSUFBSSxHQUFHLEVBQUUsQ0FBQztBQVdoRSxTQUFnQixRQUFRLENBQUMsSUFBWSxFQUFFLFdBQW1CLEVBQUUsTUFBa0IsRUFBRSxPQUFtQixFQUFFLFVBQXVELEVBQUUsT0FBaUIsRUFBRTtJQUM3SyxPQUFPLFVBQVUsTUFBVyxFQUFFLFdBQW1CLEVBQUUsVUFBK0I7UUFDOUUsSUFBSSxDQUFDLFVBQVU7WUFBRSxPQUFPO1FBRXhCLFlBQVksQ0FBQyxRQUFRLENBQUM7WUFDbEIsTUFBTSxFQUFFLFVBQVUsQ0FBQyxLQUFLO1lBQ3hCLE1BQU07WUFDTixJQUFJLEVBQUU7Z0JBQ0YsSUFBSTtnQkFDSixXQUFXO2dCQUNYLE1BQU07Z0JBQ04sT0FBTztnQkFDUCxJQUFJO2dCQUNKLGtCQUFrQixFQUFFO29CQUNoQixrQkFBa0IsRUFBRSxNQUFNO29CQUMxQixXQUFXLEVBQUUsVUFBVTtvQkFDdkIsbUJBQW1CLEVBQUUsTUFBTTtvQkFDM0IsR0FBRyxFQUFFLFVBQVUsSUFBSSxFQUFFO29CQUNyQixZQUFZLEVBQUUsa0JBQWtCO2lCQUNmO2FBQ3hCO1NBQ0osQ0FBQyxDQUFDO0lBQ1AsQ0FBQyxDQUFDO0FBQ04sQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEh0dHBDYWxsVGVtcGxhdGUgfSBmcm9tICdAdXRjcC9odHRwJztcclxuaW1wb3J0IHsgSnNvblNjaGVtYSwgVG9vbCB9IGZyb20gJ0B1dGNwL3Nkayc7XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIFRvb2xNZXRhZGF0YSB7XHJcbiAgICBtZXRob2Q6IEZ1bmN0aW9uO1xyXG4gICAgdGFyZ2V0OiBhbnk7XHJcbiAgICB0b29sOiBUb29sO1xyXG59XHJcblxyXG5leHBvcnQgY2xhc3MgVG9vbFJlZ2lzdHJ5IHtcclxuICAgIHByaXZhdGUgc3RhdGljIHRvb2xzOiBNYXA8c3RyaW5nLCBUb29sTWV0YWRhdGE+ID0gbmV3IE1hcCgpO1xyXG5cclxuICAgIHN0YXRpYyByZWdpc3RlcihvcHRpb25zOiBUb29sTWV0YWRhdGEpIHtcclxuICAgICAgICB0aGlzLnRvb2xzLnNldChvcHRpb25zLnRvb2wubmFtZSwgb3B0aW9ucyk7XHJcbiAgICB9XHJcblxyXG4gICAgc3RhdGljIGdldFRvb2xzKCkge1xyXG4gICAgICAgIHJldHVybiBBcnJheS5mcm9tKHRoaXMudG9vbHMudmFsdWVzKCkpO1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gdXRjcFRvb2wobmFtZTogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nLCBpbnB1dHM6IEpzb25TY2hlbWEsIG91dHB1dHM6IEpzb25TY2hlbWEsIGh0dHBNZXRob2Q6ICdHRVQnIHwgJ1BPU1QnIHwgJ1BVVCcgfCAnREVMRVRFJyB8ICdQQVRDSCcsIHRhZ3M6IHN0cmluZ1tdID0gW10pIHtcclxuICAgIHJldHVybiBmdW5jdGlvbiAodGFyZ2V0OiBhbnksIHByb3BlcnR5S2V5OiBzdHJpbmcsIGRlc2NyaXB0b3I/OiBQcm9wZXJ0eURlc2NyaXB0b3IpIHtcclxuICAgICAgICBpZiAoIWRlc2NyaXB0b3IpIHJldHVybjtcclxuXHJcbiAgICAgICAgVG9vbFJlZ2lzdHJ5LnJlZ2lzdGVyKHtcclxuICAgICAgICAgICAgbWV0aG9kOiBkZXNjcmlwdG9yLnZhbHVlLFxyXG4gICAgICAgICAgICB0YXJnZXQsXHJcbiAgICAgICAgICAgIHRvb2w6IHtcclxuICAgICAgICAgICAgICAgIG5hbWUsXHJcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbixcclxuICAgICAgICAgICAgICAgIGlucHV0cyxcclxuICAgICAgICAgICAgICAgIG91dHB1dHMsXHJcbiAgICAgICAgICAgICAgICB0YWdzLFxyXG4gICAgICAgICAgICAgICAgdG9vbF9jYWxsX3RlbXBsYXRlOiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbF90ZW1wbGF0ZV90eXBlOiBcImh0dHBcIixcclxuICAgICAgICAgICAgICAgICAgICBodHRwX21ldGhvZDogaHR0cE1ldGhvZCxcclxuICAgICAgICAgICAgICAgICAgICByZXF1ZXN0X2JvZHlfZm9ybWF0OiBcImpzb25cIixcclxuICAgICAgICAgICAgICAgICAgICB1cmw6IGAvdG9vbHMvJHtuYW1lfWAsXHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudF90eXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIlxyXG4gICAgICAgICAgICAgICAgfSBhcyBIdHRwQ2FsbFRlbXBsYXRlLFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG59XHJcbiJdfQ==