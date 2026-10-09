import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const testUrl = process.env.TEST_DATABASE_URL;
test('PostgreSQL question intake stays private, bounded and opt-in', { skip: !testUrl }, async()=>{
  if (!new URL(testUrl!).pathname.endsWith('_test')) throw new Error('Disposable _test database required');
  process.env.DATABASE_URL=testUrl; process.env.DIRECT_URL=testUrl;
  process.env.APP_ORIGIN='https://symphony-test.invalid';
  const {db}=await import('../lib/db');
  const {POST}=await import('../app/api/questions/route');
  const {searchCorpus}=await import('../lib/search');
  const {getVersePage}=await import('../lib/verse-page');
  const token=randomUUID(); const privateText='Проверочный приватный вопрос '+token;
  const osis='Test.'+token+'.1';
  const source=await db.source.create({data:{name:'Disposable test source',kind:'SCRIPTURE',canonicalUrl:'https://example.invalid/'+token,
    rightsStatus:'PUBLIC_DOMAIN',rightsEvidence:'Synthetic test only',checksum:'sha256:'+'0'.repeat(64),parserVersion:'test',fetchedAt:new Date()}});
  const corpus=await db.corpus.create({data:{slug:token,name:'Synthetic tests',kind:'SCRIPTURE',sourceId:source.id}});
  const work=await db.work.create({data:{title:'Synthetic fixture',corpusId:corpus.id,sourceId:source.id}});
  await db.passage.create({data:{workId:work.id,sourceId:source.id,ordinal:1,kind:'VERSE',text:'Synthetic fixture, not Scripture.',locator:'test:1',reviewStatus:'PUBLISHED',verse:{create:{osis,book:'Test',chapter:1,verse:1}}}});
  const priorBudget=await db.intakeBudget.findUnique({where:{key:'questions'}});
  const req=(data:unknown, origin='https://symphony-test.invalid')=>new Request('https://symphony-test.invalid/api/questions',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
  try {
    process.env.QUESTION_INTAKE_ENABLED='false';
    assert.equal((await POST(req({text:privateText,osis,consent:true}))).status,503);
    process.env.QUESTION_INTAKE_ENABLED='true';
    await db.intakeBudget.deleteMany({where:{key:'questions'}});
    assert.equal((await POST(req({text:privateText,osis,consent:false}))).status,400);
    assert.equal((await POST(req({text:privateText,osis,consent:true},'https://attacker.invalid'))).status,403);
    for(let i=0;i<2;i++) {
      const response=await POST(req({text:privateText,osis,consent:true}));
      assert.equal(response.status,202);assert.deepEqual(await response.json(),{accepted:true});
    }
    const rows=await db.question.findMany({where:{canonicalText:privateText},include:{signals:true,passages:true}});
    assert.equal(rows.length,1);assert.equal(rows[0].reviewStatus,'DRAFT');assert.equal(rows[0].signals[0].count,2);assert.equal(rows[0].passages.length,1);
    assert.equal((await searchCorpus(privateText)).questions.length,0);
    assert.equal((await getVersePage(osis))?.questions.length,0);
    assert.equal((await POST(req({text:privateText+' missing',osis:'Missing.1.1',consent:true}))).status,404);
    assert.equal(await db.question.count({where:{canonicalText:privateText+' missing'}}),0);
    await db.intakeBudget.update({where:{key:'questions'},data:{bucket:new Date(Math.floor(Date.now()/60000)*60000),count:30}});
    const limited=await POST(req({text:privateText,osis,consent:true}));assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'60');
    assert.equal((await db.question.findUniqueOrThrow({where:{id:rows[0].id},include:{signals:true}})).signals[0].count,2);
  } finally {
    process.env.QUESTION_INTAKE_ENABLED='false';
    await db.question.deleteMany({where:{canonicalText:privateText}});
    await db.corpus.delete({where:{id:corpus.id}});await db.source.delete({where:{id:source.id}});
    await db.intakeBudget.deleteMany({where:{key:'questions'}});
    if(priorBudget) await db.intakeBudget.create({data:priorBudget});
    await db.$disconnect();
  }
});
