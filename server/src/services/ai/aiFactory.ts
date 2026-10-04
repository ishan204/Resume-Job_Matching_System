import { IAIProvider } from './aiProvider';
import { GeminiProvider } from './geminiProvider';
import { SemanticEngine } from './semanticEngine';
import { config } from '../../config';

export class AIFactory {
  private static instance: IAIProvider;

  public static getProvider(): IAIProvider {
    if (!this.instance) {
      if (config.geminiApiKey) {
        this.instance = new GeminiProvider();
      } else {
        this.instance = new SemanticEngine();
      }
    }
    return this.instance;
  }
}
