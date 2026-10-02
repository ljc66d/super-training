const AdmZip = require('adm-zip');
const zip = new AdmZip('c:\\program1\\super-training\\信安-224王艳创意组-福建警察学院-智慧安防巡.docx');
const entries = zip.getEntries();

// 读取styles.xml
const stylesEntry = entries.find(e => e.entryName === 'word/styles.xml');
if (stylesEntry) {
  const xml = zip.readAsText(stylesEntry);
  console.log('=== styles.xml ===');
  // 提取关键样式定义
  const styleMatches = xml.match(/<w:style [^>]*>[\s\S]*?<\/w:style>/g);
  if (styleMatches) {
    // 重点找pStyle 5, 14等
    const targets = ['5','14','1','2','a','b'];
    styleMatches.forEach(s => {
      const idMatch = s.match(/w:styleId="([^"]+)"/);
      if (idMatch && targets.includes(idMatch[1])) {
        console.log('\n--- Style: ' + idMatch[1] + ' ---');
        console.log(s.substring(0, 1500));
      }
    });
  }
}

// 读取更多document.xml来了解章节结构
const docEntry = entries.find(e => e.entryName === 'word/document.xml');
if (docEntry) {
  const xml = zip.readAsText(docEntry);
  // 找大段文字（正文段落）的格式特征
  console.log('\n=== 段落格式分析（前100个段落）===');
  const paras = xml.match(/<w:p [^>]*>[\s\S]*?<\/w:p>/g);
  if (paras) {
    let count = 0;
    paras.forEach((p, idx) => {
      if (count > 60) return;
      const textMatch = p.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (textMatch) {
        const text = textMatch.map(t => t.replace(/<w:t[^>]*>/,'').replace(/<\/w:t>/,'')).join('');
        if (text.length > 5) {
          const ppr = p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
          const szMatch = p.match(/w:sz w:val="(\d+)"/g);
          const boldMatch = p.match(/<w:b\/>/);
          const jcMatch = p.match(/w:jc w:val="(\w+)"/);
          const lineMatch = p.match(/w:line="(\d+)"/);
          const indentMatch = p.match(/w:firstLine="(\d+)"/);
          const styleMatch = p.match(/w:pStyle w:val="(\w+)"/);
          const fontMatch = p.match(/w:rFonts[^/]*\/>/g);
          console.log(`[${idx}] Style=${styleMatch?styleMatch[1]:'none'} sz=${szMatch?szMatch.map(s=>s.match(/(\d+)/)[1]).join(','):'none'} bold=${!!boldMatch} jc=${jcMatch?jcMatch[1]:'left'} line=${lineMatch?lineMatch[1]:'none'} indent=${indentMatch?indentMatch[1]:'none'} | ${text.substring(0,60)}`);
          count++;
        }
      }
    });
  }
}
