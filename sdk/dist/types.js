"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StealthPayError = void 0;
// ─────────────────────────────────────────────────────────────────────────────
// Error
// ─────────────────────────────────────────────────────────────────────────────
class StealthPayError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "StealthPayError";
    }
}
exports.StealthPayError = StealthPayError;
//# sourceMappingURL=types.js.map