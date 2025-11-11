/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#4A90E2',
        'primary-dark': '#137FEC',
        'text-dark': '#333',
        'text-gray': '#6B7280',
        'text-light': '#9CA3AF',
        'text-secondary': '#617589',
        'border-gray': '#D1D5DB',
        'border-light': '#E5E7EB',
        'bg-light': '#F2F2F2',
        'bg-gray': '#F6F7F8',
        'bg-card': '#FFF',
        'status-pending': '#FEF9C3',
        'status-pending-text': '#854D0E',
        'status-overdue': '#FEE2E2',
        'status-overdue-text': '#991B1B',
        'status-progress': '#DBEAFE',
        'status-progress-text': '#1E40AF',
        'status-completed': '#DCFCE7',
        'status-completed-text': '#166534',
        'warning': '#D97706',
        'danger': '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'Roboto', 'Helvetica', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
