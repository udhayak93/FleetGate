export const INITIAL_PROFILES = [
  {
    id: 'usr_admin_01',
    email: 'admin@gmail.com',
    full_name: 'System Admin',
    role: 'admin',
    password: 'Admin@123',
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'usr_staff_01',
    email: 'staff1@gmail.com',
    full_name: 'Gate Staff',
    role: 'staff',
    is_active: true,
    created_at: new Date().toISOString(),
  }
];

// No dummy lorries - starts completely clean for private live operations
export const INITIAL_LORRIES = [];

// No dummy movements - starts completely clean for private live operations
export const INITIAL_MOVEMENTS = [];
