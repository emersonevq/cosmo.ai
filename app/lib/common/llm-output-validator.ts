import { z } from 'zod';

/**
 * Structured JSON Schema definitions for LLM outputs
 * Ensures LLM returns valid, structured JSON data
 */

export const BoltActionSchema = z.union([
  z.object({
    type: z.literal('file'),
    filePath: z.string().min(1),
    content: z.string(),
  }),
  z.object({
    type: z.literal('shell'),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal('start'),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal('build'),
    content: z.string().min(1),
  }),
  z.object({
    type: z.literal('supabase'),
    operation: z.enum(['migration', 'query']),
    content: z.string().min(1),
    filePath: z.string().optional(),
    projectId: z.string().optional(),
  }),
]);

export const BoltArtifactSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  actions: z.array(BoltActionSchema),
});

export const ArtifactCallbackSchema = z.object({
  artifactId: z.string().min(1),
  messageId: z.string().min(1),
  artifacts: z.array(BoltArtifactSchema),
});

/**
 * Comprehensive LLM Response Schema
 * Structure that LLMs should follow for all outputs
 */
export const LLMResponseSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  artifacts: z.array(BoltArtifactSchema).optional(),
  metadata: z.object({
    timestamp: z.string().datetime().optional(),
    responseType: z.enum(['text', 'artifact', 'mixed']).optional(),
    executionMode: z.enum(['immediate', 'dry-run', 'preview']).optional(),
  }).optional(),
});

/**
 * Type exports for use throughout the application
 */
export type BoltActionType = z.infer<typeof BoltActionSchema>;
export type BoltArtifactType = z.infer<typeof BoltArtifactSchema>;
export type ArtifactCallbackType = z.infer<typeof ArtifactCallbackSchema>;
export type LLMResponseType = z.infer<typeof LLMResponseSchema>;

/**
 * Validation utility functions
 */
export class LLMOutputValidator {
  /**
   * Validate and parse a BoltAction from raw data
   */
  static validateAction(data: unknown): BoltActionType {
    try {
      return BoltActionSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid BoltAction: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate and parse a BoltArtifact from raw data
   */
  static validateArtifact(data: unknown): BoltArtifactType {
    try {
      return BoltArtifactSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid BoltArtifact: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
      }
      throw error;
    }
  }

  /**
   * Validate and parse a full LLM Response
   */
  static validateResponse(data: unknown): LLMResponseType {
    try {
      return LLMResponseSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid LLM Response: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')}`);
      }
      throw error;
    }
  }

  /**
   * Safe parsing that returns result with errors array
   */
  static safeParse(data: unknown, schema: z.ZodSchema): { success: boolean; data?: any; errors?: Array<{ path: string; message: string }> } {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    }
    return {
      success: false,
      errors: result.error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    };
  }
}

/**
 * JSON Schema definitions for structured LLM outputs
 * These schemas should be provided to the LLM to enforce structured outputs
 */
export const StructuredOutputSchemas = {
  boltAction: {
    name: 'BoltAction',
    description: 'An action to be executed in the system',
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['file', 'shell', 'start', 'build', 'supabase'],
        description: 'The type of action to execute',
      },
      content: {
        type: 'string',
        description: 'The content or command to execute',
      },
      filePath: {
        type: 'string',
        description: 'Path to the file (required for file actions)',
      },
      operation: {
        type: 'string',
        enum: ['migration', 'query'],
        description: 'Operation type for Supabase actions',
      },
      projectId: {
        type: 'string',
        description: 'Project ID for Supabase operations',
      },
    },
    required: ['type', 'content'],
  },

  boltArtifact: {
    name: 'BoltArtifact',
    description: 'A comprehensive artifact containing multiple actions',
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'Unique identifier for the artifact',
      },
      title: {
        type: 'string',
        description: 'Human-readable title for the artifact',
      },
      actions: {
        type: 'array',
        items: {
          $ref: '#/definitions/BoltAction',
        },
        description: 'List of actions to execute',
      },
    },
    required: ['id', 'title', 'actions'],
  },

  llmResponse: {
    name: 'LLMResponse',
    description: 'Complete LLM response with optional artifacts',
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'The main message/response from the LLM',
      },
      artifacts: {
        type: 'array',
        items: {
          $ref: '#/definitions/BoltArtifact',
        },
        description: 'Optional list of artifacts to create',
      },
      metadata: {
        type: 'object',
        properties: {
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
          responseType: {
            type: 'string',
            enum: ['text', 'artifact', 'mixed'],
          },
          executionMode: {
            type: 'string',
            enum: ['immediate', 'dry-run', 'preview'],
          },
        },
      },
    },
    required: ['message'],
  },
};

/**
 * Helper function to generate JSON Schema string for LLM instruction
 */
export function getJsonSchemaForLLM() {
  return JSON.stringify(StructuredOutputSchemas, null, 2);
}

