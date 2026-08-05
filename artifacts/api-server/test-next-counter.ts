import { db } from '@workspace/db';
import { nextCounter } from './src/lib/counter';

async function run() {
  try {
    const res = await nextCounter('kaccha_invoice_2026');
    console.log("Next counter is:", res);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}
run();
