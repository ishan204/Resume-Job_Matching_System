"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIFactory = void 0;
const geminiProvider_1 = require("./geminiProvider");
const semanticEngine_1 = require("./semanticEngine");
const config_1 = require("../../config");
class AIFactory {
    static instance;
    static getProvider() {
        if (!this.instance) {
            if (config_1.config.geminiApiKey) {
                this.instance = new geminiProvider_1.GeminiProvider();
            }
            else {
                this.instance = new semanticEngine_1.SemanticEngine();
            }
        }
        return this.instance;
    }
}
exports.AIFactory = AIFactory;
