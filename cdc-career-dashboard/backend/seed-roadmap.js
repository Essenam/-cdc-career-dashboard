require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const tasks = [
  [1,'Self-Assessment & Planning','Complete your PathwayU profile (Interests, Values, Personality, Workplace Preferences assessments) to explore career pathways aligned with your gifts',0],
  [1,'Self-Assessment & Planning','Create or update your resume using Jobscan resume checker for initial formatting feedback',1],
  [1,'Self-Assessment & Planning','Build your LinkedIn profile with a professional photo and headline',2],
  [1,'Activate Your Platforms','Log in to Handshake and complete your profile with skills, interests, and desired job/internship types',3],
  [1,'Activate Your Platforms','Activate your St. Thomas Connect account to begin exploring the alumni network and fields of interest',4],
  [1,'Activate Your Platforms','Set up automatic job feeds on Handshake tailored to your interests',5],
  [1,'Build Foundations Through Mentorship & Experience','Connect with a trusted mentor – meet with a Career Educator at the CDC to discuss your interests and goals',6],
  [1,'Build Foundations Through Mentorship & Experience','Attend introductory CDC workshops and events to build career awareness',7],
  [1,'Build Foundations Through Mentorship & Experience','Explore student clubs, activities, and part-time work relevant to your career interests (building early experience)',8],
  [1,'Build Foundations Through Mentorship & Experience','Build early experience through summer jobs or volunteer opportunities to develop transferable skills',9],
  [1,'Use Data for Exploration','Use the Labor Market Tool to research job trends and growth opportunities in industries of interest',10],
  [1,'Use Data for Exploration','Explore "What Can I Do With This Major?" resources to connect academic programs with career paths',11],
  [2,'Strategic Career Planning with Mentorship','Create an initial career plan with a Career Educator at the CDC based on your interests, skills, and values from PathwayU',0],
  [2,'Strategic Career Planning with Mentorship','Schedule regular mentoring sessions with a trusted advisor to discuss your major/minor choice and career direction',1],
  [2,'Strategic Career Planning with Mentorship','Conduct informational interviews or job shadows with professionals in your target fields to clarify your interests',2],
  [2,'Research & Network Strategically','Use the Labor Market Tool to identify high-demand roles, salary expectations, and growth opportunities in your target fields',3],
  [2,'Research & Network Strategically',"Leverage Jobscan to analyze job descriptions in roles you're targeting and identify key skills employers seek",4],
  [2,'Research & Network Strategically','Use St. Thomas Connect to find alumni in your target industries and request informational interviews',5],
  [2,'Research & Network Strategically','Search and explore internship & job postings on Handshake to understand typical qualifications and skill requirements',6],
  [2,'Research & Network Strategically','Attend CDC workshops and events, including on-campus career fairs, to practice networking skills and connect with employers',7],
  [2,'Build Your Professional Foundation','Update your resume & personal statement based on Handshake job descriptions and Jobscan feedback',8],
  [2,'Build Your Professional Foundation','Have your resume reviewed at the CDC by a career professional',9],
  [2,'Build Your Professional Foundation','Establish & grow your personal and professional network—everyone counts: classmates, peers, faculty, staff, friends, family, and co-workers',10],
  [2,'Build Your Professional Foundation','Join professional associations or student organizations related to your major and career interests',11],
  [3,'Gain Meaningful Experiential Learning','Find internships on Handshake using Labor Market Tool insights to identify relevant companies and industries',0],
  [3,'Gain Meaningful Experiential Learning','Apply for leadership positions, research opportunities, or part-time roles that build career-relevant skills',1],
  [3,'Gain Meaningful Experiential Learning','Gain relevant experience through internships, leadership positions, volunteer work, research, or employment',2],
  [3,'Gain Meaningful Experiential Learning','Reflect on your experiences and discuss career implications with your CDC mentor or advisor',3],
  [3,'Practice & Polish Your Professional Skills','Schedule a Big Interview session or mock interview with the CDC to practice in a low-stakes setting',4],
  [3,'Practice & Polish Your Professional Skills','Use Big Interview to practice interview skills with AI-powered video coaching and receive personalized feedback',5],
  [3,'Practice & Polish Your Professional Skills','Research target careers, industries, potential employers, and graduate school possibilities using Handshake and Labor Market Tool',6],
  [3,'Practice & Polish Your Professional Skills','Build & polish your brand on LinkedIn using the St. Thomas LinkedIn Optimization Guide',7],
  [3,'Practice & Polish Your Professional Skills','Optimize your Handshake profile to increase visibility to employers searching for candidates with your experience',8],
  [3,'Expand Your Professional Network','Connect with employers at Handshake career & opportunity fairs, both on and off-campus',9],
  [3,'Expand Your Professional Network','Use St. Thomas Connect to expand your professional network and find alumni mentors at target companies',10],
  [3,'Expand Your Professional Network','Identify and join professional associations related to your career interests (e.g., industry groups, regional chapters)',11],
  [3,'Expand Your Professional Network','Continue building relationships with peers, mentors, and professionals in your field',12],
  [3,'Expand Your Professional Network','Attend networking events, informational sessions, and industry conferences when possible',13],
  [3,'Optimize Your Application Materials',"Use Jobscan to align your resume and LinkedIn profile keywords with job descriptions you're targeting",14],
  [3,'Optimize Your Application Materials','Get feedback from CDC advisors and mentors on your resume and application materials',15],
  [3,'Optimize Your Application Materials','Tailor your resume and LinkedIn profile for roles you\'re targeting',16],
  [4,'Strategic Job Search','Search for full-time positions on Handshake using Labor Market Tool salary and location filters to make informed decisions',0],
  [4,'Strategic Job Search','Continually develop & refine your LinkedIn profile and resume using Jobscan feedback as you apply',1],
  [4,'Strategic Job Search','Prepare and submit applications for employment or graduate/professional schools',2],
  [4,'Strategic Job Search','Cast a wider net: use multiple job boards in addition to Handshake for maximum opportunity exposure',3],
  [4,'Master the Interview Process','Use Big Interview for final interview prep before company meetings and final rounds',4],
  [4,'Master the Interview Process','Practice with CDC-facilitated mock interviews to refine your storytelling and responses',5],
  [4,'Master the Interview Process','Ask mentors or alumni for feedback on your interview approach',6],
  [4,'Leverage Your Network & Alumni Connections','Nurture your network: attend student/alumni and networking events, and find chances for one-on-one informational meetings',7],
  [4,'Leverage Your Network & Alumni Connections','Use St. Thomas Connect to reconnect with alumni and request coffee chats, mentorship, or informational interviews',8],
  [4,'Leverage Your Network & Alumni Connections','Connect with employers at Handshake-hosted career fairs, company information sessions, and student club events',9],
  [4,'Leverage Your Network & Alumni Connections','Leverage Handshake messaging to follow up with recruiters and build relationships',10],
  [4,'Leverage Your Network & Alumni Connections','Activate your trusted mentors and advisors for encouragement and next-step guidance as you navigate your search',11],
  [4,'Negotiate & Close Your Offer','Attend CDC workshops on negotiating salary and benefits to advocate for yourself effectively',12],
  [4,'Negotiate & Close Your Offer','Use Labor Market Tool salary data to inform your negotiation discussions',13],
  [4,'Negotiate & Close Your Offer','Consult with your mentors or CDC advisor on evaluating offers and making your decision',14],
  [4,'Negotiate & Close Your Offer','Have professional attire ready for interviews and in-person meetings',15],
  [4,'Negotiate & Close Your Offer','Close the loop by informing your network and mentors once you\'ve accepted a position',16],
];

async function run() {
  await client.connect();
  console.log('Connected.');

  // Fix permissions so Supabase REST API can access the table
  await client.query(`
    GRANT ALL ON TABLE roadmap_tasks TO anon;
    GRANT ALL ON TABLE roadmap_tasks TO authenticated;
    GRANT ALL ON TABLE roadmap_tasks TO service_role;
  `);
  console.log('Permissions granted.');

  // Clear bad data from previous run
  await client.query('DELETE FROM roadmap_tasks');
  console.log('Cleared old data.');

  // Insert clean data row by row
  for (const [year, section, task_text, order_index] of tasks) {
    await client.query(
      'INSERT INTO roadmap_tasks (year, section, task_text, order_index, active) VALUES ($1,$2,$3,$4,true)',
      [year, section, task_text, order_index]
    );
  }
  console.log(`Inserted ${tasks.length} tasks.`);

  // Reload PostgREST schema cache
  await client.query("NOTIFY pgrst, 'reload schema'");
  console.log('Schema cache reload triggered.');

  const { rows } = await client.query('SELECT COUNT(*) FROM roadmap_tasks WHERE active = true');
  console.log(`Active tasks in DB: ${rows[0].count}`);

  await client.end();
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
