import { withErrorHandling } from '../responses.js';
import { registeredTools } from '../server.js';
import { loadAllTools } from '../storage.js';

export const name = 'list_saved_queries';

export const config = {
  title: 'List Saved Queries',
  description: 'List all saved query tools and their descriptions',
  inputSchema: {},
};

export function handler(): { content: { type: 'text'; text: string }[]; isError?: boolean } {
  return withErrorHandling('listing saved queries', () => {
    if (registeredTools.size === 0) {
      return 'No saved queries found.';
    }
    
    // Get tool configurations from storage to access descriptions
    const savedTools = loadAllTools();
    
    const toolList = [...registeredTools.keys()]
      .map((name) => {
        const toolConfig = savedTools.get(name);
        const description = toolConfig?.description ?? 'No description';
        return `- **${name}**: ${description}`;
      })
      .join('\n');
    
    return `Found ${registeredTools.size} saved quer${registeredTools.size === 1 ? 'y' : 'ies'}:\n\n${toolList}`;
  });
}