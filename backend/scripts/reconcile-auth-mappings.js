import 'dotenv/config';
import AuthReconciliationService from '../src/services/authReconciliationService.js';

function parseArgs(argv = []) {
  const options = {
    scope: 'all',
    apply: false,
    createMissingUsers: true,
    linkByEmail: true,
  };

  for (const arg of argv) {
    if (arg === '--apply') options.apply = true;
    if (arg === '--users') options.scope = 'users';
    if (arg === '--restaurants') options.scope = 'restaurants';
    if (arg === '--no-create') options.createMissingUsers = false;
    if (arg === '--no-link') options.linkByEmail = false;
  }

  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.apply) {
    const audit = await AuthReconciliationService.buildAudit(options.scope);
    console.log(JSON.stringify(audit, null, 2));
    return;
  }

  const result = await AuthReconciliationService.reconcile({
    scope: options.scope,
    createMissingUsers: options.createMissingUsers,
    linkByEmail: options.linkByEmail,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('Auth reconciliation failed:', error.message);
  process.exit(1);
});
