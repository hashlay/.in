// More thorough syntax check: extract inline JS and validate
var fs = require('fs');
var h = fs.readFileSync('hashlay-admin.html', 'utf8');

// Find the inline script block
var start = h.indexOf('<script>') + 8;
var end = h.lastIndexOf('</script>');
var js = h.substring(start, end);

// Count various brackets to find mismatches
var stack = [];
var inString = false;
var stringChar = '';
var inTemplate = 0;
var inComment = false;
var inBlockComment = false;
var escaped = false;
var lines = js.split('\n');

for (var lineIdx = 0; lineIdx < lines.length; lineIdx++) {
  var line = lines[lineIdx];
  for (var i = 0; i < line.length; i++) {
    var c = line[i];
    var next = line[i+1] || '';
    
    if (escaped) { escaped = false; continue; }
    if (c === '\\') { escaped = true; continue; }
    
    if (inBlockComment) {
      if (c === '*' && next === '/') { inBlockComment = false; i++; }
      continue;
    }
    if (inComment) continue;
    
    if (!inString && c === '/' && next === '/') { inComment = true; continue; }
    if (!inString && c === '/' && next === '*') { inBlockComment = true; i++; continue; }
    
    if (inString) {
      if (c === stringChar) inString = false;
      continue;
    }
    
    if (c === '"' || c === "'") { inString = true; stringChar = c; continue; }
    if (c === '`') { inTemplate++; continue; }
    
    if (c === '{' || c === '(' || c === '[') {
      stack.push({ char: c, line: lineIdx + 1 + (start > 0 ? h.substring(0, start).split('\n').length - 1 : 0) });
    }
    if (c === '}' || c === ')' || c === ']') {
      var expected = c === '}' ? '{' : (c === ')' ? '(' : '[');
      if (stack.length === 0) {
        console.log('EXTRA CLOSING', c, 'at JS line', lineIdx+1, '(HTML line ~' + (lineIdx + 1 + h.substring(0, start).split('\n').length - 1) + ')');
        console.log('  Content:', line.substring(Math.max(0,i-20), i+20));
      } else {
        var top = stack.pop();
        if (top.char !== expected) {
          console.log('MISMATCH:', top.char, 'opened at line', top.line, 'but closed with', c, 'at JS line', lineIdx+1);
        }
      }
    }
  }
  inComment = false;
}

if (stack.length > 0) {
  console.log('UNCLOSED BRACKETS:');
  stack.forEach(function(s) { console.log('  ', s.char, 'at HTML line', s.line); });
} else {
  console.log('All brackets balanced!');
}

// Also check with eval attempt
try {
  new Function(js);
  console.log('Function constructor: PASS');
} catch(e) {
  console.log('Function constructor FAIL:', e.message);
}
