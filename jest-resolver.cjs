const path = require("path");
const fs = require("fs");

module.exports = (request, options) => {
  // For relative .js imports, try .ts if .js doesn't exist
  if (request.endsWith(".js") && request.startsWith(".")) {
    const tsRequest = request.slice(0, -3) + ".ts";
    const resolved = path.resolve(options.basedir, tsRequest);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }
  // Also handle .ts imports directly (test files import .ts)
  return options.defaultResolver(request, {
    ...options,
    conditions: options.conditions,
  });
};
