'use strict';
const fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm'),path=require('path');
const dir=__dirname;
const bank=JSON.parse(fs.readFileSync(path.join(dir,'territory-01.json'),'utf8'));
const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(dir,'territory-01.js'),'utf8'),ctx);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.__AE_CAMPAIGN__)),bank);
assert.equal(bank.questions.length,900);
assert.equal(bank.skills.length,4);
const counts=new Map(),ids=new Set(),fps=new Set();
for(const q of bank.questions){
 assert.equal(q.sourceType,'exam-core');
 assert.equal(q.contentOrigin,'literal-exam-quiz');
 assert(q.sourceExam>=1&&q.sourceExam<=30);
 assert([1,2,3,4].includes(q.sourcePart));
 assert.equal(q.a.length,4);assert(q.c>=0&&q.c<4);
 assert(!ids.has(q.id));ids.add(q.id);assert(!fps.has(q.fingerprint));fps.add(q.fingerprint);
 assert.equal(new Set(q.a.map(x=>x.trim().toLowerCase())).size,4);
 assert.equal(q.q.split('___').length,2,'must be one gap: '+q.id);
 assert(!q.a.some((x,i)=>i!==q.c&&q.acceptedForms.some(y=>y.toLowerCase()===x.toLowerCase())),'wrong answer matches valid key: '+q.id);
 if(q.sourcePart===4){
  const regex=new RegExp('(^|\\W)'+q.keyword+'(?=\\W|$)','i');
  assert(q.a.every(x=>regex.test(x)),'Part 4 option must contain keyword '+q.id);
  assert(q.a.every(x=>x.trim().split(/\s+/).length>=2&&x.trim().split(/\s+/).length<=5),'Cambridge 2–5 words '+q.id);
  assert(q.q.includes('KEY WORD: '+q.keyword));
 }
 counts.set(q.sourcePart,(counts.get(q.sourcePart)||0)+1);
}
assert.deepEqual([...counts.entries()],[[1,240],[2,240],[3,240],[4,180]]);
const old=JSON.parse(require('child_process').execFileSync('git',['-C',dir,'show','a8b8ecb:territory-01.json'],{encoding:'utf8',maxBuffer:18000000}));
assert.equal(bank.campaignId,old.campaignId,'same campaign id means history is preserved');
console.log('PASS: 900 questions, original-only source, 4 quiz parts, 4 options, 2–5 words, stable history key.');

// === BLOCK-1-TESTS-START ===
{
  const curatedOverrides = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'curated-part4-overrides.json'), 'utf8')
  );
  assert(curatedOverrides['962028'], 'curated-part4-overrides.json debe contener el ítem 962028');

  const longItem = bank.questions.find(q => q.id === 962028);
  assert(longItem, 'Debe existir el ítem LONG (id 962028) en bank.questions');
  assert.strictEqual(longItem.sourceExam, 20);
  assert.strictEqual(longItem.sourcePart, 4);
  assert.strictEqual(longItem.sourceQuestion, 28);
  assert.strictEqual(longItem.a[longItem.c], 'spent a long time');

  assert.deepStrictEqual(
    longItem.acceptedForms,
    ['spent a long time', 'took a long time', 'was a long time'],
    'acceptedForms de 962028 debe conservar las tres variantes válidas del solucionario oficial de Cambridge'
  );

  const longTraps = longItem.a.filter((_, idx) => idx !== longItem.c);
  assert.strictEqual(longTraps.length, 3);

  const forbiddenForLong = new Set([
    ...longItem.acceptedForms.map(s => s.toLowerCase()),
    'a long time',
    'spent a long',
    'spent the long time',
    'kept a long time'
  ]);
  for (const trap of longTraps) {
    assert(!forbiddenForLong.has(trap.toLowerCase()), 'Distractor prohibido o ambiguo en 962028: ' + trap);
  }

  assert.deepStrictEqual(
    new Set(longTraps),
    new Set(['passed a long time', 'lasted a long time', 'spent long time']),
    'Los distractores de 962028 deben coincidir exactamente con los 3 curados'
  );

  const genSource = fs.readFileSync(path.join(__dirname, 'generate-exam-quiz.cjs'), 'utf8');
  assert(
    genSource.trimStart().startsWith("'use strict'") || genSource.trimStart().startsWith('"use strict"'),
    'generate-exam-quiz.cjs debe mantener use strict al principio'
  );
  assert(
    !genSource.includes('_block1WriteIntercepted'),
    'generate-exam-quiz.cjs no debe hacer monkey-patching de fs.writeFileSync'
  );

  const qeCssText = fs.readFileSync(path.join(__dirname, 'quiz-ergonomics.css'), 'utf8');
  assert(
    qeCssText.includes('html:root body[data-quiz-ergonomics][data-quiz-ergonomics][data-question-part="4"] #gameScreen#gameScreen .prompt-card'),
    'quiz-ergonomics.css debe usar selector de alta especificidad para .prompt-card en Part 4'
  );
  console.log('✓ Bloque 1 (estático) verificado: id 962028, acceptedForms, distractores y especificidad CSS.');
}
// === BLOCK-1-TESTS-END ===
