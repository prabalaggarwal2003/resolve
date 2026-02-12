// Dark Mode Class Mappings for Common Patterns
// Use these utilities when updating components

export const darkModeClasses = {
  // Backgrounds
  bgWhite: 'bg-white dark:bg-gray-800',
  bgGray50: 'bg-gray-50 dark:bg-gray-900',
  bgGray100: 'bg-gray-100 dark:bg-gray-700',
  bgGray200: 'bg-gray-200 dark:bg-gray-600',

  // Borders
  borderGray200: 'border-gray-200 dark:border-gray-700',
  borderGray300: 'border-gray-300 dark:border-gray-600',

  // Text colors
  textGray900: 'text-gray-900 dark:text-gray-100',
  textGray800: 'text-gray-800 dark:text-gray-200',
  textGray700: 'text-gray-700 dark:text-gray-300',
  textGray600: 'text-gray-600 dark:text-gray-400',
  textGray500: 'text-gray-500 dark:text-gray-500',

  // Cards
  card: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',

  // Inputs
  input: 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100',

  // Buttons
  btnPrimary: 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white',
  btnSecondary: 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200',

  // Hover states
  hoverBg: 'hover:bg-gray-50 dark:hover:bg-gray-700',
  hoverBgLight: 'hover:bg-gray-100 dark:hover:bg-gray-600',
};

// Common component patterns
export const componentClasses = {
  page: 'bg-gray-50 dark:bg-gray-900 min-h-screen',
  container: 'max-w-7xl mx-auto',
  heading: 'text-2xl font-bold text-gray-900 dark:text-gray-100',
  subheading: 'text-lg font-semibold text-gray-900 dark:text-gray-100',
  description: 'text-gray-600 dark:text-gray-400',
  modal: 'bg-white dark:bg-gray-800 rounded-lg shadow-xl',
  modalOverlay: 'fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70',
  table: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  tableHeader: 'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  tableRow: 'hover:bg-gray-50 dark:hover:bg-gray-700',
  badge: 'px-2 py-1 rounded-full text-xs font-medium',
};

