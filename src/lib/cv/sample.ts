import { emptyCv, type Cv } from './schema';
/** Placeholder content only: it shows the layout of a real CareerBridge CV without inventing a person. */
export function sampleCv(): Cv {
  const cv = emptyCv('student');
  cv.personal = { full_name: 'Your Name', headline: 'Your course, your institution', email: 'you@example.com', phone: '+234 800 000 0000', location: 'City, State', links: [{ label: 'LinkedIn', url: 'linkedin.com/in/you' }] };
  cv.summary = 'Two to four sentences about your course, the skills you are building and the placement you want.';
  cv.education = [{ institution: 'Your Institution', degree: 'Your Course of Study', location: 'City', start: '2023', end: '2027 (expected)', details: 'Relevant coursework, grades or honours' }];
  cv.projects = [{ name: 'Academic or personal project', link: '', description: 'What it is and why you built it.', bullets: ['What you did, starting with an action word', 'The tools you used or the result you reached'] }];
  cv.skills = { technical: ['Skill one', 'Skill two', 'Skill three'], soft: ['Teamwork', 'Communication'] };
  cv.internships = [{ title: 'Volunteering or training role (optional)', organisation: 'Organisation', location: '', start: '2025', end: '2025', bullets: ['One thing you did or learned'] }];
  return cv;
}
