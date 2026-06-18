import type { TreeNode } from './stores';
import { readNote } from './fs';

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

export function extractWikiLinks(content: string): string[] {
  const targets: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = WIKI_LINK_RE.exec(content)) !== null) {
    targets.push(m[1].trim());
  }
  return targets;
}

export function buildNameToIdMap(hierarchy: TreeNode[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(nodes: TreeNode[]) {
    for (const node of nodes) {
      if (node.type === 'note') {
        const name = node.name.replace(/\.md$/i, '');
        if (!map.has(name)) {
          map.set(name, node.id);
        }
      }
      if (node.children) walk(node.children);
    }
  }
  walk(hierarchy);
  return map;
}

export function resolveWikiLink(
  targetName: string,
  hierarchy: TreeNode[],
): string | null {
  const map = buildNameToIdMap(hierarchy);
  return map.get(targetName) ?? null;
}

export function findNodeInHierarchy(
  nodes: TreeNode[],
  id: string,
): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNodeInHierarchy(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Build the full backlinks index by scanning all notes in the workspace.
 * Returns: Map<targetId, sourceId[]>
 */
export async function buildBacklinksIndex(
  hierarchy: TreeNode[],
): Promise<Map<string, string[]>> {
  const nameToId = buildNameToIdMap(hierarchy);
  const index = new Map<string, Set<string>>();

  async function scanNode(node: TreeNode) {
    if (node.type === 'note') {
      const content = await readNote(node.id);
      const links = extractWikiLinks(content);
      for (const targetName of links) {
        const targetId = nameToId.get(targetName);
        if (targetId && targetId !== node.id) {
          if (!index.has(targetId)) index.set(targetId, new Set());
          index.get(targetId)!.add(node.id);
        }
      }
    }
    if (node.children) {
      for (const child of node.children) {
        await scanNode(child);
      }
    }
  }

  for (const node of hierarchy) {
    await scanNode(node);
  }

  const result = new Map<string, string[]>();
  for (const [targetId, sources] of index) {
    result.set(targetId, [...sources]);
  }
  return result;
}

/**
 * Update the index incrementally when a single note's content changes.
 */
export function updateBacklinksForNote(
  index: Map<string, string[]>,
  sourceId: string,
  sourceContent: string,
  hierarchy: TreeNode[],
): void {
  const nameToId = buildNameToIdMap(hierarchy);

  for (const [targetId, sources] of index) {
    const filtered = sources.filter((id) => id !== sourceId);
    if (filtered.length === 0) {
      index.delete(targetId);
    } else {
      index.set(targetId, filtered);
    }
  }

  const links = extractWikiLinks(sourceContent);
  for (const targetName of links) {
    const targetId = nameToId.get(targetName);
    if (targetId && targetId !== sourceId) {
      if (!index.has(targetId)) index.set(targetId, []);
      const sources = index.get(targetId)!;
      if (!sources.includes(sourceId)) {
        sources.push(sourceId);
      }
    }
  }
}

/**
 * Convert [[wiki links]] in markdown content to HTML anchor tags.
 * Resolves names via the hierarchy name→id map.
 */
export function renderWikiLinks(
  html: string,
  hierarchy: TreeNode[],
): string {
  const nameToId = buildNameToIdMap(hierarchy);
  const linkRe = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
  return html.replace(linkRe, (_match, target: string, display?: string) => {
    const targetName = target.trim();
    const id = nameToId.get(targetName);
    const label = display?.trim() || targetName;
    if (id) {
      return `<a href="#" class="wiki-link wiki-link-resolved" data-note-id="${id}">${label}</a>`;
    }
    return `<span class="wiki-link wiki-link-missing">${label}</span>`;
  });
}
