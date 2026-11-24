import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const projectId = 'e2e_reg_' + Date.now().toString(36);

const seedPaper = {
  id: projectId,
  schoolName: 'Regression School',
  examTitle: 'Regression Paper',
  subject: 'Bangla',
  grade: '9',
  timeAllowed: '3 Hours',
  totalMarks: 100,
  questions: [
    {
      id: 'q1',
      type: 'short',
      content: 'MAIN QUESTION',
      marks: 5,
      subQuestions: [{ id: 'sq1', type: 'short', content: 'SUB ONE', marks: 2 }],
    },
    {
      id: 'q2',
      type: 'essay',
      content:
        'ফরম পূরণ করো।\\n\\nঅংশগ্রহণের ফরম\\n১. শিক্ষার্থীর নাম\\n২. পিতার নাম\\n৩. মাতার নাম',
      marks: 4,
      alternatives: [{ content: 'ALT ONE', contentAlign: 'right' }],
    },
    { id: 'q3', type: 'or', content: 'অথবা' },
  ],
};

async function api(path, options) {
  const response = await fetch(BASE + path, options);
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, json };
}

async function getPaper() {
  const result = await api('/api/projects/' + encodeURIComponent(projectId));
  return result.status === 200 ? result.json.paper : null;
}

async function waitForPaper(predicate, label, timeout = 30000) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeout) {
    const paper = await getPaper();
    last = paper;
    if (paper && predicate(paper)) return paper;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    'Timed out waiting for: ' + label + ' (last: ' + JSON.stringify(last?.questions?.map((q) => q.id)) + ')'
  );
}

const hasBoldRun = (document, needle) =>
  Boolean(
    document?.lines?.some((line) =>
      line.runs?.some((run) => run.bold === true && run.text.includes(needle))
    )
  );

const hasAlignedLine = (document, alignment) =>
  Boolean(document?.lines?.some((line) => line.align === alignment));

async function selectInEditor(locator, text) {
  const found = await locator.evaluate((element, needle) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const index = node.textContent.indexOf(needle);
      if (index === -1) continue;
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + needle.length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      element.focus();
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      return true;
    }
    return false;
  }, text);
  if (!found) throw new Error('Text not found in editor: ' + text);
}

const editor = (page, index) => page.locator('div[contenteditable="true"]').nth(index);

const browser = await chromium.launch();
let ok = true;
const step = (message) => console.log('PASS:', message);

