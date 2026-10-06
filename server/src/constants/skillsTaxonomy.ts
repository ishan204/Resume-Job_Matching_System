import { SkillCategory } from '@shared';

export interface SkillDefinition {
  canonical: string;
  category: SkillCategory;
  synonyms: string[];
}

export const SKILL_TAXONOMY: SkillDefinition[] = [
  // Languages
  { canonical: 'JavaScript', category: 'languages', synonyms: ['js', 'es6', 'es2015', 'ecmascript'] },
  { canonical: 'TypeScript', category: 'languages', synonyms: ['ts'] },
  { canonical: 'Python', category: 'languages', synonyms: ['python3', 'py'] },
  { canonical: 'Java', category: 'languages', synonyms: ['core java', 'j2ee'] },
  { canonical: 'C++', category: 'languages', synonyms: ['cpp', 'c plus plus'] },
  { canonical: 'C#', category: 'languages', synonyms: ['csharp', '.net c#'] },
  { canonical: 'Go', category: 'languages', synonyms: ['golang'] },
  { canonical: 'Rust', category: 'languages', synonyms: ['rustlang'] },
  { canonical: 'Ruby', category: 'languages', synonyms: ['ruby on rails'] },
  { canonical: 'PHP', category: 'languages', synonyms: ['php7', 'php8'] },
  { canonical: 'Swift', category: 'languages', synonyms: ['swiftui'] },
  { canonical: 'Kotlin', category: 'languages', synonyms: ['kotlin multiplatform'] },
  { canonical: 'SQL', category: 'languages', synonyms: ['structured query language', 'ansi sql', 't-sql', 'pl/sql'] },
  { canonical: 'HTML5', category: 'languages', synonyms: ['html'] },
  { canonical: 'CSS3', category: 'languages', synonyms: ['css', 'scss', 'sass', 'less'] },
  { canonical: 'Bash', category: 'languages', synonyms: ['shell script', 'sh', 'zsh'] },
  { canonical: 'Scala', category: 'languages', synonyms: [] },
  { canonical: 'R', category: 'languages', synonyms: ['r programming'] },

  // Frameworks & Libraries
  { canonical: 'React', category: 'frameworks', synonyms: ['react.js', 'reactjs'] },
  { canonical: 'Next.js', category: 'frameworks', synonyms: ['nextjs', 'next'] },
  { canonical: 'Vue.js', category: 'frameworks', synonyms: ['vue', 'vuejs', 'vue3'] },
  { canonical: 'Nuxt.js', category: 'frameworks', synonyms: ['nuxt', 'nuxtjs'] },
  { canonical: 'Angular', category: 'frameworks', synonyms: ['angularjs', 'angular 2+'] },
  { canonical: 'Svelte', category: 'frameworks', synonyms: ['sveltekit'] },
  { canonical: 'Node.js', category: 'frameworks', synonyms: ['nodejs', 'node'] },
  { canonical: 'Express.js', category: 'frameworks', synonyms: ['express', 'expressjs'] },
  { canonical: 'NestJS', category: 'frameworks', synonyms: ['nest.js', 'nest'] },
  { canonical: 'FastAPI', category: 'frameworks', synonyms: ['fast api'] },
  { canonical: 'Django', category: 'frameworks', synonyms: ['django rest framework', 'drf'] },
  { canonical: 'Flask', category: 'frameworks', synonyms: [] },
  { canonical: 'Spring Boot', category: 'frameworks', synonyms: ['spring', 'spring framework'] },
  { canonical: 'ASP.NET Core', category: 'frameworks', synonyms: ['.net core', 'asp.net', 'dotnet'] },
  { canonical: 'Tailwind CSS', category: 'frameworks', synonyms: ['tailwindcss', 'tailwind'] },
  { canonical: 'Bootstrap', category: 'frameworks', synonyms: [] },
  { canonical: 'GraphQL', category: 'frameworks', synonyms: ['apollo graphql', 'relay'] },
  { canonical: 'REST API', category: 'frameworks', synonyms: ['restful api', 'rest apis', 'restful web services', 'rest'] },
  { canonical: 'gRPC', category: 'frameworks', synonyms: ['protobuf', 'protocol buffers'] },
  { canonical: 'PyTorch', category: 'frameworks', synonyms: ['torch'] },
  { canonical: 'TensorFlow', category: 'frameworks', synonyms: ['tf', 'keras'] },
  { canonical: 'Redux', category: 'frameworks', synonyms: ['redux toolkit', 'rtk'] },

  // Databases
  { canonical: 'PostgreSQL', category: 'databases', synonyms: ['postgres', 'psql'] },
  { canonical: 'MySQL', category: 'databases', synonyms: ['mariadb'] },
  { canonical: 'MongoDB', category: 'databases', synonyms: ['mongo', 'mongoose'] },
  { canonical: 'Redis', category: 'databases', synonyms: ['redis cache'] },
  { canonical: 'SQLite', category: 'databases', synonyms: ['sqlite3'] },
  { canonical: 'Elasticsearch', category: 'databases', synonyms: ['elastic search', 'elk stack', 'opensearch'] },
  { canonical: 'Cassandra', category: 'databases', synonyms: ['apache cassandra'] },
  { canonical: 'DynamoDB', category: 'databases', synonyms: ['amazon dynamodb'] },
  { canonical: 'Firebase', category: 'databases', synonyms: ['firestore', 'firebase realtime db'] },
  { canonical: 'Supabase', category: 'databases', synonyms: [] },
  { canonical: 'Prisma ORM', category: 'databases', synonyms: ['prisma'] },

  // Cloud & DevOps
  { canonical: 'AWS', category: 'cloudDevops', synonyms: ['amazon web services', 'ec2', 's3', 'lambda', 'ecs', 'eks', 'rds', 'cloudformation'] },
  { canonical: 'Google Cloud Platform (GCP)', category: 'cloudDevops', synonyms: ['gcp', 'google cloud', 'bigquery', 'cloud run', 'gke'] },
  { canonical: 'Microsoft Azure', category: 'cloudDevops', synonyms: ['azure', 'azure devops', 'azure functions'] },
  { canonical: 'Docker', category: 'cloudDevops', synonyms: ['containerization', 'docker compose'] },
  { canonical: 'Kubernetes', category: 'cloudDevops', synonyms: ['k8s', 'helm', 'k8s cluster'] },
  { canonical: 'Terraform', category: 'cloudDevops', synonyms: ['iac', 'infrastructure as code'] },
  { canonical: 'CI/CD', category: 'cloudDevops', synonyms: ['continuous integration', 'continuous deployment', 'github actions', 'gitlab ci', 'jenkins', 'circleci', 'argo cd'] },
  { canonical: 'Linux', category: 'cloudDevops', synonyms: ['ubuntu', 'debian', 'centos', 'redhat', 'fedora'] },
  { canonical: 'Nginx', category: 'cloudDevops', synonyms: ['reverse proxy'] },
  { canonical: 'Kafka', category: 'cloudDevops', synonyms: ['apache kafka', 'message queue', 'event streaming'] },
  { canonical: 'RabbitMQ', category: 'cloudDevops', synonyms: ['amqp', 'message broker'] },
  { canonical: 'Microservices', category: 'cloudDevops', synonyms: ['microservice architecture', 'distributed systems'] },
  { canonical: 'Prometheus', category: 'cloudDevops', synonyms: ['grafana', 'monitoring', 'observability', 'datadog'] },

  // Tools & Practices
  { canonical: 'Git', category: 'tools', synonyms: ['github', 'gitlab', 'bitbucket', 'version control'] },
  { canonical: 'Jira', category: 'tools', synonyms: ['confluence', 'atlassian'] },
  { canonical: 'Unit Testing', category: 'tools', synonyms: ['jest', 'vitest', 'pytest', 'mocha', 'chai', 'junit', 'tdd'] },
  { canonical: 'End-to-End Testing', category: 'tools', synonyms: ['cypress', 'playwright', 'selenium'] },
  { canonical: 'Webpack', category: 'tools', synonyms: ['vite', 'turbopack', 'rollup'] },
  { canonical: 'Postman', category: 'tools', synonyms: ['swagger', 'openapi', 'api testing'] },
  { canonical: 'Figma', category: 'tools', synonyms: ['ui/ux design', 'wireframing'] },
  { canonical: 'Agile / Scrum', category: 'tools', synonyms: ['agile', 'scrum', 'kanban', 'sprint planning'] },

  // Soft Skills & Leadership
  { canonical: 'Team Leadership', category: 'softSkills', synonyms: ['mentoring', 'team lead', 'coaching', 'technical leadership', 'cross-functional leadership'] },
  { canonical: 'Communication', category: 'softSkills', synonyms: ['verbal communication', 'written communication', 'stakeholder management', 'presentation skills'] },
  { canonical: 'Problem Solving', category: 'softSkills', synonyms: ['critical thinking', 'troubleshooting', 'analytical skills', 'root cause analysis'] },
  { canonical: 'System Design', category: 'domainKnowledge', synonyms: ['software architecture', 'high-level design', 'low-level design', 'scalability', 'performance optimization'] },
  { canonical: 'Data Structures & Algorithms', category: 'domainKnowledge', synonyms: ['dsa', 'algorithm design', 'complexity analysis'] },
  { canonical: 'Security & Auth', category: 'domainKnowledge', synonyms: ['oauth2', 'jwt', 'rbac', 'owasp', 'cybersecurity', 'authentication', 'authorization'] },
  { canonical: 'Machine Learning', category: 'domainKnowledge', synonyms: ['ai', 'artificial intelligence', 'nlp', 'deep learning', 'llm', 'generative ai', 'data science'] }
];

