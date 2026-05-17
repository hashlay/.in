var fs = require('fs');
var h = fs.readFileSync('hashlay-admin.html', 'utf8');
var i = h.indexOf('<script>');
var j = h.lastIndexOf('</script>');
var s = h.substring(i + 8, j);
fs.writeFileSync('_t.js', s);
console.log('Lines:', s.split('\n').length);