try {
  const created = await api('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: projectId, name: 'Regression Paper', subject: 'Bangla', class: '9' }),
  });
  if (created.status !== 201) throw new Error('Could not create project');
  const seeded = await api('/api/projects/' + encodeURIComponent(projectId) + '/paper', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seedPaper),
  });
  if (seeded.status !== 200) throw new Error('Could not seed paper');

  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR:', error.message));

  await page.goto(BASE + '/editor?project=' + projectId, { waitUntil: 'domcontentloaded' });
  await editor(page, 0).waitFor({ state: 'visible', timeout: 60000 });
  step('editor loaded the paper from Neon');

  // 1. escaped newlines from an AI import are cleaned up
  const formValue = await editor(page, 2).innerText();
  if (formValue.includes('\\n')) throw new Error('Escaped newlines still visible in the editor');
  if (!formValue.includes('\n')) throw new Error('No real line breaks in the editor');
  await waitForPaper((p) => p.questions?.[1]?.content?.includes('\n'), 'newlines persisted');
  step('escaped \\n sequences normalized to real line breaks and persisted');

  // 2. seeded alternative keeps its own alignment
  const altEditor = page.locator('div[contenteditable="true"][aria-placeholder="বিকল্প প্রশ্ন..."]').first();
  await altEditor.waitFor({ state: 'visible', timeout: 15000 });
  if ((await altEditor.innerText()).trim() !== 'ALT ONE') throw new Error('Seeded alternative missing');
  const altAlign = await altEditor.evaluate((el) => getComputedStyle(el).textAlign);
  if (altAlign !== 'right') throw new Error('Alternative alignment lost: ' + altAlign);
  step('alternative text and per-alternative alignment preserved');

  // 3. bold on the main question
  await selectInEditor(editor(page, 0), 'MAIN');
  await page.getByTitle('Bold (Ctrl+B)').nth(0).click();
  await waitForPaper((p) => hasBoldRun(p.questions?.[0]?.contentDocument, 'MAIN'), 'main bold');
  step('bold applied to the main question');

  // 4. center alignment on the main question
  await editor(page, 0).click();
  await page.getByTitle('Align center').nth(0).click();
  await waitForPaper(
    (p) => p.questions?.[0]?.contentAlign === 'center' || hasAlignedLine(p.questions?.[0]?.contentDocument, 'center'),
    'main alignment'
  );
  step('center alignment applied to the main question');

  // 5. bold + right alignment on the sub-question
  await selectInEditor(editor(page, 1), 'SUB ONE');
  await page.getByTitle('Bold (Ctrl+B)').nth(1).click();
  await waitForPaper(
    (p) => hasBoldRun(p.questions?.[0]?.subQuestions?.[0]?.contentDocument, 'SUB ONE'),
    'sub bold'
  );
  await editor(page, 1).click();
  await page.getByTitle('Align right').nth(1).click();
  await waitForPaper(
    (p) =>
      p.questions?.[0]?.subQuestions?.[0]?.contentAlign === 'right' ||
      hasAlignedLine(p.questions?.[0]?.subQuestions?.[0]?.contentDocument, 'right'),
    'sub alignment'
  );
  step('bold and right alignment applied to the sub-question');

  // 6. legacy 'or' question still renders as a divider
  const divider = page.getByText('অথবা', { exact: true });
  if ((await divider.count()) < 1) throw new Error('Legacy or-question divider not rendered');
  step('legacy "or" question still renders as an অথবা divider');

  // 7. adding an alternative from inside a question card
  await page.getByRole('button', { name: 'অথবা যোগ করুন' }).first().click();
  const alternatives = page.locator('div[contenteditable="true"][aria-placeholder="বিকল্প প্রশ্ন..."]');
  const newAlt = alternatives.first();
  await newAlt.waitFor({ state: 'visible', timeout: 15000 });
  if ((await newAlt.innerText()).trim() !== '') throw new Error('New alternative is not empty');
  await newAlt.click();
  await page.keyboard.type('ADDED ALT');
  await waitForPaper(
    (p) => p.questions?.[0]?.alternatives?.some((a) => a.content === 'ADDED ALT'),
    'added alternative'
  );
  step('alternative added from inside the question card');

  // 8. reload keeps everything
  await page.reload({ waitUntil: 'domcontentloaded' });
  await editor(page, 0).waitFor({ state: 'visible', timeout: 30000 });
  const reloadedPaper = await waitForPaper(
    (p) => hasBoldRun(p.questions?.[0]?.contentDocument, 'MAIN') && p.questions?.[0]?.alternatives?.length === 2,
    'persisted state'
  );
  if (!hasBoldRun(reloadedPaper.questions[0].subQuestions?.[0]?.contentDocument, 'SUB ONE')) {
    throw new Error('Sub-question bold lost after reload');
  }
  step('formatting, alignment and alternatives persisted across reload');

  // 9. preview rendering
  await page.getByRole('button', { name: 'Preview' }).first().click();
  await page.locator('.paper-page').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForTimeout(3000);
  const html = await page.locator('.paper-page').first().innerHTML();
  const text = await page.locator('.paper-page').first().innerText();
  if (!html.includes('font-weight: 700')) throw new Error('Bold missing in preview');
  if (!/text-align:\s*center/.test(html)) throw new Error('Center alignment missing in preview');
  if (!/text-align:\s*right/.test(html)) throw new Error('Right alignment missing in preview');
  if (!text.includes('অথবা, ALT ONE')) throw new Error('Alternative missing in preview');
  if (!text.includes('অথবা, ADDED ALT')) throw new Error('Added alternative missing in preview');
  if (!html.includes('data-form-element')) throw new Error('Boxed form not rendered');
  const formText = await page.locator('.paper-page [data-form-element]').first().innerText();
  if (!formText.includes('অংশগ্রহণের ফরম') || !formText.includes('১. শিক্ষার্থীর নাম')) {
    throw new Error('Form content wrong: ' + formText.slice(0, 120));
  }
  step('preview shows bold, alignment, alternatives and the boxed form');

  // 10. import handoff appends without losing anything
  await page.evaluate(() => {
    localStorage.setItem(
      'newImageData',
      JSON.stringify({ questions: [{ id: 'imp_reg', type: 'short', content: 'IMPORTED REG', marks: 1 }] })
    );
  });
  await page.goto(BASE + '/editor?project=' + projectId + '&from=image', { waitUntil: 'domcontentloaded' });
  const finalPaper = await waitForPaper(
    (p) => p.questions?.some((q) => q.content === 'IMPORTED REG'),
    'import appended'
  );
  const contents = finalPaper.questions.map((q) => (typeof q.content === 'string' ? q.content : ''));
  if (!contents.includes('MAIN QUESTION') || !contents.includes('IMPORTED REG')) {
    throw new Error('Import lost earlier questions: ' + JSON.stringify(contents));
  }
  step('import appended and kept every existing question');
} catch (error) {
  ok = false;
  console.error('FAIL:', error.message);
} finally {
  await api('/api/projects/' + encodeURIComponent(projectId), { method: 'DELETE' }).catch(() => {});
  await browser.close();
}

process.exit(ok ? 0 : 1);