export function normalizeSkill(input: string): SkillDefinition | null {
  const cleanInput = input.trim().toLowerCase();
  for (const def of SKILL_TAXONOMY) {
    if (def.canonical.toLowerCase() === cleanInput) return def;
    if (def.synonyms.some(s => s.toLowerCase() === cleanInput)) return def;
  }
  return null;
}

export function extractSkillsFromText(text: string): { skills: string[]; categorized: Record<SkillCategory, string[]> } {
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  const categorized: Record<SkillCategory, string[]> = {
    languages: [],
    frameworks: [],
    databases: [],
    cloudDevops: [],
    tools: [],
    softSkills: [],
    domainKnowledge: []
  };

  for (const item of SKILL_TAXONOMY) {
    const patterns = [item.canonical.toLowerCase(), ...item.synonyms.map(s => s.toLowerCase())];
    for (const pat of patterns) {
      // Escape regex special chars
      const escaped = pat.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      // Match with word boundaries or punctuation boundaries
      const regex = new RegExp(`(^|[^a-zA-Z0-9#+])${escaped}([^a-zA-Z0-9#+]|$)`, 'i');
      if (regex.test(lower)) {
        if (!matched.has(item.canonical)) {
          matched.add(item.canonical);
          categorized[item.category].push(item.canonical);
        }
        break;
      }
    }
  }

  return {
    skills: Array.from(matched),
    categorized
  };
}
