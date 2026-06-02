// Fixed lookup-table data for scenario seeders.
// These have stable integer IDs and unique-name constraints — they are seeded
// as-is into every perfect-migration run so FK references stay consistent.

export const SCENARIO_TAGS = [
  { id: 1,  name: "typescript"   },
  { id: 2,  name: "react"        },
  { id: 3,  name: "nodejs"       },
  { id: 4,  name: "postgres"     },
  { id: 5,  name: "devops"       },
  { id: 6,  name: "security"     },
  { id: 7,  name: "performance"  },
  { id: 8,  name: "api-design"   },
  { id: 9,  name: "testing"      },
  { id: 10, name: "architecture" },
  { id: 11, name: "frontend"     },
  { id: 12, name: "backend"      },
  { id: 13, name: "mobile"       },
  { id: 14, name: "cloud"        },
  { id: 15, name: "open-source"  },
];

// Self-referential tree (parentid is a plain Int?, no FK constraint in v1).
// Root categories first so the ordering is safe regardless of FK mode.
export const SCENARIO_CATEGORIES = [
  { id: 1,  name: "Software",        slug: "software",        parentid: null },
  { id: 2,  name: "Hardware",        slug: "hardware",        parentid: null },
  { id: 3,  name: "Content",         slug: "content",         parentid: null },
  { id: 4,  name: "Frontend Tools",  slug: "frontend-tools",  parentid: 1 },
  { id: 5,  name: "Backend Tools",   slug: "backend-tools",   parentid: 1 },
  { id: 6,  name: "DevOps Tools",    slug: "devops-tools",    parentid: 1 },
  { id: 7,  name: "Databases",       slug: "databases",       parentid: 1 },
  { id: 8,  name: "Peripherals",     slug: "peripherals",     parentid: 2 },
  { id: 9,  name: "Courses",         slug: "courses",         parentid: 3 },
  { id: 10, name: "Podcasts",        slug: "podcasts",        parentid: 3 },
];
