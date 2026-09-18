const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const filePath = path.join(__dirname, 'src', 'htmlContent.ts');
const original = fs.readFileSync(filePath, 'utf8');

function replaceOnce(content, anchor, additionMultiline, label) {
  const count = content.split(anchor).length - 1;
  if (count !== 1) {
    throw new Error(`العلامة "${label}" ظهرت ${count} مرة بدل مرة وحدة.`);
  }
  // نحول الإضافة (مكتوبة بأسطر حقيقية للقراءة) إلى سطر واحد فيه \n نصية، بنفس أسلوب الملف
  const escaped = additionMultiline.replace(/\n/g, '\\n');
  return content.replace(anchor, anchor + escaped);
}

let content = original;

const anchor1 = 'let chatMsgCount = 0;';
const addition1 = `
window.getAdminStats = function(){
  var members = [];
  if (typeof conns !== 'undefined') { conns.forEach(function(v,k){ members.push({peerId:k, name:v.name}); }); }
  window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
    cmd:'adminStats',
    connected: (typeof conns!=='undefined' ? conns.size+1 : 1),
    viewers: (typeof viewerCalls!=='undefined' ? viewerCalls.length : 0),
    msgs: chatMsgCount,
    notifs: (typeof notifLog!=='undefined' ? notifLog.length : 0),
    room: (typeof room!=='undefined' ? room : '') || '',
    isHost: (typeof isHost!=='undefined' ? !!isHost : false),
    members: members
  }));
};
window.adminKickMember = function(peerId){
  if (typeof conns === 'undefined') return;
  var entry = conns.get(peerId);
  if(!entry) return;
  try{ entry.c.send({type:'kicked'}); }catch(e){}
  setTimeout(function(){ try{ entry.c.close(); }catch(e){} conns.delete(peerId); }, 200);
};
window.adminBroadcastAnnouncement = function(text){
  if (typeof broadcast === 'function') broadcast({type:'chat', name:'admin', text:text});
  if (typeof addMsg === 'function') addMsg('admin', text, false);
};`;
content = replaceOnce(content, anchor1, addition1, 'chatMsgCount');

const anchor2 = "if(d.type==='game') handleGameMsg(d);";
const addition2 = `
  if(d.type==='kicked'){ if(typeof toast==='function') toast('kicked'); window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({cmd:'kickedFromRoom'})); if(typeof peer!=='undefined' && peer) peer.destroy(); }`;
content = replaceOnce(content, anchor2, addition2, 'handleGameMsg');

// تحقق قبل الحفظ: نكتب نسخة مؤقتة ونفحص الـ syntax فعليًا بدون تنفيذ
const tmpFile = path.join(__dirname, '__syntax_check_tmp.mjs');
fs.writeFileSync(tmpFile, content, 'utf8');

try {
  execFileSync(process.execPath, ['--check', tmpFile], { stdio: 'pipe' });
  fs.unlinkSync(tmpFile);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('تم الفحص والحفظ بنجاح ✅ — الملف سليم syntactically');
} catch (err) {
  fs.unlinkSync(tmpFile);
  console.error('❌ فشل فحص الصياغة — لم يتم حفظ أي شي، الملف الأصلي سليم كما هو.');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
