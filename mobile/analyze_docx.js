const fs = require('fs');
const path = require('path');

// docx是zip文件，我们用adm-zip来读取
let AdmZip;
try {
  AdmZip = require('adm-zip');
} catch(e) {
  console.log('需要安装adm-zip');
  process.exit(1);
}

const zip = new AdmZip('c:\\program1\\super-training\\信安-224王艳创意组-福建警察学院-智慧安防巡.docx');
const entries = zip.getEntries();

// 提取document.xml和styles.xml的关键信息
const docEntry = entries.find(e => e.entryName === 'word/document.xml');
const stylesEntry = entries.find(e => e.entryName === 'word/styles.xml');

if (docEntry) {
  const docXml = zip.readAsText(docEntry);
  console.log('=== document.xml 前5000字符 ===');
  console.log(docXml.substring(0, 5000));
  console.log('\n=== 文档中使用的字体信息 ===');
  const fontMatches = docXml.match(/w:ascii="([^"]+)"|w:eastAsia="([^"]+)"|w:hAnsi="([^"]+)"/g);
  if (fontMatches) {
    const fonts = new Set();
    fontMatches.forEach(m => {
      const v = m.match(/"([^"]+)"/g);
      if (v) v.forEach(f => fonts.add(f.replace(/"/g,'')));
    });
    console.log([...fonts]);
  }
  console.log('\n=== 字号信息 (w:sz w:val) ===');
  const szMatches = docXml.match(/w:sz w:val="(\d+)"/g);
  if (szMatches) {
    const szs = {};
    szMatches.forEach(m => {
      const v = m.match(/w:val="(\d+)"/)[1];
      szs[v] = (szs[v] || 0) + 1;
    });
    console.log(szs);
  }
  console.log('\n=== 行距信息 (w:line) ===');
  const lineMatches = docXml.match(/w:line="(\d+)"/g);
  if (lineMatches) {
    const lines = {};
    lineMatches.forEach(m => {
      const v = m.match(/w:line="(\d+)"/)[1];
      lines[v] = (lines[v] || 0) + 1;
    });
    console.log(lines);
  }
  console.log('\n=== 缩进信息 (w:firstLine) ===');
  const indentMatches = docXml.match(/w:firstLine="(\d+)"/g);
  if (indentMatches) {
    const indents = {};
    indentMatches.forEach(m => {
      const v = m.match(/w:firstLine="(\d+)"/)[1];
      indents[v] = (indents[v] || 0) + 1;
    });
    console.log(indents);
  }
  console.log('\n=== 页边距信息 (pgMar) ===');
  const pgMarMatch = docXml.match(/w:pgMar[^/]*\/>/g);
  if (pgMarMatch) console.log(pgMarMatch);
}
