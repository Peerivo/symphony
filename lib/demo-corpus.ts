export type DemoVerse={osis:string;reference:string;text:string;questions:string[]};
export const demoVerses:DemoVerse[]=[
{osis:"Ps.9.10",reference:"Пс. 9:10",text:"И будет Господь прибежищем угнетенному, прибежищем во времена скорби.",questions:["Что означает «прибежище» в этом псалме?","Как этот стих понимали толкователи?","Какие места Псалтири говорят об убежище и твердыне?"]},
{osis:"Eph.4.14",reference:"Еф. 4:14",text:"Дабы мы не были более младенцами, колеблющимися и увлекающимися всяким ветром учения…",questions:["Что означает «всякий ветер учения»?","Связаны ли Еф. 4:14 и Еф. 4:17–19?","Можно ли этим стихом доказать ложность конкретного учения?"]}
];
export function findDemo(q:string){const n=q.toLowerCase().replace(/\s/g,"");return demoVerses.find(v=>n.includes(v.osis.toLowerCase().replace(".",""))||n.includes(v.reference.toLowerCase().replace(/\s/g,""))||v.text.toLowerCase().includes(q.toLowerCase()))}
