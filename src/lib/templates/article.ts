import type { Template } from './types';
import type { TreeNode } from '$lib/stores';
import { createId } from '$lib/utils';
import {
  abstractContent, introContent, methodologyContent,
  resultsContent, discussionContent, conclusionContent, referencesContent,
} from './content';

function node(name: string, type: 'note' | 'folder', children?: TreeNode[]): TreeNode {
  return { id: createId(), name, type, children, expanded: true };
}

export const articleTemplate: Template = {
  id: 'article',
  name: 'بحث علمي (مقالة)',
  description: 'هيكل مقالة علمية متكاملة وفقاً للمعايير الأكاديمية، تشمل الأقسام الرئيسية لنشر الأبحاث',
  generate() {
    const tree: TreeNode[] = [];
    const samples: Record<string, string> = {};

    const abstractN = node('الملخص', 'note');
    tree.push(abstractN);

    const introN = node('المقدمة', 'note');
    tree.push(introN);

    const methodN = node('منهجية البحث', 'note');
    tree.push(methodN);

    const resultsN = node('النتائج', 'note');
    tree.push(resultsN);

    const discussionN = node('مناقشة النتائج', 'note');
    tree.push(discussionN);

    const conclusionN = node('الخاتمة', 'note');
    tree.push(conclusionN);

    const refN = node('المراجع', 'note');
    tree.push(refN);

    samples[abstractN.id] = abstractContent('البحث');
    samples[introN.id] = introContent();
    samples[methodN.id] = `# منهجية البحث

## نوع البحث

ينتمي هذا البحث إلى نوع الدراسات الوصفية التحليلية، والتي تعتمد على جمع البيانات وتحليلها بشكل منهجي.

## مجتمع وعينة البحث

تكون مجتمع البحث من جميع المفاهيم والنظريات المتعلقة بالموضوع، وتم اختيار العينة بطريقة قصدية.

## أدوات جمع البيانات

تم استخدام الأدوات التالية:

1. **المقابلة**: لجمع البيانات النوعية من المختصين
2. **الاستبانة**: لقياس المتغيرات كمياً
3. **تحليل المحتوى**: لتحليل النصوص والوثائق

## التحليل الإحصائي

تم استخدام برنامج SPSS لتحليل البيانات، وتضمنت الأساليب الإحصائية:

$$
t = \\frac{\\bar{x}_1 - \\bar{x}_2}{\\sqrt{\\frac{s_1^2}{n_1} + \\frac{s_2^2}{n_2}}}
$$

- معامل ارتباط بيرسون
- اختبار (ت) للعينات المستقلة
- تحليل التباين الأحادي (ANOVA)`;
    samples[resultsN.id] = `# النتائج

## النتائج الأساسية

### أولاً: النتائج المتعلقة بالفرضية الأولى

أظهرت نتائج تحليل البيانات صحة الفرضية الأولى، حيث بلغت قيمة معامل الارتباط $r = 0.68$ عند مستوى دلالة $p < 0.01$.

### ثانياً: النتائج المتعلقة بالفرضية الثانية

كشفت النتائج عن وجود فروق ذات دلالة إحصائية بين المجموعات كما هو موضح في الجدول التالي:

| المجموعة | المتوسط | الانحراف المعياري | قيمة ت | الدلالة |
|----------|---------|-------------------|--------|---------|
| الأولى | 4.23 | 1.15 | 3.45 | 0.001 |
| الثانية | 3.12 | 1.08 | 3.45 | 0.001 |

### ثالثاً: النتائج المتعلقة بالفرضية الثالثة

لم تظهر النتائج فروقاً ذات دلالة إحصائية ($F = 1.23, p > 0.05$).`;
    samples[discussionN.id] = discussionContent();
    samples[conclusionN.id] = conclusionContent();
    samples[refN.id] = referencesContent();

    return { tree, samples };
  },
};
