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

export const thesisTemplate: Template = {
  id: 'thesis',
  name: 'رسالة علمية',
  description: 'هيكل كامل لرسالة علمية (ماجستير أو دكتوراه) يتضمن فصولاً نظرية وتطبيقية مع عينات من المحتوى',
  generate() {
    const tree: TreeNode[] = [];
    const samples: Record<string, string> = {};

    const intro = node('الفصل الأول: الإطار النظري', 'folder', [
      node('المبحث الأول: مفاهيم أساسية', 'note'),
      node('المبحث الثاني: الخلفية النظرية', 'note'),
    ]);
    tree.push(intro);

    const litReview = node('الفصل الثاني: الدراسات السابقة', 'folder', [
      node('الدراسات العربية', 'note'),
      node('الدراسات الأجنبية', 'note'),
    ]);
    tree.push(litReview);

    const methodology = node('الفصل الثالث: منهجية البحث', 'folder', [
      node('منهج البحث وإجراءاته', 'note'),
    ]);
    tree.push(methodology);

    const results = node('الفصل الرابع: النتائج والتحليل', 'folder', [
      node('عرض النتائج', 'note'),
      node('مناقشة النتائج', 'note'),
    ]);
    tree.push(results);

    const abstractN = node('الملخص', 'note');
    tree.push(abstractN);

    const concN = node('الخاتمة', 'note');
    tree.push(concN);

    const refN = node('المراجع', 'note');
    tree.push(refN);

    // Sample content
    samples[abstractN.id] = abstractContent('الرسالة');
    samples[intro.children![0].id] = `# المبحث الأول: مفاهيم أساسية

## تمهيد

يعد الإطار النظري حجر الزاوية في أي بحث علمي، حيث يحدد المفاهيم الأساسية والمصطلحات التي سيعتمد عليها البحث.

### المفهوم الأول

يشير هذا المفهوم إلى مجموعة الظواهر والعمليات التي تشكل موضوع الدراسة. وقد عرفه العديد من الباحثين بتعريفات متقاربة.

> "المفهوم هو فكرة مجردة تمثل ظاهرة أو مجموعة ظواهر مترابطة" (اسم المصدر، 2020)

### المفهوم الثاني

يرتبط هذا المفهوم بالبعد التطبيقي للدراسة، ويمثل الأداة التي يتم من خلالها قياس المتغيرات.

$$
\\alpha = \\frac{2r}{1 + r}
$$

## النظريات المفسرة

تعد النظريات المفسرة للظاهرة المدروسة إطاراً مهماً لفهم العلاقات بين المتغيرات المختلفة.`;
    samples[intro.children![1].id] = `# المبحث الثاني: الخلفية النظرية

## التيارات الفكرية

تطورت الدراسات في هذا المجال عبر عدة تيارات فكرية، يمكن إجمالها فيما يلي:

### التيار الأول: الاتجاه الكلاسيكي

يركز هذا الاتجاه على المتغيرات الأساسية والعلاقات المباشرة بينها. وقد ساهم هذا الاتجاه في وضع الأسس الأولى للدراسة.

### التيار الثاني: الاتجاه الحديث

يأخذ هذا الاتجاه في الاعتبار المتغيرات الوسيطة والتفاعلات المعقدة بين العناصر المختلفة.

## الدراسات السابقة

استعرض الباحث مجموعة من الدراسات السابقة التي تناولت الموضوع من زوايا مختلفة.

| الدراسة | السنة | المنهج | النتائج الرئيسية |
|---------|-------|--------|-----------------|
| دراسة (أ) | 2020 | وصفي تحليلي | توصلت إلى وجود علاقة إيجابية |
| دراسة (ب) | 2021 | تجريبي | أظهرت فروقاً دالة إحصائياً |
| دراسة (ج) | 2022 | مختلط | قدمت نموذجاً تفسيرياً متكاملاً |

## الفجوة البحثية

على الرغم من كثرة الدراسات السابقة، إلا أنها لم تتناول الجانب المتعلق بالمتغيرات الحديثة، مما يشكل الفجوة التي تسعى هذه الدراسة إلى سدها.`;

    samples[litReview.children![0].id] = `# الدراسات العربية

## أولاً: دراسات في المجال النظري

تناولت العديد من الدراسات العربية موضوع البحث من الجانب النظري، ومن أبرزها:

### دراسة (اسم الباحث، 2019)

هدفت هذه الدراسة إلى تحليل الإطار المفاهيمي للموضوع، واستخدمت المنهج الوصفي التحليلي، وتوصلت إلى أن المفاهيم الأساسية تحتاج إلى إعادة تعريف في ضوء المتغيرات الحديثة.

### دراسة (باحث آخر، 2020)

ركزت على العوامل المؤثرة في الظاهرة المدروسة، واستخدمت استبانة لجمع البيانات من عينة قوامها 300 مفردة. أظهرت النتائج أن العوامل الاقتصادية والاجتماعية تلعب دوراً رئيسياً.

## ثانياً: دراسات تطبيقية

تناولت دراسات أخرى الجانب التطبيقي، حيث طبقت نماذج إحصائية متقدمة لتحليل العلاقات بين المتغيرات.`;
    samples[litReview.children![1].id] = `# الدراسات الأجنبية

## International Studies

A review of international literature reveals several key contributions to the field.

### Smith & Johnson (2021)

This study examined the relationship between key variables using structural equation modeling. The sample consisted of 500 participants from various institutions. Results indicated a significant positive correlation ($r = 0.72, p < 0.001$).

### Brown et al. (2020)

Conducted a longitudinal study spanning five years to track changes in the phenomenon over time. The study found that:

- Initial levels showed moderate variation
- Significant changes occurred after the first two years
- External factors played a mediating role

$$
\\chi^2 = \\sum \\frac{(O_i - E_i)^2}{E_i}
$$

## Summary of International Literature

The international literature provides a robust foundation for understanding the theoretical and applied aspects of the research topic. However, most studies were conducted in Western contexts, highlighting the need for research in Arabic-speaking settings.`;

    samples[methodology.children![0].id] = methodologyContent();
    samples[results.children![0].id] = resultsContent();
    samples[results.children![1].id] = discussionContent();
    samples[concN.id] = conclusionContent();
    samples[refN.id] = referencesContent();

    return { tree, samples };
  },
};
