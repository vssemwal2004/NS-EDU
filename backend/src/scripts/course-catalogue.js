// Usage: npm run catalogue --workspace backend -- <command>
//   sync     add every course in the Indian degree catalogue that is missing, then relink institutions
//   relink   relink every institution's programmes to catalogue courses (after editing courses or aliases)
import { env } from '../config/env.js';
import { closeDb } from '../db/collections.js';
import { relinkInstitutions, syncCatalogue } from '../modules/catalog/course-catalogue.js';

const command = process.argv[2];
try {
  if (!['sync', 'relink'].includes(command)) {
    console.log('Commands: sync, relink');
    process.exitCode = command ? 1 : 0;
  } else {
    console.log(`Course catalogue on "${env.mongodbDatabase}"…`);
    if (command === 'sync') console.log('Catalogue:', await syncCatalogue());
    console.log('Institutions:', await relinkInstitutions({ log: (line) => console.log(line) }));
  }
} catch (error) {
  console.error(`catalogue ${command} failed:`, error.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
