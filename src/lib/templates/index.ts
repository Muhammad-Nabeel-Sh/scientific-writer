import type { Template, TemplateId } from './types';
import { thesisTemplate } from './thesis';
import { articleTemplate } from './article';
import { bookTemplate } from './book';
import { lectureTemplate } from './lecture';
import { classicalBookTemplate } from './classical-book';

const registry: Record<string, Template> = {};

function register(t: Template) {
  registry[t.id] = t;
}

register(thesisTemplate);
register(articleTemplate);
register(bookTemplate);
register(lectureTemplate);
register(classicalBookTemplate);

export function getTemplate(id: string): Template | undefined {
  return registry[id];
}

export function getAllTemplates(): Template[] {
  return Object.values(registry);
}

export function registerTemplate(t: Template) {
  register(t);
}

export type { TemplateId, Template } from './types';
