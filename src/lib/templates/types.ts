import type { TreeNode } from '$lib/stores';

export interface Template {
  id: string;
  name: string;
  description: string;
  generate(): {
    tree: TreeNode[];
    samples: Record<string, string>;
  };
}

export type TemplateId = 'thesis' | 'article' | 'book' | 'lecture' | 'classical-book';
