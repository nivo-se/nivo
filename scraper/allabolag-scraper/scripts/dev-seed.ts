import { db, jobs, rawCompanies } from '../src/lib/db';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('Seeding development database...');
  
  try {
    // Create a sample job
    const jobId = uuidv4();
    await db.insert(jobs).values({
      id: jobId,
      jobType: 'segmentation',
      filterHash: 'sample-hash-123',
      params: {
        revenueFrom: 15000,
        revenueTo: 150000,
        profitFrom: 500,
        profitTo: 87067716,
        companyType: 'AB',
      },
      status: 'done',
      lastPage: 5,
      processedCount: 150,
    });
    
    // Create sample companies
    await db.insert(rawCompanies).values([
      {
        orgnr: '5561234567',
        companyName: 'Example AB',
        companyId: 'ABC123',
        companyIdHint: 'hint123',
        homepage: 'https://example.se',
        naceCategories: ['62.010', '62.020'],
        segmentName: ['IT Services', 'Software Development'],
        revenueSek: 2500000,
        profitSek: 500000,
        foundationYear: 2010,
        accountsLastYear: '2023',
      },
      {
        orgnr: '5567654321',
        companyName: 'Test Company AB',
        companyId: null,
        companyIdHint: null,
        homepage: 'https://test.se',
        naceCategories: ['47.110'],
        segmentName: ['Retail Trade'],
        revenueSek: 15000000,
        profitSek: 2000000,
        foundationYear: 2015,
        accountsLastYear: '2023',
      },
    ]);
    
    console.log('✅ Database seeded successfully!');
    console.log(`Created job: ${jobId}`);
    console.log('Created 2 sample companies');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    process.exit(0);
  }
}

seed();









