import Anthropic from '@anthropic-ai/sdk';

// Anthropic AI integration — claude-sonnet-4-20250514 is the default model
const DEFAULT_MODEL = "claude-sonnet-4-20250514";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export { anthropic, DEFAULT_MODEL };