/**
 * Destructive command patterns for safety checks
 * Used to identify commands that modify or delete files/data
 */
export const DESTRUCTIVE_COMMAND_PATTERNS = [
  { pattern: /^\s*rm\s+/, reason: 'rm command (file deletion)', severity: 'critical' },
  { pattern: /^\s*rmdir\s+/, reason: 'rmdir command (directory deletion)', severity: 'critical' },
  { pattern: /^\s*rm\s+-r/, reason: 'rm -r command (recursive deletion)', severity: 'critical' },
  { pattern: /^\s*rm\s+-rf/, reason: 'rm -rf command (force recursive deletion)', severity: 'critical' },
  { pattern: /^\s*>.*[\w]/, reason: 'file truncation with > operator', severity: 'high' },
  { pattern: /^\s*:\s*>/, reason: 'dangerous :> truncation', severity: 'critical' },
  { pattern: /mv\s+.*\/dev\/null/, reason: 'moving file to /dev/null', severity: 'critical' },
  { pattern: /^\s*dd\s+/, reason: 'dd command (direct disk writing)', severity: 'critical' },
];

/**
 * Detects if a command is destructive
 */
export function isDestructiveCommand(command: string): { isDestructive: boolean; reason?: string; severity?: string } {
  const trimmedCommand = command.trim().toLowerCase();

  for (const { pattern, reason, severity } of DESTRUCTIVE_COMMAND_PATTERNS) {
    if (pattern.test(trimmedCommand)) {
      return { isDestructive: true, reason, severity };
    }
  }

  return { isDestructive: false };
}

/**
 * Dry-run mode helper
 * Allows testing commands without actually executing them
 * Especially useful for destructive operations
 */
export class DryRunValidator {
  /**
   * Validate a shell command in dry-run mode
   * Returns what would happen without executing it
   */
  static validateCommand(command: string): {
    isDryRun: boolean;
    command: string;
    isDestructive: boolean;
    reason?: string;
    warning?: string;
    dryRunCommand?: string;
  } {
    const { isDestructive, reason, severity } = isDestructiveCommand(command);

    const result: any = {
      isDryRun: true,
      command,
      isDestructive,
      reason,
    };

    if (isDestructive) {
      result.warning = `DESTRUCTIVE OPERATION [${severity?.toUpperCase() || 'MEDIUM'}]: ${reason}`;
      result.dryRunCommand = `echo "DRY RUN: Would execute: ${command}"`;
    }

    return result;
  }

  /**
   * Generate a safe dry-run version of a destructive command
   * Uses echo or echo-like commands to preview without executing
   */
  static makeDryRunSafe(command: string): string {
    const trimmedCommand = command.trim();

    // For rm commands, show what would be deleted
    if (trimmedCommand.match(/^\s*rm\s+/)) {
      return `echo "DRY RUN - Would delete: ${trimmedCommand.replace(/^rm\s+-?[a-z]*\s*/i, '')}"`;
    }

    // For mv/cp commands, show what would be moved/copied
    if (trimmedCommand.match(/^(cp|mv)\s+/)) {
      return `echo "DRY RUN - Would ${trimmedCommand.match(/^cp/) ? 'copy' : 'move'}: ${trimmedCommand}"`;
    }

    // For file truncation, show what would happen
    if (trimmedCommand.includes('>')) {
      return `echo "DRY RUN - Would truncate/write to file: ${trimmedCommand.replace(/^.*>\s*/, '')}"`;
    }

    // Default: wrap in echo
    return `echo "DRY RUN: ${trimmedCommand}"`;
  }
}

/**
 * Instruction text to include in LLM prompts for structured outputs
 * This helps the LLM understand the required JSON schema format
 */
export const LLM_STRUCTURED_OUTPUT_INSTRUCTIONS = `
## Structured Output Requirements

When creating artifacts or taking actions, you MUST return valid JSON with proper structure.

### Valid JSON Schema Example:
\`\`\`json
{
  "message": "Your explanation here",
  "artifacts": [
    {
      "id": "unique-id",
      "title": "Artifact Title",
      "actions": [
        {
          "type": "file",
          "filePath": "path/to/file.ts",
          "content": "file content here"
        },
        {
          "type": "shell",
          "content": "npm install"
        },
        {
          "type": "start",
          "content": "npm run dev"
        }
      ]
    }
  ]
}
\`\`\`

### Critical Rules:
1. ALWAYS return valid JSON - no malformed or invalid syntax
2. ALWAYS include proper quotation marks and escaping
3. NEVER include trailing commas in JSON
4. NEVER include comments in JSON
5. Validate your JSON structure before responding

### Destructive Command Warnings:
If you use destructive commands (rm, rmdir, etc), include a warning in the message explaining the operation.

### Safety First:
- Always prefer non-destructive alternatives when possible
- Include safeguards like -f flags for rm commands
- Warn the user before executing destructive operations
`;
