const fs = require('fs');
let c = fs.readFileSync('hashlay-admin.html', 'utf8');
c = c.replace(/👁/g, '<i class="fa-solid fa-eye"></i>');
c = c.replace(/✏️/g, '<i class="fa-solid fa-pencil"></i>');
c = c.replace(/🗑️/g, '<i class="fa-solid fa-trash"></i>');
fs.writeFileSync('hashlay-admin.html', c);
