const bcrypt = require('bcryptjs');

async function test() {
  const otp = "185887";
  const otpHash = await bcrypt.hash(otp, 10);
  console.log("otpHash:", otpHash);
  const isMatch = await bcrypt.compare(otp, otpHash);
  console.log("isMatch:", isMatch);
}
test();
