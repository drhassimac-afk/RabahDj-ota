const fs = require('fs');
let g = fs.readFileSync('.gitignore', 'utf8');
if (/^android\/?$/m.test(g) || /^ios\/?$/m.test(g)) {
  g = g.replace(/^android\/?$/m, '/android/').replace(/^ios\/?$/m, '/ios/');
  fs.writeFileSync('.gitignore', g);
  console.log('✅ .gitignore: /android/ و /ios/ أصبحا مرتكزين على الجذر فقط');
} else console.log('↷ .gitignore: لا نمط غير مرتكز — سنعتمد git add -f');

let s = fs.readFileSync('src/app/parental.tsx', 'utf8');
const imp = s.match(/import React, \{([^}]*)\} from 'react';/);
if (imp && !/\buseRef\b/.test(imp[1])) {
  s = s.replace(imp[0], "import React, { useCallback, useEffect, useRef, useState } from 'react';");
  fs.writeFileSync('src/app/parental.tsx', s);
  console.log('✅ أُضيف useRef إلى استيراد react');
} else if (imp) console.log('↷ useRef مستورد مسبقاً');
else console.log('⚠️ لم أجد استيراد React القياسي');
