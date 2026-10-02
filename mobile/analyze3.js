const AdmZip = require('adm-zip');
const zip = new AdmZip('c:\\program1\\super-training\\信安-224王艳创意组-福建警察学院-智慧安防巡.docx');
const allEntries = zip.getEntries();
const se = allEntries.find(e => e.entryName === 'word/styles.xml');
const xml = zip.readAsText(se);

const styleMatches = xml.match(/<w:style [^>]*>[\s\S]*?<\/w:style>/g);
const wantedIds = ['3','4','10','11','12','22','23','24','26'];
if (styleMatches) {
  styleMatches.forEach(s => {
    const idMatch = s.match(/w:styleId="([^"]+)"/);
    if (idMatch && wantedIds.includes(idMatch[1])) {
      console.log('\n========== Style: ' + idMatch[1] + ' ==========');
      const nameMatch = s.match(/<w:name w:val="([^"]+)"/);
      if (nameMatch) console.log('Name:', nameMatch[1]);
      const rprMatch = s.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
      if (rprMatch) console.log('rPr:', rprMatch[0]);
      const pprMatch = s.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
      if (pprMatch) console.log('pPr:', pprMatch[0]);
    }
  });
}

const docEntry = allEntries.find(e => e.entryName === 'word/document.xml');
const docXml = zip.readAsText(docEntry);
const paras = docXml.match(/<w:p [^>]*>[\s\S]*?<\/w:p>/g);
if (paras) {
  console.log('\n========== 更多段落格式（80-200） ==========');
  let shown = 0;
  for (let idx = 80; idx < paras.length && shown < 40; idx++) {
    const p = paras[idx];
    const textMatch = p.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textMatch) {
      const text = textMatch.map(t => t.replace(/<w:t[^>]*>/,'').replace(/<\/w:t>/,'')).join('');
      if (text.length > 3) {
        const szMatch = p.match(/w:sz w:val="(\d+)"/g);
        const boldMatch = p.match(/<w:b\/>/);
        const jcMatch = p.match(/w:jc w:val="(\w+)"/);
        const lineMatch = p.match(/w:line="(\d+)"/);
        const indentMatch = p.match(/w:firstLine="(\d+)"/);
        const leftIndentMatch = p.match(/w:left="(\d+)"/);
        const styleMatch = p.match(/w:pStyle w:val="(\w+)"/);
        const fontEAMatch = p.match(/w:eastAsia="([^"]+)"/);
        console.log(`[${idx}] Style=${styleMatch?styleMatch[1]:'-'} sz=${szMatch?[...new Set(szMatch.map(s=>s.match(/(\d+)/)[1]))].join(','):'-'} bold=${!!boldMatch} jc=${jcMatch?jcMatch[1]:'-'} line=${lineMatch?lineMatch[1]:'-'} indent=${indentMatch?indentMatch[1]:'-'} left=${leftIndentMatch?leftIndentMatch[1]:'-'} fontEA=${fontEAMatch?fontEAMatch[1]:'-'} | ${text.substring(0,60)}`);
        shown++;
      }
    }
  }
}
